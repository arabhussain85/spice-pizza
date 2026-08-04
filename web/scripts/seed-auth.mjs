// Seed Supabase Auth users (owner + counter) over HTTPS with the service role.
// Idempotent. Role is stored in app_metadata.role so the proxy can gate routes.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const users = [
  { email: "owner@spicepizza.local", password: "owner1234", role: "owner", name: "Bilal" },
  { email: "counter@spicepizza.local", password: "counter1234", role: "counter_staff", name: "AK" },
];

const { data: list, error: listErr } = await supa.auth.admin.listUsers();
if (listErr) throw listErr;

for (const u of users) {
  const existing = list.users.find((x) => x.email === u.email);
  const payload = {
    email: u.email,
    password: u.password,
    email_confirm: true,
    app_metadata: { role: u.role },
    user_metadata: { name: u.name },
  };
  if (existing) {
    const { error } = await supa.auth.admin.updateUserById(existing.id, payload);
    console.log(error ? `✗ ${u.email}: ${error.message}` : `updated ${u.email} (${u.role})`);
  } else {
    const { error } = await supa.auth.admin.createUser(payload);
    console.log(error ? `✗ ${u.email}: ${error.message}` : `created ${u.email} (${u.role})`);
  }
}
console.log("✓ Auth seed complete. Logins: owner@spicepizza.local / owner1234 · counter@spicepizza.local / counter1234");
