# Security and Responsible AI Notes

## Human-in-the-loop behavior

- Assistant output is labelled by its actual runtime mode: **LLM + RAG** or **local legal retrieval**.
- Retrieval runs before generation and every answer exposes article, clause, source page, and source file.
- The model is instructed to use only retrieved passages and authorized case context, state uncertainty, and avoid invented text.
- Uncertainty is shown for possible duplicates.
- AI can be disabled without blocking official work.
- Employee referral requires explicit human confirmation and a written reason.
- Committee signature requires demo quorum, recorded votes, and a reasoned decision.
- AI never transitions the case, approves entitlement, signs, pays, or publishes a decision.

## POC security boundary

The interface demonstrates role-aware navigation, masked identifiers, a mock MFA indicator, conflict handling, separation of duties, audit identifiers, purpose acknowledgement, and no card-data entry. These are product behaviors, not production security controls.

Local storage is readable and editable by the device user. The audit chain looks tamper-evident and records hashes, but it is not cryptographically immutable.

## Privacy constraints

- Only obviously synthetic people and records are included.
- No file contents are uploaded; the file picker only changes local demo state.
- With no `OPENROUTER_API_KEY`, no assistant data leaves the local/server retrieval path.
- When an administrator configures `OPENROUTER_API_KEY`, the latest question, up to eight prior messages, retrieved legal summaries, and the role-authorized synthetic case context are sent server-side to OpenRouter and the selected model provider.
- The free router can select providers that log prompts and completions. It is therefore limited to synthetic POC data; production citizen data requires a pinned, privacy-approved model/provider and formal review.
- Staff receives deterministic control results; the citizen scope excludes those internal controls and is limited to the citizen's own demo case.
- The API key is server-only, never prefixed with `NEXT_PUBLIC_`, and never returned to the browser.
- No secrets, production endpoints, national IDs, addresses, or financial credentials are included.

## Production gaps

Production requires identity proofing, least-privilege authorization, tenant and organizational boundaries, encryption, key and secrets management, secure upload and malware scanning, data minimization, retention, consent governance, audit immutability, monitoring, incident response, accessibility certification, threat modelling, legal-rule approval, integration certification, and independent security testing.

Any future AI requires an approved purpose, privacy impact assessment, grounded retrieval, model and prompt versioning, evaluation sets, bias and error monitoring, red-team testing, human override, data residency decisions, complete auditability, and a non-AI fallback.
