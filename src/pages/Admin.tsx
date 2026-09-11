import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { mn } from "@/i18n/mn";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { AppUser, Unit, UserRole } from "@/types/database.types";

const ROLES: UserRole[] = [
  "author",
  "reviewer",
  "approver",
  "unit_admin",
  "enterprise_governance",
];

export function Admin() {
  const { profile, isMock } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState({ code: "", name_mn: "", name_en: "" });

  const canManageUnits = profile?.role === "enterprise_governance";
  const canManageUsers =
    profile?.role === "enterprise_governance" || profile?.role === "unit_admin";

  async function reload() {
    if (!supabase) return;
    const [unitsRes, usersRes] = await Promise.all([
      supabase.from("units").select("*").order("code"),
      supabase.from("users").select("*").order("name"),
    ]);
    if (unitsRes.error) setError(unitsRes.error.message);
    else setUnits(unitsRes.data ?? []);
    if (usersRes.error) setError(usersRes.error.message);
    else setUsers(usersRes.data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock]);

  async function handleAddUnit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const { error: insertError } = await supabase.from("units").insert(newUnit);
    if (insertError) setError(insertError.message);
    else {
      setNewUnit({ code: "", name_mn: "", name_en: "" });
      reload();
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("users")
      .update({ role })
      .eq("id", userId);
    if (updateError) setError(updateError.message);
    else reload();
  }

  return (
    <AppShell title={mn.admin.title}>
      {isMock && (
        <div className="mb-4 rounded-lg border border-warn-soft bg-warn-soft px-3 py-2 text-[12px] text-warn">
          {mn.auth.mockModeLabel} — энэ горимд бичих үйлдэл дэлгэцэд л
          харагдана, Supabase рүү хадгалагдахгүй.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-crit-soft bg-crit-soft px-3 py-2 text-[12px] text-crit">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
        {mn.admin.unassignedNotice}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold">{mn.admin.units}</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2">{mn.admin.code}</th>
                <th className="px-3 py-2">{mn.admin.nameMn}</th>
                <th className="px-3 py-2">{mn.admin.nameEn}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2 font-mono">{u.code}</td>
                  <td className="px-3 py-2">{u.name_mn}</td>
                  <td className="px-3 py-2 text-ink-2">{u.name_en}</td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-ink-3">
                    Нэгж алга.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManageUnits && (
          <form
            onSubmit={handleAddUnit}
            className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <input
              required
              placeholder={mn.admin.code}
              value={newUnit.code}
              onChange={(e) => setNewUnit((s) => ({ ...s, code: e.target.value }))}
              className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
            />
            <input
              required
              placeholder={mn.admin.nameMn}
              value={newUnit.name_mn}
              onChange={(e) => setNewUnit((s) => ({ ...s, name_mn: e.target.value }))}
              className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
            />
            <input
              required
              placeholder={mn.admin.nameEn}
              value={newUnit.name_en}
              onChange={(e) => setNewUnit((s) => ({ ...s, name_en: e.target.value }))}
              className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
            />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink"
            >
              {mn.admin.addUnit}
            </button>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-[15px] font-semibold">{mn.admin.users}</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2">{mn.admin.email}</th>
                <th className="px-3 py-2">{mn.admin.unit}</th>
                <th className="px-3 py-2">{mn.admin.role}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-ink-3">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">{u.unit_id}</td>
                  <td className="px-3 py-2">
                    {canManageUsers ? (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value as UserRole)
                        }
                        className="rounded-md border border-line px-2 py-1 text-[12px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      u.role
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-ink-3">
                    RLS-ийн хамрах хүрээнд харагдах хэрэглэгч алга (өөрийн
                    нэгжийн бус хэрэглэгчид харагдахгүй нь зорилтот зан үйл).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
