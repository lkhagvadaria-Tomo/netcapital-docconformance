import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// `null` when this environment has no live Supabase project configured yet
// (this sandbox has none — see README "Known environment limitations").
// The auth layer (lib/auth) falls back to VITE_AUTH_MODE=mock when this is
// null, rather than crashing the app on missing env vars.
//
// Left un-annotated on purpose: let TS infer the exact instantiation
// `createClient<Database>` returns (schema defaults included) rather than
// re-declaring `SupabaseClient<Database>` ourselves — a second, looser
// annotation here made the client's table generics collapse to `never`
// (`.insert()`/`.update()` calls stopped type-checking) on this supabase-js
// version. If you need the type elsewhere, use `typeof supabase`.
const client = url && anonKey ? createClient<Database>(url, anonKey) : null;
export const supabase = client;

export const isSupabaseConfigured = supabase !== null;
