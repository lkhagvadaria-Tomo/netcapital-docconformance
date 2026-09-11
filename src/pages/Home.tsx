import { AppShell } from "@/components/AppShell";
import { mn } from "@/i18n/mn";
import { useAuth } from "@/lib/auth/AuthProvider";

export function Home() {
  const { profile } = useAuth();
  return (
    <AppShell title={mn.home.title} subtitle={mn.home.subtitle}>
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-[13px] text-ink-3">
        {mn.home.placeholder}
      </div>
      {profile && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-[12.5px] text-ink-2">
          Нэвтэрсэн: <span className="font-semibold text-ink">{profile.name}</span>
          {" · "}
          Нэгж: <span className="font-mono">{profile.unit_id}</span>
          {" · "}
          Эрх: <span className="font-mono">{profile.role}</span>
        </div>
      )}
    </AppShell>
  );
}
