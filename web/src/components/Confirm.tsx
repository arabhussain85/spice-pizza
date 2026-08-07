"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

type Kind = "confirm" | "prompt" | "alert";

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // prompt-only
  inputLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}
interface DialogState extends DialogOptions {
  kind: Kind;
}

interface ConfirmApi {
  /** Yes/no dialog. Resolves true when confirmed. */
  confirm: (o: DialogOptions) => Promise<boolean>;
  /** Text-input dialog. Resolves the trimmed string, or null if cancelled. */
  prompt: (o: DialogOptions) => Promise<string | null>;
  /** Single-button acknowledgement. */
  notify: (o: DialogOptions) => Promise<void>;
}

const Ctx = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const open = useCallback((s: DialogState): Promise<unknown> => {
    setValue(s.defaultValue ?? "");
    setState(s);
    return new Promise((res) => {
      resolver.current = res;
    });
  }, []);

  const close = useCallback((result: unknown) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: (o) => open({ ...o, kind: "confirm" }) as Promise<boolean>,
      prompt: (o) => open({ ...o, kind: "prompt" }) as Promise<string | null>,
      notify: (o) => open({ ...o, kind: "alert" }) as Promise<void>,
    }),
    [open],
  );

  const dismiss = () => close(state?.kind === "prompt" ? null : state?.kind === "confirm" ? false : undefined);

  function accept() {
    if (!state) return;
    if (state.kind === "prompt") {
      if (state.required && !value.trim()) return;
      close(value.trim());
    } else if (state.kind === "confirm") {
      close(true);
    } else {
      close(undefined);
    }
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {state && (
        <BottomSheet onClose={dismiss}>
          <div className="flex items-start gap-3">
            <span
              className={
                "material-symbols-outlined mt-0.5 " + (state.danger ? "text-[#af101a]" : "text-[#605e5b]")
              }
              style={{ fontSize: "22px" }}
            >
              {state.danger ? "warning" : state.kind === "prompt" ? "edit_note" : "help"}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A]">{state.title}</h3>
              {state.message && (
                <p className="mt-1 whitespace-pre-line text-sm text-[#605e5b]">{state.message}</p>
              )}
            </div>
          </div>

          {state.kind === "prompt" && (
            <div className="mt-3">
              {state.inputLabel && (
                <label className="mb-1 block text-xs font-semibold text-[#605e5b]">{state.inputLabel}</label>
              )}
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") accept();
                }}
                className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-[#af101a]"
              />
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {state.kind !== "alert" && (
              <button
                onClick={dismiss}
                className="h-12 flex-1 rounded-xl border border-[#e4beba] text-sm font-semibold text-[#605e5b] transition-colors hover:bg-[#fff0ef]"
              >
                {state.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              autoFocus={state.kind !== "prompt"}
              onClick={accept}
              className="h-12 flex-1 rounded-xl bg-[#af101a] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#8b0d14]"
            >
              {state.confirmLabel ?? (state.kind === "alert" ? "OK" : state.danger ? "Delete" : "Confirm")}
            </button>
          </div>
        </BottomSheet>
      )}
    </Ctx.Provider>
  );
}
