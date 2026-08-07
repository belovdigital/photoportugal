"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Notice rather than a question: one button, no cancel. */
  noticeOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, danger = false, noticeOnly = false, onConfirm, onCancel }: ConfirmModalProps) {
  const t = useTranslations("common");
  const confirmText = confirmLabel ?? t("confirm");
  const cancelText = cancelLabel ?? t("cancel");
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-in fade-in duration-150" onClick={onCancel}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {title ? <h3 className="text-base font-bold text-gray-900">{title}</h3> : null}
        <p className={`${title ? "mt-2" : ""} text-sm text-gray-700 leading-relaxed`}>{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {!noticeOnly && (
            <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">
              {cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage confirm modal state. Returns { modal, confirm }.
 * Usage:
 *   const { modal, confirm } = useConfirmModal();
 *   const ok = await confirm("Title", "Message");
 *   // Render: {modal}
 */
export function useConfirmModal(): {
  modal: ReactNode;
  confirm: (title: string, message: string, opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
  /** Same modal, one button. Replaces window.alert, which cannot be styled,
   *  cannot be translated by us, and on iOS names the domain in the heading. */
  notify: (message: string, title?: string) => Promise<boolean>;
} {
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const [state, setState] = useState<{ open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger: boolean; noticeOnly: boolean }>({ open: false, title: "", message: "", confirmLabel: undefined, cancelLabel: undefined, danger: false, noticeOnly: false });

  const confirm = useCallback((title: string, message: string, opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, title, message, confirmLabel: opts?.confirmLabel, cancelLabel: opts?.cancelLabel, danger: opts?.danger || false, noticeOnly: false });
    });
  }, []);

  const notify = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, title: title ?? "", message, confirmLabel: undefined, cancelLabel: undefined, danger: false, noticeOnly: true });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);

  const modal = (
    <ConfirmModal
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      noticeOnly={state.noticeOnly}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { modal, confirm, notify };
}
