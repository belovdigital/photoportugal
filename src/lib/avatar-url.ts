// Google OAuth profile pictures default to a tiny 96-pixel thumbnail
// (`=s96-c` appended to the URL). That's fine for the small avatar in a
// chat list, but looks terrible the moment we try to zoom or show it in a
// hero spot. Google supports arbitrary size by simply changing the number
// — so we rewrite the URL to ask for a larger version everywhere we store
// or display a Google avatar.
//
// Pattern lives in the URL path, not query: e.g.
//   https://lh3.googleusercontent.com/a/ACg8oc...=s96-c
// We swap any `=s<n>-c` (or `=s<n>` without -c) for the target size.

const GOOGLE_HOST_RE = /(googleusercontent|googleapis)\.com/i;

export function normalizeAvatarUrl(url: string | null | undefined, targetSize: number = 500): string | null {
  if (!url || typeof url !== "string") return url ?? null;
  if (!GOOGLE_HOST_RE.test(url)) return url;
  // Replace existing =s<n>[-c] suffix.
  const swapped = url.replace(/=s\d+(-c)?$/, `=s${targetSize}-c`);
  if (swapped !== url) return swapped;
  // Some Google URLs don't have a size suffix yet — append one.
  return url.includes("=") ? url : `${url}=s${targetSize}-c`;
}
