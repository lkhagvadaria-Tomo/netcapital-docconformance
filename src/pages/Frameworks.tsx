import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { mn } from "@/i18n/mn";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isRuleSetReadyToApprove, isRuleSetUsableInAudit } from "@/lib/ruleSets";
import type {
  FrameworkDocument,
  FrameworkKind,
  Rule,
  RuleReviewStatus,
  RuleSet,
} from "@/types/database.types";

const EMPTY_FORM = { register_code: "", title: "", version: "", kind: "normative" as FrameworkKind, source_text: "" };

export function Frameworks() {
  const { profile, isMock } = useAuth();
  const [docs, setDocs] = useState<FrameworkDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const canManage = profile?.role === "unit_admin" || profile?.role === "enterprise_governance";
  const canReview =
    profile?.role === "reviewer" || profile?.role === "unit_admin" || profile?.role === "enterprise_governance";

  async function reloadDocs() {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("framework_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setDocs(data ?? []);
  }
  useEffect(() => {
    reloadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock]);

  async function reloadRuleSets(docId: string) {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("rule_sets")
      .select("*")
      .eq("framework_document_id", docId)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setRuleSets(data ?? []);
  }

  async function reloadRules(ruleSetId: string) {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("rules")
      .select("*")
      .eq("rule_set_id", ruleSetId)
      .order("code");
    if (err) setError(err.message);
    else setRules(data ?? []);
  }

  function selectDoc(id: string) {
    setSelectedDocId(id);
    setSelectedRuleSetId(null);
    setRules([]);
    reloadRuleSets(id);
  }
  function selectRuleSet(id: string) {
    setSelectedRuleSetId(id);
    reloadRules(id);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !profile) return;
    setError(null);
    const { error: err } = await supabase.from("framework_documents").insert({
      unit_id: profile.unit_id,
      register_code: form.register_code,
      title: form.title,
      version: form.version,
      kind: form.kind,
      source_text: form.source_text,
      created_by: profile.id,
    });
    if (err) setError(err.message);
    else {
      setForm(EMPTY_FORM);
      reloadDocs();
    }
  }

  async function handleExtract(doc: FrameworkDocument) {
    if (!supabase) return;
    setError(null);
    setExtracting(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("extract-rules", {
        body: { framework_document_id: doc.id },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      await reloadRuleSets(doc.id);
      if (data?.rule_set_id) selectRuleSet(data.rule_set_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  }

  async function setReviewStatus(rule: Rule, status: RuleReviewStatus) {
    if (!supabase || !profile) return;
    const { error: err } = await supabase
      .from("rules")
      .update({ review_status: status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq("id", rule.id);
    if (err) setError(err.message);
    else if (selectedRuleSetId) reloadRules(selectedRuleSetId);
  }

  async function approveRuleSet(ruleSet: RuleSet) {
    if (!supabase || !profile) return;
    const { error: err } = await supabase
      .from("rule_sets")
      .update({ status: "approved", approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq("id", ruleSet.id);
    if (err) setError(err.message);
    else if (selectedDocId) reloadRuleSets(selectedDocId);
  }

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null;
  const selectedRuleSet = ruleSets.find((rs) => rs.id === selectedRuleSetId) ?? null;
  const readyToApprove = isRuleSetReadyToApprove(rules);

  return (
    <AppShell title={mn.frameworks.title}>
      {error && (
        <div className="mb-4 rounded-lg border border-crit-soft bg-crit-soft px-3 py-2 text-[12px] text-crit">
          {error}
        </div>
      )}
      {isMock && (
        <div className="mb-4 rounded-lg border border-warn-soft bg-warn-soft px-3 py-2 text-[12px] text-warn">
          {mn.auth.mockModeLabel} — жагсаалт хоосон харагдана (Supabase холбогдоогүй).
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="table-wrap overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wide text-ink-3">
                  <th className="px-3 py-2">{mn.frameworks.registerCode}</th>
                  <th className="px-3 py-2">{mn.frameworks.version}</th>
                  <th className="px-3 py-2">{mn.frameworks.kind}</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => selectDoc(d.id)}
                    className={`cursor-pointer border-b border-line-soft last:border-0 hover:bg-surface-2 ${
                      selectedDocId === d.id ? "bg-accent-soft" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{d.register_code}</div>
                      <div className="text-ink-3">{d.title}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{d.version}</td>
                    <td className="px-3 py-2">{d.kind}</td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-ink-3">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canManage && (
            <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
              <div className="text-[12px] font-semibold text-ink-2">{mn.frameworks.registerNew}</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder={mn.frameworks.registerCode}
                  value={form.register_code}
                  onChange={(e) => setForm((s) => ({ ...s, register_code: e.target.value }))}
                  className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
                />
                <input
                  required
                  placeholder={mn.frameworks.version}
                  value={form.version}
                  onChange={(e) => setForm((s) => ({ ...s, version: e.target.value }))}
                  className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
                />
              </div>
              <input
                required
                placeholder={mn.frameworks.docTitle}
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
              />
              <select
                value={form.kind}
                onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as FrameworkKind }))}
                className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
              >
                <option value="normative">{mn.frameworks.kindNormative}</option>
                <option value="consuming">{mn.frameworks.kindConsuming}</option>
              </select>
              <textarea
                placeholder={mn.frameworks.sourceText}
                value={form.source_text}
                onChange={(e) => setForm((s) => ({ ...s, source_text: e.target.value }))}
                className="min-h-[100px] rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
              />
              <button type="submit" className="self-end rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink">
                {mn.frameworks.register}
              </button>
            </form>
          )}
        </div>

        <div>
          {!selectedDoc ? (
            <div className="empty rounded-xl border border-dashed border-line p-8 text-center text-[13px] text-ink-3">
              ←
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{selectedDoc.title}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {selectedDoc.register_code} · {selectedDoc.version} · {selectedDoc.kind}
                    </div>
                  </div>
                  {canReview &&
                    (selectedDoc.source_text ? (
                      <button
                        type="button"
                        onClick={() => handleExtract(selectedDoc)}
                        disabled={extracting}
                        className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink disabled:opacity-50"
                      >
                        {extracting ? mn.frameworks.extracting : mn.frameworks.extractRules}
                      </button>
                    ) : (
                      <span className="text-[11.5px] text-ink-3">{mn.frameworks.noSourceText}</span>
                    ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-ink-2">{mn.frameworks.ruleSets}</div>
                <div className="flex flex-wrap gap-2">
                  {ruleSets.map((rs) => (
                    <button
                      key={rs.id}
                      type="button"
                      onClick={() => selectRuleSet(rs.id)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${
                        selectedRuleSetId === rs.id ? "border-accent bg-accent-soft text-accent-strong" : "border-line"
                      }`}
                    >
                      {mn.frameworks.status[rs.status]} · {new Date(rs.created_at).toLocaleDateString("mn-MN")}
                    </button>
                  ))}
                  {ruleSets.length === 0 && <div className="text-[12px] text-ink-3">{mn.frameworks.noRuleSets}</div>}
                </div>
              </div>

              {selectedRuleSet && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold text-ink-2">{mn.frameworks.rulesTitle}</div>
                    {canReview && !isRuleSetUsableInAudit(selectedRuleSet) && (
                      <button
                        type="button"
                        onClick={() => approveRuleSet(selectedRuleSet)}
                        disabled={!readyToApprove}
                        title={!readyToApprove ? mn.frameworks.approveDisabledHint : undefined}
                        className="rounded-md bg-good px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {mn.frameworks.approveRuleSet}
                      </button>
                    )}
                    {isRuleSetUsableInAudit(selectedRuleSet) && (
                      <span className="rounded-full bg-good-soft px-2.5 py-1 text-[11px] font-semibold text-good">
                        {mn.frameworks.status.approved}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {rules.map((rule) => (
                      <RuleRow key={rule.id} rule={rule} canReview={canReview} onSetStatus={setReviewStatus} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function RuleRow({
  rule,
  canReview,
  onSetStatus,
}: {
  rule: Rule;
  canReview: boolean;
  onSetStatus: (rule: Rule, status: RuleReviewStatus) => void;
}) {
  // Full literal class strings on purpose — Tailwind's compiler only picks
  // up classes it can see as complete strings in source, so
  // `bg-${x}-soft` would silently emit no CSS at all for any value of x.
  const STATUS_BADGE_CLASSES: Record<RuleReviewStatus, string> = {
    accepted: "bg-good-soft text-good",
    edited: "bg-good-soft text-good",
    rejected: "bg-crit-soft text-crit",
    pending: "bg-warn-soft text-warn",
  };
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-ink-2">{rule.code}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10.5px]">{rule.type}</span>
            <span className="font-mono text-[10.5px] text-ink-3">{rule.citation}</span>
            {rule.blocking && (
              <span className="rounded-full bg-crit-soft px-2 py-0.5 text-[10px] font-semibold text-crit">
                {mn.frameworks.blocking}
              </span>
            )}
          </div>
          <div className="mt-1 text-[13px]">{rule.statement_mn}</div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${STATUS_BADGE_CLASSES[rule.review_status]}`}
        >
          {rule.review_status}
        </span>
      </div>
      {canReview && (
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => onSetStatus(rule, "accepted")}
            className="rounded-md border border-line px-2 py-1 text-[11px] font-medium hover:border-good hover:text-good"
          >
            {mn.frameworks.accept}
          </button>
          <button
            type="button"
            onClick={() => onSetStatus(rule, "edited")}
            className="rounded-md border border-line px-2 py-1 text-[11px] font-medium hover:border-accent hover:text-accent-strong"
          >
            {mn.frameworks.edit}
          </button>
          <button
            type="button"
            onClick={() => onSetStatus(rule, "rejected")}
            className="rounded-md border border-line px-2 py-1 text-[11px] font-medium hover:border-crit hover:text-crit"
          >
            {mn.frameworks.reject}
          </button>
        </div>
      )}
    </div>
  );
}
