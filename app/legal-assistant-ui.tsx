"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateCompliance } from "@/lib/compliance";
import type {
  LegalAssistantAudience,
  LegalAssistantCitation,
  LegalAssistantHistoryItem,
  LegalAssistantResult,
  LegalKnowledgeChunk,
} from "@/lib/legal-assistant";
import type { AuditEvent, DemoState } from "@/lib/types";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: LegalAssistantResult["mode"];
  model?: string | null;
  citations?: LegalAssistantCitation[];
  sources?: LegalKnowledgeChunk[];
  notice?: string;
}

const suggestions = {
  citizen: [
    ["ما الوثائق المطلوبة لمنحة التعليم، وما الذي ينقص طلبي؟", "Required education documents"],
    ["شو حقي بالمقاعد الدراسية حسب القانون؟", "Education seats under the law"],
    ["وين وصلت معاملتي وما هي الخطوة التالية؟", "Case status and next step"],
    ["هل توجد رسوم أو ضرائب على هذه المعاملة؟", "Fees and taxes"],
    ["كيف تكون مواعيد التظلم والطعن؟", "Appeal deadlines"],
    ["ما الخدمات المتعلقة بالصحة والسكن والتعيين؟", "Health, housing and jobs"],
  ],
  staff: [
    ["لخّص الحالة وميّز بين الوقائع والنتائج التي تحتاج مراجعة بشرية.", "Summarize the case"],
    ["أي ضوابط امتثال حاجبة الآن، ولماذا؟", "Current blocking controls"],
    ["اشرح تطبيق المادة 5 على الإثبات والاستثناءات في هذه الحالة.", "Article 5 review"],
    ["ما السند القانوني لخدمة التعليم وما الذي لا يمكن حسمه آلياً؟", "Education legal basis"],
    ["حضّر مسودة توصية إحالة مسببة مع المراجع، للمراجعة البشرية.", "Draft referral rationale"],
    ["ما المهل القانونية ومتى يجب التصعيد؟", "Legal deadlines"],
  ],
} satisfies Record<LegalAssistantAudience, Array<[string, string]>>;

function entryId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initialMessage(audience: LegalAssistantAudience, ar: boolean): ChatEntry {
  return {
    id: "assistant-welcome",
    role: "assistant",
    content: ar
      ? audience === "staff"
        ? "أنا مساعد الموظف والامتثال. أربط سؤالك ببيانات الحالة، نتائج الضوابط، والمواد القانونية المسترجعة. أستطيع الشرح وصياغة مسودة، لكن لا أعتمد قراراً."
        : "أنا مساعدك القانوني والخدمي. اسألني عن الخدمات والوثائق وحالة طلبك، وسأعرض لك المرجع والصفحة. لا أقرر الأهلية ولا أضمن النتيجة."
      : audience === "staff"
        ? "I connect case facts, deterministic controls and retrieved law. I can explain or draft, but I cannot approve a decision."
        : "Ask about services, documents or your case. I show the legal source and page, but I do not decide eligibility.",
  };
}

export function LegalAssistantExperience({
  state,
  audience,
  navigate,
  addAudit,
}: {
  state: DemoState;
  audience: LegalAssistantAudience;
  navigate: (path: string) => void;
  addAudit?: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const [messages, setMessages] = useState<ChatEntry[]>([
    initialMessage(audience, ar),
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSource, setSelectedSource] = useState<LegalKnowledgeChunk | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const compliance = useMemo(() => evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: state.complianceResolvedControlIds,
  }), [state.case, state.committeeMembers, state.complianceResolvedControlIds]);

  const latestAssistant = [...messages].reverse().find(
    (message) => message.role === "assistant" && message.mode,
  );
  const visibleSources = latestAssistant?.sources ?? [];
  const mode = latestAssistant?.mode;

  const caseContext = useMemo(() => ({
    id: state.case.id,
    service: ar ? "منحة تعليمية لأحد أفراد الأسرة" : "Family Education Grant",
    status: state.case.status,
    citizenName: ar ? state.case.citizenNameAr : state.case.citizenNameEn,
    familyMember: ar ? state.case.familyMemberAr : state.case.familyMemberEn,
    university: ar ? state.case.universityAr : state.case.universityEn,
    governorate: ar ? state.case.governorateAr : state.case.governorateEn,
    slaHoursRemaining: state.case.slaHoursRemaining,
    documents: state.case.documents.map((document) => ({
      title: ar ? document.titleAr : document.titleEn,
      type: document.type,
      status: document.status,
    })),
    controls: audience === "staff"
      ? compliance.map((result) => ({
          id: result.control.id,
          name: ar ? result.control.nameAr : result.control.nameEn,
          status: result.status,
          explanation: ar ? result.explanationAr : result.explanationEn,
        }))
      : undefined,
  }), [ar, audience, compliance, state.case]);

  const send = async (question = draft) => {
    const value = question.trim();
    if (!value || loading) return;
    const userEntry: ChatEntry = {
      id: entryId("user"),
      role: "user",
      content: value.slice(0, 1800),
    };
    const history: LegalAssistantHistoryItem[] = messages
      .filter((message) => message.content)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));
    setMessages((previous) => [...previous, userEntry]);
    setDraft("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/legal-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          audience,
          history,
          caseContext,
        }),
      });
      const payload = await response.json() as Partial<LegalAssistantResult> & { error?: string };
      if (!response.ok || typeof payload.answer !== "string") {
        throw new Error(payload.error || (ar ? "تعذر إنشاء الجواب." : "Could not create an answer."));
      }
      const assistantEntry: ChatEntry = {
        id: entryId("assistant"),
        role: "assistant",
        content: payload.answer,
        mode: payload.mode === "llm" ? "llm" : "retrieval",
        model: typeof payload.model === "string" ? payload.model : null,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        notice: payload.notice,
      };
      setMessages((previous) => [...previous, assistantEntry]);
      if (audience === "staff" && addAudit) {
        const citations = assistantEntry.citations?.map(
          (citation) => `${citation.article}/${citation.clause}`,
        ).join("، ") || "لا يوجد";
        addAudit(
          `استعلام مساعد الموظف: ${value.slice(0, 90)} · المراجع: ${citations}`,
          `Staff assistant query: ${value.slice(0, 90)} · cited sources: ${citations}`,
          "staff",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (ar ? "تعذر الاتصال بالمساعد." : "Assistant connection failed."));
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = () => {
    setMessages([initialMessage(audience, ar)]);
    setSelectedSource(null);
    setError("");
  };

  const sourceForCitation = (citation: LegalAssistantCitation, entry: ChatEntry) =>
    entry.sources?.find((source) => source.id === citation.id) ?? null;

  return (
    <div className={`page legal-assistant-page legal-assistant-${audience}`}>
      <header className="legal-assistant-hero">
        <div>
          <span className="eyebrow">
            {audience === "staff"
              ? ar ? "مساعدة الموظف والامتثال" : "STAFF & COMPLIANCE ASSISTANT"
              : ar ? "المساعد القانوني والخدمي" : "LEGAL & SERVICE ASSISTANT"}
          </span>
          <h1>
            {audience === "staff"
              ? ar ? "اسأل عن الحالة، الضوابط، والسند القانوني." : "Ask about the case, controls and legal basis."
              : ar ? "اسأل بلغة بسيطة، وخذ جواباً موثقاً." : "Ask plainly and get a sourced answer."}
          </h1>
          <p>
            {ar
              ? "استرجاع من قانون مؤسسة الشهداء واللوائح المرفقة، مع سياق المعاملة حسب صلاحية الدور. كل جواب للمساعدة ويحتاج مراجعة بشرية."
              : "Retrieval from the supplied Martyrs Foundation law and regulations, with role-scoped case context. Every answer is assistive and human-reviewable."}
          </p>
        </div>
        <div className="assistant-runtime-card">
          <span className={mode === "llm" ? "online" : mode === "retrieval" ? "local" : ""}>✦</span>
          <div>
            <small>{ar ? "المحرك الحالي" : "CURRENT ENGINE"}</small>
            <strong>
              {mode === "llm"
                ? "LLM + RAG"
                : mode === "retrieval"
                  ? ar ? "استرجاع قانوني محلي" : "Local legal retrieval"
                  : ar ? "استرجاع قانوني مُسنَد" : "Grounded legal retrieval"}
            </strong>
            <em>
              {mode === "llm"
                ? latestAssistant?.model || "OpenRouter"
                : ar ? "المصدر ظاهر مع الصفحة" : "Source and page shown"}
            </em>
          </div>
        </div>
      </header>

      <div className="legal-assistant-grid">
        <main className="legal-chat-shell">
          <div className="legal-chat-toolbar">
            <div>
              <span className="assistant-avatar">✦</span>
              <p>
                <strong>{ar ? "مساعد مؤسسة الشهداء" : "Martyrs Foundation Assistant"}</strong>
                <small>
                  {audience === "staff"
                    ? ar ? `سياق الموظف · ${state.case.id}` : `Staff scope · ${state.case.id}`
                    : ar ? "نطاق المواطن وطلبه فقط" : "Citizen and own-case scope only"}
                </small>
              </p>
            </div>
            <button onClick={resetConversation}>↻ {ar ? "محادثة جديدة" : "New chat"}</button>
          </div>

          <div className="legal-chat-safety">
            <span>i</span>
            <p>
              <strong>{ar ? "مساعد، وليس جهة قرار" : "Assistant, not a decision-maker"}</strong>
              <small>
                {ar
                  ? "لا اعتماد أهلية ولا اتهام آلي. راجع المادة والصفحة قبل الإجراء الرسمي."
                  : "No automated eligibility or accusation. Review the article and page before official action."}
              </small>
            </p>
          </div>

          <div className="legal-chat-thread" aria-live="polite">
            {messages.map((entry) => (
              <article key={entry.id} className={`legal-chat-entry ${entry.role}`}>
                {entry.role === "assistant" && <span className="assistant-avatar">✦</span>}
                <div>
                  {entry.content.split(/\n{2,}/).map((paragraph, index) => (
                    <p key={`${entry.id}-${index}`}>{paragraph}</p>
                  ))}
                  {entry.citations && entry.citations.length > 0 && (
                    <div className="legal-citation-row">
                      {entry.citations.map((citation) => (
                        <button
                          key={`${entry.id}-${citation.id}`}
                          onClick={() => setSelectedSource(sourceForCitation(citation, entry))}
                          title={citation.source}
                        >
                          <span>◫</span>
                          {citation.article}/{citation.clause} · ص {citation.page}
                        </button>
                      ))}
                    </div>
                  )}
                  {entry.notice && (
                    <div className={`assistant-mode-note ${entry.mode}`}>
                      <span>{entry.mode === "llm" ? "●" : "○"}</span>
                      {entry.notice}
                    </div>
                  )}
                  {entry.role === "assistant" && entry.mode && (
                    <div className="assistant-feedback-row">
                      <span>{ar ? "هل الجواب مفيد؟" : "Helpful?"}</span>
                      <button
                        className={feedback[entry.id] === "up" ? "active" : ""}
                        onClick={() => setFeedback((previous) => ({ ...previous, [entry.id]: "up" }))}
                      >♡</button>
                      <button
                        className={feedback[entry.id] === "down" ? "active" : ""}
                        onClick={() => setFeedback((previous) => ({ ...previous, [entry.id]: "down" }))}
                      >◇</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {loading && (
              <article className="legal-chat-entry assistant loading">
                <span className="assistant-avatar">✦</span>
                <div>
                  <p>{ar ? "أبحث في المواد الأقرب وأرتب الجواب…" : "Retrieving the closest legal sources…"}</p>
                  <i /><i /><i />
                </div>
              </article>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="legal-chat-error">
              <span>!</span>
              <p>{error}</p>
              <button onClick={() => send(messages.filter((item) => item.role === "user").at(-1)?.content ?? "")}>
                {ar ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          )}

          <div className="legal-chat-composer">
            <textarea
              value={draft}
              maxLength={1800}
              rows={2}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={ar
                ? audience === "staff"
                  ? "مثال: أي ضابط حاجب الآن وما سنده؟"
                  : "مثال: شو الوثائق المطلوبة لخدمة التعليم؟"
                : "Type your question…"}
            />
            <div>
              <small>{draft.length}/1800</small>
              <button disabled={!draft.trim() || loading} onClick={() => void send()}>
                {loading ? "…" : ar ? "إرسال" : "Send"} ←
              </button>
            </div>
          </div>
        </main>

        <aside className="legal-assistant-sidebar">
          <section className="assistant-suggestions">
            <header>
              <span>✦</span>
              <div>
                <strong>{ar ? "أسئلة جاهزة" : "Suggested questions"}</strong>
                <small>{ar ? "تسحب الجواب من اللوائح والحالة" : "Grounded in law and case data"}</small>
              </div>
            </header>
            {suggestions[audience].map(([question, english], index) => (
              <button key={question} disabled={loading} onClick={() => void send(ar ? question : english)}>
                <span>{index + 1}</span>
                {ar ? question : english}
                <i>←</i>
              </button>
            ))}
          </section>

          <section className="assistant-case-scope">
            <header>
              <span>◫</span>
              <div>
                <strong>{ar ? "السياق المصرح" : "Authorized context"}</strong>
                <small dir="ltr">{state.case.id}</small>
              </div>
            </header>
            <dl>
              <div><dt>{ar ? "الخدمة" : "Service"}</dt><dd>{ar ? "منحة التعليم" : "Education grant"}</dd></div>
              <div><dt>{ar ? "الحالة" : "Status"}</dt><dd>{state.case.status}</dd></div>
              <div><dt>{ar ? "الوثائق" : "Documents"}</dt><dd>{state.case.documents.length}</dd></div>
              {audience === "staff" && (
                <div>
                  <dt>{ar ? "ضوابط تحتاج مراجعة" : "Controls to review"}</dt>
                  <dd>{compliance.filter((item) => ["violation", "needs_review"].includes(item.status)).length}</dd>
                </div>
              )}
            </dl>
            <button onClick={() => navigate(
              audience === "staff"
                ? `/staff/cases/${state.case.id}`
                : `/citizen/applications/${state.case.id}`,
            )}>
              {ar ? "فتح المعاملة" : "Open case"} ←
            </button>
          </section>

          <section className="assistant-source-panel">
            <header>
              <span>§</span>
              <div>
                <strong>{ar ? "مصادر آخر جواب" : "Latest answer sources"}</strong>
                <small>{visibleSources.length ? `${visibleSources.length} ${ar ? "مقاطع مسترجعة" : "retrieved passages"}` : (ar ? "ستظهر بعد أول سؤال" : "Shown after the first question")}</small>
              </div>
            </header>
            {visibleSources.slice(0, 5).map((source) => (
              <button
                key={source.id}
                className={selectedSource?.id === source.id ? "active" : ""}
                onClick={() => setSelectedSource(source)}
              >
                <span>{source.article}</span>
                <strong>{source.titleAr}</strong>
                <small>ص {source.sourcePage} · {source.clause}</small>
              </button>
            ))}
          </section>
        </aside>
      </div>

      {selectedSource && (
        <div className="legal-source-backdrop" onMouseDown={() => setSelectedSource(null)}>
          <aside className="legal-source-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">{ar ? "المصدر القانوني المسترجع" : "RETRIEVED LEGAL SOURCE"}</span>
                <h2>{selectedSource.article}/{selectedSource.clause}</h2>
              </div>
              <button onClick={() => setSelectedSource(null)}>×</button>
            </header>
            <section>
              <span>{selectedSource.titleAr}</span>
              <p>{selectedSource.textAr}</p>
            </section>
            <dl>
              <div><dt>{ar ? "الملف" : "File"}</dt><dd>{selectedSource.sourceFile}</dd></div>
              <div><dt>{ar ? "الصفحة" : "Page"}</dt><dd>{selectedSource.sourcePage}</dd></div>
              <div><dt>{ar ? "معرف المقطع" : "Chunk ID"}</dt><dd dir="ltr">{selectedSource.id}</dd></div>
            </dl>
            <div className="legal-source-warning">
              <span>i</span>
              {ar
                ? "هذا ملخص مفهرس للمساعدة في الاسترجاع. راجع صورة الصفحة في الملف الرسمي قبل القرار."
                : "This is an indexed retrieval summary. Review the official scanned page before decision."}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
