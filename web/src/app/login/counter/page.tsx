"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { counterLogin } from "@/app/admin/settings-actions";

const NUMPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export default function CounterPinLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function press(key: string) {
    setError(false);
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "") return;
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + key;
      if (next.length === 4) setTimeout(() => validatePin(next), 120);
      return next;
    });
  }

  // Physical keyboard / numpad support (type 1234 or Backspace).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") press("⌫");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validatePin(value: string) {
    const res = await counterLogin(value);
    if (res.ok && res.token) {
      // Signed token cookie, valid for 8 hours
      const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
      document.cookie = `counter_pin=${res.token}; path=/; expires=${expires}; SameSite=Strict`;
      router.push("/counter");
      router.refresh();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin("");
        setError(false);
      }, 700);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #1a1a1a 0%, #2d1a1a 50%, #1a1a1a 100%)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, #af101a 1px, transparent 1px), radial-gradient(circle at 75% 75%, #af101a 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Logo area */}
        <div className="mb-10 text-center">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl shadow-2xl"
            style={{ backgroundColor: "#af101a", boxShadow: "0 0 40px rgba(175,16,26,0.5)" }}
          >
            🍕
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Spice Pizza</h1>
          <p className="text-sm mt-1" style={{ color: "#8f6f6c" }}>Counter Terminal</p>
        </div>

        {/* PIN label */}
        <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#8f6f6c" }}>
          Enter Terminal PIN
        </p>

        {/* PIN dots */}
        <div
          className={`flex gap-4 mb-8 ${shake ? "animate-bounce" : ""}`}
          style={{ animation: shake ? "shake 0.4s ease-in-out" : undefined }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-all duration-150"
              style={{
                backgroundColor:
                  error
                    ? "#af101a"
                    : pin.length > i
                    ? "#ffffff"
                    : "rgba(255,255,255,0.15)",
                boxShadow: pin.length > i && !error ? "0 0 8px rgba(255,255,255,0.5)" : "none",
                transform: pin.length > i ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm font-bold mb-4" style={{ color: "#af101a" }}>
            Incorrect PIN. Try again.
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {NUMPAD.flat().map((key, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => press(key)}
              disabled={key === ""}
              className="h-16 rounded-2xl text-xl font-bold transition-all active:scale-90 disabled:opacity-0 select-none"
              style={{
                backgroundColor:
                  key === "⌫"
                    ? "rgba(175,16,26,0.25)"
                    : key === ""
                    ? "transparent"
                    : "rgba(255,255,255,0.07)",
                color: key === "⌫" ? "#af101a" : "#ffffff",
                border: key === "" ? "none" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: key === "" ? "none" : "0 2px 8px rgba(0,0,0,0.3)",
              }}
              onMouseDown={(e) => {
                if (key !== "") {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    key === "⌫" ? "rgba(175,16,26,0.45)" : "rgba(255,255,255,0.15)";
                }
              }}
              onMouseUp={(e) => {
                if (key !== "") {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    key === "⌫" ? "rgba(175,16,26,0.25)" : "rgba(255,255,255,0.07)";
                }
              }}
            >
              {key === "⌫" ? (
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                  backspace
                </span>
              ) : (
                key
              )}
            </button>
          ))}
        </div>

        <p className="text-[11px] mt-10" style={{ color: "rgba(255,255,255,0.2)" }}>
          Spice Pizza POS · Staff Access Only
        </p>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </main>
  );
}
