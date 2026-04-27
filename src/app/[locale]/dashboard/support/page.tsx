import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import SupportClient from "./SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  // Sidebar lists Support under photographer-only links; clients with support
  // questions go through /contact (public form). Keep this page photographer-only
  // so the messaging matches.
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  return <SupportClient />;
}
