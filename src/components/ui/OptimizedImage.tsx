"use client";

import { useState, useRef, useEffect } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  sizes?: string;
}

/**
 * Optimized image component for local uploads.
 * - Routes local /uploads/* through /api/img/ for Sharp resize + WebP
 * - Unsplash URLs pass through (already optimized by Unsplash CDN)
 * - Skeleton placeholder with fade-in on load
 * - Lazy loading by default (priority=true disables it)
 */
export function OptimizedImage({
  src,
  alt,
  width = 800,
  quality = 80,
  className = "",
  style,
  priority = false,
  onClick,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If already loaded (cached), skip animation
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const optimizedSrc = getOptimizedSrc(src, width, quality);

  // No srcset — we serve the R2 original (already capped at 2000px wide,
  // q=85 JPEG) and let Cloudflare's edge cache do the heavy lifting. The
  // Image Transformations layer added latency on cold cache without a clear
  // win for our use case, and made debugging harder.
  const srcSet: string | undefined = undefined;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Skeleton placeholder */}
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-warm-200" />
      )}

      <img
        ref={imgRef}
        src={optimizedSrc}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        onClick={onClick}
        // The fade-in transition (opacity-0 → 100 on load) made images
        // invisible whenever hydration was delayed or didn't fire — SSR
        // ships opacity-0, JS never flips, image stays hidden. The
        // skeleton placeholder already handles the loading state cleanly,
        // so we render the image at full opacity from the start.
        className="h-full w-full object-cover"
        style={style}
      />

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-100">
          <svg className="h-8 w-8 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

/** R2 public hostname — where all user-uploaded media lives after migration. */
const R2_HOST = "files.photoportugal.com";

/** Legacy local-upload prefix. Still recognised so any straggler `/uploads/...`
 *  rows that slipped past the migration keep working via the old image proxy. */
function isLocalUpload(src: string): boolean {
  return src.startsWith("/uploads/");
}

/**
 * Resolve the image source to whatever URL the browser should actually fetch.
 *
 * Strategy: pass R2 URLs through unchanged. They're already capped at 2000px
 * wide JPEG q=85 at upload time, and Cloudflare's normal CDN caches them
 * globally for free. We tried Cloudflare Image Transformations (`/cdn-cgi/image/`)
 * for on-the-fly AVIF + resize; the win on bytes was real but cold-cache MISS
 * latency made first-time-viewer experience worse, so we rolled it back.
 *
 * Legacy `/uploads/...` rows (rare after the R2 migration) still route through
 * the local `/api/img/` Sharp proxy — disk-cached on the server.
 */
function getOptimizedSrc(src: string, width: number, quality: number): string {
  if (src.startsWith(`https://${R2_HOST}/`)) return src;
  if (isLocalUpload(src)) {
    const path = src.replace("/uploads/", "");
    return `/api/img/${path}?w=${width}&q=${quality}&f=webp`;
  }
  return src;
}

/**
 * Lightbox image — shows thumbnail instantly, loads full-res in background
 */
export function LightboxImage({
  src,
  thumbnailSrc,
  alt,
  className = "",
  onClick,
}: {
  src: string;
  thumbnailSrc?: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [hiResLoaded, setHiResLoaded] = useState(false);

  // Thumbnail: slightly larger than grid thumbnail for instant sharp preview
  const thumbUrl = thumbnailSrc
    ? getOptimizedSrc(thumbnailSrc, 800, 80)
    : getOptimizedSrc(src, 800, 80);

  // High-res: max viewport size, good quality but not oversized
  const hiResSrc = getOptimizedSrc(src, 1400, 85);

  return (
    <div className="relative flex items-center justify-center" onClick={onClick}>
      {/* Thumbnail shown instantly */}
      <img
        src={thumbUrl}
        alt={alt}
        className={`${className} ${hiResLoaded ? "hidden" : ""}`}
      />
      {/* Hi-res loads in background, replaces thumbnail when ready */}
      <img
        src={hiResSrc}
        alt={alt}
        onLoad={() => setHiResLoaded(true)}
        className={`${className} transition-opacity duration-300 ${hiResLoaded ? "opacity-100" : "absolute inset-0 m-auto opacity-0"}`}
      />
    </div>
  );
}
