# Martyrs Foundation Digital Platform POC

An Arabic-first, RTL proof of concept for a unified Martyrs Foundation service platform. It demonstrates one connected vertical slice from citizen registration and initial profile classification through complete submission, staff review, directorate-manager approval, committee decision, citizen verification, executive metrics, and audit.

All identities, records, documents, legal references, payments, signatures, and integrations are synthetic. This is not a production system and creates no legal or financial effect.

## Run locally

Prerequisites: Node.js 22.13+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Validation performed for this handoff:

- Lint completed with no errors or warnings.
- Strict TypeScript check completed.
- Thirty focused domain, workflow, compliance, retrieval, enterprise-control, employee self-service, and interaction-audit tests passed.
- Production build completed.

## Demo personas

| Persona | Demo identity | Primary route |
| --- | --- | --- |
| Citizen | زينب علي حسن | `/citizen` |
| Service employee | أحمد كريم محمود | `/staff/inbox` |
| Directorate manager | سارة جاسم علي | `/manager` |
| Committee member | د. مصطفى ناصر | `/committee` |
| Executive | مكتب رئيس المؤسسة | `/executive` |
| Platform administrator | مسؤول النظام | `/studio` |

Use the persistent role switcher in the top bar. Switching roles preserves the case state in D1, while the browser keeps an offline backup.

## Core demonstration

1. Open `/register`, select one of the four initial citizen categories, review its user story and create the demo account.
2. Open `/services/education-grant`, run the preliminary citizen check, and submit the complete wizard; it creates `MF-2026-000184`.
3. Switch to employee, open the case, and return it to the citizen with a clear completion note.
4. Switch to citizen, open the application, upload the requested evidence, and resubmit.
5. Switch to employee, rerun eligibility, open `/staff/cases/MF-2026-000184/recommendation`, review the grounded recommendation and explicitly send it to the manager.
6. Switch to manager, open `/manager/approvals`, review staff work, and approve referral to committee.
7. Switch to committee, verify the pre-decision compliance gate and quorum, simulate eligible votes, and sign/publish the decision.
8. Switch to citizen and open the verifiable decision at `/verify/DOC-EDU-184`.
9. Show `/executive/finance` for Blueprint section 18, `/executive/administration` for section 19, the unified role notification centres, `/compliance`, `/executive`, and `/admin/audit`.
10. In either enterprise workspace, switch the operational role, open **My Tasks / My Approvals**, then complete a record across creator → approver → poster roles.

## Key areas

- Public catalogue and service detail
- Adaptive citizen registration with four initial categories, category-specific user stories, fields, evidence and service recommendations
- Mobile-first citizen dashboard, preliminary check, wizard, document wallet, applications, unified notifications, appointments, and help
- Staff task inbox and three-region case workspace
- Deterministic rules plus a server-side OpenRouter integration with a sourced local-retrieval fallback
- Source-indexed legal knowledge, 18 deterministic compliance controls, remediation, and action gates
- Citizen and staff legal/service assistants with multi-turn chat, visible article/page citations, role-scoped case context, and human-decision boundaries
- Committee attendance, conflict, quorum, voting, rationale, and simulated signature
- Manager task oversight, employee reminders, approval gate, and executive dashboards
- Section 18 ERP operations with funds A–D and all 17 modules using a reusable transactional list/detail/form/action/history contract
- **بوابة الموظف المؤسسية** at `/staff/erp`: personal profile, attendance, leave, payslip, training, performance, tasks, procurement, custody, maintenance and facilities requests, with service-specific forms and manager-to-administration handoffs
- Section 19 employee administration with all 18 requested HR/operations/asset modules using the same transactional contract; support and ITSM remain represented
- Nine operational roles, task/approval inboxes, segregation of duties, budget gates, idempotency and balanced demo journals
- Service, form, workflow, rule, template, integration, and version studio
- Payment Kit One sandbox with idempotency and reconciliation
- Public decision verification

## Reset

The bottom data toolbar exposes the current save state and supports export, import, and reset. **إعادة بيانات العرض** clears the D1 workspace, uploaded R2 files, and the browser backup, then restores the original case.

## Enable the LLM

The assistant API always retrieves the closest legal passages first. With no key it returns a deterministic, cited retrieval answer. To enable generated answers, copy `.env.example` to `.env.local` and set the server-only OpenRouter values:

```bash
OPENROUTER_API_KEY=your_server_side_key
OPENROUTER_MODEL=nvidia/nemotron-3-nano-30b-a3b:free
OPENROUTER_SITE_URL=https://martyrs-foundation-poc.o-liliums45.chatgpt.site
```

Restart `npm run dev`. For the hosted site, set the same runtime variables in Sites and redeploy. The key is never sent to the browser.

### Rebuild the supplied legal-reference index

The 18-page PDF is the primary law source. Because its embedded text uses a custom glyph encoding, its page-indexed summaries are human-verified. The supplied HTML is a later interpretive study about implementation and is indexed separately; it is never treated as an amendment or as primary law.

```powershell
python scripts/build-legal-reference-corpus.py `
  --pdf "C:\path\to\4395-55-72.pdf" `
  --html "C:\path\to\قانون مؤسسة الشهداء رقم (2) لسنة 2016.html" `
  --output "lib\legal-reference.generated.ts"
```

## Known limitations

- POC state is durable in D1 and document bytes are stored in R2, with a browser-local fallback. Authentication and record-level multi-user isolation are not production-ready.
- No real authentication, MFA, identity verification, notifications, payments, government integrations, signature, QR registry, or cryptographic append-only ledger.
- The hosted deployment uses cited local retrieval until `OPENROUTER_API_KEY` is configured. The POC pins a free model instead of using the random free router, and model failures never disable the sourced local fallback.
- Primary-law chunks are verified summaries with page pointers. The HTML study is labelled as an interpretive source and is not a substitute for an authenticated amendment.
- The 66-section enterprise blueprint was reviewed and mapped. Enterprise operations are a functional POC simulation, not an assertion of production readiness or formal acceptance.
- Charts and operational records are synthetic POC representations.
