import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { CalendarSyncClient } from "./CalendarSyncClient";

export const dynamic = "force-dynamic";

export default async function CalendarSyncPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Calendar Sync</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          Connect your personal calendar so dates already booked there can&apos;t be double-booked
          through Photo Portugal. Only busy time ranges are read — never event titles, attendees,
          or any other details.
        </p>
      </div>
      <CalendarSyncClient />
    </div>
  );
}
