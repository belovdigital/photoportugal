import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Photo Portugal. Questions about bookings, photographer accounts, or partnerships? We're here to help.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-gray-900">
          Contact Us
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Have a question? We&apos;d love to hear from you.
        </p>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <div className="rounded-xl border border-warm-200 bg-white p-8">
          <h2 className="text-lg font-bold text-gray-900">General Inquiries</h2>
          <p className="mt-2 text-sm text-gray-500">
            Questions about bookings, our platform, or anything else.
          </p>
          <a
            href="mailto:info@photoportugal.com"
            className="mt-4 inline-flex text-primary-600 font-semibold hover:text-primary-700"
          >
            info@photoportugal.com
          </a>
        </div>

        <div className="rounded-xl border border-warm-200 bg-white p-8">
          <h2 className="text-lg font-bold text-gray-900">Photographer Support</h2>
          <p className="mt-2 text-sm text-gray-500">
            Help with your photographer account, profile, or payouts.
          </p>
          <a
            href="mailto:photographers@photoportugal.com"
            className="mt-4 inline-flex text-primary-600 font-semibold hover:text-primary-700"
          >
            photographers@photoportugal.com
          </a>
        </div>

        <div className="rounded-xl border border-warm-200 bg-white p-8">
          <h2 className="text-lg font-bold text-gray-900">Partnerships</h2>
          <p className="mt-2 text-sm text-gray-500">
            Hotels, tourism agencies, and business collaborations.
          </p>
          <a
            href="mailto:partners@photoportugal.com"
            className="mt-4 inline-flex text-primary-600 font-semibold hover:text-primary-700"
          >
            partners@photoportugal.com
          </a>
        </div>

        <div className="rounded-xl border border-warm-200 bg-white p-8">
          <h2 className="text-lg font-bold text-gray-900">Press & Media</h2>
          <p className="mt-2 text-sm text-gray-500">
            Media inquiries, interviews, and press materials.
          </p>
          <a
            href="mailto:press@photoportugal.com"
            className="mt-4 inline-flex text-primary-600 font-semibold hover:text-primary-700"
          >
            press@photoportugal.com
          </a>
        </div>
      </div>

      <div className="mt-12 rounded-xl bg-warm-50 p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900">Response Time</h2>
        <p className="mt-2 text-gray-500">
          We typically respond within 24 hours on business days. For urgent booking
          issues, please contact your photographer directly through the messaging
          system in your dashboard.
        </p>
      </div>
    </div>
  );
}
