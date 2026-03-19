import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Photo Portugal privacy policy — how we collect, use, and protect your personal data.",
  alternates: { canonical: "https://photoportugal.com/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-4 text-sm text-gray-400">Last updated: March 19, 2026</p>

      <div className="mt-8 space-y-8 text-gray-600 leading-relaxed">
        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
          <p className="mt-3">When you use Photo Portugal, we may collect the following information:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> name, email address, profile photo (from Google OAuth or uploaded), phone number (if provided)</li>
            <li><strong>Photographer profiles:</strong> bio, languages, locations, portfolio photos, pricing, availability</li>
            <li><strong>Booking data:</strong> dates, times, locations, session type, number of participants, and any special requests</li>
            <li><strong>Messages:</strong> communications between clients and photographers through our platform</li>
            <li><strong>Payment information:</strong> billing details processed securely by Stripe (we do not store your full card number)</li>
            <li><strong>Usage data:</strong> pages visited, device type, browser, IP address, referring URL, and interaction patterns</li>
            <li><strong>Cookies and similar technologies:</strong> session tokens, authentication state, and analytics identifiers (see Section 8)</li>
          </ul>
        </section>

        {/* 2. Legal Basis for Processing */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">2. Legal Basis for Processing</h2>
          <p className="mt-3">
            Under the General Data Protection Regulation (GDPR), we process your personal data based on the following legal grounds:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              <strong>Contract performance (Article 6(1)(b)):</strong> processing necessary to fulfil bookings between clients and photographers,
              manage your account, facilitate payments, and deliver the services you request through our platform.
            </li>
            <li>
              <strong>Consent (Article 6(1)(a)):</strong> for non-essential cookies, marketing emails, and promotional communications.
              You may withdraw consent at any time without affecting the lawfulness of processing carried out before withdrawal.
            </li>
            <li>
              <strong>Legitimate interest (Article 6(1)(f)):</strong> for platform security and fraud prevention, anonymous analytics
              to improve our service, enforcing our Terms of Service, and communicating essential service updates.
            </li>
            <li>
              <strong>Legal obligation (Article 6(1)(c)):</strong> to comply with tax, accounting, and other legal requirements
              applicable under Portuguese and EU law.
            </li>
          </ul>
        </section>

        {/* 3. How We Use Your Information */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">3. How We Use Your Information</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>To provide, operate, and improve our photography marketplace services</li>
            <li>To facilitate bookings and communication between clients and photographers</li>
            <li>To display photographer profiles and portfolios publicly on the platform</li>
            <li>To process payments and issue invoices</li>
            <li>To send booking confirmations, reminders, and service-related notifications</li>
            <li>To send marketing communications (only with your consent, and you can opt out at any time)</li>
            <li>To prevent fraud, detect abuse, and ensure platform security</li>
            <li>To analyse usage patterns and improve user experience</li>
            <li>To comply with legal obligations, including tax and accounting requirements</li>
          </ul>
        </section>

        {/* 4. Information Sharing & Third-Party Services */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">4. Information Sharing &amp; Third-Party Services</h2>
          <p className="mt-3">We do not sell your personal information. We share data only in these cases:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Between booking parties:</strong> clients see photographer profiles and public portfolios; photographers see client name, contact details, and booking information necessary to deliver the service.</li>
            <li><strong>Service providers (data processors):</strong> we use the following third-party services to operate our platform:</li>
          </ul>
          <ul className="mt-2 list-disc pl-10 space-y-1">
            <li><strong>Stripe</strong> — payment processing. Stripe receives your billing details to process transactions securely. <a href="https://stripe.com/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
            <li><strong>Google</strong> — OAuth authentication and sign-in. Google receives your authentication token when you sign in with Google. <a href="https://policies.google.com/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
            <li><strong>DigitalOcean</strong> — cloud hosting and infrastructure. Your data is stored on DigitalOcean servers. <a href="https://www.digitalocean.com/legal/privacy-policy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">DigitalOcean Privacy Policy</a></li>
            <li><strong>Twilio</strong> — SMS notifications for booking updates and verification. Your phone number is shared with Twilio when SMS notifications are enabled. <a href="https://www.twilio.com/legal/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a></li>
          </ul>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Legal requirements:</strong> if required by law, regulation, legal process, or enforceable governmental request, or to protect the rights, property, or safety of Photo Portugal, our users, or the public.</li>
          </ul>
        </section>

        {/* 5. Data Processing Agreements */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">5. Data Processing Agreements</h2>
          <p className="mt-3">
            We have entered into Data Processing Agreements (DPAs) with all third-party processors listed above,
            as required by Article 28 of the GDPR. These agreements ensure that our processors handle your personal
            data in compliance with European data protection law, implement appropriate technical and organisational
            security measures, and only process data on our documented instructions.
          </p>
        </section>

        {/* 6. International Data Transfers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">6. International Data Transfers</h2>
          <p className="mt-3">
            Photo Portugal is based in Portugal and primarily stores data within the European Union. However,
            some of our third-party processors may process personal data outside the EU/EEA:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Stripe</strong> processes payment data in the United States and other jurisdictions where Stripe operates.</li>
            <li><strong>Google</strong> may process authentication data in the United States and other global data centres.</li>
          </ul>
          <p className="mt-2">
            Where data is transferred outside the EU/EEA, we ensure adequate safeguards are in place, including
            Standard Contractual Clauses (SCCs) approved by the European Commission, supplementary measures where
            necessary, and adequacy decisions where applicable. You may request a copy of the relevant safeguards
            by contacting us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.
          </p>
        </section>

        {/* 7. Data Retention */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">7. Data Retention</h2>
          <p className="mt-3">We retain your personal data only for as long as necessary for the purposes described in this policy:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> retained while your account is active, plus 2 years after account deletion to handle any post-deletion enquiries, disputes, or legal claims.</li>
            <li><strong>Booking and transaction data:</strong> retained for 7 years after the booking date to comply with Portuguese tax and accounting obligations.</li>
            <li><strong>Messages:</strong> retained for 1 year after the associated booking is completed, then permanently deleted.</li>
            <li><strong>Analytics data:</strong> retained for 26 months, then automatically aggregated or deleted.</li>
            <li><strong>Marketing consent records:</strong> retained for as long as we send marketing communications, plus 3 years after consent withdrawal for accountability purposes.</li>
          </ul>
          <p className="mt-2">
            When data is no longer needed, it is securely deleted or irreversibly anonymised.
          </p>
        </section>

        {/* 8. Cookies */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">8. Cookies</h2>
          <p className="mt-3">We use the following types of cookies:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Essential cookies:</strong> required for authentication, session management, and core platform functionality. These cannot be disabled.</li>
            <li><strong>Analytics cookies:</strong> used to understand how visitors interact with our site and to improve our service. These are only set with your consent.</li>
          </ul>
          <p className="mt-2">
            We do not use third-party advertising or tracking cookies. You can manage your cookie
            preferences at any time through your browser settings or our cookie consent banner.
          </p>
        </section>

        {/* 9. Data Security */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">9. Data Security</h2>
          <p className="mt-3">
            We implement appropriate technical and organisational measures to protect your personal data, including:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>HTTPS/TLS encryption for all data in transit</li>
            <li>Secure password hashing (bcrypt) for locally-created accounts</li>
            <li>Role-based access controls on our database and admin systems</li>
            <li>Regular security reviews and dependency updates</li>
            <li>Encrypted backups with restricted access</li>
          </ul>
          <p className="mt-2">
            However, no method of transmission over the Internet or method of electronic storage is 100% secure.
            While we strive to protect your personal data, we cannot guarantee its absolute security.
          </p>
        </section>

        {/* 10. Your Rights Under the GDPR */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">10. Your Rights Under the GDPR</h2>
          <p className="mt-3">As a data subject, you have the following rights under the GDPR:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Right of access (Article 15):</strong> request a copy of all personal data we hold about you.</li>
            <li><strong>Right to rectification (Article 16):</strong> request correction of inaccurate or incomplete personal data.</li>
            <li><strong>Right to erasure (Article 17):</strong> request deletion of your personal data, subject to legal retention obligations.</li>
            <li><strong>Right to restriction of processing (Article 18):</strong> request that we limit how we use your data in certain circumstances.</li>
            <li><strong>Right to data portability (Article 20):</strong> receive your personal data in a structured, commonly used, and machine-readable format (such as JSON or CSV), and transmit that data to another controller without hindrance.</li>
            <li><strong>Right to object (Article 21):</strong> object to processing based on legitimate interest, including profiling.</li>
            <li><strong>Right to withdraw consent:</strong> where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of prior processing.</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.
            We will respond to your request within 30 days. If we need more time (up to an additional 60 days for complex requests),
            we will notify you of the extension and the reasons for the delay.
          </p>
        </section>

        {/* 11. Right to Lodge a Complaint */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">11. Right to Lodge a Complaint</h2>
          <p className="mt-3">
            If you believe that our processing of your personal data infringes the GDPR, you have the right to lodge a
            complaint with a supervisory authority. In Portugal, the competent authority is:
          </p>
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm">
            <p className="font-semibold text-gray-900">Comiss&atilde;o Nacional de Prote&ccedil;&atilde;o de Dados (CNPD)</p>
            <p className="mt-1">Av. D. Carlos I, 134 &mdash; 1.&ordm;</p>
            <p>1200-651 Lisboa, Portugal</p>
            <p className="mt-1">
              Website:{" "}
              <a href="https://www.cnpd.pt" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>
            </p>
          </div>
          <p className="mt-3">
            You may also lodge a complaint with the supervisory authority in your EU/EEA member state of
            residence, place of work, or the place of the alleged infringement.
          </p>
        </section>

        {/* 12. Children's Privacy */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">12. Children&apos;s Privacy</h2>
          <p className="mt-3">
            Photo Portugal is not intended for use by children under the age of 18. We do not knowingly collect
            personal data from children under 18. If you are a parent or guardian and believe your child has
            provided us with personal data, please contact us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>,
            and we will take steps to delete that information promptly.
          </p>
        </section>

        {/* 13. Business Transfers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">13. Business Transfers</h2>
          <p className="mt-3">
            If Photo Portugal is involved in a merger, acquisition, asset sale, or bankruptcy, your personal data
            may be transferred as part of that transaction. In such an event, we will notify all affected users at
            least 30 days before the transfer of personal data and before any new privacy policy takes effect.
            You will have the option to delete your account and data before the transfer is completed.
          </p>
        </section>

        {/* 14. Changes to This Policy */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">14. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
            legal requirements, or other factors. If we make material changes, we will notify you by email or by
            posting a prominent notice on our platform at least 14 days before the changes take effect.
            Your continued use of Photo Portugal after the effective date constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* 15. Contact */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">15. Contact</h2>
          <p className="mt-3">
            For any privacy-related questions, data subject requests, or concerns about this policy, contact us at:
          </p>
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm">
            <p className="font-semibold text-gray-900">Photo Portugal</p>
            <p className="mt-1">
              Email:{" "}
              <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>
            </p>
            <p>Website: <a href="https://photoportugal.com" className="text-primary-600 hover:underline">photoportugal.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
