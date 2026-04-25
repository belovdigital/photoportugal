import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";
import type { ComponentProps } from "react";

const nav = createNavigation(routing);

// next-intl strict-types Link.href and useRouter.push when pathnames define dynamic routes
// (e.g. /photographers/[slug]). Many existing call sites pass interpolated strings — loosen
// the types here so we don't have to migrate every call site to {pathname, params} object form.
// Runtime behaviour is identical; we only widen the TS types.
type AnyLinkProps = Omit<ComponentProps<typeof nav.Link>, "href"> & { href: string | object };
export const Link = nav.Link as unknown as React.ComponentType<AnyLinkProps>;
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
