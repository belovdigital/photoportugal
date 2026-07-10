import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver, EgressClient, DirectFileOutput } from "livekit-server-sdk";

export const dynamic = "force-dynamic";

const MEET_URL = "https://meet.photoportugal.com";

// LiveKit webhook (configured in /opt/photoportugal-meet livekit.yaml on the
// meet server). Each published MICROPHONE track in a pp-* call room gets its
// own track egress to the meet server's local disk — one audio file PER
// SPEAKER, so the transcript can attribute lines to people. transcribe.sh on
// the meet server whispers the files, merges speakers by timestamp, posts the
// transcript to /api/video-call/transcript and deletes the audio.
//
// Per-track (not room-composite) also fixes the "records only the first
// call" bug: track_published fires on every (re)join, while room_started
// fired once per room instance and a lingering finalizing egress blocked
// re-recording.
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

  if (
    event.event === "track_published" &&
    event.room?.name?.startsWith("pp-") &&
    event.track?.type === 0 && // TrackType.AUDIO = 0 (VIDEO = 1)
    event.participant?.identity &&
    !event.participant.identity.startsWith("EG_") // never record the recorder
  ) {
    const room = event.room.name;
    const identity = event.participant.identity;
    const trackSid = event.track.sid;
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

  return NextResponse.json({ ok: true });
}
