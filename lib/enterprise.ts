import type {
  EnterpriseAction,
  EnterpriseBudgetLine,
  EnterpriseDomain,
  EnterpriseFundCode,
  EnterpriseJournalLine,
  EnterpriseRecord,
  EnterpriseRecordStatus,
  EnterpriseRoleId,
  EnterpriseState,
  EnterpriseTask,
} from "./types";

export interface EnterpriseRoleDefinition {
  id: EnterpriseRoleId;
  labelAr: string;
  labelEn: string;
  initials: string;
}

export interface EnterpriseModuleDefinition {
  id: string;
  domain: EnterpriseDomain;
  titleAr: string;
  titleEn: string;
  category: string;
  sourceAr: string;
  creatorRoles: EnterpriseRoleId[];
  approverRoles: EnterpriseRoleId[];
  posterRoles: EnterpriseRoleId[];
  viewerRoles?: EnterpriseRoleId[];
  requiresAmount: boolean;
}

export const enterpriseRoles: EnterpriseRoleDefinition[] = [
  { id: "general-employee", labelAr: "موظف عام", labelEn: "General employee", initials: "مع" },
  { id: "department-manager", labelAr: "مدير قسم", labelEn: "Department manager", initials: "مق" },
  { id: "accountant", labelAr: "محاسب", labelEn: "Accountant", initials: "مح" },
  { id: "treasurer", labelAr: "أمين صندوق", labelEn: "Treasurer", initials: "أص" },
  { id: "procurement-officer", labelAr: "مسؤول مشتريات", labelEn: "Procurement officer", initials: "مش" },
  { id: "inventory-officer", labelAr: "مسؤول مخازن وأصول", labelEn: "Inventory and assets officer", initials: "مخ" },
  { id: "hr-officer", labelAr: "مسؤول موارد بشرية", labelEn: "HR officer", initials: "مر" },
  { id: "auditor", labelAr: "مدقّق", labelEn: "Auditor", initials: "مد" },
  { id: "finance-manager", labelAr: "مدير مالي", labelEn: "Finance manager", initials: "مم" },
];

const financeDefaults = {
  domain: "finance" as const,
  sourceAr: "الـBlueprint · القسم الثامن عشر",
  creatorRoles: ["accountant"] as EnterpriseRoleId[],
  approverRoles: ["finance-manager"] as EnterpriseRoleId[],
  posterRoles: ["treasurer"] as EnterpriseRoleId[],
  requiresAmount: true,
};

const hrDefaults = {
  domain: "hr" as const,
  sourceAr: "الـBlueprint · القسم التاسع عشر",
  creatorRoles: ["hr-officer", "general-employee"] as EnterpriseRoleId[],
  approverRoles: ["department-manager"] as EnterpriseRoleId[],
  posterRoles: ["hr-officer"] as EnterpriseRoleId[],
  requiresAmount: false,
};

export const financialModules: EnterpriseModuleDefinition[] = [
  ["fin-budget", "إدارة الموازنة", "Budget Management", "foundation"],
  ["fin-ledger", "دفتر الأستاذ العام", "General Ledger", "foundation"],
  ["fin-ap", "الحسابات الدائنة", "Accounts Payable", "cash"],
  ["fin-ar", "الحسابات المدينة", "Accounts Receivable", "cash"],
  ["fin-cash", "النقد والمصارف", "Cash and Bank Management", "cash"],
  ["fin-beneficiary", "مدفوعات المستفيدين", "Beneficiary Payments", "beneficiaries"],
  ["fin-revenue", "إدارة الإيرادات", "Revenue Management", "cash"],
  ["fin-reconciliation", "المطابقة المصرفية", "Bank Reconciliation", "cash"],
  ["fin-procurement", "المشتريات", "Procurement", "supply"],
  ["fin-contracts", "العقود", "Contracts", "supply"],
  ["fin-vendors", "الموردون", "Vendors", "supply"],
  ["fin-inventory", "المخازن", "Inventory", "supply"],
  ["fin-assets", "الأصول الثابتة", "Fixed Assets", "assets"],
  ["fin-projects", "المشاريع", "Projects", "projects"],
  ["fin-grants", "المنح", "Grants", "beneficiaries"],
  ["fin-reporting", "التقارير المالية", "Financial Reporting", "reporting"],
  ["fin-audit", "دعم التدقيق", "Audit Support", "reporting"],
].map(([id, titleAr, titleEn, category]) => ({
  ...financeDefaults,
  id,
  titleAr,
  titleEn,
  category,
  creatorRoles: id === "fin-procurement" || id === "fin-contracts" || id === "fin-vendors"
    ? ["procurement-officer"]
    : id === "fin-inventory" || id === "fin-assets"
      ? ["inventory-officer"]
      : financeDefaults.creatorRoles,
  posterRoles: id === "fin-ledger" || id === "fin-reporting" || id === "fin-audit"
    ? ["accountant"]
    : financeDefaults.posterRoles,
  requiresAmount: !["fin-vendors", "fin-reporting", "fin-audit"].includes(id),
}));

export const administrativeModules: EnterpriseModuleDefinition[] = [
  ["hr-core", "الموارد البشرية", "Human Resources", "people"],
  ["hr-positions", "هيكل الوظائف", "Job Structure", "people"],
  ["hr-employees", "ملفات الموظفين", "Employee Files", "people"],
  ["hr-attendance", "الحضور", "Attendance", "people"],
  ["hr-leave", "الإجازات", "Leave", "people"],
  ["hr-payroll", "الرواتب", "Payroll", "people"],
  ["hr-training", "التدريب", "Training", "people"],
  ["hr-performance", "تقييم الأداء", "Performance", "people"],
  ["hr-tasks", "إدارة المهام", "Task Management", "operations"],
  ["hr-projects", "إدارة المشاريع", "Project Management", "operations"],
  ["hr-procurement", "المشتريات", "Procurement", "operations"],
  ["hr-contracts", "العقود", "Contracts", "operations"],
  ["hr-vendors", "الموردون", "Vendors", "operations"],
  ["hr-inventory", "المخازن", "Inventory", "assets"],
  ["hr-assets", "العُهد والأصول", "Assets and Custody", "assets"],
  ["hr-vehicles", "المركبات", "Vehicles", "assets"],
  ["hr-maintenance", "الصيانة", "Maintenance", "assets"],
  ["hr-facilities", "المرافق", "Facilities", "assets"],
].map(([id, titleAr, titleEn, category]) => ({
  ...hrDefaults,
  id,
  titleAr,
  titleEn,
  category,
  creatorRoles: id === "hr-procurement"
    ? ["general-employee", "procurement-officer"]
    : id === "hr-contracts" || id === "hr-vendors"
      ? ["procurement-officer"]
      : id === "hr-inventory"
        ? ["inventory-officer"]
        : id === "hr-assets" || id === "hr-vehicles" || id === "hr-maintenance" || id === "hr-facilities"
          ? ["general-employee", "inventory-officer"]
          : id === "hr-attendance" || id === "hr-leave" || id === "hr-training"
            ? ["general-employee", "hr-officer"]
            : id === "hr-core" || id === "hr-tasks"
              ? ["general-employee", "hr-officer", "department-manager"]
              : id === "hr-projects" || id === "hr-performance"
                ? ["department-manager"]
                : ["hr-officer"],
  approverRoles: id === "hr-payroll"
    ? ["finance-manager"]
    : id === "hr-procurement" || id === "hr-assets" || id === "hr-vehicles" || id === "hr-maintenance" || id === "hr-facilities"
      ? ["department-manager"]
      : hrDefaults.approverRoles,
  posterRoles: id === "hr-payroll"
    ? ["accountant"]
    : id === "hr-procurement" ? ["procurement-officer"]
      : id === "hr-assets" || id === "hr-vehicles" || id === "hr-maintenance" || id === "hr-facilities" ? ["inventory-officer"]
        : hrDefaults.posterRoles,
  viewerRoles: ["general-employee"],
  requiresAmount: id === "hr-payroll" || id === "hr-procurement" || id === "hr-contracts",
}));

export const enterpriseModules = [...financialModules, ...administrativeModules];

export const enterpriseFunds: Array<{ code: EnterpriseFundCode; labelAr: string; labelEn: string }> = [
  { code: "A", labelAr: "مالية المؤسسة", labelEn: "Foundation Finance" },
  { code: "B", labelAr: "مالية صندوق الشهداء", labelEn: "Martyrs Fund Finance" },
  { code: "C", labelAr: "مدفوعات المستفيدين", labelEn: "Beneficiary Payments" },
  { code: "D", labelAr: "الاستثمارات والمشاريع", labelEn: "Investments and Projects" },
];

export const enterpriseStatusLabels: Record<EnterpriseRecordStatus, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  submitted: { ar: "بانتظار الاعتماد", en: "Pending approval" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  posted: { ar: "مُرحّل", en: "Posted" },
  settled: { ar: "مُسوّى", en: "Settled" },
};

function moduleById(id: string) {
  return enterpriseModules.find((definition) => definition.id === id);
}

function roleLabel(role: EnterpriseRoleId, language: "ar" | "en" = "ar") {
  const definition = enterpriseRoles.find((item) => item.id === role) ?? enterpriseRoles[0];
  return language === "ar" ? definition.labelAr : definition.labelEn;
}

function actionLabel(action: EnterpriseAction, language: "ar" | "en" = "ar") {
  const labels: Record<EnterpriseAction, { ar: string; en: string }> = {
    create: { ar: "إنشاء", en: "Create" },
    submit: { ar: "تقديم", en: "Submit" },
    approve: { ar: "اعتماد", en: "Approve" },
    reject: { ar: "رفض", en: "Reject" },
    post: { ar: "ترحيل/معالجة", en: "Post/process" },
    settle: { ar: "تسوية", en: "Settle" },
  };
  return labels[action][language];
}

export function isJournalBalanced(lines: EnterpriseJournalLine[] = []) {
  const debit = lines.reduce((total, line) => total + line.debit, 0);
  const credit = lines.reduce((total, line) => total + line.credit, 0);
  return lines.length >= 2 && debit === credit && debit > 0;
}

export function budgetAvailable(line: EnterpriseBudgetLine) {
  return line.allocated - line.committed - line.spent;
}

const spendingModules = new Set([
  "fin-ap", "fin-beneficiary", "fin-procurement", "fin-inventory", "fin-assets", "fin-projects", "fin-grants", "hr-payroll", "hr-procurement", "hr-contracts",
]);

function journalFor(record: EnterpriseRecord): EnterpriseJournalLine[] {
  const incoming = record.moduleId === "fin-revenue" || record.moduleId === "fin-ar";
  return incoming
    ? [
        { account: "1100-البنك", debit: record.amount, credit: 0 },
        { account: "4100-الإيرادات", debit: 0, credit: record.amount },
      ]
    : [
        { account: "5100-المصروف/الاستحقاق", debit: record.amount, credit: 0 },
        { account: "2100-البنك/الذمم", debit: 0, credit: record.amount },
      ];
}

function taskFor(record: EnterpriseRecord, action: EnterpriseTask["action"], role: EnterpriseRoleId, at: string): EnterpriseTask {
  return {
    id: `ET-${record.id}-${action}`,
    recordId: record.id,
    moduleId: record.moduleId,
    assignedRole: role,
    action,
    titleAr: `${actionLabel(action === "post" ? "post" : action === "settle" ? "settle" : "approve")} · ${record.titleAr}`,
    titleEn: `${actionLabel(action === "post" ? "post" : action === "settle" ? "settle" : "approve", "en")} · ${record.titleEn}`,
    dueAt: new Date(new Date(at).getTime() + 48 * 60 * 60 * 1000).toISOString(),
    completed: false,
  };
}

export function canEnterpriseAction(
  state: EnterpriseState,
  record: EnterpriseRecord | undefined,
  action: EnterpriseAction,
  role = state.activeRole,
) {
  const definition = moduleById(record?.moduleId ?? "");
  if (!definition && action !== "create") return { allowed: false, reasonAr: "الموديول غير معروف", reasonEn: "Unknown module" };
  if (action === "create") {
    return { allowed: true, reasonAr: "مسموح حسب الموديول", reasonEn: "Allowed by module policy" };
  }
  if (!record || !definition) return { allowed: false, reasonAr: "السجل غير موجود", reasonEn: "Record not found" };
  if (action === "submit") {
    const allowed = record.status === "draft" && record.createdByRole === role;
    return { allowed, reasonAr: allowed ? "جاهز للتقديم" : "التقديم متاح للمنشئ على المسودة فقط", reasonEn: allowed ? "Ready to submit" : "Only the creator can submit a draft" };
  }
  if (action === "approve" || action === "reject") {
    const allowed = record.status === "submitted" && definition.approverRoles.includes(role) && record.createdByRole !== role;
    return { allowed, reasonAr: allowed ? "جاهز للاعتماد" : "فصل الواجبات يمنع المنشئ أو غير المخول من الاعتماد", reasonEn: allowed ? "Ready for approval" : "Segregation of duties blocks this approval" };
  }
  if (action === "post") {
    const allowed = record.status === "approved" && definition.posterRoles.includes(role) && record.approvedByRole !== role;
    return { allowed, reasonAr: allowed ? "جاهز للترحيل" : "الترحيل لدور مخول غير دور الاعتماد", reasonEn: allowed ? "Ready to post" : "Posting requires an authorized role different from approver" };
  }
  const allowed = record.status === "posted" && role === "treasurer";
  return { allowed, reasonAr: allowed ? "جاهز للتسوية" : "التسوية متاحة لأمين الصندوق بعد الترحيل", reasonEn: allowed ? "Ready to settle" : "Treasurer can settle after posting" };
}

export interface EnterpriseCreateInput {
  moduleId: string;
  title: string;
  description: string;
  amount: number;
  quantity: number;
  fund?: EnterpriseFundCode;
  budgetLineId?: string;
  reference?: string;
  decisionRef?: string;
  idempotencyKey?: string;
}

export type EnterpriseOperationResult =
  | { ok: true; state: EnterpriseState; record: EnterpriseRecord; messageAr: string; messageEn: string }
  | { ok: false; state: EnterpriseState; messageAr: string; messageEn: string };

export function createEnterpriseRecord(
  state: EnterpriseState,
  input: EnterpriseCreateInput,
  role = state.activeRole,
  at = new Date().toISOString(),
): EnterpriseOperationResult {
  const definition = moduleById(input.moduleId);
  if (!definition) return { ok: false, state, messageAr: "الموديول غير معروف", messageEn: "Unknown module" };
  if (!definition.creatorRoles.includes(role)) return { ok: false, state, messageAr: "الدور الحالي لا يملك صلاحية الإنشاء في هذا الموديول", messageEn: "Current role cannot create in this module" };
  if (input.title.trim().length < 4 || input.description.trim().length < 8) return { ok: false, state, messageAr: "أدخل عنواناً ووصفاً واضحين", messageEn: "Enter a clear title and description" };
  if (definition.requiresAmount && input.amount <= 0) return { ok: false, state, messageAr: "المبلغ يجب أن يكون أكبر من صفر", messageEn: "Amount must be greater than zero" };
  if (input.amount > 0 && (!input.fund || !input.budgetLineId)) return { ok: false, state, messageAr: "حدد الصندوق وخط الموازنة للحركة المالية", messageEn: "Select a fund and budget line" };
  if (input.moduleId === "fin-grants" && !input.decisionRef?.trim()) return { ok: false, state, messageAr: "مرجع قرار اللجنة إلزامي للمنحة", messageEn: "Committee decision reference is required" };
  const key = input.idempotencyKey?.trim() || `idem-${input.moduleId}-${Date.now()}`;
  if (state.records.some((record) => record.idempotencyKey === key)) return { ok: false, state, messageAr: "مُنع إنشاء حركة مكررة بواسطة مفتاح عدم الازدواج", messageEn: "Duplicate transaction prevented by idempotency key" };
  const record: EnterpriseRecord = {
    id: `${definition.domain === "finance" ? "FIN" : "HR"}-${String(Date.now()).slice(-8)}`,
    moduleId: definition.id,
    domain: definition.domain,
    titleAr: input.title.trim(),
    titleEn: input.title.trim(),
    description: input.description.trim(),
    amount: input.amount,
    quantity: Math.max(1, input.quantity || 1),
    fund: input.fund,
    budgetLineId: input.budgetLineId,
    reference: input.reference?.trim(),
    decisionRef: input.decisionRef?.trim(),
    idempotencyKey: key,
    origin: role === "general-employee" ? "employee-portal" : "back-office",
    ownerEmployeeId: role === "general-employee" ? state.employeeProfile.employeeId : undefined,
    ownerEmployeeNameAr: role === "general-employee" ? state.employeeProfile.fullNameAr : undefined,
    ownerEmployeeNameEn: role === "general-employee" ? state.employeeProfile.fullNameEn : undefined,
    status: "draft",
    createdByRole: role,
    createdAt: at,
    updatedAt: at,
    history: [{ id: `EH-${Date.now()}-create`, at, role, action: "create", noteAr: "تم إنشاء المسودة", noteEn: "Draft created" }],
  };
  return { ok: true, state: { ...state, records: [record, ...state.records] }, record, messageAr: "تم إنشاء السجل وحفظ المسودة", messageEn: "Record created and draft saved" };
}

export function transitionEnterpriseRecord(
  state: EnterpriseState,
  recordId: string,
  action: Exclude<EnterpriseAction, "create">,
  role = state.activeRole,
  at = new Date().toISOString(),
  note = "",
): EnterpriseOperationResult {
  const record = state.records.find((item) => item.id === recordId);
  const definition = moduleById(record?.moduleId ?? "");
  const permission = canEnterpriseAction(state, record, action, role);
  if (!record || !definition || !permission.allowed) return { ok: false, state, messageAr: permission.reasonAr, messageEn: permission.reasonEn };
  if (action === "post" && record.amount > 0) {
    const line = state.budgetLines.find((item) => item.id === record.budgetLineId && item.fund === record.fund);
    if (!line) return { ok: false, state, messageAr: "خط الموازنة غير مطابق للصندوق", messageEn: "Budget line does not match the fund" };
    if (spendingModules.has(record.moduleId) && budgetAvailable(line) < record.amount) return { ok: false, state, messageAr: "مُنع الترحيل: الرصيد المتاح في خط الموازنة غير كافٍ", messageEn: "Posting blocked: insufficient budget" };
  }
  const nextStatus: Record<typeof action, EnterpriseRecordStatus> = { submit: "submitted", approve: "approved", reject: "rejected", post: "posted", settle: "settled" };
  const journalLines = action === "post" && record.amount > 0 ? journalFor(record) : record.journalLines;
  if (action === "post" && record.amount > 0 && !isJournalBalanced(journalLines)) return { ok: false, state, messageAr: "مُنع الترحيل: القيد غير متوازن", messageEn: "Posting blocked: journal is not balanced" };
  const updated: EnterpriseRecord = {
    ...record,
    status: nextStatus[action],
    approvedByRole: action === "approve" ? role : record.approvedByRole,
    postedByRole: action === "post" ? role : record.postedByRole,
    journalLines,
    updatedAt: at,
    history: [...record.history, { id: `EH-${Date.now()}-${action}`, at, role, action, noteAr: `${actionLabel(action)} بواسطة ${roleLabel(role)}${note.trim() ? ` · ${note.trim()}` : ""}`, noteEn: `${actionLabel(action, "en")} by ${roleLabel(role, "en")}${note.trim() ? ` · ${note.trim()}` : ""}` }],
  };
  let tasks = state.tasks.map((task) => task.recordId === recordId && task.assignedRole === role && !task.completed ? { ...task, completed: true } : task);
  if (action === "submit") tasks = [taskFor(updated, "approve", definition.approverRoles[0], at), ...tasks];
  if (action === "approve") tasks = [taskFor(updated, "post", definition.posterRoles[0], at), ...tasks];
  if (action === "post" && updated.domain === "finance") tasks = [taskFor(updated, "settle", "treasurer", at), ...tasks];
  const budgetLines = action === "post" && updated.amount > 0 && spendingModules.has(updated.moduleId)
    ? state.budgetLines.map((line) => line.id === updated.budgetLineId ? { ...line, spent: line.spent + updated.amount } : line)
    : state.budgetLines;
  const leaveBalanceDays = action === "post" && updated.moduleId === "hr-leave"
    ? Math.max(0, state.leaveBalanceDays - updated.quantity)
    : state.leaveBalanceDays;
  return {
    ok: true,
    state: { ...state, records: state.records.map((item) => item.id === recordId ? updated : item), tasks, budgetLines, leaveBalanceDays },
    record: updated,
    messageAr: `تم ${actionLabel(action)} السجل وتحديث المهام والتدقيق`,
    messageEn: `Record ${actionLabel(action, "en").toLowerCase()} and work queues updated`,
  };
}

function seedHistory(status: EnterpriseRecordStatus, role: EnterpriseRoleId, approver: EnterpriseRoleId, poster: EnterpriseRoleId, at: string) {
  const actions: EnterpriseAction[] = status === "draft" ? ["create"] : status === "submitted" ? ["create", "submit"] : status === "approved" ? ["create", "submit", "approve"] : ["create", "submit", "approve", "post"];
  return actions.map((action, index) => ({ id: `SEED-${at}-${index}`, at, role: action === "approve" ? approver : action === "post" ? poster : role, action, noteAr: `${actionLabel(action)} ضمن بيانات العرض`, noteEn: `${actionLabel(action, "en")} in demo data` }));
}

const employeeSeedTitles: Record<string, [string, string]> = {
  "hr-core": ["طلب تحديث جهة اتصال الموظف أحمد كريم", "Ahmed Kareem contact update request"],
  "hr-attendance": ["تصحيح حركة حضور يوم 26 تموز", "Attendance correction for 26 July"],
  "hr-leave": ["طلب إجازة اعتيادية — أحمد كريم", "Annual leave request — Ahmed Kareem"],
  "hr-payroll": ["قسيمة راتب تموز 2026 — أحمد كريم", "July 2026 payslip — Ahmed Kareem"],
  "hr-training": ["طلب الالتحاق بدورة خدمة المستفيدين", "Beneficiary service training enrolment"],
  "hr-performance": ["تقييم الأداء النصفي — أحمد كريم", "Mid-year performance review — Ahmed Kareem"],
  "hr-tasks": ["مهمة تحديث بيانات الملف الوظيفي", "Employee file update task"],
  "hr-procurement": ["طلب شراء مستلزمات مكتبية", "Office supplies purchase request"],
  "hr-assets": ["عهدة حاسوب محمول — EMP-1024", "Laptop custody — EMP-1024"],
  "hr-maintenance": ["طلب صيانة شاشة محطة العمل", "Workstation monitor maintenance request"],
  "hr-facilities": ["طلب خدمة مرافق للمكتب", "Office facilities service request"],
};

export function createInitialEnterpriseState(): EnterpriseState {
  const budgetLines: EnterpriseBudgetLine[] = enterpriseFunds.map((fund, index) => ({
    id: `BL-${fund.code}-01`, fund: fund.code, code: `${fund.code}-2026-01`, titleAr: `اعتماد تشغيل ${fund.labelAr}`, titleEn: `${fund.labelEn} operating allocation`, allocated: 8_000_000_000 + index * 3_500_000_000, committed: 420_000_000 + index * 80_000_000, spent: 1_150_000_000 + index * 210_000_000,
  }));
  const records: EnterpriseRecord[] = enterpriseModules.map((definition, index) => {
    const fund = enterpriseFunds[index % enterpriseFunds.length].code;
    const status: EnterpriseRecordStatus = index % 4 === 0 ? "draft" : index % 4 === 1 ? "submitted" : index % 4 === 2 ? "approved" : "posted";
    const amount = definition.requiresAmount ? 240_000_000 + index * 3_250_000 : 0;
    const createdByRole = definition.creatorRoles[0];
    const at = new Date(Date.UTC(2026, 6, 20 + (index % 8), 8 + (index % 7))).toISOString();
    return {
      id: definition.id === "fin-grants" ? "GR-EDU-2026-0184" : definition.id === "fin-beneficiary" ? "PAY-BEN-2026-0184" : definition.id === "fin-ledger" ? "GL-2026-0184" : `${definition.domain === "finance" ? "FIN" : "HR"}-2026-${String(110 + index).padStart(4, "0")}`,
      moduleId: definition.id,
      domain: definition.domain,
      titleAr: definition.id === "fin-grants" ? "منحة تعليمية مرتبطة بقرار اللجنة" : definition.id === "fin-beneficiary" ? "دفعة منحة تعليمية — توزيع ٧٠/٢٠/١٠" : definition.id === "fin-ledger" ? "قيد منحة تعليمية في الصندوق C" : employeeSeedTitles[definition.id]?.[0] ?? `معاملة ${definition.titleAr}`,
      titleEn: definition.id === "fin-grants" ? "Education grant linked to committee decision" : definition.id === "fin-beneficiary" ? "Education grant payment — 70/20/10 distribution" : definition.id === "fin-ledger" ? "Education grant journal in fund C" : employeeSeedTitles[definition.id]?.[1] ?? `${definition.titleEn} transaction`,
      description: definition.id === "fin-beneficiary" ? "دفعة مستفيد اصطناعية مرتبطة بالمنحة، مع إظهار توزيع ٧٠٪ للصندوق و٢٠٪ للمؤسسة و١٠٪ للمسار المعتمد في إعداد العرض." : `سجل تشغيلي اصطناعي مرتبط بموديول ${definition.titleAr}.`,
      amount,
      quantity: definition.id === "hr-leave" ? 3 : 1,
      fund: amount > 0 ? fund : undefined,
      budgetLineId: amount > 0 ? `BL-${fund}-01` : undefined,
      reference: definition.id === "fin-grants" ? "DEC-MF-2026-0184" : definition.id === "fin-beneficiary" ? "GR-EDU-2026-0184" : definition.id === "fin-ledger" ? "PAY-BEN-2026-0184" : definition.id === "hr-payroll" ? "PAYROLL-2026-07" : `REF-${String(8200 + index)}`,
      decisionRef: definition.id === "fin-grants" ? "DEC-MF-2026-0184" : undefined,
      idempotencyKey: `idem-seed-${definition.id}`,
      origin: employeeSeedTitles[definition.id] ? "employee-portal" : "back-office",
      ownerEmployeeId: employeeSeedTitles[definition.id] ? "EMP-1024" : undefined,
      ownerEmployeeNameAr: employeeSeedTitles[definition.id] ? "أحمد كريم حسن" : undefined,
      ownerEmployeeNameEn: employeeSeedTitles[definition.id] ? "Ahmed Kareem Hassan" : undefined,
      status,
      createdByRole,
      approvedByRole: status === "approved" || status === "posted" ? definition.approverRoles[0] : undefined,
      postedByRole: status === "posted" ? definition.posterRoles[0] : undefined,
      createdAt: at,
      updatedAt: at,
      journalLines: status === "posted" && amount > 0 ? journalFor({ amount, moduleId: definition.id } as EnterpriseRecord) : undefined,
      history: seedHistory(status, createdByRole, definition.approverRoles[0], definition.posterRoles[0], at),
    };
  });
  records.push(
    {
      id: "HR-ESS-2026-0147",
      moduleId: "hr-leave",
      domain: "hr",
      titleAr: "إجازة اعتيادية من 12 إلى 14 آب",
      titleEn: "Annual leave from 12 to 14 August",
      description: "نوع الإجازة: اعتيادية · من تاريخ: 2026-08-12 · إلى تاريخ: 2026-08-14 · عدد الأيام: 3 · خطة التسليم: تسليم معاملات التعليم إلى أحمد كريم · مقدم الطلب: نور علي حسين (EMP-1047)",
      amount: 0,
      quantity: 3,
      reference: "EMP-1047-LEAVE-260812",
      idempotencyKey: "employee-EMP-1047-hr-leave-260812",
      origin: "employee-portal",
      ownerEmployeeId: "EMP-1047",
      ownerEmployeeNameAr: "نور علي حسين",
      ownerEmployeeNameEn: "Noor Ali Hussein",
      status: "submitted",
      createdByRole: "general-employee",
      createdAt: "2026-08-09T07:40:00.000Z",
      updatedAt: "2026-08-09T07:45:00.000Z",
      history: seedHistory("submitted", "general-employee", "department-manager", "hr-officer", "2026-08-09T07:40:00.000Z"),
    },
    {
      id: "HR-ESS-2026-0182",
      moduleId: "hr-maintenance",
      domain: "hr",
      titleAr: "صيانة AST-PC-3182 — عطل جهاز",
      titleEn: "Maintenance AST-PC-3182 — hardware issue",
      description: "رقم الأصل: AST-PC-3182 · نوع العطل: عطل جهاز · التأثير: العمل متعطل جزئياً · الوصف: الجهاز يعيد التشغيل أثناء إدخال المعاملات · مقدم الطلب: محمد جاسم عبد (EMP-1082)",
      amount: 0,
      quantity: 1,
      reference: "EMP-1082-MAINT-3182",
      idempotencyKey: "employee-EMP-1082-hr-maintenance-3182",
      origin: "employee-portal",
      ownerEmployeeId: "EMP-1082",
      ownerEmployeeNameAr: "محمد جاسم عبد",
      ownerEmployeeNameEn: "Mohammed Jassim Abd",
      status: "approved",
      createdByRole: "general-employee",
      approvedByRole: "department-manager",
      createdAt: "2026-08-08T09:15:00.000Z",
      updatedAt: "2026-08-09T08:20:00.000Z",
      history: seedHistory("approved", "general-employee", "department-manager", "inventory-officer", "2026-08-08T09:15:00.000Z"),
    },
    {
      id: "HR-ESS-2026-0120",
      moduleId: "hr-training",
      domain: "hr",
      titleAr: "ترشيح دورة — إدارة جودة الخدمة الحكومية",
      titleEn: "Training nomination — Government service quality",
      description: "الدورة: إدارة جودة الخدمة الحكومية · الجهة: معهد الإدارة · البدء: 2026-08-03 · الطريقة: حضوري · مقدم الطلب: زينب قاسم علي (EMP-1120)",
      amount: 0,
      quantity: 1,
      reference: "EMP-1120-TRAIN-0803",
      idempotencyKey: "employee-EMP-1120-hr-training-0803",
      origin: "employee-portal",
      ownerEmployeeId: "EMP-1120",
      ownerEmployeeNameAr: "زينب قاسم علي",
      ownerEmployeeNameEn: "Zainab Qasim Ali",
      status: "posted",
      createdByRole: "general-employee",
      approvedByRole: "department-manager",
      postedByRole: "hr-officer",
      createdAt: "2026-07-28T10:00:00.000Z",
      updatedAt: "2026-07-30T11:10:00.000Z",
      history: seedHistory("posted", "general-employee", "department-manager", "hr-officer", "2026-07-28T10:00:00.000Z"),
    },
  );
  const tasks: EnterpriseTask[] = records.flatMap((record) => {
    const definition = moduleById(record.moduleId)!;
    if (record.status === "submitted") return [taskFor(record, "approve", definition.approverRoles[0], record.updatedAt)];
    if (record.status === "approved") return [taskFor(record, "post", definition.posterRoles[0], record.updatedAt)];
    return [];
  });
  return {
    activeRole: "accountant",
    records,
    tasks,
    budgetLines,
    leaveBalanceDays: 18,
    employeeProfile: {
      employeeId: "EMP-1024",
      fullNameAr: "أحمد كريم حسن",
      fullNameEn: "Ahmed Kareem Hassan",
      jobTitleAr: "باحث معاملات أول",
      jobTitleEn: "Senior case officer",
      departmentAr: "قسم شؤون المستفيدين",
      departmentEn: "Beneficiary Affairs Department",
      managerAr: "سارة محمود",
      managerEn: "Sarah Mahmoud",
      workLocationAr: "مديرية بغداد",
      workLocationEn: "Baghdad Directorate",
      workEmail: "ahmed.kareem@martyrs.demo",
      mobile: "0770 000 1024",
      joinDate: "2019-04-14",
      bankLastFour: "4821",
      emergencyContact: "0770 555 0192",
      attendanceStatus: "not-started",
      updatedAt: "2026-07-26T08:00:00.000Z",
    },
  };
}

export function enterpriseRoleLabel(role: EnterpriseRoleId, language: "ar" | "en") {
  return roleLabel(role, language);
}

export function getEnterpriseModule(id: string) {
  return moduleById(id);
}
