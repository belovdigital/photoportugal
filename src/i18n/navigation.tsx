import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";
import { resolveHref } from "./resolve-href";
import type { ComponentProps } from "react";

const nav = createNavigation(routing);

export { resolveHref };

// next-intl strict-types Link.href when pathnames define dynamic routes. Call
// sites pass interpolated strings, so the prop type stays wide — but the href
// now goes through resolveHref, which is what makes a concrete dynamic path
// translate instead of quietly falling through to a redirect. See the note in
// ./resolve-href.
type AnyLinkProps = Omit<ComponentProps<typeof nav.Link>, "href"> & { href: string | object };
const IntlLink = nav.Link as unknown as React.ComponentType<AnyLinkProps>;

export function Link({ href, ...props }: AnyLinkProps) {
  return <IntlLink href={resolveHref(href)} {...props} />;
}

export const redirect = nav.redirect as unknown as (href: string | object, type?: number) => never;
export const usePathname = nav.usePathname as unknown as () => string;
export const useRouter = nav.useRouter as unknown as () => {
  push: (href: string | object, options?: object) => void;
  replace: (href: string | object, options?: object) => void;
  prefetch: (href: string | object, options?: object) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

// Server-safe: builds the locale's own path ("/de/orte" for "/locations" on de)
// from the same pathnames table Link uses. Normalised through resolveHref for
// the same reason — breadcrumb and JSON-LD URLs are built with this, and they
// have to agree with the visible links.
const intlGetPathname = nav.getPathname as unknown as (args: { href: string | object; locale: string }) => string;
export function getPathname(args: { href: string | object; locale: string }): string {
  return intlGetPathname({ href: resolveHref(args.href), locale: args.locale });
}
