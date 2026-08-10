import assert from "node:assert/strict";
import test from "node:test";
import {
  canPerform,
  canTransition,
  committeeDecisionReadiness,
  evaluateEligibility,
  hasQuorum,
  isCaseVisibleToCommittee,
  isCaseVisibleToOperations,
  simulatePayment,
} from "../lib/domain.ts";
import { getExecutiveView } from "../lib/executive.ts";
import {
  canSubmitGenericService,
  requiredCitizenUploads,
} from "../lib/service-flow.ts";
import {
  answerLegalAssistant,
  complianceControls,
  evaluateCompliance,
  getBlockingComplianceResults,
  retrieveLegalKnowledge,
} from "../lib/compliance.ts";
import {
  answerHasGrounding,
  buildRetrievalFallback,
  legalKnowledgeChunks,
  readGeminiOutputText,
  readOpenRouterOutputText,
  retrieveLegalChunks,
} from "../lib/legal-assistant.ts";
import { services } from "../lib/seed.ts";
import { createInitialState } from "../lib/seed.ts";
import {
  administrativeModules,
  createEnterpriseRecord,
  createInitialEnterpriseState,
  financialModules,
  isJournalBalanced,
  transitionEnterpriseRecord,
} from "../lib/enterprise.ts";
import type { CommitteeMember, PaymentRecord } from "../lib/types.ts";

test("application state transitions allow the happy path and block invalid jumps", () => {
  assert.equal(canTransition("Draft", "Submitted"), true);
  assert.equal(canTransition("Submitted", "Awaiting Citizen Completion"), false);
  assert.equal(canTransition("Awaiting Citizen Completion", "Under Review"), true);
  assert.equal(canTransition("Under Review", "Manager Review"), true);
  assert.equal(canTransition("Manager Review", "Referred"), true);
  assert.equal(canTransition("Under Review", "Referred"), false);
  assert.equal(canTransition("Committee Review", "Approved"), true);
  assert.equal(canTransition("Draft", "Approved"), false);
  assert.equal(canTransition("Rejected", "Submitted"), false);
});

test("citizen categories produce distinct service catalogues", () => {
  const martyrServices = services.filter((service) => service.audiences?.includes("martyr-family"));
  const injuredServices = services.filter((service) => service.audiences?.includes("injured"));
  assert.equal(martyrServices.some((service) => service.id === "education-grant"), true);
  assert.equal(injuredServices.some((service) => service.id === "health-support"), true);
  assert.equal(injuredServices.some((service) => service.id === "education-grant"), false);
});

test("incomplete citizen work never appears in operational or committee flows", () => {
  assert.equal(isCaseVisibleToOperations("Draft"), false);
  assert.equal(isCaseVisibleToOperations("Incomplete"), false);
  assert.equal(isCaseVisibleToOperations("Awaiting Citizen Completion"), false);
  assert.equal(isCaseVisibleToOperations("Submitted"), true);
  assert.equal(isCaseVisibleToCommittee("Submitted"), false);
  assert.equal(isCaseVisibleToCommittee("Under Review"), false);
  assert.equal(isCaseVisibleToCommittee("Committee Review"), true);
  assert.equal(isCaseVisibleToCommittee("Approved"), true);
});

test("eligibility evaluation changes only when verified enrollment evidence appears", () => {
  const incomplete = evaluateEligibility({
    documents: [],
    familyMemberAr: "مريم حيدر علي",
    universityAr: "جامعة بغداد",
  });
  assert.equal(incomplete.find((result) => result.id === "rule-study")?.status, "warning");

  const complete = evaluateEligibility({
    documents: [
      {
        id: "enrollment",
        titleAr: "تأييد",
        titleEn: "Confirmation",
        type: "enrollment",
        status: "verified",
        classification: "demo",
        source: "citizen",
      },
    ],
    familyMemberAr: "مريم حيدر علي",
    universityAr: "جامعة بغداد",
  });
  assert.equal(complete.find((result) => result.id === "rule-study")?.status, "pass");
  assert.equal(complete.find((result) => result.id === "rule-duplicate")?.status, "manual");
});

test("payment idempotency prevents a duplicate successful payment", () => {
  const successful: PaymentRecord = {
    id: "pay-1",
    invoice: "inv-1",
    amount: 25_000,
    status: "successful",
    idempotencyKey: "same-key",
    reconciled: true,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
  const duplicate = simulatePayment(successful, "successful", "same-key");
  assert.equal(duplicate.duplicatePrevented, true);
  assert.deepEqual(duplicate.payment, successful);

  const retry = simulatePayment(successful, "refunded", "refund-key");
  assert.equal(retry.duplicatePrevented, false);
  assert.equal(retry.payment.status, "refunded");
});

test("committee quorum excludes absent members and declared conflicts", () => {
  const members: CommitteeMember[] = [
    { id: "1", nameAr: "أ", nameEn: "A", roleAr: "عضو", roleEn: "Member", present: true, conflict: false },
    { id: "2", nameAr: "ب", nameEn: "B", roleAr: "عضو", roleEn: "Member", present: true, conflict: false },
    { id: "3", nameAr: "ج", nameEn: "C", roleAr: "عضو", roleEn: "Member", present: true, conflict: true },
    { id: "4", nameAr: "د", nameEn: "D", roleAr: "عضو", roleEn: "Member", present: false, conflict: false },
  ];
  assert.equal(hasQuorum(members), false);
  members[2].conflict = false;
  assert.equal(hasQuorum(members), true);
});

test("committee signature becomes ready after two eligible approvals and a rationale", () => {
  const members: CommitteeMember[] = [
    { id: "cm-1", nameAr: "أ", nameEn: "A", roleAr: "رئيس", roleEn: "Chair", present: true, conflict: false, vote: "approve" },
    { id: "cm-2", nameAr: "ب", nameEn: "B", roleAr: "عضو", roleEn: "Member", present: true, conflict: false, vote: "approve" },
    { id: "cm-3", nameAr: "ج", nameEn: "C", roleAr: "عضو", roleEn: "Member", present: true, conflict: false },
    { id: "cm-4", nameAr: "د", nameEn: "D", roleAr: "عضو", roleEn: "Member", present: true, conflict: true, vote: "approve" },
  ];
  const ready = committeeDecisionReadiness(members, "قرار مسبب", 0);
  assert.equal(ready.quorum, true);
  assert.equal(ready.approveCount, 2);
  assert.equal(ready.ready, true);
  assert.equal(committeeDecisionReadiness(members, "", 0).ready, false);
  assert.equal(committeeDecisionReadiness(members, "قرار مسبب", 1).ready, false);
});

test("role policy separates citizen, staff, committee, and admin actions", () => {
  assert.equal(canPerform("citizen", "submit"), true);
  assert.equal(canPerform("citizen", "refer"), false);
  assert.equal(canPerform("staff", "refer"), true);
  assert.equal(canPerform("staff", "request-completion"), false);
  assert.equal(canPerform("staff", "sign"), false);
  assert.equal(canPerform("committee", "sign"), true);
  assert.equal(canPerform("admin", "rollback-config"), true);
});

test("executive filters update transaction volume and revenue coherently", () => {
  const all = getExecutiveView("all", "all", "12m");
  const education = getExecutiveView("education", "all", "12m");
  const basraHealth = getExecutiveView("health", "basra", "12m");
  const certificates = getExecutiveView("certificates", "baghdad", "3m");
  const july = getExecutiveView("all", "all", "1m");

  assert.equal(all.labels.length, 12);
  assert.equal(certificates.labels.length, 3);
  assert.equal(july.labels.length, 1);
  assert.ok(all.revenueTotal > certificates.revenueTotal);
  assert.ok(certificates.revenue.every((value) => value > 0));
  assert.equal(
    july.revenueTotal,
    july.revenue.reduce((total, value) => total + value, 0),
  );
  assert.equal(
    certificates.governorates.every((row) => row.id === "baghdad"),
    true,
  );
  const normalize = (values: number[]) => {
    const maximum = Math.max(...values, 1);
    return values.map((value) => Math.round((value / maximum) * 100));
  };
  assert.notDeepEqual(normalize(all.revenue), normalize(education.revenue));
  assert.notDeepEqual(normalize(education.revenue), normalize(basraHealth.revenue));
});

test("all catalogue services can use the complete citizen submission gate", () => {
  assert.ok(services.length > 1);
  assert.equal(services.every((service) => service.documents > 0), true);
  assert.equal(requiredCitizenUploads(1), 0);
  assert.equal(requiredCitizenUploads(5), 4);
  assert.equal(
    canSubmitGenericService({
      detail: "طلب تجريبي مكتمل",
      documentCount: 3,
      uploadedCount: 1,
      consent: true,
    }),
    false,
  );
  assert.equal(
    canSubmitGenericService({
      detail: "طلب تجريبي مكتمل",
      documentCount: 3,
      uploadedCount: 2,
      consent: true,
    }),
    true,
  );
});

test("the compliance catalogue contains all mandated controls", () => {
  assert.equal(complianceControls.length, 18);
  assert.equal(
    new Set(complianceControls.map((control) => control.id)).size,
    18,
  );
  assert.ok(
    [
      "CTL-DEF-KIN",
      "CTL-EXCLUSION-BAATH",
      "CTL-PROOF",
      "CTL-COMMITTEE-QUORUM",
      "CTL-QUOTA-EDU",
      "CTL-VERSIONING",
    ].every((id) => complianceControls.some((control) => control.id === id)),
  );
});

test("unresolved human reviews block referral and resolve deterministically", () => {
  const state = createInitialState();
  state.case.status = "Under Review";
  state.case.documents.push({
    id: "doc-enrollment",
    titleAr: "تأييد الاستمرار بالدراسة",
    titleEn: "Enrollment confirmation",
    type: "enrollment",
    status: "verified",
    classification: "demo",
    source: "citizen",
  });
  const initial = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: [],
  });
  assert.deepEqual(
    getBlockingComplianceResults(initial).map((result) => result.control.id),
    ["CTL-EXCLUSION-BAATH", "CTL-PROOF"],
  );

  const resolved = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: ["CTL-EXCLUSION-BAATH", "CTL-PROOF"],
  });
  assert.equal(getBlockingComplianceResults(resolved).length, 0);
  assert.equal(
    resolved.find((result) => result.control.id === "CTL-PROOF")?.status,
    "pass",
  );
});

test("committee compliance enforces quorum and excludes conflicts", () => {
  const state = createInitialState();
  state.case.status = "Committee Review";
  const failingMembers = state.committeeMembers.map((member, index) => ({
    ...member,
    present: index < 2,
    conflict: false,
  }));
  const failed = evaluateCompliance({
    application: state.case,
    committeeMembers: failingMembers,
    resolvedControlIds: ["CTL-EXCLUSION-BAATH", "CTL-PROOF"],
  });
  assert.equal(
    failed.find(
      (result) => result.control.id === "CTL-COMMITTEE-QUORUM",
    )?.status,
    "violation",
  );
});

test("legal retrieval and citizen answers always return citations", () => {
  const state = createInitialState();
  const education = retrieveLegalKnowledge("تعليم");
  assert.ok(education.some((clause) => clause.article === "المادة 17"));
  const answer = answerLegalAssistant("education", state.case);
  assert.ok(answer.citations.includes("المادة 17/سابعاً"));
  assert.match(answer.bodyAr, /ليس تأكيد أهلية فردية/);
});

test("grounded assistant retrieval finds the relevant law article and page", () => {
  const fees = retrieveLegalChunks("هل توجد رسوم أو ضرائب على المعاملة؟");
  const education = retrieveLegalChunks("ما حصة المقاعد الدراسية والتعليم؟");
  const proof = retrieveLegalChunks("اشرح ضابط الإثبات والوثائق الرسمية");

  assert.equal(fees[0]?.id, "L2-2016-M20-FEES");
  assert.ok(education.some((item) => item.id === "L2-2016-M17-EDU"));
  assert.ok(proof.some((item) => item.id === "L2-2016-M5-PROOF"));
  assert.equal(
    legalKnowledgeChunks.every(
      (item) => item.article && item.sourcePage && item.sourceFile,
    ),
    true,
  );
});

test("legal retrieval does not recycle unrelated default answers", () => {
  const unrelated = retrieveLegalChunks("مرحبا كيفك اليوم؟");
  const exchangeRate = retrieveLegalChunks("ما هو سعر صرف الدولار اليوم؟");
  const pension = retrieveLegalChunks("كيف يُحتسب الراتب التقاعدي؟");
  const health = retrieveLegalChunks("ما أولوية العلاج والإحالة الطبية؟");
  assert.deepEqual(unrelated, []);
  assert.deepEqual(exchangeRate, []);
  assert.notEqual(pension[0]?.id, health[0]?.id);
  assert.equal(answerHasGrounding("جواب بلا مرجع", pension), false);
  assert.equal(
    answerHasGrounding(`${pension[0]?.titleAr} [${pension[0]?.article} — ص ${pension[0]?.sourcePage}]`, pension),
    true,
  );
  const healthAnswer = buildRetrievalFallback({
    audience: "citizen",
    message: "ما أولوية العلاج والإحالة الطبية؟",
    sources: health,
    caseContext: { id: "MF-TEST", service: "صحة", status: "Submitted" },
  });
  assert.doesNotMatch(healthAnswer.answer, /بحسب سجل العرض/);
});

test("retrieval fallback remains sourced and never claims a final decision", () => {
  const state = createInitialState();
  const sources = retrieveLegalChunks("ما الوثائق المطلوبة؟");
  const result = buildRetrievalFallback({
    audience: "citizen",
    message: "ما الوثائق المطلوبة؟",
    sources,
    caseContext: {
      id: state.case.id,
      service: "منحة التعليم",
      status: state.case.status,
      documents: state.case.documents.map((document) => ({
        title: document.titleAr,
        type: document.type,
        status: document.status,
      })),
    },
  });

  assert.equal(result.mode, "retrieval");
  assert.ok(result.citations.length > 0);
  assert.match(result.answer, /ليس قرار أهلية نهائياً/);
  assert.ok(result.citations.every((citation) => citation.page));
});

test("Gemini interaction responses expose only model text", () => {
  assert.equal(
    readGeminiOutputText({ output_text: "  جواب مباشر  " }),
    "جواب مباشر",
  );
  assert.equal(
    readGeminiOutputText({
      steps: [
        { thought: { summary: [{ text: { text: "تفكير داخلي" } }] } },
        {
          modelOutput: {
            content: [
              { text: { text: "الجواب الأول" } },
              { text: { text: "الجواب الثاني" } },
            ],
          },
        },
      ],
    }),
    "الجواب الأول\nالجواب الثاني",
  );
});

test("OpenRouter chat responses expose only assistant content", () => {
  assert.equal(
    readOpenRouterOutputText({
      model: "openrouter/free",
      choices: [{ message: { role: "assistant", content: "  جواب موثق  " } }],
    }),
    "جواب موثق",
  );
  assert.equal(
    readOpenRouterOutputText({
      choices: [{ message: { content: [{ type: "text", text: "المادة 20" }] } }],
    }),
    "المادة 20",
  );
});

test("grounding rejects invented law names and unsupported timing claims", () => {
  const sources = retrieveLegalChunks("ما أولوية العلاج والإحالة الطبية؟");
  assert.equal(
    answerHasGrounding(
      "بحسب قانون أولوية العلاج تُؤجل الإحالة تلقائياً. [المادة 20/ثالثاً — ص 16]",
      sources,
    ),
    false,
  );
  assert.equal(
    answerHasGrounding(
      "تقرر المادة أولوية العلاج والإرسال خلال ثلاثين يوماً وفق الحالة والمسار الطبي. [المادة 20/ثالثاً — ص 16]",
      sources,
    ),
    true,
  );
});

test("enterprise catalogue covers all financial and administrative modules", () => {
  assert.equal(financialModules.length, 17);
  assert.equal(administrativeModules.length, 18);
  assert.equal(new Set([...financialModules, ...administrativeModules].map((item) => item.id)).size, 35);
});

test("procurement enforces segregation, budget and balanced posting", () => {
  const initial = createInitialEnterpriseState();
  const spentBefore = initial.budgetLines.find((line) => line.id === "BL-A-01")!.spent;
  const created = createEnterpriseRecord(initial, {
    moduleId: "fin-procurement",
    title: "طلب تجهيز حواسيب المديرية",
    description: "طلب شراء تشغيلي مع عرض سعر تجريبي ومركز كلفة محدد.",
    amount: 125_000_000,
    quantity: 10,
    fund: "A",
    budgetLineId: "BL-A-01",
    reference: "PR-TEST-001",
    idempotencyKey: "idem-proc-test-001",
  }, "procurement-officer", "2026-08-09T09:00:00.000Z");
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const duplicate = createEnterpriseRecord(created.state, {
    moduleId: "fin-procurement",
    title: "طلب تجهيز حواسيب آخر",
    description: "يجب منع هذا السجل لأنه يحمل المفتاح ذاته.",
    amount: 125_000_000,
    quantity: 10,
    fund: "A",
    budgetLineId: "BL-A-01",
    idempotencyKey: "idem-proc-test-001",
  }, "procurement-officer");
  assert.equal(duplicate.ok, false);

  const submitted = transitionEnterpriseRecord(created.state, created.record.id, "submit", "procurement-officer", "2026-08-09T09:05:00.000Z");
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal(transitionEnterpriseRecord(submitted.state, created.record.id, "approve", "procurement-officer").ok, false);
  const approved = transitionEnterpriseRecord(submitted.state, created.record.id, "approve", "finance-manager", "2026-08-09T09:10:00.000Z");
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.equal(transitionEnterpriseRecord(approved.state, created.record.id, "post", "finance-manager").ok, false);
  const posted = transitionEnterpriseRecord(approved.state, created.record.id, "post", "treasurer", "2026-08-09T09:15:00.000Z");
  assert.equal(posted.ok, true);
  if (!posted.ok) return;
  assert.equal(posted.record.status, "posted");
  assert.equal(isJournalBalanced(posted.record.journalLines), true);
  assert.equal(posted.state.budgetLines.find((line) => line.id === "BL-A-01")!.spent, spentBefore + 125_000_000);
});

test("leave request follows employee, manager and HR roles", () => {
  const initial = createInitialEnterpriseState();
  const created = createEnterpriseRecord(initial, {
    moduleId: "hr-leave",
    title: "إجازة اعتيادية لثلاثة أيام",
    description: "طلب إجازة من الموظف مع تحديد المدة وسبب مختصر.",
    amount: 0,
    quantity: 3,
    reference: "LEAVE-TEST-001",
  }, "general-employee", "2026-08-09T10:00:00.000Z");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = transitionEnterpriseRecord(created.state, created.record.id, "submit", "general-employee");
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const approved = transitionEnterpriseRecord(submitted.state, created.record.id, "approve", "department-manager");
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  const processed = transitionEnterpriseRecord(approved.state, created.record.id, "post", "hr-officer");
  assert.equal(processed.ok, true);
  if (!processed.ok) return;
  assert.equal(processed.state.leaveBalanceDays, 15);
});

test("employee ERP profile and self-service records are seeded at employee scope", () => {
  const state = createInitialEnterpriseState();
  assert.equal(state.employeeProfile.employeeId, "EMP-1024");
  assert.equal(state.employeeProfile.attendanceStatus, "not-started");
  assert.equal(state.leaveBalanceDays, 18);
  assert.ok(state.records.some((record) => record.moduleId === "hr-payroll" && record.titleEn.includes("Ahmed Kareem")));
  assert.ok(state.records.some((record) => record.moduleId === "hr-assets" && record.titleEn.includes("EMP-1024")));
});

test("employee self-service request is created by employee and routed to manager", () => {
  const initial = createInitialEnterpriseState();
  const created = createEnterpriseRecord(initial, {
    moduleId: "hr-maintenance",
    title: "طلب صيانة جهاز محطة العمل",
    description: "الشاشة تنطفئ بشكل متكرر وتحتاج فحص فريق الصيانة.",
    amount: 0,
    quantity: 1,
    reference: "EMP-1024-MNT-001",
  }, "general-employee", "2026-08-09T08:00:00.000Z");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = transitionEnterpriseRecord(created.state, created.record.id, "submit", "general-employee", "2026-08-09T08:05:00.000Z");
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal(submitted.record.status, "submitted");
  assert.equal(submitted.record.origin, "employee-portal");
  assert.equal(submitted.record.ownerEmployeeId, "EMP-1024");
  assert.ok(submitted.state.tasks.some((task) => task.recordId === created.record.id && task.assignedRole === "department-manager"));
  assert.equal(transitionEnterpriseRecord(submitted.state, created.record.id, "approve", "general-employee").ok, false);
});
