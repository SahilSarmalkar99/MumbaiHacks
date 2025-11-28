# Firebase Backend & Firestore Schema

This document details how we replace the current FastAPI + SQLAlchemy auth stack with Firebase Auth plus Firestore-based data storage, aligned with the automation goals in `ai.plan.md`.

## 1. Firebase Auth Migration

- **Identity Providers**
  - Email/password (mirrors existing forms in `frontend/src/components/auth/*`).
  - Phone number + OTP for business owners needing passwordless access.
  - Optional federated login (Google, Microsoft) for accountants; enables SCIM later.
- **Session Handling**
  - Web client loads Firebase JS SDK, uses `signInWithEmailAndPassword` / `signInWithPhoneNumber`.
  - Retrieve ID token via `currentUser.getIdToken()`; attach as `Authorization: Bearer <token>` when calling Cloud Functions / HTTPS endpoints.
  - Enforce MFA in Firebase Console for privileged roles via custom claims.
- **Role & Business Metadata**
  - Store immutable auth profile in `users` collection (see schema below); attach custom claims (`role`, `businessId`, `permissions`) using an admin Cloud Function triggered on account creation / metadata changes.
- **Sunsetting FastAPI auth**
  - Routes in `Backend/routes/auth.py`, SQLAlchemy `User` model, bcrypt utilities, and JWT issuance become deprecated once Firebase endpoints are wired. Keep FastAPI service only as a temporary proxy until the JS client fully migrates.

## 2. Firestore Collections

All collections use document IDs that include the business ID for efficient querying (`bizId_docId`). Every document stores `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, and `auditTrailId` to support compliance.

### `users`
| Field | Type | Notes |
| --- | --- | --- |
| `profile.fullName` | string | From registration form |
| `profile.businessName` | string | source of truth |
| `contact.phone` | string | E.164 |
| `contact.email` | string | duplicates Firebase email for faster lookup |
| `businessId` | string | partitions all other collections |
| `roles` | array<string> | e.g., `["owner","accountant"]` |
| `preferences` | map | notification channels, approval thresholds |
| `automationGuardrails` | map | stores required confidence levels before auto-execution |

### `invoices`
| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | string | partition key |
| `status` | string | `draft|scheduled|sent|overdue|paid|failed` |
| `customer` | map | contact info, GSTIN, payment links |
| `lineItems` | array<map> | description, qty, unitPrice, taxCode |
| `totals` | map | subtotal, tax, discounts, currency |
| `automation.state` | string | `pending_enrichment`, `awaiting_approval`, etc. |
| `automation.confidence` | number | 0-1 score from LLM |
| `delivery.channels` | map | email, WhatsApp, UPI paylinks |
| `source` | map | references to CRM/order systems |
| `pdfUrl` | string | Firebase Storage link |
| `dueDate` | timestamp | drives dunning scheduler |

Indexes: composite on `(businessId, status, dueDate)` for dashboard queries; `(businessId, automation.state)` for queue processing.

### `transactions`
Tracks bank feed and expense data.

| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | string | partition |
| `amount` | number | positive inflow, negative outflow |
| `currency` | string | ISO |
| `source` | map | bank account, statement ID |
| `classification.category` | string | mapped GST category |
| `classification.confidence` | number | LLM probability |
| `matchedInvoiceIds` | array<string> | references `invoices` docs |
| `supportingDocs` | array<string> | Storage URLs |
| `status` | string | `classified|needs_review|reconciled` |
| `automationFlags` | map | e.g., `requires_human: true` |

Indexes: `(businessId, status)`, `(businessId, classification.category)` for analytics.

### `cashflow_snapshots`
Stores daily/weekly forecasting outputs.

| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | string | partition |
| `period.start`, `period.end` | timestamp | forecast window |
| `forecast.version` | string | algorithm or model hash |
| `metrics` | map | `netCash`, `runwayDays`, `expectedInflow`, `expectedOutflow` |
| `assumptions` | array<map> | describes scenario toggles |
| `explanations` | array<string> | natural-language insights for chat/voice |

### `bank_accounts`
| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | string | partition |
| `provider` | string | bank aggregator (Salt, Plaid, etc.) |
| `connectionStatus` | string | `active|expired|error` |
| `lastSyncedAt` | timestamp | for monitoring |
| `credentialsRef` | string | encrypted secret location (Secret Manager) |
| `accountMask` | string | last 4 digits |

### `tasks`
Unified queue for human intervention.

| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | string | partition |
| `type` | string | `invoice_review`, `classification_override`, `payment_retry` |
| `subjectRef` | map | points to invoice/transaction doc |
| `priority` | string | `low|medium|high` |
| `reason` | string | summary of why AI paused |
| `status` | string | `open|in_progress|resolved` |
| `assigneeUserId` | string | optional |

## 3. Cloud Functions / Cloud Run Services

### HTTPS Callable Functions
| Function | Purpose | Inputs | Outputs |
| --- | --- | --- | --- |
| `createInvoiceFromTemplate` | Called by web client to request auto-generated invoice. | `customerId`, `orderRefs`, optional overrides | `invoiceId`, `automationState`, preview link |
| `submitClassificationOverride` | User-corrected category; retrains few-shot prompt. | `transactionId`, `category`, `notes` | `status` |
| `fetchDashboardSummary` | Consolidates Firestore docs for dashboard. | `businessId` | metrics, pending tasks |

These functions verify Firebase ID tokens, check custom claims, and operate on Firestore with admin privileges.

### Background Triggers (Automation Workflows)

| Workflow | Trigger | Steps | Automation Outcome |
| --- | --- | --- | --- |
| `onUserCreate` | Firebase Auth new user event | Admin function seeds `users` doc, sets custom claims, creates `tasks` entry for onboarding checklist | Ensures role metadata + guardrails exist before any automation runs |
| `invoiceAutopilot` | Firestore `invoice_requests` creation or payment link failure webhook | 1) Fetch CRM/order context; 2) LLM drafts line items + tax codes; 3) Generate PDF via Headless Chrome/`invoicePDFGenerator.ts`; 4) Upload to Storage; 5) Update `invoices` doc; 6) Send via configured channels with retry policy stored in `delivery.attempts` | Fully automated invoice generation and delivery, human notified only if `automation.confidence < threshold` |
| `transactionClassifier` | Pub/Sub message from bank feed ingestion | 1) Normalize transaction payload; 2) Call embedding/LLM classifier with business-specific few-shot examples; 3) Suggest matches against open invoices using amount/date heuristics; 4) Update `transactions` doc with category + confidence; 5) Auto-close if confidence high, else push `tasks` entry | Keeps ledger tax-ready and reconciled with minimal review |
| `cashflowForecaster` | Cloud Scheduler daily/weekly | 1) Pull recent invoices + transactions; 2) Aggregate inflow/outflow curves; 3) Run time-series/LLM hybrid forecaster; 4) Write `cashflow_snapshots`; 5) Generate narratives stored in `explanations`; 6) Update dashboard summary cache | Real-time forecasting feeding chat/voice insights |
| `dunningOrchestrator` | Cloud Scheduler hourly | 1) Query `invoices` with `status=overdue`; 2) Consult delivery history to pick next channel; 3) Send WhatsApp/email with payment link; 4) Attempt auto-charge if tokenized; 5) Record attempt + escalate to `tasks` if retries exhausted | Automated payment retries + compliance-grade audit trail |
| `taskEscalator` | Firestore `tasks` update where `status=open` > SLA | 1) Check SLA timers; 2) Notify assigned user via push/email; 3) Optionally re-run automation with updated data; 4) Escalate priority or reassign | Keeps “minimal intervention” promise by only surfacing high-friction cases |

### Integrations
- **Bank Feeds**: webhook endpoint hosted on Cloud Run (Go/FastAPI) verifying provider signatures, then publishes sanitized events to Pub/Sub for classification functions. Outbound retries handled via Cloud Tasks with idempotency keys to prevent duplicate postings.
- **LLM Services**: Use Vertex AI or Azure OpenAI with grounded prompts; store prompt + response IDs in `automation` map for audit. Maintain business-specific prompt libraries in Firestore (`prompt_kits` collection) so corrections from `tasks` flow back as few-shot examples.
- **Notifications**: Firebase Extensions for WhatsApp/email or custom Cloud Function using SendGrid/Twilio; each attempt writes to `invoices.delivery.attempts`. For voice updates, integrate with Twilio Voice or Exotel, streaming script text generated from the latest `cashflow_snapshots.explanations`.

## 4. Web Client Integration Plan

### Auth & Session Layer
- Replace custom forms in `frontend/src/components/auth/LoginForm.tsx` and `RegisterForm.tsx` with Firebase Auth UI logic:
  - Initialize Firebase SDK inside `frontend/src/main.tsx`.
  - Use `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` flows; phone login uses `RecaptchaVerifier`.
  - Persist user state via `onAuthStateChanged`; store essential profile data in React context (new `AuthProvider`).
- Remove token handling in `frontend/src/services/api.ts`; instead, create `firebaseClient.ts` that wraps callable functions:
```ts
const callable = httpsCallable(functions, 'createInvoiceFromTemplate');
const response = await callable({ customerId, orderRefs });
```
- For legacy FastAPI endpoints still needed during migration, forward Firebase ID token in `Authorization` header; backend verifies using Admin SDK middleware.

### API Access Layer
- Replace `apiService` with two layers:
  1. `functionsClient` for callable invocations (invoices, overrides, dashboard data).
  2. `restClient` for Cloud Run HTTPS endpoints (webhooks testing, document downloads) that append `await currentUser.getIdToken()`.
- Update components in `frontend/src/components/invoices/*` to use the new clients; maintain TypeScript interfaces in `frontend/src/types/index.ts`.

### Dashboard & Automation Surface
- Enhance `frontend/src/components/dashboard/Dashboard.tsx` to read:
  - `cashflow_snapshots` summaries for charts (net cash, runway).
  - Automation health KPIs (automation completion %, tasks awaiting action).
  - Chat/voice widget entry point launching a modal that streams responses from `fetchDashboardSummary`.
- `frontend/src/components/invoices/InvoiceList.tsx` should filter by `automation.state` and surface badges (e.g., “Awaiting Approval”, “Auto-Sent”).
- Add approval panel for tasks:
  - New component `TasksPanel` (under `components/dashboard`) listing Firestore `tasks`.
  - Actions call callable `resolveTask` to re-run automation or accept manual override.

### PDF & File Handling
- Reuse `frontend/src/utils/invoicePDFGenerator.ts` when offline or for preview, but primary invoice PDFs will come from Storage URLs, so update `InvoicePreview.tsx` to fetch signed URL and display via iframe/pdf.js.

### Chat & Voice Insights
- Introduce `useVoiceInsights` hook using Web Speech API for capture and streaming responses from a new callable `voiceInsights` that wraps retrieval-augmented LLM prompts referencing `cashflow_snapshots` and `transactions`.
- Provide quick actions (“Why did cash drop 20% this week?”) pulled from backend suggestions.

### Migration Strategy
1. Feature-flag Firebase auth in `.env` (e.g., `VITE_USE_FIREBASE_AUTH=true`).
2. When enabled, hide FastAPI login/register buttons and show Firebase-powered UI.
3. Gradually route invoice/classification requests through callable functions; keep fallback to REST endpoints until parity confirmed.

## 5. Data Protection
- Secrets (bank tokens, API keys) live in Google Secret Manager; functions read via IAM bindings.
- All Storage buckets use CMEK, and signed URLs expire within 15 minutes.
- Firestore security rules enforce `request.auth.token.businessId == resource.data.businessId` and role-specific access (e.g., only accountants can view reconciliation history).
- Audit logs stream to BigQuery for retention / analytics.

## 6. Observability & Compliance Strategy

### Monitoring Stack
- **Cloud Logging + Error Reporting**: every Cloud Function/Run service uses structured logs with `businessId`, `workflowId`, and `automationState` fields to power filters.
- **Cloud Monitoring Dashboards**:
  - Workflow health (success/failure counts for invoiceAutopilot, transactionClassifier, etc.).
  - Automation KPIs: percentage of invoices auto-approved, avg intervention time, cashflow forecast freshness.
  - Infrastructure metrics: Firestore latency, Pub/Sub backlog, Cloud Tasks queue depth.
- **Alerting**:
  - PagerDuty / email alerts on SLA breaches (e.g., `tasks` older than 4 hours, bank feed sync gaps > 2 hours).
  - Budget alerts for LLM usage spikes.

### Audit & Compliance
- **Immutable Audit Trail**:
  - Every automation writes a record to `audit_logs` BigQuery table (linked to `auditTrailId` stored in Firestore docs) capturing input snapshot, model version, output, and human overrides.
  - Hash critical documents (invoice PDFs, bank statements) and store hashes in Firestore to detect tampering.
- **GST/Tax Readiness**:
  - Maintain `gst_filings` collection capturing period, summary totals, evidence links, and signing status.
  - Generate JSON exports compatible with GST portal APIs; store final filings in Storage with e-sign metadata.
- **Access Controls & Reviews**:
  - Quarterly automated job exports user/role mappings to BigQuery and compares against least-privilege policy; anomalies trigger `tasks` for admins.
  - Enable Firebase Auth logging + Cloud Audit Logs retention (7 years) for regulated customers.
- **Data Residency & Encryption**:
  - Deploy resources in India region (asia-south1) to align with local data residency requirements.
  - Use CMEK for Firestore/Storage; rotation policy every 90 days.
- **Model Governance**:
  - Store prompt/response pairs with versioning; allow rollback if classification drift detected.
  - Scheduled evaluation job samples automated outputs, computes precision/recall using labeled dataset, and emits report to stakeholders.

## 5. Migration Steps
1. Configure Firebase project, enable Auth providers, set up Firestore + Storage.
2. Implement Cloud Functions skeletons with token verification middleware.
3. Mirror existing user records by exporting from MySQL and importing into Firebase using Admin SDK scripts (ensure passwords migrated via `auth.importUsers` or send password reset flows).
4. Update frontend to use Firebase SDK; once stable, disable FastAPI auth endpoints.
5. Backfill invoices/transactions into new collections; run parallel mode until data parity confirmed.

This architecture unlocks automated invoicing, classification, and forecasting workflows while satisfying the minimal-intervention requirement outlined in the project plan.

