import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";

// Admin panel renders OUTSIDE the [locale] segment, so client components like
// ConfirmModal / DatePicker that call useTranslations() would otherwise throw.
// Provide an EN-locked NextIntlClientProvider with ONLY the namespaces shared
// UI components actually read (currently just `common`) — embedding the full
// 178KB en.json into every admin SSR response would be wasteful.
const adminMessages = { common: enMessages.common };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={adminMessages}>
      <div className="admin-layout">{children}</div>
    </NextIntlClientProvider>
  );
}
