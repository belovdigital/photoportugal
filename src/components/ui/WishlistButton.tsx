"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";

// Global wishlist cache so all buttons stay in sync
let wishlistCache: Set<string> = new Set();
let cacheLoaded = false;
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function useWishlist() {
  const { data: session } = useSession();
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // Load wishlist on first mount when logged in
  useEffect(() => {
    if (!session?.user || cacheLoaded) return;
    fetch("/api/wishlist?check=all")
      .then((r) => r.json())
      .then((ids: string[]) => {
        wishlistCache = new Set(ids);
        cacheLoaded = true;
        notifyListeners();
      })
      .catch(() => {});
  }, [session]);

  const isWishlisted = useCallback((id: string) => wishlistCache.has(id), []);

  const toggle = useCallback(async (photographerId: string) => {
    const was = wishlistCache.has(photographerId);
    // Optimistic update
    if (was) wishlistCache.delete(photographerId);
    else wishlistCache.add(photographerId);
    notifyListeners();

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photographer_id: photographerId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      if (was) wishlistCache.add(photographerId);
      else wishlistCache.delete(photographerId);
      notifyListeners();
    }
  }, []);

  return { isWishlisted, toggle, isLoggedIn: !!session?.user };
}

export function WishlistButton({
  photographerId,
  size = "md",
  className = "",
  onToggle,
}: {
  photographerId: string;
  size?: "sm" | "md";
  className?: string;
  onToggle?: (wishlisted: boolean) => void;
}) {
  const { isWishlisted, toggle, isLoggedIn } = useWishlist();
  const router = useRouter();
  const active = isWishlisted(photographerId);
  const sz = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSz = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  const [animating, setAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push("/auth/signin");
      return;
    }
    const willBeActive = !active;
    toggle(photographerId);
    onToggle?.(willBeActive);

    // Animate heart flying up on add
    if (willBeActive) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`relative flex ${sz} items-center justify-center rounded-full transition ${
        active
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-400 hover:bg-white hover:text-red-400"
      } backdrop-blur-sm ${className}`}
      title={active ? "Remove from wishlist" : "Save to wishlist"}
    >
      <svg
        className={`${iconSz} transition-transform duration-300 ${active ? "scale-110" : ""}`}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {animating && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg className="h-4 w-4 text-red-500 animate-wishlist-fly" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </span>
      )}
    </button>
  );
}
