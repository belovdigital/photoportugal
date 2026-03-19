import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Browse & Choose",
    description: "Explore photographer profiles, view stunning portfolios, and read verified reviews from real travelers.",
    detail: "Filter by location, style, and budget",
    iconBg: "bg-primary-500",
    numberBg: "bg-primary-100 text-primary-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    number: "2",
    title: "Book Instantly",
    description: "Pick your date, choose a package, and book your session in minutes. Chat with your photographer to plan the details.",
    detail: "Secure payment with Apple Pay & Google Pay",
    iconBg: "bg-accent-500",
    numberBg: "bg-accent-50 text-accent-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: "3",
    title: "Enjoy Your Shoot",
    description: "Meet your photographer at the perfect location. Relax, be yourself, and let them capture your best moments.",
    detail: "Average session: 1-2 hours",
    iconBg: "bg-yellow-500",
    numberBg: "bg-yellow-50 text-yellow-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: "4",
    title: "Get Your Photos",
    description: "Receive professionally edited photos in a private, password-protected gallery. View online, download individually, or grab the full ZIP.",
    detail: "Secure gallery with password protection",
    iconBg: "bg-blue-500",
    numberBg: "bg-blue-50 text-blue-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden bg-warm-50">
      <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-primary-100/30 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-accent-100/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-primary-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-700">
            Simple Process
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Four Steps to Stunning Photos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            From booking to delivery — we make professional photography effortless
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex flex-col items-center text-center lg:px-6">
              {/* Connector line between steps (desktop only) */}
              {i < steps.length - 1 && (
                <div className="absolute left-[calc(50%+32px)] right-[calc(-50%+32px)] top-6 hidden border-t-2 border-dashed border-warm-300 lg:block" />
              )}

              {/* Icon */}
              <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl ${step.iconBg} shadow-lg`}>
                {step.icon}
              </div>

              {/* Number badge */}
              <span className={`mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step.numberBg}`}>
                {step.number}
              </span>

              <h3 className="mt-2 text-lg font-bold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.description}</p>

              {/* Detail */}
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <svg className="h-3.5 w-3.5 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {step.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/photographers"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
          >
            Find Your Photographer
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
