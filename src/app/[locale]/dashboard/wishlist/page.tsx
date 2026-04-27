import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import WishlistClient from "./WishlistClient";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  // Wishlist (saved photographers) is a client-only feature. Photographers don't
  // have a 'favourite photographers' concept, so send them back to their dashboard.
  if (userRow?.role === "photographer") redirect("/dashboard");

  return <WishlistClient />;
}
