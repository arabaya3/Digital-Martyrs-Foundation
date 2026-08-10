# Executive Demo Script — 7–10 minutes

## 0:00–0:45 — Set the frame

Open `/`.

Narrative: “This is one platform, not a collection of portals. Arabic and RTL are native, every sensitive outcome remains human, and every important action gains a traceable event. All data and integrations are synthetic.”

Click **استكشف الخدمات**, search for “منحة”, and open **منحة تعليمية لأحد أفراد الأسرة**.

Point out eligibility, four required documents, 12-day SLA, synthetic legal references, zero fee, and the full service stages.

## 0:45–1:45 — Citizen registers and the platform personalizes

Open `/register` and choose **ذوو شهيد**. Point out the four initial categories, the category-specific evidence question, the user story preview, and the personalized service list. Explain that this is routing metadata, not a legal status or entitlement decision.

Create the account, then open `/citizen`. Show the category badge and the services selected for this profile. Open a service and run the preliminary eligibility check, emphasizing that it is only routing guidance and never a final entitlement decision.

## 1:45–3:00 — Citizen submits

Click **ابدأ الخدمة**.

In the wizard:

1. Show verified beneficiary data and source badge.
2. Select **مريم حيدر علي** in Family 360.
3. Enter academic year `2025–2026`.
4. Try to continue without a file and show that the citizen cannot proceed. Then select a local mock enrollment-confirmation file and show the completeness badge.
5. Accept the purpose acknowledgement and submit.

Expected: only after the application is complete, `MF-2026-000184` appears with **مُقدّم** status and an audit event.

Before submitting, switch briefly to the employee persona or open the direct employee case URL. The draft is absent from the inbox and the direct URL exposes no citizen or case data.

## 3:00–5:20 — Employee reviews, asks for completion, and confirms a recommendation

Switch persona to **موظف معاملات — أحمد كريم محمود**.

Open the highlighted demo row in `/staff/inbox`.

In `/staff/cases/MF-2026-000184`:

- Show the sticky case header, SLA, Beneficiary 360, Family 360, evidence pack, rules, duplicate-risk alert, and trace identifiers.
- Ask the simulated AI chips: “لخّص الحالة” and “ما الوثائق الناقصة؟”
- Emphasize citations, uncertainty, disable path, and the separation from official action.

Click **بدء المراجعة**, then **إعادة للمواطن**. Enter a precise note requesting an updated enrollment confirmation.

Switch to the citizen. Open the same application, show the human-feedback banner, upload the requested evidence, and click the resubmission action. Switch back to the employee; the case is again available for review.

Open **الأهلية** and rerun the deterministic rules. The enrollment rule now passes.

Open **مراجعة التوصية**. On the dedicated screen, show the grounded summary, citations, assistant disclaimer, four mandatory human confirmations, and reason field. Choose **إرسال إلى مدير المديرية**.

Expected: status becomes **أمام مدير المديرية**; the case disappears from the employee task list and does not appear to the committee yet.

## 5:20–6:30 — Directorate manager gates the committee referral

Switch to **مدير المديرية**. On `/manager`, show the manager's own tasks, incomplete employee tasks, and click **تنبيه الموظف** to demonstrate follow-up.

Open `/manager/approvals`, inspect the complete staff recommendation, confirm the independent review, and click **اعتماد وإحالة للجنة**.

From the executive persona, open `/executive/finance`. Switch between Foundation Finance, Martyrs Fund Finance, Beneficiary Payments, and Investments & Projects; show that the KPIs and activity list follow the selected financial domain and that all 17 finance modules are present.

Then open `/executive/administration`. Filter the 20 administrative modules by people, operations, assets/facilities, and support/ITSM. Open a module and resolve the sample internal support ticket to demonstrate functional interaction.

## 6:30–7:45 — Committee decides

Switch to **عضو لجنة**. Open the featured Education Support Committee meeting.

Show:

- Present, absent, and conflict-declared members
- Quorum that excludes the conflict
- Case pack, completed evidence, staff recommendation, and legal references
- Discussion notes and reasoned decision field

Click **موافقة**, then **محاكاة تصويت عضوين بالموافقة**. Click **توقيع القرار ونشره**.

Expected: status becomes **موافق عليه**, a simulated signature is added, and the citizen receives a notification.

## 7:45–8:30 — Citizen receives a verifiable result

Switch to **مواطن / مستفيد**, open the application, then **عرض القرار والتحقق**.

Show the formatted decision, verification code, CSS QR representation, synthetic signature, print behavior, and explicit non-production disclaimer.

## 8:30–9:20 — Executives and administrators see the same story

Switch to **الإدارة العليا**.

Open `/executive`; point out completed-case count, SLA trend, channel mix, governorate ranking, finance preview, integration alert, and simulated insight citations.

Switch to **مدير المنصة**.

Open `/studio/workflows/education-grant` and explain the entry gate: the operational workflow starts only after a complete citizen submission. Briefly show `/studio/rules/education-grant`, `/studio/integrations`, and `/studio/versions`.

## 9:20–10:00 — Governance close

Open `/admin/audit`.

Search for a correlation ID. Explain that the POC models append-only application flows and traceability but does not claim production cryptographic immutability.

Close: “The POC proves a coherent product and operating model. Production identity, legal rules, integrations, security hardening, and records governance remain deliberate next-stage work.”
