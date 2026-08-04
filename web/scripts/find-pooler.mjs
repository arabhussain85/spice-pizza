// Detect which Supavisor pooler region hosts this Supabase project.
// Tries session-mode (5432) across candidate regions with user postgres.<ref>.
import postgres from "postgres";

const REF = "lzoqyoasljfvyiqcjkgc";
const PASSWORD = process.env.SUPABASE_DB_PASSWORD || "spicypizza@123";
const regions = [
  "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-north-1",
  "us-east-1", "us-east-2", "us-west-1",
];
const prefixes = ["aws-0", "aws-1"];
const port = 5432; // session mode (safe for DDL)

for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const sql = postgres({
      host, port, user: `postgres.${REF}`, password: PASSWORD,
      database: "postgres", ssl: "require", max: 1, prepare: false,
      connect_timeout: 8, idle_timeout: 2, max_lifetime: 5,
    });
    try {
      const r = await sql`select current_database() as db, version() as v`;
      console.log(`MATCH host=${host} port=${port} db=${r[0].db}`);
      await sql.end({ timeout: 2 });
      process.exit(0);
    } catch (e) {
      const msg = String(e.message || e).split("\n")[0];
      console.log(`  no  ${host}: ${msg}`);
      try { await sql.end({ timeout: 1 }); } catch {}
    }
  }
}
console.log("NO_MATCH");
process.exit(1);
