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

  // Generate srcset for responsive images (local uploads only)
  const srcSet = isLocalUpload(src)
    ? [400, 800, 1200]
        .filter((w) => w <= width * 2)
        .map((w) => `${getOptimizedSrc(src, w, quality)} ${w}w`)
        .join(", ")
    : undefined;

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
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        onClick={onClick}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={style}
      />

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-100">
          <svg className="h-8 w-8 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

/** Check if URL is a local upload */
function isLocalUpload(src: string): boolean {
  return src.startsWith("/uploads/");
}

/** Get optimized URL for any image source */
function getOptimizedSrc(src: string, width: number, quality: number): string {
  if (isLocalUpload(src)) {
    // Route through optimization API
    const path = src.replace("/uploads/", "");
    return `/api/img/${path}?w=${width}&q=${quality}&f=webp`;
  }
  // External URLs (Unsplash, etc.) — return as-is
  return src;
}

/**
 * Lightbox-optimized image — no skeleton, just loads full-res
 * Used in lightbox/slider where we want the original quality
 */
export function LightboxImage({
  src,
  alt,
  className = "",
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  // For lightbox, serve at max quality but still convert to WebP
  const optimizedSrc = isLocalUpload(src)
    ? `/api/img/${src.replace("/uploads/", "")}?w=2000&q=90&f=webp`
    : src;

  return (
    <>
      {!loaded && (
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onClick={onClick}
        className={`${className} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
