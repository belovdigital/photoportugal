import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver, EgressClient, DirectFileOutput, RoomServiceClient } from "livekit-server-sdk";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const MEET_URL = "https://meet.photoportugal.com";

// LiveKit webhook (configured in /opt/photoportugal-meet livekit.yaml on the
// meet server). Recording model:
//
// - Rooms are named pp-<client8>-<photog8> (stable per pair); each call is a
//   distinct room INSTANCE keyed by room_sid. State per instance lives in
//   video_call_rooms.
// - Recording (per-track egress → one audio file PER SPEAKER) starts ONLY
//   once the room has 2+ human participants. Solo calls — someone waiting
//   alone, testing their camera — produce no files, no Deepgram spend, no
//   transcript, no notification (Alex, 2026-07-15).
//   * participant_joined: register identity; when the 2nd human arrives,
//     atomically claim egress_started and sweep all already-published
//     audio tracks via listParticipants.
//   * track_published: if egress already claimed for this instance, record
//     the new track immediately; otherwise it'll be swept when #2 joins.
//   * Per-track dedup via egressed_tracks (sweep and track_published race).
// - room_finished with 2+ identities → admin Telegram "call happened".
//
// Per-track (not room-composite) also fixes the "records only the first
// call" bug: track_published fires on every (re)join, while room_started
// fired once per room instance and a lingering finalizing egress blocked
// re-recording.

async function registerIdentity(roomSid: string, room: string, identity: string) {
  await queryOne(
    `INSERT INTO video_call_rooms (room_sid, room, identities)
     VALUES ($1, $2, ARRAY[$3])
     ON CONFLICT (room_sid) DO UPDATE
       SET identities = CASE WHEN video_call_rooms.identities @> ARRAY[$3]
                             THEN video_call_rooms.identities
                             ELSE array_append(video_call_rooms.identities, $3) END
     RETURNING room_sid`,
    [roomSid, room, identity]
  );
}

async function startEgressForTrack(
  key: string, secret: string,
  roomSid: string, room: string, identity: string, trackSid: string
) {
  // Atomic per-track claim — the join-sweep and a concurrent
  // track_published event may both try to record the same track.
  const claim = await queryOne<{ room_sid: string }>(
    `UPDATE video_call_rooms SET egressed_tracks = array_append(egressed_tracks, $2)
     WHERE room_sid = $1 AND NOT (egressed_tracks @> ARRAY[$2])
     RETURNING room_sid`,
    [roomSid, trackSid]
  );
  if (!claim) return;

  try {
    const egress = new EgressClient(MEET_URL, key, secret);
    await egress.startTrackEgress(
      room,
      new DirectFileOutput({
        // room __ identity __ startEpochMs — transcribe.sh parses this to
        // align both speakers on one absolute timeline.
        filepath: `/out/${room}__${identity}__${Date.now()}.ogg`,
        disableManifest: true,
      }),
      trackSid
    );
    console.log(`[video-call] track egress started for ${identity} in ${room}`);
  } catch (e) {
    // Never fail the webhook — the call itself must not depend on
    // recording. But this must be visible: alert admins.
    console.error(`[video-call] track egress FAILED for ${room}/${identity}:`, e);
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      await sendTelegram(
        `⚠️ Video call in ${room}: speaker ${identity} is NOT being recorded (egress failed). Transcript will be incomplete.`,
        "alerts"
      );
    } catch { /* telegram down — nothing else to do */ }
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const body = await req.text();
  const auth = req.headers.get("authorization") || "";

  let event;
  try {
    const receiver = new WebhookReceiver(key, secret);
    event = await receiver.receive(body, auth);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const room = event.room?.name;
  const roomSid = event.room?.sid;
  const identity = event.participant?.identity;
  const isPPRoom = !!room && room.startsWith("pp-") && !!roomSid;
  const isHuman = !!identity && !identity.startsWith("EG_"); // never count/record the recorder

  try {
    if (isPPRoom && event.event === "participant_joined" && isHuman) {
      await registerIdentity(roomSid!, room!, identity!);

      // 2nd human just arrived? Claim recording atomically (single winner)
      // and sweep every audio track that's already published.
      const claimed = await queryOne<{ room_sid: string }>(
        `UPDATE video_call_rooms SET egress_started = TRUE
         WHERE room_sid = $1 AND egress_started = FALSE AND cardinality(identities) >= 2
         RETURNING room_sid`,
        [roomSid]
      );
      if (claimed) {
        const svc = new RoomServiceClient(MEET_URL, key, secret);
        const participants = await svc.listParticipants(room!).catch(() => []);
        for (const p of participants) {
          if (!p.identity || p.identity.startsWith("EG_")) continue;
          for (const t of p.tracks || []) {
            if (Number(t.type) === 0 && t.sid) { // TrackType.AUDIO = 0
              await startEgressForTrack(key, secret, roomSid!, room!, p.identity, t.sid);
            }
          }
        }
      }
    }

    if (
      isPPRoom &&
      event.event === "track_published" &&
      isHuman &&
      event.track?.type === 0 && // TrackType.AUDIO = 0 (VIDEO = 1)
      event.track?.sid
    ) {
      // Belt-and-braces: make sure the identity is registered even if the
      // participant_joined event was dropped.
      await registerIdentity(roomSid!, room!, identity!);
      const row = await queryOne<{ egress_started: boolean }>(
        "SELECT egress_started FROM video_call_rooms WHERE room_sid = $1",
        [roomSid]
      );
      if (row?.egress_started) {
        await startEgressForTrack(key, secret, roomSid!, room!, identity!, event.track.sid);
      }
      // else: solo so far — this track gets swept when the 2nd human joins.
    }

    if (isPPRoom && event.event === "room_finished") {
      // Notify admins only for calls that actually happened (2+ humans).
      // `notified` guard keeps this idempotent across webhook retries.
      const row = await queryOne<{ identities: string[]; started_at: string }>(
        `UPDATE video_call_rooms SET finished_at = NOW(), notified = TRUE
         WHERE room_sid = $1 AND notified = FALSE AND cardinality(identities) >= 2
         RETURNING identities, started_at`,
        [roomSid]
      );
      if (row) {
        const m = room!.match(/^pp-([0-9a-f]{8})-([0-9a-f]{8})$/);
        if (m) {
          const pair = await queryOne<{ client_name: string; photographer_name: string }>(
            `SELECT cu.name as client_name, u.name as photographer_name
             FROM bookings b
             JOIN photographer_profiles pp ON pp.id = b.photographer_id
             JOIN users u ON u.id = pp.user_id
             JOIN users cu ON cu.id = b.client_id
             WHERE b.client_id::text LIKE $1 || '%' AND b.photographer_id::text LIKE $2 || '%'
             ORDER BY b.created_at DESC LIMIT 1`,
            [m[1], m[2]]
          );
          const mins = Math.max(1, Math.round((Date.now() - new Date(row.started_at).getTime()) / 60000));
          const who = pair ? `${pair.photographer_name} · ${pair.client_name}` : room;
          try {
            const { sendTelegram } = await import("@/lib/telegram");
            await sendTelegram(
              `📹 <b>Видеозвонок состоялся</b>\n${who}\n~${mins} мин · участников: ${row.identities.length}\nТранскрипт будет в чате через пару минут.`,
              "bookings"
            );
          } catch { /* telegram down */ }
        }
      } else {
        // Solo / no-show — close the row quietly (nothing was recorded).
        await queryOne(
          "UPDATE video_call_rooms SET finished_at = NOW() WHERE room_sid = $1 AND finished_at IS NULL RETURNING room_sid",
          [roomSid]
        ).catch(() => null);
      }
    }
  } catch (e) {
    // State tracking must never break call flow — log and ack.
    console.error(`[video-call] webhook state error (${event.event} ${room}):`, e);
  }

  return NextResponse.json({ ok: true });
}
