import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Photo Portugal terms of service — rules and guidelines for using our photographer marketplace.",
  alternates: { canonical: "https://photoportugal.com/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-4 text-sm text-gray-400">Last updated: March 16, 2026</p>

      <div className="mt-8 space-y-8 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Overview</h2>
          <p className="mt-3">
            Photo Portugal (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates a marketplace platform at photoportugal.com
            that connects tourists (&quot;clients&quot;) with professional photographers (&quot;photographers&quot;) in Portugal.
            By using our platform, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">2. Accounts</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>One person may not maintain more than one account</li>
            <li>You must be at least 18 years old to create an account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">3. For Clients</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Booking requests are not confirmed until the photographer accepts</li>
            <li>You agree to show up at the agreed time and location</li>
            <li>Payment terms are agreed between you and the photographer</li>
            <li>Reviews must be honest and based on your actual experience</li>
            <li>You may not use photographer&apos;s images for commercial purposes without their written consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">4. For Photographers</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>You represent that you have the skills and equipment to provide professional photography services</li>
            <li>Portfolio photos must be your own original work</li>
            <li>You must respond to booking requests within 24 hours</li>
            <li>You agree to deliver photos within the timeframe stated on your profile</li>
            <li>You are responsible for your own taxes, insurance, and legal compliance</li>
            <li>Subscription fees (Pro, Premium plans) are billed monthly and non-refundable</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">5. Cancellations</h2>
          <p className="mt-3">
            Either party may cancel a booking. We recommend cancelling at least 48 hours before
            the scheduled shoot. Photographers set their own cancellation policies, which should
            be discussed before confirming a booking.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">6. Intellectual Property</h2>
          <p className="mt-3">
            Photographers retain copyright of all images they create. Clients receive a personal-use
            license for the photos from their session. The specific license terms should be discussed
            between the client and photographer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">7. Platform Role</h2>
          <p className="mt-3">
            Photo Portugal is a marketplace that facilitates connections between clients and photographers.
            We are not a party to the agreement between clients and photographers. We do not guarantee
            the quality of services provided by photographers, though we do verify photographer profiles
            and monitor reviews for quality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">8. Prohibited Content</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Fake reviews or manipulated ratings</li>
            <li>Portfolio photos that are not your own work</li>
            <li>Offensive, discriminatory, or illegal content</li>
            <li>Spam or unsolicited promotional messages</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">9. Limitation of Liability</h2>
          <p className="mt-3">
            Photo Portugal is provided &quot;as is&quot; without warranties of any kind. We are not liable
            for any damages arising from the use of our platform, interactions between users,
            or the quality of photography services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">10. Contact</h2>
          <p className="mt-3">
            Questions about these terms? Contact us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
