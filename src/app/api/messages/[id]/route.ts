import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit / delete a chat message. Both routes share the same authorization
// gate, so it lives in this helper. Returns null when the action is
// allowed (with the loaded message row); returns a NextResponse to
// short-circuit on any rejection.
async function loadAndAuthorize(req: NextRequest, messageId: string, mode: "edit" | "delete") {
  const user = await authFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const row = await queryOne<{
    id: string;
    sender_id: string;
    booking_id: string | null;
    text: string | null;
    is_system: boolean;
    created_at: string;
    read_at: string | null;
    deleted_at: string | null;
    original_text: string | null;
  }>(
    `SELECT id, sender_id, booking_id, text,
            COALESCE(is_system, FALSE) AS is_system,
            created_at, read_at, deleted_at, original_text
       FROM messages WHERE id = $1`,
    [messageId],
  );

  if (!row) return { error: NextResponse.json({ error: "Message not found" }, { status: 404 }) };
  if (row.sender_id !== user.id) {
    return { error: NextResponse.json({ error: "You can only modify your own messages" }, { status: 403 }) };
  }
  if (row.is_system) {
    return { error: NextResponse.json({ error: "System messages cannot be modified" }, { status: 403 }) };
  }
  if (row.deleted_at) {
    return { error: NextResponse.json({ error: "Message was already deleted" }, { status: 409 }) };
  }

  // 15-minute window from creation. Tight enough to prevent rewriting
  // history once a conversation has moved on, loose enough for typo /
  // autocorrect / wrong-thread cases.
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) {
    return { error: NextResponse.json({
      error: mode === "edit"
        ? "Edit window has passed (messages can be edited within 15 minutes)"
        : "Delete window has passed (messages can be deleted within 15 minutes)",
    }, { status: 403 }) };
  }

  // Block during active disputes — preserves the chat thread verbatim
  // for admin review. The bookings.id FK is nullable on messages, but
  // for any real chat we expect it set; treat missing as no-dispute.
  if (row.booking_id) {
    const dispute = await queryOne<{ id: string }>(
      "SELECT id FROM disputes WHERE booking_id = $1 AND status IN ('open', 'under_review') LIMIT 1",
      [row.booking_id],
    );
    if (dispute) {
      return { error: NextResponse.json({ error: "Messages on a disputed booking are locked" }, { status: 403 }) };
    }
  }

  return { user, row };
}

// Cancel pending SMS/email notifications still sitting in the 3-min hold
// queue. If a notification already went out we can't unsend it — the
// receiver will see the original text in their inbox/phone. The web/
// mobile copy in the chat thread is what we control.
async function cancelPendingNotifs(messageId: string): Promise<number> {
  const res = await query<{ id: string }>(
    `UPDATE notification_queue
        SET status = 'cancelled', last_error = 'message edited or deleted'
      WHERE message_id = $1
        AND status = 'pending'
      RETURNING id`,
    [messageId],
  ).catch(() => [] as { id: string }[]);
  return res.length;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await loadAndAuthorize(req, id, "edit");
  if (gate.error) return gate.error;
  const { row } = gate;

  const body = await req.json().catch(() => ({}));
  const newText = typeof body?.text === "string" ? body.text.trim() : "";
  if (!newText) return NextResponse.json({ error: "Text required" }, { status: 400 });
  if (newText.length > 10000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  if (newText === (row.text || "")) {
    // No-op — return the current state so the UI sees a successful response
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Preserve the original text on first edit only — subsequent edits
  // continue to display "edited" but the audit trail keeps the very
  // first version (most valuable for disputes).
  const updated = await queryOne<{ id: string; edited_at: string }>(
    `UPDATE messages
        SET text = $1,
            edited_at = NOW(),
            original_text = COALESCE(original_text, $2)
      WHERE id = $3
      RETURNING id, edited_at::text`,
    [newText, row.text, id],
  );

  const cancelled = await cancelPendingNotifs(id);

  // Broadcast to the booking room so the other party sees the new
  // text without polling. Fire-and-forget — failure here doesn't
  // affect the edit itself (UI will catch up on next fetch).
  if (row.booking_id) {
    queryOne("SELECT pg_notify('message_changed', $1)", [
      JSON.stringify({
        booking_id: row.booking_id,
        kind: "edited",
        message_id: id,
        text: newText,
        edited_at: updated?.edited_at || new Date().toISOString(),
      }),
    ]).catch(() => {});
  }

  return NextResponse.json({ ok: true, edited_at: updated?.edited_at, notifications_cancelled: cancelled });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await loadAndAuthorize(req, id, "delete");
  if (gate.error) return gate.error;
  const { row } = gate;

  const updated = await queryOne<{ deleted_at: string }>(
    "UPDATE messages SET deleted_at = NOW() WHERE id = $1 RETURNING deleted_at::text",
    [id],
  );

  const cancelled = await cancelPendingNotifs(id);

  if (row.booking_id) {
    queryOne("SELECT pg_notify('message_changed', $1)", [
      JSON.stringify({
        booking_id: row.booking_id,
        kind: "deleted",
        message_id: id,
        deleted_at: updated?.deleted_at || new Date().toISOString(),
      }),
    ]).catch(() => {});
  }

  return NextResponse.json({ ok: true, notifications_cancelled: cancelled });
}
