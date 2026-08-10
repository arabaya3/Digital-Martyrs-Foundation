# Compliance and Legal Assistant POC

This module extends the existing Martyrs Foundation POC without adding a new persona or changing the citizen → staff → committee sequence.

## Sources and legal boundary

- Primary supplied source: `4395-55-72.pdf`, an 18-page scan of Martyrs Foundation Law No. (2) of 2016.
- Supporting supplied source: the saved HTML study on implementation of the law.
- Build specification: `برومت_الوكيل_الامتثال_والمساعد.md`.
- Working reference version: `MF-LAW-2016.2`.

The UI contains concise source-indexed summaries, not a replacement for the official legal text. New amendments are shown as pending until an authoritative file is supplied and reviewed. All outputs are labelled as simulation, not legal advice or a final decision.

## Connected flow

1. The citizen completes and submits the application. Incomplete citizen work remains invisible to operations.
2. Staff opens the same case and starts review.
3. Before referral, the case compliance tab evaluates 18 deterministic controls.
4. `CTL-EXCLUSION-BAATH` and `CTL-PROOF` require documented human review in the education story.
5. Staff records a treatment note for each item; the action is appended to the case audit.
6. Referral is disabled while any blocking result is `violation` or `needs_review`.
7. The committee receives the formally referred case.
8. Before signature, the same engine reruns the controls and includes `CTL-COMMITTEE-QUORUM`.
9. The decision is disabled until quorum, votes, rationale and the compliance gate all pass.

## Required controls

The catalogue implements all 18 specified controls:

- Eligibility and proof: `CTL-DEF-KIN`, `CTL-PERIOD`, `CTL-EXCLUSION-BAATH`, `CTL-PROOF`
- Committee and time: `CTL-COMMITTEE-QUORUM`, `CTL-SLA-DECISION`, `CTL-SLA-APPEAL`
- Benefits: `CTL-PENSION-CALC`, `CTL-PENSION-DIST`, `CTL-LAND-ONCE`, `CTL-MULTI-MARTYR`
- Governance: `CTL-FRAUD`, `CTL-VERSIONING`
- Quotas: `CTL-QUOTA-EDU`, `CTL-QUOTA-JOBS`, `CTL-QUOTA-HAJJ`
- Exemptions and service: `CTL-FEES-EXEMPT`, `CTL-MEDICAL-SLA`

Every result is one of `pass`, `violation`, `needs_review`, or `not_applicable`, and exposes evidence, explanation, source article, source page range, severity and version.

## Screens

- `/compliance`: overview, control catalogue, legal knowledge browser, quotas, SLA tracker, reports and version impact.
- `/staff/cases/MF-2026-000184`: connected `Case compliance` tab and pre-referral gate.
- `/committee/meetings/EDU-2026-07`: pre-decision compliance gate.
- `/citizen/help`: citizen legal and service assistant with citations.
- `/staff/help`: full employee assistant with case facts, deterministic control results, cited law, suggested operational questions, and audited queries.
- The staff case sidebar links into the full assistant without changing the official case action flow.

## Assistant runtime

- One shared assistant engine serves both personas; only scope and instructions differ.
- The legal index contains 27 verified primary-law summaries plus 20 generated chunks from the supplied interpretive HTML study. Every chunk is labelled by source kind so the model cannot present the study as law or as an amendment.
- Arabic-aware lexical retrieval expands common synonyms and returns up to six passages with article, clause, page, file, and stable chunk ID.
- `POST /api/legal-assistant` trims history, limits the question to 1,800 characters, and sends no secret to the browser.
- If `OPENROUTER_API_KEY` exists, the route calls OpenRouter after retrieval. The POC pins `nvidia/nemotron-3-nano-30b-a3b:free` for predictable free inference and allows an administrator to override it with `OPENROUTER_MODEL`.
- If the key is absent, the model fails, or the request times out, a deterministic cited retrieval answer is returned. The interface labels the active mode honestly.
- Guardrails require inline legal citations, prohibit invented text and final decisions, distinguish law from case facts, and preserve human review.

## POC versus production

The POC uses deterministic local data and browser persistence. Production requires authoritative, digitally managed law and amendment sources; legal validation of every clause summary and control implementation; governed retrieval with evaluation and access control; live registries for exclusions, proof, prior benefits and quotas; a transactional case store; formal override authority; and AI/privacy/security monitoring.
