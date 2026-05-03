// Backfill Kate's review-request chat message for all past delivered+accepted
// bookings that don't have a review yet and haven't received the message.
//
// Run on the production server: `node scripts/backfill-review-requests.mjs`
// (reads /var/www/photoportugal/.env). Dry-run prints a count first; pass
// `--yes` to actually insert messages.

import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const KATE_USER_ID = "1fe40315-bd00-4530-a6be-39fa970617bd";
const yes = process.argv.includes("--yes");

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const { rows: targets } = await client.query(`
  SELECT b.id, cu.name as client_name, pu.name as photographer_name, b.delivery_accepted_at
  FROM bookings b
  JOIN users cu ON cu.id = b.client_id
  JOIN photographer_profiles pp ON pp.id = b.photographer_id
  JOIN users pu ON pu.id = pp.user_id
  WHERE b.delivery_accepted = TRUE
    AND b.delivery_accepted_at IS NOT NULL
    AND COALESCE(b.review_chat_sent, FALSE) = FALSE
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
  ORDER BY b.delivery_accepted_at DESC
`);

console.log(`Found ${targets.length} bookings eligible for backfill:`);
for (const t of targets) {
  console.log(`  - ${t.id.slice(0, 8)} · ${t.client_name} → ${t.photographer_name} · accepted ${new Date(t.delivery_accepted_at).toISOString().slice(0, 10)}`);
}

if (!yes) {
  console.log("\nDry run. Re-run with --yes to actually send the messages.");
  await client.end();
  process.exit(0);
}

let inserted = 0;
for (const t of targets) {
  try {
    const firstName = (t.client_name || "").trim().split(" ")[0] || "";
    const payload = firstName ? `REVIEW_REQUEST:${t.id}:${encodeURIComponent(firstName)}` : `REVIEW_REQUEST:${t.id}`;
    await client.query(
      "INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)",
      [t.id, KATE_USER_ID, payload]
    );
    await client.query("UPDATE bookings SET review_chat_sent = TRUE WHERE id = $1", [t.id]);
    inserted++;
    console.log(`  ✓ ${t.id.slice(0, 8)} · ${t.client_name}`);
  } catch (err) {
    console.error(`  ✗ ${t.id.slice(0, 8)}: ${err.message}`);
  }
}

console.log(`\nDone. Inserted ${inserted}/${targets.length} messages.`);
await client.end();
