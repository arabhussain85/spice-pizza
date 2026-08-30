"use client";

import Link from "next/link";

export default function LoginRoleSelectorPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #fff8f7 0%, #FCF9F5 50%, #ffe9e7 100%)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-[#ffe9e7] opacity-60" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#ffdad6] opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/spice-logo.png" alt="Bites Pizza" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Bites Pizza
          </h1>
          <p className="text-sm mt-1" style={{ color: "#605e5b" }}>
            Order Management &amp; POS System
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="space-y-4">
          <p
            className="text-xs font-bold uppercase tracking-widest text-center mb-5"
            style={{ color: "#8f6f6c" }}
          >
            Select your access portal
          </p>

          {/* Admin Portal */}
          <Link href="/login/admin">
            <div
              className="group relative overflow-hidden rounded-2xl border-2 border-[#af101a]/20 bg-white p-6 shadow-sm hover:shadow-lg hover:border-[#af101a]/60 transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: "#ffffff" }}
            >
              {/* Accent line */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#af101a] rounded-l-2xl" />

              <div className="flex items-center gap-4 pl-4">
                <div className="w-14 h-14 rounded-2xl bg-[#ffe9e7] flex items-center justify-center shrink-0 group-hover:bg-[#ffdad6] transition-colors">
                  <span
                    className="material-symbols-outlined text-[#af101a]"
                    style={{ fontSize: "28px", fontVariationSettings: "'FILL' 1" }}
                  >
                    admin_panel_settings
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-black text-lg text-[#1A1A1A]">Admin Panel</div>
                  <div className="text-sm text-[#605e5b] mt-0.5">
                    Revenue, reports, menu &amp; settings
                  </div>
                  <div className="text-xs font-semibold text-[#af101a] mt-1.5 flex items-center gap-1">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "14px" }}
                    >
                      lock
                    </span>
                    Owner credentials required
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-[#af101a] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ fontSize: "20px" }}
                >
                  arrow_forward_ios
                </span>
              </div>
            </div>
          </Link>

          {/* Counter Staff Portal */}
          <Link href="/login/counter">
            <div
              className="group relative overflow-hidden rounded-2xl border-2 border-[#2E7D32]/20 bg-white p-6 shadow-sm hover:shadow-lg hover:border-[#2E7D32]/60 transition-all duration-200 cursor-pointer"
            >
              {/* Accent line */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2E7D32] rounded-l-2xl" />

              <div className="flex items-center gap-4 pl-4">
                <div className="w-14 h-14 rounded-2xl bg-[#e8f5e9] flex items-center justify-center shrink-0 group-hover:bg-[#c8e6c9] transition-colors">
                  <span
                    className="material-symbols-outlined text-[#2E7D32]"
                    style={{ fontSize: "28px", fontVariationSettings: "'FILL' 1" }}
                  >
                    point_of_sale
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-black text-lg text-[#1A1A1A]">Counter Terminal</div>
                  <div className="text-sm text-[#605e5b] mt-0.5">
                    Take orders, manage tables &amp; billing
                  </div>
                  <div className="text-xs font-semibold text-[#2E7D32] mt-1.5 flex items-center gap-1">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "14px" }}
                    >
                      pin
                    </span>
                    PIN access · Staff only
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-[#2E7D32] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ fontSize: "20px" }}
                >
                  arrow_forward_ios
                </span>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-[11px] mt-8" style={{ color: "#8f6f6c" }}>
          Bites Pizza POS System · Main Branch
        </p>
      </div>
    </main>
  );
}
