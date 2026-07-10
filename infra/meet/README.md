# meet.photoportugal.com — LiveKit video-call stack

Lives on the SHARED n4um-ws box (178.105.1.98, Alex's son's game server —
do not touch /opt/games). Deployed copy: /opt/photoportugal-meet.
TLS terminates in the son's Caddy (`/opt/games/Caddyfile`, appended block).
Secrets in /opt/photoportugal-meet/.env (LIVEKIT_API_KEY/SECRET,
OPENAI_API_KEY, TRANSCRIPT_ENDPOINT_SECRET) — not in git.

- compose.yml — livekit v1.9 + egress v1.9 + redis, host networking.
  KEEP livekit-server in step with the app's livekit-client (a v1.8 server
  against client 2.20 caused a silent 15s full-reconnect loop).
- generate-config.sh — renders *-with-keys.yaml from templates + .env.
- transcribe.sh — cron (every minute, flock): whisper word-timestamps per
  speaker track, utterances anchored to egress start epoch, POSTs to
  /api/video-call/transcript, deletes audio.
