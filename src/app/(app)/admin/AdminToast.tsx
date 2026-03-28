"use client";

import { useState, useEffect, useCallback } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;

/** Dispatch from any component: window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message: "Done!", type: "success" } })) */
export function AdminToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent).detail;
      addToast(message, type);
    }
    window.addEventListener("admin-toast", handler);
    return () => window.removeEventListener("admin-toast", handler);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-in slide-in-from-bottom-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
            t.type === "success" ? "bg-green-600 text-white" :
            t.type === "error" ? "bg-red-600 text-white" :
            "bg-gray-800 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, type } }));
}
