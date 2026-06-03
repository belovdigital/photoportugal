// End-to-end test of the photographer-initiated fast-track flow.
// Hits the LOCAL dev /api/bookings endpoint with a synthetic Bearer
// token (signed with the dev NEXTAUTH_SECRET) and checks the resulting
// booking row in the DB to confirm fast-track logic is correct.
//
// Usage: node scripts/test-booking-fast-track.mjs
// Requires: dev server running on http://localhost:3000

import fs from "node:fs";
import jwt from "jsonwebtoken";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter(l => l && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);
const SECRET = env.NEXTAUTH_SECRET;

const pool = new pg.Pool({ connectionString: env.DATABASE_URL || "postgres://localhost/photoportugal_local" });

// Real test fixtures from local DB (see prep step in the conversation).
const CLIENT_USER = { id: "c62e325c-5fec-4471-9ceb-b8fc9f74c32f", email: "fatima.somani@gmail.com" };
const PHOTOGRAPHER_ID = "20323be2-b395-49d9-9a2f-9a2f66c0c18a";
const VALID_PACKAGE = "aec2498f-4a97-495b-b726-9c8be7f1bcda";
const VALID_PROPOSAL_MSG = "62cb839c-9bc5-4b77-b139-b7fb1e0ccb85";
// Some other package not in the BOOKING_CARD payload.
const OTHER_PACKAGE_RES = await pool.query(
  "SELECT id FROM packages WHERE photographer_id = $1 AND id != $2 LIMIT 1",
  [PHOTOGRAPHER_ID, VALID_PACKAGE],
);
const OTHER_PACKAGE = OTHER_PACKAGE_RES.rows[0]?.id || null;

function mintToken(userId, email) {
  return jwt.sign({ id: userId, email, role: "client" }, SECRET, { expiresIn: "1h" });
}

async function post(body, token) {
  const res = await fetch("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function bookingStatus(bookingId) {
  if (!bookingId) return null;
  const r = await pool.query("SELECT status, package_id FROM bookings WHERE id = $1", [bookingId]);
  return r.rows[0] || null;
}

const token = mintToken(CLIENT_USER.id, CLIENT_USER.email);
const createdIds = [];

// Each test creates a real booking row. To avoid the photographer
// being "busy" on the second/third run we hand out a unique date per
// scenario so the calendar-conflict check doesn't block subsequent
// cases.
let dayCursor = 15;
function uniqueDate() {
  const d = dayCursor++;
  return { iso: `2026-09-${String(d).padStart(2, "0")}`, coords: { year: 2026, month: 9, day: d } };
}

function baseBody(overrides) {
  const { iso, coords } = uniqueDate();
  return {
    photographer_id: PHOTOGRAPHER_ID,
    package_id: VALID_PACKAGE,
    location_slug: "comporta",
    shoot_date: iso,
    shoot_date_coords: coords,
    shoot_time: null,
    group_size: 2,
    occasion: "couples",
    message: "Test booking",
    client_phone: "+351999999999",
    ...overrides,
  };
}

const cases = [
  {
    name: "1. Happy path — fast-track",
    body: baseBody({ proposal_message_id: VALID_PROPOSAL_MSG }),
    expectStatus: "confirmed",
    expectFastTrack: true,
  },
  {
    name: "2. No proposal — regular pending",
    body: baseBody({}),
    expectStatus: "pending",
    expectFastTrack: false,
  },
  {
    name: "3. Spoofed package — fast-track rejected",
    body: baseBody({ proposal_message_id: VALID_PROPOSAL_MSG, package_id: OTHER_PACKAGE }),
    expectStatus: "pending",
    expectFastTrack: false,
  },
  {
    name: "4. Invalid proposal id — fast-track rejected",
    body: baseBody({ proposal_message_id: "00000000-0000-0000-0000-000000000000" }),
    expectStatus: "pending",
    expectFastTrack: false,
  },
];

if (!OTHER_PACKAGE) {
  console.warn("⚠️ No second package available for photographer; skipping case 3");
  cases.splice(2, 1);
}

let passed = 0, failed = 0;
for (const c of cases) {
  const { status: httpStatus, data } = await post(c.body, token);
  if (httpStatus !== 200) {
    console.log(`✗ ${c.name}: HTTP ${httpStatus} ${JSON.stringify(data).slice(0, 150)}`);
    failed++;
    continue;
  }
  const row = await bookingStatus(data.booking_id);
  createdIds.push(data.booking_id);
  const okStatus = row?.status === c.expectStatus;
  const okFastTrack = !!data.fast_track === c.expectFastTrack;
  const pass = okStatus && okFastTrack;
  if (pass) {
    console.log(`✓ ${c.name}: status=${row.status} fast_track=${data.fast_track}`);
    passed++;
  } else {
    console.log(`✗ ${c.name}: got status=${row?.status} fast_track=${data.fast_track} (expected status=${c.expectStatus} fast_track=${c.expectFastTrack})`);
    failed++;
  }
}

// Clean up test bookings so we don't pollute local DB.
if (createdIds.length > 0) {
  await pool.query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [createdIds]);
  console.log(`\nCleaned up ${createdIds.length} test bookings.`);
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
await pool.end();
process.exit(failed > 0 ? 1 : 0);
