# Requirements Traceability

The enterprise blueprint is the controlling scope reference. The rows below map the implemented POC evidence to its relevant areas and the Master Build Prompt.

| Prompt area | POC evidence |
| --- | --- |
| 1–2 Outcome and primary story | Shared `MF-2026-000184` case across citizen, staff, directorate manager, committee, decision, executive, and audit views |
| 3 Payment sandbox | `/citizen/payments`; fictional invoice, adapter states, idempotency, webhook outcomes, receipt, distribution, reconciliation |
| 4 Demo personas | `/login`, adaptive citizen registration at `/register`, and persistent role switcher |
| 5 Required areas | Public, citizen, staff, manager, committee, executive, studio, integration, payment, verification, and audit routes |
| 6 Citizen experience | Four-category registration, category-personalized services, dashboard, catalogue, preliminary check, detail, wizard, wallet, tracking, unified notifications, appointment, help, verification |
| 7 Staff workspace | Sticky header, tabs, 360 views, document reviewer, rules, AI, citizen-feedback loop, grounded recommendation review, audit, duplicate alert |
| 8 Responsible AI | Deterministic cited answers, uncertainty, feedback, disable path, no final decision |
| Compliance agent prompt | `/compliance`, 18-control catalogue, legal browser, quota/SLA/report/version views, case remediation, referral and decision gates |
| Shared legal assistant | `/citizen/help` and the staff case assistant use one source-indexed legal base with article citations and explicit no-decision boundaries |
| 9 Committee | Attendance, conflict, quorum, agenda, case pack, notes, votes, rationale, signature, publication |
| 10 Dashboards | `/manager` includes manager tasks, incomplete employee tasks and reminders; `/manager/approvals` gates committee referral; `/executive` provides the coherent synthetic operational story |
| Blueprint section 18 | `/executive/finance` and `/executive/finance/:module`; funds A–D, role workspace, tasks, all 17 modules, list/detail/form/action/history contract, budget gate, balanced posting, idempotency, grants and audit linkage |
| Blueprint section 19 | `/executive/administration` and `/executive/administration/:module`; role workspace, tasks, all 18 employee-administration modules with the transactional screen contract, leave approval and payroll-to-GL/AP linkage; support/ITSM remains represented separately |
| بوابة الموظف المؤسسية / employee self-service | `/staff/erp`, `/manager/employee-requests`, and module routes; employee identity scope, service-specific request forms, attendance, leave, payslip, personal requests, manager decision and fulfilment routing to HR/procurement/inventory roles |
| ERP/HR role policy | `lib/enterprise.ts`; nine internal roles, module create/approve/post scopes and segregation-of-duties checks |
| ERP/HR durable POC state | `DemoState.enterprise` persisted by `/api/poc-state`; records, tasks, budget lines, workflow history and leave balance |
| 11 Low-code studio | `/studio/forms/*`, `/studio/workflows/*`, `/studio/rules/*`, `/studio/notifications`, `/studio/versions` |
| 12–13 Design and accessibility | Independent tokens, RTL/LTR toggle, responsive views, semantic controls, focus, reduced motion, print |
| 14–18 Architecture and governance | Typed domains, guarded transitions, local persistence, policy rules, adapter catalogue, correlation IDs, masking, disclaimers |
| 19 Components | Shell, sidebar, status, metrics, tables, timeline, wizard, upload, 360 cards, rules, AI, audit, vote, decision, QR, workflow, versions, integrations, modal, toast |
| 20 Seed data | 20 services, 30 application rows, 12 tasks, family records, 25 notifications, 20+ case audit events, committee and integration records |
| 21 Functional requirements | Stateful citizen registration → staff → manager → committee journey, citizen completion loop, persona/language switching, filters, unified notifications, payment protection, reset |
| 22 Documentation | All requested handoff documents |
| 23 Testing | Focused domain tests plus lint, strict type check, production build, and local preview verification |
