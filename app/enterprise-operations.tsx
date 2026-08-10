"use client";

/* eslint-disable @next/next/no-assign-module-variable -- domain catalogue items use the conventional ERP name "module". */

import { useMemo, useState } from "react";
import {
  administrativeModules,
  budgetAvailable,
  canEnterpriseAction,
  createEnterpriseRecord,
  enterpriseFunds,
  enterpriseRoleLabel,
  enterpriseRoles,
  enterpriseStatusLabels,
  financialModules,
  getEnterpriseModule,
  isJournalBalanced,
  transitionEnterpriseRecord,
  type EnterpriseCreateInput,
  type EnterpriseModuleDefinition,
} from "@/lib/enterprise";
import type {
  AuditEvent,
  DemoState,
  EnterpriseAction,
  EnterpriseFundCode,
  EnterpriseRecord,
  EnterpriseRecordStatus,
  EnterpriseRoleId,
  Notification,
} from "@/lib/types";

type Props = {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  domain: "finance" | "hr";
  moduleId?: string;
  mode?: "operations" | "employee" | "manager";
};

const employeeModuleIds = [
  "hr-core",
  "hr-attendance",
  "hr-leave",
  "hr-payroll",
  "hr-training",
  "hr-performance",
  "hr-tasks",
  "hr-procurement",
  "hr-assets",
  "hr-maintenance",
  "hr-facilities",
] as const;

const employeeModuleIcons: Record<string, string> = {
  "hr-core": "◎",
  "hr-attendance": "◷",
  "hr-leave": "☼",
  "hr-payroll": "◈",
  "hr-training": "△",
  "hr-performance": "◇",
  "hr-tasks": "▤",
  "hr-procurement": "▦",
  "hr-assets": "▧",
  "hr-maintenance": "⚙",
  "hr-facilities": "⌂",
};

type EmployeeRequestField = {
  id: string;
  labelAr: string;
  labelEn: string;
  type: "text" | "textarea" | "select" | "date" | "time" | "number";
  placeholderAr?: string;
  placeholderEn?: string;
  required?: boolean;
  wide?: boolean;
  options?: Array<[string, string, string]>;
};

type EmployeeRequestSchema = {
  headingAr: string;
  headingEn: string;
  ownerAr: string;
  ownerEn: string;
  slaAr: string;
  slaEn: string;
  fields: EmployeeRequestField[];
};

const employeeRequestSchemas: Record<string, EmployeeRequestSchema> = {
  "hr-core": {
    headingAr: "طلب تعديل بيانات وظيفية",
    headingEn: "Employee data change request",
    ownerAr: "الموارد البشرية",
    ownerEn: "Human Resources",
    slaAr: "يومان عمل",
    slaEn: "2 business days",
    fields: [
      { id: "changeType", labelAr: "البيان المطلوب تعديله", labelEn: "Field to change", type: "select", required: true, options: [["mobile", "رقم الهاتف", "Mobile number"], ["email", "البريد الوظيفي", "Work email"], ["bank", "الحساب البنكي", "Bank account"], ["address", "عنوان السكن", "Home address"]] },
      { id: "currentValue", labelAr: "القيمة الحالية", labelEn: "Current value", type: "text", required: true },
      { id: "newValue", labelAr: "القيمة الجديدة", labelEn: "New value", type: "text", required: true },
      { id: "reason", labelAr: "سبب التعديل والمستند المؤيد", labelEn: "Reason and supporting evidence", type: "textarea", required: true, wide: true, placeholderAr: "اشرح سبب التعديل واذكر المستند الذي ستقدمه…", placeholderEn: "Explain the change and supporting document…" },
    ],
  },
  "hr-attendance": {
    headingAr: "طلب تصحيح حركة دوام",
    headingEn: "Attendance correction request",
    ownerAr: "الموارد البشرية ثم المدير المباشر",
    ownerEn: "HR then direct manager",
    slaAr: "يوم عمل",
    slaEn: "1 business day",
    fields: [
      { id: "date", labelAr: "تاريخ الحركة", labelEn: "Attendance date", type: "date", required: true },
      { id: "issue", labelAr: "نوع التصحيح", labelEn: "Correction type", type: "select", required: true, options: [["missing-in", "نسيان تسجيل الحضور", "Missing check-in"], ["missing-out", "نسيان تسجيل الانصراف", "Missing check-out"], ["mission", "مهمة رسمية خارج الموقع", "Official off-site duty"], ["device", "عطل جهاز البصمة", "Attendance device issue"]] },
      { id: "actualTime", labelAr: "الوقت الصحيح", labelEn: "Correct time", type: "time", required: true },
      { id: "reason", labelAr: "التوضيح", labelEn: "Explanation", type: "textarea", required: true, wide: true, placeholderAr: "اذكر ما حدث والمرجع إن وجد…", placeholderEn: "Describe what happened and any reference…" },
    ],
  },
  "hr-leave": {
    headingAr: "طلب إجازة جديد",
    headingEn: "New leave request",
    ownerAr: "المدير المباشر ثم الموارد البشرية",
    ownerEn: "Direct manager then HR",
    slaAr: "يومان عمل",
    slaEn: "2 business days",
    fields: [
      { id: "leaveType", labelAr: "نوع الإجازة", labelEn: "Leave type", type: "select", required: true, options: [["annual", "اعتيادية", "Annual"], ["sick", "مرضية", "Sick"], ["emergency", "طارئة", "Emergency"], ["unpaid", "بدون راتب", "Unpaid"]] },
      { id: "startDate", labelAr: "من تاريخ", labelEn: "Start date", type: "date", required: true },
      { id: "endDate", labelAr: "إلى تاريخ", labelEn: "End date", type: "date", required: true },
      { id: "days", labelAr: "عدد الأيام", labelEn: "Number of days", type: "number", required: true },
      { id: "handover", labelAr: "خطة تسليم العمل والبديل", labelEn: "Handover and backup employee", type: "textarea", required: true, wide: true, placeholderAr: "المهام المفتوحة واسم الموظف البديل…", placeholderEn: "Open tasks and backup employee…" },
    ],
  },
  "hr-training": {
    headingAr: "طلب ترشيح لدورة تدريبية",
    headingEn: "Training nomination request",
    ownerAr: "المدير المباشر ثم وحدة التدريب",
    ownerEn: "Direct manager then Training Unit",
    slaAr: "3 أيام عمل",
    slaEn: "3 business days",
    fields: [
      { id: "course", labelAr: "اسم الدورة", labelEn: "Course title", type: "text", required: true, placeholderAr: "مثال: إدارة ملفات المستفيدين", placeholderEn: "e.g. Beneficiary case management" },
      { id: "provider", labelAr: "الجهة المقدمة", labelEn: "Training provider", type: "text", required: true },
      { id: "startDate", labelAr: "تاريخ البدء", labelEn: "Start date", type: "date", required: true },
      { id: "mode", labelAr: "طريقة التدريب", labelEn: "Delivery mode", type: "select", required: true, options: [["onsite", "حضوري", "On-site"], ["online", "عن بُعد", "Online"], ["hybrid", "مدمج", "Hybrid"]] },
      { id: "reason", labelAr: "علاقة الدورة بالعمل", labelEn: "Job relevance", type: "textarea", required: true, wide: true },
    ],
  },
  "hr-tasks": {
    headingAr: "طلب خدمة داخلية",
    headingEn: "Internal service request",
    ownerAr: "مكتب المدير / الجهة المختصة",
    ownerEn: "Manager Office / responsible unit",
    slaAr: "بحسب نوع الطلب",
    slaEn: "Based on request type",
    fields: [
      { id: "requestType", labelAr: "نوع الخدمة", labelEn: "Service type", type: "select", required: true, options: [["letter", "كتاب أو مخاطبة داخلية", "Internal letter"], ["access", "صلاحية نظام", "System access"], ["data", "تحديث ملف وظيفي", "Employee file update"], ["other", "طلب إداري آخر", "Other administrative request"]] },
      { id: "subject", labelAr: "موضوع الطلب", labelEn: "Request subject", type: "text", required: true },
      { id: "priority", labelAr: "الأولوية", labelEn: "Priority", type: "select", required: true, options: [["normal", "اعتيادية", "Normal"], ["high", "عالية — مع توضيح السبب", "High — reason required"]] },
      { id: "details", labelAr: "التفاصيل والنتيجة المطلوبة", labelEn: "Details and requested outcome", type: "textarea", required: true, wide: true },
    ],
  },
  "hr-procurement": {
    headingAr: "طلب شراء داخلي",
    headingEn: "Internal purchase request",
    ownerAr: "المدير المباشر ثم المشتريات",
    ownerEn: "Direct manager then Procurement",
    slaAr: "5 أيام عمل بعد الاعتماد",
    slaEn: "5 business days after approval",
    fields: [
      { id: "category", labelAr: "فئة المادة", labelEn: "Item category", type: "select", required: true, options: [["office", "قرطاسية ومكتبية", "Office supplies"], ["it", "تقنية معلومات", "IT equipment"], ["service", "خدمة تشغيلية", "Operational service"], ["other", "أخرى", "Other"]] },
      { id: "item", labelAr: "المادة أو الخدمة", labelEn: "Item or service", type: "text", required: true },
      { id: "quantity", labelAr: "الكمية", labelEn: "Quantity", type: "number", required: true },
      { id: "estimatedAmount", labelAr: "الكلفة التقديرية — د.ع", labelEn: "Estimated cost — IQD", type: "number", required: true },
      { id: "neededBy", labelAr: "مطلوب قبل", labelEn: "Required by", type: "date", required: true },
      { id: "justification", labelAr: "مبرر الحاجة ومكان الاستخدام", labelEn: "Business need and use location", type: "textarea", required: true, wide: true },
    ],
  },
  "hr-assets": {
    headingAr: "طلب عهدة أو إجراء على أصل",
    headingEn: "Asset and custody request",
    ownerAr: "المدير المباشر ثم الأصول والمخازن",
    ownerEn: "Direct manager then Assets and Inventory",
    slaAr: "3 أيام عمل",
    slaEn: "3 business days",
    fields: [
      { id: "requestType", labelAr: "نوع الإجراء", labelEn: "Action type", type: "select", required: true, options: [["new", "عهدة جديدة", "New custody"], ["return", "إرجاع عهدة", "Return asset"], ["transfer", "نقل عهدة", "Transfer custody"], ["replace", "استبدال أصل", "Replace asset"]] },
      { id: "assetCategory", labelAr: "نوع الأصل", labelEn: "Asset category", type: "select", required: true, options: [["laptop", "حاسوب محمول", "Laptop"], ["desktop", "حاسوب مكتبي", "Desktop"], ["phone", "هاتف وظيفي", "Work phone"], ["furniture", "أثاث مكتبي", "Office furniture"]] },
      { id: "assetTag", labelAr: "رقم الأصل الحالي إن وجد", labelEn: "Existing asset tag, if any", type: "text" },
      { id: "neededBy", labelAr: "التاريخ المطلوب", labelEn: "Required date", type: "date", required: true },
      { id: "reason", labelAr: "سبب الطلب وموقع الاستخدام", labelEn: "Reason and use location", type: "textarea", required: true, wide: true },
    ],
  },
  "hr-maintenance": {
    headingAr: "بلاغ صيانة أصل وظيفي",
    headingEn: "Work asset maintenance ticket",
    ownerAr: "فريق الصيانة والأصول",
    ownerEn: "Maintenance and Assets Team",
    slaAr: "حرج: 4 ساعات · اعتيادي: يومان",
    slaEn: "Critical: 4 hours · Normal: 2 days",
    fields: [
      { id: "assetTag", labelAr: "رقم الأصل / العهدة", labelEn: "Asset tag", type: "text", required: true, placeholderAr: "مثال: AST-LT-2041", placeholderEn: "e.g. AST-LT-2041" },
      { id: "issue", labelAr: "نوع العطل", labelEn: "Issue type", type: "select", required: true, options: [["hardware", "عطل جهاز", "Hardware"], ["power", "كهرباء أو طاقة", "Power"], ["screen", "شاشة أو ملحقات", "Display or peripherals"], ["other", "عطل آخر", "Other"]] },
      { id: "severity", labelAr: "درجة التأثير", labelEn: "Impact", type: "select", required: true, options: [["normal", "يمكن متابعة العمل", "Work can continue"], ["high", "العمل متعطل جزئياً", "Partially blocked"], ["critical", "العمل متوقف", "Work stopped"]] },
      { id: "details", labelAr: "وصف العطل وما تم تجربته", labelEn: "Issue details and troubleshooting", type: "textarea", required: true, wide: true },
    ],
  },
  "hr-facilities": {
    headingAr: "طلب خدمة مرافق",
    headingEn: "Facilities service request",
    ownerAr: "إدارة المرافق",
    ownerEn: "Facilities Management",
    slaAr: "يومان عمل",
    slaEn: "2 business days",
    fields: [
      { id: "location", labelAr: "المبنى / الطابق / الغرفة", labelEn: "Building / floor / room", type: "text", required: true },
      { id: "service", labelAr: "نوع الخدمة", labelEn: "Service type", type: "select", required: true, options: [["electric", "كهرباء وإنارة", "Electricity and lighting"], ["ac", "تبريد وتكييف", "Air conditioning"], ["cleaning", "تنظيف", "Cleaning"], ["furniture", "أثاث وتجهيز", "Furniture and setup"]] },
      { id: "preferredDate", labelAr: "موعد المعالجة المناسب", labelEn: "Preferred service date", type: "date", required: true },
      { id: "details", labelAr: "وصف الحاجة وتأثيرها", labelEn: "Need and operational impact", type: "textarea", required: true, wide: true },
    ],
  },
};

function buildEmployeeRequest(moduleId: string, values: Record<string, string>, state: DemoState): { input?: EnterpriseCreateInput; errorAr?: string; errorEn?: string } {
  const schema = employeeRequestSchemas[moduleId];
  if (!schema) return { errorAr: "هذا الموديول للعرض الشخصي ولا يدعم إنشاء طلب جديد", errorEn: "This personal-view module does not create requests" };
  const missing = schema.fields.find((field) => field.required && !values[field.id]?.trim());
  if (missing) return { errorAr: `أكمل حقل: ${missing.labelAr}`, errorEn: `Complete: ${missing.labelEn}` };
  const profile = state.enterprise.employeeProfile;
  const display = (fieldId: string) => {
    const field = schema.fields.find((item) => item.id === fieldId);
    const value = values[fieldId] ?? "";
    return field?.options?.find(([id]) => id === value)?.[1] ?? value;
  };
  const titleByModule: Record<string, string> = {
    "hr-core": `تعديل بيانات وظيفية — ${display("changeType")}`,
    "hr-attendance": `تصحيح دوام ${values.date ?? ""} — ${display("issue")}`,
    "hr-leave": `إجازة ${display("leaveType")} من ${values.startDate ?? ""} إلى ${values.endDate ?? ""}`,
    "hr-training": `ترشيح دورة — ${values.course ?? ""}`,
    "hr-tasks": `${display("requestType")} — ${values.subject ?? ""}`,
    "hr-procurement": `طلب شراء ${values.item ?? ""}`,
    "hr-assets": `${display("requestType")} — ${display("assetCategory")}`,
    "hr-maintenance": `صيانة ${values.assetTag ?? ""} — ${display("issue")}`,
    "hr-facilities": `${display("service")} — ${values.location ?? ""}`,
  };
  const description = schema.fields.map((field) => `${field.labelAr}: ${display(field.id) || "—"}`).join(" · ");
  const amount = moduleId === "hr-procurement" ? Number(values.estimatedAmount || 0) : 0;
  const quantity = Number(values.days || values.quantity || 1);
  const token = String(Date.now()).slice(-6);
  return {
    input: {
      moduleId,
      title: titleByModule[moduleId] || schema.headingAr,
      description: `${description} · مقدم الطلب: ${profile.fullNameAr} (${profile.employeeId})`,
      amount,
      quantity,
      fund: amount > 0 ? "A" : undefined,
      budgetLineId: amount > 0 ? "BL-A-01" : undefined,
      reference: `${profile.employeeId}-${moduleId.replace("hr-", "").toUpperCase()}-${token}`,
      idempotencyKey: `employee-${profile.employeeId}-${moduleId}-${token}`,
    },
  };
}

const statusTone: Record<EnterpriseRecordStatus, string> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  rejected: "danger",
  posted: "success",
  settled: "success",
};

const actionCopy: Record<Exclude<EnterpriseAction, "create">, { ar: string; en: string }> = {
  submit: { ar: "تقديم للاعتماد", en: "Submit for approval" },
  approve: { ar: "اعتماد", en: "Approve" },
  reject: { ar: "رفض مسبب", en: "Reject with reason" },
  post: { ar: "ترحيل / معالجة", en: "Post / process" },
  settle: { ar: "تسوية", en: "Settle" },
};

function number(value: number, ar: boolean) {
  return new Intl.NumberFormat(ar ? "ar-IQ" : "en-GB", { maximumFractionDigits: 0 }).format(value);
}

function roleCanView(definition: EnterpriseModuleDefinition, role: EnterpriseRoleId) {
  return role === "auditor" || [...definition.creatorRoles, ...definition.approverRoles, ...definition.posterRoles, ...(definition.viewerRoles ?? [])].includes(role);
}

function statusBadge(record: EnterpriseRecord, ar: boolean) {
  return <span className={`status-badge status-${statusTone[record.status]}`}><i />{enterpriseStatusLabels[record.status][ar ? "ar" : "en"]}</span>;
}

function employeeRequestStage(record: EnterpriseRecord, ar: boolean) {
  if (record.status === "draft") return ar ? "مسودة عند الموظف — لم تُرسل بعد" : "Employee draft — not submitted";
  if (record.status === "submitted") return ar ? "عند المدير المباشر للاعتماد" : "With direct manager for approval";
  if (record.status === "approved") return ar ? "معتمدة — عند الجهة المختصة للتنفيذ" : "Approved — with fulfilment team";
  if (record.status === "posted" || record.status === "settled") return ar ? "تم التنفيذ والإغلاق" : "Fulfilled and closed";
  return ar ? "مرفوضة — راجع سبب القرار" : "Rejected — review the decision reason";
}

function nextStep(record: EnterpriseRecord, definition: EnterpriseModuleDefinition, ar: boolean) {
  if (record.status === "draft") return ar ? `التقديم بواسطة ${enterpriseRoleLabel(record.createdByRole, "ar")}` : `Submit by ${enterpriseRoleLabel(record.createdByRole, "en")}`;
  if (record.status === "submitted") return ar ? `الاعتماد بواسطة ${enterpriseRoleLabel(definition.approverRoles[0], "ar")}` : `Approve by ${enterpriseRoleLabel(definition.approverRoles[0], "en")}`;
  if (record.status === "approved") return ar ? `الترحيل بواسطة ${enterpriseRoleLabel(definition.posterRoles[0], "ar")}` : `Post by ${enterpriseRoleLabel(definition.posterRoles[0], "en")}`;
  if (record.status === "posted" && record.domain === "finance") return ar ? "التسوية بواسطة أمين الصندوق" : "Settlement by treasurer";
  return ar ? "لا إجراء وارد حالياً" : "No incoming action";
}

function makeAudit(record: EnterpriseRecord, actionAr: string, actionEn: string, role: EnterpriseRoleId, count: number): AuditEvent {
  const at = new Date().toISOString();
  return {
    id: `audit-enterprise-${Date.now()}`,
    at,
    actor: enterpriseRoleLabel(role, "ar"),
    actionAr: `${actionAr} · ${record.id}`,
    actionEn: `${actionEn} · ${record.id}`,
    source: "system",
    correlationId: `COR-ERP-${String(13000 + count).padStart(5, "0")}`,
    hash: `sha256:${(Date.now() * 19).toString(16).slice(-16).padStart(16, "0")}`,
  };
}

function makeNotification(record: EnterpriseRecord, actionAr: string, actionEn: string): Notification {
  return {
    id: `enterprise-notification-${Date.now()}`,
    titleAr: `${actionAr}: ${record.titleAr}`,
    titleEn: `${actionEn}: ${record.titleEn}`,
    bodyAr: `تم تحديث ${record.id} إلى حالة ${enterpriseStatusLabels[record.status].ar}.`,
    bodyEn: `${record.id} moved to ${enterpriseStatusLabels[record.status].en}.`,
    at: new Date().toISOString(),
    read: false,
    channel: "in-app",
  };
}

function RoleStrip({ state, setState, toast }: Pick<Props, "state" | "setState" | "toast">) {
  const ar = state.language === "ar";
  const active = enterpriseRoles.find((role) => role.id === state.enterprise.activeRole) ?? enterpriseRoles[0];
  return <section className="enterprise-role-strip">
    <div className="enterprise-role-current"><span>{active.initials}</span><p><small>{ar ? "الدور التشغيلي الحالي" : "CURRENT OPERATING ROLE"}</small><strong>{ar ? active.labelAr : active.labelEn}</strong></p></div>
    <label><span>{ar ? "تبديل الدور لإكمال فصل الواجبات" : "Switch role to complete segregation of duties"}</span><select value={active.id} onChange={(event) => { const role = event.target.value as EnterpriseRoleId; setState((previous) => ({ ...previous, enterprise: { ...previous.enterprise, activeRole: role } })); toast(ar ? `تم التبديل إلى ${enterpriseRoleLabel(role, "ar")}` : `Switched to ${enterpriseRoleLabel(role, "en")}`); }}>{enterpriseRoles.map((role) => <option key={role.id} value={role.id}>{ar ? role.labelAr : role.labelEn}</option>)}</select></label>
    <div className="enterprise-simulation-note"><b>POC</b><span>{ar ? "صلاحيات وقيود محاكاة — لا تمثل IAM أو ترحيلاً مالياً إنتاجياً" : "Simulated controls — not production IAM or financial posting"}</span></div>
  </section>;
}

function EmployeeContextStrip({ state, navigate }: Pick<Props, "state" | "navigate">) {
  const ar = state.language === "ar";
  const profile = state.enterprise.employeeProfile;
  return <section className="employee-context-strip"><span>{ar ? "أك" : "AK"}</span><p><small>{ar ? "نطاق الموظف المؤسسي" : "EMPLOYEE ENTERPRISE SCOPE"}</small><strong>{ar ? profile.fullNameAr : profile.fullNameEn}</strong><em>{profile.employeeId} · {ar ? profile.departmentAr : profile.departmentEn}</em></p><div><b>✓</b><small>{ar ? "تعرض الشاشة بيانات الموظف وطلباته فقط؛ الاعتماد يبقى لدى المدير أو الجهة المختصة." : "This view shows the employee's own data and requests; approvals remain with the manager or responsible team."}</small></div><button className="button button-secondary" onClick={() => navigate("/staff/erp")}>{ar ? "الرئيسية" : "Portal home"} ←</button></section>;
}

function EmployeeRequestForm({
  schema,
  values,
  setValue,
  submit,
  close,
  error,
  ar,
}: {
  schema: EmployeeRequestSchema;
  values: Record<string, string>;
  setValue: (id: string, value: string) => void;
  submit: () => void;
  close: () => void;
  error: string;
  ar: boolean;
}) {
  return <section className="content-card enterprise-create-form employee-specific-request-form">
    <header><div><span className="eyebrow">STRUCTURED EMPLOYEE REQUEST</span><h2>{ar ? schema.headingAr : schema.headingEn}</h2><p>{ar ? "الحقول أدناه خاصة بهذه الخدمة وتنتقل كما هي إلى صاحب الصلاحية." : "These fields are specific to this service and are routed to the responsible role."}</p></div><span className="status-badge status-neutral"><i />{ar ? "مسودة شخصية" : "Personal draft"}</span></header>
    <div className="employee-request-routing"><div><span>1</span><p><small>{ar ? "مقدم الطلب" : "REQUESTER"}</small><strong>{ar ? "الموظف" : "Employee"}</strong></p></div><i>←</i><div><span>2</span><p><small>{ar ? "الاعتماد" : "APPROVAL"}</small><strong>{ar ? "المدير المباشر" : "Direct manager"}</strong></p></div><i>←</i><div><span>3</span><p><small>{ar ? "التنفيذ" : "FULFILMENT"}</small><strong>{ar ? schema.ownerAr : schema.ownerEn}</strong></p></div></div>
    <div className="enterprise-form-grid employee-specific-fields">{schema.fields.map((field) => <label key={field.id} className={field.wide ? "enterprise-form-wide" : ""}><span>{ar ? field.labelAr : field.labelEn}{field.required ? " *" : ""}</span>{field.type === "select" ? <select value={values[field.id] ?? ""} onChange={(event) => setValue(field.id, event.target.value)}><option value="">{ar ? "اختر…" : "Select…"}</option>{field.options?.map(([id, labelAr, labelEn]) => <option key={id} value={id}>{ar ? labelAr : labelEn}</option>)}</select> : field.type === "textarea" ? <textarea rows={3} value={values[field.id] ?? ""} onChange={(event) => setValue(field.id, event.target.value)} placeholder={ar ? field.placeholderAr : field.placeholderEn} /> : <input type={field.type} inputMode={field.type === "number" ? "numeric" : undefined} value={values[field.id] ?? ""} onChange={(event) => setValue(field.id, event.target.value)} placeholder={ar ? field.placeholderAr : field.placeholderEn} />}</label>)}</div>
    <aside className="employee-form-commitment"><span>✓</span><p><strong>{ar ? `الجهة المنفذة: ${schema.ownerAr}` : `Fulfilment owner: ${schema.ownerEn}`}</strong><small>{ar ? `المدة المستهدفة: ${schema.slaAr}. سيظهر رقم متابعة بعد حفظ المسودة.` : `Target time: ${schema.slaEn}. A tracking reference appears after saving.`}</small></p></aside>
    {error && <p className="enterprise-form-error">! {error}</p>}
    <footer><button className="button button-secondary" onClick={close}>{ar ? "إلغاء" : "Cancel"}</button><button className="button button-primary" onClick={submit}>{ar ? "حفظ الطلب كمسودة" : "Save request draft"} ✓</button></footer>
  </section>;
}

function EmployeeWorkspace({ state, setState, navigate, toast }: Props) {
  const ar = state.language === "ar";
  const profile = state.enterprise.employeeProfile;
  const [tab, setTab] = useState<"home" | "requests" | "profile">("home");
  const [profileForm, setProfileForm] = useState({ workEmail: profile.workEmail, mobile: profile.mobile, emergencyContact: profile.emergencyContact });
  const modules = administrativeModules.filter((module) => employeeModuleIds.includes(module.id as typeof employeeModuleIds[number]));
  const personalRecords = state.enterprise.records.filter((record) => record.domain === "hr" && employeeModuleIds.includes(record.moduleId as typeof employeeModuleIds[number]) && (record.createdByRole === "general-employee" || ["hr-payroll", "hr-performance", "hr-tasks"].includes(record.moduleId)));
  const pending = personalRecords.filter((record) => ["draft", "submitted", "approved"].includes(record.status));
  const latestPayroll = personalRecords.find((record) => record.moduleId === "hr-payroll");
  const openModule = (id: string) => navigate(`/staff/erp/${id}`);
  const attendanceLabel = profile.attendanceStatus === "checked-in"
    ? (ar ? "مسجّل حضور" : "Checked in")
    : profile.attendanceStatus === "checked-out"
      ? (ar ? "انتهى الدوام" : "Shift completed")
      : (ar ? "لم يبدأ الدوام" : "Shift not started");
  const addEmployeeAudit = (actionAr: string, actionEn: string) => {
    const at = new Date().toISOString();
    const audit: AuditEvent = {
      id: `audit-employee-${Date.now()}`,
      at,
      actor: ar ? profile.fullNameAr : profile.fullNameEn,
      actionAr,
      actionEn,
      source: "staff",
      correlationId: `COR-EMP-${String(state.case.audit.length + 1).padStart(5, "0")}`,
      hash: `sha256:${(Date.now() * 23).toString(16).slice(-16).padStart(16, "0")}`,
    };
    return { at, audit };
  };
  const toggleAttendance = () => {
    if (profile.attendanceStatus === "checked-out") return;
    const next = profile.attendanceStatus === "checked-in" ? "checked-out" : "checked-in";
    const { at, audit } = addEmployeeAudit(next === "checked-in" ? "تسجيل حضور الموظف" : "تسجيل انصراف الموظف", next === "checked-in" ? "Employee checked in" : "Employee checked out");
    const notification: Notification = {
      id: `employee-attendance-${Date.now()}`,
      titleAr: next === "checked-in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف",
      titleEn: next === "checked-in" ? "Attendance checked in" : "Attendance checked out",
      bodyAr: `تم حفظ الحركة للموظف ${profile.employeeId} في سجل العرض.`,
      bodyEn: `The event was saved for employee ${profile.employeeId} in the demo record.`,
      at,
      read: false,
      channel: "in-app",
    };
    setState((previous) => ({
      ...previous,
      enterprise: {
        ...previous.enterprise,
        employeeProfile: {
          ...previous.enterprise.employeeProfile,
          attendanceStatus: next,
          lastClockIn: next === "checked-in" ? at : previous.enterprise.employeeProfile.lastClockIn,
          lastClockOut: next === "checked-out" ? at : previous.enterprise.employeeProfile.lastClockOut,
          updatedAt: at,
        },
      },
      case: { ...previous.case, audit: [...previous.case.audit, audit] },
      notifications: [notification, ...previous.notifications],
    }));
    toast(next === "checked-in" ? (ar ? "تم تسجيل حضورك" : "You are checked in") : (ar ? "تم تسجيل انصرافك" : "You are checked out"));
  };
  const saveProfile = () => {
    if (!profileForm.workEmail.includes("@") || profileForm.mobile.trim().length < 8) {
      toast(ar ? "راجع البريد ورقم الهاتف قبل الحفظ" : "Check the email and mobile number before saving");
      return;
    }
    const { at, audit } = addEmployeeAudit("تحديث بيانات التواصل الوظيفية", "Employee contact details updated");
    setState((previous) => ({
      ...previous,
      enterprise: { ...previous.enterprise, employeeProfile: { ...previous.enterprise.employeeProfile, ...profileForm, updatedAt: at } },
      case: { ...previous.case, audit: [...previous.case.audit, audit] },
    }));
    toast(ar ? "تم حفظ بياناتك الوظيفية" : "Your employee details were saved");
  };
  const exportPayslip = () => {
    if (!latestPayroll) return;
    const rows = ["employee,period,reference,net", `${profile.employeeId},2026-07,${latestPayroll.reference ?? "PAYROLL-2026-07"},${latestPayroll.amount}`];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payslip-${profile.employeeId}-2026-07.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast(ar ? "تم تنزيل قسيمة الراتب التجريبية" : "Demo payslip downloaded");
  };

  return <div className="page employee-erp-page">
    <header className="employee-erp-hero">
      <div className="employee-erp-identity"><span>{ar ? "أك" : "AK"}</span><div><small>{ar ? "بوابة الموظف المؤسسية" : "EMPLOYEE ENTERPRISE PORTAL"}</small><h1>{ar ? `مرحباً، ${profile.fullNameAr}` : `Welcome, ${profile.fullNameEn}`}</h1><p>{ar ? `${profile.jobTitleAr} · ${profile.departmentAr} · ${profile.employeeId}` : `${profile.jobTitleEn} · ${profile.departmentEn} · ${profile.employeeId}`}</p></div></div>
      <div className="employee-erp-attendance"><span className={`employee-presence presence-${profile.attendanceStatus}`}>● {attendanceLabel}</span><button className="button button-primary" disabled={profile.attendanceStatus === "checked-out"} onClick={toggleAttendance}>{profile.attendanceStatus === "checked-in" ? (ar ? "تسجيل انصراف" : "Check out") : profile.attendanceStatus === "checked-out" ? (ar ? "تم إنهاء الدوام" : "Shift completed") : (ar ? "تسجيل حضور" : "Check in")} ◷</button></div>
    </header>
    <nav className="enterprise-workspace-tabs" aria-label={ar ? "أقسام بوابة الموظف المؤسسية" : "Employee Enterprise Portal sections"}><button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>{ar ? "الرئيسية" : "Overview"}</button><button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>{ar ? "طلباتي" : "My requests"}<b>{number(pending.length, ar)}</b></button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>{ar ? "ملفي الوظيفي" : "My profile"}</button></nav>

    {tab === "home" && <>
      <section className="employee-erp-kpis"><article><span>◷</span><small>{ar ? "دوام اليوم" : "Today"}</small><strong>{attendanceLabel}</strong><button onClick={() => openModule("hr-attendance")}>{ar ? "تفاصيل الحضور" : "Attendance details"} ←</button></article><article><span>☼</span><small>{ar ? "رصيد الإجازات" : "Leave balance"}</small><strong>{number(state.enterprise.leaveBalanceDays, ar)} {ar ? "يوماً" : "days"}</strong><button onClick={() => openModule("hr-leave")}>{ar ? "طلب إجازة" : "Request leave"} ←</button></article><article><span>◈</span><small>{ar ? "آخر راتب" : "Latest payroll"}</small><strong>{latestPayroll ? `${number(latestPayroll.amount, ar)} ${ar ? "د.ع" : "IQD"}` : "—"}</strong><button onClick={exportPayslip} disabled={!latestPayroll}>{ar ? "تنزيل القسيمة" : "Download payslip"} ↓</button></article><article><span>▤</span><small>{ar ? "طلبات قيد الإجراء" : "Open requests"}</small><strong>{number(pending.length, ar)}</strong><button onClick={() => setTab("requests")}>{ar ? "متابعة الطلبات" : "Track requests"} ←</button></article></section>
      <section className="content-card employee-apps"><header><div><span className="eyebrow">EMPLOYEE ENTERPRISE APPLICATIONS</span><h2>{ar ? "تطبيقاتي الوظيفية" : "My employee applications"}</h2><p>{ar ? "كل تطبيق يعرض بياناتك أنت ويبدأ الطلب من الموظف ثم يرسله لمسار الاعتماد المختص." : "Each application shows your scope and sends employee requests into the relevant approval workflow."}</p></div></header><div>{modules.map((module) => { const count = personalRecords.filter((record) => record.moduleId === module.id).length; return <button key={module.id} onClick={() => openModule(module.id)}><span>{employeeModuleIcons[module.id] ?? "▦"}</span><p><strong>{ar ? module.titleAr : module.titleEn}</strong><small>{count ? `${number(count, ar)} ${ar ? "سجل شخصي" : "personal records"}` : (ar ? "لا سجلات بعد" : "No records yet")}</small></p><i>←</i></button>; })}</div></section>
      <section className="employee-erp-bottom"><article className="content-card employee-manager-card"><span className="eyebrow">REPORTING LINE</span><h2>{ar ? "المدير المباشر" : "Direct manager"}</h2><div><span>{ar ? "سم" : "SM"}</span><p><strong>{ar ? profile.managerAr : profile.managerEn}</strong><small>{ar ? "مديرة قسم شؤون المستفيدين" : "Beneficiary Affairs manager"}</small></p></div><button className="button button-secondary button-full" onClick={() => navigate("/staff/notifications")}>{ar ? "فتح الإشعارات والملاحظات" : "Open notifications and feedback"}</button></article><article className="content-card employee-boundary"><span>i</span><div><strong>{ar ? "نطاق الموظف محمي" : "Employee scope is protected"}</strong><p>{ar ? "لا تظهر لك سجلات رواتب زملائك أو قيود الحسابات أو أدوات اعتماد المدير. الطلبات تنتقل للدور التالي ولا تغيّر شخصيتك تلقائياً." : "Coworker payroll, accounting journals, and manager approval tools are hidden. Requests move to the next role without switching your persona."}</p></div></article></section>
    </>}

    {tab === "requests" && <section className="content-card employee-request-list"><header><div><span className="eyebrow">MY REQUESTS</span><h2>{ar ? "طلباتي ومعاملاتي الداخلية" : "My internal requests"}</h2></div><button className="button button-primary" onClick={() => openModule("hr-leave")}>{ar ? "طلب جديد" : "New request"} +</button></header>{personalRecords.map((record) => { const module = getEnterpriseModule(record.moduleId); return <button key={record.id} onClick={() => openModule(record.moduleId)}><span>{employeeModuleIcons[record.moduleId] ?? "▤"}</span><p><small>{ar ? module?.titleAr : module?.titleEn}</small><strong>{ar ? record.titleAr : record.titleEn}</strong><em dir="ltr">{record.id} · {record.reference ?? "SELF-SERVICE"}</em></p>{statusBadge(record, ar)}<i>←</i></button>; })}{personalRecords.length === 0 && <div className="enterprise-empty"><span>✓</span><strong>{ar ? "لا توجد طلبات" : "No requests yet"}</strong></div>}</section>}

    {tab === "profile" && <section className="employee-profile-grid"><article className="content-card employee-profile-summary"><span className="employee-profile-avatar">{ar ? "أك" : "AK"}</span><h2>{ar ? profile.fullNameAr : profile.fullNameEn}</h2><small dir="ltr">{profile.employeeId}</small><dl><div><dt>{ar ? "المسمى" : "Job title"}</dt><dd>{ar ? profile.jobTitleAr : profile.jobTitleEn}</dd></div><div><dt>{ar ? "القسم" : "Department"}</dt><dd>{ar ? profile.departmentAr : profile.departmentEn}</dd></div><div><dt>{ar ? "الموقع" : "Location"}</dt><dd>{ar ? profile.workLocationAr : profile.workLocationEn}</dd></div><div><dt>{ar ? "تاريخ المباشرة" : "Join date"}</dt><dd dir="ltr">{profile.joinDate}</dd></div><div><dt>{ar ? "الحساب البنكي" : "Bank account"}</dt><dd dir="ltr">•••• {profile.bankLastFour}</dd></div></dl></article><article className="content-card employee-profile-form"><header><div><span className="eyebrow">EDITABLE CONTACT DATA</span><h2>{ar ? "بيانات التواصل" : "Contact details"}</h2></div><span className="status-badge status-success"><i />{ar ? "ملف فعال" : "Active"}</span></header><label><span>{ar ? "البريد الوظيفي" : "Work email"}</span><input value={profileForm.workEmail} onChange={(event) => setProfileForm((previous) => ({ ...previous, workEmail: event.target.value }))} /></label><label><span>{ar ? "رقم الهاتف" : "Mobile"}</span><input value={profileForm.mobile} onChange={(event) => setProfileForm((previous) => ({ ...previous, mobile: event.target.value }))} /></label><label><span>{ar ? "جهة اتصال للطوارئ" : "Emergency contact"}</span><input value={profileForm.emergencyContact} onChange={(event) => setProfileForm((previous) => ({ ...previous, emergencyContact: event.target.value }))} /></label><p>{ar ? "الاسم والمسمى والقسم والحساب البنكي بيانات مرجعية؛ تعديلها يحتاج طلب موارد بشرية." : "Name, job, department and bank data are reference fields; changes require an HR request."}</p><footer><button className="button button-secondary" onClick={() => openModule("hr-core")}>{ar ? "طلب تعديل وظيفي" : "Request HR change"}</button><button className="button button-primary" onClick={saveProfile}>{ar ? "حفظ البيانات" : "Save details"} ✓</button></footer></article></section>}
  </div>;
}

function ManagerEmployeeWorkspace({ state, navigate }: Props) {
  const ar = state.language === "ar";
  const requests = state.enterprise.records.filter((record) => record.origin === "employee-portal" && employeeModuleIds.includes(record.moduleId as typeof employeeModuleIds[number]));
  const pending = requests.filter((record) => record.status === "submitted");
  const fulfilment = requests.filter((record) => record.status === "approved");
  const completed = requests.filter((record) => record.status === "posted" || record.status === "settled");
  return <div className="page manager-employee-workspace">
    <header className="enterprise-page-heading"><div><span className="eyebrow">EMPLOYEE REQUEST APPROVALS</span><h1>{ar ? "طلبات الموظفين الداخلية" : "Internal employee requests"}</h1><p>{ar ? "هذه الطلبات جاءت من بوابة الموظف المؤسسية. دور المدير هنا هو التحقق من الحاجة والتغطية وتسليم العمل، ثم الاعتماد أو الرفض المسبب." : "These requests originate in the Employee Enterprise Portal. The manager checks business need, coverage and handover, then approves or rejects with a reason."}</p></div><button className="button button-secondary" onClick={() => navigate("/manager/tasks")}>{ar ? "كل مهام المدير" : "All manager tasks"} ←</button></header>
    <section className="employee-management-flow"><div><span>1</span><p><small>{ar ? "الموظف" : "EMPLOYEE"}</small><strong>{ar ? "إنشاء وإرسال الطلب" : "Create and submit"}</strong></p></div><i>←</i><div className="active"><span>2</span><p><small>{ar ? "المدير" : "MANAGER"}</small><strong>{ar ? "اعتماد أو رفض مسبب" : "Approve or reject"}</strong></p></div><i>←</i><div><span>3</span><p><small>{ar ? "الإدارة المختصة" : "ADMIN TEAM"}</small><strong>{ar ? "تنفيذ وتحديث السجل" : "Fulfil and update"}</strong></p></div><i>←</i><div><span>4</span><p><small>{ar ? "الموظف" : "EMPLOYEE"}</small><strong>{ar ? "إشعار بالنتيجة" : "Outcome notification"}</strong></p></div></section>
    <section className="enterprise-kpis"><article><span>◷</span><p><small>{ar ? "بانتظار قراري" : "Awaiting my decision"}</small><strong>{number(pending.length, ar)}</strong></p></article><article><span>↔</span><p><small>{ar ? "قيد التنفيذ الإداري" : "In fulfilment"}</small><strong>{number(fulfilment.length, ar)}</strong></p></article><article><span>✓</span><p><small>{ar ? "مكتملة" : "Completed"}</small><strong>{number(completed.length, ar)}</strong></p></article><article><span>▤</span><p><small>{ar ? "إجمالي الطلبات" : "Total requests"}</small><strong>{number(requests.length, ar)}</strong></p></article></section>
    <section className="content-card employee-request-list manager-employee-list"><header><div><span className="eyebrow">MANAGER QUEUE</span><h2>{ar ? "الطلبات المرتبطة بفريقي" : "My team requests"}</h2></div></header>{requests.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((record) => { const definition = getEnterpriseModule(record.moduleId); return <button key={record.id} onClick={() => navigate(`/manager/employee-requests/${record.moduleId}`)}><span>{employeeModuleIcons[record.moduleId] ?? "▤"}</span><p><small>{ar ? definition?.titleAr : definition?.titleEn} · {record.ownerEmployeeId ?? "EMP"}</small><strong>{ar ? record.titleAr : record.titleEn}</strong><em>{record.ownerEmployeeNameAr ? (ar ? record.ownerEmployeeNameAr : record.ownerEmployeeNameEn) : (ar ? "طلب موظف" : "Employee request")} · {employeeRequestStage(record, ar)}</em></p>{statusBadge(record, ar)}<i>←</i></button>; })}{requests.length === 0 && <div className="enterprise-empty large"><span>✓</span><h3>{ar ? "لا توجد طلبات موظفين" : "No employee requests"}</h3></div>}</section>
  </div>;
}

function ManagerRequestContext({ state, navigate }: Pick<Props, "state" | "navigate">) {
  const ar = state.language === "ar";
  return <section className="employee-context-strip manager-request-context"><span>مد</span><p><small>{ar ? "صلاحية المدير المباشر" : "DIRECT MANAGER AUTHORITY"}</small><strong>{ar ? "سارة محمود" : "Sarah Mahmoud"}</strong><em>{ar ? "قسم شؤون المستفيدين · مديرية بغداد" : "Beneficiary Affairs · Baghdad Directorate"}</em></p><div><b>✓</b><small>{ar ? "يمكن للمدير اعتماد الطلبات الواردة من موظفيه أو رفضها بسبب واضح. التنفيذ يبقى لدى الموارد البشرية أو الجهة المختصة." : "The manager may approve team requests or reject with a clear reason. Fulfilment remains with HR or the specialist team."}</small></div><button className="button button-secondary" onClick={() => navigate("/manager/employee-requests")}>{ar ? "قائمة الطلبات" : "Request queue"} ←</button></section>;
}

function Workspace({ state, setState, navigate, toast, domain }: Props) {
  const ar = state.language === "ar";
  const [tab, setTab] = useState<"workspace" | "tasks" | "modules">("workspace");
  const [query, setQuery] = useState("");
  const modules = domain === "finance" ? financialModules : administrativeModules;
  const role = state.enterprise.activeRole;
  const visibleModules = modules.filter((definition) => roleCanView(definition, role));
  const tasks = state.enterprise.tasks.filter((task) => task.assignedRole === role && !task.completed && modules.some((definition) => definition.id === task.moduleId));
  const records = state.enterprise.records.filter((record) => modules.some((definition) => definition.id === record.moduleId));
  const employeeRequests = records.filter((record) => record.origin === "employee-portal");
  const filteredModules = visibleModules.filter((definition) => `${definition.titleAr} ${definition.titleEn}`.toLowerCase().includes(query.toLowerCase()));
  const openRecord = (record: EnterpriseRecord) => navigate(`/executive/${domain === "finance" ? "finance" : "administration"}/${record.moduleId}`);
  const exportTasks = () => {
    const rows = ["id,module,action,due", ...tasks.map((task) => [task.recordId, task.moduleId, task.action, task.dueAt].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${domain}-tasks.csv`; link.click(); URL.revokeObjectURL(url);
    toast(ar ? "تم تصدير المهام الحالية" : "Current tasks exported");
  };
  return <div className="page enterprise-operations-page">
    <header className="enterprise-page-heading"><div><span className="eyebrow">{domain === "finance" ? (ar ? "القسم الثامن عشر · ERP" : "SECTION 18 · ERP") : (ar ? "القسم التاسع عشر · HR" : "SECTION 19 · HR")}</span><h1>{domain === "finance" ? (ar ? "مكتب العمليات المالية" : "Financial operations workspace") : (ar ? "مكتب الأنظمة الإدارية والموظفين" : "Employee and administration workspace")}</h1><p>{ar ? "ابدأ من مهام الدور، ثم افتح الموديول وأكمل المعاملة عبر دورة الاعتماد." : "Start from role tasks, open the module, and complete its approval cycle."}</p></div><button className="button button-secondary" onClick={exportTasks}>{ar ? "تصدير مهامي" : "Export my tasks"} ↓</button></header>
    <RoleStrip state={state} setState={setState} toast={toast} />
    {domain === "hr" && <section className="employee-admin-link"><div><span>↔</span><p><small>{ar ? "ترابط بوابة الموظف والإدارة" : "EMPLOYEE → ADMIN LINK"}</small><strong>{ar ? `${number(employeeRequests.length, ar)} طلباً مصدرها بوابة الموظف المؤسسية` : `${number(employeeRequests.length, ar)} requests originated in the Employee Enterprise Portal`}</strong><em>{ar ? "طلبات الموظف تظهر للمدير أولاً، وبعد الاعتماد تنتقل تلقائياً لدور الموارد البشرية أو المشتريات أو الأصول حسب نوعها." : "Employee requests reach the manager first, then route to HR, Procurement or Assets after approval."}</em></p></div><button className="button button-secondary" onClick={() => { const first = employeeRequests.find((record) => record.status === "approved" || record.status === "submitted") ?? employeeRequests[0]; if (first) openRecord(first); else setTab("modules"); }}>{ar ? "فتح طلب موظف" : "Open employee request"} ←</button></section>}
    {domain === "finance" && <section className="fund-separation-grid">{enterpriseFunds.map((fund) => { const lines = state.enterprise.budgetLines.filter((line) => line.fund === fund.code); const available = lines.reduce((sum, line) => sum + budgetAvailable(line), 0); return <article key={fund.code}><b>{fund.code}</b><p><strong>{ar ? fund.labelAr : fund.labelEn}</strong><small>{ar ? "متاح" : "Available"}: {number(available, ar)} {ar ? "د.ع" : "IQD"}</small></p><span>✓ {ar ? "ذمة مستقلة" : "Separated"}</span></article>; })}</section>}
    <nav className="enterprise-workspace-tabs" aria-label={ar ? "أقسام مكتب العمل" : "Workspace sections"}><button className={tab === "workspace" ? "active" : ""} onClick={() => setTab("workspace")}>{ar ? "مكتب العمل" : "Workspace"}</button><button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>{ar ? "مهامي واعتماداتي" : "My tasks & approvals"}<b>{number(tasks.length, ar)}</b></button><button className={tab === "modules" ? "active" : ""} onClick={() => setTab("modules")}>{ar ? "الموديولات" : "Modules"}<b>{number(visibleModules.length, ar)}</b></button></nav>
    {tab === "workspace" && <>
      <section className="enterprise-kpis"><article><span>▤</span><p><small>{ar ? "مهام دوري" : "My tasks"}</small><strong>{number(tasks.length, ar)}</strong></p></article><article><span>◷</span><p><small>{ar ? "بانتظار الاعتماد" : "Awaiting approval"}</small><strong>{number(records.filter((record) => record.status === "submitted").length, ar)}</strong></p></article><article><span>✓</span><p><small>{ar ? "مرحّل / معالج" : "Posted / processed"}</small><strong>{number(records.filter((record) => record.status === "posted" || record.status === "settled").length, ar)}</strong></p></article><article><span>⌁</span><p><small>{ar ? "أحداث مدققة" : "Audited events"}</small><strong>{number(state.case.audit.length, ar)}</strong></p></article></section>
      <section className="enterprise-dashboard-grid"><article className="content-card enterprise-task-preview"><header><div><span className="eyebrow">MY WORK</span><h2>{ar ? "الأعمال الواردة الآن" : "Incoming work now"}</h2></div><button className="text-button" onClick={() => setTab("tasks")}>{ar ? "عرض الكل" : "View all"} ←</button></header>{tasks.slice(0, 5).map((task) => { const record = state.enterprise.records.find((item) => item.id === task.recordId); return record ? <button key={task.id} onClick={() => openRecord(record)}><span>{task.action === "approve" ? "✓" : task.action === "post" ? "↔" : "◈"}</span><p><strong>{ar ? task.titleAr : task.titleEn}</strong><small dir="ltr">{task.recordId}</small></p><i>←</i></button> : null; })}{tasks.length === 0 && <div className="enterprise-empty"><span>✓</span><strong>{ar ? "لا مهام معلقة على هذا الدور" : "No pending work for this role"}</strong><small>{ar ? "بدّل الدور أو افتح الموديولات لإنشاء معاملة." : "Switch role or open modules to create work."}</small></div>}</article>
      <article className="content-card enterprise-role-permissions"><span className="eyebrow">RBAC + SoD</span><h2>{ar ? "نطاق الدور الحالي" : "Current role scope"}</h2><p>{ar ? `يستطيع ${enterpriseRoleLabel(role, "ar")} الوصول إلى ${visibleModules.length} موديولاً ضمن هذا المكتب.` : `${enterpriseRoleLabel(role, "en")} can access ${visibleModules.length} modules in this workspace.`}</p><ul><li>✓ {ar ? "المنشئ لا يعتمد معاملته" : "Creator cannot approve own record"}</li><li>✓ {ar ? "المعتمد لا ينفذ الصرف" : "Approver cannot execute payment"}</li><li>✓ {ar ? "كل إجراء يولّد إشعاراً وأثراً تدقيقياً" : "Every action creates notification and audit evidence"}</li></ul><button className="button button-primary button-full" onClick={() => setTab("modules")}>{ar ? "فتح الموديولات المسموحة" : "Open allowed modules"} ←</button></article></section>
    </>}
    {tab === "tasks" && <section className="content-card enterprise-task-inbox"><header><div><span className="eyebrow">MY TASKS / MY APPROVALS</span><h2>{ar ? `صندوق عمل ${enterpriseRoleLabel(role, "ar")}` : `${enterpriseRoleLabel(role, "en")} work queue`}</h2></div></header>{tasks.map((task) => { const record = state.enterprise.records.find((item) => item.id === task.recordId); const definition = getEnterpriseModule(task.moduleId); return record && definition ? <button key={task.id} onClick={() => openRecord(record)}><span className="enterprise-task-symbol">{task.action === "approve" ? "✓" : task.action === "post" ? "↔" : "◈"}</span><p><small>{ar ? definition.titleAr : definition.titleEn}</small><strong>{ar ? task.titleAr : task.titleEn}</strong><em>{nextStep(record, definition, ar)}</em></p><time>{new Intl.DateTimeFormat(ar ? "ar-IQ" : "en-GB", { day: "numeric", month: "short" }).format(new Date(task.dueAt))}</time><i>←</i></button> : null; })}{tasks.length === 0 && <div className="enterprise-empty large"><span>✓</span><h3>{ar ? "لا توجد مهام واردة" : "No incoming tasks"}</h3><p>{ar ? "كل ما يخص هذا الدور مكتمل حالياً." : "Everything assigned to this role is complete."}</p></div>}</section>}
    {tab === "modules" && <section className="content-card enterprise-modules-section"><header><div><span className="eyebrow">{modules.length} MODULES</span><h2>{ar ? "الموديولات التشغيلية المسموحة" : "Allowed transactional modules"}</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "ابحث عن موديول…" : "Search modules…"} /></header><div className="enterprise-operational-modules">{filteredModules.map((definition) => { const moduleRecords = state.enterprise.records.filter((record) => record.moduleId === definition.id); const moduleTasks = tasks.filter((task) => task.moduleId === definition.id); return <button key={definition.id} onClick={() => navigate(`/executive/${domain === "finance" ? "finance" : "administration"}/${definition.id}`)}><span>{moduleTasks.length ? "!" : "✓"}</span><p><strong>{ar ? definition.titleAr : definition.titleEn}</strong><small>{definition.sourceAr}</small></p><div><b>{number(moduleRecords.length, ar)}</b><small>{ar ? "سجل" : "records"}</small></div><i>←</i></button>; })}</div>{filteredModules.length === 0 && <div className="enterprise-empty"><span>⌕</span><strong>{ar ? "لا توجد نتائج ضمن صلاحيات الدور" : "No results in this role scope"}</strong></div>}</section>}
  </div>;
}

function ModuleWorkbench({ state, setState, navigate, toast, domain, moduleId = "", mode = "operations" }: Props) {
  const ar = state.language === "ar";
  const definition = getEnterpriseModule(moduleId);
  const employeeMode = mode === "employee";
  const managerMode = mode === "manager";
  const role: EnterpriseRoleId = employeeMode ? "general-employee" : managerMode ? "department-manager" : state.enterprise.activeRole;
  const basePath = employeeMode ? "/staff/erp" : managerMode ? "/manager/employee-requests" : `/executive/${domain === "finance" ? "finance" : "administration"}`;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | EnterpriseRecordStatus>("all");
  const [sort, setSort] = useState<"newest" | "amount">("newest");
  const [selectedId, setSelectedId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", amount: "", quantity: "1", fund: "A" as EnterpriseFundCode, budgetLineId: "BL-A-01", reference: "", decisionRef: "", idempotencyKey: "" });
  const [employeeForm, setEmployeeForm] = useState<Record<string, string>>({});
  const employeeSchema = employeeRequestSchemas[moduleId];
  const records = useMemo(() => state.enterprise.records.filter((record) => record.moduleId === moduleId).filter((record) => !employeeMode || record.ownerEmployeeId === state.enterprise.employeeProfile.employeeId || ["hr-payroll", "hr-performance", "hr-tasks"].includes(record.moduleId)).filter((record) => !managerMode || record.origin === "employee-portal").filter((record) => filter === "all" || record.status === filter).filter((record) => `${record.id} ${record.titleAr} ${record.titleEn} ${record.reference ?? ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "amount" ? b.amount - a.amount : b.updatedAt.localeCompare(a.updatedAt)), [employeeMode, filter, managerMode, moduleId, query, sort, state.enterprise.employeeProfile.employeeId, state.enterprise.records]);
  if (!definition || definition.domain !== domain || ((employeeMode || managerMode) && !employeeModuleIds.includes(moduleId as typeof employeeModuleIds[number]))) return <div className="page"><div className="enterprise-empty large"><span>!</span><h2>{ar ? "الموديول غير متاح ضمن هذا النطاق" : "Module unavailable in this scope"}</h2><button className="button button-primary" onClick={() => navigate(basePath)}>{employeeMode ? (ar ? "العودة لبوابة الموظف" : "Back to employee portal") : (ar ? "العودة لقائمة الطلبات" : "Back to request queue")}</button></div></div>;
  const effectiveSelectedId = records.some((record) => record.id === selectedId) ? selectedId : records[0]?.id ?? "";
  const selected = state.enterprise.records.find((record) => record.id === effectiveSelectedId);
  const canCreate = !managerMode && definition.creatorRoles.includes(role);
  const relevantLines = state.enterprise.budgetLines.filter((line) => line.fund === form.fund);
  const updateForm = (patch: Partial<typeof form>) => setForm((previous) => ({ ...previous, ...patch }));
  const commitResult = (result: ReturnType<typeof transitionEnterpriseRecord> | ReturnType<typeof createEnterpriseRecord>, actionAr: string, actionEn: string) => {
    if (!result.ok) { setError(ar ? result.messageAr : result.messageEn); toast(ar ? result.messageAr : result.messageEn); return; }
    const audit = makeAudit(result.record, actionAr, actionEn, role, state.case.audit.length);
    const notification = makeNotification(result.record, actionAr, actionEn);
    setState((previous) => ({ ...previous, enterprise: result.state, case: { ...previous.case, audit: [...previous.case.audit, audit] }, notifications: [notification, ...previous.notifications] }));
    setSelectedId(result.record.id); setActionNote(""); setError(""); toast(ar ? result.messageAr : result.messageEn);
  };
  const create = () => {
    const result = createEnterpriseRecord(state.enterprise, { moduleId, title: form.title, description: form.description, amount: Number(form.amount || 0), quantity: Number(form.quantity || 1), fund: Number(form.amount || 0) > 0 ? form.fund : undefined, budgetLineId: Number(form.amount || 0) > 0 ? form.budgetLineId : undefined, reference: form.reference, decisionRef: form.decisionRef, idempotencyKey: form.idempotencyKey }, role);
    commitResult(result, "إنشاء سجل تشغيلي", "Operational record created");
    if (result.ok) { setShowForm(false); setForm({ title: "", description: "", amount: "", quantity: "1", fund: "A", budgetLineId: "BL-A-01", reference: "", decisionRef: "", idempotencyKey: "" }); }
  };
  const createEmployeeRequest = () => {
    const built = buildEmployeeRequest(moduleId, employeeForm, state);
    if (!built.input) {
      const message = ar ? built.errorAr ?? "تعذر إنشاء الطلب" : built.errorEn ?? "Unable to create request";
      setError(message);
      toast(message);
      return;
    }
    const result = createEnterpriseRecord(state.enterprise, built.input, "general-employee");
    commitResult(result, "إنشاء طلب من بوابة الموظف المؤسسية", "Employee portal request created");
    if (result.ok) {
      setShowForm(false);
      setEmployeeForm({});
    }
  };
  const perform = (action: Exclude<EnterpriseAction, "create">) => {
    if (!selected) return;
    if (action === "reject" && actionNote.trim().length < 5) { setError(ar ? "اكتب سبب رفض واضحاً في ملاحظة الإجراء" : "Enter a clear rejection reason in the action note"); return; }
    commitResult(transitionEnterpriseRecord(state.enterprise, selected.id, action, role, new Date().toISOString(), actionNote), actionCopy[action].ar, actionCopy[action].en);
  };
  const allowedActions = selected ? (["submit", "approve", "reject", "post", "settle"] as const).filter((action) => canEnterpriseAction(state.enterprise, selected, action, role).allowed) : [];
  return <div className={`page enterprise-module-workbench ${employeeMode ? "employee-module-workbench" : managerMode ? "manager-module-workbench" : ""}`}>
    <div className="enterprise-breadcrumb"><button onClick={() => navigate(basePath)}>→ {employeeMode ? (ar ? "بوابة الموظف المؤسسية" : "Employee Enterprise Portal") : managerMode ? (ar ? "طلبات الموظفين" : "Employee requests") : (ar ? "مكتب العمليات" : "Operations workspace")}</button><span>/</span><b>{ar ? definition.titleAr : definition.titleEn}</b></div>
    <header className="enterprise-page-heading"><div><span className="eyebrow">{employeeMode ? "EMPLOYEE SELF-SERVICE" : definition.sourceAr}</span><h1>{ar ? definition.titleAr : definition.titleEn}</h1><p>{employeeMode ? (ar ? "بياناتك ومعاملاتك الشخصية فقط، مع إرسال الطلب للدور المختص دون تبديل المستخدم." : "Only your personal data and requests, routed to the responsible role without switching users.") : (ar ? "قائمة وتفصيل ونموذج ودورة اعتماد وترحيل موحدة." : "Unified list, detail, form, approval and posting workflow.")}</p></div>{canCreate && <button className="button button-primary" onClick={() => { setShowForm((value) => !value); setError(""); }}>{showForm ? (ar ? "إغلاق النموذج" : "Close form") : (ar ? "إنشاء طلب" : "Create request")} +</button>}</header>
    {employeeMode ? <EmployeeContextStrip state={state} navigate={navigate} /> : managerMode ? <ManagerRequestContext state={state} navigate={navigate} /> : <RoleStrip state={state} setState={setState} toast={toast} />}
    {showForm && employeeMode && employeeSchema && <EmployeeRequestForm schema={employeeSchema} values={employeeForm} setValue={(id, value) => setEmployeeForm((previous) => ({ ...previous, [id]: value }))} submit={createEmployeeRequest} close={() => { setShowForm(false); setError(""); }} error={error} ar={ar} />}
    <section className="enterprise-story-chain"><strong>{ar ? "قصة الربط" : "CONNECTED STORY"}</strong>{employeeMode ? <>{[["بياناتي", "My data", "hr-core"], ["الحضور", "Attendance", "hr-attendance"], ["الإجازة", "Leave", "hr-leave"], ["الراتب", "Payroll", "hr-payroll"]].map(([labelAr, labelEn, target], index) => <span key={`${target}-${index}`}><button className={moduleId === target ? "active" : ""} onClick={() => navigate(`/staff/erp/${target}`)}>{ar ? labelAr : labelEn}</button>{index < 3 && <i>←</i>}</span>)}</> : domain === "finance" ? <>{[["قرار اللجنة", "Committee decision", "fin-grants"], ["المنحة", "Grant", "fin-grants"], ["دفعة المستفيد", "Beneficiary payment", "fin-beneficiary"], ["قيد GL", "GL journal", "fin-ledger"]].map(([labelAr, labelEn, target], index) => <span key={`${target}-${index}`}><button className={moduleId === target ? "active" : ""} onClick={() => navigate(`/executive/finance/${target}`)}>{ar ? labelAr : labelEn}</button>{index < 3 && <i>←</i>}</span>)}<button onClick={() => navigate("/admin/audit")}>{ar ? "التدقيق" : "Audit"}</button></> : <>{[["طلب إجازة", "Leave request", "hr-leave"], ["اعتماد المدير", "Manager approval", "hr-leave"], ["تحديث الرصيد", "Balance update", "hr-leave"], ["مسير الرواتب", "Payroll", "hr-payroll"]].map(([labelAr, labelEn, target], index) => <span key={`${target}-${index}`}><button className={moduleId === target ? "active" : ""} onClick={() => navigate(`/executive/administration/${target}`)}>{ar ? labelAr : labelEn}</button>{index < 3 && <i>←</i>}</span>)}<button onClick={() => navigate("/executive/finance/fin-ledger")}>GL / AP</button></>}</section>
    {showForm && <section className="content-card enterprise-create-form"><header><div><span className="eyebrow">NEW RECORD</span><h2>{ar ? `إنشاء سجل في ${definition.titleAr}` : `Create ${definition.titleEn} record`}</h2></div><span className="status-badge status-neutral"><i />{ar ? "مسودة" : "Draft"}</span></header><div className="enterprise-form-grid"><label><span>{ar ? "العنوان" : "Title"} *</span><input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} placeholder={ar ? "عنوان واضح للمعاملة" : "Clear transaction title"} /></label><label><span>{ar ? "المرجع" : "Reference"}</span><input value={form.reference} onChange={(event) => updateForm({ reference: event.target.value })} placeholder="REF-2026-…" /></label><label className="enterprise-form-wide"><span>{ar ? "الوصف" : "Description"} *</span><textarea rows={3} value={form.description} onChange={(event) => updateForm({ description: event.target.value })} placeholder={ar ? "الغرض والمستندات ومركز المسؤولية…" : "Purpose, evidence and responsibility centre…"} /></label>{definition.requiresAmount && <><label><span>{ar ? "المبلغ — د.ع" : "Amount — IQD"} *</span><input inputMode="numeric" value={form.amount} onChange={(event) => updateForm({ amount: event.target.value.replace(/[^0-9]/g, "") })} /></label><label><span>{ar ? "الصندوق" : "Fund"} *</span><select value={form.fund} onChange={(event) => { const fund = event.target.value as EnterpriseFundCode; updateForm({ fund, budgetLineId: `BL-${fund}-01` }); }}>{enterpriseFunds.map((fund) => <option key={fund.code} value={fund.code}>{fund.code} · {ar ? fund.labelAr : fund.labelEn}</option>)}</select></label><label><span>{ar ? "خط الموازنة" : "Budget line"} *</span><select value={form.budgetLineId} onChange={(event) => updateForm({ budgetLineId: event.target.value })}>{relevantLines.map((line) => <option key={line.id} value={line.id}>{line.code} · {number(budgetAvailable(line), ar)} {ar ? "متاح" : "available"}</option>)}</select></label><label><span>{ar ? "مفتاح عدم الازدواج" : "Idempotency key"}</span><input value={form.idempotencyKey} onChange={(event) => updateForm({ idempotencyKey: event.target.value })} placeholder="idem-…" /></label></>}{moduleId === "fin-grants" && <label><span>{ar ? "مرجع قرار اللجنة" : "Committee decision reference"} *</span><input value={form.decisionRef} onChange={(event) => updateForm({ decisionRef: event.target.value })} placeholder="DEC-MF-2026-…" /></label>}<label><span>{ar ? "الكمية / الأيام" : "Quantity / days"}</span><input inputMode="numeric" value={form.quantity} onChange={(event) => updateForm({ quantity: event.target.value.replace(/[^0-9]/g, "") })} /></label></div>{error && <p className="enterprise-form-error">! {error}</p>}<footer><button className="button button-secondary" onClick={() => setShowForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="button button-primary" onClick={create}>{ar ? "حفظ المسودة" : "Save draft"} ✓</button></footer></section>}
    <section className="enterprise-workbench-grid"><div className="content-card enterprise-record-list"><header><div><span className="eyebrow">TRANSACTION LIST</span><h2>{ar ? "السجلات" : "Records"}</h2></div><b>{number(records.length, ar)}</b></header><div className="enterprise-list-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "بحث بالعنوان أو المرجع…" : "Search title or reference…"} /><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">{ar ? "كل الحالات" : "All statuses"}</option>{Object.entries(enterpriseStatusLabels).map(([id, label]) => <option key={id} value={id}>{label[ar ? "ar" : "en"]}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">{ar ? "الأحدث" : "Newest"}</option><option value="amount">{ar ? "الأعلى مبلغاً" : "Highest amount"}</option></select></div><div className="enterprise-record-rows">{records.map((record) => <button key={record.id} className={record.id === selectedId ? "active" : ""} onClick={() => setSelectedId(record.id)}><span className="enterprise-record-icon">{record.domain === "finance" ? "◈" : "▤"}</span><p><strong>{ar ? record.titleAr : record.titleEn}</strong><small dir="ltr">{record.id} · {record.reference ?? "NO-REF"}</small></p>{record.amount > 0 && <b>{number(record.amount, ar)}</b>}{statusBadge(record, ar)}</button>)}{records.length === 0 && <div className="enterprise-empty"><span>⌕</span><strong>{ar ? "لا سجلات مطابقة" : "No matching records"}</strong><small>{ar ? "غيّر التصفية أو أنشئ سجلاً جديداً إن كانت لديك الصلاحية." : "Change filters or create a record if allowed."}</small></div>}</div></div>
      <aside className="content-card enterprise-record-detail">{selected ? <><header><div><span className="eyebrow" dir="ltr">{selected.id}</span><h2>{ar ? selected.titleAr : selected.titleEn}</h2></div>{statusBadge(selected, ar)}</header><p className="enterprise-record-description">{selected.description}</p><div className="enterprise-detail-facts"><div><span>{ar ? "الدور المنشئ" : "Created by"}</span><strong>{enterpriseRoleLabel(selected.createdByRole, ar ? "ar" : "en")}</strong></div><div><span>{ar ? "الخطوة التالية" : "Next step"}</span><strong>{nextStep(selected, definition, ar)}</strong></div><div><span>{ar ? "الصندوق" : "Fund"}</span><strong>{selected.fund ?? "—"}</strong></div><div><span>{ar ? "خط الموازنة" : "Budget line"}</span><strong dir="ltr">{selected.budgetLineId ?? "—"}</strong></div><div><span>{ar ? "المبلغ" : "Amount"}</span><strong>{selected.amount ? `${number(selected.amount, ar)} ${ar ? "د.ع" : "IQD"}` : "—"}</strong></div><div><span>{ar ? "المرجع" : "Reference"}</span><strong dir="ltr">{selected.decisionRef ?? selected.reference ?? "—"}</strong></div></div>{selected.journalLines && <section className="enterprise-journal"><header><strong>{ar ? "قيد الأستاذ العام" : "General ledger entry"}</strong><span className={`mini-badge ${isJournalBalanced(selected.journalLines) ? "status-success" : "status-danger"}`}>{isJournalBalanced(selected.journalLines) ? (ar ? "متوازن" : "Balanced") : (ar ? "غير متوازن" : "Unbalanced")}</span></header>{selected.journalLines.map((line) => <div key={line.account}><b>{line.account}</b><span>{ar ? "مدين" : "Debit"}: {number(line.debit, ar)}</span><span>{ar ? "دائن" : "Credit"}: {number(line.credit, ar)}</span></div>)}</section>}<label className="enterprise-action-note"><span>{ar ? "ملاحظة الإجراء / سبب الرفض" : "Action note / rejection reason"}</span><textarea rows={2} value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder={ar ? "تُحفظ الملاحظة مع أثر الإجراء…" : "The note is retained with the action…"} /></label>{error && <p className="enterprise-form-error">! {error}</p>}<div className="enterprise-record-actions">{allowedActions.map((action) => <button key={action} className={`button ${action === "reject" ? "button-secondary enterprise-reject" : "button-primary"}`} onClick={() => perform(action)}>{actionCopy[action][ar ? "ar" : "en"]}{action === "approve" || action === "post" || action === "settle" ? " ✓" : " ←"}</button>)}{allowedActions.length === 0 && <p><b>i</b>{ar ? `لا يوجد إجراء لهذا الدور حالياً. ${nextStep(selected, definition, ar)}.` : `No action for this role now. ${nextStep(selected, definition, ar)}.`}</p>}</div><section className="enterprise-history"><h3>{ar ? "سجل الحركة والاعتماد" : "Movement and approval history"}</h3>{selected.history.slice().reverse().map((event) => <div key={event.id}><span>{event.action === "create" ? "+" : event.action === "approve" ? "✓" : event.action === "reject" ? "×" : "↔"}</span><p><strong>{ar ? event.noteAr : event.noteEn}</strong><small>{new Intl.DateTimeFormat(ar ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.at))}</small></p></div>)}</section></> : <div className="enterprise-empty large"><span>▤</span><h3>{ar ? "اختر سجلاً" : "Select a record"}</h3></div>}</aside></section>
  </div>;
}

export function EnterpriseOperationsPage(props: Props) {
  if (props.mode === "employee" && !props.moduleId) return <EmployeeWorkspace {...props} />;
  if (props.mode === "manager" && !props.moduleId) return <ManagerEmployeeWorkspace {...props} />;
  return props.moduleId ? <ModuleWorkbench {...props} /> : <Workspace {...props} />;
}
