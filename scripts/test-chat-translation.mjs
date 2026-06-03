// Live test of the chat translation pipeline.
// Mints a JWT for an existing test client and POSTs a foreign-language
// message via the live /api/messages endpoint, then polls the prod DB
// to confirm `translated_text` got written within ~10 seconds.
//
// Usage (on the prod server):
//   node scripts/test-chat-translation.mjs
//
// Designed to clean up after itself so it doesn't pollute real chats.

import fs from "node:fs";
import jwt from "jsonwebtoken";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync("/var/www/photoportugal/.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    })
);
const SECRET = env.NEXTAUTH_SECRET;
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const BOOKING_ID = "2f28be7e-baea-4643-b4d4-a51b1878683b";
const CLIENT = { id: "2a828e66-c993-4a76-ac5d-454d6c2aaea0", email: "nekto.komilfo@gmail.com" };

function mintToken() {
  return jwt.sign({ id: CLIENT.id, email: CLIENT.email, role: "client" }, SECRET, { expiresIn: "10m" });
}

async function post(text, token) {
  const res = await fetch("http://127.0.0.1:3001/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: BOOKING_ID, text }),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function waitForTranslation(messageId, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await pool.query(
      `SELECT detected_language, translated_text, translated_to_lang, translation_skip_reason, translated_at
         FROM messages WHERE id = $1`,
      [messageId]
    );
    const row = r.rows[0];
    if (row?.translated_at) return row;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const token = mintToken();
const cases = [
  { name: "PT → EN", text: "Olá! Estou interessada em fazer uma sessão fotográfica em Comporta no dia 20 de agosto. Pode confirmar disponibilidade?", expectDetect: "pt", expectTranslate: true },
  { name: "EN → same lang (skip)", text: "Hi! Is August 20 available for a couple shoot in Comporta?", expectDetect: "en", expectTranslate: false },
  { name: "ES → EN", text: "Hola, ¿está disponible el 20 de agosto para una sesión de pareja?", expectDetect: "es", expectTranslate: true },
  { name: "Too short (skip)", text: "ok thanks", expectDetect: null, expectTranslate: false },
  { name: "BOOKING_CARD (skip)", text: 'BOOKING_CARD:{"package_id":"x","name":"y","price":100}', expectDetect: null, expectTranslate: false },
];

const createdIds = [];
let pass = 0, fail = 0;
for (const c of cases) {
  const { status, data } = await post(c.text, token);
  if (status !== 200 || !data.message?.id) {
    console.log(`✗ ${c.name}: HTTP ${status} ${JSON.stringify(data).slice(0, 200)}`);
    fail++;
    continue;
  }
  const msgId = data.message.id;
  createdIds.push(msgId);
  const row = await waitForTranslation(msgId);
  if (!row) {
    console.log(`✗ ${c.name}: no translation in DB after 15s`);
    fail++;
    continue;
  }
  const detectedOk = c.expectDetect === null || row.detected_language === c.expectDetect;
  const translateOk = c.expectTranslate
    ? !!row.translated_text
    : !row.translated_text; // expected to be skipped
  if (detectedOk && translateOk) {
    console.log(`✓ ${c.name}: detected=${row.detected_language} translated=${row.translated_text ? row.translated_text.slice(0, 60) : `(skip: ${row.translation_skip_reason})`}`);
    pass++;
  } else {
    console.log(`✗ ${c.name}: detected=${row.detected_language} translated=${row.translated_text?.slice(0, 60)} skip=${row.translation_skip_reason} expectedDetect=${c.expectDetect} expectedTranslate=${c.expectTranslate}`);
    fail++;
  }
}

// Cleanup
if (createdIds.length > 0) {
  await pool.query("DELETE FROM messages WHERE id = ANY($1::uuid[])", [createdIds]);
  console.log(`\nCleaned up ${createdIds.length} test messages.`);
}
console.log(`\nResult: ${pass} passed, ${fail} failed`);
await pool.end();
process.exit(fail > 0 ? 1 : 0);
