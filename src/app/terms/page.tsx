import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Photo Portugal terms of service — booking, payments, cancellations, refunds, and platform rules.",
  alternates: { canonical: "https://photoportugal.com/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-4 text-sm text-gray-400">Last updated: March 19, 2026</p>

      <div className="mt-8 space-y-10 text-gray-600 leading-relaxed">

        {/* 1. Overview */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Overview</h2>
          <p className="mt-3">
            Photo Portugal (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates a marketplace platform at photoportugal.com
            that connects tourists (&quot;clients&quot;) with professional photographers (&quot;photographers&quot;) in Portugal.
            By using our platform, you agree to these terms.
          </p>
        </section>

        {/* 2. Accounts */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">2. Accounts</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>One person may not maintain more than one account</li>
            <li>You must be at least 18 years old to create an account</li>
          </ul>
        </section>

        {/* 3. For Clients */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">3. For Clients</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Booking requests are not confirmed until the photographer accepts</li>
            <li>Full payment is collected at the time of booking and held securely until photo delivery</li>
            <li>You agree to show up at the agreed time and location</li>
            <li>Reviews must be honest and based on your actual experience</li>
            <li>You may not use photographer&apos;s images for commercial purposes without their written consent</li>
          </ul>
        </section>

        {/* 4. For Photographers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">4. For Photographers</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>You represent that you have the skills and equipment to provide professional photography services</li>
            <li>Portfolio photos must be your own original work</li>
            <li>You must respond to booking requests within 24 hours</li>
            <li>You agree to deliver photos within the timeframe stated in your package</li>
            <li>You are responsible for your own taxes, insurance, and legal compliance</li>
            <li>Subscription fees (Pro, Premium plans) are billed monthly and non-refundable</li>
          </ul>
        </section>

        {/* 5. Payments & Escrow */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">5. Payments &amp; Escrow</h2>
          <p className="mt-3">
            All payments are processed securely through Stripe. When a client books a photoshoot, the full amount
            is charged and held in escrow by Photo Portugal. The payment flow works as follows:
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Client pays the full package price at the time of booking</li>
            <li>Funds are held securely until the photographer delivers the photos and the client accepts the delivery</li>
            <li>Once the client accepts the delivery, the photographer&apos;s share (minus platform commission) is released to them</li>
            <li>If the client does not respond within <strong>30 days</strong> after delivery, the payment is automatically released to the photographer</li>
            <li>If the client does not accept or dispute within 7 days, the photographer may contact our support team to resolve the situation</li>
          </ul>
        </section>

        {/* 6. Platform Commission */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">6. Platform Commission</h2>
          <p className="mt-3">
            Photo Portugal charges a commission on each completed booking. Commission rates depend on the photographer&apos;s plan:
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li><strong>Free plan:</strong> 20% commission</li>
            <li><strong>Pro plan</strong> (&euro;29/month): 15% commission</li>
            <li><strong>Premium plan</strong> (&euro;59/month): 10% commission</li>
          </ul>
          <p className="mt-3">
            Commission is deducted from the photographer&apos;s payout when the booking is completed. If a booking is cancelled
            by the client 7+ days before the shoot, no commission is charged. For late cancellations where a partial payment
            is retained by the photographer, commission applies to the retained amount.
          </p>
        </section>

        {/* 7. Cancellation by Client */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">7. Cancellation by Client</h2>
          <p className="mt-3">Clients may cancel a confirmed booking through their dashboard. Refund amounts depend on timing:</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-warm-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">When you cancel</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                <tr>
                  <td className="px-4 py-3">7+ days before the shoot</td>
                  <td className="px-4 py-3 font-medium text-accent-600">100% refund</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">3&ndash;7 days before the shoot</td>
                  <td className="px-4 py-3 font-medium text-yellow-600">50% refund</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Less than 3 days before the shoot</td>
                  <td className="px-4 py-3 font-medium text-red-600">No refund</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">No-show (failure to appear)</td>
                  <td className="px-4 py-3 font-medium text-red-600">No refund</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            When a partial or no refund applies, the retained amount is paid to the photographer as compensation
            for their reserved time.
          </p>
        </section>

        {/* 8. Cancellation by Photographer */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">8. Cancellation by Photographer</h2>
          <p className="mt-3">
            When a photographer cancels a booking, the client always receives a <strong>100% refund</strong>, regardless
            of timing. Photographers are expected to honour confirmed bookings.
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>If the photographer cancels less than 48 hours before the shoot, Photo Portugal will attempt to find a replacement photographer</li>
            <li>Repeated cancellations (3 or more within a 3-month period) may result in loss of Featured status, reduced visibility, or account suspension</li>
          </ul>
        </section>

        {/* 9. Rescheduling */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">9. Rescheduling</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li><strong>Free reschedule:</strong> one reschedule per booking is free if requested 48+ hours before the shoot</li>
            <li><strong>Late reschedule:</strong> requests within 48 hours are at the photographer&apos;s discretion</li>
            <li><strong>Weather reschedule:</strong> either party may request a free reschedule due to weather conditions unsuitable for outdoor photography &mdash; no penalties or fees apply</li>
          </ul>
        </section>

        {/* 10. Photo Delivery */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">10. Photo Delivery</h2>
          <p className="mt-3">
            Delivery timelines are set by the photographer in each package (typically 3&ndash;14 days).
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Photos are delivered via a private, password-protected gallery on Photo Portugal</li>
            <li>If the photographer exceeds the delivery deadline by <strong>3 or more days</strong>, the client may request a partial refund (up to 20% of the booking amount)</li>
            <li>If the photographer fails to deliver within <strong>14 days after the deadline</strong>, the client receives a full refund and the photographer&apos;s account may be suspended</li>
            <li>After delivery, the client has <strong>7 days</strong> to accept the photos or open a dispute</li>
            <li>If the client does not respond within 7 days, the photographer may contact support to resolve the payment release. After <strong>30 days</strong> of client inactivity, payment is automatically released to the photographer</li>
            <li>Delivered photo galleries remain accessible for <strong>90 days</strong></li>
          </ul>
        </section>

        {/* 11. Disputes */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">11. Disputes &amp; Quality Guarantee</h2>
          <p className="mt-3">
            If you are unsatisfied with the delivered photos, you may open a dispute within 7 days of delivery.
            Photo Portugal will review the dispute and respond within <strong>5 business days</strong>, working with both parties to reach a fair resolution.
          </p>
          <p className="mt-3 font-medium text-gray-900">Grounds for a valid dispute:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Significantly fewer photos than promised in the package</li>
            <li>Photos taken at the wrong location or of the wrong subjects</li>
            <li>Severe technical issues (extreme blur, overexposure, corruption)</li>
            <li>Photographer no-show or incomplete session</li>
          </ul>
          <p className="mt-3 font-medium text-gray-900">Possible resolutions:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Reshoot:</strong> the photographer agrees to redo the session at no additional cost</li>
            <li><strong>Partial refund:</strong> 20&ndash;50% of the booking amount, depending on the severity</li>
            <li><strong>Full refund:</strong> in cases of photographer no-show or complete failure to deliver</li>
          </ul>
          <p className="mt-3 text-sm text-gray-500">
            Subjective preferences (&quot;I don&apos;t like the editing style&quot;) are not grounds for a refund.
            We encourage clients to review photographer portfolios and discuss their vision before booking.
          </p>
        </section>

        {/* 12. Force Majeure */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">12. Force Majeure</h2>
          <p className="mt-3">
            Neither party shall be liable for failure to perform due to circumstances beyond reasonable control,
            including but not limited to: natural disasters, severe weather, government restrictions, pandemics,
            or civil unrest. In such cases, both parties are entitled to a full refund or free reschedule.
          </p>
        </section>

        {/* 13. Intellectual Property */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">13. Intellectual Property</h2>
          <p className="mt-3">
            Photographers retain copyright of all images they create. Clients receive a personal-use
            license for the photos from their session.
          </p>
          <p className="mt-3 font-medium text-gray-900">Personal use includes:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Sharing on personal social media accounts (Instagram, Facebook, etc.)</li>
            <li>Printing for personal display (home, gifts)</li>
            <li>Using as phone/desktop wallpaper or profile photos</li>
          </ul>
          <p className="mt-3 font-medium text-gray-900">Not permitted without photographer&apos;s written consent:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Commercial use (advertising, product packaging, resale)</li>
            <li>Stock photography licensing</li>
            <li>Use in AI/ML training datasets</li>
            <li>Editing or altering photos beyond basic cropping and filters</li>
          </ul>
        </section>

        {/* 14. Prohibited Content */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">14. Prohibited Content &amp; Behaviour</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Fake reviews or manipulated ratings</li>
            <li>Portfolio photos that are not your own work</li>
            <li>Offensive, discriminatory, or illegal content</li>
            <li>Spam or unsolicited promotional messages</li>
            <li>Attempting to arrange bookings or payments outside the platform to avoid fees</li>
          </ul>
        </section>

        {/* 15. Platform Role */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">15. Platform Role &amp; Liability</h2>
          <p className="mt-3">
            Photo Portugal is a marketplace that facilitates connections between clients and photographers.
            While we verify photographer profiles, moderate reviews, and provide dispute resolution,
            we are not a party to the service agreement between clients and photographers.
            Photo Portugal is provided &quot;as is&quot; without warranties of any kind. Our total liability
            is limited to the amount of the booking in question.
          </p>
        </section>

        {/* 16. Dispute Resolution & Arbitration */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">16. Dispute Resolution &amp; Governing Law</h2>
          <p className="mt-3">
            All disputes between users shall first be resolved through Photo Portugal&apos;s internal dispute resolution process
            as described in Section 11. If the internal process does not lead to a satisfactory resolution, parties agree
            to attempt mediation before pursuing legal action.
          </p>
          <p className="mt-3">
            These terms are governed by the laws of Portugal. Any legal proceedings shall be brought
            in the courts of Lisbon, Portugal.
          </p>
        </section>

        {/* 17. Payment Chargebacks */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">17. Payment Chargebacks</h2>
          <p className="mt-3">
            If a client initiates a chargeback through their bank or credit card provider instead of using
            Photo Portugal&apos;s dispute process, we reserve the right to suspend their account pending investigation.
            Photographers affected by chargebacks will be notified and may provide evidence to contest the chargeback.
            Fraudulent chargebacks may result in permanent account suspension.
          </p>
        </section>

        {/* 18. Contact */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">18. Contact</h2>
          <p className="mt-3">
            Questions about these terms? Contact us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>{" "}
            or through our{" "}
            <Link href="/contact" className="text-primary-600 hover:underline">contact page</Link>.
          </p>
        </section>

      </div>
    </div>
  );
}
