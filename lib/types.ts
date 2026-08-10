export type Language = "ar" | "en";

export type PersonaId =
  | "citizen"
  | "staff"
  | "manager"
  | "committee"
  | "executive"
  | "admin";

export type CitizenCategory =
  | "martyr-family"
  | "injured"
  | "terrorism-victim"
  | "missing-family";

export type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Validation"
  | "Incomplete"
  | "Awaiting Citizen Completion"
  | "Under Review"
  | "Manager Review"
  | "Referred"
  | "Committee Review"
  | "Awaiting Approval"
  | "Approved"
  | "Rejected"
  | "In Execution"
  | "Completed"
  | "Appealed"
  | "Reopened"
  | "Cancelled"
  | "Closed";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "gold";

export interface Persona {
  id: PersonaId;
  labelAr: string;
  labelEn: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  home: string;
  initials: string;
}

export interface ServiceDefinition {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  categoryAr: string;
  days: number;
  documents: number;
  digital: boolean;
  audienceAr: string;
  audienceEn: string;
  descriptionAr: string;
  descriptionEn: string;
  featured?: boolean;
  audiences?: CitizenCategory[];
  feeIqd: number;
}

export interface CaseDocument {
  id: string;
  titleAr: string;
  titleEn: string;
  type: string;
  status: "verified" | "missing" | "review" | "expired";
  classification: string;
  source: string;
  uploadedAt?: string;
  storageId?: string;
}

export interface StoredDocument {
  id: string;
  name: string;
  category: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  actionAr: string;
  actionEn: string;
  source: "citizen" | "staff" | "manager" | "committee" | "system" | "payment";
  correlationId: string;
  hash: string;
}

export interface Notification {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  at: string;
  read: boolean;
  channel: "in-app" | "sms" | "email";
}

export interface ApplicationCase {
  id: string;
  serviceId: string;
  citizenId: string;
  citizenNameAr: string;
  citizenNameEn: string;
  familyMemberAr: string;
  familyMemberEn: string;
  universityAr: string;
  universityEn: string;
  governorateAr: string;
  governorateEn: string;
  status: ApplicationStatus;
  priority: "normal" | "high";
  submittedAt?: string;
  updatedAt: string;
  slaHoursRemaining: number;
  assignedToAr: string;
  assignedToEn: string;
  documents: CaseDocument[];
  audit: AuditEvent[];
  completionMessage?: string;
  employeeRecommendation?: string;
  reviewerConfirmed: boolean;
  managerApproved: boolean;
  committeeApproved: boolean;
  signed: boolean;
  decisionPublished: boolean;
}

export interface CitizenProfile {
  registered: boolean;
  category: CitizenCategory;
  fullNameAr: string;
  fullNameEn: string;
  mobile: string;
  email: string;
  governorateAr: string;
  governorateEn: string;
  relationship: string;
  referenceNumber: string;
  declarationAccepted: boolean;
}

export interface ServiceApplication {
  id: string;
  serviceId: string;
  status: ApplicationStatus;
  detail: string;
  documentCount: number;
  submittedAt: string;
  updatedAt: string;
  slaHoursRemaining: number;
  completionMessage?: string;
  employeeRecommendation?: string;
  reviewerConfirmed?: boolean;
  managerApproved?: boolean;
  committeeApproved?: boolean;
  signed?: boolean;
  decisionPublished?: boolean;
  committeeReason?: string;
  committeeVotes?: Record<string, NonNullable<CommitteeMember["vote"]>>;
}

export interface EligibilityResult {
  id: string;
  nameAr: string;
  nameEn: string;
  status: "pass" | "fail" | "warning" | "manual";
  inputAr: string;
  inputEn: string;
  version: string;
  legalRef: string;
  explanationAr: string;
  explanationEn: string;
}

export interface CommitteeMember {
  id: string;
  nameAr: string;
  nameEn: string;
  roleAr: string;
  roleEn: string;
  present: boolean;
  conflict: boolean;
  vote?: "approve" | "reject" | "abstain" | "more-info";
}

export interface PaymentRecord {
  id: string;
  invoice: string;
  amount: number;
  status: "pending" | "successful" | "failed" | "expired" | "refunded";
  idempotencyKey: string;
  reconciled: boolean;
  updatedAt: string;
}

export interface IntegrationAdapter {
  id: string;
  nameAr: string;
  nameEn: string;
  status: "healthy" | "degraded" | "delayed" | "failed";
  successRate: number;
  latency: number;
  version: string;
  ownerAr: string;
  lastCall: string;
  mode: "Sandbox";
  retries: number;
}

export type EnterpriseFundCode = "A" | "B" | "C" | "D";

export type EnterpriseRoleId =
  | "general-employee"
  | "department-manager"
  | "accountant"
  | "treasurer"
  | "procurement-officer"
  | "inventory-officer"
  | "hr-officer"
  | "auditor"
  | "finance-manager";

export type EnterpriseDomain = "finance" | "hr";

export type EnterpriseRecordStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "posted"
  | "settled";

export type EnterpriseAction =
  | "create"
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "settle";

export interface EnterpriseHistoryEvent {
  id: string;
  at: string;
  role: EnterpriseRoleId;
  action: EnterpriseAction;
  noteAr: string;
  noteEn: string;
}

export interface EnterpriseJournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface EnterpriseRecord {
  id: string;
  moduleId: string;
  domain: EnterpriseDomain;
  titleAr: string;
  titleEn: string;
  description: string;
  amount: number;
  quantity: number;
  fund?: EnterpriseFundCode;
  budgetLineId?: string;
  reference?: string;
  decisionRef?: string;
  idempotencyKey?: string;
  origin?: "employee-portal" | "back-office";
  ownerEmployeeId?: string;
  ownerEmployeeNameAr?: string;
  ownerEmployeeNameEn?: string;
  status: EnterpriseRecordStatus;
  createdByRole: EnterpriseRoleId;
  approvedByRole?: EnterpriseRoleId;
  postedByRole?: EnterpriseRoleId;
  createdAt: string;
  updatedAt: string;
  journalLines?: EnterpriseJournalLine[];
  history: EnterpriseHistoryEvent[];
}

export interface EnterpriseTask {
  id: string;
  recordId: string;
  moduleId: string;
  assignedRole: EnterpriseRoleId;
  action: "approve" | "post" | "settle";
  titleAr: string;
  titleEn: string;
  dueAt: string;
  completed: boolean;
}

export interface EnterpriseBudgetLine {
  id: string;
  fund: EnterpriseFundCode;
  code: string;
  titleAr: string;
  titleEn: string;
  allocated: number;
  committed: number;
  spent: number;
}

export interface EnterpriseEmployeeProfile {
  employeeId: string;
  fullNameAr: string;
  fullNameEn: string;
  jobTitleAr: string;
  jobTitleEn: string;
  departmentAr: string;
  departmentEn: string;
  managerAr: string;
  managerEn: string;
  workLocationAr: string;
  workLocationEn: string;
  workEmail: string;
  mobile: string;
  joinDate: string;
  bankLastFour: string;
  emergencyContact: string;
  attendanceStatus: "not-started" | "checked-in" | "checked-out";
  lastClockIn?: string;
  lastClockOut?: string;
  updatedAt: string;
}

export interface EnterpriseState {
  activeRole: EnterpriseRoleId;
  records: EnterpriseRecord[];
  tasks: EnterpriseTask[];
  budgetLines: EnterpriseBudgetLine[];
  leaveBalanceDays: number;
  employeeProfile: EnterpriseEmployeeProfile;
}

export interface DemoState {
  language: Language;
  persona: PersonaId;
  citizenProfile: CitizenProfile;
  case: ApplicationCase;
  additionalApplications: ServiceApplication[];
  notifications: Notification[];
  committeeMembers: CommitteeMember[];
  payment: PaymentRecord;
  wizardStep: number;
  wizardDraft: {
    member: string;
    university: string;
    year: string;
    consent: boolean;
    uploaded: boolean;
  };
  registrationDraft: {
    step: number;
    category: CitizenCategory;
    fullName: string;
    mobile: string;
    email: string;
    governorate: string;
    relationship: string;
    reference: string;
    evidenceFileName: string;
    accepted: boolean;
  };
  serviceDrafts: Record<string, {
    step: number;
    detail: string;
    uploaded: number[];
    consent: boolean;
  }>;
  appointment: {
    date: string;
    time: string;
    location: string;
    status: "scheduled" | "rescheduled" | "cancelled";
  };
  committeeDraft: {
    notes: string;
    reason: string;
  };
  administration: {
    internalTicketOpen: boolean;
  };
  enterprise: EnterpriseState;
  storedDocuments: StoredDocument[];
  studioForm: {
    fields: string[];
    selectedField: string;
    readOnlyVerified: boolean;
    showSource: boolean;
  };
  notificationTemplate: {
    arTitle: string;
    enTitle: string;
    arBody: string;
    enBody: string;
    channels: Array<"in-app" | "sms" | "email">;
  };
  testedRuleIds: string[];
  ruleDraftCount: number;
  aiEnabled: boolean;
  complianceResolvedControlIds: string[];
  selectedWorkflowNode: string;
  serviceVersion: "Draft" | "Review" | "UAT" | "Published" | "Retired";
}
