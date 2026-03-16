import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Read role from DB directly (JWT may be stale after set-role)
  const userId = (session.user as { id?: string }).id;
  let role = (session.user as { role?: string }).role;

  if (userId) {
    try {
      const dbUser = await queryOne<{ role: string }>(
        "SELECT role FROM users WHERE id = $1",
        [userId]
      );
      if (dbUser) {
        role = dbUser.role;
      }
    } catch {}
  }

  if (role === "photographer") {
    redirect("/dashboard/photographer");
  } else {
    redirect("/dashboard/client");
  }
}
