import { AppShell } from "@/components/AppShell";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <AppShell title={title}>
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-[13px] text-ink-3">
        {phase} — Build Phases (§11) дарааллаар ирнэ. Одоогоор Phase 1: Auth /
        Units / Users / Roles / RLS.
      </div>
    </AppShell>
  );
}
