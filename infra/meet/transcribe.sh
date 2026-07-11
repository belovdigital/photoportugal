#!/bin/bash
# Transcribe finished call recordings (ONE FILE PER SPEAKER — track egress)
# with OpenAI gpt-4o-transcribe and post per-speaker blocks to the main app,
# then DELETE the audio (privacy: no recording is ever stored long-term; the
# transcript in chat is the durable artifact). The app reconstructs dialogue
# order with an LLM — WebRTC drops silence, so per-file timestamps can't
# reliably interleave utterances.
#
# File naming (set by /api/video-call/webhook):
#   <room>__<identity>__<startEpochMs>.ogg
#
# Runs from cron every minute with flock. A call's file group is processed
# only when EVERY file in it has been stable for >1 min (egress keeps writing
# while the call is live).
#
# Requires /opt/photoportugal-meet/.env with:
#   OPENAI_API_KEY, TRANSCRIPT_ENDPOINT_SECRET (== main app CRON_SECRET)
set -u
cd /opt/photoportugal-meet
source .env
DIR=/opt/photoportugal-meet/recordings
LOG=/opt/photoportugal-meet/transcribe.log
WORK=/opt/photoportugal-meet/.transcribe-work
mkdir -p "$WORK"

log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

# Safety net: delete any stray non-audio egress artifacts (e.g. .webm video
# files from a misconfigured webhook) after an hour so the disk never fills.
find "$DIR" -name '*.webm' -mmin +60 -delete 2>/dev/null

stable=$(find "$DIR" -name '*__*__*.ogg' -mmin +1 2>/dev/null)
unstable=$(find "$DIR" -name '*__*__*.ogg' -mmin -1 2>/dev/null)
[ -z "$stable" ] && exit 0

rooms=$(echo "$stable" | sed -E 's|.*/([^_]+(-[^_]+)*)__.*|\1|' | sort -u)

for room in $rooms; do
  if echo "$unstable" | grep -q "/${room}__"; then
    continue  # call still recording or just ended — next run
  fi
  files=$(echo "$stable" | grep "/${room}__" || true)
  [ -z "$files" ] && continue

  speakers_json="$WORK/${room}.speakers.json"
  echo "[]" > "$speakers_json"
  fail=0

  while read -r f; do
    base=$(basename "$f")
    size=$(stat -c%s "$f")
    if [ "$size" -lt 4096 ]; then
      log "SKIP_TINY $base ($size bytes) — deleting"
      rm -f "$f"
      continue
    fi
    identity=$(echo "$base" | awk -F'__' '{print $2}')
    start_ms=$(echo "$base" | awk -F'__' '{print $3}' | sed 's/\.ogg$//')

    resp="$WORK/${base}.stt.json"
    if [ -n "${DEEPGRAM_API_KEY:-}" ]; then
      # Deepgram nova-3: better RU/echo robustness than whisper-1, cheaper,
      # native utterance timestamps. language=multi handles code-switching.
      curl -sS --max-time 300 \
        "https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&punctuate=true&utterances=true" \
        -H "Authorization: Token $DEEPGRAM_API_KEY" \
        -H "Content-Type: audio/ogg" \
        --data-binary "@$f" -o "$resp" 2>>"$LOG"
      echo "deepgram" > "$WORK/${base}.stt.engine"
    else
      curl -sS --max-time 300 https://api.openai.com/v1/audio/transcriptions \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -F "file=@$f;type=audio/ogg" -F model=whisper-1 \
        -F response_format=verbose_json -F "timestamp_granularities[]=word" \
        -o "$resp" 2>>"$LOG"
      echo "whisper" > "$WORK/${base}.stt.engine"
    fi

    ok=$(python3 -c "
import json
try:
    d=json.load(open('$resp'))
    if 'results' in d:  # deepgram
        u = (d.get('results') or {}).get('utterances') or []
        alt = (((d.get('results') or {}).get('channels') or [{}])[0].get('alternatives') or [{}])[0]
        print('yes' if (u or (alt.get('transcript') or '').strip()) else 'no')
    else:  # whisper
        print('yes' if ((d.get('words') or []) or (d.get('text') or '').strip()) else 'no')
except Exception:
    print('no')
")
    if [ "$ok" != "yes" ]; then
      log "STT_FAIL $base: $(head -c 200 "$resp" 2>/dev/null)"
      fail=1
      if [ "$(find "$f" -mmin +1440 | wc -l)" -gt 0 ]; then
        log "GIVE_UP $base — deleting after 24h of failures"
        rm -f "$f"
      fi
      continue
    fi

    python3 - "$speakers_json" "$resp" "$identity" "$start_ms" <<'PYEOF'
import json, sys
entries_path, resp_path, identity, start_ms = sys.argv[1:5]
entries = json.load(open(entries_path))
d = json.load(open(resp_path))
epoch = int(start_ms) / 1000.0

if "results" in d:
    # Deepgram: utterances carry real start times within the track.
    utts = (d.get("results") or {}).get("utterances") or []
    if utts:
        for u in utts:
            txt = (u.get("transcript") or "").strip()
            if txt:
                entries.append({"identity": identity, "t": epoch + float(u.get("start") or 0), "text": txt})
    else:
        alt = (((d.get("results") or {}).get("channels") or [{}])[0].get("alternatives") or [{}])[0]
        txt = (alt.get("transcript") or "").strip()
        if txt:
            entries.append({"identity": identity, "t": epoch, "text": txt})
    json.dump(entries, open(entries_path, "w"))
    sys.exit(0)

words = d.get("words") or []
if words:
    # Group words into utterances: same speaker file, gap < 2s between words.
    cur = None
    for w in words:
        t = epoch + float(w.get("start") or 0)
        token = (w.get("word") or "").strip()
        if not token:
            continue
        if cur and t - cur["end"] < 2.0:
            cur["text"] += " " + token
            cur["end"] = epoch + float(w.get("end") or w.get("start") or 0)
        else:
            if cur:
                entries.append({"identity": identity, "t": cur["t"], "text": cur["text"]})
            cur = {"t": t, "end": epoch + float(w.get("end") or w.get("start") or 0), "text": token}
    if cur:
        entries.append({"identity": identity, "t": cur["t"], "text": cur["text"]})
else:
    txt = (d.get("text") or "").strip()
    if txt:
        entries.append({"identity": identity, "t": epoch, "text": txt})
json.dump(entries, open(entries_path, "w"))
PYEOF
    rm -f "$resp"
  done <<< "$files"

  count=$(python3 -c "import json;print(len(json.load(open('$speakers_json'))))")
  if [ "$count" = "0" ]; then
    if [ "$fail" = "0" ]; then
      log "EMPTY $room — all files silent/tiny, cleaning group"
      echo "$files" | xargs -r rm -f
    fi
    rm -f "$speakers_json"
    continue
  fi

  payload="$WORK/${room}.payload.json"
  python3 -c "
import json
entries = json.load(open('$speakers_json'))
entries.sort(key=lambda e: e['t'])
json.dump({'room': '$room', 'entries': entries}, open('$payload', 'w'))
"
  code=$(curl -sS -o "$WORK/.resp" -w '%{http_code}' --max-time 120 \
    -X POST "https://photoportugal.com/api/video-call/transcript?secret=$TRANSCRIPT_ENDPOINT_SECRET" \
    -H "Content-Type: application/json" --data-binary "@$payload")
  if [ "$code" = "200" ]; then
    log "OK $room → transcript posted ($count utterances)"
    echo "$files" | xargs -r rm -f
    rm -f "$speakers_json" "$payload"
  else
    log "POST_FAIL $room code=$code $(head -c 200 "$WORK/.resp")"
    rm -f "$speakers_json" "$payload"
  fi
done
