const testimonials = [
  {
    name: "Sarah & James",
    location: "Lisbon",
    text: "Our photographer knew all the hidden gems in Alfama. The photos turned out absolutely stunning — our friends can't believe these are vacation photos!",
    rating: 5,
    type: "Couples Shoot",
    initials: "SJ",
    accent: "bg-primary-100 text-primary-600",
  },
  {
    name: "The Martinez Family",
    location: "Algarve",
    text: "We wanted natural, candid family photos at the beach. Our photographer made our kids feel so comfortable, and captured the most genuine moments. Worth every penny.",
    rating: 5,
    type: "Family Session",
    initials: "MF",
    accent: "bg-accent-100 text-accent-600",
  },
  {
    name: "Emily Chen",
    location: "Sintra",
    text: "I was traveling solo and wanted beautiful photos at Pena Palace. My photographer was like a friendly guide — she knew the best angles and times to avoid crowds.",
    rating: 5,
    type: "Solo Portrait",
    initials: "EC",
    accent: "bg-yellow-100 text-yellow-700",
  },
  {
    name: "David & Kate Williams",
    location: "Porto",
    text: "We booked a sunrise session at the Douro riverfront. The golden light, the reflections — absolutely magical. Our photographer captured our engagement perfectly.",
    rating: 5,
    type: "Engagement",
    initials: "DK",
    accent: "bg-blue-100 text-blue-600",
  },
  {
    name: "Anna Kowalski",
    location: "Lagos",
    text: "The whole experience was seamless — from booking to receiving photos. My photographer took me to secret viewpoints I never would have found on my own. 10/10!",
    rating: 5,
    type: "Solo Adventure",
    initials: "AK",
    accent: "bg-purple-100 text-purple-600",
  },
  {
    name: "The Tanaka Family",
    location: "Cascais",
    text: "First time using a service like this and we were blown away. Our photographer kept the kids laughing and captured such genuine expressions. Best investment of our trip.",
    rating: 5,
    type: "Family Session",
    initials: "TF",
    accent: "bg-rose-100 text-rose-600",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="h-4 w-4 text-yellow-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <span className="inline-block rounded-full bg-yellow-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow-800">
          Reviews
        </span>
        <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          Loved by Travelers Worldwide
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-gray-500">
          Real stories from real travelers who captured unforgettable memories in Portugal
        </p>
      </div>

      {/* Masonry-style grid */}
      <div className="mt-12 columns-1 gap-6 sm:columns-2 lg:columns-3">
        {testimonials.map((t, i) => (
          <div
            key={t.name}
            className={`mb-6 break-inside-avoid rounded-2xl border border-warm-200 bg-white p-6 shadow-sm transition hover:shadow-md ${
              i === 0 || i === 3 ? "sm:pt-8" : ""
            }`}
          >
            {/* Quote icon */}
            <svg className="h-8 w-8 text-warm-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
            </svg>

            <Stars count={t.rating} />

            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {t.text}
            </p>

            <div className="mt-5 flex items-center gap-3 border-t border-warm-100 pt-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.accent}`}>
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">
                  {t.type} &middot; {t.location}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust bar */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span><strong className="text-gray-900">5.0</strong> average rating</span>
        </div>
        <span className="hidden sm:inline text-warm-300">&bull;</span>
        <span>All reviews verified from real bookings</span>
        <span className="hidden sm:inline text-warm-300">&bull;</span>
        <span>No fake or incentivized reviews</span>
      </div>
    </section>
  );
}
