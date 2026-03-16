import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const role = (session.user as { role?: string }).role;

  if (role === "photographer") {
    redirect("/dashboard/photographer");
  } else {
    redirect("/dashboard/client");
  }
}
