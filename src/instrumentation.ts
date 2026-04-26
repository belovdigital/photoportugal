// Next.js instrumentation: onRequestError hook fires for ANY uncaught error
// in a server-rendered page or API route — synchronous or async. This is the
// catch-all path that powers our 5xx → cto@ email pipeline.
//
// Caveat: routes that catch errors and return res.json({error: ...}, {status: 500})
// will NOT trigger this hook (the throw is swallowed). Those need to call
// logServerError() manually inside their catch block.

export async function register() {
  // Reserved for future setup (Sentry, OTel, etc.). No-op for now.
}

interface RequestErrorContext {
  routerKind?: "App Router" | "Pages Router";
  routePath?: string;
  routeType?: "render" | "route" | "action" | "middleware";
  renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
  revalidateReason?: string;
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: RequestErrorContext
) {
  // Skip Server Action staleness errors — those are deploy-induced false positives
  // (old client + new server). The user just needs to refresh.
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Failed to find Server Action")) return;

  // Skip tracking-pixel-style errors that aren't actionable
  if (request.path.startsWith("/api/track-")) return;

  // Skip noise from VPN clients / port scanners / probes hitting page routes with
  // unsupported methods. AnyConnect, NMAP, Censys, etc. send POST/PUT to / and
  // crash Next's stream transform — not our bug, just internet noise.
  const ua = (() => {
    const v = request.headers["user-agent"];
    if (Array.isArray(v)) return v[0] || "";
    return (v as string | undefined) || "";
  })();
  const isProbeUa = /AnyConnect|nmap|masscan|censys|zgrab|curl\/[0-9]+\s*$|wget|python-requests|Go-http-client/i.test(ua);
  const isPageMethodMismatch =
    !request.path.startsWith("/api/") &&
    request.method !== "GET" &&
    request.method !== "HEAD";
  if (isProbeUa || isPageMethodMismatch) return;
  // The transformAlgorithm crash is purely a Node.js webstream quirk when
  // page routes receive non-GET methods; suppress regardless of UA.
  if (msg.includes("transformAlgorithm is not a function")) return;

  try {
    const { logServerError } = await import("@/lib/error-logger");

    // Normalize headers: Next gives us Record<string, string | string[] | undefined>
    const h = (k: string): string | null => {
      const v = request.headers[k.toLowerCase()];
      if (Array.isArray(v)) return v[0] || null;
      return (v as string | undefined) || null;
    };

    await logServerError(err, {
      path: request.path,
      method: request.method,
      statusCode: 500,
      userAgent: h("user-agent"),
      ip: h("x-forwarded-for")?.split(",")[0]?.trim() || h("x-real-ip"),
      referrer: h("referer"),
    });
  } catch (loggerErr) {
    console.error("[instrumentation.onRequestError] logger failed:", loggerErr);
  }
}
