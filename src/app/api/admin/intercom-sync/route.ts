import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

const INTERCOM_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

async function searchIntercomContact(
  email: string
): Promise<{ id: string } | null> {
  const res = await fetch("https://api.intercom.io/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INTERCOM_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: { field: "email", operator: "=", value: email },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0] ?? null;
}

interface SyncUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_approved: boolean;
  is_banned: boolean;
}

function buildAttributes(user: SyncUser) {
  const attrs: Record<string, string | boolean> = { user_role: user.role };
  if (user.role === "photographer") {
    attrs.is_approved = user.is_approved && !user.is_banned;
  }
  return attrs;
}

async function createIntercomContact(user: SyncUser): Promise<boolean> {
  const res = await fetch("https://api.intercom.io/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INTERCOM_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      role: "user",
      external_id: user.id,
      email: user.email,
      name: user.name,
      custom_attributes: buildAttributes(user),
    }),
  });
  return res.ok;
}

async function updateIntercomContact(intercomId: string, user: SyncUser): Promise<boolean> {
  const res = await fetch(
    `https://api.intercom.io/contacts/${intercomId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${INTERCOM_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        external_id: user.id,
        name: user.name,
        custom_attributes: buildAttributes(user),
      }),
    }
  );
  return res.ok;
}

export async function POST(req: NextRequest) {
  // Allow auth via admin cookie OR cron secret
  const secret = req.nextUrl.searchParams.get("secret");
  const isAuthed = secret === process.env.CRON_SECRET || (await verifyAdmin());
  if (!isAuthed) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  if (!INTERCOM_TOKEN) {
    return NextResponse.json(
      { error: "INTERCOM_ACCESS_TOKEN not configured" },
      { status: 500 }
    );
  }

  const users = await query<SyncUser>(
    `SELECT u.id, u.name, u.email, u.role,
            COALESCE(pp.is_approved, FALSE) as is_approved,
            COALESCE(u.is_banned, FALSE) as is_banned
     FROM users u
     LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
     ORDER BY u.created_at ASC`
  );

  let created = 0;
  let updated = 0;
  let errors = 0;

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (const user of users) {
    try {
      await delay(200); // Rate limit: max 5 req/s
      const existing = await searchIntercomContact(user.email);

      if (existing) {
        const ok = await updateIntercomContact(existing.id, user);
        if (ok) {
          updated++;
        } else {
          errors++;
        }
      } else {
        const ok = await createIntercomContact(user);
        if (ok) {
          created++;
        } else {
          errors++;
        }
      }
    } catch (err) {
      console.error(`[intercom-sync] error syncing user ${user.id}:`, err);
      errors++;
    }
  }

  const synced = created + updated;

  return NextResponse.json({ synced, created, updated, errors });
}
