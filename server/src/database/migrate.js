import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  console.log(`Running ${statements.length} SQL statements...`);

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: stmt });
      if (error && !error.message.includes("already exists")) {
        console.warn(`Warning: ${error.message}`);
      }
    } catch (err) {
      console.error(`Failed: ${stmt.substring(0, 50)}...`, err.message);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

runMigration().catch(console.error);