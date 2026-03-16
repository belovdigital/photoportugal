const testimonials = [
  {
    name: "Sarah & James",
    location: "Lisbon",
    text: "Our photographer knew all the hidden gems in Alfama. The photos turned out absolutely stunning — our friends can't believe these are vacation photos!",
    rating: 5,
    type: "Couples Shoot",
  },
  {
    name: "The Martinez Family",
    location: "Algarve",
    text: "We wanted natural, candid family photos at the beach. Our photographer made our kids feel so comfortable, and captured the most genuine moments. Worth every penny.",
    rating: 5,
    type: "Family Session",
  },
  {
    name: "Emily Chen",
    location: "Sintra",
    text: "I was traveling solo and wanted beautiful photos at Pena Palace. My photographer was like a friendly guide — she knew the best angles and times to avoid crowds.",
    rating: 5,
    type: "Solo Portrait",
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
        <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          Loved by Travelers
        </h2>
        <p className="mt-4 text-lg text-gray-500">
          Real stories from real travelers who found their perfect photographer
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm"
          >
            <Stars count={t.rating} />
            <p className="mt-4 text-gray-600 leading-relaxed">
              &ldquo;{t.text}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                {t.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {t.type} in {t.location}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
