"use client";

import { useMemo, useState } from "react";
import {
  complianceControls,
  evaluateCompliance,
  getBlockingComplianceResults,
  getClauseForControl,
  legalClauses,
  retrieveLegalKnowledge,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/compliance";
import type { AuditEvent, DemoState } from "@/lib/types";
import { LegalAssistantExperience } from "./legal-assistant-ui";

type SetDemoState = React.Dispatch<React.SetStateAction<DemoState>>;

const statusCopy: Record<
  ComplianceStatus,
  { ar: string; en: string; icon: string }
> = {
  pass: { ar: "ممتثل", en: "Pass", icon: "✓" },
  violation: { ar: "مخالفة", en: "Violation", icon: "!" },
  needs_review: { ar: "يتطلب مراجعة", en: "Needs review", icon: "◇" },
  not_applicable: { ar: "غير منطبق", en: "Not applicable", icon: "—" },
};

function CompliancePill({
  status,
  ar,
}: {
  status: ComplianceStatus;
  ar: boolean;
}) {
  const copy = statusCopy[status];
  return (
    <span className={`compliance-pill compliance-${status}`}>
      <i>{copy.icon}</i>
      {ar ? copy.ar : copy.en}
    </span>
  );
}

function CitationTags({ result }: { result: ComplianceResult }) {
  return (
    <div className="legal-citations">
      {getClauseForControl(result.control).map((clause) => (
        <span key={clause.id}>
          {clause.article} · {clause.sourcePages}
        </span>
      ))}
    </div>
  );
}

export function CaseCompliancePanel({
  state,
  setState,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: SetDemoState;
  toast: (message: string) => void;
  addAudit: (
    ar: string,
    en: string,
    source?: AuditEvent["source"],
  ) => void;
}) {
  const ar = state.language === "ar";
  const [filter, setFilter] = useState<ComplianceStatus | "all">("all");
  const [selectedId, setSelectedId] = useState("CTL-EXCLUSION-BAATH");
  const [note, setNote] = useState("");
  const results = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: state.complianceResolvedControlIds,
  });
  const blocking = getBlockingComplianceResults(results);
  const visible =
    filter === "all"
      ? results
      : results.filter((result) => result.status === filter);
  const selected =
    results.find((result) => result.control.id === selectedId) ?? results[0];
  const counts = (status: ComplianceStatus) =>
    results.filter((result) => result.status === status).length;

  const resolveSelected = () => {
    if (selected.status !== "needs_review" || note.trim().length < 8) return;
    setState((previous) => ({
      ...previous,
      complianceResolvedControlIds: Array.from(
        new Set([
          ...previous.complianceResolvedControlIds,
          selected.control.id,
        ]),
      ),
    }));
    addAudit(
      `توثيق معالجة الضابط ${selected.control.id}: ${note.trim()}`,
      `Documented compliance treatment for ${selected.control.id}: ${note.trim()}`,
      "staff",
    );
    setNote("");
    toast(ar ? "تم توثيق المراجعة وإعادة التقييم" : "Review documented and evaluation rerun");
  };

  return (
    <section className="case-compliance">
      <header className="compliance-case-hero">
        <div>
          <span className="eyebrow">
            {ar ? "بوابة ما قبل الإحالة" : "PRE-REFERRAL GATE"}
          </span>
          <h2>
            {ar ? "امتثال الحالة — تقييم حتمي مفسّر" : "Case compliance — deterministic and explained"}
          </h2>
          <p>
            {ar
              ? "كل نتيجة تعرض الدليل والنسخة والمادة. المساعد لا يصدر قراراً، والموظف يوثق المعالجة."
              : "Every result exposes evidence, version and article. The assistant does not decide; staff documents treatment."}
          </p>
        </div>
        <div className={blocking.length ? "compliance-gate blocked" : "compliance-gate clear"}>
          <span>{blocking.length ? "!" : "✓"}</span>
          <div>
            <strong>
              {blocking.length
                ? ar
                  ? `${blocking.length} ضابط حاجب`
                  : `${blocking.length} blocking controls`
                : ar
                  ? "بوابة الإحالة جاهزة"
                  : "Referral gate is clear"}
            </strong>
            <small>
              {ar
                ? "لن يتم تغيير الحالة قبل إغلاق العناصر الحاجبة."
                : "The case will not advance while blocking items remain."}
            </small>
          </div>
        </div>
      </header>

      <div className="compliance-summary">
        {(["pass", "needs_review", "violation", "not_applicable"] as const).map(
          (status) => (
            <button
              key={status}
              className={filter === status ? "active" : ""}
              onClick={() => setFilter(filter === status ? "all" : status)}
            >
              <CompliancePill status={status} ar={ar} />
              <strong>{counts(status)}</strong>
              <small>{ar ? "من 18 ضابطاً" : "of 18 controls"}</small>
            </button>
          ),
        )}
      </div>

      <div className="compliance-workbench">
        <div className="compliance-control-list">
          <header>
            <strong>{ar ? "نتائج الضوابط" : "Control results"}</strong>
            <button onClick={() => setFilter("all")}>
              {ar ? "إظهار الكل" : "Show all"}
            </button>
          </header>
          {visible.map((result) => (
            <button
              key={result.control.id}
              className={selected.control.id === result.control.id ? "active" : ""}
              onClick={() => {
                setSelectedId(result.control.id);
                setNote("");
              }}
            >
              <CompliancePill status={result.status} ar={ar} />
              <span>
                <b>{ar ? result.control.nameAr : result.control.nameEn}</b>
                <small>
                  {result.control.id} ·{" "}
                  {result.control.severity === "blocking"
                    ? ar
                      ? "حاجب"
                      : "Blocking"
                    : ar
                      ? "إرشادي"
                      : "Advisory"}
                </small>
              </span>
              <i>←</i>
            </button>
          ))}
        </div>

        <article className="compliance-detail">
          <header>
            <div>
              <span className="eyebrow">{selected.control.id}</span>
              <h3>
                {ar ? selected.control.nameAr : selected.control.nameEn}
              </h3>
            </div>
            <CompliancePill status={selected.status} ar={ar} />
          </header>
          <p className="control-description">
            {ar
              ? selected.control.descriptionAr
              : selected.control.descriptionEn}
          </p>
          <div className="compliance-evidence">
            <div>
              <span>{ar ? "الدليل المستخدم" : "Evidence used"}</span>
              <strong>{ar ? selected.evidenceAr : selected.evidenceEn}</strong>
            </div>
            <div>
              <span>{ar ? "تفسير النتيجة" : "Result explanation"}</span>
              <strong>
                {ar ? selected.explanationAr : selected.explanationEn}
              </strong>
            </div>
            <div>
              <span>{ar ? "نسخة الضابط" : "Control version"}</span>
              <strong dir="ltr">{selected.control.version}</strong>
            </div>
          </div>
          <CitationTags result={selected} />

          {selected.status === "needs_review" && (
            <div className="remediation-box">
              <span className="eyebrow">
                {ar ? "معالجة بشرية موثقة" : "DOCUMENTED HUMAN TREATMENT"}
              </span>
              <label>
                <span>
                  {ar ? "ملاحظة المراجعة *" : "Review note *"}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    ar
                      ? "اكتب ما راجعته والمصدر الذي اعتمدت عليه…"
                      : "Record what you reviewed and the source used…"
                  }
                />
              </label>
              <button
                className="button button-primary"
                disabled={note.trim().length < 8}
                onClick={resolveSelected}
              >
                ✓ {ar ? "توثيق المعالجة وإعادة التقييم" : "Document treatment and rerun"}
              </button>
            </div>
          )}

          {selected.status === "pass" && selected.resolved && (
            <div className="resolved-banner">
              ✓{" "}
              {ar
                ? "أغلق الموظف هذا العنصر بمراجعة موثقة في سجل الحالة."
                : "Staff closed this item with a review recorded in the case audit."}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

type ComplianceDashboardTab =
  | "overview"
  | "controls"
  | "knowledge"
  | "quotas"
  | "sla"
  | "reports"
  | "versions";

export function ComplianceDashboard({
  state,
  navigate,
  toast,
}: {
  state: DemoState;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const [tab, setTab] = useState<ComplianceDashboardTab>("overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedControlId, setSelectedControlId] = useState(
    "CTL-EXCLUSION-BAATH",
  );
  const results = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: state.complianceResolvedControlIds,
  });
  const blocking = getBlockingComplianceResults(results);
  const selectedResult =
    results.find((result) => result.control.id === selectedControlId) ??
    results[0];
  const filteredControls = results.filter(
    (result) =>
      (category === "all" || result.control.category === category) &&
      [
        result.control.id,
        result.control.nameAr,
        result.control.nameEn,
        result.control.descriptionAr,
        result.control.descriptionEn,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const clauses = useMemo(() => retrieveLegalKnowledge(query), [query]);
  const passCount = results.filter((result) => result.status === "pass").length;

  return (
    <div className="page compliance-dashboard-page">
      <header className="compliance-dashboard-header">
        <div>
          <span className="eyebrow">
            {ar ? "مركز الامتثال واللوائح" : "COMPLIANCE & REGULATIONS CENTER"}
          </span>
          <h1>
            {ar
              ? "ضوابط قابلة للتتبع من المادة إلى المعاملة."
              : "Traceable controls from legal article to case."}
          </h1>
          <p>
            {ar
              ? "مؤشرات إثبات مفهوم مبنية على القانون المرفق، مع نتائج مفسرة ومراجعة بشرية إلزامية."
              : "POC indicators based on the supplied law, with explained results and mandatory human review."}
          </p>
        </div>
        <div className="compliance-version">
          <span>MF-LAW-2016.2</span>
          <strong>{ar ? "نسخة العمل الحالية" : "Current working version"}</strong>
          <small>{ar ? "محاكاة · ليست فتوى أو قراراً" : "Simulation · not legal advice or a decision"}</small>
        </div>
      </header>

      <div className="compliance-dashboard-tabs">
        {[
          ["overview", "نظرة عامة", "Overview"],
          ["controls", "كتالوج الضوابط", "Controls"],
          ["knowledge", "المعرفة القانونية", "Legal knowledge"],
          ["quotas", "الحصص", "Quotas"],
          ["sla", "المدد", "SLA"],
          ["reports", "التقارير", "Reports"],
          ["versions", "النسخ والأثر", "Versions"],
        ].map(([id, arLabel, enLabel]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id as ComplianceDashboardTab)}
          >
            {ar ? arLabel : enLabel}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="compliance-kpis">
            <article>
              <span>✓</span>
              <small>{ar ? "ضوابط مجتازة" : "Passed controls"}</small>
              <strong>{passCount}/18</strong>
              <em>{ar ? "لهذه الحالة" : "for this case"}</em>
            </article>
            <article className={blocking.length ? "attention" : ""}>
              <span>◇</span>
              <small>{ar ? "عناصر حاجبة" : "Blocking items"}</small>
              <strong>{blocking.length}</strong>
              <em>{ar ? "قبل الإحالة أو القرار" : "before referral or decision"}</em>
            </article>
            <article>
              <span>◷</span>
              <small>{ar ? "امتثال المدة" : "SLA compliance"}</small>
              <strong>94.6%</strong>
              <em>+2.1 pp</em>
            </article>
            <article>
              <span>▥</span>
              <small>{ar ? "الحصة التعليمية" : "Education quota"}</small>
              <strong>12.4%</strong>
              <em>{ar ? "فوق حد 10%" : "above 10% minimum"}</em>
            </article>
          </div>
          <div className="compliance-overview-grid">
            <article className="compliance-panel">
              <header>
                <div>
                  <span className="eyebrow">
                    {ar ? "الحالة النشطة" : "ACTIVE CASE"}
                  </span>
                  <h2>{state.case.id}</h2>
                </div>
                <button
                  className="button button-primary button-small"
                  onClick={() => navigate(`/staff/cases/${state.case.id}`)}
                >
                  {ar ? "فتح امتثال الحالة" : "Open case compliance"} ←
                </button>
              </header>
              <div className="overview-gate-flow">
                {[
                  ["1", ar ? "اكتمال المواطن" : "Citizen completion", "pass"],
                  ["2", ar ? "مراجعة الموظف" : "Staff review", state.case.status === "Draft" ? "waiting" : "pass"],
                  ["3", ar ? "بوابة الامتثال" : "Compliance gate", blocking.length ? "blocked" : "pass"],
                  ["4", ar ? "اللجنة والقرار" : "Committee decision", state.case.signed ? "pass" : "waiting"],
                ].map(([step, label, status]) => (
                  <div key={step} className={status}>
                    <i>{status === "pass" ? "✓" : step}</i>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="priority-controls">
                {results
                  .filter(
                    (result) =>
                      result.status === "needs_review" ||
                      result.status === "violation",
                  )
                  .map((result) => (
                    <button
                      key={result.control.id}
                      onClick={() => {
                        setSelectedControlId(result.control.id);
                        setTab("controls");
                      }}
                    >
                      <CompliancePill status={result.status} ar={ar} />
                      <span>
                        <strong>
                          {ar
                            ? result.control.nameAr
                            : result.control.nameEn}
                        </strong>
                        <small>{result.control.id}</small>
                      </span>
                      <b>←</b>
                    </button>
                  ))}
              </div>
            </article>
            <article className="compliance-panel quota-snapshot">
              <header>
                <div>
                  <span className="eyebrow">
                    {ar ? "مراقب الحصص" : "QUOTA MONITOR"}
                  </span>
                  <h2>{ar ? "الحد القانوني مقابل التنفيذ" : "Minimum vs actual"}</h2>
                </div>
                <button onClick={() => setTab("quotas")}>
                  {ar ? "التفاصيل" : "Details"} ←
                </button>
              </header>
              {[
                [ar ? "المقاعد الدراسية" : "Education seats", 10, 12.4],
                [ar ? "التعيينات" : "Employment", 15, 16.8],
                [ar ? "مقاعد الحج" : "Hajj seats", 5, 5.6],
              ].map(([label, minimum, actual]) => (
                <div className="quota-row" key={String(label)}>
                  <span>{label}</span>
                  <div>
                    <i style={{ width: `${Number(actual) * 4}%` }} />
                    <b style={{ insetInlineStart: `${Number(minimum) * 4}%` }} />
                  </div>
                  <strong>{actual}%</strong>
                </div>
              ))}
              <small>
                {ar
                  ? "الخط العمودي = الحد المرجعي · البيانات تجريبية."
                  : "Vertical marker = reference minimum · demo data."}
              </small>
            </article>
          </div>
        </>
      )}

      {tab === "controls" && (
        <section className="catalog-layout">
          <div className="catalog-list">
            <header className="catalog-tools">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={ar ? "ابحث بالضابط أو الوصف…" : "Search control or description…"}
              />
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value;
                  setCategory(nextCategory);
                  const nextControl = results.find(
                    (result) =>
                      nextCategory === "all" ||
                      result.control.category === nextCategory,
                  );
                  if (nextControl) setSelectedControlId(nextControl.control.id);
                }}
              >
                <option value="all">{ar ? "كل الفئات" : "All categories"}</option>
                <option value="eligibility">{ar ? "الأهلية" : "Eligibility"}</option>
                <option value="committee">{ar ? "اللجان" : "Committee"}</option>
                <option value="sla">{ar ? "المدد" : "SLA"}</option>
                <option value="benefit">{ar ? "الامتيازات" : "Benefits"}</option>
                <option value="quota">{ar ? "الحصص" : "Quotas"}</option>
                <option value="governance">{ar ? "الحوكمة" : "Governance"}</option>
              </select>
            </header>
            {filteredControls.map((result) => (
              <button
                key={result.control.id}
                className={
                  selectedResult.control.id === result.control.id ? "active" : ""
                }
                onClick={() => setSelectedControlId(result.control.id)}
              >
                <span>
                  <b>{result.control.id}</b>
                  <small>
                    {ar ? result.control.nameAr : result.control.nameEn}
                  </small>
                </span>
                <CompliancePill status={result.status} ar={ar} />
              </button>
            ))}
            {!filteredControls.length && (
              <p className="empty-catalog">
                {ar ? "لا توجد نتائج مطابقة." : "No matching controls."}
              </p>
            )}
          </div>
          <article className="catalog-detail">
            <header>
              <div>
                <span className="eyebrow">{selectedResult.control.id}</span>
                <h2>
                  {ar
                    ? selectedResult.control.nameAr
                    : selectedResult.control.nameEn}
                </h2>
              </div>
              <CompliancePill status={selectedResult.status} ar={ar} />
            </header>
            <p>
              {ar
                ? selectedResult.control.descriptionAr
                : selectedResult.control.descriptionEn}
            </p>
            <dl>
              <div>
                <dt>{ar ? "النوع" : "Severity"}</dt>
                <dd>
                  {selectedResult.control.severity === "blocking"
                    ? ar
                      ? "حاجب للإجراء"
                      : "Blocking"
                    : ar
                      ? "إرشادي"
                      : "Advisory"}
                </dd>
              </div>
              <div>
                <dt>{ar ? "النسخة" : "Version"}</dt>
                <dd dir="ltr">{selectedResult.control.version}</dd>
              </div>
              <div>
                <dt>{ar ? "دليل الحالة" : "Case evidence"}</dt>
                <dd>
                  {ar ? selectedResult.evidenceAr : selectedResult.evidenceEn}
                </dd>
              </div>
            </dl>
            <CitationTags result={selectedResult} />
            <button
              className="button button-secondary"
              onClick={() => {
                setQuery(
                  getClauseForControl(selectedResult.control)[0]?.article ?? "",
                );
                setTab("knowledge");
              }}
            >
              {ar ? "فتح المادة المرتبطة" : "Open linked article"} ←
            </button>
          </article>
        </section>
      )}

      {tab === "knowledge" && (
        <section className="legal-browser">
          <header>
            <div>
              <span className="eyebrow">
                {ar ? "قاعدة المعرفة المشتركة" : "SHARED LEGAL KNOWLEDGE"}
              </span>
              <h2>
                {ar ? "تصفح المواد المرجعية" : "Browse reference articles"}
              </h2>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? "مثال: التعليم، النصاب، الرسوم…" : "Try education, quorum, fees…"}
            />
          </header>
          <div className="legal-clause-grid">
            {clauses.map((clause) => (
              <article key={clause.id}>
                <header>
                  <span>{clause.article}</span>
                  <small>{clause.sourcePages}</small>
                </header>
                <h3>{ar ? clause.titleAr : clause.titleEn}</h3>
                <p>{ar ? clause.summaryAr : clause.summaryEn}</p>
                <footer>
                  <span>MF-LAW-2016.2</span>
                  <button
                    onClick={() =>
                      toast(
                        ar
                          ? `تم تثبيت ${clause.article} كمرجع للعرض`
                          : `${clause.article} pinned as a demo reference`,
                      )
                    }
                  >
                    {ar ? "تثبيت المرجع" : "Pin reference"} +
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "quotas" && (
        <section className="compliance-panel detailed-quota">
          <header>
            <div>
              <span className="eyebrow">CTL-QUOTA</span>
              <h2>{ar ? "مراقبة الحصص على مستوى المؤسسة" : "Institution-wide quota monitor"}</h2>
            </div>
            <button
              className="button button-secondary"
              onClick={() =>
                toast(ar ? "تم تحديث المؤشرات التجريبية" : "Demo indicators refreshed")
              }
            >
              ↻ {ar ? "تحديث" : "Refresh"}
            </button>
          </header>
          {[
            ["CTL-QUOTA-EDU", ar ? "المقاعد الدراسية" : "Education seats", "المادة 17/سابعاً", 10, 12.4, 1240, 154],
            ["CTL-QUOTA-JOBS", ar ? "الدرجات الوظيفية" : "Employment positions", "المادة 17/خامساً", 15, 16.8, 840, 141],
            ["CTL-QUOTA-HAJJ", ar ? "مقاعد الحج" : "Hajj seats", "المادة 17/ثالث عشر", 5, 5.6, 500, 28],
          ].map(([id, label, article, minimum, actual, total, allocated]) => (
            <article key={String(id)}>
              <div>
                <span>{id}</span>
                <h3>{label}</h3>
                <small>{article}</small>
              </div>
              <div className="quota-meter-large">
                <i style={{ width: `${Number(actual) * 4}%` }} />
                <b style={{ insetInlineStart: `${Number(minimum) * 4}%` }} />
              </div>
              <div>
                <strong>{actual}%</strong>
                <small>
                  {allocated} / {total}
                </small>
              </div>
              <CompliancePill status="pass" ar={ar} />
            </article>
          ))}
        </section>
      )}

      {tab === "sla" && (
        <section className="sla-tracker-grid">
          {[
            ["CTL-SLA-DECISION", ar ? "حسم الطلبات" : "Case decisions", "94.6%", ar ? "7 حالات معرضة" : "7 at risk", "pass"],
            ["CTL-SLA-APPEAL", ar ? "حسم الاعتراضات" : "Appeal resolution", "91.2%", ar ? "3 حالات معرضة" : "3 at risk", "needs_review"],
            ["CTL-MEDICAL-SLA", ar ? "إحالات العلاج" : "Medical referrals", "96.1%", ar ? "حالتان معرضتان" : "2 at risk", "pass"],
          ].map(([id, title, value, note, status]) => (
            <article key={id}>
              <header>
                <span>{id}</span>
                <CompliancePill status={status as ComplianceStatus} ar={ar} />
              </header>
              <h2>{title}</h2>
              <strong>{value}</strong>
              <p>{note}</p>
              <button
                onClick={() =>
                  toast(
                    ar
                      ? `تم فتح قائمة الحالات المرتبطة بـ ${id}`
                      : `Opened cases linked to ${id}`,
                  )
                }
              >
                {ar ? "فتح الحالات" : "Open cases"} ←
              </button>
            </article>
          ))}
        </section>
      )}

      {tab === "reports" && (
        <section className="report-library">
          {[
            [ar ? "تقرير المؤسسة السنوي إلى مجلس النواب" : "Annual report to Parliament", "RPT-ANNUAL-2026", "18"],
            [ar ? "تقرير مخالفات الضوابط ومعالجتها" : "Violations and remediation report", "RPT-REMEDIATION-07", String(blocking.length)],
            [ar ? "تقرير الحصص والامتيازات" : "Quotas and benefits report", "RPT-QUOTAS-Q2", "3"],
          ].map(([title, code, count]) => (
            <article key={code}>
              <span className="report-icon">▤</span>
              <div>
                <small>{code}</small>
                <h3>{title}</h3>
                <p>
                  {ar
                    ? `${count} مؤشراً · بيانات إثبات مفهوم قابلة للتصفية`
                    : `${count} indicators · filterable POC data`}
                </p>
              </div>
              <button
                className="button button-secondary"
                onClick={() =>
                  toast(
                    ar
                      ? `تم توليد معاينة ${code}`
                      : `${code} preview generated`,
                  )
                }
              >
                {ar ? "توليد معاينة" : "Generate preview"}
              </button>
            </article>
          ))}
        </section>
      )}

      {tab === "versions" && (
        <section className="version-impact">
          <header>
            <div>
              <span className="eyebrow">CTL-VERSIONING</span>
              <h2>{ar ? "نسخ القانون وتحليل الأثر" : "Legal versions and impact analysis"}</h2>
            </div>
            <CompliancePill status="pass" ar={ar} />
          </header>
          <div className="version-timeline">
            <article className="active">
              <i>✓</i>
              <div>
                <span>MF-LAW-2016.2</span>
                <h3>{ar ? "قانون مؤسسة الشهداء رقم (2) لسنة 2016" : "Martyrs Foundation Law No. 2 of 2016"}</h3>
                <p>{ar ? "نسخة العمل المرتبطة بالضوابط الـ18." : "Working version linked to all 18 controls."}</p>
              </div>
            </article>
            <article>
              <i>◇</i>
              <div>
                <span>AMENDMENTS-DRAFT</span>
                <h3>{ar ? "التعديلات الجديدة — بانتظار ملف معتمد" : "New amendments — authoritative file pending"}</h3>
                <p>{ar ? "لا تُفعّل في التقييم قبل رفع النص المعتمد ومراجعته." : "Not activated until an authoritative text is uploaded and reviewed."}</p>
              </div>
            </article>
          </div>
          <div className="impact-warning">
            <span>!</span>
            <div>
              <strong>{ar ? "لا يوجد نشر تلقائي للتعديلات" : "No automatic amendment publication"}</strong>
              <p>{ar ? "يمر أي تعديل عبر المقارنة، تحديد الضوابط المتأثرة، المراجعة القانونية، الاختبار، ثم النشر المؤرخ." : "Each amendment goes through comparison, impacted-control mapping, legal review, testing and dated publication."}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function CitizenLegalAssistant({
  state,
  navigate,
}: {
  state: DemoState;
  navigate: (path: string) => void;
}) {
  return <LegalAssistantExperience state={state} audience="citizen" navigate={navigate} />;
}

export function StaffLegalAssistant({
  state,
  navigate,
  addAudit,
}: {
  state: DemoState;
  navigate: (path: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  return (
    <LegalAssistantExperience
      state={state}
      audience="staff"
      navigate={navigate}
      addAudit={addAudit}
    />
  );
}

export const complianceLawCount = legalClauses.length;
export const complianceControlCount = complianceControls.length;
