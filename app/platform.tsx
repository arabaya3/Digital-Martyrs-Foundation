"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  canTransition,
  committeeDecisionReadiness,
  evaluateEligibility,
  hasQuorum,
  isCaseVisibleToCommittee,
  isCaseVisibleToOperations,
  simulatePayment,
} from "@/lib/domain";
import {
  executiveGovernorateOptions,
  executivePeriodOptions,
  executiveTransactionOptions,
  getExecutiveView,
  type ExecutiveGovernorateFilter,
  type ExecutivePeriodFilter,
  type ExecutiveTransactionFilter,
} from "@/lib/executive";
import {
  createInitialState,
  integrations,
  personas,
  services,
} from "@/lib/seed";
import {
  canSubmitGenericService,
  requiredCitizenUploads,
} from "@/lib/service-flow";
import {
  evaluateCompliance,
  getBlockingComplianceResults,
} from "@/lib/compliance";
import {
  CaseCompliancePanel,
  CitizenLegalAssistant,
  ComplianceDashboard,
  StaffLegalAssistant,
} from "./compliance-ui";
import { EnterpriseOperationsPage } from "./enterprise-operations";
import type {
  ApplicationStatus,
  AuditEvent,
  CaseDocument,
  CitizenCategory,
  DemoState,
  EligibilityResult,
  Language,
  PersonaId,
  ServiceApplication,
  ServiceDefinition,
  StoredDocument,
  StatusTone,
} from "@/lib/types";

const STORAGE_KEY = "martyrs-foundation-poc-v4";
const THEME_STORAGE_KEY = "martyrs-foundation-theme";

async function uploadStoredDocument(file: File, category: string): Promise<StoredDocument> {
  const form = new FormData();
  form.set("file", file);
  form.set("category", category);
  const response = await fetch("/api/documents?workspace=primary", { method: "POST", body: form });
  const payload = await response.json() as { document?: StoredDocument; error?: string };
  if (!response.ok || !payload.document) throw new Error(payload.error || "Document upload failed");
  return payload.document;
}

const statusLabels: Record<ApplicationStatus, { ar: string; en: string; tone: StatusTone }> = {
  Draft: { ar: "مسودة", en: "Draft", tone: "neutral" },
  Submitted: { ar: "مُقدّم", en: "Submitted", tone: "info" },
  "Under Validation": { ar: "قيد التحقق", en: "Under validation", tone: "info" },
  Incomplete: { ar: "غير مكتمل", en: "Incomplete", tone: "warning" },
  "Awaiting Citizen Completion": {
    ar: "بانتظار استكمال المواطن",
    en: "Awaiting citizen completion",
    tone: "warning",
  },
  "Under Review": { ar: "قيد المراجعة", en: "Under review", tone: "info" },
  "Manager Review": { ar: "أمام مدير المديرية", en: "Directorate manager review", tone: "gold" },
  Referred: { ar: "مُحال", en: "Referred", tone: "gold" },
  "Committee Review": { ar: "أمام اللجنة", en: "Committee review", tone: "gold" },
  "Awaiting Approval": { ar: "بانتظار الاعتماد", en: "Awaiting approval", tone: "warning" },
  Approved: { ar: "موافق عليه", en: "Approved", tone: "success" },
  Rejected: { ar: "مرفوض", en: "Rejected", tone: "danger" },
  "In Execution": { ar: "قيد التنفيذ", en: "In execution", tone: "info" },
  Completed: { ar: "مكتمل", en: "Completed", tone: "success" },
  Appealed: { ar: "معترض عليه", en: "Appealed", tone: "warning" },
  Reopened: { ar: "أُعيد فتحه", en: "Reopened", tone: "info" },
  Cancelled: { ar: "ملغي", en: "Cancelled", tone: "danger" },
  Closed: { ar: "مغلق", en: "Closed", tone: "neutral" },
};

const navByPersona: Record<PersonaId, Array<[string, string, string, string]>> = {
  citizen: [
    ["/citizen", "الرئيسية", "Home", "⌂"],
    ["/citizen/services", "الخدمات", "Services", "✦"],
    ["/citizen/applications", "طلباتي", "Applications", "▤"],
    ["/citizen/documents", "وثائقي", "Documents", "▧"],
    ["/citizen/appointments", "المواعيد", "Appointments", "◷"],
    ["/citizen/payments", "المدفوعات", "Payments", "◈"],
    ["/citizen/notifications", "الإشعارات", "Notifications", "●"],
    ["/citizen/eligibility/education-grant", "التحقق الأولي", "Initial eligibility", "◇"],
    ["/citizen/help", "المساعدة", "Help", "?"],
  ],
  staff: [
    ["/staff/erp", "بوابة الموظف المؤسسية", "Employee Enterprise Portal", "▦"],
    ["/staff/inbox", "مركز العمل", "Workspace", "⌂"],
    ["/staff/search", "البحث الموحّد", "Unified search", "⌕"],
    ["/staff/cases/MF-2026-000184", "الحالة النشطة", "Active case", "◫"],
    ["/staff/help", "مساعد الموظف", "Staff assistant", "✦"],
    ["/staff/notifications", "الإشعارات", "Notifications", "●"],
    ["/compliance", "مركز الامتثال", "Compliance center", "⚖"],
    ["/admin/audit", "سجل التدقيق", "Audit log", "⌁"],
  ],
  manager: [
    ["/manager", "لوحة المديرية", "Directorate", "⌂"],
    ["/manager/tasks", "المهام", "Tasks", "▤"],
    ["/manager/employee-requests", "طلبات الموظفين", "Employee requests", "▦"],
    ["/manager/approvals", "الموافقات", "Approvals", "✓"],
    ["/manager/notifications", "الإشعارات", "Notifications", "●"],
  ],
  committee: [
    ["/committee", "الاجتماعات", "Meetings", "⌂"],
    ["/committee/meetings/EDU-2026-07", "اجتماع التعليم", "Education meeting", "◉"],
    ["/admin/audit", "سجل القرارات", "Decision log", "⌁"],
    ["/committee/notifications", "الإشعارات", "Notifications", "●"],
  ],
  executive: [
    ["/executive", "اللوحة التنفيذية", "Executive dashboard", "⌂"],
    ["/executive/finance", "الإدارة المالية", "Financial management", "◈"],
    ["/executive/administration", "الأنظمة الإدارية", "Administrative systems", "▦"],
    ["/manager", "أداء المديريات", "Directorates", "▥"],
    ["/executive/resilience", "استمرارية الأنظمة", "System continuity", "⌁"],
    ["/executive/notifications", "الإشعارات", "Notifications", "●"],
  ],
  admin: [
    ["/studio", "الاستوديو", "Studio", "⌂"],
    ["/compliance", "الامتثال واللوائح", "Compliance & regulations", "⚖"],
    ["/studio/forms/education-grant", "منشئ النماذج", "Form builder", "▦"],
    ["/studio/workflows/education-grant", "مسار العمل", "Workflow", "⌁"],
    ["/studio/rules/education-grant", "قواعد الأهلية", "Rules", "◇"],
    ["/studio/notifications", "القوالب", "Templates", "✉"],
    ["/studio/integrations", "التكاملات", "Integrations", "↔"],
    ["/studio/versions", "الإصدارات", "Versions", "≛"],
    ["/admin/audit", "سجل التدقيق", "Audit log", "▤"],
    ["/admin/notifications", "الإشعارات", "Notifications", "●"],
  ],
};

const copy = {
  ar: {
    demo: "وضع العرض التجريبي",
    prototype: "بيانات اصطناعية — لا يمثل نظاماً إنتاجياً",
    foundation: "مؤسسة الشهداء",
    platform: "المنصة الرقمية الموحّدة",
    search: "ابحث في الخدمات والطلبات والوثائق…",
    switchRole: "تبديل الدور",
    reset: "إعادة بيانات العرض",
    menu: "القائمة",
    close: "إغلاق",
  },
  en: {
    demo: "Demo Mode",
    prototype: "Synthetic data — not a production system",
    foundation: "Martyrs Foundation",
    platform: "Unified Digital Platform",
    search: "Search services, cases and documents…",
    switchRole: "Switch role",
    reset: "Reset demo data",
    menu: "Menu",
    close: "Close",
  },
};

const citizenCategoryOptions: Array<{
  id: CitizenCategory;
  icon: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  storyAr: string;
  storyEn: string;
  evidenceAr: string;
}> = [
  {
    id: "martyr-family",
    icon: "◇",
    labelAr: "ذوو شهيد",
    labelEn: "Martyr family",
    descriptionAr: "ملف أسرة مرتبط بواقعة شهادة يحتاج إثبات الصفة وصلة القرابة.",
    descriptionEn: "A family file linked to martyrdom, subject to status and kinship verification.",
    storyAr: "أسجل صفتي وصلتي، أرفع الإثبات، ثم تظهر خدمات الأسرة والتعليم والسكن والتوظيف المناسبة للملف.",
    storyEn: "I register my relationship, upload evidence, then see relevant family, education, housing and employment services.",
    evidenceAr: "وثيقة واقعة الشهادة + ما يثبت صلة القرابة",
  },
  {
    id: "injured",
    icon: "+",
    labelAr: "مصاب / جريح",
    labelEn: "Injured beneficiary",
    descriptionAr: "مسار أولي للمصابين لعرض خدمات العلاج والرعاية والكتب التأييدية.",
    descriptionEn: "An initial injured-beneficiary track for treatment, care and confirmation services.",
    storyAr: "أسجل نوع الإصابة ومرجعها، ثم تظهر خدمات العلاج والدعم الاجتماعي قبل أي تحقق نهائي.",
    storyEn: "I register injury details and references, then see treatment and social support services before final verification.",
    evidenceAr: "تقرير طبي أو كتاب إحالة + مرجع الواقعة",
  },
  {
    id: "terrorism-victim",
    icon: "⚑",
    labelAr: "متضرر من الإرهاب أو العمليات العسكرية",
    labelEn: "Terrorism or military-operations victim",
    descriptionAr: "مسار لتجميع بيانات الواقعة والضرر وربطها بخدمات الصحة والسكن والقانونية.",
    descriptionEn: "A track that captures incident and harm data for health, housing and legal services.",
    storyAr: "أحدد الواقعة والجهة المثبتة، ثم يوجّهني النظام للخدمات التي تناسب نوع الضرر.",
    storyEn: "I identify the incident and issuing authority, then the system guides me to services matching the harm type.",
    evidenceAr: "محضر أو كتاب رسمي للواقعة + وثيقة الضرر",
  },
  {
    id: "missing-family",
    icon: "◎",
    labelAr: "أسرة مفقود / ملف يحتاج تثبيت صفة",
    labelEn: "Missing-person family / status pending",
    descriptionAr: "مسار غير حاسم لفتح ملف ومتابعة الإثبات قبل عرض أي استحقاق.",
    descriptionEn: "A non-determinative track for opening a file and completing evidence before any entitlement is shown.",
    storyAr: "أفتح ملف متابعة وأرفق المراجع المتاحة، ولا تظهر نتيجة استحقاق قبل التحقق البشري.",
    storyEn: "I open a follow-up file and attach available references; no entitlement is shown before human verification.",
    evidenceAr: "بلاغ أو كتاب متابعة + إثبات صلة مقدم الطلب",
  },
];

function citizenCategory(category: CitizenCategory) {
  return citizenCategoryOptions.find((item) => item.id === category) ?? citizenCategoryOptions[0];
}

function mergeSavedState(parsed: Partial<DemoState>): DemoState {
  const fresh = createInitialState();
  return {
    ...fresh,
    ...parsed,
    citizenProfile: { ...fresh.citizenProfile, ...parsed.citizenProfile },
    case: { ...fresh.case, ...parsed.case },
    registrationDraft: { ...fresh.registrationDraft, ...parsed.registrationDraft },
    serviceDrafts: { ...fresh.serviceDrafts, ...parsed.serviceDrafts },
    appointment: { ...fresh.appointment, ...parsed.appointment },
    committeeDraft: { ...fresh.committeeDraft, ...parsed.committeeDraft },
    administration: { ...fresh.administration, ...parsed.administration },
    enterprise: {
      ...fresh.enterprise,
      ...parsed.enterprise,
      employeeProfile: {
        ...fresh.enterprise.employeeProfile,
        ...parsed.enterprise?.employeeProfile,
      },
    },
    studioForm: { ...fresh.studioForm, ...parsed.studioForm },
    notificationTemplate: { ...fresh.notificationTemplate, ...parsed.notificationTemplate },
  } as DemoState;
}

function getInitialState(): DemoState {
  if (typeof window === "undefined") return createInitialState();
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return createInitialState();
  try {
    const parsed = JSON.parse(saved) as Partial<DemoState>;
    return mergeSavedState(parsed);
  } catch {
    return createInitialState();
  }
}

function useRoute() {
  const [route, setRoute] = useState("/");
  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    queueMicrotask(syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  const navigate = (next: string) => {
    if (window.location.pathname !== next) window.history.pushState({}, "", next);
    startTransition(() => {
      setRoute(next);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return { route, navigate };
}

function localDate(iso: string, language: Language, includeTime = true) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-IQ" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

function num(value: number, language: Language) {
  return new Intl.NumberFormat(language === "ar" ? "ar-IQ" : "en-GB").format(value);
}

function StatusBadge({
  status,
  language,
}: {
  status: ApplicationStatus;
  language: Language;
}) {
  const config = statusLabels[status];
  return (
    <span className={`status-badge status-${config.tone}`}>
      <i aria-hidden="true" />
      {config[language]}
    </span>
  );
}

function MiniBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <span className={`mini-badge status-${tone}`}>{children}</span>;
}

/**
 * Official Martyrs Foundation emblem. Decorative in every placement — the
 * adjacent text always carries the accessible name — so it is hidden from
 * assistive tech rather than repeating that name twice.
 */
function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      {/* Pre-optimised at build time (86 KB, 512px) and never rendered above
          112px, so the optimizer would only add a round trip — and it is
          unavailable locally, where `env.ASSETS` is not bound. */}
      <Image src="/logo.png" alt="" width={512} height={512} unoptimized />
    </span>
  );
}

/** Document status is stored as a technical value; never show it raw to users. */
function documentStatusLabel(status: CaseDocument["status"], language: Language) {
  const labels: Record<CaseDocument["status"], [string, string]> = {
    verified: ["موثّقة", "Verified"],
    missing: ["ناقصة", "Missing"],
    review: ["قيد المراجعة", "In review"],
    expired: ["منتهية", "Expired"],
  };
  const [ar, en] = labels[status];
  return language === "ar" ? ar : en;
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}

/**
 * Counts a formatted metric up to its final value on mount and whenever it
 * changes. `value` arrives already localized (Arabic-Indic or Western digits,
 * separators, units), so the digit run is interpolated in place and the
 * surrounding formatting is preserved verbatim. Falls back to the exact string
 * when there is nothing numeric to animate, and always lands on it precisely.
 */
function useCountUp(value: string, durationMs = 900) {
  // Holds the in-flight value only; null means "show the final string".
  const [animated, setAnimated] = useState<string | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Match the first run of digits, including Arabic-Indic, with separators.
    const match = value.match(/[\d٠-٩][\d٠-٩.,٫٬]*/);
    if (reduced || !match) return;

    const raw = match[0];
    const westernized = raw
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[,٬]/g, "")
      .replace(/٫/, ".");
    const target = Number(westernized);
    if (!Number.isFinite(target) || target === 0) return;

    const arabicDigits = /[٠-٩]/.test(raw);
    const decimals = (westernized.split(".")[1] ?? "").length;
    const grouped = /[,٬]/.test(raw);
    const format = (n: number) => {
      const text = n.toLocaleString(arabicDigits ? "ar-IQ" : "en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      });
      return value.replace(raw, text);
    };

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // easeOutCubic — fast start, settled finish.
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress >= 1) {
        setAnimated(null);
        return;
      }
      setAnimated(format(target * eased));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setAnimated(null);
    };
  }, [value, durationMs]);

  return animated ?? value;
}

function MetricCard({
  label,
  value,
  trend,
  tone = "emerald",
  icon,
  onClick,
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: "emerald" | "navy" | "gold" | "red";
  icon: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  const shown = useCountUp(value);
  return (
    <Tag className={`metric-card metric-${tone}`} onClick={onClick}>
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric-label">{label}</span>
      {/* The animated value is decorative mid-flight; announce only the final
          figure so screen readers are not spammed with intermediate numbers. */}
      <strong aria-label={value}>
        <span aria-hidden="true">{shown}</span>
      </strong>
      {trend && <span className="metric-trend">{trend}</span>}
    </Tag>
  );
}

function AppShell({
  state,
  setState,
  route,
  navigate,
  children,
  openPersona,
  toast,
  theme,
  toggleTheme,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  route: string;
  navigate: (path: string) => void;
  children: ReactNode;
  openPersona: () => void;
  toast: (message: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const current = personas.find((persona) => persona.id === state.persona)!;
  const t = copy[state.language];
  const unreadCount = state.notifications.filter((notification) => !notification.read).length;
  const notificationsHome = {
    citizen: "/citizen/notifications",
    staff: "/staff/notifications",
    manager: "/manager/notifications",
    committee: "/committee/notifications",
    executive: "/executive/notifications",
    admin: "/admin/notifications",
  }[state.persona];

  // Close the panel on outside click or Escape, and restore focus to the bell.
  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notificationsOpen]);
  const isPublic =
    route === "/" || route === "/register" || route === "/services" || route.startsWith("/services/") || route.startsWith("/verify/");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (route === "/login" || route === "/register") return <>{children}</>;

  if (isPublic) {
    return (
      <div className="public-shell">
        <header className={`public-nav ${mobileOpen ? "public-menu-open" : ""}`}>
          <button
            className="brand"
            onClick={() => {
              navigate("/");
              setMobileOpen(false);
            }}
            aria-label={t.foundation}
          >
            <BrandMark />
            <span>
              <strong>{t.foundation}</strong>
              <small>{t.platform}</small>
            </span>
          </button>
          <nav id="public-navigation" aria-label={state.language === "ar" ? "التنقل العام" : "Public navigation"}>
            <button onClick={() => { navigate("/"); setMobileOpen(false); }}>
              {state.language === "ar" ? "الرئيسية" : "Home"}
            </button>
            <button onClick={() => { navigate("/services"); setMobileOpen(false); }}>
              {state.language === "ar" ? "دليل الخدمات" : "Services"}
            </button>
            <button onClick={() => { navigate("/verify/DOC-EDU-184"); setMobileOpen(false); }}>
              {state.language === "ar" ? "تحقق من وثيقة" : "Verify document"}
            </button>
          </nav>
          <button
            className="public-menu-toggle"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="public-navigation"
            aria-label={mobileOpen ? t.close : t.menu}
          >
            <span className="burger-lines" aria-hidden="true"><i /><i /><i /></span>
          </button>
          <div className="nav-actions">
            <button
              className="language-toggle"
              onClick={() =>
                setState((previous) => ({
                  ...previous,
                  language: previous.language === "ar" ? "en" : "ar",
                }))
              }
            >
              {state.language === "ar" ? "EN" : "العربية"}
            </button>
            <button className="button button-primary button-small" onClick={() => navigate("/login")}> 
              {state.language === "ar" ? "دخول العرض" : "Enter demo"}
            </button>
            <button className="button button-secondary button-small" onClick={() => navigate("/register")}> 
              {state.language === "ar" ? "تسجيل مواطن" : "Citizen registration"}
            </button>
          </div>
        </header>
        {mobileOpen && (
          <button
            className="public-menu-scrim"
            onClick={() => setMobileOpen(false)}
            aria-label={t.close}
          />
        )}
        {children}
      </div>
    );
  }

  return (
    <div className={`app-shell ${mobileOpen ? "mobile-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark className="brand-mark-light" />
          <div>
            <strong>{t.foundation}</strong>
            <small>{t.platform}</small>
          </div>
        </div>
        <div className="demo-ribbon">
          <span>●</span>
          <div>
            <strong>{t.demo}</strong>
            <small>{t.prototype}</small>
          </div>
        </div>
        <nav className="side-nav" aria-label={state.language === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
          {navByPersona[state.persona]
            .filter(([href]) =>
              !(
                state.persona === "staff" &&
                href.startsWith("/staff/cases/") &&
                !isCaseVisibleToOperations(state.case.status)
              ),
            )
            .map(([href, ar, en, icon]) => (
            <button
              key={href}
              className={route === href || (href.length > 8 && route.startsWith(`${href}/`)) ? "active" : ""}
              onClick={() => {
                navigate(href);
                setMobileOpen(false);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {state.language === "ar" ? ar : en}
              {href.endsWith("/notifications") &&
                (state.persona === "citizen" ? state.notifications.filter((notification) => !notification.read).length : 3) > 0 && (
                  <b>{state.persona === "citizen" ? state.notifications.filter((notification) => !notification.read).length : 3}</b>
                )}
            </button>
            ))}
        </nav>
        <button className="persona-compact" onClick={openPersona}>
          <span className="avatar">{current.initials}</span>
          <span>
            <strong>{state.language === "ar" ? current.nameAr : current.nameEn}</strong>
            <small>{state.language === "ar" ? current.labelAr : current.labelEn}</small>
          </span>
          <i>⌃</i>
        </button>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={t.menu}
          >
            <span className="burger-lines" aria-hidden="true"><i /><i /><i /></span>
          </button>
          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input
              placeholder={t.search}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  navigate(state.persona === "staff" ? "/staff/search" : "/services");
                  toast(state.language === "ar" ? "تم فتح نتائج البحث التجريبية" : "Demo search results opened");
                }
              }}
            />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="topbar-actions">
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? state.language === "ar" ? "التبديل إلى المظهر الفاتح" : "Switch to light theme"
                  : state.language === "ar" ? "التبديل إلى المظهر الداكن" : "Switch to dark theme"
              }
              aria-pressed={theme === "dark"}
              title={state.language === "ar" ? "تبديل المظهر" : "Toggle theme"}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              className="language-toggle"
              onClick={() =>
                setState((previous) => ({
                  ...previous,
                  language: previous.language === "ar" ? "en" : "ar",
                }))
              }
            >
              {state.language === "ar" ? "EN" : "ع"}
            </button>
            <div className="notification-menu" ref={notificationsRef}>
              <button
                className="icon-button notification-bell"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label={
                  state.language === "ar"
                    ? `الإشعارات${unreadCount ? ` — ${unreadCount} غير مقروءة` : ""}`
                    : `Notifications${unreadCount ? ` — ${unreadCount} unread` : ""}`
                }
                aria-expanded={notificationsOpen}
                aria-haspopup="true"
              >
                {/* The prototype's notification glyph. Kept in the same geometric
                    set as the rest of the shell — a colour emoji would be the only
                    one of its kind, and the dedicated bell codepoints render as
                    tofu on Windows. */}
                <span aria-hidden="true">◔</span>
                {/* Only shown when there is something unread — a "0" badge is noise. */}
                {unreadCount > 0 && <i aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</i>}
              </button>
              {notificationsOpen && (
                <div className="notification-panel" role="dialog" aria-label={state.language === "ar" ? "الإشعارات" : "Notifications"}>
                  <header>
                    <strong>{state.language === "ar" ? "الإشعارات" : "Notifications"}</strong>
                    {unreadCount > 0 && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setState((previous) => ({
                            ...previous,
                            notifications: previous.notifications.map((notification) => ({ ...notification, read: true })),
                          }))
                        }
                      >
                        {state.language === "ar" ? "تعليم الكل كمقروء" : "Mark all read"}
                      </button>
                    )}
                  </header>
                  <div className="notification-panel-list">
                    {state.notifications.length === 0 ? (
                      <p className="notification-empty">
                        {state.language === "ar" ? "لا توجد إشعارات." : "No notifications."}
                      </p>
                    ) : (
                      state.notifications.slice(0, 6).map((notification) => (
                        <button
                          key={notification.id}
                          className={`notification-item ${notification.read ? "" : "unread"}`}
                          onClick={() => {
                            setState((previous) => ({
                              ...previous,
                              notifications: previous.notifications.map((item) =>
                                item.id === notification.id ? { ...item, read: true } : item,
                              ),
                            }));
                            setNotificationsOpen(false);
                            navigate(notificationsHome);
                          }}
                        >
                          <span className="notification-dot" aria-hidden="true" />
                          <span>
                            <strong>{state.language === "ar" ? notification.titleAr : notification.titleEn}</strong>
                            <small>{state.language === "ar" ? notification.bodyAr : notification.bodyEn}</small>
                            <em>{localDate(notification.at, state.language)}</em>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <footer>
                    <button
                      className="text-button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate(notificationsHome);
                      }}
                    >
                      {state.language === "ar" ? "عرض كل الإشعارات" : "View all notifications"}
                    </button>
                  </footer>
                </div>
              )}
            </div>
            <button className="role-button" onClick={openPersona}>
              <span className="avatar avatar-small">{current.initials}</span>
              <span>{t.switchRole}</span>
              <b>⌄</b>
            </button>
          </div>
        </header>
        {/* Keyed on the route so each screen change replays the entrance. */}
        <main className="main-content screen-in" key={route}>
          {children}
        </main>
      </div>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label={t.close}
        />
      )}
    </div>
  );
}

function PersonaDialog({
  state,
  setState,
  close,
  navigate,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  close: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal persona-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">
              {state.language === "ar" ? "تبديل فوري — يحفظ حالة العرض" : "Instant switch — demo state is preserved"}
            </span>
            <h2 id="persona-title">
              {state.language === "ar" ? "اختر منظور المستخدم" : "Choose a user perspective"}
            </h2>
          </div>
          <button className="icon-button" onClick={close} aria-label={copy[state.language].close}>
            ×
          </button>
        </header>
        <div className="persona-grid">
          {personas.map((persona) => (
            <button
              key={persona.id}
              className={state.persona === persona.id ? "persona-card selected" : "persona-card"}
              onClick={() => {
                setState((previous) => ({ ...previous, persona: persona.id }));
                navigate(persona.home);
                close();
              }}
            >
              <span className="avatar">{persona.initials}</span>
              <span>
                <strong>{state.language === "ar" ? persona.labelAr : persona.labelEn}</strong>
                <b>{state.language === "ar" ? persona.nameAr : persona.nameEn}</b>
                <small>{state.language === "ar" ? persona.descriptionAr : persona.descriptionEn}</small>
              </span>
              {state.persona === persona.id && <i>✓</i>}
            </button>
          ))}
        </div>
        <footer>
          <span>⚿ MFA</span>
          {state.language === "ar"
            ? "محاكاة واجهة فقط. لا يوجد تحقق هوية أو صلاحيات إنتاجية."
            : "Interface simulation only. No production identity or authorization."}
        </footer>
      </section>
    </div>
  );
}

function LandingPage({
  language,
  navigate,
}: {
  language: Language;
  navigate: (path: string) => void;
}) {
  const ar = language === "ar";
  return (
    <>
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <span className="institutional-kicker">
              <i /> {ar ? "خدمات حكومية مترابطة، واضحة، وإنسانية" : "Connected, clear and human government services"}
            </span>
            <h1>
              {ar ? "حقّك أقرب، وخدمتك" : "Your entitlement, delivered"}
              <em>{ar ? " أوضح." : " with clarity."}</em>
            </h1>
            <p>
              {ar
                ? "منصة رقمية موحّدة تضع المستفيد والأسرة في قلب الخدمة، وتربط الطلب بالوثيقة والقاعدة القانونية والقرار القابل للتحقق."
                : "A unified digital platform connecting every request to verified family data, evidence, legal rules and a verifiable decision."}
            </p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={() => navigate("/services")}>
                {ar ? "استكشف الخدمات" : "Explore services"} <span className="dir-icon" aria-hidden="true">←</span>
              </button>
              <button className="button button-ghost button-large" onClick={() => navigate("/login")}>
                {ar ? "دخول العرض التجريبي" : "Open interactive demo"}
              </button>
            </div>
            <div className="trust-row">
              <span>✓ {ar ? "عربي أولاً" : "Arabic-first"}</span>
              <span>✓ {ar ? "قرارات بشرية" : "Human decisions"}</span>
              <span>✓ {ar ? "أثر تدقيقي واضح" : "Visible audit trail"}</span>
            </div>
          </div>
          <div className="hero-product" aria-label={ar ? "معاينة الطلب" : "Application preview"}>
            <div className="product-glow" />
            <div className="product-window">
              <header>
                <BrandMark className="brand-mark-light" />
                <div>
                  <b>{ar ? "طلب المنحة التعليمية" : "Education Grant Application"}</b>
                  <small>MF-2026-000184</small>
                </div>
                <StatusBadge status="Under Review" language={language} />
              </header>
              <div className="product-steps">
                {["تم التقديم", "مراجعة الموظف", "قرار اللجنة", "النتيجة"].map((label, index) => (
                  <div key={label} className={index < 2 ? "done" : ""}>
                    <i>{index < 2 ? "✓" : index + 1}</i>
                    <span>{ar ? label : ["Submitted", "Staff review", "Committee", "Decision"][index]}</span>
                  </div>
                ))}
              </div>
              <div className="product-body">
                <div className="product-main">
                  <span className="eyebrow">{ar ? "الإجراء التالي" : "NEXT ACTION"}</span>
                  <h3>{ar ? "إضافة تأييد الاستمرار بالدراسة" : "Add enrollment confirmation"}</h3>
                  <p>{ar ? "مطلوب لإكمال التحقق من أهلية الطالبة مريم." : "Required to complete Maryam’s eligibility review."}</p>
                  <button onClick={() => navigate("/register")}>{ar ? "ابدأ رحلة المواطن" : "Start the citizen journey"} ←</button>
                </div>
                <div className="ai-mini">
                  <span>✦ {ar ? "ذكاء اصطناعي محاكى" : "SIMULATED AI"}</span>
                  <b>{ar ? "٣ من ٤ متطلبات مكتملة" : "3 of 4 requirements complete"}</b>
                  <small>{ar ? "المصدر: قائمة وثائق EDU-2.3" : "Source: EDU-2.3 document list"}</small>
                </div>
              </div>
            </div>
            <div className="floating-stat stat-one">
              <span>◷</span>
              <b>{ar ? "٨٢ ساعة" : "82 hours"}</b>
              <small>{ar ? "متبقية ضمن المهلة" : "remaining in SLA"}</small>
            </div>
            <div className="floating-stat stat-two">
              <span>✓</span>
              <b>{ar ? "قابل للتدقيق" : "Auditable"}</b>
              <small>COR-26-11854</small>
            </div>
          </div>
        </section>
        <section className="public-metrics">
          <div>
            <strong>20+</strong>
            <span>{ar ? "خدمة ممثلة" : "represented services"}</span>
          </div>
          <div>
            <strong>6</strong>
            <span>{ar ? "مناظير وظيفية" : "role perspectives"}</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>{ar ? "بيانات اصطناعية" : "synthetic data"}</span>
          </div>
          <div>
            <strong>AA</strong>
            <span>{ar ? "هدف إتاحة العرض" : "accessibility target"}</span>
          </div>
        </section>
        <section className="public-section">
          <SectionHeader
            eyebrow={ar ? "خدمات تبدأ من احتياجك" : "SERVICES BUILT AROUND NEEDS"}
            title={ar ? "مسار واحد من الاستكشاف إلى القرار" : "One journey from discovery to decision"}
            description={
              ar
                ? "متطلبات واضحة، بيانات موثّقة قابلة لإعادة الاستخدام، وحالة طلب مفهومة في كل خطوة."
                : "Clear requirements, reusable verified data, and an understandable status at every step."
            }
            action={
              <button className="text-button" onClick={() => navigate("/services")}>
                {ar ? "عرض كل الخدمات ←" : "View all services →"}
              </button>
            }
          />
          <div className="feature-grid">
            {services.slice(0, 3).map((service, index) => (
              <button key={service.id} className="public-service-card" onClick={() => navigate(`/services/${service.id}`)}>
                <span className={`service-symbol symbol-${index + 1}`}>{["◇", "✦", "▧"][index]}</span>
                <MiniBadge tone={index === 0 ? "gold" : "success"}>
                  {ar ? service.categoryAr : service.category}
                </MiniBadge>
                <h3>{ar ? service.titleAr : service.titleEn}</h3>
                <p>{ar ? service.descriptionAr : service.descriptionEn}</p>
                <footer>
                  <span>◷ {num(service.days, language)} {ar ? "يوم" : "days"}</span>
                  <b>{ar ? "التفاصيل ←" : "Details →"}</b>
                </footer>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="brand">
          <BrandMark className="brand-mark-light" />
          <span>
            <strong>{copy[language].foundation}</strong>
            <small>{ar ? "نموذج إثبات مفهوم — ٢٠٢٦" : "Proof of concept — 2026"}</small>
          </span>
        </div>
        <p>{copy[language].prototype}</p>
      </footer>
    </>
  );
}

function LoginPage({
  state,
  setState,
  navigate,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
}) {
  const ar = state.language === "ar";
  return (
    <main className="login-page">
      <section className="login-panel">
        <button className="back-link" onClick={() => navigate("/")}>
          {ar ? "→ العودة إلى المنصة العامة" : "← Back to public site"}
        </button>
        <div className="login-heading">
          <BrandMark />
          <span className="demo-pill">● {ar ? "وضع العرض التجريبي" : "DEMO MODE"}</span>
          <h1>{ar ? "اختر دوراً لبدء الجولة" : "Choose a role to begin"}</h1>
          <p>
            {ar
              ? "يمكنك تبديل الدور في أي وقت. تبقى حالة الطلب والقرارات محفوظة بين جميع المناظير."
              : "Switch roles at any time. Case progress and decisions remain synchronized across every perspective."}
          </p>
        </div>
        <div className="login-personas">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                setState((previous) => ({ ...previous, persona: persona.id }));
                navigate(persona.home);
              }}
            >
              <span className="avatar">{persona.initials}</span>
              <span>
                <strong>{ar ? persona.labelAr : persona.labelEn}</strong>
                <b>{ar ? persona.nameAr : persona.nameEn}</b>
                <small>{ar ? persona.descriptionAr : persona.descriptionEn}</small>
              </span>
              <i className="dir-icon" aria-hidden="true">←</i>
            </button>
          ))}
        </div>
        <div className="registration-callout">
          <div><span>+</span><p><strong>{ar ? "مواطن جديد؟" : "New citizen?"}</strong><small>{ar ? "أنشئ ملفك واختر تصنيفك الأولي قبل بدء الخدمة." : "Create your profile and choose an initial category before starting a service."}</small></p></div>
          <button className="button button-secondary" onClick={() => navigate("/register")}>{ar ? "إنشاء حساب مواطن" : "Create citizen account"} ←</button>
        </div>
        <div className="login-notice">
          <span>⚿</span>
          <div>
            <strong>{ar ? "بيئة عرض آمنة" : "Safe demonstration environment"}</strong>
            <p>
              {ar
                ? "جميع الأسماء والسجلات والوثائق اصطناعية. لا يوجد اتصال بخدمات حكومية أو دفع حقيقي."
                : "All names, records and documents are synthetic. No live government or payment connection exists."}
            </p>
          </div>
        </div>
      </section>
      <aside className="login-visual">
        <div className="visual-orbit orbit-one" />
        <div className="visual-orbit orbit-two" />
        <div className="visual-emblem">
          <BrandMark className="brand-mark-xl brand-mark-light" />
        </div>
        <div className="visual-copy">
          <span>{ar ? "المنصة الرقمية الموحّدة" : "UNIFIED DIGITAL PLATFORM"}</span>
          <h2>{ar ? "خدمة مترابطة. قرار مُفسّر. أثر موثوق." : "Connected service. Explainable decision. Trusted trail."}</h2>
        </div>
      </aside>
    </main>
  );
}

function RegistrationPage({
  state,
  setState,
  navigate,
  toast,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const { step, category: selected, fullName, mobile, email, governorate, relationship, reference, accepted } = state.registrationDraft;
  const updateRegistration = (patch: Partial<DemoState["registrationDraft"]>) => setState((previous) => ({ ...previous, registrationDraft: { ...previous.registrationDraft, ...patch } }));
  const setStep = (value: number | ((current: number) => number)) => updateRegistration({ step: typeof value === "function" ? value(step) : value });
  const setSelected = (value: CitizenCategory) => updateRegistration({ category: value });
  const setFullName = (value: string) => updateRegistration({ fullName: value });
  const setMobile = (value: string) => updateRegistration({ mobile: value });
  const setEmail = (value: string) => updateRegistration({ email: value });
  const setGovernorate = (value: string) => updateRegistration({ governorate: value });
  const setRelationship = (value: string) => updateRegistration({ relationship: value });
  const setReference = (value: string) => updateRegistration({ reference: value });
  const setAccepted = (value: boolean) => updateRegistration({ accepted: value });
  const category = citizenCategory(selected);
  const matchingServices = services.filter((service) => service.audiences?.includes(selected)).slice(0, 4);
  const uploadEvidence = async (file?: File) => {
    if (!file) return;
    try {
      const document = await uploadStoredDocument(file, `registration-${selected}`);
      setState((previous) => ({
        ...previous,
        storedDocuments: [document, ...previous.storedDocuments.filter((item) => item.category !== `registration-${selected}`)],
        registrationDraft: { ...previous.registrationDraft, evidenceFileName: document.name },
      }));
      toast(ar ? "تم رفع الإثبات وحفظه" : "Evidence uploaded and saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : (ar ? "تعذر رفع الملف" : "Upload failed"));
    }
  };
  const submit = () => {
    if (!accepted) return;
    const now = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      persona: "citizen",
      citizenProfile: {
        registered: true,
        category: selected,
        fullNameAr: ar ? fullName : previous.citizenProfile.fullNameAr,
        fullNameEn: ar ? previous.citizenProfile.fullNameEn : fullName,
        mobile,
        email,
        governorateAr: governorate,
        governorateEn: governorate === "بغداد" ? "Baghdad" : governorate,
        relationship,
        referenceNumber: reference,
        declarationAccepted: true,
      },
      notifications: [{
        id: `registration-${Date.now()}`,
        titleAr: "تم إنشاء ملف المواطن",
        titleEn: "Citizen profile created",
        bodyAr: `تم حفظ التصنيف الأولي: ${category.labelAr}. سيخضع الإثبات للمراجعة قبل أي قرار.`,
        bodyEn: `Initial category saved: ${category.labelEn}. Evidence will be reviewed before any decision.`,
        at: now,
        read: false,
        channel: "in-app",
      }, ...previous.notifications],
    }));
    navigate("/citizen");
  };
  return (
    <main className="registration-page">
      <header className="registration-header">
        <button className="back-link" onClick={() => navigate("/login")}>{ar ? "→ العودة للدخول" : "← Back to sign in"}</button>
        <div><BrandMark /><p><strong>{ar ? "تسجيل مواطن جديد" : "New citizen registration"}</strong><small>{ar ? "بيانات تجريبية فقط" : "Demo data only"}</small></p></div>
        <span className="demo-pill">● {ar ? "إثبات مفهوم" : "POC"}</span>
      </header>
      <section className="registration-shell">
        <aside className="registration-progress">
          <span className="eyebrow">{ar ? "إنشاء الملف" : "CREATE PROFILE"}</span>
          <h1>{ar ? "عرّف حالتك، ثم نوجّهك للخدمات المناسبة." : "Describe your case, then see relevant services."}</h1>
          <p>{ar ? "التصنيف هنا أولي ولا يثبت صفة قانونية أو استحقاقاً. التحقق والقرار بشريان." : "This is an initial classification, not legal status or entitlement. Verification and decisions remain human."}</p>
          <ol>{[
            ["١", "اختيار التصنيف", "Choose category"],
            ["٢", "بيانات الحساب والإثبات", "Account and evidence"],
            ["٣", "المراجعة وإنشاء الحساب", "Review and create"],
          ].map(([number, labelAr, labelEn], index) => <li key={number} className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""}><i>{step > index + 1 ? "✓" : number}</i><span>{ar ? labelAr : labelEn}</span></li>)}</ol>
          <div className="registration-trust"><span>⚿</span><p><strong>{ar ? "خصوصية واضحة" : "Clear privacy"}</strong><small>{ar ? "لا ترسل معلومات حقيقية في العرض. كل السجلات اصطناعية." : "Do not enter real information in this demo. All records are synthetic."}</small></p></div>
        </aside>
        <section className="registration-form-card">
          {step === 1 && <>
            <SectionHeader eyebrow={ar ? "الخطوة ١ من ٣" : "STEP 1 OF 3"} title={ar ? "ما هو التصنيف الأقرب لحالتك؟" : "Which category best matches your case?"} description={ar ? "اختيارك يغيّر الخدمات والأسئلة الظاهرة، ويمكن للموظف تصحيحه بعد التحقق." : "Your choice changes visible services and questions, and staff can correct it after verification."} />
            <div className="citizen-category-grid">{citizenCategoryOptions.map((item) => <button key={item.id} className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}><span>{item.icon}</span><div><strong>{ar ? item.labelAr : item.labelEn}</strong><p>{ar ? item.descriptionAr : item.descriptionEn}</p><small>{ar ? item.evidenceAr : "Evidence is reviewed by staff"}</small></div><i>{selected === item.id ? "✓" : ""}</i></button>)}</div>
          </>}
          {step === 2 && <>
            <SectionHeader eyebrow={ar ? "الخطوة ٢ من ٣" : "STEP 2 OF 3"} title={ar ? `بيانات ${category.labelAr}` : `${category.labelEn} details`} description={ar ? "الحقول التالية تتغير حسب التصنيف وتبقى بانتظار التحقق." : "These fields adapt to the selected category and remain pending verification."} />
            <div className="registration-form-grid">
              <label className="input-field"><span>{ar ? "الاسم الكامل *" : "Full name *"}</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label className="input-field"><span>{ar ? "رقم الهاتف *" : "Mobile *"}</span><input dir="ltr" value={mobile} onChange={(event) => setMobile(event.target.value)} /></label>
              <label className="input-field"><span>{ar ? "البريد الإلكتروني" : "Email"}</span><input dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label className="input-field"><span>{ar ? "المحافظة *" : "Governorate *"}</span><select value={governorate} onChange={(event) => setGovernorate(event.target.value)}><option>بغداد</option><option>البصرة</option><option>نينوى</option><option>كربلاء</option></select></label>
              <label className="input-field"><span>{selected === "martyr-family" || selected === "missing-family" ? (ar ? "صلة مقدم الطلب *" : "Applicant relationship *") : (ar ? "نوع الضرر أو الإصابة *" : "Injury or harm type *")}</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label>
              <label className="input-field"><span>{ar ? "رقم المرجع أو الكتاب" : "Reference or letter number"}</span><input dir="ltr" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
            </div>
            <div className="registration-upload"><span>PDF</span><div><strong>{state.registrationDraft.evidenceFileName || (ar ? "أرفق إثباتاً تجريبياً" : "Attach demo evidence")}</strong><p>{ar ? category.evidenceAr : "The required evidence depends on the selected category."}</p></div><label className="button button-secondary"><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { void uploadEvidence(event.target.files?.[0]); event.target.value = ""; }} />{state.registrationDraft.evidenceFileName ? (ar ? "تغيير الملف" : "Change file") : (ar ? "اختيار ملف" : "Choose file")}</label></div>
          </>}
          {step === 3 && <>
            <SectionHeader eyebrow={ar ? "الخطوة ٣ من ٣" : "STEP 3 OF 3"} title={ar ? "راجع قصة المستخدم والخدمات" : "Review the user story and services"} description={ar ? "هذه هي التجربة التي سيبني عليها النظام التوجيه واتخاذ القرار المساند." : "This is the journey used for guidance and decision support."} />
            <article className="registration-story"><span>{category.icon}</span><div><MiniBadge tone="info">{ar ? category.labelAr : category.labelEn}</MiniBadge><h2>{ar ? "قصة المستخدم" : "User story"}</h2><p>{ar ? category.storyAr : category.storyEn}</p></div></article>
            <div className="registration-service-preview"><header><h3>{ar ? "خدمات ستظهر لهذا الملف" : "Services shown for this profile"}</h3><small>{ar ? "ترشيح أولي — ليس إثبات استحقاق" : "Initial match — not entitlement"}</small></header>{matchingServices.map((service) => <div key={service.id}><span>✓</span><p><strong>{ar ? service.titleAr : service.titleEn}</strong><small>{ar ? service.categoryAr : service.category}</small></p></div>)}</div>
            <label className="registration-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span><strong>{ar ? "أقر أن البيانات تجريبية وأن التصنيف أولي" : "I confirm this is demo data and an initial category"}</strong><small>{ar ? "أي صفة أو استحقاق يحتاج وثائق ومراجعة بشرية وقراراً رسمياً." : "Any status or entitlement requires evidence, human review and an official decision."}</small></span></label>
          </>}
          <footer className="registration-actions"><button className="button button-secondary" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>{ar ? "السابق" : "Back"}</button>{step < 3 ? <button className="button button-primary" disabled={step === 2 && (!fullName || !mobile || !relationship)} onClick={() => setStep((current) => Math.min(3, current + 1))}>{ar ? "التالي" : "Continue"} ←</button> : <button className="button button-primary" disabled={!accepted} onClick={submit}>{ar ? "إنشاء الحساب والدخول" : "Create account and continue"} ←</button>}</footer>
        </section>
      </section>
    </main>
  );
}

function ServiceCatalogue({
  state,
  navigate,
  citizen = false,
}: {
  state: DemoState;
  navigate: (path: string) => void;
  citizen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const ar = state.language === "ar";
  const availableServices = citizen
    ? services.filter((service) => service.audiences?.includes(state.citizenProfile.category))
    : services;
  const filtered = availableServices.filter(
    (service) =>
      (category === "all" || service.category === category) &&
      `${service.titleAr} ${service.titleEn} ${service.descriptionAr}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const categories = [
    ["all", "الكل", "All"],
    ["education", "التعليم", "Education"],
    ["health", "الصحة", "Health"],
    ["housing", "السكن", "Housing"],
    ["employment", "التوظيف", "Employment"],
    ["legal", "القانونية", "Legal"],
    ["benefits", "الاستحقاقات", "Benefits"],
    ["social", "الاجتماعية", "Social"],
    ["certificates", "الشهادات", "Certificates"],
    ["other", "أخرى", "Other"],
  ];
  return (
    <div className={citizen ? "page" : "public-catalogue"}>
      <SectionHeader
        eyebrow={citizen ? (ar ? "خدمات مناسبة لملفك" : "PERSONALIZED SERVICES") : ar ? "دليل الخدمات" : "SERVICE CATALOGUE"}
        title={ar ? "كيف يمكننا خدمتك؟" : "How can we help?"}
        description={
          ar
            ? "ابحث عن الخدمة، افهم المتطلبات والمدة، وابدأ رقمياً."
            : "Find a service, understand its requirements and timeline, then start digitally."
        }
      />
      <div className="catalogue-search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? "ابحث باسم الخدمة أو الاحتياج…" : "Search by service or need…"}
          aria-label={ar ? "البحث في الخدمات" : "Search services"}
        />
        <b>{num(filtered.length, state.language)} {ar ? "خدمة" : "services"}</b>
      </div>
      <div className="category-tabs" role="tablist">
        {categories.map(([id, labelAr, labelEn]) => (
          <button
            key={id}
            role="tab"
            aria-selected={category === id}
            className={category === id ? "active" : ""}
            onClick={() => setCategory(id)}
          >
            {ar ? labelAr : labelEn}
          </button>
        ))}
      </div>
      <div className="service-grid">
        {filtered.map((service, index) => (
          <article className="service-card" key={service.id}>
            <header>
              <span className={`service-icon service-icon-${(index % 4) + 1}`}>
                {["◇", "✦", "▦", "◉"][index % 4]}
              </span>
              {service.digital ? (
                <MiniBadge tone="success">{ar ? "رقمية بالكامل" : "Fully digital"}</MiniBadge>
              ) : (
                <MiniBadge tone="warning">{ar ? "حضور جزئي" : "Hybrid"}</MiniBadge>
              )}
            </header>
            <span className="service-category">{ar ? service.categoryAr : service.category}</span>
            <h3>{ar ? service.titleAr : service.titleEn}</h3>
            <p>{ar ? service.descriptionAr : service.descriptionEn}</p>
            <div className="service-meta">
              <span>◷ {num(service.days, state.language)} {ar ? "يوم عمل" : "business days"}</span>
              <span>▧ {num(service.documents, state.language)} {ar ? "وثائق" : "documents"}</span>
            </div>
            <button
              className="card-link"
              onClick={() => navigate(`/services/${service.id}`)}
              aria-label={`${ar ? "تفاصيل" : "Details"} ${ar ? service.titleAr : service.titleEn}`}
            >
              {ar ? "عرض التفاصيل" : "View details"} <span className="dir-icon" aria-hidden="true">←</span>
            </button>
          </article>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <span>⌕</span>
          <h3>{ar ? "لم نجد خدمة مطابقة" : "No matching service"}</h3>
          <p>{ar ? "جرّب كلمة أخرى أو اختر فئة مختلفة." : "Try another term or category."}</p>
          <button className="button button-secondary" onClick={() => { setQuery(""); setCategory("all"); }}>
            {ar ? "مسح عوامل التصفية" : "Clear filters"}
          </button>
        </div>
      )}
    </div>
  );
}

function ServiceDetail({
  state,
  serviceId,
  navigate,
}: {
  state: DemoState;
  serviceId: string;
  navigate: (path: string) => void;
}) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const eligibilityItems = serviceEligibilityRequirements(service, ar);
  const requiredDocuments = serviceDocuments(service);
  return (
    <main className="service-detail">
      <button className="back-link" onClick={() => navigate("/services")}>
        {ar ? "→ العودة إلى دليل الخدمات" : "← Back to services"}
      </button>
      <section className="service-detail-hero">
        <div>
          <MiniBadge tone="gold">{ar ? service.categoryAr : service.category}</MiniBadge>
          <h1>{ar ? service.titleAr : service.titleEn}</h1>
          <p>{ar ? service.descriptionAr : service.descriptionEn}</p>
          <div className="detail-meta">
            <span><b>{num(service.days, state.language)}</b> {ar ? "يوم عمل" : "business days"}</span>
            <span><b>{num(service.documents, state.language)}</b> {ar ? "وثائق" : "documents"}</span>
            <span><b>{num(service.feeIqd, state.language)}</b> {ar ? "د.ع رسوم مهيأة" : "IQD configured fee"}</span>
          </div>
        </div>
        <aside>
          <span>✓</span>
          <strong>{ar ? "يمكنك إكمالها رقمياً" : "Available end-to-end online"}</strong>
          <p>{ar ? "لن تحتاج إلى زيارة المديرية ضمن سيناريو العرض." : "No directorate visit is required in this demo journey."}</p>
          <button
            className="button button-primary button-large"
            onClick={() => navigate(`/citizen/eligibility/${service.id}`)}
          >
            {ar ? "تحقق من الأهلية وابدأ" : "Check eligibility and start"} ←
          </button>
        </aside>
      </section>
      <section className="detail-layout">
        <div className="detail-main">
          <article className="content-card">
            <h2>{ar ? "هل هذه الخدمة مناسبة لك؟" : "Is this service for you?"}</h2>
            <ul className="check-list">
              {eligibilityItems.map((item) => <li key={item}><span>✓</span>{item}</li>)}
            </ul>
          </article>
          <article className="content-card">
            <h2>{ar ? "المستندات المطلوبة" : "Required documents"}</h2>
            <div className="requirement-list">
              {requiredDocuments.map(([titleAr, titleEn], index) => (
                (() => {
                  const title = ar ? titleAr : titleEn;
                  const description = index === 0 ? (ar ? "متوفرة في محفظتك" : "Available in your wallet") : (ar ? "PDF أو صورة واضحة" : "PDF or clear image");
                  const type = index === 0 ? "ready" : "upload";
                  return (
                <div key={title}>
                  <span>{type === "ready" ? "✓" : "↑"}</span>
                  <div><strong>{title}</strong><small>{description}</small></div>
                  <MiniBadge tone={type === "ready" ? "success" : "neutral"}>{type === "ready" ? (ar ? "جاهزة" : "Ready") : (ar ? "مطلوبة" : "Required")}</MiniBadge>
                </div>
                  );
                })()
              ))}
            </div>
          </article>
          <article className="content-card">
            <h2>{ar ? "مراحل الخدمة" : "Service stages"}</h2>
            <div className="stage-list">
              {[
                [ar ? "التحقق الأولي من الأهلية" : "Initial eligibility", ar ? "فحص مبدئي قابل للتفسير ولا يمثل قراراً نهائياً" : "An explainable preliminary check, not a final decision"],
                [ar ? "الرسوم عند وجودها" : "Fee when applicable", service.feeIqd > 0 ? (ar ? `${num(service.feeIqd, state.language)} د.ع ضمن محاكي الدفع` : `${num(service.feeIqd, state.language)} IQD in the payment sandbox`) : (ar ? "هذه الخدمة معفاة/دون رسوم حسب تهيئة العرض" : "No fee in this demo service configuration")],
                [ar ? "تقديم الطلب" : "Submit", ar ? "إدخال البيانات والوثائق" : "Data and documents"],
                [ar ? "المراجعة الأولية" : "Initial review", ar ? "فحص اكتمال المتطلبات" : "Completeness and requirement checks"],
                [ar ? "المعالجة المختصة" : "Specialized handling", ar ? "مراجعة بشرية حسب نوع الخدمة" : "Human handling based on service type"],
                [ar ? "إصدار النتيجة" : "Decision", ar ? "وثيقة قابلة للتحقق" : "Verifiable document"],
              ].map(([title, description], index) => (
                <div key={title}><i>{index + 1}</i><span><strong>{title}</strong><small>{description}</small></span></div>
              ))}
            </div>
          </article>
        </div>
        <aside className="detail-sidebar">
          <article className="content-card legal-card">
            <span className="eyebrow">{ar ? "الأساس القانوني التجريبي" : "DEMO LEGAL BASIS"}</span>
            <h3>{`LR-${service.category.toUpperCase()}-01 · ${service.id.toUpperCase()}`}</h3>
            <p>{ar ? "سجلات قواعد اصطناعية للشرح فقط، وليست نصوصاً قانونية نافذة." : "Synthetic rule records for explanation only; not authoritative law."}</p>
            <button className="text-button" onClick={() => navigate("/compliance")}>{ar ? "عرض المراجع" : "View references"} ←</button>
          </article>
          <article className="content-card support-card">
            <span>?</span>
            <h3>{ar ? "تحتاج مساعدة؟" : "Need help?"}</h3>
            <p>{ar ? "يوضح المساعد التجريبي المتطلبات بلغة بسيطة." : "The demo assistant explains requirements in plain language."}</p>
            <button className="button button-secondary" onClick={() => navigate("/citizen/help")}>
              {ar ? "افتح المساعدة" : "Open help"}
            </button>
          </article>
        </aside>
      </section>
    </main>
  );
}

function CitizenDashboard({
  state,
  navigate,
}: {
  state: DemoState;
  navigate: (path: string) => void;
}) {
  const ar = state.language === "ar";
  const completionNeeded = state.case.status === "Awaiting Citizen Completion";
  const approved = state.case.status === "Approved";
  const profileCategory = citizenCategory(state.citizenProfile.category);
  const recommendedServices = services.filter((service) => service.audiences?.includes(state.citizenProfile.category)).slice(0, 3);
  return (
    <div className="page citizen-page">
      <SectionHeader
        eyebrow={ar ? `الأحد، ٢٦ تموز ٢٠٢٦` : "Sunday, 26 July 2026"}
        title={ar ? `أهلاً ${state.citizenProfile.fullNameAr.split(" ")[0]}، كل شيء في مكان واحد.` : `Welcome ${state.citizenProfile.fullNameEn.split(" ")[0]}. Everything in one place.`}
        description={ar ? `تصنيف الملف الأولي: ${profileCategory.labelAr}. الخدمات أدناه مخصصة لهذا المسار.` : `Initial profile category: ${profileCategory.labelEn}. Services below match this track.`}
        action={<button className="button button-primary" onClick={() => navigate("/citizen/services")}>{ar ? "ابدأ خدمة جديدة" : "Start a new service"} +</button>}
      />
      <div className="citizen-overview">
        <article className={`next-action-card ${approved ? "approved" : ""}`}>
          <header>
            <div>
              <span className="eyebrow">{approved ? (ar ? "تم إصدار القرار" : "DECISION ISSUED") : (ar ? "طلبك النشط" : "ACTIVE APPLICATION")}</span>
              <h2>{ar ? "المنحة التعليمية لأحد أفراد الأسرة" : "Family Education Grant"}</h2>
              <small dir="ltr">MF-2026-000184</small>
            </div>
            <StatusBadge status={state.case.status} language={state.language} />
          </header>
          <div className="progress-track">
            <i style={{ width: approved ? "100%" : completionNeeded ? "46%" : state.case.status === "Draft" ? "12%" : "62%" }} />
          </div>
          <div className="action-callout">
            <span>{approved ? "✓" : completionNeeded ? "!" : "→"}</span>
            <div>
              <small>{ar ? "الإجراء التالي" : "NEXT ACTION"}</small>
              <strong>
                {approved
                  ? ar ? "عرض القرار النهائي والتحقق منه" : "View and verify the final decision"
                  : completionNeeded
                    ? ar ? "أضيفي تأييد الاستمرار بالدراسة" : "Add enrollment confirmation"
                    : state.case.status === "Draft"
                      ? ar ? "أكملي مسودة الطلب" : "Complete your draft"
                      : ar ? "لا يوجد إجراء مطلوب منك الآن" : "No action is required from you"}
              </strong>
            </div>
            <button onClick={() => navigate("/citizen/applications/MF-2026-000184")}>
              {ar ? "فتح الطلب" : "Open application"} ←
            </button>
          </div>
          <footer>
            <span>◷ {ar ? "المهلة المتوقعة: ١٢ يوم عمل" : "Expected: 12 business days"}</span>
            <span>{ar ? "آخر تحديث" : "Updated"} {localDate(state.case.updatedAt, state.language)}</span>
          </footer>
        </article>
        <aside className="profile-card">
          <header>
            <span className="avatar avatar-large">زع</span>
            <div><strong>{ar ? state.citizenProfile.fullNameAr : state.citizenProfile.fullNameEn}</strong><small>{state.citizenProfile.referenceNumber}</small></div>
            <b>{ar ? "٩٢٪" : "92%"}</b>
          </header>
          <div className="profile-progress"><i /></div>
          <p>{ar ? `${profileCategory.labelAr} · تصنيف أولي بانتظار تحقق الوثائق.` : `${profileCategory.labelEn} · initial category pending evidence verification.`}</p>
          <button className="text-button" onClick={() => navigate("/citizen/profile")}>{ar ? "إكمال الملف" : "Complete profile"} ←</button>
        </aside>
      </div>
      <div className="quick-actions">
        {[
          ["/citizen/family", "♧", "عرض الأسرة 360", "Family 360"],
          ["/citizen/documents", "▧", "محفظة الوثائق", "Document wallet"],
          ["/citizen/appointments", "◷", "حجز موعد", "Book appointment"],
          ["/citizen/eligibility/education-grant", "◇", "التحقق الأولي من الأهلية", "Initial eligibility check"],
          ["/citizen/payments/official-certificate", "◈", "دفع الرسوم عند وجودها", "Pay fees when applicable"],
        ].map(([path, icon, labelAr, labelEn]) => (
          <button key={path} onClick={() => navigate(path)}><span>{icon}</span><strong>{ar ? labelAr : labelEn}</strong><i className="dir-icon" aria-hidden="true">←</i></button>
        ))}
      </div>
      <section className="dashboard-grid">
        <article className="content-card eligible-services">
          <header><div><span className="eyebrow">{ar ? "مقترحة حسب التصنيف" : "CATEGORY-MATCHED"}</span><h2>{ar ? `خدمات ${profileCategory.labelAr}` : `${profileCategory.labelEn} services`}</h2></div><button className="text-button" onClick={() => navigate("/citizen/services")}>{ar ? "عرض الكل" : "View all"} ←</button></header>
          {recommendedServices.map((service, index) => (
            <button key={service.id} onClick={() => navigate(`/services/${service.id}`)}>
              <span className={`service-icon service-icon-${index + 1}`}>{["◇", "✦", "▦"][index]}</span>
              <span><strong>{ar ? service.titleAr : service.titleEn}</strong><small>{num(service.days, state.language)} {ar ? "يوم عمل" : "business days"} · {service.documents} {ar ? "وثائق" : "documents"}</small></span>
              <i className="dir-icon" aria-hidden="true">←</i>
            </button>
          ))}
        </article>
        <article className="content-card notifications-preview">
          <header><div><span className="eyebrow">{ar ? "آخر المستجدات" : "LATEST"}</span><h2>{ar ? "الإشعارات" : "Notifications"}</h2></div><button className="text-button" onClick={() => navigate("/citizen/notifications")}>{ar ? "الكل" : "All"} ←</button></header>
          {state.notifications.slice(0, 4).map((notification) => (
            <div key={notification.id} className={notification.read ? "" : "unread"}>
              <span>{notification.channel === "sms" ? "▣" : notification.channel === "email" ? "✉" : "●"}</span>
              <p><strong>{ar ? notification.titleAr : notification.titleEn}</strong><small>{localDate(notification.at, state.language)}</small></p>
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}

function ApplicationWizard({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const steps = ar
    ? ["بيانات المستفيدة", "فرد الأسرة", "بيانات الدراسة", "الوثائق", "المراجعة والإرسال"]
    : ["Beneficiary", "Family member", "Education", "Documents", "Review & submit"];
  const [errors, setErrors] = useState<string[]>([]);
  const setDraft = (patch: Partial<DemoState["wizardDraft"]>) => {
    setState((previous) => ({
      ...previous,
      wizardDraft: { ...previous.wizardDraft, ...patch },
    }));
    toast(ar ? "تم الحفظ تلقائياً" : "Autosaved");
  };
  const uploadEnrollment = async (file?: File) => {
    if (!file) return;
    try {
      const document = await uploadStoredDocument(file, "education-enrollment");
      setState((previous) => ({ ...previous, storedDocuments: [document, ...previous.storedDocuments], wizardDraft: { ...previous.wizardDraft, uploaded: true } }));
      toast(ar ? "تم رفع التأييد وحفظ الملف" : "Enrollment confirmation uploaded and saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : (ar ? "تعذر رفع الملف" : "Upload failed"));
    }
  };
  const next = () => {
    const currentErrors: string[] = [];
    if (state.wizardStep === 3 && !state.wizardDraft.year) currentErrors.push(ar ? "اختاري السنة الدراسية." : "Select the academic year.");
    if (state.wizardStep === 4 && !state.wizardDraft.uploaded) currentErrors.push(ar ? "أرفقي تأييد الاستمرار بالدراسة قبل المتابعة." : "Attach the enrollment confirmation before continuing.");
    if (state.wizardStep === 5 && !state.wizardDraft.uploaded) currentErrors.push(ar ? "لا يمكن إرسال الطلب قبل اكتمال الوثائق المطلوبة." : "The application cannot be submitted until all required documents are complete.");
    if (state.wizardStep === 5 && !state.wizardDraft.consent) currentErrors.push(ar ? "الموافقة مطلوبة قبل الإرسال." : "Consent is required before submission.");
    if (currentErrors.length) {
      setErrors(currentErrors);
      return;
    }
    setErrors([]);
    if (state.wizardStep < 5) {
      setState((previous) => ({ ...previous, wizardStep: previous.wizardStep + 1 }));
      addAudit("الانتقال إلى خطوة جديدة في المسودة", "Draft advanced to a new step", "citizen");
    } else {
      if (!canTransition(state.case.status, "Submitted") && state.case.status !== "Submitted") {
        toast(ar ? "لا يمكن إرسال الطلب من حالته الحالية." : "The case cannot be submitted from its current state.");
        return;
      }
      setState((previous) => ({
        ...previous,
        case: {
          ...previous.case,
          status: "Submitted",
          priority: "high",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assignedToAr: "أحمد كريم محمود",
          assignedToEn: "Ahmed Kareem Mahmoud",
          documents: [
            ...previous.case.documents.filter((document) => document.type !== "enrollment"),
            {
              id: "doc-enrollment",
              titleAr: "تأييد الاستمرار بالدراسة",
              titleEn: "Enrollment confirmation",
              type: "enrollment",
              status: "verified",
              classification: "تأييد جامعي — ثقة 96%",
              source: "رفع المواطن",
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
        notifications: [
          {
            id: `notification-submit-${Date.now()}`,
            titleAr: "تم تقديم الطلب بنجاح",
            titleEn: "Application submitted",
            bodyAr: "أُنشئ الطلب MF-2026-000184 وأُرسل للمراجعة.",
            bodyEn: "MF-2026-000184 was created and sent for review.",
            at: new Date().toISOString(),
            read: false,
            channel: "in-app",
          },
          ...previous.notifications,
        ],
      }));
      addAudit("تقديم طلب المنحة التعليمية رسمياً", "Education grant application submitted", "citizen");
      toast(ar ? "تم تقديم الطلب MF-2026-000184" : "Application MF-2026-000184 submitted");
      navigate("/citizen/applications/MF-2026-000184");
    }
  };
  return (
    <div className="page wizard-page">
      <button className="back-link" onClick={() => navigate("/services/education-grant")}>
        {ar ? "→ العودة إلى تفاصيل الخدمة" : "← Back to service details"}
      </button>
      <div className="wizard-heading">
        <div>
          <span className="eyebrow">{ar ? "طلب جديد" : "NEW APPLICATION"}</span>
          <h1>{ar ? "منحة تعليمية لأحد أفراد الأسرة" : "Family Education Grant"}</h1>
          <p>{ar ? "مسودة محفوظة تلقائياً · APP-DRAFT-184" : "Autosaved draft · APP-DRAFT-184"}</p>
        </div>
        <MiniBadge tone="neutral">● {ar ? "حفظ تلقائي" : "Autosave on"}</MiniBadge>
      </div>
      <ol className="wizard-stepper">
        {steps.map((label, index) => (
          <li key={label} className={state.wizardStep > index + 1 ? "done" : state.wizardStep === index + 1 ? "active" : ""}>
            <i>{state.wizardStep > index + 1 ? "✓" : index + 1}</i>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <div className="wizard-layout">
        <section className="wizard-card">
          {state.wizardStep === 1 && (
            <>
              <WizardTitle ar={ar} number="١" titleAr="بيانات المستفيدة الموثّقة" titleEn="Verified beneficiary data" descriptionAr="تم جلب هذه البيانات من الملف التجريبي. الحقول الموثّقة للقراءة فقط." descriptionEn="Loaded from the demo profile. Verified fields are read-only." />
              <div className="verified-banner"><span>✓</span><div><strong>{ar ? "تم التحقق من الملف" : "Profile verified"}</strong><small>{ar ? "المصدر: سجل المستفيد التجريبي · ٢٥ تموز ٢٠٢٦" : "Source: demo beneficiary registry · 25 Jul 2026"}</small></div></div>
              <div className="form-grid">
                <Field label={ar ? "الاسم الكامل" : "Full name"} value={ar ? "زينب علي حسن" : "Zainab Ali Hassan"} verified />
                <Field label={ar ? "رقم المستفيد" : "Beneficiary number"} value="BEN-10024" verified ltr />
                <Field label={ar ? "المحافظة" : "Governorate"} value={ar ? "بغداد" : "Baghdad"} verified />
                <Field label={ar ? "نوع الصفة" : "Beneficiary type"} value={ar ? "فرد أسرة مسجل" : "Registered family member"} verified />
              </div>
            </>
          )}
          {state.wizardStep === 2 && (
            <>
              <WizardTitle ar={ar} number="٢" titleAr="اختيار فرد الأسرة" titleEn="Choose a family member" descriptionAr="يظهر فقط أفراد الأسرة المرتبطون بملفك الموحّد." descriptionEn="Only members connected to your unified family profile are shown." />
              <div className="family-select">
                {[
                  ["maryam", "مريم حيدر علي", "Maryam Haider Ali", "ابنة", "Daughter", "طالبة جامعية", "University student"],
                  ["ali", "علي حيدر علي", "Ali Haider Ali", "ابن", "Son", "طالب ثانوي", "Secondary student"],
                ].map(([id, nameAr, nameEn, relationAr, relationEn, detailAr, detailEn]) => (
                  <button key={id} className={state.wizardDraft.member === id ? "selected" : ""} onClick={() => setDraft({ member: id })}>
                    <span className="avatar">{id === "maryam" ? "مح" : "عح"}</span>
                    <span><strong>{ar ? nameAr : nameEn}</strong><small>{ar ? `${relationAr} · ${detailAr}` : `${relationEn} · ${detailEn}`}</small></span>
                    <i>{state.wizardDraft.member === id ? "●" : "○"}</i>
                  </button>
                ))}
              </div>
              <div className="family-context"><span>♧</span><p><strong>{ar ? "أسرة رقم FAM-4502" : "Family FAM-4502"}</strong><small>{ar ? "٤ أفراد · العلاقات موثّقة في عرض الأسرة 360" : "4 members · relationships verified in Family 360"}</small></p><button className="text-button" onClick={() => navigate("/citizen/family")}>{ar ? "عرض الأسرة" : "View family"} ←</button></div>
            </>
          )}
          {state.wizardStep === 3 && (
            <>
              <WizardTitle ar={ar} number="٣" titleAr="بيانات الدراسة" titleEn="Education details" descriptionAr="أدخلي بيانات الدراسة الحالية للطالبة مريم." descriptionEn="Enter Maryam’s current education details." />
              <div className="form-grid">
                <label className="input-field"><span>{ar ? "المؤسسة التعليمية" : "Education institution"} *</span><input value={state.wizardDraft.university} onChange={(event) => setDraft({ university: event.target.value })} /><small>{ar ? "سيُقارن الاسم مع التأييد المرفوع" : "Will be compared with the uploaded confirmation"}</small></label>
                <label className="input-field"><span>{ar ? "السنة الدراسية" : "Academic year"} *</span><select value={state.wizardDraft.year} onChange={(event) => setDraft({ year: event.target.value })}><option value="">{ar ? "اختاري…" : "Select…"}</option><option value="2025-2026">2025–2026</option><option value="2026-2027">2026–2027</option></select></label>
                <Field label={ar ? "الكلية / القسم" : "College / department"} value={ar ? "كلية العلوم — علوم الحياة" : "College of Science — Biology"} />
                <Field label={ar ? "المرحلة" : "Study stage"} value={ar ? "المرحلة الثانية" : "Second year"} />
              </div>
              <div className="conditional-note"><span>✦</span><div><strong>{ar ? "حقل شرطي ظاهر" : "Conditional field shown"}</strong><p>{ar ? "ظهر حقل الجامعة لأن نوع الدراسة «جامعية»." : "The institution field is shown because study type is “University”."}</p></div></div>
            </>
          )}
          {state.wizardStep === 4 && (
            <>
              <WizardTitle ar={ar} number="٤" titleAr="الوثائق المطلوبة" titleEn="Required documents" descriptionAr="يمكن إعادة استخدام الوثائق الموثّقة أو رفع ملفات محلية للمحاكاة." descriptionEn="Reuse verified wallet documents or select local files for this simulation." />
              <div className="document-list">
                {state.case.documents.map((document) => (
                  <div key={document.id} className="document-row">
                    <span className="file-icon">PDF</span>
                    <p><strong>{ar ? document.titleAr : document.titleEn}</strong><small>{document.classification}</small></p>
                    <MiniBadge tone={document.status === "verified" ? "success" : "warning"}>{document.status === "verified" ? (ar ? "موثّقة" : "Verified") : (ar ? "للمراجعة" : "Review")}</MiniBadge>
                    <button aria-label={ar ? "معاينة" : "Preview"} onClick={() => navigate("/citizen/documents")}>⌕</button>
                  </div>
                ))}
              </div>
              <label className={`drop-zone ${state.wizardDraft.uploaded ? "uploaded" : ""}`}>
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { void uploadEnrollment(event.target.files?.[0]); event.target.value = ""; }} />
                <span>{state.wizardDraft.uploaded ? "✓" : "↑"}</span>
                <strong>{state.wizardDraft.uploaded ? (ar ? "تمت إضافة تأييد الاستمرار بالدراسة" : "Enrollment confirmation added") : (ar ? "أرفقي تأييد الاستمرار بالدراسة" : "Attach the enrollment confirmation")}</strong>
                <small>{ar ? "PDF أو JPG أو PNG · حتى 1 MB في نسخة الـPOC · يُحفظ في مخزن المشروع" : "PDF, JPG or PNG · up to 1 MB in the POC · saved in project storage"}</small>
              </label>
              <div className="ai-document-card">
                <header><span>✦ {ar ? "ذكاء اصطناعي محاكى" : "SIMULATED AI"}</span><MiniBadge tone={state.wizardDraft.uploaded ? "success" : "warning"}>{state.wizardDraft.uploaded ? (ar ? "المتطلبات مكتملة" : "Requirements complete") : (ar ? "تحتاج استكمالاً" : "Missing item")}</MiniBadge></header>
                <strong>{state.wizardDraft.uploaded ? (ar ? "اكتملت الوثائق المطلوبة ويمكن متابعة الإرسال." : "Required evidence is complete and submission can continue.") : (ar ? "تم تصنيف ٣ وثائق. ينقص تأييد الاستمرار بالدراسة." : "Three documents classified. Enrollment confirmation is missing.")}</strong>
                <p>{ar ? "المصدر: متطلبات الخدمة EDU-DOC-2.3 · الثقة ٩٦٪ · القرار للموظف المختص." : "Source: EDU-DOC-2.3 · 96% confidence · official review remains human."}</p>
              </div>
            </>
          )}
          {state.wizardStep === 5 && (
            <>
              <WizardTitle ar={ar} number="٥" titleAr="راجعي طلبك قبل الإرسال" titleEn="Review before submission" descriptionAr="لن يصل الطلب إلى أي موظف قبل اكتمال البيانات والوثائق المطلوبة." descriptionEn="The application will not reach staff until all required data and documents are complete." />
              <div className="review-summary">
                {[
                  [ar ? "المستفيدة" : "Beneficiary", ar ? "زينب علي حسن" : "Zainab Ali Hassan"],
                  [ar ? "فرد الأسرة" : "Family member", ar ? "مريم حيدر علي" : "Maryam Haider Ali"],
                  [ar ? "المؤسسة التعليمية" : "Institution", state.wizardDraft.university],
                  [ar ? "السنة الدراسية" : "Academic year", state.wizardDraft.year || "—"],
                ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><button onClick={() => setState((previous) => ({ ...previous, wizardStep: label === (ar ? "المستفيدة" : "Beneficiary") ? 1 : 3 }))}>{ar ? "تعديل" : "Edit"}</button></div>)}
              </div>
              <div className={state.wizardDraft.uploaded ? "verified-banner" : "review-warning"}><span>{state.wizardDraft.uploaded ? "✓" : "!"}</span><div><strong>{state.wizardDraft.uploaded ? (ar ? "الطلب مكتمل وجاهز للإرسال" : "Application complete and ready") : (ar ? "الطلب غير مكتمل" : "Application incomplete")}</strong><p>{state.wizardDraft.uploaded ? (ar ? "تم إرفاق كل المتطلبات. عند الإرسال فقط ينتقل الطلب إلى صندوق الموظف." : "All requirements are attached. Only submission moves the application into the staff inbox.") : (ar ? "ارجعي إلى خطوة الوثائق وأرفقي تأييد الاستمرار بالدراسة؛ لن يظهر الطلب لأي موظف قبل ذلك." : "Return to Documents and attach the enrollment confirmation; staff cannot see the application before then.")}</p></div></div>
              <label className="consent-check"><input type="checkbox" checked={state.wizardDraft.consent} onChange={(event) => setDraft({ consent: event.target.checked })} /><span><strong>{ar ? "أوافق على استخدام البيانات لهذا الطلب" : "I consent to using this data for this application"}</strong><small>{ar ? "أقر بأن المعلومات اصطناعية ضمن عرض إثبات المفهوم، وأن الإرسال لا ينشئ استحقاقاً حقيقياً." : "I acknowledge this is synthetic POC data and submission creates no real entitlement."}</small></span></label>
            </>
          )}
          {errors.length > 0 && <div className="form-errors" role="alert">{errors.map((error) => <p key={error}>! {error}</p>)}</div>}
          <footer className="wizard-actions">
            <button className="button button-secondary" disabled={state.wizardStep === 1} onClick={() => setState((previous) => ({ ...previous, wizardStep: Math.max(1, previous.wizardStep - 1) }))}>{ar ? "السابق" : "Back"}</button>
            <span>{ar ? `الخطوة ${state.wizardStep} من ٥` : `Step ${state.wizardStep} of 5`}</span>
            <button className="button button-primary" onClick={next}>{state.wizardStep === 5 ? (ar ? "إرسال الطلب" : "Submit application") : (ar ? "حفظ ومتابعة" : "Save and continue")} ←</button>
          </footer>
        </section>
        <aside className="wizard-help">
          <span>?</span>
          <h3>{ar ? "مساعدة هذه الخطوة" : "Step guidance"}</h3>
          <p>{ar ? "تُحفظ التغييرات في قاعدة المشروع وتبقى نسخة محلية احتياطية؛ الملفات في مخزن المشروع." : "Changes are saved to the project database with a local backup; files use project storage."}</p>
          <hr />
          <b>✦ {ar ? "مساعد المتطلبات" : "Requirements assistant"}</b>
          <p>{ar ? "يبقى الطلب لدى المواطن فقط حتى تكتمل كل البيانات والوثائق، ثم ينتقل للموظف بعد الإرسال." : "The application remains citizen-only until all data and documents are complete, then moves to staff after submission."}</p>
        </aside>
      </div>
    </div>
  );
}

function serviceEligibilityRequirements(service: ServiceDefinition, ar: boolean): string[] {
  const common = ar
    ? [
        "أن تكون صفة المستفيد موثّقة في ملف المؤسسة.",
        "أن تكتمل جميع البيانات والوثائق قبل الإرسال.",
        "تخضع النتيجة للمراجعة البشرية المختصة.",
      ]
    : [
        "Beneficiary status is verified in the Foundation profile.",
        "All data and documents are complete before submission.",
        "The outcome remains subject to specialized human review.",
      ];
  const categoryRequirement: Record<string, [string, string]> = {
    education: ["أن تكون بيانات الدراسة أو الطالب محدثة.", "Education or student data is current."],
    health: ["أن تكون التقارير الطبية حديثة ومرتبطة بالحالة.", "Medical reports are current and relevant to the condition."],
    housing: ["أن تكون بيانات السكن والأسرة محدثة.", "Housing and family information is current."],
    employment: ["أن تكون بيانات المؤهل والخبرة محدثة.", "Qualification and experience data is current."],
    legal: ["أن يُحدد القرار أو الموضوع القانوني بوضوح.", "The relevant decision or legal matter is clearly identified."],
    certificates: ["أن تكون بيانات السجل المطلوب إصدار الشهادة عنه موثقة.", "The record used for the certificate is verified."],
    social: ["أن تكون بيانات الأسرة والحالة الاجتماعية محدثة.", "Family and social-status information is current."],
    benefits: ["أن يُذكر التغيير المؤثر على الاستحقاق بوضوح.", "The change affecting entitlement is clearly stated."],
    other: ["أن يكون موضوع الطلب محدداً وقابلاً للمراجعة.", "The request subject is specific and reviewable."],
  };
  const category = categoryRequirement[service.category] ?? categoryRequirement.other;
  return [...common.slice(0, 2), ar ? category[0] : category[1], common[2]];
}

const serviceDocumentTemplates: Record<string, Array<[string, string]>> = {
  education: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["بطاقة الأسرة", "Family card"],
    ["تأييد الدراسة", "Enrollment confirmation"],
    ["كشف الدرجات", "Academic transcript"],
  ],
  health: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["تقرير طبي حديث", "Recent medical report"],
    ["وصفة العلاج", "Treatment prescription"],
    ["عرض كلفة", "Cost estimate"],
    ["إحالة الطبيب المختص", "Specialist referral"],
  ],
  housing: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["بطاقة السكن", "Residence card"],
    ["بيان الأسرة", "Family statement"],
    ["تعهد عدم الاستفادة", "Non-benefit declaration"],
    ["تأييد الدخل", "Income confirmation"],
    ["استمارة الأولوية", "Priority form"],
  ],
  employment: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["السيرة الذاتية", "Curriculum vitae"],
    ["المؤهل الدراسي", "Education qualification"],
  ],
  legal: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["القرار أو المعاملة محل الطلب", "Relevant decision or transaction"],
    ["المستندات المؤيدة", "Supporting evidence"],
    ["مذكرة الوقائع", "Statement of facts"],
  ],
  certificates: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["طلب إصدار الشهادة", "Certificate request"],
  ],
  social: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["بطاقة الأسرة", "Family card"],
    ["تقرير الحالة الاجتماعية", "Social status report"],
    ["المستندات المؤيدة", "Supporting evidence"],
  ],
  benefits: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["بطاقة الأسرة", "Family card"],
    ["بيان التغيير", "Change statement"],
    ["المستندات المؤيدة", "Supporting evidence"],
    ["إقرار صحة المعلومات", "Information declaration"],
  ],
  other: [
    ["هوية المستفيد", "Beneficiary ID"],
    ["تفاصيل الطلب", "Request details"],
    ["المستند المؤيد", "Supporting document"],
  ],
};

function serviceDocuments(service: ServiceDefinition): Array<[string, string]> {
  const source = serviceDocumentTemplates[service.category] ?? serviceDocumentTemplates.other;
  return Array.from({ length: service.documents }, (_, index) =>
    source[index] ?? [
      `مستند مؤيد ${index + 1}`,
      `Supporting document ${index + 1}`,
    ],
  );
}

function GenericServiceWizard({
  state,
  setState,
  serviceId,
  navigate,
  toast,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  serviceId: string;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === serviceId) ?? services[1];
  const documents = serviceDocuments(service);
  const requiredUploads = requiredCitizenUploads(service.documents);
  const draft = state.serviceDrafts[service.id] ?? { step: 1, detail: "", uploaded: [], consent: false };
  const { step, detail, uploaded, consent } = draft;
  const updateDraft = (patch: Partial<typeof draft>) => setState((previous) => ({ ...previous, serviceDrafts: { ...previous.serviceDrafts, [service.id]: { ...(previous.serviceDrafts[service.id] ?? draft), ...patch } } }));
  const setStep = (value: number | ((current: number) => number)) => updateDraft({ step: typeof value === "function" ? value(step) : value });
  const setDetail = (value: string) => updateDraft({ detail: value });
  const setConsent = (value: boolean) => updateDraft({ consent: value });
  const [error, setError] = useState("");
  const uploadServiceDocument = async (index: number, file?: File) => {
    if (!file) return;
    try {
      const document = await uploadStoredDocument(file, `${service.id}-${index}`);
      setState((previous) => ({
        ...previous,
        storedDocuments: [document, ...previous.storedDocuments],
        serviceDrafts: {
          ...previous.serviceDrafts,
          [service.id]: {
            ...(previous.serviceDrafts[service.id] ?? draft),
            uploaded: previous.serviceDrafts[service.id]?.uploaded.includes(index)
              ? previous.serviceDrafts[service.id].uploaded
              : [...(previous.serviceDrafts[service.id]?.uploaded ?? uploaded), index],
          },
        },
      }));
      toast(ar ? "تم رفع المستند وحفظه" : "Document uploaded and saved");
    } catch (uploadError) {
      toast(uploadError instanceof Error ? uploadError.message : (ar ? "تعذر رفع الملف" : "Upload failed"));
    }
  };

  const next = () => {
    if (step === 1 && !detail.trim()) {
      setError(ar ? "أدخل تفاصيل الطلب قبل المتابعة." : "Enter the request details before continuing.");
      return;
    }
    if (step === 2 && uploaded.length < requiredUploads) {
      setError(ar ? "أرفق جميع المستندات المطلوبة قبل المتابعة." : "Attach every required document before continuing.");
      return;
    }
    setError("");
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    if (!canSubmitGenericService({
      detail,
      documentCount: service.documents,
      uploadedCount: uploaded.length,
      consent,
    })) {
      setError(ar ? "راجع اكتمال الطلب ووافق على الإقرار قبل الإرسال." : "Confirm completeness and consent before submission.");
      return;
    }
    const now = new Date().toISOString();
    const id = `MF-2026-${String(185 + state.additionalApplications.length).padStart(6, "0")}`;
    const application: ServiceApplication = {
      id,
      serviceId: service.id,
      status: "Submitted",
      detail: detail.trim(),
      documentCount: service.documents,
      submittedAt: now,
      updatedAt: now,
      slaHoursRemaining: service.days * 8,
    };
    setState((previous) => ({
      ...previous,
      additionalApplications: [application, ...previous.additionalApplications],
      serviceDrafts: { ...previous.serviceDrafts, [service.id]: { step: 1, detail: "", uploaded: [], consent: false } },
      notifications: [
        {
          id: `notification-service-${Date.now()}`,
          titleAr: `تم تقديم ${service.titleAr}`,
          titleEn: `${service.titleEn} submitted`,
          bodyAr: `أُنشئ الطلب ${id} بعد اكتمال البيانات والوثائق وأُرسل للمراجعة.`,
          bodyEn: `${id} was created after all data and documents were complete and sent for review.`,
          at: now,
          read: false,
          channel: "in-app",
        },
        ...previous.notifications,
      ],
    }));
    toast(ar ? `تم تقديم الطلب ${id}` : `Application ${id} submitted`);
    navigate(`/citizen/applications/${id}`);
  };

  return (
    <div className="page wizard-page">
      <button className="back-link" onClick={() => navigate(`/services/${service.id}`)}>
        {ar ? "→ العودة إلى تفاصيل الخدمة" : "← Back to service details"}
      </button>
      <div className="wizard-heading">
        <div>
          <span className="eyebrow">{ar ? "طلب رقمي جديد" : "NEW DIGITAL APPLICATION"}</span>
          <h1>{ar ? service.titleAr : service.titleEn}</h1>
          <p>{ar ? "يبقى الطلب لديك حتى يكتمل ثم يصل للموظف بعد الإرسال." : "The application remains yours until complete and reaches staff only after submission."}</p>
        </div>
        <MiniBadge tone="success">{ar ? "خدمة مفعلة" : "Enabled service"}</MiniBadge>
      </div>
      <ol className="wizard-stepper">
        {(ar ? ["تفاصيل الطلب", "الوثائق", "المراجعة والإرسال"] : ["Request details", "Documents", "Review & submit"]).map((label, index) => (
          <li key={label} className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""}>
            <i>{step > index + 1 ? "✓" : index + 1}</i>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <div className="wizard-layout">
        <section className="wizard-card">
          {step === 1 && (
            <>
              <WizardTitle ar={ar} number="١" titleAr="تفاصيل الطلب" titleEn="Request details" descriptionAr="بيانات المستفيد موثقة؛ أضف وصفاً واضحاً للاحتياج." descriptionEn="Beneficiary data is verified; add a clear description of the need." />
              <div className="verified-banner"><span>✓</span><div><strong>{ar ? "زينب علي حسن · ملف موثّق" : "Zainab Ali Hassan · Verified profile"}</strong><small>BEN-10024 · {ar ? "بغداد" : "Baghdad"}</small></div></div>
              <div className="form-grid">
                <Field label={ar ? "الخدمة" : "Service"} value={ar ? service.titleAr : service.titleEn} verified />
                <Field label={ar ? "المحافظة" : "Governorate"} value={ar ? "بغداد" : "Baghdad"} verified />
              </div>
              <label className="input-field">
                <span>{ar ? "وصف الطلب والحاجة *" : "Request description *"}</span>
                <textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={ar ? "اكتب التفاصيل التي يحتاجها الموظف لفهم الطلب…" : "Add the details staff need to understand the request…"} />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <WizardTitle ar={ar} number="٢" titleAr="الوثائق المطلوبة" titleEn="Required documents" descriptionAr="أول وثيقة معاد استخدامها من المحفظة؛ أرفق البقية قبل المتابعة." descriptionEn="The first document is reused from the wallet; attach the rest before continuing." />
              <div className="document-list">
                {documents.map(([titleAr, titleEn], index) => {
                  const ready = index === 0 || uploaded.includes(index);
                  return (
                    <div key={`${titleEn}-${index}`} className="document-row">
                      <span className="file-icon">PDF</span>
                      <p><strong>{ar ? titleAr : titleEn}</strong><small>{index === 0 ? (ar ? "محفظة الوثائق" : "Document wallet") : (ar ? "رفع المواطن" : "Citizen upload")}</small></p>
                      <MiniBadge tone={ready ? "success" : "warning"}>{ready ? (ar ? "جاهزة" : "Ready") : (ar ? "مطلوبة" : "Required")}</MiniBadge>
                      {index > 0 && (
                        <label className="icon-button" aria-label={ar ? `رفع ${titleAr}` : `Upload ${titleEn}`}>
                          <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { void uploadServiceDocument(index, event.target.files?.[0]); event.target.value = ""; }} />
                          {ready ? "✓" : "↑"}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={uploaded.length >= requiredUploads ? "verified-banner" : "review-warning"}>
                <span>{uploaded.length >= requiredUploads ? "✓" : "!"}</span>
                <div>
                  <strong>{uploaded.length >= requiredUploads ? (ar ? "اكتملت الوثائق" : "Documents complete") : (ar ? "الطلب ما زال عند المواطن" : "Application remains citizen-only")}</strong>
                  <p>{ar ? `${uploaded.length + 1} من ${service.documents} وثائق جاهزة.` : `${uploaded.length + 1} of ${service.documents} documents ready.`}</p>
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <WizardTitle ar={ar} number="٣" titleAr="المراجعة والإرسال" titleEn="Review and submit" descriptionAr="بعد الإرسال فقط يظهر الطلب في مركز عمل الموظف." descriptionEn="Only submission makes the application visible in the staff workspace." />
              <div className="review-summary">
                <div><span>{ar ? "الخدمة" : "Service"}</span><strong>{ar ? service.titleAr : service.titleEn}</strong><button onClick={() => setStep(1)}>{ar ? "تعديل" : "Edit"}</button></div>
                <div><span>{ar ? "تفاصيل الطلب" : "Request details"}</span><strong>{detail}</strong><button onClick={() => setStep(1)}>{ar ? "تعديل" : "Edit"}</button></div>
                <div><span>{ar ? "الوثائق" : "Documents"}</span><strong>{service.documents}/{service.documents}</strong><button onClick={() => setStep(2)}>{ar ? "مراجعة" : "Review"}</button></div>
                <div><span>{ar ? "مدة الخدمة" : "Service time"}</span><strong>{num(service.days, state.language)} {ar ? "يوم عمل" : "business days"}</strong><span /></div>
              </div>
              <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><strong>{ar ? "أقر بصحة بيانات الطلب التجريبي" : "I confirm the demo application data"}</strong><small>{ar ? "لن يصل الطلب إلى الموظف قبل اكتماله والإرسال." : "The application does not reach staff before completion and submission."}</small></span></label>
            </>
          )}
          {error && <div className="form-errors" role="alert"><p>! {error}</p></div>}
          <footer className="wizard-actions">
            <button className="button button-secondary" disabled={step === 1} onClick={() => { setError(""); setStep((current) => Math.max(1, current - 1)); }}>{ar ? "السابق" : "Back"}</button>
            <span>{ar ? `الخطوة ${step} من ٣` : `Step ${step} of 3`}</span>
            <button className="button button-primary" onClick={next}>{step === 3 ? (ar ? "إرسال الطلب" : "Submit application") : (ar ? "حفظ ومتابعة" : "Save and continue")} ←</button>
          </footer>
        </section>
        <aside className="wizard-help">
          <span>✦</span>
          <h3>{ar ? "خدمة مفعلة بالكامل" : "Fully enabled service"}</h3>
          <p>{ar ? "التفاصيل والوثائق والتحقق من الاكتمال والإرسال والتتبع كلها تعمل ببيانات تجريبية." : "Details, documents, completeness validation, submission, and tracking all work with demo data."}</p>
        </aside>
      </div>
    </div>
  );
}

function WizardTitle({
  ar,
  number,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
}: {
  ar: boolean;
  number: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}) {
  return (
    <header className="wizard-title">
      <span>{ar ? number : Number(number.replace("١", "1").replace("٢", "2").replace("٣", "3").replace("٤", "4").replace("٥", "5"))}</span>
      <div><h2>{ar ? titleAr : titleEn}</h2><p>{ar ? descriptionAr : descriptionEn}</p></div>
    </header>
  );
}

function Field({
  label,
  value,
  verified = false,
  ltr = false,
}: {
  label: string;
  value: string;
  verified?: boolean;
  ltr?: boolean;
}) {
  return (
    <label className="input-field">
      <span>{label} {verified && <b>✓ موثّق</b>}</span>
      <input value={value} readOnly={verified} dir={ltr ? "ltr" : undefined} onChange={() => undefined} />
    </label>
  );
}

function CitizenApplications({
  state,
  navigate,
}: {
  state: DemoState;
  navigate: (path: string) => void;
}) {
  const ar = state.language === "ar";
  const [tab, setTab] = useState<"active" | "draft" | "previous">("active");
  const isPrevious = (status: ApplicationStatus) => ["Approved", "Rejected", "Completed", "Cancelled", "Closed"].includes(status);
  const matchesTab = (status: ApplicationStatus) => tab === "draft" ? status === "Draft" : tab === "previous" ? isPrevious(status) : status !== "Draft" && !isPrevious(status);
  const activeCount = [state.case, ...state.additionalApplications].filter((item) => item.status !== "Draft" && !isPrevious(item.status)).length;
  const draftCount = [state.case, ...state.additionalApplications].filter((item) => item.status === "Draft").length;
  const previousCount = [state.case, ...state.additionalApplications].filter((item) => isPrevious(item.status)).length;
  return (
    <div className="page">
      <SectionHeader
        eyebrow={ar ? "طلباتي" : "MY APPLICATIONS"}
        title={ar ? "متابعة واضحة لكل طلب" : "Every application, clearly tracked"}
        description={ar ? "المسودات والطلبات النشطة والسابقة في مكان واحد." : "Drafts, active and previous applications in one place."}
        action={<button className="button button-primary" onClick={() => navigate("/citizen/services")}>{ar ? "خدمة جديدة" : "New service"} +</button>}
      />
      <div className="application-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>{ar ? "النشطة" : "Active"} <b>{activeCount}</b></button><button className={tab === "draft" ? "active" : ""} onClick={() => setTab("draft")}>{ar ? "المسودات" : "Drafts"} <b>{draftCount}</b></button><button className={tab === "previous" ? "active" : ""} onClick={() => setTab("previous")}>{ar ? "السابقة" : "Previous"} <b>{previousCount}</b></button></div>
      {matchesTab(state.case.status) && <article className="application-list-card" onClick={() => navigate("/citizen/applications/MF-2026-000184")}>
        <span className="service-icon service-icon-1">◇</span>
        <div><small>MF-2026-000184</small><h3>{ar ? "منحة تعليمية لأحد أفراد الأسرة" : "Family Education Grant"}</h3><p>{ar ? "للطالبة مريم حيدر علي · جامعة بغداد" : "For Maryam Haider Ali · University of Baghdad"}</p></div>
        <StatusBadge status={state.case.status} language={state.language} />
        <div className="sla-mini"><span>{ar ? "المهلة" : "SLA"}</span><strong>{num(state.case.slaHoursRemaining, state.language)} {ar ? "ساعة" : "hours"}</strong></div>
        <button aria-label={ar ? "فتح الطلب" : "Open application"} onClick={(event) => { event.stopPropagation(); navigate("/citizen/applications/MF-2026-000184"); }}>←</button>
      </article>}
      {state.additionalApplications.filter((application) => matchesTab(application.status)).map((application, index) => {
        const service = services.find((item) => item.id === application.serviceId) ?? services[0];
        return (
          <article className="application-list-card" key={application.id} onClick={() => navigate(`/citizen/applications/${application.id}`)}>
            <span className={`service-icon service-icon-${(index % 4) + 1}`}>{["✦", "▦", "◉", "◇"][index % 4]}</span>
            <div><small>{application.id}</small><h3>{ar ? service.titleAr : service.titleEn}</h3><p>{application.detail}</p></div>
            <StatusBadge status={application.status} language={state.language} />
            <div className="sla-mini"><span>{ar ? "المدة" : "Time"}</span><strong>{num(service.days, state.language)} {ar ? "يوم" : "days"}</strong></div>
            <button aria-label={ar ? "فتح الطلب" : "Open application"} onClick={(event) => { event.stopPropagation(); navigate(`/citizen/applications/${application.id}`); }}>←</button>
          </article>
        );
      })}
      {![state.case, ...state.additionalApplications].some((application) => matchesTab(application.status)) && <div className="empty-state compact"><span>✓</span><h3>{ar ? "لا توجد طلبات في هذا التبويب" : "No applications in this tab"}</h3></div>}
    </div>
  );
}

function CitizenCase({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const needsCompletion = state.case.status === "Awaiting Citizen Completion";
  const approved = state.case.status === "Approved";
  const uploadCompletion = async (file?: File) => {
    if (!file) return;
    if (!canTransition(state.case.status, "Under Review")) {
      toast(ar ? "لا يوجد طلب استكمال نشط." : "No active completion request.");
      return;
    }
    let stored: StoredDocument;
    try {
      stored = await uploadStoredDocument(file, "citizen-completion");
    } catch (error) {
      toast(error instanceof Error ? error.message : (ar ? "تعذر رفع الملف" : "Upload failed"));
      return;
    }
    setState((previous) => ({
      ...previous,
      storedDocuments: [stored, ...previous.storedDocuments],
      case: {
        ...previous.case,
        status: "Under Review",
        updatedAt: new Date().toISOString(),
        documents: [
          ...previous.case.documents.filter((document) => document.type !== "enrollment"),
          {
            id: "doc-enrollment",
            titleAr: "تأييد الاستمرار بالدراسة",
            titleEn: "Enrollment confirmation",
            type: "enrollment",
            status: "verified",
            classification: "تأييد جامعي — ثقة 98%",
            source: "رفع المواطن",
            uploadedAt: new Date().toISOString(),
            storageId: stored.id,
          },
        ],
      },
      notifications: [
        {
          id: `notification-completed-${Date.now()}`,
          titleAr: "تم استلام وثيقة الاستكمال",
          titleEn: "Completion document received",
          bodyAr: "عاد الطلب إلى الموظف للمراجعة.",
          bodyEn: "The application returned to the reviewer.",
          at: new Date().toISOString(),
          read: false,
          channel: "in-app",
        },
        ...previous.notifications,
      ],
    }));
    addAudit("رفع وثيقة الاستكمال وإعادة الطلب للمراجعة", "Completion evidence uploaded; case returned to review", "citizen");
    toast(ar ? "تمت إضافة الوثيقة وإعادة الطلب للمراجعة" : "Document added and case returned for review");
  };
  return (
    <div className="page case-tracking-page">
      <button className="back-link" onClick={() => navigate("/citizen/applications")}>{ar ? "→ العودة إلى طلباتي" : "← Back to applications"}</button>
      <section className={`case-tracking-header ${approved ? "approved-header" : ""}`}>
        <div><span className="eyebrow">{ar ? "طلب منحة تعليمية" : "EDUCATION GRANT APPLICATION"}</span><h1>{ar ? "طلب مريم حيدر علي" : "Maryam Haider Ali’s application"}</h1><p dir="ltr">MF-2026-000184</p></div>
        <div><StatusBadge status={state.case.status} language={state.language} /><button className="button button-secondary" onClick={() => window.print()}>{ar ? "طباعة" : "Print"} ⎙</button></div>
      </section>
      {needsCompletion && (
        <section className="completion-hero">
          <div className="completion-icon">!</div>
          <div><span className="eyebrow">{ar ? "ملاحظة بشرية — إجراء مطلوب منك" : "HUMAN FEEDBACK — ACTION REQUIRED"}</span><h2>{ar ? "عدّل المطلوب ثم أعد تسليم المعاملة" : "Update the request and resubmit"}</h2><p>{state.case.completionMessage || (ar ? "أرفق تأييداً حديثاً من جامعة بغداد لإكمال التحقق من التسجيل." : "Attach a recent University of Baghdad confirmation to complete enrollment checks.")}</p><div className="request-meta"><span>{ar ? "من: أحمد كريم محمود" : "From: Ahmed Kareem Mahmoud"}</span><span>{localDate(state.case.updatedAt, state.language)}</span></div></div>
          <label className="button button-primary upload-button"><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { void uploadCompletion(event.target.files?.[0]); event.target.value = ""; }} />{ar ? "رفع المطلوب وإعادة التسليم" : "Upload and resubmit"} ↑</label>
        </section>
      )}
      {approved && (
        <section className="decision-hero">
          <span className="decision-seal">✓</span>
          <div><span className="eyebrow">{ar ? "صدر القرار النهائي" : "FINAL DECISION ISSUED"}</span><h2>{ar ? "تمت الموافقة على الطلب" : "Application approved"}</h2><p>{ar ? "اعتمدت لجنة دعم التعليم القرار في المحاكاة، وأصبحت الوثيقة متاحة للتحقق." : "The simulated Education Support Committee approved the case. The decision is available for verification."}</p></div>
          <button className="button button-gold" onClick={() => navigate("/verify/DOC-EDU-184")}>{ar ? "عرض القرار والتحقق" : "View and verify"} ◫</button>
        </section>
      )}
      <section className="tracking-layout">
        <article className="content-card timeline-card">
          <header><div><span className="eyebrow">{ar ? "مسار الطلب" : "APPLICATION JOURNEY"}</span><h2>{ar ? "ما الذي حدث؟" : "What happened?"}</h2></div><div className="sla-box"><span>{ar ? "ضمن المهلة" : "Within SLA"}</span><strong>{num(state.case.slaHoursRemaining, state.language)} {ar ? "ساعة متبقية" : "hours left"}</strong></div></header>
          <div className="timeline">
            {buildTimeline(state.case.status, ar).map((event, index) => (
              <div key={event.title} className={event.done ? "done" : event.current ? "current" : ""}>
                <i>{event.done ? "✓" : index + 1}</i>
                <span><strong>{event.title}</strong><p>{event.description}</p>{event.date && <small>{event.date}</small>}</span>
              </div>
            ))}
          </div>
        </article>
        <aside>
          <article className="content-card owner-card"><span className="avatar">أم</span><div><small>{ar ? "الموظف المسؤول" : "CASE OWNER"}</small><strong>{ar ? state.case.assignedToAr : state.case.assignedToEn}</strong><p>{ar ? "مديرية بغداد · فريق دعم التعليم" : "Baghdad Directorate · Education Support Team"}</p></div><button onClick={() => toast(ar ? "تم فتح رسالة داخلية تجريبية" : "Demo secure message opened")}>✉</button></article>
          <article className="content-card document-summary"><header><h3>{ar ? "الوثائق" : "Documents"}</h3><span>{state.case.documents.length}/4</span></header>{state.case.documents.map((document) => <div key={document.id}><span className="file-icon">PDF</span><p><strong>{ar ? document.titleAr : document.titleEn}</strong><small>{document.classification}</small></p><i>{document.status === "verified" ? "✓" : "!"}</i></div>)}</article>
          <article className="content-card audit-safe"><span>⌁</span><h3>{ar ? "سجل طلب قابل للتدقيق" : "Auditable request history"}</h3><p>{ar ? "كل إجراء مهم مرتبط بممثل ووقت ومعرّف ارتباط." : "Every important action has an actor, time and correlation ID."}</p><small dir="ltr">{state.case.audit.at(-1)?.correlationId}</small></article>
        </aside>
      </section>
    </div>
  );
}

function AdditionalApplicationCase({
  state,
  setState,
  application,
  navigate,
  toast,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  application: ServiceApplication;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === application.serviceId) ?? services[0];
  const timeline = buildTimeline(application.status, ar);
  const resubmit = () => {
    setState((previous) => ({
      ...previous,
      additionalApplications: previous.additionalApplications.map((item) => item.id === application.id
        ? { ...item, status: "Under Review", completionMessage: undefined, updatedAt: new Date().toISOString() }
        : item),
    }));
    toast(ar ? "أُعيد إرسال الطلب إلى الموظف بعد الاستكمال" : "The completed application was resubmitted to staff");
  };
  return (
    <div className="page citizen-page">
      <button className="back-link" onClick={() => navigate("/citizen/applications")}>{ar ? "→ العودة إلى طلباتي" : "← Back to applications"}</button>
      <section className={`case-tracking-header ${application.status === "Completed" ? "approved-header" : ""}`}>
        <div><span className="eyebrow">{ar ? service.categoryAr : service.category}</span><h1>{ar ? service.titleAr : service.titleEn}</h1><p dir="ltr">{application.id}</p></div>
        <div><StatusBadge status={application.status} language={state.language} /><button className="button button-secondary" onClick={() => window.print()}>{ar ? "طباعة" : "Print"} ⎙</button></div>
      </section>
      <section className="tracking-layout">
        <main className="content-card tracking-main">
          <header><div><span className="eyebrow">{ar ? "مسار المعاملة" : "APPLICATION JOURNEY"}</span><h2>{ar ? "متابعة الطلب خطوة بخطوة" : "Track the application step by step"}</h2></div><div className="sla-box"><span>{ar ? "المدة المتوقعة" : "Expected time"}</span><strong>{num(service.days, state.language)} {ar ? "يوم عمل" : "business days"}</strong></div></header>
          {application.status === "Awaiting Citizen Completion" && <div className="completion-alert"><span>!</span><div><strong>{ar ? "ملاحظة الموظف" : "Staff feedback"}</strong><p>{application.completionMessage}</p></div><button className="button button-primary" onClick={resubmit}>{ar ? "تم الاستكمال — إعادة الإرسال" : "Completed — resubmit"} ←</button></div>}
          <div className="timeline">
            {timeline.map((item, index) => (
              <div key={item.title} className={item.done ? "done" : item.current ? "current" : ""}>
                <i>{item.done ? "✓" : index + 1}</i>
                <div><strong>{item.title}</strong><p>{item.description}</p>{item.current && <small>{localDate(application.updatedAt, state.language)}</small>}</div>
              </div>
            ))}
          </div>
        </main>
        <aside className="tracking-side">
          <article className="content-card owner-card"><span className="avatar">أم</span><div><small>{ar ? "الموظف المسؤول" : "CASE OWNER"}</small><strong>{ar ? "أحمد كريم محمود" : "Ahmed Kareem Mahmoud"}</strong><p>{ar ? "مديرية بغداد · مركز الخدمات" : "Baghdad Directorate · Service Center"}</p></div></article>
          <article className="content-card document-summary"><header><h3>{ar ? "الوثائق المكتملة" : "Complete documents"}</h3><span>{application.documentCount}/{application.documentCount}</span></header>{serviceDocuments(service).map(([titleAr, titleEn], index) => <div key={`${titleEn}-${index}`}><span className="file-icon">PDF</span><p><strong>{ar ? titleAr : titleEn}</strong><small>{ar ? "مرفقة مع الطلب" : "Attached to application"}</small></p><i>✓</i></div>)}</article>
          <article className="content-card"><span className="eyebrow">{ar ? "ملخص الطلب" : "REQUEST SUMMARY"}</span><p>{application.detail}</p></article>
        </aside>
      </section>
    </div>
  );
}

function buildTimeline(status: ApplicationStatus, ar: boolean) {
  const rank: Record<ApplicationStatus, number> = {
    Draft: 0, Submitted: 2, "Under Validation": 2, Incomplete: 1,
    "Awaiting Citizen Completion": 1, "Under Review": 3, "Manager Review": 4, Referred: 5,
    "Committee Review": 5, "Awaiting Approval": 6, Approved: 7,
    Rejected: 7, "In Execution": 7, Completed: 7, Appealed: 7,
    Reopened: 3, Cancelled: 0, Closed: 7,
  };
  const current = rank[status];
  const items = ar
    ? [
        ["إعداد الطلب", "تم تعبئة البيانات من الملف الموثّق."],
        ["اكتمال البيانات والوثائق", "يبقى الطلب لدى المواطن حتى تكتمل كل المتطلبات."],
        ["تقديم الطلب", "بعد الاكتمال أُرسل الطلب إلى مديرية بغداد."],
        ["مراجعة الموظف", "فحص القواعد والوثائق وإرسال التوصية البشرية."],
        ["اعتماد مدير المديرية", "يراجع المدير اكتمال عمل الموظف قبل اللجنة."],
        ["لجنة دعم التعليم", "مناقشة الطلب والتصويت المسجل."],
        ["اعتماد القرار", "توقيع القرار ونشره للمستفيدة."],
        ["النتيجة", "وثيقة نهائية قابلة للتحقق."],
      ]
    : [
        ["Prepare", "Verified profile data prefilled."],
        ["Complete data and evidence", "The application remains citizen-only until every requirement is complete."],
        ["Submit", "Sent to Baghdad Directorate only after completion."],
        ["Staff review", "Rules, evidence and a reasoned human recommendation."],
        ["Directorate manager", "The manager checks staff completion before committee referral."],
        ["Education Committee", "Recorded deliberation and voting."],
        ["Authorize decision", "Decision signed and published."],
        ["Result", "Final verifiable document."],
      ];
  return items.map(([title, description], index) => ({
    title,
    description,
    done: current > index || status === "Approved",
    current: current === index && status !== "Approved",
    date: index <= current ? (ar ? "تم تسجيل الحدث في سجل التدقيق" : "Recorded in the audit trail") : undefined,
  }));
}

function StaffInbox({
  state,
  setState,
  navigate,
  toast,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const [filter, setFilter] = useState("all");
  const [compact, setCompact] = useState(false);
  const [descending, setDescending] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const claimNext = () => {
    if (state.case.status !== "Submitted") {
      toast(ar ? "لا توجد مهمة جديدة قابلة للاستلام الآن" : "No new task is available to claim");
      return;
    }
    setState((previous) => ({ ...previous, case: { ...previous.case, assignedToAr: "أحمد كريم محمود", assignedToEn: "Ahmed Kareem Mahmoud", updatedAt: new Date().toISOString() } }));
    toast(ar ? "تم استلام المهمة وربطها بالموظف" : "Task claimed and assigned to the employee");
  };
  const allRows = [
    {
      id: state.case.id,
      isPrimary: true,
      isInteractive: true,
      citizenAr: state.case.citizenNameAr,
      serviceAr: "منحة تعليمية لأحد أفراد الأسرة",
      governorateAr: state.case.governorateAr,
      status: state.case.status,
      age: "٣ س",
      sla: state.case.slaHoursRemaining < 24 ? "خطر" : "ضمن المهلة",
      risk: state.case.documents.some((document) => document.type === "enrollment") ? "منخفض" : "وثيقة ناقصة",
    },
    ...state.additionalApplications.map((application) => {
      const service = services.find((item) => item.id === application.serviceId) ?? services[0];
      return {
        id: application.id,
        isPrimary: false,
        isInteractive: true,
        citizenAr: "زينب علي حسن",
        serviceAr: ar ? service.titleAr : service.titleEn,
        governorateAr: ar ? "بغداد" : "Baghdad",
        status: application.status,
        age: ar ? "الآن" : "Now",
        sla: application.slaHoursRemaining < 24 ? "خطر" : "ضمن المهلة",
        risk: "منخفض",
      };
    }),
  ]
    .filter((row) => isCaseVisibleToOperations(row.status))
    .filter((row) => row.status === "Submitted" || row.status === "Under Review");
  const rows = allRows
    .filter((row) => filter === "all" || (filter === "risk" ? row.sla === "خطر" : row.status === "Submitted"))
    .sort((a, b) => descending ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
  const newCount = allRows.filter((row) => row.status === "Submitted").length;
  const riskCount = allRows.filter((row) => row.sla === "خطر").length;
  const completedCount = state.additionalApplications.filter((item) => item.status === "Completed").length + (state.case.status === "Approved" || state.case.status === "Completed" ? 1 : 0);
  return (
    <div className="page staff-page">
      <SectionHeader
        eyebrow={ar ? "مركز عمل الموظف" : "SERVICE WORKSPACE"}
        title={ar ? "صندوق المهام الموحّد" : "Unified task inbox"}
        description={ar ? "طلبات مرتبة حسب الأولوية والمهلة والمخاطر، مع إجراء واضح لكل حالة." : "Cases ordered by priority, SLA and risk, with a clear next action."}
        action={<><button className="button button-secondary" onClick={() => { setCompact((value) => !value); toast(ar ? "تم تغيير كثافة الجدول" : "Table density changed"); }}>{compact ? (ar ? "عرض موسّع" : "Comfortable view") : (ar ? "عرض مضغوط" : "Compact view")} ⚙</button><button className="button button-primary" onClick={claimNext}>{ar ? "استلام المهمة التالية" : "Claim next task"} ←</button></>}
      />
      <div className="metric-grid metric-grid-4">
        <MetricCard label={ar ? "مهامي المفتوحة" : "My open tasks"} value={num(allRows.length, state.language)} trend={ar ? `${newCount} جديدة` : `${newCount} new`} icon="▤" />
        <MetricCard label={ar ? "معرضة لتجاوز المهلة" : "At SLA risk"} value={num(riskCount, state.language)} trend={ar ? "تحتاج اهتماماً" : "Needs attention"} icon="◷" tone="red" />
        <MetricCard label={ar ? "طلبات مكتملة جديدة" : "New complete submissions"} value={num(newCount, state.language)} trend={ar ? "جاهزة لبدء المراجعة" : "Ready for review"} icon="↔" tone="gold" />
        <MetricCard label={ar ? "أُنجزت" : "Completed"} value={num(completedCount, state.language)} icon="✓" tone="navy" />
      </div>
      <section className="table-card">
        <header className="table-toolbar">
          <div className="table-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{ar ? "كل المهام" : "All tasks"} <b>{allRows.length}</b></button><button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>{ar ? "جديدة" : "New"} <b>{newCount}</b></button><button className={filter === "risk" ? "active" : ""} onClick={() => setFilter("risk")}>{ar ? "خطر المهلة" : "SLA risk"} <b>{riskCount}</b></button></div>
          <div><button className="icon-button" aria-label={ar ? "عكس الترتيب" : "Reverse sort"} onClick={() => setDescending((value) => !value)}>⇅</button><button className="icon-button" aria-label={ar ? "تغيير كثافة الجدول" : "Change table density"} onClick={() => setCompact((value) => !value)}>⚙</button></div>
        </header>
        <div className="data-table-wrap">
          <table className={`data-table ${compact ? "data-table-compact" : ""}`}>
            <thead><tr><th><input type="checkbox" aria-label={ar ? "تحديد الكل" : "Select all"} checked={rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])} /></th><th>{ar ? "رقم الطلب" : "Request ID"}</th><th>{ar ? "المستفيد / الخدمة" : "Beneficiary / service"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "المحافظة" : "Governorate"}</th><th>{ar ? "العمر" : "Age"}</th><th>{ar ? "المهلة" : "SLA"}</th><th>{ar ? "المخاطر" : "Risk"}</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isInteractive ? "featured-row" : ""} onClick={() => row.isInteractive && navigate(`/staff/cases/${row.id}`)}>
                  <td><input type="checkbox" aria-label={row.id} checked={selectedIds.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))} /></td>
                  <td><strong dir="ltr">{row.id}</strong>{row.isInteractive && <MiniBadge tone="gold">{row.isPrimary ? (ar ? "قصة العرض" : "Demo story") : (ar ? "طلب مفعّل" : "Enabled flow")}</MiniBadge>}</td>
                  <td><strong>{row.citizenAr}</strong><small>{row.serviceAr}</small></td>
                  <td><StatusBadge status={row.status} language={state.language} /></td>
                  <td>{row.governorateAr}</td>
                  <td>{row.age}</td>
                  <td><span className={row.sla === "خطر" ? "sla-risk" : "sla-ok"}>◷ {row.sla}</span></td>
                  <td><MiniBadge tone={row.risk === "منخفض" ? "success" : "warning"}>{row.risk}</MiniBadge></td>
                  <td><button aria-label={ar ? "فتح" : "Open"} disabled={!row.isInteractive} onClick={(event) => { event.stopPropagation(); if (row.isInteractive) navigate(`/staff/cases/${row.id}`); }}>←</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">{ar ? `عرض ${rows.length} من ${allRows.length} مهمة` : `Showing ${rows.length} of ${allRows.length} tasks`}<span>{selectedIds.length ? (ar ? `${selectedIds.length} محددة` : `${selectedIds.length} selected`) : "1 / 1"}</span></footer>
      </section>
    </div>
  );
}

function AdditionalStaffWorkspace({
  state,
  setState,
  application,
  navigate,
  toast,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  application: ServiceApplication;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === application.serviceId) ?? services[0];
  const [note, setNote] = useState(application.employeeRecommendation || (ar ? "اكتملت مراجعة بيانات الطلب والوثائق، وأوصي بإحالته إلى مدير المديرية." : "Application data and documents are complete; I recommend referral to the Directorate Manager."));
  const changeStatus = (status: ApplicationStatus) => {
    if (!canTransition(application.status, status)) {
      toast(ar ? "هذا الإجراء غير متاح من الحالة الحالية" : "This action is unavailable from the current state");
      return;
    }
    if (["Manager Review", "Awaiting Citizen Completion", "Rejected"].includes(status) && !note.trim()) {
      toast(ar ? "اكتب ملاحظة أو توصية مسببة أولاً" : "Enter a reasoned note or recommendation first");
      return;
    }
    const now = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      additionalApplications: previous.additionalApplications.map((item) =>
        item.id === application.id
          ? {
              ...item,
              status,
              employeeRecommendation: status === "Manager Review" ? note.trim() : item.employeeRecommendation,
              reviewerConfirmed: status === "Manager Review" ? true : item.reviewerConfirmed,
              completionMessage: status === "Awaiting Citizen Completion" ? note.trim() : item.completionMessage,
              updatedAt: now,
            }
          : item,
      ),
      notifications:
        status === "Awaiting Citizen Completion"
          ? [
              {
                id: `notification-completion-${Date.now()}`,
                titleAr: `طلب استكمال ${service.titleAr}`,
                titleEn: `${service.titleEn} needs completion`,
                bodyAr: note.trim(),
                bodyEn: note.trim(),
                at: now,
                read: false,
                channel: "in-app",
              },
              ...previous.notifications,
            ]
          : previous.notifications,
    }));
    toast(
      status === "Under Review"
        ? (ar ? "بدأت المراجعة البشرية" : "Human review started")
        : status === "Manager Review"
          ? (ar ? "وصلت المعاملة إلى مدير المديرية؛ ابقَ ضمن حساب الموظف أو بدّل المستخدم يدوياً" : "The case reached the Directorate Manager; remain in staff or switch user manually")
          : status === "Awaiting Citizen Completion"
            ? (ar ? "وصلت ملاحظة الاستكمال إلى المواطن" : "Completion feedback reached the citizen")
            : (ar ? "تم تسجيل الرفض المسبب" : "Reasoned rejection recorded"),
    );
  };
  return (
    <div className="page staff-page">
      <button className="back-link" onClick={() => navigate("/staff/inbox")}>{ar ? "→ العودة إلى صندوق المهام" : "← Back to inbox"}</button>
      <SectionHeader
        eyebrow={ar ? "معاملة خدمة مفعلة" : "ENABLED SERVICE CASE"}
        title={ar ? service.titleAr : service.titleEn}
        description={`${application.id} · ${ar ? "زينب علي حسن · بغداد" : "Zainab Ali Hassan · Baghdad"}`}
        action={application.status === "Submitted"
          ? <button className="button button-primary" onClick={() => changeStatus("Under Review")}>{ar ? "بدء المراجعة" : "Start review"} ←</button>
          : <StatusBadge status={application.status} language={state.language} />}
      />
      <div className="metric-grid metric-grid-4">
        <MetricCard label={ar ? "الحالة" : "Status"} value={statusLabels[application.status][state.language]} icon="▤" />
        <MetricCard label={ar ? "الوثائق" : "Documents"} value={`${application.documentCount}/${application.documentCount}`} icon="▧" tone="navy" />
        <MetricCard label={ar ? "المهلة المتبقية" : "SLA remaining"} value={`${num(application.slaHoursRemaining, state.language)} ${ar ? "ساعة" : "hrs"}`} icon="◷" tone="gold" />
        <MetricCard label={ar ? "جودة البيانات" : "Data quality"} value="96%" icon="✓" />
      </div>
      <section className="case-summary-grid">
        <article className="content-card beneficiary-summary"><header><span className="avatar avatar-large">زع</span><div><span className="eyebrow">{ar ? "المستفيد 360" : "BENEFICIARY 360"}</span><h2>{ar ? "زينب علي حسن" : "Zainab Ali Hassan"}</h2><small>BEN-10024 · {ar ? "ملف موثّق" : "Verified profile"}</small></div><MiniBadge tone="success">✓ {ar ? "موثّق" : "Verified"}</MiniBadge></header><p>{application.detail}</p></article>
        <article className="content-card"><span className="eyebrow">{ar ? "قائمة اكتمال الطلب" : "COMPLETENESS CHECK"}</span>{serviceDocuments(service).map(([titleAr, titleEn], index) => <div className="pack-document" key={`${titleEn}-${index}`}><span className="file-icon">PDF</span><p><strong>{ar ? titleAr : titleEn}</strong><small>{ar ? "وصلت مع تقديم المواطن" : "Received with citizen submission"}</small></p><i>✓</i></div>)}</article>
      </section>
      {application.status === "Under Review" && <section className="content-card approval-decision">
        <span className="eyebrow">{ar ? "قرار الموظف — مراجعة بشرية" : "STAFF ACTION — HUMAN REVIEW"}</span>
        <h2>{ar ? "سجّل التوصية ثم اختر المسار" : "Record the recommendation, then choose the route"}</h2>
        <label className="input-field"><span>{ar ? "التوصية أو سبب الإجراء *" : "Recommendation or action reason *"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="human-action-grid"><button className="button button-secondary" disabled={!note.trim()} onClick={() => changeStatus("Awaiting Citizen Completion")}>↩ {ar ? "إعادة للمواطن" : "Return to citizen"}</button><button className="button button-danger" disabled={!note.trim()} onClick={() => changeStatus("Rejected")}>× {ar ? "رفض مسبب" : "Reasoned rejection"}</button><button className="button button-primary" disabled={!note.trim()} onClick={() => changeStatus("Manager Review")}>{ar ? "إرسال إلى مدير المديرية" : "Send to Directorate Manager"} ←</button></div>
      </section>}
      {!["Submitted", "Under Review"].includes(application.status) && <section className="content-card role-handoff-card"><span>✓</span><div><strong>{ar ? "اكتمل إجراء الموظف لهذه المرحلة" : "The staff action for this stage is complete"}</strong><p>{ar ? "لم يتم نقلك إلى حساب آخر. بدّل المستخدم من أعلى الصفحة لمتابعة السيناريو بالدور صاحب الصلاحية." : "You were not moved into another account. Use the role switcher to continue as the authorized user."}</p></div></section>}
    </div>
  );
}

function StaffCaseWorkspace({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const [tab, setTab] = useState("overview");
  const [drawer, setDrawer] = useState<"refer" | "return" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const eligibility = evaluateEligibility(state.case);
  const hasEnrollment = eligibility.find((result) => result.id === "rule-study")?.status === "pass";
  const complianceResults = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: state.complianceResolvedControlIds,
  });
  const complianceBlockers = getBlockingComplianceResults(complianceResults);

  if (!isCaseVisibleToOperations(state.case.status)) {
    return (
      <div className="page staff-page">
        <SectionHeader
          eyebrow={ar ? "مركز عمل الموظف" : "SERVICE WORKSPACE"}
          title={ar ? "لا توجد معاملة تشغيلية بهذا الرقم" : "No operational case is available"}
          description={ar ? "لا يصل الطلب إلى الموظف ولا يظهر في مركز العمل إلا بعد أن يُكمل المواطن جميع البيانات والوثائق ويرسله." : "The application reaches staff and appears in the workspace only after the citizen completes all data and documents and submits it."}
          action={<button className="button button-secondary" onClick={() => navigate("/staff/inbox")}>{ar ? "العودة لصندوق المهام" : "Back to inbox"}</button>}
        />
      </div>
    );
  }

  const startReview = () => {
    if (!canTransition(state.case.status, "Under Review")) {
      toast(ar ? "لا يمكن بدء المراجعة من الحالة الحالية." : "Review cannot start from the current state.");
      return;
    }
    setState((previous) => ({
      ...previous,
      case: {
        ...previous.case,
        status: "Under Review",
        updatedAt: new Date().toISOString(),
        slaHoursRemaining: 80,
      },
    }));
    addAudit("استلام الطلب المكتمل وبدء المراجعة البشرية", "Complete application claimed and human review started", "staff");
    toast(ar ? "بدأت مراجعة الطلب المكتمل" : "Review of the complete application started");
  };
  const requestCitizenCompletion = () => {
    if (!reason.trim() || !canTransition(state.case.status, "Awaiting Citizen Completion")) {
      toast(ar ? "اكتب الملاحظة المطلوبة قبل إعادة المعاملة." : "Enter the required note before returning the case.");
      return;
    }
    const now = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      case: {
        ...previous.case,
        status: "Awaiting Citizen Completion",
        completionMessage: reason.trim(),
        updatedAt: now,
      },
      notifications: [{
        id: `notification-completion-${Date.now()}`,
        titleAr: "ملاحظة من موظف المعاملة",
        titleEn: "Case officer feedback",
        bodyAr: reason.trim(),
        bodyEn: reason.trim(),
        at: now,
        read: false,
        channel: "in-app",
      }, ...previous.notifications],
    }));
    addAudit("إعادة المعاملة للمواطن مع ملاحظة استكمال", "Case returned to the citizen with a completion note", "staff");
    setDrawer(null);
    setReason("");
    toast(ar ? "وصلت الملاحظة للمواطن واختفت المعاملة من عمل الموظف مؤقتاً" : "Feedback reached the citizen and the case left the staff queue temporarily");
  };
  const refer = () => {
    if (!reason.trim()) return;
    if (!hasEnrollment) {
      toast(ar ? "يجب التحقق من وثيقة التسجيل أولاً." : "Enrollment evidence must be verified first.");
      return;
    }
    if (complianceBlockers.length) {
      setDrawer(null);
      setTab("compliance");
      toast(
        ar
          ? `الإحالة محجوبة: عالج ${complianceBlockers.length} من ضوابط الامتثال أولاً.`
          : `Referral blocked: resolve ${complianceBlockers.length} compliance controls first.`,
      );
      return;
    }
    if (!canTransition(state.case.status, "Manager Review")) {
      toast(ar ? "الإرسال للمدير غير متاح من الحالة الحالية." : "Sending to the manager is unavailable from the current state.");
      return;
    }
    setState((previous) => ({
      ...previous,
      case: {
        ...previous.case,
        status: "Manager Review",
        reviewerConfirmed: true,
        employeeRecommendation: reason,
        updatedAt: new Date().toISOString(),
      },
    }));
    addAudit("تأكيد المراجعة البشرية وإرسال الطلب إلى مدير المديرية", "Human review confirmed; case sent to the directorate manager", "staff");
    toast(ar ? "أُرسل الطلب إلى مدير المديرية" : "Case sent to the directorate manager");
    setDrawer(null);
    setReason("");
  };
  return (
    <div className="staff-case">
      <header className="case-sticky-header">
        <div className="case-breadcrumb"><button onClick={() => navigate("/staff/inbox")}>{ar ? "صندوق المهام" : "Inbox"}</button><span>/</span><b dir="ltr">{state.case.id}</b></div>
        <div className="case-heading">
          <div><h1>{ar ? "منحة تعليمية لأحد أفراد الأسرة" : "Family Education Grant"}</h1><p><strong>{ar ? state.case.citizenNameAr : state.case.citizenNameEn}</strong><span>·</span>{ar ? state.case.governorateAr : state.case.governorateEn}<span>·</span>{ar ? "أولوية مرتفعة" : "High priority"}</p></div>
          <StatusBadge status={state.case.status} language={state.language} />
          <div className="case-sla"><span>◷ {ar ? "المهلة" : "SLA"}</span><strong>{num(state.case.slaHoursRemaining, state.language)}:{ar ? "٠٠ ساعة" : "00 hrs"}</strong></div>
          <div className="case-actions">
            {state.case.status === "Submitted" && <button className="button button-primary" onClick={startReview}>{ar ? "بدء المراجعة" : "Start review"} ←</button>}
            {state.case.status === "Under Review" && <><button className="button button-secondary" onClick={() => setDrawer("return")}>{ar ? "إعادة للمواطن" : "Return to citizen"}</button><button className="button button-primary" onClick={() => navigate(`/staff/cases/${state.case.id}/recommendation`)} disabled={!hasEnrollment}>{ar ? "مراجعة التوصية" : "Review recommendation"} ←</button></>}
            <button className="icon-button" aria-label={ar ? "إجراءات إضافية" : "More actions"} onClick={() => setDrawer("reject")}>⋮</button>
          </div>
        </div>
      </header>
      <div className="case-tabs">
        {[
          ["overview", "نظرة عامة", "Overview"],
          ["beneficiary", "المستفيد 360", "Beneficiary 360"],
          ["family", "الأسرة 360", "Family 360"],
          ["documents", `الوثائق (${state.case.documents.length})`, `Documents (${state.case.documents.length})`],
          ["eligibility", "الأهلية", "Eligibility"],
          ["compliance", `امتثال الحالة (${complianceBlockers.length})`, `Case compliance (${complianceBlockers.length})`],
          ["tasks", "المهام والموافقات", "Tasks"],
          ["communications", "المراسلات", "Communications"],
          ["audit", "التدقيق", "Audit"],
        ].map(([id, labelAr, labelEn]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{ar ? labelAr : labelEn}</button>)}
      </div>
      <div className="case-workspace-grid">
        <main>
          {tab === "overview" && <CaseOverview state={state} eligibility={eligibility} setTab={setTab} />}
          {tab === "documents" && <DocumentReview state={state} setState={setState} toast={toast} />}
          {tab === "eligibility" && <EligibilityPanel state={state} results={eligibility} toast={toast} />}
          {tab === "compliance" && <CaseCompliancePanel state={state} setState={setState} toast={toast} addAudit={addAudit} />}
          {tab === "audit" && <AuditTimeline state={state} />}
          {tab === "beneficiary" && <BeneficiaryView state={state} />}
          {tab === "family" && <FamilyView state={state} />}
          {tab === "tasks" && <TaskView state={state} openTask={(target) => setTab(target)} />}
          {tab === "communications" && <CommunicationView state={state} setState={setState} toast={toast} />}
        </main>
        <aside className="context-panel">
          <section className="ai-panel">
            <header><span>✦ {ar ? "مساعد الحالة" : "CASE ASSISTANT"}</span><MiniBadge tone="info">RAG + LLM</MiniBadge></header>
            {!state.aiEnabled ? (
              <div className="ai-disabled"><span>○</span><strong>{ar ? "المساعد متوقف" : "Assistant disabled"}</strong><p>{ar ? "لا تتأثر إجراءات الموظف الرسمية." : "Official staff actions remain available."}</p><button onClick={() => setState((previous) => ({ ...previous, aiEnabled: true }))}>{ar ? "إعادة التشغيل" : "Enable"}</button></div>
            ) : (
              <>
                <div className="ai-answer">
                  <span className="ai-spark">✦</span>
                  <div>
                    <strong>{ar ? "مساعد الموظف مرتبط بهذه الحالة" : "Staff assistant connected to this case"}</strong>
                    <p>{ar ? "يسحب المواد الأقرب من القانون، يقرأ نتائج ضوابط الامتثال، ويعرض السند والصفحة. كل محادثة موظف تُكتب في سجل التدقيق." : "It retrieves the closest law, reads compliance results, and shows the source and page. Every staff query is written to the audit log."}</p>
                    <small>{ar ? "النطاق: الحالة الحالية · القانون · الضوابط الحتمية" : "Scope: current case · law · deterministic controls"}</small>
                  </div>
                </div>
                <div className="question-chips">
                  {[
                    ["لخّص الحالة", "Summarize"],
                    ["الضوابط الحاجبة", "Blocking controls"],
                    ["المراجع القانونية", "Legal references"],
                  ].map(([labelAr, labelEn]) => <button key={labelEn} onClick={() => navigate("/staff/help")}>{ar ? labelAr : labelEn}</button>)}
                </div>
                <button className="button button-primary button-full" onClick={() => navigate("/staff/help")}>{ar ? "فتح مساعد الموظف" : "Open staff assistant"} ←</button>
                <button className="ai-disable" onClick={() => setState((previous) => ({ ...previous, aiEnabled: false }))}>{ar ? "إيقاف المساعد لهذه الجلسة" : "Disable assistant for this session"}</button>
              </>
            )}
          </section>
          <section className="rules-summary">
            <header><span>{ar ? "ملخص الأهلية" : "ELIGIBILITY SUMMARY"}</span><button onClick={() => setTab("eligibility")}>{ar ? "التفاصيل" : "Details"} ←</button></header>
            <div className="rule-score"><strong>{eligibility.filter((result) => result.status === "pass").length}/{eligibility.length}</strong><span>{ar ? "قواعد مجتازة" : "rules passed"}</span></div>
            {eligibility.map((result) => <div key={result.id} className={`rule-mini rule-${result.status}`}><i>{result.status === "pass" ? "✓" : result.status === "warning" ? "!" : "◇"}</i><span>{ar ? result.nameAr : result.nameEn}</span></div>)}
            <button className="button button-secondary button-full" onClick={() => { setTab("eligibility"); toast(ar ? "أُعيد تشغيل القواعد بنتيجة حتمية" : "Rules rerun deterministically"); }}>{ar ? "إعادة تشغيل القواعد" : "Rerun rules"} ↻</button>
          </section>
          <section className="duplicate-alert"><span>◇</span><div><strong>{ar ? "تشابه سجل محتمل" : "Possible related record"}</strong><p>{ar ? "تشابه اسم بنسبة ٣٢٪ مع طلب مغلق. للتنبيه فقط ولا يحجب الطلب." : "32% name similarity with a closed case. Alert only; case is not blocked."}</p><button onClick={() => setTab("audit")}>{ar ? "مراجعة السجل" : "Review record"} ←</button></div></section>
        </aside>
      </div>
      {drawer && (
        <div className="drawer-backdrop" onMouseDown={() => setDrawer(null)}>
          <aside className="action-drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <header><div><span className="eyebrow">{ar ? "إجراء رسمي" : "OFFICIAL ACTION"}</span><h2>{drawer === "refer" ? (ar ? "إرسال إلى مدير المديرية" : "Send to Directorate Manager") : drawer === "return" ? (ar ? "إعادة المعاملة للمواطن" : "Return case to citizen") : (ar ? "رفض الطلب" : "Reject application")}</h2></div><button className="icon-button" onClick={() => setDrawer(null)}>×</button></header>
            {drawer === "refer" ? (
              <>
                <div className="human-review-banner"><span>✓</span><div><strong>{ar ? "المراجعة البشرية مطلوبة" : "Human review required"}</strong><p>{ar ? "اقتراح الذكاء الاصطناعي ليس قراراً. بتأكيد الإحالة تقر أنك راجعت البيانات والوثائق والقواعد." : "AI output is not a decision. By referring, you confirm you reviewed the data, evidence and rules."}</p></div></div>
                <div className="referral-checks">
                  {complianceResults
                    .filter((result) => result.status !== "not_applicable")
                    .map((result) => <div key={result.control.id} className={result.status === "pass" ? "" : "referral-blocker"}><span>{result.status === "pass" ? "✓" : "!"}</span><p><strong>{ar ? result.control.nameAr : result.control.nameEn}</strong><small>{result.control.id} · {ar ? result.explanationAr : result.explanationEn}</small></p></div>)}
                </div>
                {complianceBlockers.length > 0 && <div className="compliance-drawer-block"><span>!</span><div><strong>{ar ? "لا يمكن تأكيد الإحالة الآن" : "Referral cannot be confirmed yet"}</strong><p>{ar ? "افتح امتثال الحالة ووثّق معالجة العناصر الحاجبة، ثم ارجع إلى الإحالة." : "Open case compliance, document the blocking treatments, then return to referral."}</p><button onClick={() => { setDrawer(null); setTab("compliance"); }}>{ar ? "فتح امتثال الحالة" : "Open case compliance"} ←</button></div></div>}
                <label className="input-field"><span>{ar ? "توصية الموظف المسببة *" : "Reasoned staff recommendation *"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={ar ? "بيّن الوقائع والمراجع التي تستند إليها التوصية…" : "State the facts and references supporting the recommendation…"} /></label>
                <footer><button className="button button-secondary" onClick={() => setDrawer(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="button button-primary" disabled={!reason.trim() || !hasEnrollment || complianceBlockers.length > 0} onClick={refer}>{ar ? "أؤكد المراجعة وأرسل للمدير" : "Confirm and send to manager"} ←</button></footer>
              </>
            ) : drawer === "return" ? <>
              <div className="human-review-banner"><span>↩</span><div><strong>{ar ? "الملاحظة ستعود للمواطن" : "Feedback will return to the citizen"}</strong><p>{ar ? "تختفي المعاملة من الموظف والمدير واللجنة حتى يعدّل المواطن المطلوب ويعيد التسليم." : "The case leaves staff, manager and committee views until the citizen completes the request and resubmits."}</p></div></div>
              <label className="input-field"><span>{ar ? "الملاحظة المطلوبة من المواطن *" : "Required citizen action *"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={ar ? "مثال: أرفق تأييداً حديثاً للاستمرار بالدراسة…" : "Example: Attach a recent enrollment confirmation…"} /></label>
              <footer><button className="button button-secondary" onClick={() => setDrawer(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="button button-primary" disabled={!reason.trim()} onClick={requestCitizenCompletion}>{ar ? "إرسال الملاحظة للمواطن" : "Send feedback to citizen"} ←</button></footer>
            </> : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function StaffRecommendationReview({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const [reason, setReason] = useState(state.case.employeeRecommendation ?? "الوثائق المطلوبة مكتملة، وصلة المستفيدة مثبتة في ملف الأسرة، ونتائج القواعد لا تتضمن مانعاً آلياً. أوصي بإرسال المعاملة إلى مدير المديرية للمراجعة.");
  const [checks, setChecks] = useState({ data: false, evidence: false, rules: false, independent: false });
  const allChecked = Object.values(checks).every(Boolean);
  const eligibility = evaluateEligibility(state.case);
  const act = (action: "manager" | "citizen" | "reject") => {
    if (!reason.trim() || !allChecked) return;
    const now = new Date().toISOString();
    const target: ApplicationStatus = action === "manager" ? "Manager Review" : action === "citizen" ? "Awaiting Citizen Completion" : "Rejected";
    if (!canTransition(state.case.status, target)) {
      toast(ar ? "هذا الإجراء غير متاح من الحالة الحالية." : "This action is unavailable from the current state.");
      return;
    }
    setState((previous) => ({
      ...previous,
      case: {
        ...previous.case,
        status: target,
        employeeRecommendation: reason.trim(),
        reviewerConfirmed: true,
        completionMessage: action === "citizen" ? reason.trim() : previous.case.completionMessage,
        updatedAt: now,
      },
      notifications: action === "citizen" ? [{
        id: `human-feedback-${Date.now()}`,
        titleAr: "ملاحظة استكمال من الموظف",
        titleEn: "Staff completion feedback",
        bodyAr: reason.trim(),
        bodyEn: reason.trim(),
        at: now,
        read: false,
        channel: "in-app",
      }, ...previous.notifications] : previous.notifications,
    }));
    addAudit(
      action === "manager" ? "اعتماد توصية الموظف وإرسالها إلى مدير المديرية" : action === "citizen" ? "إعادة المعاملة للمواطن بملاحظة بشرية" : "رفض الموظف المعاملة بسبب مسجل",
      action === "manager" ? "Staff recommendation confirmed and sent to the directorate manager" : action === "citizen" ? "Case returned to the citizen with human feedback" : "Case rejected by staff with a recorded reason",
      "staff",
    );
    toast(action === "manager" ? (ar ? "وصلت التوصية إلى مدير المديرية" : "Recommendation sent to the directorate manager") : action === "citizen" ? (ar ? "وصلت الملاحظة للمواطن" : "Feedback sent to the citizen") : (ar ? "سُجل الرفض المسبب" : "Reasoned rejection recorded"));
    navigate("/staff/inbox");
  };
  return <div className="page recommendation-review-page">
    <button className="back-link" onClick={() => navigate(`/staff/cases/${state.case.id}`)}>{ar ? "→ العودة لمساحة الحالة" : "← Back to case workspace"}</button>
    <SectionHeader eyebrow={ar ? "بندا قصة العرض ١٨ و١٩" : "DEMO STORY ITEMS 18 & 19"} title={ar ? "توصية مسنَدة، ثم قرار بشري صريح." : "Grounded recommendation, then explicit human action."} description={ar ? "المساعد يلخص ويستشهد؛ الموظف يراجع ويتحمل مسؤولية الإجراء الرسمي." : "The assistant summarizes and cites; the employee reviews and owns the official action."} />
    <div className="recommendation-review-grid">
      <section className="grounded-recommendation-card">
        <header><span>✦</span><div><MiniBadge tone="info">OpenRouter + RAG</MiniBadge><h2>{ar ? "ملخص وتوصية المساعد" : "Assistant summary and recommendation"}</h2></div></header>
        <div className="recommendation-facts">{[
          [ar ? "الملف" : "Profile", ar ? `${citizenCategory(state.citizenProfile.category).labelAr} · صلة أسرة مسجلة` : `${citizenCategory(state.citizenProfile.category).labelEn} · registered family link`],
          [ar ? "الوثائق" : "Evidence", ar ? `${state.case.documents.length} وثائق · تأييد الدراسة ${state.case.documents.some((document) => document.type === "enrollment") ? "موجود" : "مفقود"}` : `${state.case.documents.length} documents · enrollment evidence ${state.case.documents.some((document) => document.type === "enrollment") ? "present" : "missing"}`],
          [ar ? "القواعد" : "Rules", ar ? `${eligibility.filter((item) => item.status === "pass").length} مجتازة · مراجعة بشرية واحدة` : `${eligibility.filter((item) => item.status === "pass").length} passed · one human review`],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <article><span className="eyebrow">{ar ? "التوصية المقترحة" : "SUGGESTED RECOMMENDATION"}</span><p>{ar ? "يمكن إرسال الملف إلى مدير المديرية بعد أن يؤكد الموظف صحة المدخلات واكتمال الوثائق. هذه ليست موافقة ولا قرار استحقاق." : "The file may be sent to the directorate manager after staff confirm inputs and evidence. This is neither approval nor an entitlement decision."}</p></article>
        <div className="recommendation-citations"><button onClick={() => toast(ar ? "المادة ١: تعريف الشهيد وفئات ذويه — الصفحتان ١–٢" : "Article 1: definition and family categories — pages 1–2")}>م.١ · {ar ? "تعريف الصفة والقرابة" : "Status and kinship"}</button><button onClick={() => toast(ar ? "المادة ١٧/سابعاً: المقاعد الدراسية — الصفحات ١٣–١٥" : "Article 17/VII: education seats — pages 13–15")}>م.١٧/سابعاً · {ar ? "السند التعليمي" : "Education basis"}</button><button onClick={() => navigate("/compliance")}>{ar ? "ضوابط الامتثال" : "Compliance controls"} ←</button></div>
        <small>{ar ? "رأي مساعد مُسنَد — القرار للموظف والمدير واللجنة حسب المرحلة." : "Grounded assistant opinion — the decision remains with staff, manager and committee by stage."}</small>
      </section>
      <section className="human-decision-card">
        <header><span>✓</span><div><span className="eyebrow">{ar ? "تأكيد بشري إلزامي" : "MANDATORY HUMAN CONFIRMATION"}</span><h2>{ar ? "راجع قبل أن تحرّك المعاملة" : "Review before moving the case"}</h2></div></header>
        <div className="human-checklist">{[
          ["data", "راجعت بيانات المواطن وتصنيفه الأولي", "I reviewed citizen data and the initial category"],
          ["evidence", "فتحت الوثائق وتحققت من اكتمالها", "I opened the evidence and checked completeness"],
          ["rules", "راجعت نتائج القواعد ومراجعها", "I reviewed rule results and references"],
          ["independent", "قراري مستقل ولا يعتمد على اقتراح المساعد وحده", "My decision is independent of the assistant suggestion"],
        ].map(([id, labelAr, labelEn]) => <label key={id}><input type="checkbox" checked={checks[id as keyof typeof checks]} onChange={(event) => setChecks((current) => ({ ...current, [id]: event.target.checked }))} /><span>{ar ? labelAr : labelEn}</span></label>)}</div>
        <label className="input-field"><span>{ar ? "توصية الموظف المسببة *" : "Reasoned staff recommendation *"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="human-action-grid"><button className="button button-secondary" disabled={!allChecked || !reason.trim()} onClick={() => act("citizen")}>↩ {ar ? "إعادة للمواطن" : "Return to citizen"}</button><button className="button button-danger" disabled={!allChecked || !reason.trim()} onClick={() => act("reject")}>× {ar ? "رفض مسبب" : "Reasoned reject"}</button><button className="button button-primary" disabled={!allChecked || !reason.trim()} onClick={() => act("manager")}>{ar ? "إرسال إلى مدير المديرية" : "Send to manager"} ←</button></div>
      </section>
    </div>
  </div>;
}

function CaseOverview({
  state,
  eligibility,
  setTab,
}: {
  state: DemoState;
  eligibility: EligibilityResult[];
  setTab: (tab: string) => void;
}) {
  const ar = state.language === "ar";
  return (
    <div className="case-main-stack">
      <section className="case-summary-grid">
        <article className="content-card beneficiary-summary">
          <header><span className="avatar avatar-large">زع</span><div><span className="eyebrow">{ar ? "المستفيد 360" : "BENEFICIARY 360"}</span><h2>{ar ? state.case.citizenNameAr : state.case.citizenNameEn}</h2><small dir="ltr">BEN-10024 · •••• 4021</small></div><MiniBadge tone="success">✓ {ar ? "موثّق" : "Verified"}</MiniBadge></header>
          <div className="summary-facts"><div><span>{ar ? "المحافظة" : "Governorate"}</span><strong>{ar ? state.case.governorateAr : state.case.governorateEn}</strong></div><div><span>{ar ? "حالة الملف" : "Profile status"}</span><strong>{ar ? "نشط" : "Active"}</strong></div><div><span>{ar ? "خدمات سابقة" : "Previous services"}</span><strong>{num(4, state.language)}</strong></div><div><span>{ar ? "جودة البيانات" : "Data quality"}</span><strong>{num(94, state.language)}%</strong></div></div>
        </article>
        <article className="content-card family-summary">
          <header><span>♧</span><div><span className="eyebrow">{ar ? "الأسرة 360" : "FAMILY 360"}</span><h2>{ar ? "أسرة رقم FAM-4502" : "Family FAM-4502"}</h2></div><button onClick={() => setTab("family")}>{ar ? "فتح" : "Open"} ←</button></header>
          <div className="family-nodes"><span>زع</span><i /><span className="selected">مح</span><i /><span>عح</span><i /><span>سح</span></div>
          <p>{ar ? "مريم حيدر علي · ابنة · طالبة جامعية · صلة موثّقة" : "Maryam Haider Ali · Daughter · University student · Verified relationship"}</p>
        </article>
      </section>
      <section className="content-card application-data">
        <header><div><span className="eyebrow">{ar ? "بيانات الطلب" : "APPLICATION DATA"}</span><h2>{ar ? "ملخص المعلومات المقدمة" : "Submitted information"}</h2></div><MiniBadge tone="info">{ar ? "نسخة 1.0" : "Version 1.0"}</MiniBadge></header>
        <div className="summary-facts summary-facts-4"><div><span>{ar ? "الطالبة" : "Student"}</span><strong>{ar ? state.case.familyMemberAr : state.case.familyMemberEn}</strong></div><div><span>{ar ? "الجامعة" : "University"}</span><strong>{ar ? state.case.universityAr : state.case.universityEn}</strong></div><div><span>{ar ? "السنة الدراسية" : "Academic year"}</span><strong>2025–2026</strong></div><div><span>{ar ? "المرحلة" : "Stage"}</span><strong>{ar ? "الثانية" : "Second year"}</strong></div></div>
      </section>
      <section className="case-two-column">
        <article className="content-card">
          <header><div><span className="eyebrow">{ar ? "الوثائق" : "DOCUMENTS"}</span><h2>{ar ? "ملف الأدلة" : "Evidence pack"}</h2></div><button className="text-button" onClick={() => setTab("documents")}>{ar ? "مراجعة الكل" : "Review all"} ←</button></header>
          <div className="document-list compact">{state.case.documents.map((document) => <div key={document.id} className="document-row"><span className="file-icon">PDF</span><p><strong>{ar ? document.titleAr : document.titleEn}</strong><small>{document.classification}</small></p><MiniBadge tone={document.status === "verified" ? "success" : "warning"}>{document.status === "verified" ? "✓" : "!"}</MiniBadge></div>)}</div>
        </article>
        <article className="content-card">
          <header><div><span className="eyebrow">{ar ? "نتيجة القواعد" : "RULE RESULTS"}</span><h2>{ar ? "الأهلية والاستحقاق" : "Eligibility & entitlement"}</h2></div><button className="text-button" onClick={() => setTab("eligibility")}>{ar ? "التفاصيل" : "Details"} ←</button></header>
          <div className="eligibility-list compact">{eligibility.map((result) => <div key={result.id} className={`eligibility-row rule-${result.status}`}><span>{result.status === "pass" ? "✓" : result.status === "warning" ? "!" : "◇"}</span><p><strong>{ar ? result.nameAr : result.nameEn}</strong><small>{result.legalRef} · {result.version}</small></p></div>)}</div>
        </article>
      </section>
      <section className="content-card audit-preview">
        <header><div><span className="eyebrow">{ar ? "آخر الأحداث" : "RECENT EVENTS"}</span><h2>{ar ? "مسار الحالة والتدقيق" : "Case timeline & audit"}</h2></div><button className="text-button" onClick={() => setTab("audit")}>{ar ? "السجل الكامل" : "Full log"} ←</button></header>
        {state.case.audit.slice(-4).reverse().map((event) => <AuditRow key={event.id} event={event} language={state.language} />)}
      </section>
    </div>
  );
}

function DocumentReview({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [selected, setSelected] = useState(state.case.documents[0]?.id);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const document = state.case.documents.find((item) => item.id === selected) ?? state.case.documents[0];
  const updateStatus = (status: "review" | "verified") => {
    setState((previous) => ({ ...previous, case: { ...previous.case, documents: previous.case.documents.map((item) => item.id === document.id ? { ...item, status } : item), updatedAt: new Date().toISOString() } }));
    toast(status === "verified" ? (ar ? "تم تسجيل تحقق الموظف" : "Staff verification recorded") : (ar ? "تم إنشاء طلب استبدال" : "Replacement request created"));
  };
  return (
    <section className="document-review">
      <div className="document-sidebar">
        <header><h2>{ar ? "وثائق الحالة" : "Case documents"}</h2><span>{state.case.documents.length}</span></header>
        {state.case.documents.map((item) => <button key={item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span className="file-icon">PDF</span><p><strong>{ar ? item.titleAr : item.titleEn}</strong><small>{item.classification}</small></p><i>{item.status === "verified" ? "✓" : "!"}</i></button>)}
      </div>
      <div className="document-viewer">
        <header><div><h2>{ar ? document.titleAr : document.titleEn}</h2><p>{document.source} · {document.uploadedAt ? localDate(document.uploadedAt, state.language) : "—"}</p></div><div><button className="button button-secondary" onClick={() => setRotation((value) => (value + 90) % 360)}>{ar ? "تدوير" : "Rotate"} ↻</button><button className="button button-secondary" onClick={() => setZoom((value) => value >= 1.4 ? 1 : value + .2)}>{ar ? "تكبير" : "Zoom"} {Math.round(zoom * 100)}%</button></div></header>
        <div className="paper-preview" style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}><span className="doc-watermark">{ar ? "وثيقة تجريبية" : "DEMO DOCUMENT"}</span><div className="paper-seal">◇</div><h3>{ar ? "جامعة بغداد" : "UNIVERSITY OF BAGHDAD"}</h3><p>{ar ? "تأييد بيانات دراسية — نسخة اصطناعية للعرض" : "Student information confirmation — synthetic demo copy"}</p><hr /><div className="paper-lines">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ width: `${55 + ((index * 11) % 38)}%` }} />)}</div><footer>DOC-DEMO-{document.id.toUpperCase()}</footer></div>
      </div>
      <aside className="document-inspector">
        <span className="eyebrow">✦ {ar ? "استخراج محاكى" : "SIMULATED EXTRACTION"}</span>
        <h3>{ar ? "الحقول المقترحة" : "Suggested fields"}</h3>
        <div className="extracted-fields"><div><span>{ar ? "الاسم" : "Name"}</span><strong>{ar ? "مريم حيدر علي" : "Maryam Haider Ali"}</strong><b>98%</b></div><div><span>{ar ? "الجامعة" : "University"}</span><strong>{ar ? "جامعة بغداد" : "University of Baghdad"}</strong><b>97%</b></div><div><span>{ar ? "الحالة" : "Status"}</span><strong>{ar ? "مستمرة بالدراسة" : "Actively enrolled"}</strong><b>94%</b></div></div>
        <small>{ar ? "المصدر: النص الظاهر في وثيقة العرض. لا تُرسل البيانات خارجياً." : "Source: visible demo document text. Data is not sent externally."}</small>
        <hr />
        <h3>{ar ? "قائمة التحقق البشرية" : "Human verification checklist"}</h3>
        <label><input type="checkbox" defaultChecked /> {ar ? "الوثيقة مقروءة" : "Document is legible"}</label>
        <label><input type="checkbox" defaultChecked /> {ar ? "الاسم يطابق الطلب" : "Name matches application"}</label>
        <label><input type="checkbox" /> {ar ? "الختم والتاريخ مراجعان" : "Seal and date reviewed"}</label>
        <div className="inspector-actions"><button className="button button-secondary" onClick={() => updateStatus("review")}>{ar ? "طلب استبدال" : "Request replacement"}</button><button className="button button-primary" onClick={() => updateStatus("verified")}>✓ {ar ? "تأكيد الوثيقة" : "Verify document"}</button></div>
      </aside>
    </section>
  );
}

function EligibilityPanel({ state, results, toast }: { state: DemoState; results: EligibilityResult[]; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  return (
    <section className="eligibility-page">
      <header><div><span className="eyebrow">{ar ? "تقييم حتمي محاكى" : "DETERMINISTIC DEMO EVALUATION"}</span><h2>{ar ? "الأهلية والاستحقاق" : "Eligibility & entitlement"}</h2><p>{ar ? "توضح كل بطاقة المدخل والنسخة والمرجع والتفسير. لا تمثل النتائج قراراً رسمياً." : "Each card exposes its input, version, reference and explanation. Results are not an official decision."}</p></div><button className="button button-primary" onClick={() => toast(ar ? "أُعيد تشغيل EDU-ELIG-2.3 دون تغيير غير متوقع" : "EDU-ELIG-2.3 reran deterministically")}>↻ {ar ? "إعادة التقييم" : "Rerun evaluation"}</button></header>
      <div className="eligibility-score"><strong>{results.filter((result) => result.status === "pass").length}</strong><span>{ar ? "مجتازة" : "passed"}</span><strong>{results.filter((result) => result.status === "warning").length}</strong><span>{ar ? "تنبيه" : "warning"}</span><strong>{results.filter((result) => result.status === "manual").length}</strong><span>{ar ? "مراجعة بشرية" : "manual review"}</span></div>
      <div className="rule-card-list">{results.map((result) => <article key={result.id} className={`rule-card rule-${result.status}`}><header><span>{result.status === "pass" ? "✓" : result.status === "warning" ? "!" : "◇"}</span><div><h3>{ar ? result.nameAr : result.nameEn}</h3><p>{ar ? result.inputAr : result.inputEn}</p></div><MiniBadge tone={result.status === "pass" ? "success" : result.status === "warning" ? "warning" : "info"}>{result.status.toUpperCase()}</MiniBadge></header><div className="rule-meta"><span>{ar ? "نسخة القاعدة" : "Rule version"} <b>{result.version}</b></span><span>{ar ? "المرجع" : "Legal ref"} <b>{result.legalRef}</b></span></div><p className="rule-explanation">{ar ? result.explanationAr : result.explanationEn}</p><label><input type="checkbox" /> {ar ? "راجعت هذه النتيجة ومدخلاتها" : "I reviewed this result and its inputs"}</label></article>)}</div>
    </section>
  );
}

function AuditRow({ event, language }: { event: AuditEvent; language: Language }) {
  return (
    <div className="audit-row">
      <span className={`audit-source source-${event.source}`}>{event.source === "system" ? "⌁" : event.source === "citizen" ? "ز" : event.source === "committee" ? "ل" : event.source === "manager" ? "د" : "م"}</span>
      <div><strong>{language === "ar" ? event.actionAr : event.actionEn}</strong><p>{event.actor} · {localDate(event.at, language)}</p></div>
      <span dir="ltr">{event.correlationId}</span>
      <small dir="ltr">{event.hash.slice(0, 18)}…</small>
    </div>
  );
}

function AuditTimeline({ state }: { state: DemoState }) {
  const ar = state.language === "ar";
  const [query, setQuery] = useState("");
  const events = state.case.audit.filter((event) => `${event.actionAr} ${event.actor} ${event.correlationId}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="audit-full">
      <header><div><span className="eyebrow">{ar ? "سجل إلحاقي ضمن تدفقات العرض" : "APPEND-ONLY IN DEMO FLOWS"}</span><h2>{ar ? "سجل الحالة القابل للتتبع" : "Traceable case audit"}</h2><p>{ar ? "المظهر يوحي بعدم القابلية للتلاعب؛ لكنه ليس إثباتاً تشفيرياً إنتاجياً." : "The UI communicates tamper evidence; it is not production cryptographic proof."}</p></div><label className="inline-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "فاعل، إجراء، معرّف…" : "Actor, action, correlation…"} /></label></header>
      <div className="audit-chain">{events.slice().reverse().map((event) => <AuditRow key={event.id} event={event} language={state.language} />)}</div>
    </section>
  );
}

function BeneficiaryView({ state }: { state: DemoState }) {
  const ar = state.language === "ar";
  return <div className="case-main-stack"><section className="identity-hero content-card"><span className="avatar avatar-xl">زع</span><div><span className="eyebrow">{ar ? "ملف اصطناعي موثّق" : "VERIFIED SYNTHETIC PROFILE"}</span><h2>{ar ? state.case.citizenNameAr : state.case.citizenNameEn}</h2><p>BEN-10024 · {ar ? "بغداد / الكرخ" : "Baghdad / Karkh"}</p></div><MiniBadge tone="success">✓ {ar ? "هوية مؤكدة" : "Identity verified"}</MiniBadge></section><section className="content-card"><h2>{ar ? "ملخص المستفيد" : "Beneficiary overview"}</h2><div className="summary-facts summary-facts-4"><div><span>{ar ? "رقم الهوية" : "Identity number"}</span><strong dir="ltr">•••• •••• 4021</strong></div><div><span>{ar ? "قناة التواصل" : "Preferred channel"}</span><strong>{ar ? "داخل المنصة" : "In-app"}</strong></div><div><span>{ar ? "الخدمات المكتملة" : "Completed services"}</span><strong>4</strong></div><div><span>{ar ? "موافقات الاستخدام" : "Purpose consents"}</span><strong>3</strong></div></div></section></div>;
}

function FamilyView({ state }: { state: DemoState }) {
  const ar = state.language === "ar";
  return <section className="content-card family-360"><header><div><span className="eyebrow">{ar ? "FAM-4502 · أربعة أفراد" : "FAM-4502 · FOUR MEMBERS"}</span><h2>{ar ? "عرض الأسرة 360" : "Family 360"}</h2></div><MiniBadge tone="success">✓ {ar ? "العلاقات موثّقة" : "Links verified"}</MiniBadge></header><div className="family-tree"><div className="family-root"><span className="avatar avatar-large">زع</span><strong>{ar ? "زينب علي حسن" : "Zainab Ali Hassan"}</strong><small>{ar ? "المستفيدة الأساسية" : "Primary beneficiary"}</small></div><i /><div className="family-children">{[["مح", "مريم حيدر علي", "ابنة · طالبة جامعية"], ["عح", "علي حيدر علي", "ابن · طالب ثانوي"], ["سح", "سارة حيدر علي", "ابنة · مرحلة ابتدائية"]].map(([initials, name, detail], index) => <div key={name} className={index === 0 ? "selected" : ""}><span className="avatar">{initials}</span><strong>{name}</strong><small>{detail}</small>{index === 0 && <MiniBadge tone="gold">{ar ? "صاحبة الطلب" : "Applicant"}</MiniBadge>}</div>)}</div></div></section>;
}

function TaskView({ state, openTask }: { state: DemoState; openTask: (target: "overview" | "documents" | "eligibility") => void }) {
  const ar = state.language === "ar";
  return <section className="content-card task-list"><header><h2>{ar ? "المهام والموافقات" : "Tasks & approvals"}</h2><MiniBadge tone="info">3</MiniBadge></header>{[["✓", "فحص هوية المستفيدة", "أحمد كريم · مكتملة"], [state.case.documents.some((document) => document.type === "enrollment") ? "✓" : "!", "التحقق من تأييد الدراسة", state.case.documents.some((document) => document.type === "enrollment") ? "مكتملة" : "معلّقة"], ["○", "مراجعة توصية الإحالة", "بانتظار الموظف"]].map(([icon, title, detail], index) => <div key={title}><span>{icon}</span><p><strong>{title}</strong><small>{detail}</small></p><button onClick={() => openTask(index === 1 ? "documents" : index === 2 ? "eligibility" : "overview")}>فتح ←</button></div>)}</section>;
}

function CommunicationView({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(ar ? "متابعة المعاملة" : "Case follow-up");
  const [channel, setChannel] = useState<"in-app" | "sms" | "email">("in-app");
  const send = () => {
    if (!message.trim() || !subject.trim()) return;
    const now = new Date().toISOString();
    setState((previous) => ({ ...previous, notifications: [{ id: `staff-message-${Date.now()}`, titleAr: subject.trim(), titleEn: subject.trim(), bodyAr: message.trim(), bodyEn: message.trim(), at: now, read: false, channel }, ...previous.notifications] }));
    setMessage(""); setComposing(false); toast(ar ? "تم إرسال الرسالة وحفظها" : "Message sent and saved");
  };
  const templates = ar
    ? ["يرجى تزويدنا بالوثيقة المحددة لإكمال المراجعة.", "تمت مراجعة المرفقات، وسنوافيكم بتحديث بعد الإجراء التالي."]
    : ["Please provide the specified document to complete the review.", "The attachments were reviewed; we will update you after the next action."];
  return <section className="content-card communications"><header><div><h2>{ar ? "المراسلات" : "Communications"}</h2><small>{ar ? "رسائل مرتبطة بالمعاملة ومحفوظة في سجلها" : "Case-linked messages retained in its record"}</small></div><button className="button button-primary" onClick={() => setComposing((value) => !value)}>{composing ? (ar ? "إغلاق المحرر" : "Close composer") : (ar ? "رسالة جديدة" : "New message")} +</button></header>{composing && <div className="communication-composer"><div className="communication-composer-meta"><label><span>{ar ? "المستلم" : "Recipient"}</span><input value={ar ? state.case.citizenNameAr : state.case.citizenNameEn} readOnly /></label><label><span>{ar ? "القناة" : "Channel"}</span><select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}><option value="in-app">{ar ? "داخل المنصة" : "In-app"}</option><option value="sms">SMS</option><option value="email">Email</option></select></label></div><label className="communication-subject"><span>{ar ? "عنوان الرسالة" : "Subject"}</span><input maxLength={90} value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className="communication-message"><span>{ar ? "نص الرسالة" : "Message"}</span><textarea rows={5} maxLength={600} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); send(); } }} placeholder={ar ? "اكتب رسالة واضحة ومحددة مرتبطة بهذه المعاملة…" : "Write a clear, specific message linked to this case…"} /></label><div className="communication-templates"><span>{ar ? "عبارات مساعدة:" : "Quick text:"}</span>{templates.map((template) => <button key={template} onClick={() => setMessage(template)}>{template}</button>)}</div><footer><small>{message.length}/600 · {ar ? "Ctrl + Enter للإرسال" : "Ctrl + Enter to send"}</small><button className="button button-primary" disabled={!message.trim() || !subject.trim()} onClick={send}>{ar ? "إرسال وحفظ" : "Send and save"} ←</button></footer></div>}{state.notifications.slice(0, 6).map((notification) => <div key={notification.id}><span>{notification.channel === "sms" ? "▣" : notification.channel === "email" ? "✉" : "●"}</span><p><strong>{ar ? notification.titleAr : notification.titleEn}</strong><small>{ar ? notification.bodyAr : notification.bodyEn}</small></p><time>{localDate(notification.at, state.language)}</time></div>)}</section>;
}

function ManagerApprovals({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const [note, setNote] = useState("تمت مراجعة اكتمال عمل الموظف والتوصية والمراجع؛ أوافق على الإحالة إلى اللجنة المختصة.");
  const [confirmed, setConfirmed] = useState(false);
  const pending = [
    ...(state.case.status === "Manager Review" ? [{ id: state.case.id, serviceId: state.case.serviceId, status: state.case.status, recommendation: state.case.employeeRecommendation || "", documents: state.case.documents.length, primary: true }] : []),
    ...state.additionalApplications
      .filter((application) => application.status === "Manager Review")
      .map((application) => ({ id: application.id, serviceId: application.serviceId, status: application.status, recommendation: application.employeeRecommendation || "", documents: application.documentCount, primary: false })),
  ];
  const [selectedId, setSelectedId] = useState(pending[0]?.id || "");
  const active = pending.find((application) => application.id === selectedId) ?? pending[0];
  const activeService = services.find((service) => service.id === active?.serviceId) ?? services[0];
  const decide = (action: "committee" | "staff" | "reject") => {
    if (!confirmed || !note.trim() || !active) return;
    const now = new Date().toISOString();
    const target: ApplicationStatus = action === "committee" ? "Committee Review" : action === "staff" ? "Under Review" : "Rejected";
    setState((previous) => ({
      ...previous,
      case: active.primary ? { ...previous.case, status: target, managerApproved: action === "committee", updatedAt: now } : previous.case,
      additionalApplications: active.primary ? previous.additionalApplications : previous.additionalApplications.map((application) => application.id === active.id
        ? { ...application, status: target, managerApproved: action === "committee", committeeVotes: action === "committee" ? {} : application.committeeVotes, updatedAt: now }
        : application),
      committeeMembers: action === "committee" ? previous.committeeMembers.map((member) => ({ ...member, vote: undefined })) : previous.committeeMembers,
    }));
    addAudit(
      action === "committee" ? "اعتماد مدير المديرية وإحالة المعاملة إلى اللجنة" : action === "staff" ? "إعادة المعاملة إلى الموظف بملاحظة المدير" : "رفض المعاملة من مدير المديرية بسبب مسجل",
      action === "committee" ? "Directorate manager approved and referred the case to committee" : action === "staff" ? "Case returned to staff with manager feedback" : "Case rejected by the directorate manager with a recorded reason",
      "manager",
    );
    toast(action === "committee" ? (ar ? "وصلت المعاملة إلى اللجنة. بقيت في حساب المدير؛ بدّل المستخدم يدوياً للمتابعة." : "The case reached committee. You remain in the manager account; switch user manually to continue.") : action === "staff" ? (ar ? "عادت المعاملة إلى الموظف وبقيت في حساب المدير" : "The case returned to staff and you remain in the manager account") : (ar ? "سُجل الرفض وبقيت في حساب المدير" : "Rejection recorded; you remain in the manager account"));
    setConfirmed(false);
  };
  return <div className="page manager-approval-page">
    <SectionHeader eyebrow={ar ? "بوابة الاعتماد الإداري" : "MANAGER REVIEW GATE"} title={ar ? "الموظف يوصي، والمدير يراجع قبل اللجنة." : "Staff recommend; the manager reviews before committee."} description={ar ? "هذه المرحلة تمنع الانتقال المباشر من الموظف إلى اللجنة وتظهر اكتمال العمل البشري." : "This gate prevents direct staff-to-committee routing and exposes the completed human work."} />
    {!active ? <div className="empty-state"><span>✓</span><h3>{ar ? "لا توجد معاملة بانتظار اعتماد المدير" : "No case awaits manager approval"}</h3><p>{ar ? "تظهر هنا فقط المعاملات التي أنهى الموظف مراجعتها وأرسل توصيته." : "Only cases with a completed staff review and recommendation appear here."}</p><button className="button button-secondary" onClick={() => navigate("/manager")}>{ar ? "العودة للوحة المدير" : "Back to manager dashboard"}</button></div> : <>
      {pending.length > 1 && <div className="table-tabs">{pending.map((application) => <button key={application.id} className={active.id === application.id ? "active" : ""} onClick={() => { setSelectedId(application.id); setConfirmed(false); }}><span dir="ltr">{application.id}</span></button>)}</div>}
      <div className="manager-approval-grid">
      <section className="content-card approval-case-pack"><header><div><span className="eyebrow">{active.id}</span><h2>{ar ? activeService.titleAr : activeService.titleEn}</h2></div><StatusBadge status={active.status} language={state.language} /></header><div className="approval-case-facts">{[
        [ar ? "المواطن" : "Citizen", ar ? state.citizenProfile.fullNameAr : state.citizenProfile.fullNameEn],
        [ar ? "الموظف" : "Staff owner", ar ? "أحمد كريم محمود" : "Ahmed Kareem Mahmoud"],
        [ar ? "الوثائق" : "Documents", `${active.documents}/${active.documents}`],
        [ar ? "المهلة" : "SLA", `${num(active.primary ? state.case.slaHoursRemaining : state.additionalApplications.find((item) => item.id === active.id)?.slaHoursRemaining || 0, state.language)} ${ar ? "ساعة" : "hours"}`],
      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><article className="staff-recommendation"><span>✓</span><div><small>{ar ? "توصية الموظف المؤكدة" : "CONFIRMED STAFF RECOMMENDATION"}</small><p>{active.recommendation}</p></div></article>{active.primary && <button className="text-button" onClick={() => navigate(`/staff/cases/${state.case.id}/recommendation`)}>{ar ? "فتح شاشة التوصية والمراجع" : "Open recommendation and sources"} ←</button>}</section>
      <section className="content-card approval-decision"><span className="eyebrow">{ar ? "قرار مدير المديرية" : "DIRECTORATE MANAGER ACTION"}</span><h2>{ar ? "تحقق من اكتمال عمل الموظف" : "Confirm staff work is complete"}</h2><div className="approval-checks"><span>✓ {ar ? "المواطن أرسل طلباً مكتملاً" : "Citizen submitted a complete application"}</span><span>✓ {ar ? "الموظف راجع الوثائق والقواعد" : "Staff reviewed evidence and rules"}</span><span>✓ {ar ? "التوصية مسببة ومسجلة" : "Recommendation is reasoned and logged"}</span><span>✓ {ar ? "الضوابط الحاجبة معالجة" : "Blocking controls are resolved"}</span></div><label className="input-field"><span>{ar ? "ملاحظة قرار المدير *" : "Manager decision note *"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><label className="registration-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>{ar ? "أؤكد أنني راجعت المعاملة بصورة مستقلة" : "I confirm my independent review"}</strong><small>{ar ? "اعتماد المدير لا يحل محل قرار اللجنة النهائي." : "Manager approval does not replace the final committee decision."}</small></span></label><div className="human-action-grid"><button className="button button-secondary" disabled={!confirmed || !note.trim()} onClick={() => decide("staff")}>↩ {ar ? "إعادة للموظف" : "Return to staff"}</button><button className="button button-danger" disabled={!confirmed || !note.trim()} onClick={() => decide("reject")}>× {ar ? "رفض مسبب" : "Reject"}</button><button className="button button-primary" disabled={!confirmed || !note.trim()} onClick={() => decide("committee")}>{ar ? "اعتماد وإحالة للجنة" : "Approve and refer"} ←</button></div></section>
      </div></>}
  </div>;
}

function CitizenEligibilityCheck({ state, serviceId, navigate, toast, addAudit }: { state: DemoState; serviceId: string; navigate: (path: string) => void; toast: (message: string) => void; addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void }) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const category = citizenCategory(state.citizenProfile.category);
  const [checked, setChecked] = useState(false);
  const rules = [
    { id: "account", passed: state.citizenProfile.registered, titleAr: "حساب المواطن مسجل", titleEn: "Citizen account is registered", detailAr: "الحساب مرتبط بملف المستفيد التجريبي.", detailEn: "The account is linked to the demo beneficiary profile." },
    { id: "classification", passed: service.audiences?.includes(state.citizenProfile.category) ?? false, titleAr: "التصنيف متوافق مع الخدمة", titleEn: "Profile classification matches the service", detailAr: `${category.labelAr} ← ${service.categoryAr}`, detailEn: `${category.labelEn} ← ${service.category}` },
    { id: "reference", passed: Boolean(state.citizenProfile.referenceNumber.trim()), titleAr: "مرجع ملف المستفيد متوفر", titleEn: "Beneficiary reference is available", detailAr: state.citizenProfile.referenceNumber || "غير متوفر", detailEn: state.citizenProfile.referenceNumber || "Not available" },
  ];
  const eligible = rules.every((rule) => rule.passed);
  const nextRoute = service.feeIqd > 0 ? `/citizen/payments/${service.id}` : `/citizen/applications/new/${service.id}`;
  const runCheck = () => {
    setChecked(true);
    addAudit("تشغيل التحقق الأولي من الأهلية قبل بدء الطلب", "Preliminary eligibility check run before starting the application", "system");
    toast(eligible ? (ar ? "اكتمل التحقق الأولي — يمكنك متابعة الطلب" : "Initial check complete — you may continue") : (ar ? "تحتاج البيانات إلى استكمال أو مراجعة" : "The profile needs completion or review"));
  };
  const continueJourney = () => {
    if (!checked || !eligible) return;
    addAudit(service.feeIqd > 0 ? "توجيه المواطن إلى دفع رسوم الخدمة المهيأة" : "الخدمة دون رسوم؛ توجيه المواطن إلى نموذج الطلب", service.feeIqd > 0 ? "Citizen routed to the configured service fee" : "No fee applies; citizen routed to the application form", "system");
    navigate(nextRoute);
  };
  return <div className="page citizen-eligibility-page">
    <SectionHeader eyebrow={ar ? "بوابة المواطنين · فحص قبل التقديم" : "CITIZEN PORTAL · PRE-APPLICATION CHECK"} title={ar ? "التحقق الأولي من الأهلية" : "Initial eligibility check"} description={ar ? "فحص مبدئي قبل فتح نموذج الطلب اعتماداً على الملف ونوع الخدمة. النتيجة لا تمنح استحقاقاً ولا تستبدل مراجعة الموظف واللجنة." : "A preliminary check before opening the application, based on the profile and service. It does not grant entitlement or replace staff and committee review."} />
    <div className="citizen-eligibility-grid">
      <section className="content-card eligibility-service-card"><header><span className="service-icon service-icon-1">◇</span><div><small>{ar ? "الخدمة المختارة" : "SELECTED SERVICE"}</small><h2>{ar ? service.titleAr : service.titleEn}</h2><p>{ar ? service.descriptionAr : service.descriptionEn}</p></div></header><div className="eligibility-profile-summary"><div><span>{ar ? "تصنيف الملف" : "Profile category"}</span><strong>{ar ? category.labelAr : category.labelEn}</strong></div><div><span>{ar ? "مرجع المستفيد" : "Beneficiary reference"}</span><strong dir="ltr">{state.citizenProfile.referenceNumber}</strong></div><div><span>{ar ? "الرسوم المهيأة" : "Configured fee"}</span><strong>{service.feeIqd > 0 ? `${num(service.feeIqd, state.language)} ${ar ? "د.ع" : "IQD"}` : (ar ? "لا توجد رسوم" : "No fee")}</strong></div></div><button className="button button-secondary button-full" onClick={() => navigate(`/services/${service.id}`)}>{ar ? "العودة إلى تفاصيل الخدمة" : "Back to service details"}</button></section>
      <section className="content-card eligibility-check-card"><header><div><span className="eyebrow">PRE-CHECK · v1.0</span><h2>{checked ? (eligible ? (ar ? "مؤهل مبدئياً للمتابعة" : "Preliminarily eligible to continue") : (ar ? "تحتاج مراجعة" : "Review required")) : (ar ? "جاهز لتشغيل الفحص" : "Ready to run the check")}</h2></div><MiniBadge tone={!checked ? "neutral" : eligible ? "success" : "danger"}>{!checked ? (ar ? "لم يُشغّل" : "Not run") : eligible ? (ar ? "اجتاز" : "Passed") : (ar ? "غير مكتمل" : "Incomplete")}</MiniBadge></header><div className="precheck-rules">{rules.map((rule) => <div key={rule.id} className={checked ? (rule.passed ? "passed" : "failed") : "pending"}><span>{!checked ? "○" : rule.passed ? "✓" : "!"}</span><p><strong>{ar ? rule.titleAr : rule.titleEn}</strong><small>{ar ? rule.detailAr : rule.detailEn}</small></p></div>)}<div className="manual-review-rule"><span>◇</span><p><strong>{ar ? "الاستحقاق النهائي مراجعة بشرية" : "Final entitlement requires human review"}</strong><small>{ar ? "الموظف ثم مدير المديرية ثم اللجنة حسب مسار الخدمة." : "Staff, then directorate manager, then committee according to the service workflow."}</small></p></div></div><div className="eligibility-actions"><button className="button button-secondary" onClick={runCheck}>↻ {checked ? (ar ? "إعادة التحقق" : "Run again") : (ar ? "تشغيل التحقق" : "Run check")}</button><button className="button button-primary" disabled={!checked || !eligible} onClick={continueJourney}>{service.feeIqd > 0 ? (ar ? "متابعة إلى دفع الرسوم" : "Continue to fee payment") : (ar ? "متابعة إلى نموذج الطلب" : "Continue to application")} ←</button></div><div className="legal-demo-banner">! <strong>{ar ? "هذه أهلية أولية إرشادية وليست قرار شمول أو استحقاق." : "This is an indicative preliminary result, not an inclusion or entitlement decision."}</strong></div></section>
    </div>
  </div>;
}

function UnifiedNotificationsPage({ state, setState, navigate, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; navigate: (path: string) => void; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const [roleRead, setRoleRead] = useState<string[]>([]);
  const roleItems = [
    { id: `${state.persona}-task`, titleAr: "مهمة جديدة تحتاج إجراء", titleEn: "A new task needs action", bodyAr: "افتح المهمة لمراجعة التفاصيل والمهلة والمسؤول الحالي.", bodyEn: "Open the task to review details, SLA and current owner.", critical: false, route: personas.find((item) => item.id === state.persona)?.home ?? "/", channel: "in-app" as const, at: "2026-08-05T09:15:00.000Z" },
    { id: `${state.persona}-sla`, titleAr: "تنبيه مهلة تشغيلية", titleEn: "Operational SLA alert", bodyAr: "توجد معاملة تقترب من حد التصعيد وتحتاج متابعة بشرية.", bodyEn: "A case is nearing escalation and needs human follow-up.", critical: true, route: state.persona === "manager" ? "/manager" : personas.find((item) => item.id === state.persona)?.home ?? "/", channel: "in-app" as const, at: "2026-08-05T08:40:00.000Z" },
    { id: `${state.persona}-policy`, titleAr: "تحديث إجرائي تجريبي", titleEn: "Demo procedure update", bodyAr: "تم تحديث قالب الإشعار دون تغيير أي قرار أو استحقاق.", bodyEn: "The notification template was updated without changing any decision or entitlement.", critical: false, route: state.persona === "admin" ? "/studio/notifications" : personas.find((item) => item.id === state.persona)?.home ?? "/", channel: "email" as const, at: "2026-08-04T14:20:00.000Z" },
  ];
  const items = state.persona === "citizen"
    ? state.notifications.map((item) => ({ ...item, unread: !item.read, critical: item.id.includes("completion"), route: item.id.includes("completion") || item.id.includes("feedback") ? `/citizen/applications/${state.case.id}` : "/citizen" }))
    : roleItems.map((item) => ({ ...item, unread: !roleRead.includes(item.id) }));
  const visible = items.filter((item) => filter === "all" || (filter === "unread" ? item.unread : item.critical));
  const markAll = () => {
    if (state.persona === "citizen") setState((previous) => ({ ...previous, notifications: previous.notifications.map((item) => ({ ...item, read: true })) }));
    else setRoleRead(roleItems.map((item) => item.id));
    toast(ar ? "تم تحديد كل الإشعارات كمقروءة" : "All notifications marked read");
  };
  const open = (id: string, route: string) => {
    if (state.persona === "citizen") setState((previous) => ({ ...previous, notifications: previous.notifications.map((item) => item.id === id ? { ...item, read: true } : item) }));
    else setRoleRead((current) => [...new Set([...current, id])]);
    navigate(route);
  };
  return <div className="page manager-notifications-page"><SectionHeader eyebrow={ar ? `${personas.find((item) => item.id === state.persona)?.labelAr} · مركز الإشعارات` : `${personas.find((item) => item.id === state.persona)?.labelEn} · NOTIFICATION CENTRE`} title={ar ? "كل تنبيه في مكان واحد وبنفس التجربة." : "Every alert in one consistent experience."} description={ar ? "فرز، حالة قراءة، قناة، وقت، وانتقال مباشر للإجراء المطلوب." : "Filtering, read state, channel, time and direct navigation to the required action."} action={<button className="button button-secondary" onClick={markAll}>✓ {ar ? "تحديد الكل كمقروء" : "Mark all read"}</button>} /><div className="manager-notification-summary"><div><span>{ar ? "غير مقروءة" : "Unread"}</span><strong>{items.filter((item) => item.unread).length}</strong></div><div><span>{ar ? "حرجة" : "Critical"}</span><strong>{items.filter((item) => item.critical).length}</strong></div><div><span>{ar ? "الإجمالي" : "Total"}</span><strong>{items.length}</strong></div></div><div className="manager-notification-filters">{[["all","الكل","All"],["unread","غير المقروءة","Unread"],["critical","الحرجة","Critical"]].map(([id,labelAr,labelEn]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id as typeof filter)}>{ar ? labelAr : labelEn}</button>)}</div><section className="manager-notification-list">{visible.map((item) => <button key={item.id} className={`${item.unread ? "unread" : ""} ${item.critical ? "notification-critical" : "notification-info"}`} onClick={() => open(item.id, item.route)}><span>{item.critical ? "!" : item.channel === "email" ? "✉" : "●"}</span><div><strong>{ar ? item.titleAr : item.titleEn}</strong><p>{ar ? item.bodyAr : item.bodyEn}</p><small>{localDate(item.at, state.language)} · {item.channel}</small></div><i>{ar ? "فتح" : "Open"} ←</i></button>)}{visible.length === 0 && <div className="empty-state compact"><span>✓</span><h3>{ar ? "لا توجد إشعارات ضمن هذا الفلتر" : "No notifications match this filter"}</h3></div>}</section></div>;
}

function ManagerDashboard({ state, navigate, toast }: { state: DemoState; navigate: (path: string) => void; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [period, setPeriod] = useState<"30" | "7" | "today">("30");
  const [nudged, setNudged] = useState<string[]>([]);
  const [reassignMode, setReassignMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const periodFactor = period === "30" ? 1 : period === "7" ? 0.42 : 0.12;
  const applications = [
    { id: state.case.id, serviceId: state.case.serviceId, status: state.case.status, sla: state.case.slaHoursRemaining },
    ...state.additionalApplications.map((application) => ({ id: application.id, serviceId: application.serviceId, status: application.status, sla: application.slaHoursRemaining })),
  ];
  const closedStatuses: ApplicationStatus[] = ["Approved", "Rejected", "Completed", "Closed", "Cancelled"];
  const openApplications = applications.filter((application) => !closedStatuses.includes(application.status));
  const managerApprovals = applications.filter((application) => application.status === "Manager Review");
  const slaRisk = openApplications.filter((application) => application.sla < 24);
  const unassigned = openApplications.filter((application) => application.status === "Submitted");
  const visibleOpen = Math.max(openApplications.length, Math.round(42 * periodFactor));
  const staff = [
    { name: "أحمد كريم", role: ar ? "موظف معاملات أول" : "Senior case officer", tasks: Math.max(1, Math.round(12 * periodFactor)), quality: 94, risk: 2, status: "busy" as const },
    { name: "نور علي", role: ar ? "موظفة تدقيق وثائق" : "Document review officer", tasks: Math.max(1, Math.round(9 * periodFactor)), quality: 97, risk: 1, status: "available" as const },
    { name: "محمد جاسم", role: ar ? "موظف خدمات" : "Service officer", tasks: Math.max(1, Math.round(14 * periodFactor)), quality: 88, risk: 4, status: "risk" as const },
    { name: "سجى فاضل", role: ar ? "موظفة جودة" : "Quality officer", tasks: Math.max(1, Math.round(7 * periodFactor)), quality: 99, risk: 0, status: "available" as const },
  ];
  const serviceGroups = services.slice(0, 4).map((service) => ({
    service,
    count: applications.filter((application) => application.serviceId === service.id).length,
  }));
  return (
    <div className="page manager-page">
      <SectionHeader eyebrow={ar ? "مديرية بغداد" : "BAGHDAD DIRECTORATE"} title={ar ? "العمل المتوازن يحمي المهلة وجودة القرار." : "Balanced work protects SLA and decision quality."} description={reassignMode ? (ar ? `اختر موظفاً لإعادة التوزيع${selectedStaff ? `: ${selectedStaff}` : ""}` : `Select staff for reassignment${selectedStaff ? `: ${selectedStaff}` : ""}`) : (ar ? "صورة تشغيلية لحظية لفريق المعاملات." : "A live operational view of the service team.")} action={<><label className="compact-filter"><span>{ar ? "الفترة" : "Period"}</span><select value={period} onChange={(event) => setPeriod(event.target.value as "30" | "7" | "today")}><option value="30">{ar ? "آخر ٣٠ يوماً" : "Last 30 days"}</option><option value="7">{ar ? "آخر ٧ أيام" : "Last 7 days"}</option><option value="today">{ar ? "اليوم" : "Today"}</option></select></label><button className="button button-primary" onClick={() => { setReassignMode((value) => !value); if (reassignMode) setSelectedStaff(""); }}>{reassignMode ? (ar ? "إنهاء إعادة التوزيع" : "Finish reassignment") : (ar ? "إعادة توزيع" : "Reassign work")} ↔</button></>} />
      <section className="directorate-status-card">
        <div className="directorate-health"><span className={slaRisk.length > 2 ? "risk" : "healthy"}>●</span><div><small>{ar ? "حالة المديرية الآن" : "DIRECTORATE STATUS NOW"}</small><strong>{slaRisk.length > 2 ? (ar ? "تحتاج تدخل المدير" : "Manager attention needed") : (ar ? "مستقرة وتحت السيطرة" : "Stable and controlled")}</strong><p>{ar ? `${staff.filter((member) => member.status === "available").length} موظفين متاحين · ${managerApprovals.length} قرارات عند المدير` : `${staff.filter((member) => member.status === "available").length} staff available · ${managerApprovals.length} manager decisions`}</p></div></div>
        <div className="directorate-status-facts"><div><span>{ar ? "المعاملات النشطة" : "Active cases"}</span><strong>{visibleOpen}</strong><small>{ar ? `${openApplications.length} منها مرتبطة بسيناريو العرض` : `${openApplications.length} tied to the demo journey`}</small></div><div><span>{ar ? "الفريق المتاح" : "Available team"}</span><strong>{staff.filter((member) => member.status === "available").length}/{staff.length}</strong><small>{ar ? "الحضور التشغيلي الحالي" : "Current operational availability"}</small></div><div><span>{ar ? "القرار التالي" : "Next decision"}</span><strong>{managerApprovals.length ? managerApprovals[0].id : "—"}</strong><small>{managerApprovals.length ? (ar ? "جاهز لمراجعة المدير" : "Ready for manager review") : (ar ? "لا يوجد قرار معلق" : "No decision pending")}</small></div></div>
      </section>
      <div className="metric-grid metric-grid-5"><MetricCard label={ar ? "المهام المفتوحة" : "Open tasks"} value={num(visibleOpen, state.language)} trend={ar ? `ضمن فترة ${period === "today" ? "اليوم" : `${period} يوماً`}` : `Within ${period === "today" ? "today" : `${period} days`}`} icon="▤" /><MetricCard label={ar ? "وارد جديد" : "New intake"} value={num(unassigned.length, state.language)} trend={ar ? "جاهز للتوزيع" : "Ready for assignment"} icon="○" tone="gold" /><MetricCard label={ar ? "خطر المهلة" : "SLA risk"} value={num(slaRisk.length, state.language)} trend={slaRisk.length ? (ar ? "تحتاج متابعة" : "Needs follow-up") : (ar ? "لا توجد حالات حرجة" : "No critical cases")} icon="◷" tone="red" onClick={() => navigate("/staff/inbox")} /><MetricCard label={ar ? "جودة الفريق" : "Team quality"} value={`${Math.round(staff.reduce((total, member) => total + member.quality, 0) / staff.length)}%`} trend={ar ? "متوسط الموظفين" : "Staff average"} icon="✓" tone="navy" /><MetricCard label={ar ? "موافقاتي" : "My approvals"} value={num(managerApprovals.length, state.language)} trend={ar ? "مرتبطة بصلاحيتي" : "Assigned to my authority"} icon="◇" onClick={() => navigate("/manager/tasks")} /></div>
      <section className="manager-grid">
        <article className="content-card workload-chart"><header><div><span className="eyebrow">{ar ? "الموظفون وحالة العمل" : "STAFF & WORK STATUS"}</span><h2>{ar ? "من متاح؟ ومن يحتاج تدخلاً؟" : "Who is available and who needs support?"}</h2></div><MiniBadge tone="info">{staff.length} {ar ? "موظفين" : "employees"}</MiniBadge></header>{staff.map((member) => <div key={member.name} className={selectedStaff === member.name ? "selected" : ""}><span className="avatar">{member.name.split(" ").map((part) => part[0]).join("")}</span><p><strong>{member.name}</strong><small>{member.role} · {member.tasks} {ar ? "مهمة" : "tasks"} · {member.quality}%</small></p><div className="workload-bar"><i style={{ width: `${Math.min(member.tasks * 7, 100)}%` }} /></div><MiniBadge tone={member.status === "risk" ? "warning" : member.status === "available" ? "success" : "info"}>{member.status === "risk" ? (ar ? "يحتاج دعم" : "Needs support") : member.status === "available" ? (ar ? "متاح" : "Available") : (ar ? "مشغول" : "Busy")}</MiniBadge><button disabled={!reassignMode} onClick={() => { setSelectedStaff(member.name); toast(ar ? `تم اختيار ${member.name} لإعادة التوزيع` : `${member.name} selected for reassignment`); }}>↔</button></div>)}</article>
        <article className="content-card directorate-services"><header><div><span className="eyebrow">{ar ? "حالة الخدمات" : "SERVICE STATUS"}</span><h2>{ar ? "توزيع معاملات المديرية" : "Directorate case distribution"}</h2></div></header>{serviceGroups.map(({ service, count }) => <div key={service.id}><span className={`service-icon service-icon-${(services.indexOf(service) % 4) + 1}`}>◇</span><p><strong>{ar ? service.titleAr : service.titleEn}</strong><small>{ar ? service.categoryAr : service.category}</small></p><b>{count}</b><MiniBadge tone={count ? "info" : "neutral"}>{count ? (ar ? "نشطة" : "Active") : (ar ? "لا يوجد وارد" : "No intake")}</MiniBadge></div>)}</article>
      </section>
      <section className="content-card manager-task-oversight">
        <header><div><span className="eyebrow">{ar ? "مهامي ومهام فريقي" : "MY TASKS & TEAM FOLLOW-UP"}</span><h2>{ar ? "ما الذي يجب أن أنجزه؟ وأين تأخر الموظفون؟" : "What must I do, and where is the team delayed?"}</h2></div><button className="text-button" onClick={() => navigate("/manager/tasks")}>{ar ? "فتح صفحة مهامي" : "Open my tasks"} ←</button></header>
        <div className="manager-task-columns">
          <div><h3>{ar ? "مهام المدير" : "Manager tasks"}</h3>{managerApprovals.length ? managerApprovals.map((application) => <button key={application.id} onClick={() => navigate("/manager/approvals")}><span>◇</span><p><strong>{ar ? `مراجعة توصية ${application.id}` : `Review recommendation ${application.id}`}</strong><small>{ar ? "جاهزة الآن لاتخاذ قرار" : "Ready for a decision now"}</small></p><i className="dir-icon" aria-hidden="true">←</i></button>) : <div className="empty-state compact"><span>✓</span><p>{ar ? "لا توجد موافقة معلقة عليك الآن" : "No approval is currently assigned to you"}</p></div>}</div>
          <div><h3>{ar ? "مهام غير مكتملة لدى الموظفين" : "Incomplete staff tasks"}</h3>{[
            ["EMP-201", "أحمد كريم", ar ? "تأكيد ختم وثيقة" : "Verify document seal", ar ? "متأخرة ساعتين" : "2 hours overdue"],
            ["EMP-204", "محمد جاسم", ar ? "كتابة توصية مسببة" : "Write reasoned recommendation", ar ? "خطر مهلة" : "SLA risk"],
            ["EMP-209", "نور علي", ar ? "إغلاق ملاحظة جودة بيانات" : "Resolve data-quality note", ar ? "متبقي ٣ ساعات" : "3 hours left"],
          ].map(([id,name,title,meta]) => <div key={id}><span className="avatar">{name.split(" ").map((part) => part[0]).join("")}</span><p><strong>{title}</strong><small>{name} · {meta}</small></p><button disabled={nudged.includes(id)} onClick={() => { setNudged((current) => [...current, id]); toast(ar ? `تم تنبيه ${name}` : `${name} was notified`); }}>{nudged.includes(id) ? (ar ? "تم التنبيه ✓" : "Notified ✓") : (ar ? "تنبيه الموظف" : "Notify")}</button></div>)}</div>
        </div>
      </section>
      <section className="content-card manager-alerts"><header><h2>{ar ? "المعاملات التي تحتاج قرارك" : "Cases needing your decision"}</h2><button className="text-button" onClick={() => navigate("/manager/approvals")}>{ar ? "فتح الموافقات" : "Open approvals"} ←</button></header>{managerApprovals.length ? managerApprovals.map((application) => <div key={application.id}><strong dir="ltr">{application.id}</strong><p>{ar ? "مراجعة توصية الموظف وإقرار الإحالة" : "Review staff recommendation and decide referral"}</p><MiniBadge tone="warning">{ar ? "جاهزة" : "Ready"}</MiniBadge><span>{Math.max(0, application.sla)}h</span><button onClick={() => navigate("/manager/approvals")}>{ar ? "مراجعة" : "Review"} ←</button></div>) : <div className="empty-state compact"><span>✓</span><h3>{ar ? "لا توجد معاملة بانتظار قرار المدير" : "No case awaits a manager decision"}</h3></div>}</section>
    </div>
  );
}

function ManagerTasksPage({ state, navigate, toast }: { state: DemoState; navigate: (path: string) => void; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [filter, setFilter] = useState<"all" | "decisions" | "oversight">("all");
  const [completed, setCompleted] = useState<string[]>([]);
  const [nudged, setNudged] = useState<string[]>([]);
  const decisionCases = [
    ...(state.case.status === "Manager Review" ? [{ id: state.case.id, sla: state.case.slaHoursRemaining }] : []),
    ...state.additionalApplications.filter((application) => application.status === "Manager Review").map((application) => ({ id: application.id, sla: application.slaHoursRemaining })),
  ];
  const oversightTasks = [
    { id: "MGR-DAY-01", titleAr: "مراجعة توزيع أحمال الفريق", titleEn: "Review team workload distribution", dueAr: "قبل نهاية اليوم", dueEn: "Before end of day" },
    { id: "MGR-SLA-02", titleAr: "اعتماد معالجة حالات خطر المهلة", titleEn: "Authorize SLA-risk treatment", dueAr: "متبقي ساعتان", dueEn: "2 hours left" },
    { id: "MGR-QA-03", titleAr: "مراجعة ملخص جودة القرارات الأسبوعي", titleEn: "Review weekly decision-quality summary", dueAr: "هذا الأسبوع", dueEn: "This week" },
  ];
  const total = decisionCases.length + oversightTasks.length;
  return <div className="page manager-tasks-page">
    <SectionHeader eyebrow={ar ? "مديرية بغداد · مهام المدير" : "BAGHDAD DIRECTORATE · MANAGER TASKS"} title={ar ? "المهام التي تقع على صلاحيتي كمدير" : "Tasks assigned to my manager authority"} description={ar ? "تفصل قرارات المعاملات عن مهام الإشراف، وتوضح الاستحقاق والإجراء التالي." : "Separates case decisions from oversight work and exposes due dates and next actions."} action={<button className="button button-secondary" onClick={() => navigate("/manager")}>{ar ? "العودة لحالة المديرية" : "Back to directorate status"} ←</button>} />
    <div className="metric-grid metric-grid-4"><MetricCard label={ar ? "إجمالي مهامي" : "My total tasks"} value={num(total, state.language)} icon="▤" /><MetricCard label={ar ? "قرارات معاملات" : "Case decisions"} value={num(decisionCases.length, state.language)} icon="◇" tone="gold" /><MetricCard label={ar ? "مهام إشراف" : "Oversight tasks"} value={num(oversightTasks.length, state.language)} icon="⌁" tone="navy" /><MetricCard label={ar ? "أنجزتها هنا" : "Completed here"} value={num(completed.length, state.language)} icon="✓" /></div>
    <div className="manager-notification-filters">{[["all", "الكل", "All"], ["decisions", "قرارات المعاملات", "Case decisions"], ["oversight", "الإشراف", "Oversight"]].map(([id, labelAr, labelEn]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id as typeof filter)}>{ar ? labelAr : labelEn}</button>)}</div>
    <section className="manager-owned-task-list">
      {(filter === "all" || filter === "decisions") && decisionCases.map((application) => <article key={application.id}><span className="manager-task-icon">◇</span><div><MiniBadge tone="warning">{ar ? "قرار معاملة" : "CASE DECISION"}</MiniBadge><h3>{ar ? `مراجعة وإقرار ${application.id}` : `Review and decide ${application.id}`}</h3><p>{ar ? "راجع توصية الموظف ثم أعدها أو ارفضها أو أحلها إلى اللجنة." : "Review the staff recommendation, then return, reject or refer it to committee."}</p></div><time>{application.sla}h</time><button className="button button-primary" onClick={() => navigate("/manager/approvals")}>{ar ? "اتخاذ القرار" : "Decide"} ←</button></article>)}
      {(filter === "all" || filter === "oversight") && oversightTasks.map((task) => <article key={task.id} className={completed.includes(task.id) ? "completed" : ""}><span className="manager-task-icon">⌁</span><div><MiniBadge tone={completed.includes(task.id) ? "success" : "info"}>{completed.includes(task.id) ? (ar ? "مكتملة" : "COMPLETED") : (ar ? "مهمة إشراف" : "OVERSIGHT")}</MiniBadge><h3>{ar ? task.titleAr : task.titleEn}</h3><p>{ar ? task.dueAr : task.dueEn}</p></div><time dir="ltr">{task.id}</time><button className="button button-secondary" disabled={completed.includes(task.id)} onClick={() => { setCompleted((current) => [...current, task.id]); toast(ar ? "تم تسجيل إنجاز مهمة المدير" : "Manager task completion recorded"); }}>{completed.includes(task.id) ? (ar ? "تم الإنجاز ✓" : "Completed ✓") : (ar ? "تسجيل الإنجاز" : "Mark complete")}</button></article>)}
      {filter === "decisions" && decisionCases.length === 0 && <div className="empty-state"><span>✓</span><h3>{ar ? "لا توجد قرارات معلقة عليك" : "No decisions are pending for you"}</h3></div>}
    </section>
    <section className="content-card manager-team-followup"><header><div><span className="eyebrow">{ar ? "متابعة الفريق" : "TEAM FOLLOW-UP"}</span><h2>{ar ? "مهام متوقفة عند الموظفين" : "Tasks waiting with staff"}</h2></div></header>{[["EMP-201", "أحمد كريم", "تأكيد ختم وثيقة"], ["EMP-204", "محمد جاسم", "كتابة توصية مسببة"], ["EMP-209", "نور علي", "إغلاق ملاحظة جودة بيانات"]].map(([id, name, task]) => <div key={id}><span className="avatar">{name.split(" ").map((part) => part[0]).join("")}</span><p><strong>{task}</strong><small>{name} · {id}</small></p><button disabled={nudged.includes(id)} onClick={() => { setNudged((current) => [...current, id]); toast(ar ? `تم تنبيه ${name}` : `${name} was notified`); }}>{nudged.includes(id) ? (ar ? "تم التنبيه ✓" : "Notified ✓") : (ar ? "تنبيه" : "Notify")}</button></div>)}</section>
  </div>;
}

// Kept as a visual fallback for older saved demo routes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ManagerNotifications({
  state,
  navigate,
  toast,
}: {
  state: DemoState;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const [items, setItems] = useState([
    {
      id: "manager-sla",
      titleAr: "ثلاث حالات دخلت نطاق الخطر",
      titleEn: "Three cases entered SLA risk",
      bodyAr: "تحتاج حالات مديرية بغداد إلى إعادة توزيع قبل نهاية اليوم.",
      bodyEn: "Baghdad Directorate cases need reassignment before end of day.",
      tone: "critical" as const,
      atAr: "منذ ١٢ دقيقة",
      atEn: "12 minutes ago",
      unread: true,
      route: "/staff/inbox",
    },
    {
      id: "manager-unassigned",
      titleAr: "ست مهام ما زالت غير معيّنة",
      titleEn: "Six tasks remain unassigned",
      bodyAr: "زاد الوارد في خدمات التعليم والصحة خلال الساعتين الماضيتين.",
      bodyEn: "Education and health intake increased during the last two hours.",
      tone: "warning" as const,
      atAr: "منذ ٢٥ دقيقة",
      atEn: "25 minutes ago",
      unread: true,
      route: "/staff/inbox",
    },
    {
      id: "manager-approval",
      titleAr: "موافقة استثناء بانتظار قرارك",
      titleEn: "Exception approval awaits your decision",
      bodyAr: "المعاملة MF-2026-10180 تتطلب مراجعة استثناء وثيقة.",
      bodyEn: "Case MF-2026-10180 requires a document exception review.",
      tone: "warning" as const,
      atAr: "منذ ساعة",
      atEn: "1 hour ago",
      unread: true,
      route: "/manager/approvals",
    },
    {
      id: "manager-integration",
      titleAr: "تأخر استجابة تكامل التعليم العالي",
      titleEn: "Higher Education integration is delayed",
      bodyAr: "ارتفع متوسط الاستجابة إلى ١٨٤٠ مللي ثانية مع ثلاث إعادات محاولة.",
      bodyEn: "Average latency reached 1840 ms with three retries.",
      tone: "critical" as const,
      atAr: "منذ ساعتين",
      atEn: "2 hours ago",
      unread: false,
      route: "/studio/integrations",
    },
    {
      id: "manager-quality",
      titleAr: "تحسن امتثال المهلة هذا الأسبوع",
      titleEn: "SLA compliance improved this week",
      bodyAr: "ارتفع امتثال الفريق ٢٫١ نقطة بعد إعادة توزيع الأحمال.",
      bodyEn: "Team compliance rose 2.1 points after workload rebalancing.",
      tone: "info" as const,
      atAr: "أمس",
      atEn: "Yesterday",
      unread: false,
      route: "/manager",
    },
  ]);
  const visible = items.filter((item) =>
    filter === "all"
      ? true
      : filter === "unread"
        ? item.unread
        : item.tone === "critical",
  );
  const openItem = (id: string, route: string) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, unread: false } : item,
      ),
    );
    toast(ar ? "تم فتح الإشعار وتحديث حالة القراءة" : "Notification opened and marked read");
    navigate(route);
  };
  return (
    <div className="page manager-notifications-page">
      <SectionHeader
        eyebrow={ar ? "مديرية بغداد · مركز التنبيه" : "BAGHDAD DIRECTORATE · ALERT CENTRE"}
        title={ar ? "إشعارات تشغيلية تحتاج انتباه المدير." : "Operational notifications needing manager attention."}
        description={ar ? "المهلة، الأحمال، الموافقات وصحة التكامل في قائمة قابلة للفرز والمتابعة." : "SLA, workload, approvals and integration health in one actionable list."}
        action={
          <button
            className="button button-secondary"
            onClick={() => {
              setItems((previous) =>
                previous.map((item) => ({ ...item, unread: false })),
              );
              toast(ar ? "تم تحديد كل إشعارات المدير كمقروءة" : "All manager notifications marked read");
            }}
          >
            ✓ {ar ? "تحديد الكل كمقروء" : "Mark all read"}
          </button>
        }
      />
      <div className="manager-notification-summary">
        <div><span>{ar ? "غير مقروءة" : "Unread"}</span><strong>{items.filter((item) => item.unread).length}</strong></div>
        <div><span>{ar ? "حرجة" : "Critical"}</span><strong>{items.filter((item) => item.tone === "critical").length}</strong></div>
        <div><span>{ar ? "إجمالي اليوم" : "Today total"}</span><strong>{items.length}</strong></div>
      </div>
      <div className="manager-notification-filters" role="tablist" aria-label={ar ? "تصفية إشعارات المدير" : "Filter manager notifications"}>
        {[
          ["all", "الكل", "All"],
          ["unread", "غير المقروءة", "Unread"],
          ["critical", "الحرجة", "Critical"],
        ].map(([id, labelAr, labelEn]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id as typeof filter)}
          >
            {ar ? labelAr : labelEn}
          </button>
        ))}
      </div>
      <section className="manager-notification-list">
        {visible.map((item) => (
          <button
            key={item.id}
            className={`${item.unread ? "unread" : ""} notification-${item.tone}`}
            onClick={() => openItem(item.id, item.route)}
          >
            <span>{item.tone === "critical" ? "!" : item.tone === "warning" ? "◷" : "✓"}</span>
            <div>
              <strong>{ar ? item.titleAr : item.titleEn}</strong>
              <p>{ar ? item.bodyAr : item.bodyEn}</p>
              <small>{ar ? item.atAr : item.atEn}</small>
            </div>
            <i>{ar ? "فتح" : "Open"} ←</i>
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty-state compact">
            <span>✓</span>
            <h3>{ar ? "لا توجد إشعارات ضمن هذا الفلتر" : "No notifications match this filter"}</h3>
            <button className="button button-secondary" onClick={() => setFilter("all")}>
              {ar ? "عرض الكل" : "Show all"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function CommitteeDashboard({ state, navigate }: { state: DemoState; navigate: (path: string) => void }) {
  const ar = state.language === "ar";
  const pendingCases = [
    ...(state.case.status === "Committee Review" ? [{ id: state.case.id, serviceId: state.case.serviceId }] : []),
    ...state.additionalApplications.filter((application) => application.status === "Committee Review").map((application) => ({ id: application.id, serviceId: application.serviceId })),
  ];
  const decided = (state.case.committeeApproved ? 1 : 0) + state.additionalApplications.filter((application) => application.committeeApproved).length;
  return <div className="page committee-page">
    <SectionHeader eyebrow={ar ? "مساحة اللجان" : "COMMITTEE WORKSPACE"} title={ar ? "اجتماع فعلي مرتبط بالمعاملة" : "A real meeting tied to the case"} description={ar ? "لا تظهر أي قضية هنا قبل إحالة مدير المديرية." : "No case appears here before the Directorate Manager referral."} />
    <div className="metric-grid metric-grid-4"><MetricCard label={ar ? "الاجتماعات القادمة" : "Upcoming meetings"} value={pendingCases.length ? "1" : "0"} trend={ar ? "اليوم ١١:٠٠" : "Today 11:00"} icon="◉" /><MetricCard label={ar ? "قضايا معلقة" : "Pending cases"} value={num(pendingCases.length, state.language)} icon="▤" tone="gold" /><MetricCard label={ar ? "قرارات مسجلة" : "Recorded decisions"} value={num(decided, state.language)} icon="✓" tone="navy" /><MetricCard label={ar ? "النصاب" : "Quorum"} value={hasQuorum(state.committeeMembers) ? (ar ? "مكتمل" : "Met") : (ar ? "غير مكتمل" : "Not met")} icon="◷" /></div>
    <section className="committee-meetings"><article className="featured-meeting"><div className="meeting-date"><strong>26</strong><span>{ar ? "تموز" : "JUL"}</span></div><div><span className="eyebrow">{ar ? "اليوم · ١١:٠٠ صباحاً" : "TODAY · 11:00 AM"}</span><h2>{ar ? "لجنة الخدمات — الاجتماع الدوري" : "Services Committee — Regular Meeting"}</h2><p>{pendingCases.length ? (ar ? `${pendingCases.length} معاملة جاهزة للقرار` : `${pendingCases.length} cases ready for decision`) : (ar ? "لا توجد معاملات محالة بعد" : "No referred cases yet")}</p><div><MiniBadge tone={hasQuorum(state.committeeMembers) ? "success" : "warning"}>{hasQuorum(state.committeeMembers) ? "✓" : "!"} {ar ? "حالة النصاب" : "Quorum status"}</MiniBadge></div></div>{pendingCases.length ? <button className="button button-primary" onClick={() => navigate(`/committee/meetings/${pendingCases[0].id}`)}>{ar ? "دخول الاجتماع" : "Enter meeting"} ←</button> : <MiniBadge tone="neutral">{ar ? "بانتظار إحالة المدير" : "Awaiting manager referral"}</MiniBadge>}</article>
      {pendingCases.length > 1 && <div className="table-card"><div className="data-table-wrap"><table className="data-table"><tbody>{pendingCases.map((application, index) => { const service = services.find((item) => item.id === application.serviceId) ?? services[0]; return <tr key={application.id} className="featured-row" onClick={() => navigate(`/committee/meetings/${application.id}`)}><td>{index + 1}</td><td><strong dir="ltr">{application.id}</strong></td><td>{ar ? service.titleAr : service.titleEn}</td><td><button className="button button-secondary" onClick={(event) => { event.stopPropagation(); navigate(`/committee/meetings/${application.id}`); }}>{ar ? "فتح" : "Open"} ←</button></td></tr>; })}</tbody></table></div></div>}
    </section>
  </div>;
}

function CommitteeMeeting({
  state,
  setState,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const notes = state.committeeDraft.notes;
  const reason = state.committeeDraft.reason;
  const updateCommitteeDraft = (patch: Partial<DemoState["committeeDraft"]>) => setState((previous) => ({ ...previous, committeeDraft: { ...previous.committeeDraft, ...patch } }));
  const committeeCases = [
    ...(isCaseVisibleToCommittee(state.case.status) ? [state.case.id] : []),
    ...state.additionalApplications.filter((application) => isCaseVisibleToCommittee(application.status)).map((application) => application.id),
  ];
  const casePosition = Math.max(committeeCases.indexOf(state.case.id), 0) + 1;
  const committeeCompliance = evaluateCompliance({
    application: state.case,
    committeeMembers: state.committeeMembers,
    resolvedControlIds: state.complianceResolvedControlIds,
  });
  const committeeBlockers = getBlockingComplianceResults(committeeCompliance);
  const readiness = committeeDecisionReadiness(state.committeeMembers, reason, committeeBlockers.length);
  const quorum = readiness.quorum;
  const approveCount = readiness.approveCount;
  const votes = state.committeeMembers.filter((member) => member.present && !member.conflict && member.vote);

  if (!isCaseVisibleToCommittee(state.case.status)) {
    return (
      <div className="page committee-page">
        <SectionHeader
          eyebrow={ar ? "مساحة اللجان" : "COMMITTEE WORKSPACE"}
          title={ar ? "لا توجد قضية جاهزة للعرض في هذا الاجتماع" : "No case is ready for this meeting"}
          description={ar ? "لا تظهر القضية للجنة إلا بعد اكتمال المواطن، ومراجعة الموظف، والإحالة الرسمية." : "A case appears to the committee only after citizen completion, staff review, and formal referral."}
          action={<button className="button button-secondary" onClick={() => navigate("/committee")}>{ar ? "العودة للاجتماعات" : "Back to meetings"}</button>}
        />
        <section className="content-card">
          <h2>{ar ? "جدول الأعمال محمي حسب المرحلة" : "The agenda is stage-protected"}</h2>
          <p>{ar ? "هذا الرابط لا يعرض بيانات الطلب أو حالته أو مستنداته قبل وصوله رسمياً إلى اللجنة." : "This direct link exposes no application data, status, or documents before formal committee referral."}</p>
        </section>
      </div>
    );
  }

  const castVote = (id: string, vote: "approve" | "reject" | "abstain" | "more-info") => {
    setState((previous) => ({
      ...previous,
      committeeMembers: previous.committeeMembers.map((member) => member.id === id ? { ...member, vote } : member),
    }));
    toast(ar ? "تم تسجيل التصويت التجريبي" : "Demo vote recorded");
  };
  const simulateMemberApprovals = () => {
    setState((previous) => ({
      ...previous,
      committeeMembers: previous.committeeMembers.map((member) => ["cm-2", "cm-3"].includes(member.id) && member.present && !member.conflict ? { ...member, vote: "approve" } : member),
    }));
    toast(ar ? "تم تسجيل موافقة العضوين معاً" : "Both member approvals were recorded together");
  };
  const signDecision = () => {
    if (!readiness.ready) {
      toast(ar ? "يتطلب الاعتماد نصاباً وصوتين بالموافقة وسبباً مكتوباً وبوابة امتثال خالية من العناصر الحاجبة." : "Signature requires quorum, two approval votes, a written rationale and a clear compliance gate.");
      return;
    }
    setState((previous) => ({
      ...previous,
      case: {
        ...previous.case,
        status: "Approved",
        committeeApproved: true,
        signed: true,
        decisionPublished: true,
        updatedAt: new Date().toISOString(),
      },
      notifications: [
        {
          id: `notification-approved-${Date.now()}`,
          titleAr: "صدور قرار الموافقة",
          titleEn: "Approval decision issued",
          bodyAr: "يمكنك الآن فتح القرار النهائي والتحقق من رمز الوثيقة.",
          bodyEn: "The final decision is now available with public verification.",
          at: new Date().toISOString(),
          read: false,
          channel: "in-app",
        },
        ...previous.notifications,
      ],
    }));
    addAudit("تصويت اللجنة واعتماد القرار بتوقيع إلكتروني محاكى", "Committee voted and decision received a simulated electronic signature", "committee");
    toast(ar ? "تم توقيع القرار ونشره للمواطن" : "Decision signed and published to the citizen");
  };
  return (
    <div className="meeting-page">
      <header className="meeting-header"><div className="case-breadcrumb"><button onClick={() => navigate("/committee")}>{ar ? "الاجتماعات" : "Meetings"}</button><span>/</span><b>EDU-2026-07</b></div><div><span className="live-indicator">● {ar ? "اجتماع جارٍ" : "IN SESSION"}</span><h1>{ar ? "لجنة دعم التعليم — الاجتماع الدوري" : "Education Support Committee — Regular Meeting"}</h1><p>{ar ? "٢٦ تموز ٢٠٢٦ · ١١:٠٠ · قاعة اللجان ٢ · الرئيس: د. مصطفى ناصر" : "26 July 2026 · 11:00 · Committee Room 2 · Chair: Dr. Mustafa Nasser"}</p></div><div className={`quorum-box ${quorum ? "valid" : "invalid"}`}><span>{quorum ? "✓" : "!"}</span><div><strong>{quorum ? (ar ? "النصاب مكتمل" : "Quorum met") : (ar ? "النصاب غير مكتمل" : "No quorum")}</strong><small>{state.committeeMembers.filter((member) => member.present && !member.conflict).length}/3 {ar ? "مؤهلون للتصويت" : "eligible voters"}</small></div></div></header>
      <div className="meeting-layout">
        <aside className="agenda-panel"><header><span className="eyebrow">{ar ? "جدول الأعمال" : "AGENDA"}</span><h2>{ar ? "القضايا" : "Cases"} <b>1</b></h2></header><div className="active"><i>1</i><span><strong>{state.case.id}</strong><small>{ar ? "منحة تعليمية — زينب علي" : "Education grant — Zainab Ali"}</small></span></div></aside>
        <main className="case-pack">
          <section className="case-pack-header"><div><MiniBadge tone="gold">{ar ? `القضية ${num(casePosition, "ar")} من ${num(committeeCases.length, "ar")}` : `CASE ${casePosition} OF ${committeeCases.length}`}</MiniBadge><h2>{ar ? "طلب منحة تعليمية — مريم حيدر علي" : "Education Grant — Maryam Haider Ali"}</h2><p dir="ltr">{state.case.id}</p></div><StatusBadge status={state.case.status} language={state.language} /></section>
          <section className="case-pack-summary content-card"><div><span className="avatar avatar-large">زع</span><p><small>{ar ? "المستفيدة" : "BENEFICIARY"}</small><strong>{ar ? state.case.citizenNameAr : state.case.citizenNameEn}</strong><span>{ar ? "بغداد · ملف موثّق" : "Baghdad · Verified profile"}</span></p></div><div><small>{ar ? "الطالبة" : "STUDENT"}</small><strong>{ar ? state.case.familyMemberAr : state.case.familyMemberEn}</strong><span>{ar ? state.case.universityAr : state.case.universityEn}</span></div><div><small>{ar ? "نتيجة الأهلية" : "ELIGIBILITY"}</small><strong>3/4 {ar ? "مجتازة" : "passed"}</strong><span>{ar ? "قاعدة واحدة للمراجعة البشرية" : "One manual review"}</span></div></section>
          <section className="content-card recommendation-card"><header><div><span className="eyebrow">{ar ? "توصية الموظف — مراجعة بشرية" : "STAFF RECOMMENDATION — HUMAN REVIEW"}</span><h3>{ar ? "الإحالة مع توصية بالموافقة" : "Referred with an approval recommendation"}</h3></div><MiniBadge tone="success">✓ {ar ? "مؤكدة من الموظف" : "Staff confirmed"}</MiniBadge></header><p>{state.case.employeeRecommendation || (ar ? "اكتملت الوثائق وتمت مطابقة بيانات الأسرة والدراسة مع قواعد EDU-ELIG-2.3. أوصي بعرض الطلب على اللجنة للاعتماد." : "Evidence is complete and family and education data match EDU-ELIG-2.3. Recommend committee consideration.")}</p><footer><span>LR-EDU-04</span><span>LR-EDU-07</span><span>LR-EDU-11</span></footer></section>
          <section className={`content-card committee-compliance-card ${committeeBlockers.length ? "blocked" : "clear"}`}><div><span>{committeeBlockers.length ? "!" : "✓"}</span><p><small>{ar ? "بوابة الامتثال قبل القرار" : "PRE-DECISION COMPLIANCE GATE"}</small><strong>{committeeBlockers.length ? (ar ? `${committeeBlockers.length} عنصر حاجب` : `${committeeBlockers.length} blocking items`) : (ar ? "الضوابط الحاجبة مجتازة" : "Blocking controls passed")}</strong><em>{ar ? "المادة 9 · CTL-COMMITTEE-QUORUM · MF-LAW-2016.2" : "Article 9 · CTL-COMMITTEE-QUORUM · MF-LAW-2016.2"}</em></p></div><button onClick={() => toast(ar ? "تمت إعادة التقييم بنفس المدخلات والنسخة" : "Evaluation rerun with the same inputs and version")}>↻ {ar ? "إعادة التقييم" : "Rerun"}</button></section>
          <section className="case-pack-grid"><article className="content-card"><h3>{ar ? "الأدلة المكتملة" : "Complete evidence"}</h3>{state.case.documents.map((document) => <div className="pack-document" key={document.id}><span className="file-icon">PDF</span><p><strong>{ar ? document.titleAr : document.titleEn}</strong><small>{document.classification}</small></p><i>✓</i></div>)}</article><article className="content-card discussion-notes"><h3>{ar ? "ملاحظات المداولة" : "Discussion notes"}</h3><textarea value={notes} onChange={(event) => updateCommitteeDraft({ notes: event.target.value })} placeholder={ar ? "تُسجل الملاحظات ضمن محضر الاجتماع…" : "Notes become part of the minutes…"} /><small>{ar ? "حفظ تلقائي في قاعدة الـPOC" : "Autosaved to the POC database"}</small></article></section>
        </main>
        <aside className="vote-panel">
          <header><span className="eyebrow">{ar ? "الحضور والتصويت" : "ATTENDANCE & VOTING"}</span><h2>{ar ? "أعضاء اللجنة" : "Committee members"}</h2></header>
          <div className="member-list">{state.committeeMembers.map((member) => <div key={member.id} className={member.conflict ? "conflict" : ""}><span className="avatar avatar-small">{member.nameAr.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><p><strong>{ar ? member.nameAr : member.nameEn}</strong><small>{ar ? member.roleAr : member.roleEn}</small></p>{member.conflict ? <MiniBadge tone="danger">{ar ? "تعارض" : "Conflict"}</MiniBadge> : !member.present ? <MiniBadge tone="neutral">{ar ? "غائب" : "Absent"}</MiniBadge> : member.vote ? <MiniBadge tone={member.vote === "approve" ? "success" : "warning"}>{member.vote === "approve" ? (ar ? "موافق" : "Approve") : member.vote}</MiniBadge> : <MiniBadge tone="info">{ar ? "حاضر" : "Present"}</MiniBadge>}</div>)}</div>
          <section className="my-vote"><span className="eyebrow">{ar ? "صوت رئيس اللجنة" : "CHAIR VOTE"}</span><div><button onClick={() => castVote("cm-1", "approve")} className={state.committeeMembers[0].vote === "approve" ? "selected approve" : ""}>✓ {ar ? "موافقة" : "Approve"}</button><button onClick={() => castVote("cm-1", "reject")} className={state.committeeMembers[0].vote === "reject" ? "selected reject" : ""}>× {ar ? "رفض" : "Reject"}</button><button onClick={() => castVote("cm-1", "abstain")}>○ {ar ? "امتناع" : "Abstain"}</button><button onClick={() => castVote("cm-1", "more-info")}>↩ {ar ? "معلومات إضافية" : "More info"}</button></div></section>
          <button className="simulate-votes" onClick={simulateMemberApprovals}>{ar ? "محاكاة تصويت عضوين بالموافقة" : "Simulate two member approvals"}</button>
          <section className="vote-result"><header><span>{ar ? "النتيجة الحية" : "LIVE RESULT"}</span><strong>{approveCount}/{votes.length || 3}</strong></header><div><i style={{ width: `${Math.max(approveCount / 3, 0.05) * 100}%` }} /></div><p>{ar ? `${approveCount} موافقة · ${votes.length - approveCount} أصوات أخرى` : `${approveCount} approve · ${votes.length - approveCount} other`}</p></section>
          <label className="input-field"><span>{ar ? "مسودة أسباب القرار *" : "Decision rationale *"}</span><textarea value={reason} onChange={(event) => updateCommitteeDraft({ reason: event.target.value })} /></label>
          <div className="approval-checks"><span>{quorum ? "✓" : "○"} {ar ? "النصاب مكتمل" : "Quorum met"}</span><span>{approveCount >= 2 ? "✓" : "○"} {ar ? "موافقتان مؤهلتان على الأقل" : "At least two eligible approvals"}</span><span>{reason.trim() ? "✓" : "○"} {ar ? "أسباب القرار مكتوبة" : "Decision rationale entered"}</span><span>{committeeBlockers.length === 0 ? "✓" : "○"} {ar ? "بوابة الامتثال خالية" : "Compliance gate clear"}</span></div>
          <button className="button button-gold button-full" disabled={state.case.signed} onClick={signDecision}>{state.case.signed ? (ar ? "✓ تم التوقيع والنشر" : "✓ Signed and published") : (ar ? "توقيع القرار ونشره" : "Sign and publish decision")} ◇</button>
          <small className="signature-note">{ar ? "توقيع إلكتروني محاكى — لا قيمة قانونية له." : "Simulated electronic signature — no legal validity."}</small>
        </aside>
      </div>
    </div>
  );
}

function GenericCommitteeMeeting({
  state,
  setState,
  application,
  navigate,
  toast,
  addAudit,
}: {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  application: ServiceApplication;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void;
}) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === application.serviceId) ?? services[0];
  const quorum = hasQuorum(state.committeeMembers);
  const eligibleMembers = state.committeeMembers.filter((member) => member.present && !member.conflict);
  const votes = application.committeeVotes || {};
  const approveCount = eligibleMembers.filter((member) => votes[member.id] === "approve").length;
  const recordedCount = eligibleMembers.filter((member) => Boolean(votes[member.id])).length;
  const committeeCases = [
    ...(isCaseVisibleToCommittee(state.case.status) ? [state.case.id] : []),
    ...state.additionalApplications.filter((item) => isCaseVisibleToCommittee(item.status)).map((item) => item.id),
  ];
  const position = Math.max(committeeCases.indexOf(application.id), 0) + 1;
  const updateApplication = (patch: Partial<ServiceApplication>) => setState((previous) => ({
    ...previous,
    additionalApplications: previous.additionalApplications.map((item) => item.id === application.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item),
  }));
  const castVote = (memberId: string, vote: NonNullable<ServiceApplication["committeeVotes"]>[string]) => {
    updateApplication({ committeeVotes: { ...votes, [memberId]: vote } });
    toast(ar ? "تم تسجيل التصويت التجريبي" : "Demo vote recorded");
  };
  const simulateMemberApprovals = () => {
    updateApplication({ committeeVotes: { ...votes, "cm-2": "approve", "cm-3": "approve" } });
    toast(ar ? "تم تسجيل موافقة العضوين معاً" : "Both member approvals were recorded together");
  };
  const decide = (decision: "Approved" | "Rejected") => {
    const rationale = application.committeeReason?.trim() || "";
    if (!quorum || !rationale || (decision === "Approved" && approveCount < 2)) {
      toast(ar ? "أكمل النصاب، وأدخل أسباب القرار، وسجّل موافقتين على الأقل عند الاعتماد." : "Meet quorum, enter the rationale, and record at least two approvals for authorization.");
      return;
    }
    updateApplication({ status: decision, committeeApproved: decision === "Approved", signed: true, decisionPublished: true });
    setState((previous) => ({
      ...previous,
      notifications: [{
        id: `notification-committee-${application.id}-${Date.now()}`,
        titleAr: decision === "Approved" ? `صدور قرار الموافقة على ${service.titleAr}` : `صدور قرار بشأن ${service.titleAr}`,
        titleEn: decision === "Approved" ? `${service.titleEn} approved` : `${service.titleEn} decision issued`,
        bodyAr: `تم نشر القرار المسبب للمعاملة ${application.id}.`,
        bodyEn: `The reasoned decision for ${application.id} was published.`,
        at: new Date().toISOString(),
        read: false,
        channel: "in-app",
      }, ...previous.notifications],
    }));
    addAudit(decision === "Approved" ? `اعتماد ${application.id} بتوقيع إلكتروني محاكى` : `رفض ${application.id} بقرار لجنة مسبب`, decision === "Approved" ? `${application.id} approved with a simulated electronic signature` : `${application.id} rejected by a reasoned committee decision`, "committee");
    toast(decision === "Approved" ? (ar ? "تم توقيع القرار ونشره للمواطن" : "Decision signed and published to the citizen") : (ar ? "تم تسجيل الرفض المسبب ونشره للمواطن" : "Reasoned rejection recorded and published to the citizen"));
  };

  if (application.status !== "Committee Review" && !application.signed) {
    return <div className="page committee-page"><SectionHeader eyebrow={ar ? "مساحة اللجان" : "COMMITTEE WORKSPACE"} title={ar ? "هذه المعاملة غير جاهزة للجنة" : "This case is not ready for committee"} description={ar ? "يجب أن ينهي الموظف والمدير مرحلتيهما أولاً." : "Staff and manager must complete their stages first."} action={<button className="button button-secondary" onClick={() => navigate("/committee")}>{ar ? "العودة" : "Back"}</button>} /></div>;
  }

  return <div className="meeting-page">
    <header className="meeting-header"><div className="case-breadcrumb"><button onClick={() => navigate("/committee")}>{ar ? "الاجتماعات" : "Meetings"}</button><span>/</span><b dir="ltr">{application.id}</b></div><div><span className="live-indicator">● {ar ? "اجتماع جارٍ" : "IN SESSION"}</span><h1>{ar ? `لجنة ${service.categoryAr}` : `${service.category} Committee`}</h1><p>{ar ? "اجتماع قرار تجريبي · الرئيس: د. مصطفى ناصر" : "Demo decision meeting · Chair: Dr. Mustafa Nasser"}</p></div><div className={`quorum-box ${quorum ? "valid" : "invalid"}`}><span>{quorum ? "✓" : "!"}</span><div><strong>{quorum ? (ar ? "النصاب مكتمل" : "Quorum met") : (ar ? "النصاب غير مكتمل" : "No quorum")}</strong><small>{eligibleMembers.length}/3 {ar ? "مؤهلون للتصويت" : "eligible voters"}</small></div></div></header>
    <div className="meeting-layout"><aside className="agenda-panel"><header><span className="eyebrow">{ar ? "جدول الأعمال" : "AGENDA"}</span><h2>{ar ? "القضايا" : "Cases"} <b>{committeeCases.length}</b></h2></header>{committeeCases.map((id, index) => <button key={id} className={id === application.id ? "active" : ""} onClick={() => navigate(`/committee/meetings/${id}`)}><i>{index + 1}</i><span><strong dir="ltr">{id}</strong></span></button>)}</aside>
      <main className="case-pack"><section className="case-pack-header"><div><MiniBadge tone="gold">{ar ? `القضية ${num(position, "ar")} من ${num(committeeCases.length, "ar")}` : `CASE ${position} OF ${committeeCases.length}`}</MiniBadge><h2>{ar ? service.titleAr : service.titleEn}</h2><p dir="ltr">{application.id}</p></div><StatusBadge status={application.status} language={state.language} /></section><section className="case-pack-summary content-card"><div><span className="avatar avatar-large">زع</span><p><small>{ar ? "المستفيد" : "BENEFICIARY"}</small><strong>{ar ? state.citizenProfile.fullNameAr : state.citizenProfile.fullNameEn}</strong><span>{ar ? "بغداد · ملف موثّق" : "Baghdad · Verified profile"}</span></p></div><div><small>{ar ? "الوثائق" : "EVIDENCE"}</small><strong>{application.documentCount}/{application.documentCount}</strong><span>{ar ? "اكتملت قبل التقديم" : "Complete before submission"}</span></div></section><section className="content-card recommendation-card"><header><div><span className="eyebrow">{ar ? "توصية الموظف — مراجعة بشرية" : "STAFF RECOMMENDATION — HUMAN REVIEW"}</span><h3>{ar ? "محالة من مدير المديرية" : "Referred by Directorate Manager"}</h3></div><MiniBadge tone="success">✓ {ar ? "مؤكدة" : "Confirmed"}</MiniBadge></header><p>{application.employeeRecommendation}</p></section><section className="case-pack-grid"><article className="content-card"><h3>{ar ? "ملخص الطلب" : "Application summary"}</h3><p>{application.detail}</p></article><article className="content-card discussion-notes"><h3>{ar ? "أسباب القرار *" : "Decision rationale *"}</h3><textarea value={application.committeeReason || ""} onChange={(event) => updateApplication({ committeeReason: event.target.value })} placeholder={ar ? "اكتب أسباب القرار قبل التوقيع…" : "Enter the decision rationale before signing…"} /><small>{ar ? "يحفظ تلقائياً" : "Autosaved"}</small></article></section></main>
      <aside className="vote-panel"><header><span className="eyebrow">{ar ? "الحضور والتصويت" : "ATTENDANCE & VOTING"}</span><h2>{ar ? "أعضاء اللجنة" : "Committee members"}</h2></header><div className="member-list">{state.committeeMembers.map((member) => <div key={member.id} className={member.conflict ? "conflict" : ""}><span className="avatar avatar-small">{member.nameAr.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><p><strong>{ar ? member.nameAr : member.nameEn}</strong><small>{ar ? member.roleAr : member.roleEn}</small></p>{member.conflict ? <MiniBadge tone="danger">{ar ? "تعارض" : "Conflict"}</MiniBadge> : !member.present ? <MiniBadge tone="neutral">{ar ? "غائب" : "Absent"}</MiniBadge> : votes[member.id] ? <MiniBadge tone={votes[member.id] === "approve" ? "success" : "warning"}>{votes[member.id] === "approve" ? (ar ? "موافق" : "Approve") : votes[member.id]}</MiniBadge> : <MiniBadge tone="info">{ar ? "حاضر" : "Present"}</MiniBadge>}</div>)}</div><section className="my-vote"><span className="eyebrow">{ar ? "صوت رئيس اللجنة" : "CHAIR VOTE"}</span><div><button onClick={() => castVote("cm-1", "approve")} className={votes["cm-1"] === "approve" ? "selected approve" : ""}>✓ {ar ? "موافقة" : "Approve"}</button><button onClick={() => castVote("cm-1", "reject")} className={votes["cm-1"] === "reject" ? "selected reject" : ""}>× {ar ? "رفض" : "Reject"}</button></div></section><button className="simulate-votes" onClick={simulateMemberApprovals}>{ar ? "محاكاة تصويت عضوين بالموافقة" : "Simulate two member approvals"}</button><section className="vote-result"><header><span>{ar ? "النتيجة الحية" : "LIVE RESULT"}</span><strong>{approveCount}/{recordedCount || 3}</strong></header><div><i style={{ width: `${Math.max(approveCount / 3, 0.05) * 100}%` }} /></div></section><div className="approval-checks"><span>{quorum ? "✓" : "○"} {ar ? "النصاب مكتمل" : "Quorum met"}</span><span>{approveCount >= 2 ? "✓" : "○"} {ar ? "موافقتان مؤهلتان على الأقل" : "At least two eligible approvals"}</span><span>{application.committeeReason?.trim() ? "✓" : "○"} {ar ? "أسباب القرار مكتوبة" : "Decision rationale entered"}</span></div><button className="button button-gold button-full" disabled={Boolean(application.signed)} onClick={() => decide("Approved")}>{application.signed && application.status === "Approved" ? (ar ? "✓ تم التوقيع والنشر" : "✓ Signed and published") : (ar ? "توقيع قرار الموافقة ونشره" : "Sign approval and publish")} ◇</button><button className="button button-danger button-full" disabled={Boolean(application.signed)} onClick={() => decide("Rejected")}>× {ar ? "توقيع قرار رفض مسبب" : "Sign reasoned rejection"}</button><small className="signature-note">{ar ? "توقيع إلكتروني محاكى — لا قيمة قانونية له." : "Simulated electronic signature — no legal validity."}</small></aside>
    </div>
  </div>;
}

function ExecutiveDashboard({ state, navigate }: { state: DemoState; navigate: (path: string) => void }) {
  const ar = state.language === "ar";
  const [transaction, setTransaction] =
    useState<ExecutiveTransactionFilter>("all");
  const [governorate, setGovernorate] =
    useState<ExecutiveGovernorateFilter>("all");
  const [period, setPeriod] = useState<ExecutivePeriodFilter>("12m");
  const [selectedRevenueIndex, setSelectedRevenueIndex] = useState(11);
  const view = getExecutiveView(transaction, governorate, period);
  const visibleRevenueIndex = Math.min(
    selectedRevenueIndex,
    view.revenue.length - 1,
  );
  const selectedRevenue = view.revenue[visibleRevenueIndex] ?? 0;
  const selectedMonth = view.labels[visibleRevenueIndex];
  const maximumRevenue = Math.max(...view.revenue, 1);
  const transactionLabel = executiveTransactionOptions.find(
    (option) => option.id === transaction,
  )!;
  const governorateLabel = executiveGovernorateOptions.find(
    (option) => option.id === governorate,
  )!;
  const periodLabel = executivePeriodOptions.find(
    (option) => option.id === period,
  )!;
  const selectLastRevenue = () => setSelectedRevenueIndex(view.revenue.length - 1);
  const resetFilters = () => {
    setTransaction("all");
    setGovernorate("all");
    setPeriod("12m");
    setSelectedRevenueIndex(11);
  };
  const directorateShare = Math.max(0, 94 - view.digitalShare);
  return (
    <div className="executive-page">
      <SectionHeader
        eyebrow={ar ? "مكتب رئيس المؤسسة · مؤشرات تنفيذية" : "PRESIDENT OFFICE · EXECUTIVE INDICATORS"}
        title={ar ? "المعاملات والإيرادات في مشهد واحد قابل للتحليل." : "Transactions and revenue in one explorable view."}
        description={ar ? "غيّر نوع المعاملة أو المحافظة أو الفترة؛ كل المؤشرات والشارتات أدناه تتحدث فوراً ببيانات تجريبية مترابطة." : "Change transaction, governorate or period; every KPI and chart updates immediately using connected demo data."}
        action={
          <div className="executive-filters">
            <label>
              <span>{ar ? "نوع المعاملة" : "Transaction"}</span>
              <select
                value={transaction}
                onChange={(event) => {
                  setTransaction(event.target.value as ExecutiveTransactionFilter);
                  selectLastRevenue();
                }}
              >
                {executiveTransactionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {ar ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{ar ? "المحافظة" : "Governorate"}</span>
              <select
                value={governorate}
                onChange={(event) => {
                  setGovernorate(event.target.value as ExecutiveGovernorateFilter);
                  selectLastRevenue();
                }}
              >
                {executiveGovernorateOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {ar ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{ar ? "الفترة" : "Period"}</span>
              <select
                value={period}
                onChange={(event) => {
                  const next = event.target.value as ExecutivePeriodFilter;
                  setPeriod(next);
                  setSelectedRevenueIndex(next === "12m" ? 11 : next === "6m" ? 5 : next === "3m" ? 2 : 0);
                }}
              >
                {executivePeriodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {ar ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="executive-filter-reset"
              onClick={resetFilters}
              disabled={
                transaction === "all" &&
                governorate === "all" &&
                period === "12m"
              }
            >
              ↻ {ar ? "إعادة" : "Reset"}
            </button>
          </div>
        }
      />
      <div className="executive-filter-summary" aria-live="polite">
        <span>●</span>
        <p>
          <strong>{ar ? transactionLabel.ar : transactionLabel.en}</strong>
          <small>
            {ar ? governorateLabel.ar : governorateLabel.en} ·{" "}
            {ar ? periodLabel.ar : periodLabel.en} ·{" "}
            {num(view.applications, state.language)}{" "}
            {ar ? "معاملة ضمن النطاق" : "transactions in scope"}
          </small>
        </p>
      </div>
      <div className="executive-kpis">
        <MetricCard
          label={ar ? "المستفيدون ضمن الفلتر" : "Filtered beneficiaries"}
          value={num(view.activeBeneficiaries, state.language)}
          trend={ar ? "سجلات نشطة" : "active records"}
          icon="♧"
        />
        <MetricCard
          label={ar ? "الأسر ضمن الفلتر" : "Filtered families"}
          value={num(view.registeredFamilies, state.language)}
          trend={ar ? "ملفات مترابطة" : "linked profiles"}
          icon="⌂"
          tone="navy"
        />
        <MetricCard
          label={ar ? "طلبات مكتملة" : "Completed applications"}
          value={num(view.completed, state.language)}
          trend={ar ? "ضمن الفترة المختارة" : "within selected period"}
          icon="✓"
          tone="gold"
          onClick={() => navigate("/staff/inbox")}
        />
        <MetricCard
          label={ar ? "امتثال المهلة" : "SLA compliance"}
          value={`${view.sla}%`}
          trend={ar ? "محسوب حسب النطاق" : "scope-adjusted"}
          icon="◷"
        />
        <MetricCard
          label={ar ? "إيرادات الفترة" : "Period revenue"}
          value={`${num(view.revenueTotal, state.language)} ${ar ? "د.ع" : "IQD"}`}
          trend={`${view.reconciliation}% ${ar ? "تمت تسويته" : "reconciled"}`}
          icon="◈"
          tone="gold"
          onClick={() =>
            document
              .getElementById("executive-revenue-chart")
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        />
        <MetricCard
          label={ar ? "رضا المستفيدين" : "Beneficiary satisfaction"}
          value={`${view.satisfaction}/5`}
          trend={ar ? "استبيانات تجريبية" : "demo surveys"}
          icon="♡"
          tone="navy"
        />
      </div>
      <section className="executive-story">
        <article className="content-card trend-card">
          <header>
            <div>
              <span className="eyebrow">{ar ? "حجم المعاملات ونسبة الإنجاز" : "TRANSACTION VOLUME & COMPLETION"}</span>
              <h2>{ar ? "أداء النطاق المختار عبر الزمن" : "Selected scope performance over time"}</h2>
            </div>
            <div className="legend">
              <span><i className="emerald" />{ar ? "المعاملات" : "Transactions"}</span>
              <span><i className="gold" />{ar ? "الإنجاز" : "Completion"}</span>
            </div>
          </header>
          <div className="line-chart">
            <div className="chart-grid">
              {[100, 75, 50, 25, 0].map((value) => <span key={value}>{value}%</span>)}
            </div>
            <div className="chart-bars">
              {view.volumeIndex.map((value, index) => (
                <div key={`${view.labels[index].en}-${index}`}>
                  <i style={{ height: `${value}%` }} />
                  <b style={{ bottom: `${Math.min(view.completionSeries[index], 97)}%` }} />
                </div>
              ))}
            </div>
            <footer>
              {view.labels.map((month) => <span key={month.en}>{ar ? month.ar : month.en}</span>)}
            </footer>
          </div>
          <div className="chart-insight">
            <span>✦ {ar ? "رؤية محاكاة" : "SIMULATED INSIGHT"}</span>
            <p>
              {ar
                ? `يعرض الفلتر ${num(view.applications, state.language)} معاملة بنسبة امتثال ${view.sla}%، مع تحديث الإيرادات والأداء الجغرافي من نفس النطاق.`
                : `The filter contains ${num(view.applications, state.language)} transactions at ${view.sla}% SLA compliance, with revenue and geography updated from the same scope.`}
            </p>
            <small>{ar ? "المصادر: معاملات وإيرادات وSLA تجريبية مترابطة" : "Sources: connected demo transactions, revenue and SLA"}</small>
          </div>
        </article>
        <article
          className="content-card revenue-chart-card"
          id="executive-revenue-chart"
        >
          <header>
            <div>
              <span className="eyebrow">{ar ? "الإيرادات التجريبية" : "DEMO REVENUE"}</span>
              <h2>{ar ? "الإيراد حسب الشهر" : "Revenue by month"}</h2>
            </div>
            <MiniBadge tone="gold">{view.reconciliation}% {ar ? "مسوّى" : "reconciled"}</MiniBadge>
          </header>
          <div className="revenue-chart" role="list" aria-label={ar ? "الإيرادات الشهرية" : "Monthly revenue"}>
            {view.revenue.map((value, index) => (
              <button
                key={`${view.labels[index].en}-revenue`}
                className={visibleRevenueIndex === index ? "active" : ""}
                onClick={() => setSelectedRevenueIndex(index)}
                aria-label={`${ar ? view.labels[index].ar : view.labels[index].en}: ${num(value, state.language)} ${ar ? "دينار عراقي" : "IQD"}`}
              >
                <span>{num(Math.round(value / 1_000_000), state.language)}<small>{ar ? "م" : "M"}</small></span>
                <i style={{ height: `${Math.max((value / maximumRevenue) * 100, 8)}%` }} />
                <b>{ar ? view.labels[index].ar : view.labels[index].en}</b>
              </button>
            ))}
          </div>
          <div className="revenue-selection" aria-live="polite">
            <span>◈</span>
            <div>
              <small>{ar ? `إيراد ${selectedMonth?.ar ?? ""}` : `${selectedMonth?.en ?? ""} revenue`}</small>
              <strong>{num(selectedRevenue, state.language)} {ar ? "د.ع" : "IQD"}</strong>
            </div>
            <div>
              <small>{ar ? "المعاملات" : "Transactions"}</small>
              <strong>{num(view.volumes[visibleRevenueIndex] ?? 0, state.language)}</strong>
            </div>
          </div>
          <p className="revenue-disclaimer">
            {ar ? "الأرقام افتراضية لإثبات الفلترة والتحليل، ولا تمثل تحصيلاً أو رسوماً قانونية." : "Figures are synthetic to demonstrate filtering and analysis; they are not real collections or legal fees."}
          </p>
        </article>
      </section>
      <section className="executive-bottom">
        <article className="content-card governorate-card">
          <header>
            <div>
              <span className="eyebrow">{ar ? "الأداء الجغرافي" : "GEOGRAPHIC PERFORMANCE"}</span>
              <h2>{ar ? "المحافظات ضمن الفلتر" : "Governorates in scope"}</h2>
            </div>
            <button className="text-button" onClick={() => navigate("/manager")}>
              {ar ? "تفصيل المديريات" : "Directorate detail"} ←
            </button>
          </header>
          <div className="governorate-table">
            {view.governorates.map((row, index) => (
              <button key={row.id} onClick={() => navigate("/manager")}>
                <b>{index + 1}</b>
                <span>
                  <strong>{ar ? row.ar : row.en}</strong>
                  <small>{num(row.volume, state.language)} {ar ? "معاملة" : "transactions"}</small>
                </span>
                <div><i style={{ width: `${row.score}%` }} /></div>
                <strong>{row.sla}%</strong>
              </button>
            ))}
          </div>
        </article>
        <article className="content-card service-mix">
          <header>
            <div>
              <span className="eyebrow">{ar ? "مزيج القنوات" : "CHANNEL MIX"}</span>
              <h2>{ar ? "القناة حسب نوع المعاملة" : "Channel by transaction type"}</h2>
            </div>
          </header>
          <div
            className="donut"
            style={{
              background: `conic-gradient(var(--emerald-500) 0 ${view.digitalShare}%, var(--navy-800) ${view.digitalShare}% ${view.digitalShare + directorateShare}%, var(--gold-500) ${view.digitalShare + directorateShare}%)`,
            }}
          >
            <span><strong>{view.digitalShare}%</strong><small>{ar ? "رقمي" : "Digital"}</small></span>
          </div>
          <ul>
            <li><i className="emerald" /><span>{ar ? "رقمي بالكامل" : "Fully digital"}</span><b>{view.digitalShare}%</b></li>
            <li><i className="navy" /><span>{ar ? "مديرية" : "Directorate"}</span><b>{directorateShare}%</b></li>
            <li><i className="gold" /><span>{ar ? "مراكز مساعدة" : "Assisted"}</span><b>6%</b></li>
          </ul>
        </article>
        <article className="content-card alert-stack">
          <header>
            <div>
              <span className="eyebrow">{ar ? "اهتمام تنفيذي" : "EXECUTIVE ATTENTION"}</span>
              <h2>{ar ? "ثلاث إشارات قابلة للإجراء" : "Three actionable signals"}</h2>
            </div>
          </header>
          {[
            ["!", ar ? "التكامل المصرفي متوقف منذ ٣ ساعات" : "Banking integration failed three hours ago", ar ? "خطر" : "Risk"],
            ["◇", ar ? "نينوى دون هدف المهلة بـ ٣٫٢ نقطة" : "Nineveh is 3.2 points below SLA target", ar ? "متوسط" : "Medium"],
            ["♧", ar ? "٢٣ سجلاً محتمل التكرار هذا الأسبوع" : "23 possible duplicates this week", ar ? "بيانات" : "Data"],
          ].map(([icon, title, tag], index) => (
            <button
              key={title}
              onClick={() =>
                navigate(
                  index === 0
                    ? "/executive/resilience"
                    : index === 1
                      ? "/manager"
                      : "/admin/audit",
                )
              }
            >
              <span>{icon}</span>
              <p><strong>{title}</strong><small>{ar ? "افتح للتحليل والإجراء" : "Open for analysis and action"}</small></p>
              <MiniBadge tone={index === 0 ? "danger" : "warning"}>{tag}</MiniBadge>
            </button>
          ))}
        </article>
      </section>
    </div>
  );
}

// Kept as a compact visual reference while the transactional replacement is validated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EnterpriseFinancePage({ state, navigate, toast }: { state: DemoState; navigate: (path: string) => void; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [domain, setDomain] = useState<"foundation" | "fund" | "beneficiaries" | "investments">("foundation");
  const [status, setStatus] = useState<"all" | "ready" | "attention">("all");
  const [query, setQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("budget");
  const [selectedEntry, setSelectedEntry] = useState("FIN-260805-041");
  const [refreshedAt, setRefreshedAt] = useState(new Date().toLocaleTimeString());
  const domains = [
    { id: "foundation" as const, mark: "A", ar: "مالية المؤسسة", en: "Foundation Finance", balance: 18_420_000_000, inflow: 3_280_000_000, pending: 14 },
    { id: "fund" as const, mark: "B", ar: "مالية صندوق الشهداء", en: "Martyrs Fund Finance", balance: 41_760_000_000, inflow: 6_940_000_000, pending: 9 },
    { id: "beneficiaries" as const, mark: "C", ar: "مدفوعات المستفيدين", en: "Beneficiary Payments", balance: 12_680_000_000, inflow: 2_310_000_000, pending: 27 },
    { id: "investments" as const, mark: "D", ar: "استثمارات ومشاريع المؤسسة", en: "Investments & Projects", balance: 29_530_000_000, inflow: 4_870_000_000, pending: 6 },
  ];
  const active = domains.find((item) => item.id === domain) ?? domains[0];
  const modules = [
    ["budget", "إدارة الموازنة", "Budget Management"], ["ledger", "دفتر الأستاذ العام", "General Ledger"], ["payable", "الحسابات الدائنة", "Accounts Payable"], ["receivable", "الحسابات المدينة", "Accounts Receivable"], ["cash", "النقد والمصارف", "Cash and Bank Management"], ["beneficiary", "مدفوعات المستفيدين", "Beneficiary Payments"], ["revenue", "إدارة الإيرادات", "Revenue Management"], ["reconciliation", "المطابقة المصرفية", "Bank Reconciliation"], ["procurement", "المشتريات", "Procurement"], ["contracts", "العقود", "Contracts"], ["vendors", "الموردون", "Vendors"], ["inventory", "المخازن", "Inventory"], ["assets", "الأصول الثابتة", "Fixed Assets"], ["projects", "المشاريع", "Projects"], ["grants", "المنح", "Grants"], ["reporting", "التقارير المالية", "Financial Reporting"], ["audit", "دعم التدقيق", "Audit Support"],
  ].map(([id, titleAr, titleEn], index) => ({ id, titleAr, titleEn, state: index % 6 === 0 ? "attention" : "ready", count: 8 + ((index * 7 + active.pending) % 43) }));
  const visible = modules.filter((item) => (status === "all" || item.state === status) && `${item.titleAr} ${item.titleEn}`.toLowerCase().includes(query.toLowerCase()));
  const rows = [
    ["FIN-260805-041", "قيد إيراد خدمات", "Service revenue entry", 84_500_000, "مسوّى", "Reconciled"],
    ["FIN-260805-038", "دفعة مستفيدين", "Beneficiary payment batch", 126_000_000, "قيد الاعتماد", "Pending approval"],
    ["FIN-260805-031", "مستخلص مشروع", "Project certificate", 318_750_000, "مطابقة", "Matching"],
    ["FIN-260804-097", "أمر صرف تشغيلي", "Operating disbursement", 42_250_000, "مسوّى", "Reconciled"],
  ];
  const exportReport = () => {
    const csv = ["id,title,amount,status", ...rows.map(([id, titleAr, titleEn, amount, statusAr, statusEn]) => [id, ar ? titleAr : titleEn, amount, ar ? statusAr : statusEn].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `finance-${domain}.csv`; link.click(); URL.revokeObjectURL(url);
    toast(ar ? "تم تصدير التقرير المالي" : "Financial report exported");
  };
  const activeModule = modules.find((item) => item.id === selectedModule) ?? modules[0];
  const activeEntry = rows.find((item) => item[0] === selectedEntry) ?? rows[0];
  return <div className="page enterprise-finance-page"><SectionHeader eyebrow={ar ? "القسم الثامن عشر · الإدارة المالية والمؤسسية" : "SECTION 18 · FINANCIAL & INSTITUTIONAL MANAGEMENT"} title={ar ? "أربع ذمم مالية منفصلة، ورؤية تنفيذية موحّدة." : "Four separated financial domains, one executive view."} description={ar ? `آخر تحديث: ${refreshedAt}` : `Last refreshed: ${refreshedAt}`} action={<div className="section-actions"><button className="button button-secondary" onClick={() => setRefreshedAt(new Date().toLocaleTimeString())}>↻ {ar ? "تحديث" : "Refresh"}</button><button className="button button-primary" onClick={exportReport}>{ar ? "تصدير تقرير" : "Export report"} ↓</button></div>} />
    <div className="financial-separation-banner"><span>⚿</span><div><strong>{ar ? "ضابط الفصل المالي مفعّل" : "FINANCIAL SEGREGATION CONTROL ACTIVE"}</strong><p>{ar ? "لا يمكن ترحيل قيد من مجال إلى آخر دون مستند تسوية وموافقة وأثر تدقيقي." : "A journal cannot cross domains without a settlement document, approval and audit trail."}</p></div><MiniBadge tone="success">4/4</MiniBadge></div>
    <div className="finance-domain-tabs">{domains.map((item) => <button key={item.id} className={domain === item.id ? "active" : ""} onClick={() => setDomain(item.id)}><span>{item.mark}</span><p><strong>{ar ? item.ar : item.en}</strong><small>{num(item.pending, state.language)} {ar ? "عنصراً بانتظار الإجراء" : "items pending"}</small></p><i className="dir-icon" aria-hidden="true">←</i></button>)}</div>
    <div className="finance-kpis"><MetricCard label={ar ? "الرصيد التجريبي" : "Demo balance"} value={`${num(active.balance, state.language)} ${ar ? "د.ع" : "IQD"}`} icon="◈" /><MetricCard label={ar ? "إيرادات الفترة" : "Period inflow"} value={`${num(active.inflow, state.language)} ${ar ? "د.ع" : "IQD"}`} icon="↗" tone="gold" /><MetricCard label={ar ? "قيود بانتظار الاعتماد" : "Entries awaiting approval"} value={num(active.pending, state.language)} icon="◷" tone="navy" /><MetricCard label={ar ? "نسبة المطابقة" : "Reconciliation rate"} value={`${97.2 - domains.findIndex((item) => item.id === domain) * .6}%`} icon="✓" /></div>
    <div className="enterprise-module-layout"><section className="content-card enterprise-module-catalog"><header><div><span className="eyebrow">17 MODULES</span><h2>{ar ? "موديولات الإدارة المالية" : "Financial management modules"}</h2></div><div className="module-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "ابحث عن موديول…" : "Search modules…"} /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">{ar ? "كل الحالات" : "All states"}</option><option value="ready">{ar ? "جاهز للعرض" : "Demo ready"}</option><option value="attention">{ar ? "يحتاج انتباهاً" : "Needs attention"}</option></select></div></header><div className="enterprise-module-grid">{visible.map((item) => <button key={item.id} className={selectedModule === item.id ? "selected" : ""} onClick={() => setSelectedModule(item.id)}><span>{item.state === "ready" ? "✓" : "!"}</span><p><strong>{ar ? item.titleAr : item.titleEn}</strong><small>{num(item.count, state.language)} {ar ? "سجلاً تجريبياً" : "demo records"}</small></p><MiniBadge tone={item.state === "ready" ? "success" : "warning"}>{item.state === "ready" ? (ar ? "جاهز" : "Ready") : (ar ? "مراجعة" : "Review")}</MiniBadge><i className="dir-icon" aria-hidden="true">←</i></button>)}</div>{visible.length === 0 && <div className="empty-state compact"><span>⌕</span><h3>{ar ? "لا توجد نتائج" : "No matching modules"}</h3></div>}<article className="module-detail-panel"><span className="eyebrow">{activeModule.id.toUpperCase()}</span><h3>{ar ? activeModule.titleAr : activeModule.titleEn}</h3><p>{ar ? `${activeModule.count} سجلاً ضمن ${active.ar}` : `${activeModule.count} records in ${active.en}`}</p></article></section>
      <aside className="content-card finance-activity"><header><div><span className="eyebrow">LIVE LEDGER VIEW</span><h2>{ar ? "آخر الحركات" : "Recent movements"}</h2></div><button className="text-button" onClick={() => navigate("/admin/audit")}>{ar ? "سجل التدقيق" : "Audit trail"} ←</button></header>{rows.map(([id, titleAr, titleEn, amount, statusAr, statusEn]) => <button key={id as string} className={selectedEntry === id ? "selected" : ""} onClick={() => setSelectedEntry(String(id))}><span className="finance-entry-icon">↔</span><p><strong>{ar ? titleAr : titleEn}</strong><small dir="ltr">{id}</small></p><b>{num(amount as number, state.language)} {ar ? "د.ع" : "IQD"}</b><MiniBadge tone={statusAr === "مسوّى" ? "success" : "warning"}>{ar ? statusAr : statusEn}</MiniBadge></button>)}<div className="finance-entry-detail"><strong dir="ltr">{String(activeEntry[0])}</strong><span>{ar ? activeEntry[1] : activeEntry[2]}</span><b>{num(activeEntry[3] as number, state.language)} {ar ? "د.ع" : "IQD"}</b></div></aside></div>
  </div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AdministrativeSystemsPage({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [group, setGroup] = useState<"all" | "people" | "operations" | "assets" | "support">("all");
  const [query, setQuery] = useState("");
  const ticketOpen = state.administration.internalTicketOpen;
  const [selectedModule, setSelectedModule] = useState("hr");
  const [lastSynced, setLastSynced] = useState(new Date().toLocaleTimeString());
  const modules = [
    ["hr", "الموارد البشرية", "Human Resources", "people"], ["jobs", "هيكل الوظائف", "Job Structure", "people"], ["employees", "ملفات الموظفين", "Employee Files", "people"], ["attendance", "الحضور", "Attendance", "people"], ["leave", "الإجازات", "Leave", "people"], ["payroll", "الرواتب", "Payroll", "people"], ["training", "التدريب", "Training", "people"], ["performance", "تقييم الأداء", "Performance", "people"], ["tasks", "إدارة المهام", "Task Management", "operations"], ["projects", "إدارة المشاريع", "Project Management", "operations"], ["procurement", "المشتريات", "Procurement", "operations"], ["contracts", "العقود", "Contracts", "operations"], ["vendors", "الموردون", "Vendors", "operations"], ["inventory", "المخازن", "Inventory", "assets"], ["assets", "الأصول", "Assets", "assets"], ["vehicles", "المركبات", "Vehicles", "assets"], ["maintenance", "الصيانة", "Maintenance", "assets"], ["facilities", "المرافق", "Facilities", "assets"], ["internal-support", "خدمة الدعم الداخلي", "Internal Support", "support"], ["itsm", "التذاكر وITSM", "Ticketing & ITSM", "support"],
  ].map(([id, titleAr, titleEn, category], index) => ({ id, titleAr, titleEn, category, open: (index * 3 + 4) % 17, health: index % 7 === 0 ? "attention" : "healthy" }));
  const visible = modules.filter((item) => (group === "all" || item.category === group) && `${item.titleAr} ${item.titleEn}`.toLowerCase().includes(query.toLowerCase()));
  const groups = [["all", "الكل", "All"], ["people", "الموظفون", "People"], ["operations", "التشغيل", "Operations"], ["assets", "الأصول والمرافق", "Assets & facilities"], ["support", "الدعم وITSM", "Support & ITSM"]];
  const activeModule = modules.find((item) => item.id === selectedModule) ?? modules[0];
  return <div className="page administrative-systems-page"><SectionHeader eyebrow={ar ? "القسم التاسع عشر · الأنظمة الإدارية" : "SECTION 19 · ADMINISTRATIVE SYSTEMS"} title={ar ? "تشغيل المؤسسة من الموظف إلى تذكرة الدعم." : "Run the institution from employee records to support tickets."} description={ar ? `آخر مزامنة: ${lastSynced}` : `Last synchronized: ${lastSynced}`} action={<div className="section-actions"><button className="button button-secondary" onClick={() => { setLastSynced(new Date().toLocaleTimeString()); toast(ar ? "تمت مزامنة مؤشرات الأنظمة" : "System indicators synchronized"); }}>↻ {ar ? "مزامنة" : "Sync"}</button><button className="button button-primary" onClick={() => { setGroup("support"); setQuery(""); setSelectedModule("itsm"); }}>{ar ? "طلب دعم داخلي" : "Request support"} +</button></div>} />
    <div className="admin-system-kpis"><MetricCard label={ar ? "الموظفون النشطون" : "Active employees"} value={num(1248, state.language)} trend={ar ? "ملفات مؤسسية" : "institutional records"} icon="♧" /><MetricCard label={ar ? "الحضور اليوم" : "Attendance today"} value="91.6%" trend={ar ? "تحديث تجريبي" : "demo update"} icon="✓" /><MetricCard label={ar ? "المهام المفتوحة" : "Open tasks"} value={num(186, state.language)} trend={ar ? "٣٢ متأخرة" : "32 overdue"} icon="▤" tone="gold" /><MetricCard label={ar ? "تذاكر الدعم" : "Support tickets"} value={num(ticketOpen ? 23 : 22, state.language)} trend={ar ? "٥ عالية الأولوية" : "5 high priority"} icon="?" tone="navy" /></div>
    <div className="administrative-toolbar"><div className="manager-notification-filters">{groups.map(([id, labelAr, labelEn]) => <button key={id} className={group === id ? "active" : ""} onClick={() => setGroup(id as typeof group)}>{ar ? labelAr : labelEn}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "ابحث في الأنظمة الإدارية…" : "Search administrative systems…"} /></div>
    <section className="administrative-content"><div><div className="enterprise-module-grid administrative-modules">{visible.map((item) => <button key={item.id} className={selectedModule === item.id ? "selected" : ""} onClick={() => setSelectedModule(item.id)}><span>{item.health === "healthy" ? "✓" : "!"}</span><p><strong>{ar ? item.titleAr : item.titleEn}</strong><small>{num(item.open, state.language)} {ar ? "عنصراً مفتوحاً" : "open items"}</small></p><MiniBadge tone={item.health === "healthy" ? "success" : "warning"}>{item.health === "healthy" ? (ar ? "سليم" : "Healthy") : (ar ? "متابعة" : "Attention")}</MiniBadge><i className="dir-icon" aria-hidden="true">←</i></button>)}</div><article className="content-card module-detail-panel"><span className="eyebrow">{activeModule.id.toUpperCase()}</span><h2>{ar ? activeModule.titleAr : activeModule.titleEn}</h2><p>{ar ? `يعرض ${activeModule.open} عنصراً مفتوحاً ويمكن تصفيته من القائمة أعلاه.` : `Shows ${activeModule.open} open items and responds to the filters above.`}</p><MiniBadge tone={activeModule.health === "healthy" ? "success" : "warning"}>{activeModule.health}</MiniBadge></article></div>
      <aside className="administrative-side-stack"><article className="content-card internal-ticket"><header><div><span className="eyebrow">ITSM-2026-118</span><h2>{ar ? "تذكرة دعم داخلي" : "Internal support ticket"}</h2></div><MiniBadge tone={ticketOpen ? "warning" : "success"}>{ticketOpen ? (ar ? "قيد المعالجة" : "In progress") : (ar ? "تم الحل" : "Resolved")}</MiniBadge></header><p>{ar ? "تعذر اعتماد طلب إجازة بعد نقل الموظف إلى مديرية جديدة." : "A leave request cannot be approved after the employee moved to a new directorate."}</p><div className="ticket-facts"><span>{ar ? "الأولوية" : "Priority"}<strong>{ar ? "عالية" : "High"}</strong></span><span>SLA<strong>{ticketOpen ? "01:42" : "00:00"}</strong></span><span>{ar ? "المسؤول" : "Owner"}<strong>{ar ? "فريق تطبيقات الموارد" : "HR Apps Team"}</strong></span></div><button className="button button-primary button-full" disabled={!ticketOpen} onClick={() => { setState((previous) => ({ ...previous, administration: { ...previous.administration, internalTicketOpen: false } })); toast(ar ? "تم حل التذكرة وتسجيل الإجراء" : "Ticket resolved and action logged"); }}>✓ {ticketOpen ? (ar ? "حل وإغلاق التذكرة" : "Resolve and close") : (ar ? "التذكرة مغلقة" : "Ticket closed")}</button></article><article className="content-card administrative-alerts"><h2>{ar ? "تنبيهات تشغيلية" : "Operational alerts"}</h2>{[["!", "٣٢ مهمة تجاوزت موعدها", "32 tasks are overdue", "tasks"], ["◷", "٧ عقود تنتهي خلال ٣٠ يوماً", "7 contracts expire within 30 days", "contracts"], ["⚿", "٤ مركبات تحتاج صيانة دورية", "4 vehicles need scheduled maintenance", "vehicles"]].map(([icon, titleAr, titleEn, moduleId]) => <button key={titleAr} onClick={() => { setGroup("all"); setQuery(""); setSelectedModule(moduleId); }}><span>{icon}</span><strong>{ar ? titleAr : titleEn}</strong><i className="dir-icon" aria-hidden="true">←</i></button>)}</article></aside></section>
  </div>;
}

function ExecutiveResilience({
  state,
  navigate,
  toast,
}: {
  state: DemoState;
  navigate: (path: string) => void;
  toast: (message: string) => void;
}) {
  const ar = state.language === "ar";
  const [scope, setScope] = useState<"attention" | "all">("attention");
  const [selectedId, setSelectedId] = useState("bank");
  const impactProfiles: Record<string, {
    services: number;
    transactions: number;
    durationAr: string;
    durationEn: string;
    impactAr: string;
    impactEn: string;
    actionAr: string;
    actionEn: string;
  }> = {
    bank: {
      services: 3,
      transactions: 142,
      durationAr: "٣ ساعات و١٢ دقيقة",
      durationEn: "3h 12m",
      impactAr: "توقفت التسوية الآلية لسبع دفعات تجريبية، دون فقدان أي معاملة.",
      impactEn: "Automated reconciliation stopped for seven demo payments; no transaction was lost.",
      actionAr: "التحويل إلى المطابقة اليدوية وتأكيد خطة الاستعادة مع الفريق المالي.",
      actionEn: "Use manual matching and confirm the recovery plan with the finance team.",
    },
    education: {
      services: 4,
      transactions: 318,
      durationAr: "٣٤ دقيقة",
      durationEn: "34 minutes",
      impactAr: "تأخر التحقق الدراسي، مع زيادة متوقعة قدرها ٠٫٧ يوم على زمن الخدمة.",
      impactEn: "Education verification is delayed, adding an estimated 0.7 day to service time.",
      actionAr: "الإبقاء على الطلبات في الطابور وتفعيل التحقق اليدوي للحالات العاجلة.",
      actionEn: "Keep requests queued and use manual verification for urgent cases.",
    },
    email: {
      services: 20,
      transactions: 486,
      durationAr: "١٨ دقيقة",
      durationEn: "18 minutes",
      impactAr: "بعض رسائل البريد متأخرة؛ إشعارات المنصة والرسائل القصيرة ما زالت تعمل.",
      impactEn: "Some email messages are delayed; in-app and SMS channels remain available.",
      actionAr: "توجيه الإشعارات الحرجة إلى الرسائل القصيرة حتى استقرار البريد.",
      actionEn: "Route critical notifications to SMS until email stabilizes.",
    },
  };
  const affected = integrations.filter((adapter) => adapter.status !== "healthy");
  const visible = scope === "attention" ? affected : integrations;
  const selected = integrations.find((adapter) => adapter.id === selectedId) ?? affected[0];
  const selectedImpact = impactProfiles[selected.id] ?? {
    services: 0,
    transactions: 0,
    durationAr: "لا يوجد انقطاع",
    durationEn: "No outage",
    impactAr: "لا يوجد أثر تشغيلي مسجل على الخدمات.",
    impactEn: "No recorded operational impact on services.",
    actionAr: "لا يلزم إجراء تنفيذي حالياً.",
    actionEn: "No executive action is currently required.",
  };
  const readiness = Math.round(
    integrations.reduce((total, adapter) => total + adapter.successRate, 0) /
      integrations.length,
  );
  return (
    <div className="page resilience-page">
      <SectionHeader
        eyebrow={ar ? "مكتب رئيس المؤسسة · استمرارية الخدمة" : "PRESIDENT OFFICE · SERVICE CONTINUITY"}
        title={ar ? "جاهزية الأنظمة من منظور أثرها على المواطن." : "System readiness through its impact on citizens."}
        description={ar ? "ملخص تنفيذي يوضح الخدمات والمعاملات المتأثرة وخطة الاستعادة، من دون تفاصيل إعدادات تقنية." : "An executive view of affected services, transactions, and recovery actions without technical configuration detail."}
        action={<button className="button button-secondary" onClick={() => navigate("/executive")}>{ar ? "العودة للوحة التنفيذية" : "Back to dashboard"} ←</button>}
      />
      <div className="resilience-status-banner">
        <span className="resilience-pulse">!</span>
        <div><strong>{ar ? "الخدمات الأساسية مستمرة مع حادثة حرجة واحدة" : "Core services continue with one critical incident"}</strong><p>{ar ? "لا يوجد فقدان بيانات. قنوات بديلة مفعلة، وحادثة التسوية المصرفية قيد التصعيد." : "No data loss. Fallback channels are active and the banking reconciliation incident is escalated."}</p></div>
        <MiniBadge tone="warning">{ar ? "مراقبة تنفيذية" : "Executive watch"}</MiniBadge>
      </div>
      <div className="metric-grid metric-grid-4">
        <MetricCard label={ar ? "الجاهزية العامة" : "Overall readiness"} value={`${readiness}%`} trend={ar ? "آخر ٢٤ ساعة" : "last 24 hours"} icon="✓" />
        <MetricCard label={ar ? "أنظمة تحتاج انتباهاً" : "Systems needing attention"} value={num(affected.length, state.language)} trend={ar ? "من أصل ٧" : "of 7"} icon="!" tone="red" />
        <MetricCard label={ar ? "معاملات متأثرة" : "Affected transactions"} value={num(946, state.language)} trend={ar ? "دون فقدان بيانات" : "no data loss"} icon="▤" tone="gold" />
        <MetricCard label={ar ? "الخدمات مستمرة" : "Services continuing"} value="20/20" trend={ar ? "عبر مسارات بديلة" : "via fallback paths"} icon="↔" tone="navy" />
      </div>
      <div className="resilience-toolbar">
        <div className="table-tabs">
          <button className={scope === "attention" ? "active" : ""} onClick={() => setScope("attention")}>{ar ? "تحتاج انتباهاً" : "Needs attention"} <b>{affected.length}</b></button>
          <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>{ar ? "كل الأنظمة" : "All systems"} <b>{integrations.length}</b></button>
        </div>
        <span>{ar ? "آخر تحديث: الآن · بيانات تجريبية" : "Updated now · demo data"}</span>
      </div>
      <section className="resilience-layout">
        <article className="content-card resilience-list">
          <header><div><span className="eyebrow">{ar ? "الأثر على الأعمال" : "BUSINESS IMPACT"}</span><h2>{ar ? "الأنظمة حسب أولوية التدخل" : "Systems by intervention priority"}</h2></div></header>
          {visible.map((adapter) => {
            const impact = impactProfiles[adapter.id];
            return (
              <button key={adapter.id} className={selected.id === adapter.id ? "active" : ""} onClick={() => setSelectedId(adapter.id)}>
                <span className={`resilience-state state-${adapter.status}`}>{adapter.status === "healthy" ? "✓" : adapter.status === "failed" ? "×" : "!"}</span>
                <p><strong>{ar ? adapter.nameAr : adapter.nameEn}</strong><small>{impact ? (ar ? `${impact.services} خدمات · ${impact.transactions} معاملة` : `${impact.services} services · ${impact.transactions} transactions`) : (ar ? "لا يوجد أثر تشغيلي" : "No operational impact")}</small></p>
                <MiniBadge tone={adapter.status === "healthy" ? "success" : adapter.status === "failed" ? "danger" : "warning"}>{adapter.status === "healthy" ? (ar ? "مستقر" : "Stable") : adapter.status === "failed" ? (ar ? "حرج" : "Critical") : (ar ? "متأثر" : "Affected")}</MiniBadge>
                <i className="dir-icon" aria-hidden="true">←</i>
              </button>
            );
          })}
        </article>
        <article className="content-card resilience-detail">
          <header>
            <div><span className="eyebrow">{ar ? "ملخص الحادثة المحددة" : "SELECTED INCIDENT BRIEF"}</span><h2>{ar ? selected.nameAr : selected.nameEn}</h2></div>
            <MiniBadge tone={selected.status === "failed" ? "danger" : selected.status === "healthy" ? "success" : "warning"}>● {selected.status}</MiniBadge>
          </header>
          <div className="impact-number-grid">
            <div><span>{ar ? "الخدمات المتأثرة" : "Affected services"}</span><strong>{selectedImpact.services}</strong></div>
            <div><span>{ar ? "المعاملات المتأثرة" : "Affected transactions"}</span><strong>{num(selectedImpact.transactions, state.language)}</strong></div>
            <div><span>{ar ? "مدة الحالة" : "Incident duration"}</span><strong>{ar ? selectedImpact.durationAr : selectedImpact.durationEn}</strong></div>
          </div>
          <section><span className="eyebrow">{ar ? "ماذا يعني ذلك للمؤسسة؟" : "WHAT DOES THIS MEAN?"}</span><p>{ar ? selectedImpact.impactAr : selectedImpact.impactEn}</p></section>
          <section className="executive-action-note"><span>◇</span><div><strong>{ar ? "الإجراء التنفيذي المقترح" : "Recommended executive action"}</strong><p>{ar ? selectedImpact.actionAr : selectedImpact.actionEn}</p></div></section>
          <div className="resilience-ownership">
            <div><span>{ar ? "مالك الاستعادة" : "Recovery owner"}</span><strong>{selected.ownerAr}</strong></div>
            <div><span>{ar ? "حالة التصعيد" : "Escalation state"}</span><strong>{selected.status === "failed" ? (ar ? "مرفوع إلى المستوى ٢" : "Escalated to level 2") : selected.status === "healthy" ? (ar ? "لا يوجد تصعيد" : "No escalation") : (ar ? "متابعة تشغيلية" : "Operational monitoring")}</strong></div>
          </div>
          <footer>
            <button className="button button-secondary" onClick={() => toast(ar ? "تم تسجيل اطلاع مكتب الرئيس" : "President Office acknowledgement recorded")}>✓ {ar ? "تأكيد الاطلاع" : "Acknowledge"}</button>
            <button className="button button-primary" onClick={() => toast(ar ? "أُرسل طلب تحديث تنفيذي إلى الفريق المسؤول" : "Executive update request sent to the responsible team")}>{ar ? "طلب تحديث من الفريق" : "Request team update"} ←</button>
          </footer>
        </article>
      </section>
      <section className="content-card resilience-governance">
        <span>⚿</span>
        <div><strong>{ar ? "الفصل بين الرؤية التنفيذية والإدارة التقنية" : "Executive and technical views are separated"}</strong><p>{ar ? "يعرض مكتب الرئيس الأثر والاستمرارية والتصعيد. تبقى السجلات التقنية والإصدارات والمحاولات وإعدادات المحولات ضمن صلاحيات مدير المنصة." : "The President Office sees impact, continuity, and escalation. Logs, versions, retries, and adapter configuration remain within the Platform Administrator role."}</p></div>
      </section>
    </div>
  );
}

function PaymentsPage({ state, setState, serviceId, navigate, toast, addAudit }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; serviceId: string; navigate: (path: string) => void; toast: (message: string) => void; addAudit: (ar: string, en: string, source?: AuditEvent["source"]) => void }) {
  const ar = state.language === "ar";
  const service = services.find((item) => item.id === serviceId) ?? services.find((item) => item.id === "official-certificate") ?? services[0];
  const [modal, setModal] = useState(false);
  const run = (outcome: DemoState["payment"]["status"]) => {
    const result = simulatePayment({ ...state.payment, amount: service.feeIqd }, outcome, `idem-${service.id}-0912`);
    setState((previous) => ({ ...previous, payment: result.payment }));
    addAudit(result.duplicatePrevented ? "منع محاولة دفع مكررة بالمفتاح نفسه" : `محاكاة تحديث الدفع إلى ${outcome}`, result.duplicatePrevented ? "Duplicate payment prevented with the same key" : `Payment simulated as ${outcome}`, "payment");
    toast(result.duplicatePrevented ? (ar ? "مُنعت دفعة مكررة — لم يحدث خصم" : "Duplicate prevented — no charge") : (ar ? "تمت محاكاة رد الويب هوك بنجاح" : "Webhook outcome simulated"));
    setModal(false);
  };
  return <div className="page payments-page"><SectionHeader eyebrow={ar ? "مدفوعات المستفيدين · الإدارة المالية" : "BENEFICIARY PAYMENTS · FINANCIAL MANAGEMENT"} title={ar ? "دفع الرسوم عند وجودها" : "Pay fees when applicable"} description={ar ? "لا تظهر هذه الخطوة إلا للخدمة التي تحتوي تهيئة رسوم. الخدمات ذات الرسم صفر تتجاوزها تلقائياً إلى نموذج الطلب." : "This step appears only when a service has a configured fee. Zero-fee services bypass it and continue to the application form."} /><div className="payment-journey-strip"><span className="done">✓ {ar ? "التحقق الأولي" : "Initial eligibility"}</span><i /><span className="active">2 {ar ? "الرسوم" : "Fee"}</span><i /><span>3 {ar ? "نموذج الطلب" : "Application"}</span></div><div className="legal-demo-banner">! <strong>{ar ? "تهيئة عرض فقط — ليست رسماً قانونياً معتمداً ولا صالحة للتحصيل الحقيقي." : "Demo configuration only — not an approved legal fee and not valid for real collection."}</strong></div><section className="payment-layout"><article className="invoice-card"><header><div><span className="eyebrow">{ar ? "فاتورة تجريبية" : "DEMO INVOICE"}</span><h2>{ar ? service.titleAr : service.titleEn}</h2><p dir="ltr">{state.payment.invoice}</p></div><MiniBadge tone={state.payment.status === "successful" ? "success" : state.payment.status === "failed" ? "danger" : "warning"}>{state.payment.status}</MiniBadge></header><div className="invoice-lines"><div><span>{ar ? "رسم الخدمة المهيأ" : "Configured service fee"}</span><strong>{num(service.feeIqd, state.language)} {ar ? "د.ع" : "IQD"}</strong></div><div><span>{ar ? "أجور إضافية" : "Additional charges"} </span><strong>{num(0, state.language)} {ar ? "د.ع" : "IQD"}</strong></div><div className="invoice-total"><span>{ar ? "الإجمالي" : "Total"}</span><strong>{num(service.feeIqd, state.language)} {ar ? "د.ع" : "IQD"}</strong></div></div><div className="idempotency"><span>⌁</span><div><small>{ar ? "مفتاح منع التكرار" : "IDEMPOTENCY KEY"}</small><strong dir="ltr">{`idem-${service.id}-0912`}</strong></div><MiniBadge tone="success">✓ {ar ? "محمي" : "Protected"}</MiniBadge></div><button className="button button-primary button-full" onClick={() => setModal(true)}>{ar ? "فتح محاكي الدفع" : "Open payment simulator"} ◈</button>{state.payment.status === "successful" && <><button className="button button-primary button-full" onClick={() => navigate(`/citizen/applications/new/${service.id}`)}>{ar ? "متابعة إلى نموذج الطلب" : "Continue to application"} ←</button><button className="button button-secondary button-full" onClick={() => window.print()}>{ar ? "طباعة الإيصال الإلكتروني" : "Print electronic receipt"} ⎙</button></>}</article><aside><article className="content-card adapter-status"><header><span>↔</span><div><small>PAYMENT KIT ONE</small><strong>{ar ? "محول معزول — Sandbox" : "Isolated adapter — Sandbox"}</strong></div><MiniBadge tone="success">● {ar ? "متصل" : "Connected"}</MiniBadge></header><div className="summary-facts"><div><span>{ar ? "آخر رد" : "Last callback"}</span><strong>{localDate(state.payment.updatedAt, state.language)}</strong></div><div><span>{ar ? "التسوية" : "Reconciliation"}</span><strong>{state.payment.reconciled ? (ar ? "مطابق" : "Matched") : (ar ? "معلق" : "Pending")}</strong></div></div></article><article className="content-card revenue-config"><span className="eyebrow">{ar ? "توزيع الإيراد — تهيئة غير قانونية" : "REVENUE DISTRIBUTION — NON-LEGAL DEMO"}</span><h3>{ar ? "قواعد قابلة للتهيئة" : "Configurable distribution"}</h3>{[["حساب الخدمة", 70], ["صندوق تجريبي", 20], ["أجور تشغيل", 10]].map(([label, value]) => <div key={label as string}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}%</strong></div>)}<p>{ar ? "هذه النسب افتراضية لإظهار القابلية للتهيئة ولا تمثل قانوناً." : "Percentages are fictional and demonstrate configurability only."}</p></article></aside></section>{modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><section className="modal payment-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><header><div><span className="eyebrow">PAYMENT KIT ONE · SANDBOX</span><h2>{ar ? "اختر نتيجة المحاكاة" : "Choose a simulated outcome"}</h2></div><button className="icon-button" onClick={() => setModal(false)}>×</button></header><div className="fake-token"><span>{ar ? "رمز دفع خيالي" : "Fictional payment token"}</span><strong dir="ltr">tok_demo_mf_000184</strong></div><p>{ar ? "لا تُدخل رقم بطاقة أو حساب. هذه الأزرار تولّد حالات محلية فقط." : "Do not enter card or account data. These buttons only produce local demo states."}</p><div className="payment-outcomes">{(["successful", "failed", "pending", "expired", "refunded"] as const).map((outcome) => <button key={outcome} onClick={() => run(outcome)} className={`outcome-${outcome}`}>{outcome === "successful" ? "✓" : outcome === "failed" ? "×" : outcome === "pending" ? "◷" : "↻"}<strong>{outcome}</strong></button>)}</div><button className="duplicate-button" onClick={() => run("successful")}>⌁ {ar ? "إعادة إرسال المفتاح نفسه لاختبار منع التكرار" : "Resend same key to test duplicate prevention"}</button></section></div>}</div>;
}

function StudioPage({ state, setState, route, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; route: string; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  if (route.includes("/workflows/")) return <WorkflowStudio state={state} setState={setState} toast={toast} />;
  if (route.includes("/integrations")) return <IntegrationStudio state={state} toast={toast} />;
  if (route.includes("/versions")) return <VersionStudio state={state} setState={setState} toast={toast} />;
  if (route.includes("/rules/")) return <RulesStudio state={state} setState={setState} toast={toast} />;
  if (route.includes("/forms/")) return <FormStudio state={state} setState={setState} toast={toast} />;
  if (route.includes("/notifications")) return <TemplateStudio state={state} setState={setState} toast={toast} />;
  return <div className="page studio-home"><div className="production-warning">⚿ <strong>{ar ? "التعديل المباشر على الإنتاج محظور" : "Direct production editing is prohibited"}</strong><span>{ar ? "كل تغيير يمر بمراجعة قانونية وUAT واعتماد قبل النشر." : "Every change passes legal review, UAT and approval before publish."}</span></div><SectionHeader eyebrow={ar ? "استوديو الخدمات الرقمية" : "DIGITAL SERVICE STUDIO"} title={ar ? "صمّم الخدمة كمنتج مترابط، لا كشاشات منفصلة." : "Design a connected service, not isolated screens."} description={ar ? "البيانات والنموذج والقواعد والمسار والإشعار والإصدار في مساحة بصرية واحدة." : "Metadata, form, rules, workflow, notifications and versions in one visual workspace."} action={<button className="button button-primary" onClick={() => toast(ar ? "تم إنشاء نسخة مسودة جديدة" : "New draft version created")}>{ar ? "نسخة خدمة جديدة" : "New service version"} +</button>} /><section className="studio-service-hero"><div className="service-icon service-icon-1">◇</div><div><MiniBadge tone="gold">EDU-GRANT · v2.4</MiniBadge><h2>{ar ? "منحة تعليمية لأحد أفراد الأسرة" : "Family Education Grant"}</h2><p>{ar ? "خدمة منشورة · العربية والإنجليزية · ١٢ يوم عمل · ٤ وثائق" : "Published service · Arabic and English · 12 days · 4 documents"}</p></div><div className="version-pipeline"><span className="done">✓ {ar ? "مسودة" : "Draft"}</span><i /><span className="done">✓ {ar ? "مراجعة" : "Review"}</span><i /><span className="active">{ar ? "UAT" : "UAT"}</span><i /><span>{ar ? "معتمد" : "Approved"}</span><i /><span>{ar ? "منشور" : "Published"}</span></div></section><div className="studio-module-grid">{[["▦", "منشئ النموذج", "Form builder", "٥ أقسام · ٢١ حقلاً · ٣ شروط", "5 sections · 21 fields · 3 conditions"], ["⌁", "مسار العمل", "Workflow designer", "٩ عقد · حلقة استكمال واحدة", "9 nodes · one completion loop"], ["◇", "قواعد الأهلية", "Eligibility rules", "٤ قواعد فعّالة · نسخة 2.3", "4 active rules · version 2.3"], ["✉", "قوالب الإشعار", "Notification templates", "٨ قوالب · عربي / إنجليزي", "8 templates · Arabic / English"], ["◷", "المهلة والتصعيد", "SLA & escalation", "١٢ يوم · مستويان للتصعيد", "12 days · 2 escalation levels"], ["≛", "الإصدارات والنشر", "Versions & release", "v2.4 في UAT · v2.3 منشورة", "v2.4 in UAT · v2.3 published"]].map(([icon, titleAr, titleEn, detailAr, detailEn], index) => <button key={titleAr} onClick={() => { window.history.pushState({}, "", ["/studio/forms/education-grant", "/studio/workflows/education-grant", "/studio/rules/education-grant", "/studio/notifications", "/studio/versions", "/studio/versions"][index]); window.dispatchEvent(new PopStateEvent("popstate")); }}><span>{icon}</span><div><strong>{ar ? titleAr : titleEn}</strong><small>{ar ? detailAr : detailEn}</small></div><i className="dir-icon" aria-hidden="true">←</i></button>)}</div><section className="content-card config-audit"><header><h2>{ar ? "آخر تغييرات التهيئة" : "Recent configuration changes"}</h2><MiniBadge tone="info">{ar ? "أثر تدقيقي كامل" : "Fully audited"}</MiniBadge></header>{[["سارة جاسم", "عدلت مهلة التصعيد من ٣ إلى يومين", "منذ ساعتين"], ["المستشار القانوني", "اعتمد مرجع LR-EDU-11", "أمس"], ["مسؤول النظام", "أنشأ نسخة v2.4", "قبل ٣ أيام"]].map(([actor, action, time], index) => <div key={action}><span className="avatar avatar-small">{actor.slice(0, 2)}</span><p><strong>{action}</strong><small>{actor} · {time}</small></p><span dir="ltr">CFG-26010{index}</span></div>)}</section></div>;
}

const workflowNodes = [
  ["draft", "مسودة", "Draft", 1, 1],
  ["complete", "اكتمال المواطن", "Citizen completes", 2, 1],
  ["submit", "إرسال للموظف", "Submit to staff", 3, 1],
  ["review", "مراجعة الموظف", "Staff review", 4, 1],
  ["completion", "إعادة للمواطن", "Return to citizen", 4, 2],
  ["manager", "مدير المديرية", "Directorate manager", 5, 1],
  ["committee", "مراجعة اللجنة", "Committee review", 6, 1],
  ["decision", "القرار", "Decision", 7, 1],
  ["notify", "إشعار وإغلاق", "Notify & close", 8, 1],
];

function WorkflowStudio({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const selected = workflowNodes.find((node) => node[0] === state.selectedWorkflowNode) ?? workflowNodes[0];
  const runtimeNode: Record<string, string> = { Draft: "draft", Submitted: "submit", "Under Validation": "submit", "Under Review": "review", "Awaiting Citizen Completion": "completion", "Manager Review": "manager", Referred: "manager", "Committee Review": "committee", "Awaiting Approval": "decision", Approved: "notify", Rejected: "decision", Completed: "notify" };
  const activeNode = runtimeNode[state.case.status] ?? "draft";
  const owner: Record<string, [string, string]> = { draft: ["المواطن", "Citizen"], complete: ["المواطن", "Citizen"], submit: ["النظام", "System"], review: ["الموظف", "Staff"], completion: ["المواطن", "Citizen"], manager: ["مدير المديرية", "Directorate Manager"], committee: ["اللجنة", "Committee"], decision: ["اللجنة", "Committee"], notify: ["النظام", "System"] };
  return <div className="studio-canvas-page"><header className="studio-toolbar"><div><span className="eyebrow">{ar ? "المسار التشغيلي / EDU-WF-2.4" : "RUNTIME WORKFLOW / EDU-WF-2.4"}</span><h1>{ar ? "من المواطن حتى القرار" : "Citizen to final decision"}</h1></div><div><MiniBadge tone="info">{ar ? statusLabels[state.case.status].ar : statusLabels[state.case.status].en}</MiniBadge><button className="button button-secondary" onClick={() => toast(ar ? "كل التغييرات محفوظة في قاعدة الـPOC" : "All changes are persisted in the POC database")}>{ar ? "تأكيد الحفظ" : "Confirm saved"}</button><button className="button button-primary" disabled={state.serviceVersion !== "Draft"} onClick={() => { setState((previous) => ({ ...previous, serviceVersion: "Review" })); toast(ar ? "انتقلت نسخة المسار إلى المراجعة" : "Workflow version moved to review"); }}>{state.serviceVersion === "Draft" ? (ar ? "إرسال للمراجعة" : "Send for review") : (ar ? "أُرسلت للمراجعة" : "Sent to review")} ←</button></div></header><div className="workflow-layout"><aside className="node-library"><span className="eyebrow">{ar ? "ترتيب المسؤوليات" : "OWNERSHIP"}</span>{workflowNodes.map(([id, labelAr, labelEn], index) => <div key={String(id)} className={activeNode === id ? "active" : ""}><span>{index + 1}</span><p><strong>{ar ? labelAr : labelEn}</strong><small>{ar ? owner[String(id)]?.[0] : owner[String(id)]?.[1]}</small></p></div>)}</aside><main className="workflow-canvas"><div className="canvas-grid" /><div className="workflow-flow">{workflowNodes.map(([id, labelAr, labelEn, column, row]) => <button key={String(id)} className={`workflow-node node-${id} ${state.selectedWorkflowNode === id ? "selected" : ""} ${activeNode === id ? "runtime-active" : ""}`} style={{ gridColumn: Number(column), gridRow: Number(row) }} onClick={() => setState((previous) => ({ ...previous, selectedWorkflowNode: String(id) }))}><span>{id === "decision" ? "◇" : id === "notify" ? "✉" : id === "completion" ? "↩" : "▤"}</span><strong>{ar ? labelAr : labelEn}</strong><small>{activeNode === id ? (ar ? "المرحلة الحالية" : "Current stage") : id === "review" ? "SLA 48h" : id === "completion" ? (ar ? "حلقة رجوع" : "Return loop") : "auto"}</small></button>)}</div><div className="flow-legend"><span><i className="emerald" />{ar ? "المسار الأساسي" : "Primary path"}</span><span><i className="gold" />{ar ? "حلقة الاستكمال" : "Completion loop"}</span></div></main><aside className="node-inspector"><header><span className="eyebrow">{ar ? "العقدة المختارة" : "SELECTED NODE"}</span><h2>{ar ? selected[1] : selected[2]}</h2><small>{String(selected[0]).toUpperCase()}-NODE</small></header><div className="summary-facts"><div><span>{ar ? "المسؤول" : "Owner"}</span><strong>{ar ? owner[String(selected[0])]?.[0] : owner[String(selected[0])]?.[1]}</strong></div><div><span>{ar ? "الحالة الحالية" : "Runtime status"}</span><strong>{activeNode === selected[0] ? (ar ? "نشطة" : "Active") : (ar ? "غير نشطة" : "Inactive")}</strong></div></div><div className="condition-builder"><span>{ar ? "شرط الدخول" : "ENTRY CONDITION"}</span><p><b>IF</b> case.status <em>=</em> {String(selected[0])}</p></div><div className="inspector-warning">⚿ {ar ? "هذا الرسم يتبع حالة المعاملة الفعلية المحفوظة." : "This canvas follows the persisted case status."}</div></aside></div></div>;
}

function FormStudio({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const fields = state.studioForm.fields;
  const move = (index: number, direction: number) => {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setState((previous) => ({ ...previous, studioForm: { ...previous.studioForm, fields: next } }));
    toast(ar ? "تم تغيير ترتيب الحقول" : "Field order updated");
  };
  const addField = (field: string) => {
    const label = fields.includes(field) ? `${field} ${fields.filter((item) => item.startsWith(field)).length + 1}` : field;
    setState((previous) => ({ ...previous, studioForm: { ...previous.studioForm, fields: [...previous.studioForm.fields, label], selectedField: label } }));
    toast(ar ? "تمت إضافة الحقل وحفظه" : "Field added and saved");
  };
  return <div className="studio-canvas-page"><header className="studio-toolbar"><div><span className="eyebrow">{ar ? "منشئ النموذج / v2.4" : "FORM BUILDER / v2.4"}</span><h1>{ar ? "نموذج طلب المنحة التعليمية" : "Education Grant Form"}</h1></div><div><MiniBadge tone="warning">{ar ? "مسودة" : "Draft"}</MiniBadge><button className="button button-primary" onClick={() => toast(ar ? "النموذج محفوظ في قاعدة الـPOC" : "Form is saved in the POC database")}>{ar ? "تأكيد الحفظ" : "Confirm saved"}</button></div></header><div className="form-builder-layout"><aside className="field-library"><span className="eyebrow">{ar ? "مكتبة الحقول" : "FIELD LIBRARY"}</span>{["نص قصير", "قائمة اختيار", "تاريخ", "رفع وثيقة", "مجموعة مشروطة", "موافقة"].map((field, index) => <button key={field} onClick={() => addField(field)}><span>{["T", "⌄", "◷", "↑", "◇", "✓"][index]}</span>{field}<i>+</i></button>)}</aside><main className="form-canvas"><div className="canvas-device"><header><span>1</span><div><h2>{ar ? "بيانات المستفيدة" : "Beneficiary data"}</h2><p>{ar ? "الحقول الموثّقة للقراءة فقط." : "Verified fields are read-only."}</p></div></header>{fields.map((field, index) => <div className={`builder-field ${state.studioForm.selectedField === field ? "selected" : ""}`} key={field}><i>⠿</i><label><span>{field}</span><input value={index === 0 ? "زينب علي حسن" : index === 1 ? "BEN-10024" : index === 2 ? "بغداد" : "فرد أسرة مسجل"} readOnly /></label><div><button onClick={() => move(index, -1)}>↑</button><button onClick={() => move(index, 1)}>↓</button><button onClick={() => setState((previous) => ({ ...previous, studioForm: { ...previous.studioForm, selectedField: field } }))}>⚙</button></div></div>)}<button className="add-section" onClick={() => addField(ar ? "قسم جديد" : "New section")}>+ {ar ? "إضافة حقل أو قسم" : "Add field or section"}</button></div></main><aside className="field-inspector"><span className="eyebrow">{ar ? "خصائص الحقل" : "FIELD PROPERTIES"}</span><h2>{state.studioForm.selectedField}</h2><label className="input-field"><span>{ar ? "المفتاح" : "Key"}</span><input value={state.studioForm.selectedField.toLowerCase().replaceAll(" ", "_")} readOnly /></label><label><input type="checkbox" checked={state.studioForm.readOnlyVerified} onChange={(event) => setState((previous) => ({ ...previous, studioForm: { ...previous.studioForm, readOnlyVerified: event.target.checked } }))} /> {ar ? "للقراءة فقط عند التحقق" : "Read-only when verified"}</label><label><input type="checkbox" checked={state.studioForm.showSource} onChange={(event) => setState((previous) => ({ ...previous, studioForm: { ...previous.studioForm, showSource: event.target.checked } }))} /> {ar ? "إظهار شارة المصدر" : "Show source badge"}</label><div className="condition-builder"><span>{ar ? "قاعدة الظهور" : "VISIBILITY RULE"}</span><p><b>IF</b> profile.verified <em>= true</em></p></div></aside></div></div>;
}

function RulesStudio({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const navigateStudio = (path: string) => { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); };
  return <div className="page rules-studio"><div className="production-warning">⚿ <strong>{ar ? "قواعد العرض ليست قانوناً نافذاً" : "Demo rules are not authoritative law"}</strong><span>{ar ? "يجب ربط كل قاعدة بمرجع معتمد ومراجعة قانونية في الإنتاج." : "Production rules require authoritative legal references and legal review."}</span></div><SectionHeader eyebrow="EDU-ELIG-2.3" title={ar ? "مصمم قواعد الأهلية" : "Eligibility rules designer"} description={state.ruleDraftCount ? (ar ? `${state.ruleDraftCount} قواعد مسودة محفوظة` : `${state.ruleDraftCount} saved draft rules`) : (ar ? "شروط IF/THEN مقروءة، مؤرخة، ومفسّرة." : "Readable, effective-dated and explainable IF/THEN rules.")} action={<button className="button button-primary" onClick={() => { setState((previous) => ({ ...previous, ruleDraftCount: previous.ruleDraftCount + 1 })); toast(ar ? "تم إنشاء قاعدة مسودة وحفظها" : "Draft rule created and saved"); }}>{ar ? "قاعدة جديدة" : "New rule"} +</button>} /><div className="rule-builder-list">{evaluateEligibility(state.case).map((result, index) => <article key={result.id}><header><span>{index + 1}</span><div><h3>{ar ? result.nameAr : result.nameEn}</h3><small>{result.version} · {result.legalRef} · {ar ? "فعال من ١ كانون الثاني ٢٠٢٦" : "Effective 1 Jan 2026"}</small></div><MiniBadge tone={state.testedRuleIds.includes(result.id) ? "info" : "success"}>{state.testedRuleIds.includes(result.id) ? (ar ? "مختبرة" : "Tested") : (ar ? "فعّالة" : "Active")}</MiniBadge><button aria-label={ar ? "نسخ معرف القاعدة" : "Copy rule ID"} onClick={() => { void navigator.clipboard?.writeText(result.id); toast(ar ? `تم نسخ ${result.id}` : `${result.id} copied`); }}>⋮</button></header><div className="rule-expression"><b>IF</b><span>{["beneficiary.status", "family.relationship", "education.enrollment", "data.similarity"][index]}</span><em>{index === 3 ? "<" : "="}</em><strong>{index === 0 ? "VERIFIED" : index === 1 ? "CHILD" : index === 2 ? "ACTIVE" : "0.75"}</strong><b>THEN</b><span>result</span><em>=</em><strong>{index === 3 ? "MANUAL_REVIEW" : "PASS"}</strong></div><p>{ar ? result.explanationAr : result.explanationEn}</p><footer><button onClick={() => { setState((previous) => ({ ...previous, testedRuleIds: [...new Set([...previous.testedRuleIds, result.id])] })); toast(ar ? "تم تنفيذ القاعدة على المعاملة الحالية" : "Rule executed against the current case"); }}>{ar ? "اختبار القاعدة" : "Test rule"} ▶</button><button onClick={() => navigateStudio("/compliance")}>{ar ? "عرض المرجع" : "View reference"} ◫</button><button onClick={() => navigateStudio("/studio/versions")}>{ar ? "سجل النسخ" : "Version history"} ≛</button></footer></article>)}</div></div>;
}

function TemplateStudio({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [tab, setTab] = useState<Language>("ar");
  const template = state.notificationTemplate;
  const updateTemplate = (patch: Partial<DemoState["notificationTemplate"]>) => setState((previous) => ({ ...previous, notificationTemplate: { ...previous.notificationTemplate, ...patch } }));
  const title = tab === "ar" ? template.arTitle : template.enTitle;
  const body = tab === "ar" ? template.arBody : template.enBody;
  const toggleChannel = (channel: "in-app" | "sms" | "email", checked: boolean) => updateTemplate({ channels: checked ? [...new Set([...template.channels, channel])] : template.channels.filter((item) => item !== channel) });
  const appendVariable = (variable: string) => updateTemplate(tab === "ar" ? { arBody: `${template.arBody} {{${variable}}}` } : { enBody: `${template.enBody} {{${variable}}}` });
  const openDraft = () => {
    window.history.pushState({}, "", "/citizen/applications/new/education-grant");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  return (
    <div className="page template-studio">
      <SectionHeader eyebrow={ar ? "قالب متعدد اللغات" : "MULTILINGUAL TEMPLATE"} title={ar ? "تذكير المواطن بإكمال المسودة" : "Citizen draft completion reminder"} description="NOTIF-DRAFT-REMINDER · v1.8" action={<button className="button button-primary" onClick={() => toast(ar ? "القالب محفوظ في قاعدة الـPOC" : "Template is saved in the POC database")}>{ar ? "تأكيد الحفظ" : "Confirm saved"}</button>} />
      <div className="template-layout">
        <main className="content-card">
          <div className="language-tabs"><button className={tab === "ar" ? "active" : ""} onClick={() => setTab("ar")}>العربية</button><button className={tab === "en" ? "active" : ""} onClick={() => setTab("en")}>English</button></div>
          <label className="input-field"><span>{tab === "ar" ? "عنوان الإشعار" : "Notification title"}</span><input value={title} onChange={(event) => updateTemplate(tab === "ar" ? { arTitle: event.target.value } : { enTitle: event.target.value })} /></label>
          <label className="input-field"><span>{tab === "ar" ? "نص الرسالة" : "Message body"}</span><textarea value={body} onChange={(event) => updateTemplate(tab === "ar" ? { arBody: event.target.value } : { enBody: event.target.value })} /></label>
          <div className="variable-chips">{["citizen.first_name", "service.name", "draft.id"].map((variable) => <button key={variable} onClick={() => appendVariable(variable)}>{`{{${variable}}}`}</button>)}</div>
        </main>
        <aside className="content-card notification-preview">
          <span className="eyebrow">{ar ? "معاينة المواطن" : "CITIZEN PREVIEW"}</span>
          <div className="phone-preview"><header><BrandMark /><strong>{copy[tab].foundation}</strong><small>{tab === "ar" ? "الآن" : "now"}</small></header><h3>{title}</h3><p>{body.replaceAll("{{citizen.first_name}}", tab === "ar" ? "زينب" : "Zainab").replaceAll("{{service.name}}", tab === "ar" ? "المنحة التعليمية" : "Education Grant").replaceAll("{{draft.id}}", "DRAFT-184")}</p><button onClick={openDraft}>{tab === "ar" ? "فتح المسودة" : "Open draft"}</button></div>
          <div className="channel-options">{(["in-app", "sms", "email"] as const).map((channel) => <label key={channel}><input type="checkbox" checked={template.channels.includes(channel)} onChange={(event) => toggleChannel(channel, event.target.checked)} /> {channel === "in-app" ? (ar ? "داخل المنصة" : "In-app") : channel.toUpperCase()}</label>)}</div>
        </aside>
      </div>
    </div>
  );
}
function IntegrationStudio({ state, toast }: { state: DemoState; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  return <div className="page integration-page"><SectionHeader eyebrow={ar ? "طبقة التكامل المحاكية" : "MOCK INTEGRATION LAYER"} title={ar ? "محولات معزولة، مراقبة، وقابلة للاستبدال" : "Isolated, observable, replaceable adapters"} description={ar ? "لا توجد اتصالات حكومية أو مصرفية حقيقية. الحالات أدناه اصطناعية." : "No live government or banking connections. All states are synthetic."} action={<button className="button button-secondary" onClick={() => toast(ar ? "تم تحديث القياسات التجريبية" : "Demo metrics refreshed")}>↻ {ar ? "تحديث الحالة" : "Refresh status"}</button>} /><div className="integration-summary"><MetricCard label={ar ? "سليمة" : "Healthy"} value="4" icon="✓" /><MetricCard label={ar ? "متأخرة / متدهورة" : "Delayed / degraded"} value="2" icon="◷" tone="gold" /><MetricCard label={ar ? "متوقفة" : "Failed"} value="1" icon="×" tone="red" /><MetricCard label={ar ? "متوسط النجاح" : "Average success"} value="94.5%" icon="↔" tone="navy" /></div><div className="integration-grid">{integrations.map((adapter) => <article key={adapter.id} className={`integration-card integration-${adapter.status}`}><header><span>{adapter.id === "payment-kit" ? "◈" : adapter.id === "signature" ? "◇" : adapter.id === "sms" ? "▣" : "↔"}</span><div><h3>{ar ? adapter.nameAr : adapter.nameEn}</h3><small>{adapter.version} · {adapter.mode}</small></div><MiniBadge tone={adapter.status === "healthy" ? "success" : adapter.status === "failed" ? "danger" : "warning"}>● {adapter.status}</MiniBadge></header><div className="adapter-metrics"><div><span>{ar ? "نسبة النجاح" : "Success rate"}</span><strong>{adapter.successRate}%</strong></div><div><span>{ar ? "زمن الاستجابة" : "Latency"}</span><strong>{adapter.latency} ms</strong></div><div><span>{ar ? "آخر نجاح" : "Last success"}</span><strong>{adapter.lastCall}</strong></div><div><span>{ar ? "إعادات المحاولة" : "Retries"}</span><strong>{adapter.retries}</strong></div></div><footer><span>{ar ? "المالك:" : "Owner:"} {adapter.ownerAr}</span><button onClick={() => toast(ar ? `أُرسلت إعادة محاولة للمحول ${adapter.nameAr}` : `Retry queued for ${adapter.nameEn}`)}>{adapter.status === "failed" ? (ar ? "إعادة المحاولة" : "Retry") : (ar ? "فتح السجل" : "Open logs")} ←</button></footer></article>)}</div></div>;
}

function VersionStudio({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const stages: DemoState["serviceVersion"][] = ["Draft", "Review", "UAT", "Published", "Retired"];
  const advance = () => {
    const current = stages.indexOf(state.serviceVersion);
    if (current >= stages.length - 1) return;
    setState((previous) => ({ ...previous, serviceVersion: stages[current + 1] }));
    toast(ar ? `انتقلت النسخة إلى ${stages[current + 1]}` : `Version moved to ${stages[current + 1]}`);
  };
  return <div className="page versions-page"><div className="production-warning">⚿ <strong>{ar ? "لا نشر مباشر" : "No direct production edits"}</strong><span>{ar ? "الإجراء محاكاة ويتطلب تأكيداً وسجلاً تدقيقياً." : "Actions are simulated and require confirmation and audit."}</span></div><SectionHeader eyebrow={ar ? "دورة حياة التهيئة" : "CONFIGURATION LIFECYCLE"} title={ar ? "إصدارات قابلة للمراجعة والمقارنة والعودة" : "Reviewable, comparable and reversible versions"} description="EDU-GRANT · v2.4" action={<button className="button button-primary" onClick={advance}>{ar ? "نقل إلى المرحلة التالية" : "Move to next stage"} ←</button>} /><section className="version-stage"><header>{stages.map((stage, index) => <div key={stage} className={index < stages.indexOf(state.serviceVersion) ? "done" : stage === state.serviceVersion ? "active" : ""}><i>{index < stages.indexOf(state.serviceVersion) ? "✓" : index + 1}</i><span>{stage}</span>{index < stages.length - 1 && <b />}</div>)}</header><div className="version-current"><span className="service-icon service-icon-1">◇</span><div><MiniBadge tone="warning">v2.4 · {state.serviceVersion}</MiniBadge><h2>{ar ? "تحسين الاستكمال وإضافة مرجع التسجيل" : "Completion loop and enrollment reference update"}</h2><p>{ar ? "أضيفت قاعدة LR-EDU-11، وحدّث قالب الإشعار، وخُفّض تصعيد المهلة إلى يومين." : "Added LR-EDU-11, updated the notification template and reduced escalation to two days."}</p></div><button className="button button-secondary" onClick={() => toast(ar ? "تمت محاكاة العودة إلى v2.3" : "Rollback to v2.3 simulated")}>{ar ? "عودة إلى v2.3" : "Rollback to v2.3"} ↶</button></div></section><section className="version-compare"><header><h2>{ar ? "مقارنة v2.3 ↔ v2.4" : "Compare v2.3 ↔ v2.4"}</h2><MiniBadge tone="info">3 {ar ? "تغييرات" : "changes"}</MiniBadge></header>{[["الوثائق المطلوبة", "٣ وثائق", "٤ وثائق · إضافة تأييد الدراسة"], ["مهلة التصعيد", "٣ أيام", "يومان"], ["قالب الاستكمال", "NOTIF-1.6", "NOTIF-1.7 · عربي/إنجليزي"]].map(([field, before, after]) => <div key={field}><strong>{field}</strong><span className="before">− {before}</span><span className="after">+ {after}</span></div>)}</section></div>;
}

// Kept as a visual fallback for older saved demo routes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function NotificationsPage({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  const ar = state.language === "ar";
  return <div className="page notifications-page"><SectionHeader eyebrow={ar ? "مركز الإشعارات" : "NOTIFICATION CENTRE"} title={ar ? "كل تحديث مهم، بلا ضوضاء." : "Every important update. No noise."} description={ar ? "يمكنك قراءة الإشعارات وتتبع القناة المرتبطة بها." : "Read updates and see the channel used."} action={<button className="button button-secondary" onClick={() => setState((previous) => ({ ...previous, notifications: previous.notifications.map((notification) => ({ ...notification, read: true })) }))}>{ar ? "تحديد الكل كمقروء" : "Mark all read"} ✓</button>} /><div className="notification-list">{state.notifications.map((notification) => <button key={notification.id} className={notification.read ? "" : "unread"} onClick={() => setState((previous) => ({ ...previous, notifications: previous.notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item) }))}><span>{notification.channel === "sms" ? "▣" : notification.channel === "email" ? "✉" : "●"}</span><p><strong>{ar ? notification.titleAr : notification.titleEn}</strong><small>{ar ? notification.bodyAr : notification.bodyEn}</small></p><div><MiniBadge tone={notification.channel === "in-app" ? "info" : "neutral"}>{notification.channel}</MiniBadge><time>{localDate(notification.at, state.language)}</time></div></button>)}</div></div>;
}

function AuditPage({ state }: { state: DemoState }) {
  return <div className="page"><AuditTimeline state={state} /></div>;
}

function VerifyPage({ state, navigate }: { state: DemoState; navigate: (path: string) => void }) {
  const ar = state.language === "ar";
  const valid = state.case.signed && state.case.decisionPublished;
  const qrPattern = "111111101010101111111100000101110101000001101110101011101011101101011101010101110110111010111010111011011101010001010111011101000001011101010000011111110101010111111100000000111010000000101101111001011011010010101011011101011101010111101100010011000011101011101010101010111111001101000001001011111010110100001111111010101011011101100000100110001011101101110101111101111011011101000101010111011101000001011010010000011111110110101111111";
  return <main className="verify-page"><div className={`verification-result ${valid ? "valid" : "pending"}`}><span className="verification-icon">{valid ? "✓" : "◷"}</span><MiniBadge tone={valid ? "success" : "warning"}>{valid ? (ar ? "وثيقة صالحة في العرض" : "VALID DEMO DOCUMENT") : (ar ? "لم تُصدر بعد" : "NOT YET ISSUED")}</MiniBadge><h1>{valid ? (ar ? "تم التحقق من القرار" : "Decision verified") : (ar ? "القرار بانتظار اللجنة" : "Decision is awaiting committee action")}</h1><p>{valid ? (ar ? "تطابق رمز الوثيقة مع القرار التجريبي الموقّع والمنشور." : "The document code matches the signed and published demo decision.") : (ar ? "أكمل مسار الموظف واللجنة لإصدار الوثيقة." : "Complete the staff and committee journey to issue this document.")}</p><section className="decision-document"><header><BrandMark /><div><strong>{ar ? "مؤسسة الشهداء" : "Martyrs Foundation"}</strong><small>{ar ? "وثيقة قرار تجريبية" : "Demo decision document"}</small></div><span className="decision-seal">◇</span></header><div className="decision-title"><span>{ar ? "قرار لجنة دعم التعليم" : "EDUCATION SUPPORT COMMITTEE DECISION"}</span><h2>{valid ? (ar ? "الموافقة على طلب المنحة التعليمية" : "Approval of Education Grant Application") : (ar ? "مسودة قرار غير معتمدة" : "Unapproved decision draft")}</h2><p dir="ltr">DEC-EDU-2026-0184</p></div><div className="decision-body"><p>{ar ? "بعد الاطلاع على ملف الطلب والوثائق وتقييم قواعد الأهلية والمراجع الاصطناعية، وبعد تحقق النصاب والتصويت المسجل، تقرر:" : "Following review of the application, evidence, eligibility results and synthetic legal references, and after recorded quorum and voting, the Committee decided:"}</p><strong>{valid ? (ar ? "الموافقة — ضمن سيناريو إثبات المفهوم فقط" : "APPROVED — within this proof-of-concept only") : (ar ? "بانتظار الاعتماد" : "AWAITING AUTHORIZATION")}</strong><div className="decision-facts"><div><span>{ar ? "المستفيدة" : "Beneficiary"}</span><b>{ar ? state.case.citizenNameAr : state.case.citizenNameEn}</b></div><div><span>{ar ? "الطالبة" : "Student"}</span><b>{ar ? state.case.familyMemberAr : state.case.familyMemberEn}</b></div><div><span>{ar ? "الطلب" : "Application"}</span><b dir="ltr">{state.case.id}</b></div><div><span>{ar ? "تاريخ القرار" : "Decision date"}</span><b>{valid ? "26/07/2026" : "—"}</b></div></div></div><footer><div className="qr-grid" aria-label={ar ? "رمز تحقق بصري" : "Visual verification code"}>{qrPattern.split("").map((cell, index) => <i key={index} className={cell === "1" ? "on" : ""} />)}</div><div><span>{ar ? "رمز التحقق" : "Verification code"}</span><strong dir="ltr">DOC-EDU-184</strong><small>{ar ? "امسح الرمز أو افتح مسار التحقق العام" : "Scan or use the public verification route"}</small></div><div className="signature-block"><span>{ar ? "التوقيع الإلكتروني" : "Electronic signature"}</span><strong>{valid ? "✓ SIM-SIGN-8042" : "—"}</strong><small>{ar ? "محاكاة بلا قيمة قانونية" : "Simulation with no legal validity"}</small></div></footer></section><div className="verify-actions"><button className="button button-secondary" onClick={() => window.print()}>{ar ? "طباعة / حفظ PDF" : "Print / Save PDF"} ⎙</button><button className="button button-primary" onClick={() => navigate(valid ? "/citizen/applications/MF-2026-000184" : "/login")}>{valid ? (ar ? "العودة إلى الطلب" : "Back to application") : (ar ? "إكمال العرض" : "Continue demo")} ←</button></div><small>{ar ? "هذا التحقق محلي ضمن إثبات المفهوم، ولا يعتمد على سجل حكومي أو بنية توقيع حقيقية." : "Verification is local to this proof of concept and does not use a live government registry or real signing infrastructure."}</small></div></main>;
}

function CitizenProfilePage({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [draft, setDraft] = useState(state.citizenProfile);
  const save = () => {
    if (!draft.fullNameAr.trim() || !draft.mobile.trim() || !draft.governorateAr.trim()) {
      toast(ar ? "الاسم والهاتف والمحافظة حقول مطلوبة" : "Name, mobile and governorate are required");
      return;
    }
    setState((previous) => ({ ...previous, citizenProfile: draft }));
    toast(ar ? "تم حفظ الملف الموحّد" : "Unified profile saved");
  };
  const update = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="page"><SectionHeader eyebrow={ar ? "ملفي الموحّد" : "UNIFIED PROFILE"} title={ar ? "بيانات محفوظة وقابلة للتحديث" : "Saved, editable profile data"} description={ar ? "تُعاد الاستفادة من هذه البيانات في الخدمات ويُسجل كل تعديل في مساحة الـPOC." : "These values are reused across services and every edit is saved in the POC workspace."} action={<button className="button button-primary" onClick={save}>{ar ? "حفظ التغييرات" : "Save changes"}</button>} /><section className="content-card profile-edit-card"><div className="form-grid"><label className="input-field"><span>{ar ? "الاسم بالعربية" : "Arabic name"}</span><input value={draft.fullNameAr} onChange={(event) => update("fullNameAr", event.target.value)} /></label><label className="input-field"><span>{ar ? "الاسم بالإنجليزية" : "English name"}</span><input value={draft.fullNameEn} onChange={(event) => update("fullNameEn", event.target.value)} /></label><label className="input-field"><span>{ar ? "رقم الهاتف" : "Mobile"}</span><input dir="ltr" value={draft.mobile} onChange={(event) => update("mobile", event.target.value)} /></label><label className="input-field"><span>{ar ? "البريد الإلكتروني" : "Email"}</span><input dir="ltr" value={draft.email} onChange={(event) => update("email", event.target.value)} /></label><label className="input-field"><span>{ar ? "المحافظة" : "Governorate"}</span><input value={draft.governorateAr} onChange={(event) => update("governorateAr", event.target.value)} /></label><label className="input-field"><span>{ar ? "صلة مقدم الطلب" : "Applicant relationship"}</span><input value={draft.relationship} onChange={(event) => update("relationship", event.target.value)} /></label><label className="input-field"><span>{ar ? "رقم المرجع" : "Reference number"}</span><input dir="ltr" value={draft.referenceNumber} onChange={(event) => update("referenceNumber", event.target.value)} /></label></div><footer className="section-actions"><button className="button button-secondary" onClick={() => setDraft(state.citizenProfile)}>{ar ? "إلغاء التعديلات" : "Discard edits"}</button><button className="button button-primary" onClick={save}>{ar ? "حفظ" : "Save"}</button></footer></section></div>;
}

function AppointmentsPage({ state, setState, toast }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>>; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.appointment);
  const save = () => {
    if (!draft.date || !draft.time || !draft.location.trim()) {
      toast(ar ? "أكمل التاريخ والوقت والموقع" : "Complete date, time and location");
      return;
    }
    setState((previous) => ({ ...previous, appointment: { ...draft, status: previous.appointment.status === "cancelled" ? "scheduled" : "rescheduled" } }));
    setEditing(false);
    toast(ar ? "تم حفظ الموعد" : "Appointment saved");
  };
  const cancel = () => {
    if (!window.confirm(ar ? "هل تريد إلغاء الموعد؟" : "Cancel this appointment?")) return;
    setState((previous) => ({ ...previous, appointment: { ...previous.appointment, status: "cancelled" } }));
    toast(ar ? "تم إلغاء الموعد" : "Appointment cancelled");
  };
  return <div className="page"><SectionHeader eyebrow={ar ? "المواعيد والطابور" : "APPOINTMENTS & QUEUE"} title={ar ? "موعد محفوظ ويمكن تعديله" : "A saved, manageable appointment"} description={ar ? "أي تغيير ينعكس مباشرة في مساحة البيانات." : "Every change is persisted in the workspace."} action={state.appointment.status === "cancelled" ? <button className="button button-primary" onClick={() => { setDraft({ ...state.appointment, status: "scheduled" }); setEditing(true); }}>{ar ? "حجز موعد" : "Book appointment"}</button> : <button className="button button-secondary" onClick={() => { setDraft(state.appointment); setEditing(true); }}>{ar ? "تغيير الموعد" : "Reschedule"}</button>} />{state.appointment.status !== "cancelled" ? <section className="appointment-card"><div className="appointment-date"><strong>{new Date(`${state.appointment.date}T00:00:00`).getDate()}</strong><span>{new Date(`${state.appointment.date}T00:00:00`).toLocaleDateString(ar ? "ar-IQ" : "en", { month: "short" })}</span></div><div><MiniBadge tone="info">{state.appointment.status === "rescheduled" ? (ar ? "موعد معدّل" : "Rescheduled") : (ar ? "موعد قادم" : "Upcoming")}</MiniBadge><h2>{state.appointment.location}</h2><p>{state.appointment.date} · {state.appointment.time} · A-14</p></div><div className="section-actions"><button className="button button-secondary" onClick={() => { setDraft(state.appointment); setEditing(true); }}>{ar ? "تعديل" : "Edit"}</button><button className="button button-danger" onClick={cancel}>{ar ? "إلغاء" : "Cancel"}</button></div></section> : <div className="empty-state compact"><span>◷</span><h3>{ar ? "لا يوجد موعد نشط" : "No active appointment"}</h3></div>}{editing && <section className="content-card appointment-editor"><div className="form-grid"><label className="input-field"><span>{ar ? "التاريخ" : "Date"}</span><input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label><label className="input-field"><span>{ar ? "الوقت" : "Time"}</span><input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} /></label><label className="input-field"><span>{ar ? "الموقع" : "Location"}</span><select value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}><option>{ar ? "مديرية بغداد — شباك الوثائق" : "Baghdad Directorate — Document Desk"}</option><option>{ar ? "مديرية بغداد — خدمة المستفيدين" : "Baghdad Directorate — Beneficiary Services"}</option></select></label></div><footer className="section-actions"><button className="button button-secondary" onClick={() => setEditing(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="button button-primary" onClick={save}>{ar ? "حفظ الموعد" : "Save appointment"}</button></footer></section>}</div>;
}

function DocumentWalletPage({ state, toast }: { state: DemoState; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  const [selected, setSelected] = useState<string | null>(null);
  const documents = state.case.documents;
  const open = (id: string, storageId?: string) => {
    if (storageId) window.open(`/api/documents/${storageId}`, "_blank", "noopener,noreferrer");
    else setSelected((current) => current === id ? null : id);
    toast(ar ? "تم فتح تفاصيل الوثيقة" : "Document details opened");
  };
  return <div className="page"><SectionHeader eyebrow={ar ? "محفظة الوثائق" : "DOCUMENT WALLET"} title={ar ? "وثائق مرتبطة فعلياً بالمعاملة" : "Documents actually linked to the case"} description={ar ? "المرفقات الجديدة تُخزن ويمكن فتحها؛ الوثائق الموثقة مسبقاً تعرض بيانات سجلها." : "New uploads are stored and openable; pre-verified items expose their record metadata."} /><div className="wallet-grid">{documents.map((document) => <article key={document.id}><span className="file-icon">PDF</span><h3>{ar ? document.titleAr : document.titleEn}</h3><p>{document.classification}</p><MiniBadge tone={document.status === "verified" ? "success" : document.status === "expired" ? "danger" : "warning"}>{documentStatusLabel(document.status, state.language)}</MiniBadge><button onClick={() => open(document.id, document.storageId)}>{document.storageId ? (ar ? "فتح الملف" : "Open file") : (ar ? "تفاصيل السجل" : "Record details")} ←</button>{selected === document.id && <small>{ar ? `المصدر: ${document.source} · الحالة: ${documentStatusLabel(document.status, state.language)}` : `Source: ${document.source} · Status: ${documentStatusLabel(document.status, state.language)}`}</small>}</article>)}</div></div>;
}

function GenericCitizenPage({ state, route, navigate, toast }: { state: DemoState; route: string; navigate: (path: string) => void; toast: (message: string) => void }) {
  const ar = state.language === "ar";
  if (route === "/citizen/family") return <div className="page"><FamilyView state={state} /></div>;
  if (route === "/citizen/profile") return <div className="page"><SectionHeader eyebrow={ar ? "ملفي الموحّد" : "UNIFIED PROFILE"} title={ar ? "بيانات موثّقة تُستخدم مرة واحدة" : "Verified once, reused with purpose"} description={ar ? "كل استخدام للبيانات مرتبط بخدمة وموافقة واضحة." : "Every data use is tied to a service and clear purpose."} /><BeneficiaryView state={state} /><div className="profile-detail-grid">{[["وسائل الاتصال", "داخل المنصة · ••• ••• 2041", "92%"], ["العنوان التجريبي", "بغداد / الكرخ · بيانات مقنعة", "موثّق"], ["الموافقات", "٣ موافقات استخدام فعّالة", "محددة الغرض"]].map(([title, detail, badge]) => <article className="content-card" key={title}><span>✓</span><h3>{title}</h3><p>{detail}</p><MiniBadge tone="success">{badge}</MiniBadge></article>)}</div></div>;
  if (route === "/citizen/documents") return <div className="page"><SectionHeader eyebrow={ar ? "محفظة الوثائق" : "DOCUMENT WALLET"} title={ar ? "وثائقك المتكررة، جاهزة للخدمات." : "Reusable documents, ready for services."} description={ar ? "حالات التصنيف والتحقق والانتهاء واضحة." : "Classification, verification and expiry are always visible."} /><div className="wallet-grid">{[...state.case.documents, { id: "doc-care", titleAr: "تأييد الرعاية", titleEn: "Care confirmation", status: "expired" as const, classification: "تأييد — منتهي", source: "محفظة الوثائق", type: "care" }].map((document) => <article key={document.id}><span className="file-icon">PDF</span><h3>{ar ? document.titleAr : document.titleEn}</h3><p>{document.classification}</p><MiniBadge tone={document.status === "verified" ? "success" : document.status === "expired" ? "danger" : "warning"}>{documentStatusLabel(document.status, state.language)}</MiniBadge><button onClick={() => toast(ar ? "تم فتح معاينة آمنة" : "Secure preview opened")}>{ar ? "معاينة" : "Preview"} ←</button></article>)}</div></div>;
  if (route === "/citizen/appointments") return <div className="page"><SectionHeader eyebrow={ar ? "المواعيد والطابور" : "APPOINTMENTS & QUEUE"} title={ar ? "زيارة عند الحاجة، بموعد واضح." : "Visit only when needed, at a clear time."} /><section className="appointment-card"><div className="appointment-date"><strong>30</strong><span>{ar ? "تموز" : "JUL"}</span></div><div><MiniBadge tone="info">{ar ? "موعد قادم" : "Upcoming"}</MiniBadge><h2>{ar ? "مديرية بغداد — شباك الوثائق" : "Baghdad Directorate — Document Desk"}</h2><p>{ar ? "الخميس · ١٠:٣٠ صباحاً · رقم الطابور A-14" : "Thursday · 10:30 AM · Queue A-14"}</p></div><button className="button button-secondary" onClick={() => toast(ar ? "تمت محاكاة تغيير الموعد" : "Appointment reschedule simulated")}>{ar ? "تغيير الموعد" : "Reschedule"}</button></section><div className="empty-state compact"><span>◷</span><h3>{ar ? "لا تحتاجين موعداً لخدمة المنحة" : "No appointment needed for the grant"}</h3><p>{ar ? "مسار الخدمة رقمي بالكامل في العرض." : "The demo grant journey is fully digital."}</p></div></div>;
  if (route === "/citizen/help") return <div className="page"><SectionHeader eyebrow={ar ? "المساعدة السياقية" : "CONTEXTUAL HELP"} title={ar ? "شرح بسيط، وإجابات مستندة إلى الخدمة." : "Plain explanations grounded in the service."} /><section className="help-layout"><article className="content-card ai-help"><header><span>✦</span><div><MiniBadge tone="info">{ar ? "ذكاء اصطناعي محاكى" : "Simulated AI"}</MiniBadge><h2>{ar ? "مساعد الخدمة" : "Service assistant"}</h2></div></header><div className="chat-bubble"><p>{ar ? "أستطيع شرح الوثائق والمدة وحالة طلبك من بيانات العرض فقط. لا أقرر الأهلية." : "I can explain documents, timing and your application status using demo data only. I do not decide eligibility."}</p><small>Source: EDU-GRANT v2.4</small></div><div className="question-chips"><button onClick={() => toast(ar ? "التأييد الجامعي يثبت استمرار مريم بالدراسة." : "Enrollment confirmation proves Maryam remains enrolled.")}>{ar ? "لماذا أحتاج التأييد؟" : "Why the confirmation?"}</button><button onClick={() => navigate("/citizen/applications/MF-2026-000184")}>{ar ? "ما حالة طلبي؟" : "What is my status?"}</button></div></article><article className="content-card faq"><h2>{ar ? "أسئلة شائعة" : "Frequently asked"}</h2>{["هل للخدمة رسوم؟", "كم تستغرق المراجعة؟", "هل أحتاج زيارة المديرية؟", "كيف أعرف أن القرار صحيح؟"].map((question) => <details key={question}><summary>{question}</summary><p>{ar ? "إجابة رسمية مبسطة ضمن بيانات وتهيئة العرض التجريبي." : "A clear answer based on the demo service configuration."}</p></details>)}</article></section></div>;
  return <div className="page"><SectionHeader title={ar ? "مجال ممثل في إثبات المفهوم" : "Represented POC domain"} description={ar ? "هذا المجال ظاهر كنقطة توسع مرتبطة بالمنصة، مع حدود صريحة لما لم يُنفذ إنتاجياً." : "This domain is represented as a connected extension point, with explicit production gaps."} /><div className="empty-state"><span>◇</span><h3>{ar ? "المعاينة جاهزة للتوسع" : "Preview ready for extension"}</h3><p>{ar ? "البيانات والواجهة اصطناعية؛ لا توجد معاملة قانونية أو تكامل خارجي." : "Data and interface are synthetic; no legal transaction or external integration occurs."}</p><button className="button button-primary" onClick={() => navigate("/citizen")}>{ar ? "العودة للرئيسية" : "Back home"}</button></div></div>;
}

export default function PlatformApp() {
  const [state, setState] = useState<DemoState>(createInitialState);
  const stateHydrated = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<"loading" | "saving" | "saved" | "offline" | "error">("loading");
  const [personaOpen, setPersonaOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  // Resolved before first paint so the stored choice never flashes the wrong theme.
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const { route, navigate } = useRoute();

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const cached = getInitialState();
      try {
        const response = await fetch("/api/poc-state?workspace=primary", { cache: "no-store" });
        if (!response.ok) throw new Error("Persistence endpoint unavailable");
        const payload = await response.json() as { state?: Partial<DemoState> | null };
        if (!active) return;
        stateHydrated.current = true;
        setState(payload.state ? mergeSavedState(payload.state) : cached);
        setPersistenceStatus("saved");
      } catch {
        if (!active) return;
        stateHydrated.current = true;
        setState(cached);
        setPersistenceStatus("offline");
      }
    };
    void hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!stateHydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
    setPersistenceStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/poc-state?workspace=primary", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) throw new Error("Save failed");
        setPersistenceStatus("saved");
      } catch {
        setPersistenceStatus("offline");
      }
    }, 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const toast = (message: string) => setToastMessage(message);
  const addAudit = (
    actionAr: string,
    actionEn: string,
    source: AuditEvent["source"] = "system",
  ) => {
    setState((previous) => {
      const event: AuditEvent = {
        id: `audit-${Date.now()}`,
        at: new Date().toISOString(),
        actor:
          source === "citizen"
            ? "زينب علي حسن"
            : source === "committee"
              ? "لجنة دعم التعليم"
              : source === "manager"
                ? "سارة جاسم علي"
              : source === "staff"
                ? "أحمد كريم محمود"
                : source === "payment"
                  ? "Payment Kit One Sandbox"
                  : "نظام المنصة التجريبي",
        actionAr,
        actionEn,
        source,
        correlationId: `COR-26-${String(12000 + previous.case.audit.length).padStart(5, "0")}`,
        hash: `sha256:${(Date.now() * 17).toString(16).slice(-16).padStart(16, "0")}`,
      };
      return { ...previous, case: { ...previous.case, audit: [...previous.case.audit, event] } };
    });
  };
  const reset = async () => {
    const confirmed = window.confirm(state.language === "ar" ? "هل تريد إعادة جميع بيانات الـPOC إلى البداية؟ لا يمكن التراجع عن ذلك." : "Reset all POC data to its initial state? This cannot be undone.");
    if (!confirmed) return;
    const fresh = createInitialState();
    setState(fresh);
    window.localStorage.removeItem(STORAGE_KEY);
    try {
      await fetch("/api/poc-state?workspace=primary", { method: "DELETE" });
      setPersistenceStatus("saved");
    } catch {
      setPersistenceStatus("offline");
    }
    navigate("/");
    toast(fresh.language === "ar" ? "تمت إعادة بيانات العرض الأصلية" : "Demo data reset");
  };
  const exportState = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `martyrs-foundation-poc-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast(state.language === "ar" ? "تم تصدير نسخة كاملة من بيانات الـPOC" : "A complete POC data snapshot was exported");
  };
  const importState = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DemoState>;
      const imported = mergeSavedState(parsed);
      setState(imported);
      toast(imported.language === "ar" ? "تم استيراد البيانات وحفظها" : "Data imported and saved");
    } catch {
      toast(state.language === "ar" ? "ملف الاستيراد غير صالح" : "The import file is invalid");
    }
  };

  const content = useMemo(() => {
    if (route === "/") return <LandingPage language={state.language} navigate={navigate} />;
    if (route === "/login") return <LoginPage state={state} setState={setState} navigate={navigate} />;
    if (route === "/register") return <RegistrationPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/services" || route === "/citizen/services") return <ServiceCatalogue state={state} navigate={navigate} citizen={route.startsWith("/citizen")} />;
    if (route.startsWith("/services/")) return <ServiceDetail state={state} serviceId={route.split("/").at(-1) ?? "education-grant"} navigate={navigate} />;
    if (route.startsWith("/verify/")) return <VerifyPage state={state} navigate={navigate} />;
    if (route === "/citizen") return <CitizenDashboard state={state} navigate={navigate} />;
    if (route === "/citizen/applications") return <CitizenApplications state={state} navigate={navigate} />;
    if (route.startsWith("/citizen/applications/new/")) {
      const serviceId = route.split("/").at(-1) ?? "education-grant";
      return serviceId === "education-grant"
        ? <ApplicationWizard state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />
        : <GenericServiceWizard state={state} setState={setState} serviceId={serviceId} navigate={navigate} toast={toast} />;
    }
    if (route.startsWith("/citizen/applications/")) {
      const applicationId = route.split("/").at(-1) ?? state.case.id;
      const additional = state.additionalApplications.find((item) => item.id === applicationId);
      return additional
        ? <AdditionalApplicationCase state={state} setState={setState} application={additional} navigate={navigate} toast={toast} />
        : <CitizenCase state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />;
    }
    if (route.startsWith("/citizen/eligibility/")) return <CitizenEligibilityCheck state={state} serviceId={route.split("/").at(-1) ?? "education-grant"} navigate={navigate} toast={toast} addAudit={addAudit} />;
    if (route === "/citizen/payments" || route.startsWith("/citizen/payments/")) return <PaymentsPage state={state} setState={setState} serviceId={route.split("/").at(-1) === "payments" ? "official-certificate" : route.split("/").at(-1) ?? "official-certificate"} navigate={navigate} toast={toast} addAudit={addAudit} />;
    if (route === "/citizen/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/citizen/help") return <CitizenLegalAssistant state={state} navigate={navigate} />;
    if (route === "/citizen/profile") return <CitizenProfilePage state={state} setState={setState} toast={toast} />;
    if (route === "/citizen/documents") return <DocumentWalletPage state={state} toast={toast} />;
    if (route === "/citizen/appointments") return <AppointmentsPage state={state} setState={setState} toast={toast} />;
    if (route.startsWith("/citizen/")) return <GenericCitizenPage state={state} route={route} navigate={navigate} toast={toast} />;
    if (route === "/staff/inbox" || route === "/staff") return <StaffInbox state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route.startsWith("/staff/erp/")) return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" moduleId={route.split("/").at(-1)} mode="employee" />;
    if (route === "/staff/erp") return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" mode="employee" />;
    if (route === "/staff/help") return <StaffLegalAssistant state={state} navigate={navigate} addAudit={addAudit} />;
    if (route === "/staff/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === `/staff/cases/${state.case.id}/recommendation`) return <StaffRecommendationReview state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />;
    if (route.startsWith("/staff/cases/")) {
      const applicationId = route.split("/").at(-1) ?? state.case.id;
      const additional = state.additionalApplications.find((item) => item.id === applicationId);
      return additional
        ? <AdditionalStaffWorkspace state={state} setState={setState} application={additional} navigate={navigate} toast={toast} />
        : <StaffCaseWorkspace state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />;
    }
    if (route === "/staff/search") return <StaffInbox state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/manager/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/manager/tasks") return <ManagerTasksPage state={state} navigate={navigate} toast={toast} />;
    if (route.startsWith("/manager/employee-requests/")) return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" moduleId={route.split("/").at(-1)} mode="manager" />;
    if (route === "/manager/employee-requests") return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" mode="manager" />;
    if (route === "/manager/approvals") return <ManagerApprovals state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />;
    if (route.startsWith("/manager")) return <ManagerDashboard state={state} navigate={navigate} toast={toast} />;
    if (route === "/committee") return <CommitteeDashboard state={state} navigate={navigate} />;
    if (route === "/committee/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route.startsWith("/committee/meetings/")) {
      const applicationId = route.split("/").at(-1) ?? state.case.id;
      const additional = state.additionalApplications.find((item) => item.id === applicationId);
      return additional
        ? <GenericCommitteeMeeting state={state} setState={setState} application={additional} navigate={navigate} toast={toast} addAudit={addAudit} />
        : <CommitteeMeeting state={state} setState={setState} navigate={navigate} toast={toast} addAudit={addAudit} />;
    }
    if (route.startsWith("/executive/finance/")) return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="finance" moduleId={route.split("/").at(-1)} />;
    if (route === "/executive/finance") return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="finance" />;
    if (route.startsWith("/executive/administration/")) return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" moduleId={route.split("/").at(-1)} />;
    if (route === "/executive/administration") return <EnterpriseOperationsPage state={state} setState={setState} navigate={navigate} toast={toast} domain="hr" />;
    if (route === "/executive/resilience") return <ExecutiveResilience state={state} navigate={navigate} toast={toast} />;
    if (route === "/executive/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/executive") return <ExecutiveDashboard state={state} navigate={navigate} />;
    if (route === "/compliance") return <ComplianceDashboard state={state} navigate={navigate} toast={toast} />;
    if (route.startsWith("/studio")) return <StudioPage state={state} setState={setState} route={route} toast={toast} />;
    if (route === "/admin/notifications") return <UnifiedNotificationsPage state={state} setState={setState} navigate={navigate} toast={toast} />;
    if (route === "/admin/audit") return <AuditPage state={state} />;
    return <LandingPage language={state.language} navigate={navigate} />;
  }, [route, state, navigate]);

  return (
    <AppShell
      state={state}
      setState={setState}
      route={route}
      navigate={navigate}
      openPersona={() => setPersonaOpen(true)}
      toast={toast}
      theme={theme}
      toggleTheme={() => setTheme((previous) => (previous === "dark" ? "light" : "dark"))}
    >
      {content}
      {!["/", "/login", "/register"].includes(route) && <div className="demo-data-tools"><span className={`persistence-state persistence-${persistenceStatus}`}>● {persistenceStatus === "saved" ? (state.language === "ar" ? "محفوظ في قاعدة البيانات" : "Saved to database") : persistenceStatus === "saving" ? (state.language === "ar" ? "جارٍ الحفظ…" : "Saving…") : persistenceStatus === "loading" ? (state.language === "ar" ? "جارٍ تحميل البيانات…" : "Loading data…") : (state.language === "ar" ? "نسخة محلية — تعذر الاتصال" : "Local copy — connection unavailable")}</span><button onClick={exportState}>{state.language === "ar" ? "تصدير" : "Export"} ↓</button><label>{state.language === "ar" ? "استيراد" : "Import"} ↑<input type="file" accept="application/json" onChange={(event) => { void importState(event.target.files?.[0]); event.target.value = ""; }} /></label><button className="reset-demo" onClick={() => { void reset(); }}>↻ {copy[state.language].reset}</button></div>}
      {personaOpen && (
        <PersonaDialog
          state={state}
          setState={setState}
          close={() => setPersonaOpen(false)}
          navigate={navigate}
        />
      )}
      {toastMessage && (
        <div className="toast" role="status" aria-live="polite" aria-atomic="true">
          <span>✓</span>
          {toastMessage}
        </div>
      )}
    </AppShell>
  );
}
