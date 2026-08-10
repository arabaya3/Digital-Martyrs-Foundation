import type {
  ApplicationCase,
  CitizenCategory,
  CommitteeMember,
  DemoState,
  IntegrationAdapter,
  Notification,
  Persona,
  ServiceDefinition,
} from "./types";
import { createInitialEnterpriseState } from "./enterprise.ts";

export const personas: Persona[] = [
  {
    id: "citizen",
    labelAr: "مواطن / مستفيد",
    labelEn: "Citizen",
    nameAr: "زينب علي حسن",
    nameEn: "Zainab Ali Hassan",
    descriptionAr: "الخدمات والطلبات والوثائق",
    descriptionEn: "Services, applications and documents",
    home: "/citizen",
    initials: "زح",
  },
  {
    id: "staff",
    labelAr: "موظف معاملات",
    labelEn: "Service Employee",
    nameAr: "أحمد كريم محمود",
    nameEn: "Ahmed Kareem Mahmoud",
    descriptionAr: "صندوق المهام ومساحة الحالة",
    descriptionEn: "Task inbox and case workspace",
    home: "/staff/inbox",
    initials: "أم",
  },
  {
    id: "manager",
    labelAr: "مدير المديرية",
    labelEn: "Directorate Manager",
    nameAr: "سارة جاسم علي",
    nameEn: "Sara Jasim Ali",
    descriptionAr: "الأحمال والمهل والتصعيدات",
    descriptionEn: "Workload, SLA and escalations",
    home: "/manager",
    initials: "سع",
  },
  {
    id: "committee",
    labelAr: "عضو لجنة",
    labelEn: "Committee Member",
    nameAr: "د. مصطفى ناصر",
    nameEn: "Dr. Mustafa Nasser",
    descriptionAr: "الاجتماعات والتصويت والقرارات",
    descriptionEn: "Meetings, votes and decisions",
    home: "/committee",
    initials: "من",
  },
  {
    id: "executive",
    labelAr: "الإدارة العليا",
    labelEn: "Executive",
    nameAr: "مكتب رئيس المؤسسة",
    nameEn: "Foundation President Office",
    descriptionAr: "المؤشرات والرؤى التنفيذية",
    descriptionEn: "Executive KPIs and insights",
    home: "/executive",
    initials: "ر م",
  },
  {
    id: "admin",
    labelAr: "مدير المنصة",
    labelEn: "Platform Administrator",
    nameAr: "مسؤول النظام",
    nameEn: "Platform Administrator",
    descriptionAr: "الاستوديو والتكاملات والتدقيق",
    descriptionEn: "Studio, integrations and audit",
    home: "/studio",
    initials: "مس",
  },
];

const serviceSeed: Array<[string, string, string, string, number, number]> = [
  ["education-grant", "منحة تعليمية لأحد أفراد الأسرة", "Family Education Grant", "education", 12, 4],
  ["study-support", "دعم مستلزمات الدراسة", "Study Supplies Support", "education", 8, 3],
  ["university-letter", "تأييد استمرار بالدراسة", "University Enrollment Letter", "certificates", 3, 2],
  ["health-support", "دعم العلاج التخصصي", "Specialized Treatment Support", "health", 15, 5],
  ["medicine-support", "دعم الأدوية المزمنة", "Chronic Medicine Support", "health", 7, 3],
  ["housing-priority", "أولوية تخصيص سكن", "Housing Priority", "housing", 25, 6],
  ["land-inquiry", "استعلام تخصيص قطعة أرض", "Land Allocation Inquiry", "housing", 5, 2],
  ["employment-referral", "إحالة إلى فرص العمل", "Employment Referral", "employment", 10, 3],
  ["skills-training", "التسجيل في برنامج مهني", "Vocational Program", "employment", 6, 2],
  ["legal-consult", "طلب استشارة قانونية", "Legal Consultation", "legal", 9, 3],
  ["appeal", "تقديم اعتراض على قرار", "Decision Appeal", "legal", 20, 4],
  ["family-benefit", "تحديث استحقاق الأسرة", "Family Benefit Update", "benefits", 14, 5],
  ["caregiver-support", "دعم القائم بالرعاية", "Caregiver Support", "social", 12, 4],
  ["social-assessment", "طلب تقييم اجتماعي", "Social Assessment", "social", 18, 4],
  ["official-certificate", "إصدار شهادة رسمية", "Official Certificate", "certificates", 2, 2],
  ["beneficiary-letter", "كتاب تأييد مستفيد", "Beneficiary Confirmation", "certificates", 2, 1],
  ["family-record", "تحديث سجل الأسرة", "Family Record Update", "social", 6, 4],
  ["appointment", "حجز موعد في المديرية", "Directorate Appointment", "other", 1, 1],
  ["data-correction", "طلب تصحيح بيانات", "Data Correction", "other", 10, 3],
  ["complaint", "شكوى على خدمة", "Service Complaint", "other", 15, 2],
];

const categoryAr: Record<string, string> = {
  education: "التعليم",
  health: "الصحة",
  housing: "السكن والأراضي",
  employment: "التوظيف",
  legal: "القانونية",
  benefits: "الاستحقاقات",
  social: "الاجتماعية",
  certificates: "الشهادات",
  other: "خدمات أخرى",
};

const serviceAudiences: Record<string, CitizenCategory[]> = {
  education: ["martyr-family"],
  health: ["injured", "terrorism-victim"],
  housing: ["martyr-family", "terrorism-victim"],
  employment: ["martyr-family", "injured"],
  legal: ["martyr-family", "injured", "terrorism-victim", "missing-family"],
  benefits: ["martyr-family", "injured", "terrorism-victim", "missing-family"],
  social: ["martyr-family", "injured", "terrorism-victim", "missing-family"],
  certificates: ["martyr-family", "injured", "terrorism-victim", "missing-family"],
  other: ["martyr-family", "injured", "terrorism-victim", "missing-family"],
};

export const services: ServiceDefinition[] = serviceSeed.map(
  ([id, titleAr, titleEn, category, days, documents], index) => ({
    id,
    titleAr,
    titleEn,
    category,
    categoryAr: categoryAr[category],
    days,
    documents,
    digital: index !== 5,
    audienceAr: index < 17 ? "المستفيدون وأفراد أسرهم" : "جميع المستفيدين",
    audienceEn: index < 17 ? "Beneficiaries and family members" : "All beneficiaries",
    descriptionAr:
      id === "education-grant"
        ? "طلب موحّد لدراسة أهلية أحد أفراد الأسرة للحصول على دعم تعليمي ضمن ضوابط تجريبية واضحة."
        : `خدمة رقمية تجريبية ضمن مجال ${categoryAr[category]} مع متطلبات ومدة إنجاز معلنة.`,
    descriptionEn:
      id === "education-grant"
        ? "A unified request to assess a family member for education support under transparent demo rules."
        : `A demo digital service in ${category} with clear requirements and completion time.`,
    featured: index < 4,
    audiences: serviceAudiences[category],
    feeIqd: id === "official-certificate" ? 25000 : id === "beneficiary-letter" ? 10000 : 0,
  }),
);

export const initialAudit = Array.from({ length: 20 }, (_, index) => ({
  id: `audit-${index + 1}`,
  at: new Date(Date.UTC(2026, 6, 22, 8 + Math.floor(index / 3), (index * 7) % 60)).toISOString(),
  actor: index % 4 === 0 ? "نظام المنصة التجريبي" : index % 3 === 0 ? "زينب علي حسن" : "أحمد كريم محمود",
  actionAr: [
    "إنشاء مسودة الطلب",
    "حفظ بيانات الملف الموثّقة",
    "تحديد فرد الأسرة",
    "إضافة بيانات الدراسة",
    "رفع وثيقة وتصنيفها آلياً",
    "فحص المتطلبات",
    "حفظ المسودة تلقائياً",
    "تحديث حقول الطلب",
    "تسجيل موافقة الاستخدام",
    "توليد رقم الارتباط",
  ][index % 10],
  actionEn: [
    "Application draft created",
    "Verified profile data saved",
    "Family member selected",
    "Education data added",
    "Document uploaded and classified",
    "Requirements checked",
    "Draft autosaved",
    "Application fields updated",
    "Purpose consent recorded",
    "Correlation identifier generated",
  ][index % 10],
  source: (index % 4 === 0 ? "system" : index % 3 === 0 ? "citizen" : "staff") as
    | "system"
    | "citizen"
    | "staff",
  correlationId: `COR-26-${String(11840 + index).padStart(5, "0")}`,
  hash: `sha256:${(943802 + index * 7193).toString(16).padEnd(16, "a")}`,
}));

export const initialCase: ApplicationCase = {
  id: "MF-2026-000184",
  serviceId: "education-grant",
  citizenId: "BEN-10024",
  citizenNameAr: "زينب علي حسن",
  citizenNameEn: "Zainab Ali Hassan",
  familyMemberAr: "مريم حيدر علي",
  familyMemberEn: "Maryam Haider Ali",
  universityAr: "جامعة بغداد — كلية العلوم",
  universityEn: "University of Baghdad — College of Science",
  governorateAr: "بغداد",
  governorateEn: "Baghdad",
  status: "Draft",
  priority: "normal",
  updatedAt: "2026-07-25T09:30:00.000Z",
  slaHoursRemaining: 82,
  assignedToAr: "غير معيّن",
  assignedToEn: "Unassigned",
  documents: [
    {
      id: "doc-id",
      titleAr: "هوية المستفيدة",
      titleEn: "Beneficiary ID",
      type: "identity",
      status: "verified",
      classification: "هوية — ثقة 99%",
      source: "محفظة الوثائق",
      uploadedAt: "2026-07-20T09:00:00.000Z",
    },
    {
      id: "doc-family",
      titleAr: "بطاقة الأسرة",
      titleEn: "Family card",
      type: "family",
      status: "verified",
      classification: "سجل أسرة — ثقة 97%",
      source: "محفظة الوثائق",
      uploadedAt: "2026-07-20T09:02:00.000Z",
    },
    {
      id: "doc-results",
      titleAr: "كشف الدرجات",
      titleEn: "Academic transcript",
      type: "transcript",
      status: "review",
      classification: "كشف درجات — ثقة 91%",
      source: "رفع المواطن",
      uploadedAt: "2026-07-25T09:25:00.000Z",
    },
  ],
  audit: initialAudit,
  reviewerConfirmed: false,
  managerApproved: false,
  committeeApproved: false,
  signed: false,
  decisionPublished: false,
};

export const initialNotifications: Notification[] = Array.from(
  { length: 25 },
  (_, index) => ({
    id: `notification-${index + 1}`,
    titleAr:
      index === 0
        ? "تم حفظ طلب المنحة التعليمية"
        : index % 3 === 0
          ? "تذكير بتحديث وثيقة"
          : "تحديث على إحدى خدماتك",
    titleEn:
      index === 0
        ? "Education grant draft saved"
        : index % 3 === 0
          ? "Document update reminder"
          : "Service update",
    bodyAr:
      index === 0
        ? "يمكنك العودة إلى المسودة وإكمالها في أي وقت."
        : "إشعار تجريبي مرتبط بملفك الاصطناعي.",
    bodyEn:
      index === 0
        ? "You can return and complete the draft at any time."
        : "A demo notification linked to your synthetic profile.",
    at: new Date(Date.UTC(2026, 6, 25 - (index % 10), 8 + (index % 8))).toISOString(),
    read: index > 4,
    channel: (index % 5 === 0 ? "sms" : index % 7 === 0 ? "email" : "in-app") as
      | "sms"
      | "email"
      | "in-app",
  }),
);

export const initialCommitteeMembers: CommitteeMember[] = [
  {
    id: "cm-1",
    nameAr: "د. مصطفى ناصر",
    nameEn: "Dr. Mustafa Nasser",
    roleAr: "رئيس اللجنة",
    roleEn: "Committee Chair",
    present: true,
    conflict: false,
  },
  {
    id: "cm-2",
    nameAr: "سلوى مهدي عباس",
    nameEn: "Salwa Mahdi Abbas",
    roleAr: "عضو قانوني",
    roleEn: "Legal Member",
    present: true,
    conflict: false,
  },
  {
    id: "cm-3",
    nameAr: "ياسر عبد الجليل",
    nameEn: "Yasir Abduljalil",
    roleAr: "ممثل التعليم",
    roleEn: "Education Representative",
    present: true,
    conflict: false,
  },
  {
    id: "cm-4",
    nameAr: "نور حسين جبار",
    nameEn: "Noor Hussein Jabbar",
    roleAr: "عضو",
    roleEn: "Member",
    present: false,
    conflict: false,
  },
  {
    id: "cm-5",
    nameAr: "حسن ناظم كريم",
    nameEn: "Hassan Nazim Kareem",
    roleAr: "عضو",
    roleEn: "Member",
    present: true,
    conflict: true,
  },
];

export const integrations: IntegrationAdapter[] = [
  ["national-id", "التحقق من الهوية الوطنية", "National identity verification", "healthy", 99.7, 420, "2.4.1", "فريق الهوية", "منذ 4 دقائق", 0],
  ["payment-kit", "محول Payment Kit One", "Payment Kit One adapter", "healthy", 98.9, 680, "1.8.0", "فريق المدفوعات", "منذ 8 دقائق", 1],
  ["education", "وزارة التعليم العالي", "Ministry of Higher Education", "delayed", 94.2, 1840, "3.1.2", "فريق التكامل", "منذ 34 دقيقة", 3],
  ["sms", "بوابة الرسائل القصيرة", "SMS gateway", "healthy", 99.3, 310, "5.0.4", "فريق الإشعارات", "منذ دقيقتين", 0],
  ["email", "البريد الإلكتروني", "Email delivery", "degraded", 91.8, 980, "2.2.6", "فريق الإشعارات", "منذ 18 دقيقة", 4],
  ["signature", "التوقيع الإلكتروني", "Electronic signature", "healthy", 99.5, 520, "1.4.2", "فريق الثقة", "منذ 12 دقيقة", 0],
  ["bank", "التسوية المصرفية", "Banking reconciliation", "failed", 78.1, 2300, "0.9.8", "الفريق المالي", "منذ 3 ساعات", 7],
].map(([id, nameAr, nameEn, status, successRate, latency, version, ownerAr, lastCall, retries]) => ({
  id,
  nameAr,
  nameEn,
  status,
  successRate,
  latency,
  version,
  ownerAr,
  lastCall,
  mode: "Sandbox",
  retries,
})) as IntegrationAdapter[];

export function createInitialState(): DemoState {
  return {
    language: "ar",
    persona: "citizen",
    citizenProfile: {
      registered: true,
      category: "martyr-family",
      fullNameAr: "زينب علي حسن",
      fullNameEn: "Zainab Ali Hassan",
      mobile: "••• ••• 2041",
      email: "zainab.demo@example.test",
      governorateAr: "بغداد",
      governorateEn: "Baghdad",
      relationship: "ابنة شهيد — تصنيف أولي",
      referenceNumber: "REG-DEMO-10024",
      declarationAccepted: true,
    },
    case: structuredClone(initialCase),
    additionalApplications: [],
    notifications: structuredClone(initialNotifications),
    committeeMembers: structuredClone(initialCommitteeMembers),
    payment: {
      id: "PAY-DEMO-4409",
      invoice: "INV-DEMO-2026-0912",
      amount: 25000,
      status: "pending",
      idempotencyKey: "idem-cert-0912",
      reconciled: false,
      updatedAt: "2026-07-25T10:10:00.000Z",
    },
    wizardStep: 1,
    wizardDraft: {
      member: "maryam",
      university: "جامعة بغداد",
      year: "",
      consent: false,
      uploaded: false,
    },
    registrationDraft: {
      step: 1,
      category: "martyr-family",
      fullName: "زينب علي حسن",
      mobile: "0770 000 2041",
      email: "zainab.demo@example.test",
      governorate: "بغداد",
      relationship: "ابنة",
      reference: "REF-DEMO-2016-184",
      evidenceFileName: "",
      accepted: false,
    },
    serviceDrafts: {},
    appointment: {
      date: "2026-07-30",
      time: "10:30",
      location: "مديرية بغداد — شباك الوثائق",
      status: "scheduled",
    },
    committeeDraft: {
      notes: "",
      reason: "استناداً إلى اكتمال الوثائق واجتياز قواعد الأهلية وبعد المداولة، تقرر الموافقة على الطلب ضمن حدود العرض التجريبي.",
    },
    administration: {
      internalTicketOpen: true,
    },
    enterprise: createInitialEnterpriseState(),
    storedDocuments: [],
    studioForm: {
      fields: ["الاسم الكامل", "رقم المستفيد", "المحافظة", "صفة المستفيد"],
      selectedField: "الاسم الكامل",
      readOnlyVerified: true,
      showSource: true,
    },
    notificationTemplate: {
      arTitle: "مسودة طلبك تحتاج إكمالاً",
      enTitle: "Your application draft needs completion",
      arBody: "مرحباً {{citizen.first_name}}، بقيت خطوة واحدة لإكمال مسودة {{service.name}}. أرفق المتطلبات ثم أرسل الطلب عندما يصبح جاهزاً.",
      enBody: "Hello {{citizen.first_name}}, one step remains in your {{service.name}} draft. Attach the requirements, then submit when ready.",
      channels: ["in-app", "sms"],
    },
    testedRuleIds: [],
    ruleDraftCount: 0,
    aiEnabled: true,
    complianceResolvedControlIds: [],
    selectedWorkflowNode: "review",
    serviceVersion: "Draft",
  };
}

export const supportingApplications = Array.from({ length: 30 }, (_, index) => ({
  id: index === 0 ? "MF-2026-000184" : `MF-2026-${String(10160 + index).padStart(6, "0")}`,
  citizenAr: ["هدى فاضل", "علي قاسم", "زينب علي", "سناء كاظم"][index % 4],
  serviceAr: services[index % services.length].titleAr,
  governorateAr: ["بغداد", "البصرة", "نينوى", "كربلاء", "ذي قار"][index % 5],
  status: [
    "Submitted",
    "Under Review",
    "Committee Review",
    "Approved",
    "Completed",
    "Appealed",
  ][index % 6],
  age: `${1 + (index % 18)} س`,
  sla: index % 7 === 0 ? "خطر" : index % 4 === 0 ? "قريب" : "ضمن المهلة",
}));
