import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { StripeConnectSection } from "../subscriptions/StripeConnectSection";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Payouts</h1>
      <p className="mt-1 text-gray-500">Manage your payment setup and view earnings</p>

      <StripeConnectSection />
    </div>
  );
}
