// Shared across every Edge Function. Supabase's browser client always
// sends a preflight for functions.invoke() calls that carry a JSON body.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
