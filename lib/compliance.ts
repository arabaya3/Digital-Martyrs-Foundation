import type {
  ApplicationCase,
  ApplicationStatus,
  CommitteeMember,
} from "./types";

export type ComplianceStatus =
  | "pass"
  | "violation"
  | "needs_review"
  | "not_applicable";

export type ComplianceSeverity = "blocking" | "advisory";

export interface LegalClause {
  id: string;
  article: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  sourcePages: string;
  keywords: string[];
}

export interface ComplianceControl {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  clauseIds: string[];
  severity: ComplianceSeverity;
  category: "eligibility" | "committee" | "sla" | "benefit" | "quota" | "governance";
  version: string;
}

export interface ComplianceResult {
  control: ComplianceControl;
  status: ComplianceStatus;
  evidenceAr: string;
  evidenceEn: string;
  explanationAr: string;
  explanationEn: string;
  resolved: boolean;
}

export interface ComplianceEvaluationInput {
  application: ApplicationCase;
  committeeMembers?: CommitteeMember[];
  resolvedControlIds?: string[];
}

export interface AssistantAnswer {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  citations: string[];
  confidence: "high" | "medium";
}

export const legalClauses: LegalClause[] = [
  {
    id: "LAW-ART-1",
    article: "المادة 1",
    titleAr: "التعاريف ونطاق ذوي الشهيد",
    titleEn: "Definitions and beneficiary scope",
    summaryAr: "تُستخدم التعاريف القانونية للتحقق من الصفة وصلة القرابة قبل تطبيق أي امتياز.",
    summaryEn: "Legal definitions are used to verify status and kinship before applying a benefit.",
    sourcePages: "PDF ص 1–2",
    keywords: ["تعريف", "ذوي الشهيد", "صلة القرابة", "beneficiary", "kinship"],
  },
  {
    id: "LAW-ART-4",
    article: "المادة 4",
    titleAr: "الفئات والفترات المشمولة",
    titleEn: "Covered groups and periods",
    summaryAr: "يجب مطابقة فئة الاستشهاد والفترة مع نطاق القانون قبل استكمال المعاملة.",
    summaryEn: "The martyr category and period must match the law's scope before processing.",
    sourcePages: "PDF ص 3–4",
    keywords: ["فترة", "فئة", "مشمول", "period", "covered"],
  },
  {
    id: "LAW-ART-5",
    article: "المادة 5",
    titleAr: "الاستبعاد وأدلة الإثبات",
    titleEn: "Exclusions and proof",
    summaryAr: "تتطلب المعاملة مراجعة الاستبعادات القانونية وأدلة الإثبات المرفقة، ولا تُحسم آلياً.",
    summaryEn: "The case requires review of statutory exclusions and attached proof; it is not decided automatically.",
    sourcePages: "PDF ص 4–5",
    keywords: ["استبعاد", "البعث", "إثبات", "وثائق", "proof", "exclusion"],
  },
  {
    id: "LAW-ART-9",
    article: "المادة 9",
    titleAr: "اللجان والنصاب والمدد والاعتراض",
    titleEn: "Committees, quorum, deadlines and appeal",
    summaryAr: "تنظم المادة عمل اللجان، حسم الطلبات ضمن المدد، الاعتراض، والإحالة عند الاشتباه بالتزوير.",
    summaryEn: "The article governs committee work, decision timelines, appeal and suspected fraud referral.",
    sourcePages: "PDF ص 7–9",
    keywords: ["لجنة", "نصاب", "مدة", "اعتراض", "تزوير", "committee", "quorum", "appeal"],
  },
  {
    id: "LAW-ART-11",
    article: "المادة 11",
    titleAr: "احتساب الراتب التقاعدي",
    titleEn: "Pension calculation",
    summaryAr: "تحدد أساس احتساب الاستحقاق التقاعدي وفق الحالة والبيانات المعتمدة.",
    summaryEn: "Defines the basis for pension entitlement calculation using approved data.",
    sourcePages: "PDF ص 10–11",
    keywords: ["راتب", "تقاعد", "احتساب", "pension"],
  },
  {
    id: "LAW-ART-12",
    article: "المادة 12",
    titleAr: "توزيع الاستحقاق التقاعدي",
    titleEn: "Pension distribution",
    summaryAr: "تنظم توزيع الحقوق التقاعدية بين المستحقين وفق الضوابط.",
    summaryEn: "Governs distribution of pension rights among eligible recipients.",
    sourcePages: "PDF ص 11–12",
    keywords: ["توزيع", "مستحقين", "راتب", "distribution"],
  },
  {
    id: "LAW-ART-13",
    article: "المادة 13",
    titleAr: "منحة الأرض لمرة واحدة",
    titleEn: "One-time land grant",
    summaryAr: "تُفحص الاستفادة السابقة لمنع تكرار تخصيص الأرض خارج ما يسمح به القانون.",
    summaryEn: "Prior benefit history is checked to prevent impermissible duplicate land grants.",
    sourcePages: "PDF ص 12",
    keywords: ["أرض", "مرة واحدة", "land", "once"],
  },
  {
    id: "LAW-ART-16",
    article: "المادة 16",
    titleAr: "تعدد الشهداء في الأسرة",
    titleEn: "Multiple martyrs in one family",
    summaryAr: "تُراجع حالة الأسرة عند وجود أكثر من شهيد لتطبيق الحقوق الخاصة دون ازدواج غير مشروع.",
    summaryEn: "Families with multiple martyrs require specific entitlement handling without improper duplication.",
    sourcePages: "PDF ص 12–13",
    keywords: ["تعدد", "الأسرة", "أكثر من شهيد", "multiple"],
  },
  {
    id: "LAW-ART-17",
    article: "المادة 17",
    titleAr: "الحقوق والامتيازات والحصص",
    titleEn: "Rights, benefits and quotas",
    summaryAr: "تشمل المادة حصص التعيين والمقاعد الدراسية والحج وحقوقاً وامتيازات أخرى للمشمولين.",
    summaryEn: "The article includes employment, education and Hajj quotas plus other covered benefits.",
    sourcePages: "PDF ص 13–15",
    keywords: ["تعليم", "تعيين", "10%", "15%", "حج", "quota", "education", "jobs"],
  },
  {
    id: "LAW-ART-20",
    article: "المادة 20",
    titleAr: "الإعفاءات وأحكام المؤسسة",
    titleEn: "Exemptions and institutional provisions",
    summaryAr: "تعفى المؤسسة من الرسوم والضرائب والرسوم القضائية، وتُطبق الأحكام المرتبطة بالخدمة والمنافع وفق النص.",
    summaryEn: "The Foundation is exempt from fees, taxes and judicial fees; related service provisions follow the law.",
    sourcePages: "PDF ص 16",
    keywords: ["إعفاء", "رسوم", "ضرائب", "صحة", "fees", "taxes", "medical"],
  },
  {
    id: "LAW-ART-23",
    article: "المادة 23",
    titleAr: "إلغاء النصوص السابقة وإدارة النفاذ",
    titleEn: "Superseded provisions and effectivity",
    summaryAr: "تتطلب التعديلات واللوائح اللاحقة إدارة نسخة القانون النافذة وتحليل أثرها على الضوابط.",
    summaryEn: "Later amendments and regulations require effective-version management and control impact analysis.",
    sourcePages: "PDF ص 17–18",
    keywords: ["نسخة", "تعديل", "نفاذ", "إلغاء", "version", "amendment"],
  },
];

export const complianceControls: ComplianceControl[] = [
  ["CTL-DEF-KIN", "التحقق من صلة القرابة", "Verify kinship", "مطابقة صفة مقدم الطلب وفرد الأسرة مع التعاريف.", "Match applicant and family member against statutory definitions.", ["LAW-ART-1"], "blocking", "eligibility"],
  ["CTL-PERIOD", "الفترة المشمولة", "Covered period", "مطابقة فئة وفترة الاستشهاد مع نطاق القانون.", "Match martyr category and period to the law.", ["LAW-ART-4"], "blocking", "eligibility"],
  ["CTL-EXCLUSION-BAATH", "مراجعة الاستبعاد القانوني", "Statutory exclusion review", "توثيق مراجعة الاستبعادات دون قرار آلي.", "Document exclusion review without automated adjudication.", ["LAW-ART-5"], "blocking", "eligibility"],
  ["CTL-PROOF", "كفاية أدلة الإثبات", "Sufficiency of proof", "مراجعة بشرية للوثائق المؤيدة قبل الإحالة.", "Human review of supporting proof before referral.", ["LAW-ART-5"], "blocking", "eligibility"],
  ["CTL-COMMITTEE-QUORUM", "نصاب اللجنة وتعارض المصالح", "Committee quorum and conflict", "استبعاد الغائب والمتعارض والتحقق من ثلاثة أعضاء مؤهلين.", "Exclude absent/conflicted members and require three eligible voters.", ["LAW-ART-9"], "blocking", "committee"],
  ["CTL-SLA-DECISION", "مدة حسم الطلب", "Decision SLA", "مراقبة المدة المتبقية وإظهار التجاوز قبل القرار.", "Track remaining time and surface breaches before decision.", ["LAW-ART-9"], "blocking", "sla"],
  ["CTL-SLA-APPEAL", "مدة الاعتراض", "Appeal SLA", "تتبع تقديم الاعتراض وحسمه ضمن المدة المحددة.", "Track appeal submission and resolution within its deadline.", ["LAW-ART-9"], "blocking", "sla"],
  ["CTL-PENSION-CALC", "احتساب الراتب التقاعدي", "Pension calculation", "تطبيق معادلة الاستحقاق على خدمات التقاعد فقط.", "Apply pension formula to pension services only.", ["LAW-ART-11"], "blocking", "benefit"],
  ["CTL-PENSION-DIST", "توزيع الراتب التقاعدي", "Pension distribution", "التحقق من توزيع الاستحقاق على المستحقين.", "Verify entitlement distribution among recipients.", ["LAW-ART-12"], "blocking", "benefit"],
  ["CTL-LAND-ONCE", "منحة الأرض لمرة واحدة", "One-time land grant", "منع تكرار منحة الأرض عند وجود استفادة سابقة.", "Prevent repeat land grant after a prior benefit.", ["LAW-ART-13"], "blocking", "benefit"],
  ["CTL-MULTI-MARTYR", "تعدد الشهداء في الأسرة", "Multiple martyrs in family", "تطبيق معالجة الحقوق الخاصة عند تعدد الشهداء.", "Apply special entitlement handling for multiple martyrs.", ["LAW-ART-16"], "advisory", "benefit"],
  ["CTL-FRAUD", "الاشتباه بالتزوير", "Suspected fraud", "إحالة الاشتباه للمراجعة المختصة دون اتهام آلي.", "Refer suspected fraud for specialist review without automated accusation.", ["LAW-ART-9"], "blocking", "governance"],
  ["CTL-QUOTA-EDU", "حصة المقاعد الدراسية", "Education seat quota", "مراقبة نسبة لا تقل عن 10% للمقاعد الدراسية ضمن النطاق.", "Monitor at least a 10% education-seat quota within scope.", ["LAW-ART-17"], "blocking", "quota"],
  ["CTL-QUOTA-JOBS", "حصة التعيينات", "Employment quota", "مراقبة نسبة لا تقل عن 15% من الدرجات الوظيفية.", "Monitor at least a 15% employment quota.", ["LAW-ART-17"], "blocking", "quota"],
  ["CTL-QUOTA-HAJJ", "حصة مقاعد الحج", "Hajj quota", "مراقبة نسبة 5% من مقاعد الحج والنطاق الخاص بها.", "Monitor the 5% Hajj-seat quota and its defined scope.", ["LAW-ART-17"], "blocking", "quota"],
  ["CTL-FEES-EXEMPT", "الإعفاء من الرسوم والضرائب", "Fees and tax exemption", "منع استيفاء الرسوم والضرائب والرسوم القضائية من المؤسسة.", "Prevent charging the Foundation fees, taxes or judicial fees.", ["LAW-ART-20"], "blocking", "benefit"],
  ["CTL-MEDICAL-SLA", "متابعة العلاج والرعاية", "Medical service SLA", "مراقبة زمن إنجاز الإحالات والخدمات الطبية في مسارها.", "Monitor referrals and service timing in the medical pathway.", ["LAW-ART-20"], "advisory", "sla"],
  ["CTL-VERSIONING", "نسخة القانون النافذة", "Effective legal version", "ربط كل تقييم بنسخة قانون وضوابط مؤرخة وتحليل أثر التعديل.", "Bind every evaluation to dated law/control versions and amendment impact.", ["LAW-ART-23"], "blocking", "governance"],
].map(
  ([id, nameAr, nameEn, descriptionAr, descriptionEn, clauseIds, severity, category]) => ({
    id,
    nameAr,
    nameEn,
    descriptionAr,
    descriptionEn,
    clauseIds,
    severity,
    category,
    version: "MF-LAW-2016.2 · CTL-1.0",
  }),
) as ComplianceControl[];

const committeeStatuses = new Set<ApplicationStatus>([
  "Committee Review",
  "Awaiting Approval",
  "Approved",
  "Rejected",
]);

export function evaluateCompliance({
  application,
  committeeMembers = [],
  resolvedControlIds = [],
}: ComplianceEvaluationInput): ComplianceResult[] {
  const resolved = new Set(resolvedControlIds);
  const hasFamily = Boolean(application.familyMemberAr.trim());
  const hasEnrollment = application.documents.some(
    (document) => document.type === "enrollment" && document.status === "verified",
  );
  const committeeStage = committeeStatuses.has(application.status);
  const eligibleVoters = committeeMembers.filter(
    (member) => member.present && !member.conflict,
  ).length;

  return complianceControls.map((control) => {
    let status: ComplianceStatus = "not_applicable";
    let evidenceAr = "لا ينطبق على خدمة التعليم الحالية.";
    let evidenceEn = "Not applicable to the current education service.";
    let explanationAr = "يبقى الضابط في الكتالوج ويُفعّل تلقائياً عند استخدام الخدمة المرتبطة.";
    let explanationEn = "The control remains in the catalogue and activates for its related service.";

    switch (control.id) {
      case "CTL-DEF-KIN":
        status = hasFamily ? "pass" : "violation";
        evidenceAr = hasFamily ? `صلة الابنة موثقة: ${application.familyMemberAr}` : "فرد الأسرة غير محدد.";
        evidenceEn = hasFamily ? `Daughter relationship recorded: ${application.familyMemberEn}` : "Family member is missing.";
        explanationAr = hasFamily ? "تمت مطابقة الصلة مع ملف الأسرة التجريبي." : "لا يمكن الإحالة قبل إثبات الصلة.";
        explanationEn = hasFamily ? "The relationship matches the demo family record." : "Referral is blocked until kinship is evidenced.";
        break;
      case "CTL-PERIOD":
        status = "pass";
        evidenceAr = "فئة الحالة والفترة مسجلتان ضمن ملف المستفيد الموثق في العرض.";
        evidenceEn = "The case category and period are recorded in the verified demo profile.";
        explanationAr = "النتيجة محاكاة وتبقى بحاجة إلى سجل حكومي معتمد في الإنتاج.";
        explanationEn = "This is simulated; production requires an authoritative government registry.";
        break;
      case "CTL-EXCLUSION-BAATH":
        status = resolved.has(control.id) ? "pass" : "needs_review";
        evidenceAr = resolved.has(control.id) ? "وثّق الموظف مراجعة سجل الاستبعاد." : "لا يوجد تكامل حي مع سجل الاستبعادات.";
        evidenceEn = resolved.has(control.id) ? "Staff documented the exclusion-register review." : "No live exclusion registry is connected.";
        explanationAr = resolved.has(control.id) ? "اكتملت المراجعة البشرية ضمن إثبات المفهوم." : "يتطلب توثيق مراجعة بشرية قبل الإحالة.";
        explanationEn = resolved.has(control.id) ? "Human review is complete for the POC." : "A documented human review is required before referral.";
        break;
      case "CTL-PROOF":
        status = resolved.has(control.id) && hasEnrollment ? "pass" : "needs_review";
        evidenceAr = hasEnrollment ? "أربع وثائق بينها تأييد استمرار بالدراسة متحقق." : "تأييد الاستمرار بالدراسة غير متحقق.";
        evidenceEn = hasEnrollment ? "Four documents include verified enrollment confirmation." : "Enrollment confirmation is not verified.";
        explanationAr = resolved.has(control.id) && hasEnrollment ? "أكد الموظف كفاية الأدلة يدوياً." : "يلزم اكتمال الوثائق وتوثيق مراجعة كفايتها.";
        explanationEn = resolved.has(control.id) && hasEnrollment ? "Staff manually confirmed proof sufficiency." : "Evidence must be complete and its sufficiency documented.";
        break;
      case "CTL-COMMITTEE-QUORUM":
        status = committeeStage ? (eligibleVoters >= 3 ? "pass" : "violation") : "not_applicable";
        evidenceAr = committeeStage ? `${eligibleVoters} من 3 أعضاء مؤهلين دون تعارض.` : "لم تصل المعاملة إلى اللجنة بعد.";
        evidenceEn = committeeStage ? `${eligibleVoters} of 3 eligible, non-conflicted members.` : "The case has not reached committee stage.";
        explanationAr = committeeStage ? (eligibleVoters >= 3 ? "النصاب مكتمل." : "القرار محجوب حتى اكتمال النصاب.") : "يُفعّل الضابط عند الإحالة الرسمية.";
        explanationEn = committeeStage ? (eligibleVoters >= 3 ? "Quorum is met." : "Decision is blocked until quorum is met.") : "The control activates on formal referral.";
        break;
      case "CTL-SLA-DECISION":
        status = application.slaHoursRemaining >= 0 ? "pass" : "violation";
        evidenceAr = `${Math.abs(application.slaHoursRemaining)} ساعة ${application.slaHoursRemaining >= 0 ? "متبقية" : "متجاوزة"}.`;
        evidenceEn = `${Math.abs(application.slaHoursRemaining)} hours ${application.slaHoursRemaining >= 0 ? "remaining" : "overdue"}.`;
        explanationAr = application.slaHoursRemaining >= 0 ? "المعاملة ضمن المؤقت التشغيلي التجريبي." : "يجب توثيق معالجة التجاوز قبل القرار.";
        explanationEn = application.slaHoursRemaining >= 0 ? "The case is within the demo operational timer." : "The breach requires documented treatment before decision.";
        break;
      case "CTL-SLA-APPEAL":
        status = application.status === "Appealed" ? "pass" : "not_applicable";
        evidenceAr = application.status === "Appealed" ? "تم فتح مؤقت الاعتراض." : "لا يوجد اعتراض مسجل.";
        evidenceEn = application.status === "Appealed" ? "Appeal timer is active." : "No appeal is recorded.";
        explanationAr = "يُفعل المسار عند تسجيل اعتراض.";
        explanationEn = "The control activates when an appeal is filed.";
        break;
      case "CTL-FRAUD":
        status = "pass";
        evidenceAr = "تشابه اسمي منخفض 32%؛ لا توجد إشارة تزوير قوية.";
        evidenceEn = "Low 32% name similarity; no strong fraud signal.";
        explanationAr = "تنبيه جودة بيانات فقط ولا يصدر اتهاماً أو قراراً آلياً.";
        explanationEn = "Data-quality alert only; no automated accusation or decision.";
        break;
      case "CTL-QUOTA-EDU":
        status = "pass";
        evidenceAr = "المقاعد المخصصة في بيانات العرض: 12.4% (الحد الأدنى 10%).";
        evidenceEn = "Demo allocated seats: 12.4% (minimum 10%).";
        explanationAr = "المؤشر تجميعي محاكى ولا يقرر أهلية هذه الحالة منفردة.";
        explanationEn = "This is a simulated aggregate indicator and does not decide this case.";
        break;
      case "CTL-VERSIONING":
        status = "pass";
        evidenceAr = "MF-LAW-2016.2 · CTL-1.0 · تاريخ تقييم محفوظ.";
        evidenceEn = "MF-LAW-2016.2 · CTL-1.0 · evaluation timestamp retained.";
        explanationAr = "كل نتيجة مرتبطة بنسخة مرجع وضابط ظاهرة للمستخدم.";
        explanationEn = "Every result is tied to a visible legal and control version.";
        break;
      default:
        break;
    }

    return {
      control,
      status,
      evidenceAr,
      evidenceEn,
      explanationAr,
      explanationEn,
      resolved: resolved.has(control.id),
    };
  });
}

export function getBlockingComplianceResults(results: ComplianceResult[]) {
  return results.filter(
    (result) =>
      result.control.severity === "blocking" &&
      (result.status === "violation" || result.status === "needs_review"),
  );
}

export function getClauseForControl(control: ComplianceControl) {
  return control.clauseIds
    .map((id) => legalClauses.find((clause) => clause.id === id))
    .filter((clause): clause is LegalClause => Boolean(clause));
}

export function retrieveLegalKnowledge(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return legalClauses;
  return legalClauses.filter((clause) =>
    [
      clause.article,
      clause.titleAr,
      clause.titleEn,
      clause.summaryAr,
      clause.summaryEn,
      ...clause.keywords,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}

export function answerLegalAssistant(
  questionId: "documents" | "education" | "status" | "fees" | "appeal",
  application: ApplicationCase,
): AssistantAnswer {
  const hasEnrollment = application.documents.some(
    (document) => document.type === "enrollment" && document.status === "verified",
  );
  const answers: Record<typeof questionId, AssistantAnswer> = {
    documents: {
      titleAr: "ما الذي يلزم لهذه الحالة؟",
      titleEn: "What does this case need?",
      bodyAr: hasEnrollment
        ? "ملف العرض يحتوي هوية المستفيدة، بطاقة الأسرة، كشف الدرجات، وتأييد الاستمرار بالدراسة. الموظف يبقى مسؤولاً عن مراجعة كفاية الإثبات قبل الإحالة."
        : "ينقص ملف العرض تأييد حديث للاستمرار بالدراسة. لا ينتقل الطلب للموظف في الفلو إلا بعد أن يُكمل المواطن كل المتطلبات ويرسله.",
      bodyEn: hasEnrollment
        ? "The demo file includes beneficiary ID, family card, transcript and enrollment confirmation. Staff still reviews proof sufficiency before referral."
        : "The demo file is missing a recent enrollment confirmation. The flow does not expose an incomplete request to staff.",
      citations: ["المادة 1", "المادة 4", "المادة 5"],
      confidence: "high",
    },
    education: {
      titleAr: "ميزة التعليم في القانون",
      titleEn: "Education benefit under the law",
      bodyAr: "تتضمن المادة 17 حقوقاً تعليمية، ومنها تخصيص نسبة لا تقل عن 10% من المقاعد الدراسية ضمن الشروط والتعليمات. هذا شرح عام وليس تأكيد أهلية فردية.",
      bodyEn: "Article 17 includes education rights, including at least a 10% seat allocation within applicable conditions. This is general guidance, not an individual eligibility finding.",
      citations: ["المادة 17/سابعاً"],
      confidence: "high",
    },
    status: {
      titleAr: "حالة الطلب في العرض",
      titleEn: "Demo application status",
      bodyAr: `الحالة الحالية: ${application.status}. أستطيع شرح المرحلة فقط؛ القرار القانوني يبقى للموظف واللجنة حسب الصلاحية.`,
      bodyEn: `Current status: ${application.status}. I can explain the stage only; authorized staff and committee retain decision responsibility.`,
      citations: ["سجل المعاملة", "المادة 9"],
      confidence: "high",
    },
    fees: {
      titleAr: "الإعفاءات",
      titleEn: "Exemptions",
      bodyAr: "تنص المادة 20/أولاً على إعفاء المؤسسة من الرسوم والضرائب والرسوم القضائية. يجب التحقق من انطباق النص على المعاملة والجهة قبل أي إجراء مالي.",
      bodyEn: "Article 20/First exempts the Foundation from fees, taxes and judicial fees. Applicability to a transaction and entity must be verified before financial action.",
      citations: ["المادة 20/أولاً"],
      confidence: "high",
    },
    appeal: {
      titleAr: "الاعتراض والمراجعة",
      titleEn: "Appeal and review",
      bodyAr: "ينظم مسار المادة 9 الاعتراض ومراجعته ضمن المدد. لا يوجد اعتراض مسجل على هذه المعاملة حالياً.",
      bodyEn: "Article 9 governs appeal and review within set timelines. No appeal is currently recorded for this case.",
      citations: ["المادة 9/خامساً–سادساً"],
      confidence: "medium",
    },
  };
  return answers[questionId];
}
