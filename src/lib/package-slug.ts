// Slugify a package name for use in URLs. Lowercase, alphanumeric +
// dashes only. The DB column is `packages.slug` and we backfilled it
// for existing rows on 2026-05-10. New / renamed packages also need
// to get a slug — see `slugifyPackage` and the dashboard packages
// route, which calls into here on insert and update.

export function slugifyPackage(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "package";
}
