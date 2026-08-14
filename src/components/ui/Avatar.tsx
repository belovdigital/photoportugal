"use client";

import { r2ImgProps } from "@/lib/image-variants";
import { country } from "@/lib/country";

interface AvatarProps {
  src: string | null | undefined;
  alt?: string;
  fallback: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

// `sizes` per rendered size, so the browser asks for the rung that fits the
// circle rather than the 800x800 original. At 3x a 64px circle wants 192px,
// which lands on the 400 rung; the smaller ones land on 160.
const sizeMap = {
  xs: { container: "h-7 w-7", text: "text-[10px]", imgWidth: 200, sizes: "28px" },
  sm: { container: "h-8 w-8", text: "text-xs", imgWidth: 200, sizes: "32px" },
  md: { container: "h-10 w-10", text: "text-sm", imgWidth: 200, sizes: "40px" },
  lg: { container: "h-16 w-16", text: "text-2xl", imgWidth: 200, sizes: "64px" },
} as const;

export function Avatar({ src, alt = "", fallback, size = "md", className = "" }: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex ${s.container} items-center justify-center overflow-hidden rounded-full bg-primary-100 ${s.text} font-bold text-primary-600 ${className}`}>
      {src ? (
        // A plain <img> rather than OptimizedImage: at this size the skeleton
        // and fade are pointless, and r2ImgProps carries both the ladder and
        // the fallback guard. An 800x800 avatar was 130 kB for a circle a
        // fingernail wide — five of them on the Portugal homepage.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          {...r2ImgProps(src, country.filesHost, s.sizes)}
        />
      ) : (
        fallback.charAt(0)
      )}
    </div>
  );
}
