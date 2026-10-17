# ACA operational support and policy source

The October 17, 2026 founder instruction controls this increment: prepare public launch policies, remove outdated launch-delay copy, prioritize automatic support, preserve established enrollment behavior, and leave approved curriculum untouched.

`knowledge.mjs` is the single source for automatic public answers. The build copies it to `support-knowledge.js`; do not edit the generated copy. Contact and FAQ use this same answer set. Matching runs in the browser, sends no question to an AI model, and never decides a refund or account exception. Unsupported questions route to a case. This is approved-answer automation, not a deployed generative AI agent.

`api.mjs` stores cases and messages without granting learner access. A 32-byte capability is generated in the browser; only its SHA-256 hash is stored. The initial confirmation email carries the private link. Its fragment is removed from the address bar on opening. Keep capabilities out of logs and audit metadata. Wrong or absent keys return the same unavailable response. Rate limits, body limits, a form trap, and explicit transactional contact consent protect intake. Supabase anon/authenticated roles have no direct table permissions. Owner actions require the existing authenticated allowlist check. Requester email is not verified identity and must never authorize disclosure of a learner's account records.

Support & feedback in the control center includes website cases and the existing learner reports. Owner replies are reviewed before sending. Delivery uses the existing operational sender and event history with idempotency keys. New requests and follow-ups notify trusted owner addresses obtained through a service-only lookup, without putting case bodies in the alert. A saved case remains available when email fails; do not describe failed email as successful delivery. Actual delivery remains separate from provider submission.

Incoming domain MX was absent when checked October 17. No support mailbox address is published by this increment and no DNS or existing sender configuration is changed. The website case route is the working contact channel. The older Microsoft 365 mailbox plan remains historical infrastructure context; do not infer mailbox availability from sending verification.

New checkouts require the named agreement field and exact policy version. Stripe Checkout and installment subscription metadata retain the policy version and server acceptance timestamp. Existing sessions and webhook fulfillment remain compatible; no historical agreement is invented. Offers remain $129 Founding Student Price or $50/$50/$49 totaling $149. This is not a new test of the completed enrollment flow.

Public source pages: Terms, Refund Policy, Privacy, Accessibility, AI Learning Disclaimer, Contact, FAQ, and the enrollment disclosures. These are operational policies prepared from ACA records, not an attorney opinion or a claim of legal certification. Keep required consumer remedies intact. Any qualified legal review must assess the actual operator, offering, jurisdictions, exemptions, and practices; do not advertise universal legal compliance.

Research consulted October 17:
- California DOJ, Making Your Privacy Practices Public: https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf
- California DOJ, CCPA rights and applicability: https://oag.ca.gov/privacy/ccpa
- FTC, .com Disclosures: https://www.ftc.gov/system/files/documents/plain-language/bus41-dot-com-disclosures-information-about-online-advertising.pdf

Verify with the support tests, checkout consent tests, shared server/origin checks, owner UI checks, production build, and actual public contact/case behavior. Do not change curriculum publication or repeat historical payment tests as part of this work.

## October 17 verified release continuation

PR 59 merged as 69bb2f8142b18cada9a4d20991bd303950472f6d. Production backend deployment dpl_EXpCwmLUVgrcC33bVMsrVqAXbQxZ is READY. PR CI passed. Browser verification on the official Contact page matched the refund answer, created the controlled operational case 3c892ff7, and displayed its saved case and private link. Signed provider events record both the support confirmation and the trusted-owner alert as delivered. No enrollment, payment, publication, or curriculum record was altered for this verification. The supplied support email remains unverified identity and cannot authorize account disclosure.

A small public interface follow-up handles private links clicked within the already-open Contact page as well as initial navigation, removes the credential fragment, strengthens heading hierarchy, and versions the public assets. It does not change the backend or support authority. Verify private-link reopening and requester follow-up on the official site after that update. Keep the controlled test case distinct from a customer request.

Remaining backend work is not relabeled complete: generative AI support, administrative role delegation and MFA, restoration proof, broader operational alert/retry coverage, qualified legal review, and the final launch acceptance evidence. Do not restart completed enrollment tests or inspect approved curriculum while continuing these operations.
