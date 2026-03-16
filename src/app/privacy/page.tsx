import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Photo Portugal privacy policy — how we collect, use, and protect your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-4 text-sm text-gray-400">Last updated: March 16, 2026</p>

      <div className="mt-8 space-y-8 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
          <p className="mt-3">When you use Photo Portugal, we may collect the following information:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> name, email address, profile photo (from Google OAuth or uploaded)</li>
            <li><strong>Photographer profiles:</strong> bio, languages, locations, portfolio photos, pricing</li>
            <li><strong>Booking data:</strong> dates, times, locations, messages between clients and photographers</li>
            <li><strong>Usage data:</strong> pages visited, device type, browser, IP address (for analytics and security)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">2. How We Use Your Information</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>To provide and improve our marketplace services</li>
            <li>To facilitate bookings and communication between clients and photographers</li>
            <li>To display photographer profiles and portfolios publicly</li>
            <li>To send booking confirmations and service-related notifications</li>
            <li>To prevent fraud and ensure platform security</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">3. Information Sharing</h2>
          <p className="mt-3">We do not sell your personal information. We share data only in these cases:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Between booking parties:</strong> clients see photographer profiles; photographers see client name and booking details</li>
            <li><strong>Service providers:</strong> hosting (DigitalOcean), authentication (Google), and analytics tools</li>
            <li><strong>Legal requirements:</strong> if required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">4. Data Security</h2>
          <p className="mt-3">
            We use industry-standard security measures including HTTPS encryption, secure password hashing (bcrypt),
            and access controls on our database. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">5. Your Rights</h2>
          <p className="mt-3">You have the right to:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and associated data</li>
            <li>Export your data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact us at <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">6. Cookies</h2>
          <p className="mt-3">
            We use essential cookies for authentication and session management. We do not use
            third-party advertising cookies. Analytics cookies are used anonymously to improve our service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">7. Contact</h2>
          <p className="mt-3">
            For privacy-related questions, contact us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
