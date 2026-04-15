"use client";

const FLAG_MAP: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", NL: "🇳🇱", CA: "🇨🇦", DE: "🇩🇪", BE: "🇧🇪",
  NO: "🇳🇴", AU: "🇦🇺", FR: "🇫🇷", IT: "🇮🇹", BR: "🇧🇷", SE: "🇸🇪",
  ES: "🇪🇸", CH: "🇨🇭", FI: "🇫🇮", IE: "🇮🇪", IN: "🇮🇳", SG: "🇸🇬",
  AE: "🇦🇪", MX: "🇲🇽", PL: "🇵🇱", DK: "🇩🇰", AT: "🇦🇹", CZ: "🇨🇿",
  RO: "🇷🇴", BG: "🇧🇬", TH: "🇹🇭", VN: "🇻🇳", CN: "🇨🇳",
};

const FALLBACK_COUNTRIES = ["US", "GB", "NL", "CA", "DE", "BE", "NO", "AU", "FR", "IT", "BR", "SE", "ES", "CH", "FI", "IE", "IN", "SG", "AE", "MX"];

function FlagRow({ flags }: { flags: string[] }) {
  return (
    <>
      {flags.map((flag, i) => (
        <span key={i} className="mx-2 sm:mx-3 text-3xl sm:text-4xl shrink-0">{flag}</span>
      ))}
    </>
  );
}

export function SocialProofStrip({
  countryCodes,
  photographerCount,
  locationCount,
  texts,
}: {
  countryCodes: string[];
  photographerCount: number;
  locationCount: number;
  texts: {
    trustedBy: string;
    photographers: string;
    locations: string;
    securePayment: string;
  };
}) {
  const codes = countryCodes.length > 0 ? countryCodes : FALLBACK_COUNTRIES;
  const flags = codes.filter((c) => FLAG_MAP[c]).map((c) => FLAG_MAP[c]);

  return (
    <section className="border-y border-warm-200 bg-warm-50/50 py-10 sm:py-12 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Stats — big bold numbers */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
          <div>
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
              {photographerCount}
            </p>
            <p className="mt-1 text-sm sm:text-base text-gray-500 font-medium">{texts.photographers}</p>
          </div>
          <div>
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-600">
              {codes.length}+
            </p>
            <p className="mt-1 text-sm sm:text-base text-gray-500 font-medium">{texts.trustedBy}</p>
          </div>
          <div>
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
              {locationCount}
            </p>
            <p className="mt-1 text-sm sm:text-base text-gray-500 font-medium">{texts.locations}</p>
          </div>
        </div>

        {/* Flag marquee — two identical sets for seamless loop */}
        <div className="relative mt-8 mx-auto max-w-2xl overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-warm-50 to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-warm-50 to-transparent z-10" />
          <div className="flex animate-marquee w-max">
            <FlagRow flags={flags} />
            <FlagRow flags={flags} />
          </div>
        </div>

      </div>
    </section>
  );
}
