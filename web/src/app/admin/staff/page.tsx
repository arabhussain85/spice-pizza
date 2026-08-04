"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Staff } from "@/lib/types";
import { Avatar, Button, Card, Pill, cn } from "@/components/ui";
import { setStaffActive, upsertStaff } from "../actions";

export default function StaffPage() {
  const supaRef = useRef(createClient());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supaRef.current.from("staff").select("*").order("role").order("name");
      if (error) throw error;
      setStaff((data ?? []) as Staff[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff</h1>
        <Button variant="soft" onClick={() => setEditing({ role: "counter_staff" })}>
          + Add
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {staff.map((s) => (
          <Card key={s.id} className="flex items-center gap-3 p-3">
            <Avatar name={s.name} />
            <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(s)}>
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-muted">{s.email ?? "no email"}</div>
            </button>
            <Pill tone={s.role === "owner" ? "red" : "neutral"}>{s.role === "owner" ? "Owner" : "Counter"}</Pill>
            <button
              onClick={async () => {
                await setStaffActive(s.id, !s.is_active);
                await load();
              }}
              className={cn("text-xs font-medium", s.is_active ? "text-free-dark" : "text-muted")}
            >
              {s.is_active ? "Active" : "Off"}
            </button>
          </Card>
        ))}
      </div>

      {editing && <StaffSheet staff={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function StaffSheet({ staff, onClose, onSaved }: { staff: Partial<Staff>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(staff.name ?? "");
  const [email, setEmail] = useState(staff.email ?? "");
  const [role, setRole] = useState<"owner" | "counter_staff">(staff.role ?? "counter_staff");
  const [pin, setPin] = useState(staff.pin ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
        <h3 className="text-lg font-bold">{staff.id ? "Edit staff" : "Add staff"}</h3>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="mt-4 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (for login)" className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50" />

        <div className="mt-3 flex gap-2">
          {(["counter_staff", "owner"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-medium", role === r ? "border-brand bg-brand text-white" : "border-hairline")}
            >
              {r === "owner" ? "Owner" : "Counter staff"}
            </button>
          ))}
        </div>

        {role === "owner" && (
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Owner PIN (for discounts)" className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50" />
        )}

        {err && <p className="mt-2 text-sm text-brand">{err}</p>}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await upsertStaff({ id: staff.id, name: name.trim(), role, email: email.trim() || null, pin: role === "owner" ? pin || null : null });
                await onSaved();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
