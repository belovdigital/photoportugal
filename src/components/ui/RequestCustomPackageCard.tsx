import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Pseudo-package card that lives at the end of the package list on
 * the photographer profile. Doesn't represent any real DB row — three
 * destinations depending on viewer state:
 *   - signed-out → straight to /auth/signup with callbackUrl back to
 *     this profile + #message hash so the dialog opens after auth.
 *   - signed-in WITH existing thread → /dashboard/messages/<bookingId>
 *   - signed-in WITHOUT existing thread → `#message` hash; the in-page
 *     `AskQuestionButton` listens via hashchange and opens the dialog.
 *
 * Signed-out case must be a direct link (not routed through the hash
 * flow) because there's a brief loading window after hydration where
 * `useSession()` returns undefined — clicking the hash anchor in that
 * window does nothing (the syncHash handler can't tell yet whether to
 * open the modal or redirect to signup).
 */
export async function RequestCustomPackageCard({
  existingBookingId,
  viewerSignedIn,
  profilePath,
}: {
  existingBookingId?: string | null;
  viewerSignedIn?: boolean;
  /** Current photographer-profile pathname (incl. locale prefix) used
   *  to build the signup callbackUrl for signed-out viewers. */
  profilePath?: string;
}) {
  const t = await getTranslations("photographers.profile");

  const cardClasses = "flex flex-col h-full rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/40 p-5 transition hover:border-primary-500 hover:bg-primary-50 hover:shadow-md group";
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xl">✨</span>
        <h3 className="font-bold text-gray-900 group-hover:text-primary-700">
          {t("requestCustomPackage")}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {t("requestCustomPackageBlurb")}
      </p>
      <div className="mt-auto pt-4">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
          {existingBookingId ? t("requestCustomPackageOpenChat") : t("requestCustomPackageCta")}
          <span aria-hidden>→</span>
        </span>
      </div>
    </>
  );

  if (!viewerSignedIn) {
    // Signed-out: plain anchor so the browser does the normal navigation
    // to /auth/signup. Don't route through the in-page `#message` hash
    // because that depends on `useSession()` having resolved, and the
    // brief loading window between hydration and session-fetch silently
    // dropped the click before this branch existed.
    const returnUrl = `${profilePath || ""}#message`;
    return (
      <a href={`/auth/signup?callbackUrl=${encodeURIComponent(returnUrl)}`} className={cardClasses}>
        {body}
      </a>
    );
  }

  if (existingBookingId) {
    // Signed-in with an existing thread: SPA navigation via next-intl
    // Link keeps the dashboard transition snappy.
    return (
      <Link href={`/dashboard/messages/${existingBookingId}` as never} className={cardClasses}>
        {body}
      </Link>
    );
  }

  // Signed-in, no thread yet — open the in-hero message dialog. MUST be
  // a plain `<a>` (not next-intl `Link`): Next.js Link with a hash-only
  // href routes via history.pushState, which DOES NOT fire the
  // `hashchange` event the `AskQuestionButton` listens for, so the
  // modal silently never opens. A native anchor click changes the
  // hash through the browser, which DOES fire `hashchange`.
  return (
    <a href="#message" className={cardClasses}>
      {body}
    </a>
  );
}
