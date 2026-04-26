import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";

// Admin panel renders OUTSIDE the [locale] segment, so client components like
// ConfirmModal / DatePicker that call useTranslations() would otherwise throw.
// Provide an EN-locked NextIntlClientProvider so those hooks resolve safely.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="admin-layout">{children}</div>
    </NextIntlClientProvider>
  );
}
