// Trust badge linking to our Google Business Profile reviews.
// Two sizes: "full" for hero/checkout sections, "compact" for footer.
// Number of reviews intentionally not shown until we cross a meaningful
// threshold (currently 3) — rating + verifiability is the signal.

const GOOGLE_PROFILE_URL = "https://g.page/r/CbWG7PogT_K2EBM";

function GoogleG({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.39 6.65v5.52h7.1c4.16-3.83 6.57-9.47 6.57-16.18z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.32l-7.1-5.52a13.18 13.18 0 0 1-19.66-6.91H4.5v5.7A21.99 21.99 0 0 0 24 46z"/>
      <path fill="#FBBC05" d="M11.8 28.25a13.13 13.13 0 0 1 0-8.5v-5.7H4.5a21.99 21.99 0 0 0 0 19.9l7.3-5.7z"/>
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.99 6.94 4.5 14.05l7.3 5.7A13.18 13.18 0 0 1 24 10.75z"/>
    </svg>
  );
}

function Stars({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className="inline-flex gap-0.5" aria-label="5 out of 5 stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={cls} viewBox="0 0 20 20" fill="#fbbc04" aria-hidden="true">
          <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78L1.58 7.62l5.82-.85L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

export function GoogleReviewsBadge({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <a
        href={GOOGLE_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white/95 px-2.5 py-1 text-xs text-gray-600 shadow-sm transition hover:border-primary-200 hover:text-primary-700 ${className}`}
      >
        <GoogleG className="h-3.5 w-3.5" />
        <Stars size="sm" />
        <span className="font-medium">5.0 on Google</span>
      </a>
    );
  }
  return (
    <a
      href={GOOGLE_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-3 rounded-2xl border border-warm-200 bg-white px-4 py-3 shadow-sm transition hover:border-primary-200 hover:shadow-md ${className}`}
    >
      <GoogleG className="h-7 w-7 shrink-0" />
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <Stars />
          <span className="text-sm font-bold text-gray-900">5.0</span>
        </div>
        <span className="mt-0.5 text-xs font-medium text-gray-500 group-hover:text-primary-600">
          Reviewed on Google
          <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </a>
  );
}
