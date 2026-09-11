import { config } from "dotenv";
import path from "node:path";

// Loads .env.local (if present) for Node/vitest so
// tests/phase1-rls.test.ts can find SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY the same way the app finds its VITE_-prefixed
// equivalents. Silently does nothing if the file doesn't exist (fine — the
// live-project test is designed to skip cleanly without it).
config({ path: path.resolve(process.cwd(), ".env.local") });
