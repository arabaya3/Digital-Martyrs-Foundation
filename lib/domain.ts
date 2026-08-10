import type {
  ApplicationCase,
  ApplicationStatus,
  CommitteeMember,
  EligibilityResult,
  PaymentRecord,
  PersonaId,
} from "./types";

export const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  Draft: ["Submitted", "Cancelled"],
  Submitted: ["Under Validation", "Under Review", "Cancelled"],
  "Under Validation": ["Incomplete", "Under Review", "Rejected"],
  Incomplete: ["Awaiting Citizen Completion", "Cancelled"],
  "Awaiting Citizen Completion": ["Under Review", "Cancelled"],
  "Under Review": ["Manager Review", "Awaiting Citizen Completion", "Rejected"],
  "Manager Review": ["Referred", "Under Review", "Rejected"],
  Referred: ["Committee Review", "Under Review"],
  "Committee Review": ["Awaiting Approval", "Approved", "Rejected", "Under Review"],
  "Awaiting Approval": ["Approved", "Rejected", "Under Review"],
  Approved: ["In Execution", "Completed", "Appealed"],
  Rejected: ["Appealed", "Closed"],
  "In Execution": ["Completed", "Reopened"],
  Completed: ["Closed", "Appealed", "Reopened"],
  Appealed: ["Reopened", "Closed"],
  Reopened: ["Under Review", "Cancelled"],
  Cancelled: ["Closed", "Reopened"],
  Closed: ["Reopened"],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return transitions[from].includes(to);
}

const citizenOnlyStatuses = new Set<ApplicationStatus>([
  "Draft",
  "Incomplete",
  "Awaiting Citizen Completion",
]);

const committeeStatuses = new Set<ApplicationStatus>([
  "Committee Review",
  "Awaiting Approval",
  "Approved",
  "Rejected",
  "In Execution",
  "Completed",
  "Appealed",
  "Closed",
]);

export function isCaseVisibleToOperations(status: ApplicationStatus): boolean {
  return !citizenOnlyStatuses.has(status);
}

export function isCaseVisibleToCommittee(status: ApplicationStatus): boolean {
  return committeeStatuses.has(status);
}

export function evaluateEligibility(
  application: Pick<ApplicationCase, "documents" | "familyMemberAr" | "universityAr">,
): EligibilityResult[] {
  const hasEnrollment = application.documents.some(
    (document) => document.type === "enrollment" && document.status === "verified",
  );

  return [
    {
      id: "rule-beneficiary",
      nameAr: "صفة المستفيد مؤكدة",
      nameEn: "Verified beneficiary status",
      status: "pass",
      inputAr: "ملف المستفيدة موثّق في سجل المنصة التجريبي",
      inputEn: "Beneficiary profile is verified in the demo registry",
      version: "EDU-ELIG-2.3",
      legalRef: "LR-EDU-04",
      explanationAr: "تمت مطابقة صفة المستفيدة مع الملف العائلي الاصطناعي.",
      explanationEn: "Beneficiary status matches the synthetic family record.",
    },
    {
      id: "rule-family",
      nameAr: "صلة القرابة",
      nameEn: "Family relationship",
      status: application.familyMemberAr ? "pass" : "fail",
      inputAr: application.familyMemberAr || "لم يُحدّد فرد الأسرة",
      inputEn: application.familyMemberAr ? "Selected family member" : "No family member selected",
      version: "EDU-ELIG-2.3",
      legalRef: "LR-EDU-07",
      explanationAr: "فرد الأسرة المختار ظاهر في عرض الأسرة 360.",
      explanationEn: "The selected member appears in Family 360.",
    },
    {
      id: "rule-study",
      nameAr: "إثبات الاستمرار بالدراسة",
      nameEn: "Active enrollment confirmation",
      status: hasEnrollment ? "pass" : "warning",
      inputAr: hasEnrollment ? "تأييد جامعي مصنّف ومتحقق" : "تأييد جامعي مطلوب",
      inputEn: hasEnrollment ? "Verified enrollment confirmation" : "Enrollment confirmation required",
      version: "EDU-ELIG-2.3",
      legalRef: "LR-EDU-11",
      explanationAr: hasEnrollment
        ? "تمت إضافة الوثيقة المطلوبة والتحقق منها في المحاكاة."
        : "لا يمكن إكمال المراجعة البشرية قبل استلام التأييد الجامعي.",
      explanationEn: hasEnrollment
        ? "The required document was added and verified in the simulation."
        : "Human review cannot finish until the enrollment confirmation is received.",
    },
    {
      id: "rule-duplicate",
      nameAr: "فحص الازدواج المحتمل",
      nameEn: "Possible duplicate check",
      status: "manual",
      inputAr: "تشابه اسمي بنسبة 32% مع سجل مغلق",
      inputEn: "32% name similarity with a closed record",
      version: "DQ-1.8",
      legalRef: "DATA-QUALITY-02",
      explanationAr: "تنبيه جودة بيانات فقط؛ لا يمنع الطلب ولا يُصدر قراراً.",
      explanationEn: "Data-quality alert only; it neither blocks nor decides the case.",
    },
  ];
}

export function hasQuorum(members: CommitteeMember[], minimum = 3): boolean {
  return members.filter((member) => member.present && !member.conflict).length >= minimum;
}

export function committeeDecisionReadiness(
  members: CommitteeMember[],
  rationale: string,
  blockingControlCount = 0,
) {
  const eligibleVotes = members.filter(
    (member) => member.present && !member.conflict && member.vote,
  );
  const approveCount = eligibleVotes.filter((member) => member.vote === "approve").length;
  const quorum = hasQuorum(members);
  return {
    quorum,
    approveCount,
    recordedVoteCount: eligibleVotes.length,
    hasRationale: Boolean(rationale.trim()),
    complianceClear: blockingControlCount === 0,
    ready:
      quorum &&
      approveCount >= 2 &&
      Boolean(rationale.trim()) &&
      blockingControlCount === 0,
  };
}

export function canPerform(persona: PersonaId, action: string): boolean {
  const permissions: Record<PersonaId, string[]> = {
    citizen: ["submit", "complete", "pay", "view-decision"],
    staff: ["review", "refer", "recommend"],
    manager: ["reassign", "approve-exception", "delegate"],
    committee: ["attend", "declare-conflict", "vote", "sign", "publish"],
    executive: ["view-insights", "drilldown"],
    admin: ["configure", "publish-config", "rollback-config", "view-audit"],
  };
  return permissions[persona].includes(action);
}

export function simulatePayment(
  payment: PaymentRecord,
  outcome: PaymentRecord["status"],
  idempotencyKey: string,
): { payment: PaymentRecord; duplicatePrevented: boolean } {
  if (payment.status === "successful" && payment.idempotencyKey === idempotencyKey) {
    return { payment, duplicatePrevented: true };
  }
  return {
    payment: {
      ...payment,
      status: outcome,
      idempotencyKey,
      reconciled: outcome === "successful",
      updatedAt: new Date().toISOString(),
    },
    duplicatePrevented: false,
  };
}
