import { mn } from "@/i18n/mn";
import { useAuth, MOCK_ALLOWED } from "@/lib/auth/AuthProvider";
import { MOCK_USERS } from "@/lib/auth/mockAuth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function SignIn() {
  const { signInWithGoogle, signInMock } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-[11px] font-bold text-accent-ink">
            DC
          </div>
          <div className="text-[16px] font-semibold">DocConformance</div>
        </div>
        <p className="mb-5 text-[12.5px] text-ink-2">
          {mn.auth.domainRestricted}
        </p>

        <button
          type="button"
          onClick={() => signInWithGoogle()}
          disabled={!isSupabaseConfigured}
          title={
            !isSupabaseConfigured
              ? "Supabase project тохируулагдаагүй тул идэвхгүй"
              : undefined
          }
          className="mb-4 w-full rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mn.auth.signInWithGoogle}
        </button>

        {MOCK_ALLOWED && (
          <div className="border-t border-line pt-4">
            <div className="mb-2 rounded-md border border-warn-soft bg-warn-soft px-2.5 py-1.5 text-[11px] font-medium text-warn">
              {mn.auth.mockModeLabel} — Supabase project тохируулаагүй тул
              идэвхжсэн.
            </div>
            <div className="flex flex-col gap-1.5">
              {MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => signInMock(u.id)}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-[12.5px] hover:border-ink-3"
                >
                  <span>
                    <span className="font-semibold">{u.name}</span>{" "}
                    <span className="text-ink-3">· {u.unit_id}</span>
                  </span>
                  <span className="text-ink-3">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
