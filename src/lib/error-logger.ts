// Error logging + throttled email alerts for any 5xx server error.
// Used by:
//   - instrumentation.ts (Next.js onRequestError hook — catches uncaught throws)
//   - logServerError() called manually from API routes that catch+return 500 JSON
//
// Throttling rule: at most 1 email per fingerprint per hour. Repeats within
// the window bump occurrence_count instead of sending another email.

import { queryOne } from "@/lib/db";

// djb2 hash — works in both Node and Edge runtimes; fingerprint doesn't need
// to be cryptographically strong, just stable across requests.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface ErrorContext {
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  requestQuery?: string | null;
  requestBody?: unknown;
  userAgent?: string | null;
  ip?: string | null;
  referrer?: string | null;
}

const ERROR_TO_EMAIL = process.env.ERROR_LOG_EMAIL || "cto@photoportugal.com";
const THROTTLE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const TRUNCATE_BODY_BYTES = 2048;

function classifyError(err: unknown): { name: string; message: string; stack: string | null } {
  if (!err) return { name: "Unknown", message: "(empty error)", stack: null };
  if (err instanceof Error) {
    // Postgres errors carry an extra .code (e.g. '42703') — surface it for fingerprinting.
    const pgCode = (err as { code?: string }).code;
    return {
      name: pgCode ? `pg_error_${pgCode}` : err.name || "Error",
      message: err.message || "(no message)",
      stack: err.stack || null,
    };
  }
  const msg = typeof err === "string" ? err : JSON.stringify(err).slice(0, 500);
  return { name: "Unknown", message: msg, stack: null };
}

/** Stable fingerprint: groups identical errors so they hit the same throttle bucket. */
function buildFingerprint(path: string, errorClass: string, message: string): string {
  // Strip dynamic IDs from path so /api/admin/match-request/abc-123/status
  // groups with /api/admin/match-request/def-456/status.
  const stable = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\b[0-9]+\b/g, ":n");
  // Normalize message: strip identifiers / quoted strings that change per request.
  const normMsg = message
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/\b[0-9a-f-]{16,}\b/gi, ":id")
    .slice(0, 200);
  return hashString(`${stable}|${errorClass}|${normMsg}`);
}

function truncateJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    const json = typeof value === "string" ? value : JSON.stringify(value);
    return json.length > TRUNCATE_BODY_BYTES ? json.slice(0, TRUNCATE_BODY_BYTES) + "…[truncated]" : json;
  } catch {
    return null;
  }
}

/**
 * Log a 5xx server error. Returns true if a NEW row was created (i.e. unique
 * fingerprint within the throttle window), false if it incremented an existing row.
 * Email is sent in the background; never throws.
 */
export async function logServerError(err: unknown, ctx: ErrorContext = {}): Promise<void> {
  try {
    const { name: errorClass, message, stack } = classifyError(err);
    const path = ctx.path || "/unknown";
    const fingerprint = buildFingerprint(path, errorClass, message);

    const existing = await queryOne<{
      id: string;
      email_sent_at: string | null;
      occurrence_count: number;
    }>(
      `SELECT id, email_sent_at, occurrence_count FROM error_logs
        WHERE fingerprint = $1
          AND last_seen > NOW() - INTERVAL '24 hours'
          AND resolved_at IS NULL
        ORDER BY last_seen DESC LIMIT 1`,
      [fingerprint]
    );

    let logId: string | null = null;
    let shouldEmail = false;

    if (existing) {
      // Increment count, update last_seen
      await queryOne(
        `UPDATE error_logs
            SET occurrence_count = occurrence_count + 1,
                last_seen = NOW()
          WHERE id = $1`,
        [existing.id]
      );
      logId = existing.id;
      // Email throttle: send once per hour per fingerprint
      const lastEmail = existing.email_sent_at ? new Date(existing.email_sent_at).getTime() : 0;
      shouldEmail = Date.now() - lastEmail > THROTTLE_WINDOW_MS;
    } else {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO error_logs
           (fingerprint, path, method, status_code, error_class, error_message, error_stack,
            user_id, user_email, user_role, request_query, request_body, user_agent, ip, referrer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15)
         RETURNING id`,
        [
          fingerprint,
          path.slice(0, 500),
          ctx.method || null,
          ctx.statusCode || 500,
          errorClass.slice(0, 100),
          message.slice(0, 2000),
          stack ? stack.slice(0, 5000) : null,
          ctx.userId || null,
          ctx.userEmail || null,
          ctx.userRole || null,
          ctx.requestQuery ? ctx.requestQuery.slice(0, 1000) : null,
          truncateJson(ctx.requestBody),
          ctx.userAgent ? ctx.userAgent.slice(0, 500) : null,
          ctx.ip || null,
          ctx.referrer ? ctx.referrer.slice(0, 500) : null,
        ]
      );
      logId = row?.id || null;
      shouldEmail = true;
    }

    if (shouldEmail && logId) {
      // Mark email as sent BEFORE actually sending so we don't double-fire on race.
      await queryOne(
        `UPDATE error_logs SET email_sent_at = NOW(), email_count = email_count + 1 WHERE id = $1`,
        [logId]
      );
      // Fire-and-forget — never block the request handler waiting on email.
      sendErrorEmail(logId, fingerprint, errorClass, message, stack, ctx, !existing).catch((emailErr) => {
        console.error("[error-logger] sendErrorEmail failed:", emailErr);
      });
    }
  } catch (loggerErr) {
    // Logger MUST NOT throw — would mask the original error.
    console.error("[error-logger] failed to log:", loggerErr);
  }
}

async function sendErrorEmail(
  logId: string,
  fingerprint: string,
  errorClass: string,
  message: string,
  stack: string | null,
  ctx: ErrorContext,
  isFirstOccurrence: boolean
) {
  const { sendEmail } = await import("@/lib/email");
  const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://photoportugal.com";

  const path = ctx.path || "(unknown path)";
  const status = ctx.statusCode || 500;
  const subject = `[5xx ${status}] ${path} — ${errorClass}: ${message.slice(0, 60)}`;

  const stackHtml = stack
    ? `<pre style="background:#f6f6f6;padding:12px;border-radius:6px;font-size:12px;line-height:1.4;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(stack.slice(0, 2500))}</pre>`
    : "<p style='color:#888;font-size:13px;'>(no stack trace)</p>";

  const userInfo = ctx.userEmail
    ? `<li><strong>User:</strong> ${escapeHtml(ctx.userEmail)} ${ctx.userRole ? `(${ctx.userRole})` : ""}</li>`
    : "<li><strong>User:</strong> anonymous</li>";

  const requestBlock = ctx.requestBody
    ? `<p style="margin:8px 0 4px;font-size:13px;font-weight:600;">Request body:</p>
       <pre style="background:#f6f6f6;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(truncateJson(ctx.requestBody) || "")}</pre>`
    : "";

  const flagBadge = isFirstOccurrence
    ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">NEW</span>'
    : '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">RECURRING</span>';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;max-width:720px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626;">${flagBadge} 5xx Error on ${escapeHtml(path)}</h2>
      <p style="margin:0 0 16px;color:#525252;font-size:13px;">Status <strong>${status}</strong> · ${escapeHtml(errorClass)}</p>

      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:0 0 16px;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#7f1d1d;font-family:monospace;"><strong>${escapeHtml(message)}</strong></p>
      </div>

      <p style="margin:8px 0 4px;font-size:13px;font-weight:600;">Stack:</p>
      ${stackHtml}

      <p style="margin:16px 0 4px;font-size:13px;font-weight:600;">Context:</p>
      <ul style="font-size:13px;line-height:1.7;color:#525252;padding-left:20px;margin:0;">
        <li><strong>Method:</strong> ${escapeHtml(ctx.method || "—")}</li>
        ${userInfo}
        <li><strong>IP:</strong> ${escapeHtml(ctx.ip || "—")}</li>
        <li><strong>Referrer:</strong> ${escapeHtml(ctx.referrer || "—")}</li>
        <li><strong>UA:</strong> ${escapeHtml((ctx.userAgent || "—").slice(0, 120))}</li>
        <li><strong>Query:</strong> ${escapeHtml(ctx.requestQuery || "—")}</li>
        <li><strong>Fingerprint:</strong> <code>${fingerprint}</code></li>
        <li><strong>Log ID:</strong> <code>${logId}</code></li>
      </ul>

      ${requestBlock}

      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
        Future occurrences of this fingerprint will be silenced for 1 hour.
        <a href="${baseUrl}/admin#errors" style="color:#dc2626;">Open admin →</a>
      </p>
    </div>
  `;

  await sendEmail(ERROR_TO_EMAIL, subject, html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert a Next.js Request-ish object into our ErrorContext shape. */
export async function buildContextFromRequest(req: Request, body?: unknown): Promise<ErrorContext> {
  const url = new URL(req.url);
  return {
    path: url.pathname,
    method: req.method,
    requestQuery: url.search ? url.search.slice(1) : null,
    requestBody: body,
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
    referrer: req.headers.get("referer") || null,
  };
}
