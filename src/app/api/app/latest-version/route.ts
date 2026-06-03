import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tells the mobile app what the latest version is on the App Store /
// Play Store so it can prompt the user to update. Mobile reads this on
// every launch (cheap GET, no auth needed — it's already public
// information by the time the build hits the stores anyway).
//
// `latest`     = the newest version we've shipped. Anything below this
//                gets the soft "update available" prompt with a Later
//                button.
// `minimum`    = the OLDEST version still supported. Anything below this
//                gets a HARD prompt (no Later button). Use when there's
//                a breaking API change or critical bug fix.
//
// Both default to safe values; override via env so we don't need a
// redeploy every time the stores approve a new build.
export async function GET() {
  const ios = process.env.IOS_LATEST_VERSION || "1.2.0";
  const android = process.env.ANDROID_LATEST_VERSION || "1.2.0";
  const minimumIos = process.env.IOS_MIN_VERSION || "1.0.0";
  const minimumAndroid = process.env.ANDROID_MIN_VERSION || "1.0.0";
  return NextResponse.json({
    ios: { latest: ios, minimum: minimumIos },
    android: { latest: android, minimum: minimumAndroid },
    storeUrls: {
      ios: "https://apps.apple.com/app/id6761375811",
      android: "https://play.google.com/store/apps/details?id=com.photoportugal.app",
    },
  });
}
