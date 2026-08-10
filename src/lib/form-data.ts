import { NextResponse } from "next/server";

/**
 * `req.formData()` throws a bare TypeError — "Failed to parse body as
 * FormData" — whenever the multipart body does not fully arrive: an upload
 * the visitor cancelled, a phone that lost signal mid-send, a proxy that
 * truncated the stream. Nothing is wrong on our side, and there is nothing
 * to retry server-side.
 *
 * Left to bubble into a route's catch-all it becomes a 500, which (a) tells
 * the visitor "Upload failed" with no hint that retrying would work, and
 * (b) fires a NEW 5xx alert for a client-side hiccup. That is exactly what
 * happened on 2026-08-10, when a photographer's avatar upload on
 * photoitaly.co paged us twice in 42 seconds while the endpoint itself was
 * healthy (verified against origin and through Cloudflare at 0.8/3.9/9.9 MB).
 *
 * Returns the parsed form, or a ready-to-return 400.
 */
export async function readFormData(
  req: Request,
): Promise<{ form: FormData; error: null } | { form: null; error: NextResponse }> {
  try {
    return { form: await req.formData(), error: null };
  } catch {
    return {
      form: null,
      error: NextResponse.json(
        { error: "The upload did not finish — check your connection and try again." },
        { status: 400 },
      ),
    };
  }
}
