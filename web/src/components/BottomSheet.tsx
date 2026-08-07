"use client";

import { useEffect, useState } from "react";

/**
 * Touch-friendly bottom sheet — the counter's replacement for centered modals.
 * Slides up from the bottom on phones, rises into a centered card on desktop.
 * Dim backdrop + Escape close, body scroll locked while open.
 */
export function BottomSheet({
  onClose,
  children,
  className = "",
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div
        className={
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 " +
          (shown ? "opacity-100" : "opacity-0")
        }
        onClick={onClose}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          "relative z-10 w-full max-h-[92vh] overflow-y-auto bg-white shadow-2xl sm:max-w-md " +
          "rounded-t-2xl border-t border-[#e4beba] sm:rounded-2xl sm:border " +
          "transition-transform duration-300 ease-out " +
          (shown ? "translate-y-0" : "translate-y-full") +
          " " +
          className
        }
      >
        <div className="sticky top-0 z-10 flex justify-center bg-white pt-2.5 pb-1.5">
          <span className="h-1.5 w-11 rounded-full bg-[#e4beba]" />
        </div>
        <div className="px-5 pb-6 pt-1 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
