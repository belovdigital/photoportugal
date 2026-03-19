"use client";

import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface AvatarProps {
  src: string | null | undefined;
  alt?: string;
  fallback: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: { container: "h-7 w-7", text: "text-[10px]", imgWidth: 200 },
  sm: { container: "h-8 w-8", text: "text-xs", imgWidth: 200 },
  md: { container: "h-10 w-10", text: "text-sm", imgWidth: 200 },
  lg: { container: "h-16 w-16", text: "text-2xl", imgWidth: 200 },
} as const;

export function Avatar({ src, alt = "", fallback, size = "md", className = "" }: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex ${s.container} items-center justify-center overflow-hidden rounded-full bg-primary-100 ${s.text} font-bold text-primary-600 ${className}`}>
      {src ? (
        <OptimizedImage src={src} alt={alt} width={s.imgWidth} className="h-full w-full" />
      ) : (
        fallback.charAt(0)
      )}
    </div>
  );
}
