# eTaabo V1 Technical Architecture

Status: implementation in progress; the owned database has the core domain tables and RLS policies, but the complete app flow and end-to-end validation are not finished.

## Product boundary

eTaabo is Tap. Pay. Track. It is not a POS. Customer taps NFC or scans QR, opens a public merchant/device URL, enters the amount manually, chooses a configured mobile-money provider, and continues in the provider flow. eTaabo records a payment session as `initiated`; opening a USSD/dialer screen is not proof of payment. Manual confirmation means a staff member checked the receiving provider message. The optional Android SMS Reader logs provider financial messages separately and does not automatically prove that a specific Tap2Pay session was paid.

Never request or store a mobile-money PIN. Never classify money-in minus money-out as profit. Financial SMS ingestion must filter financial messages only and avoid uploading unrelated personal SMS.

## Current implementation observed

The existing React/Vite app uses Supabase JS. The owned Supabase project `ksjheayntmkmiequihsa` currently has the merchant/payment tables plus `branches`, `merchant_memberships`, `devices`, `sms_readers`, `loyalty_customers`, `loyalty_rewards`, and `loyalty_activity`. `payment_sessions` includes branch/device/payer-reference fields; `financial_transactions` includes branch, reader, dedupe key and review state. RLS is enabled across the public tables at the time of inspection.

Recent implementation work:
- Regenerated `src/integrations/supabase/types.ts` from the current owned database schema, including `classify_financial_transaction`.
- Added server-side `confirm_payment_session` / `cancel_payment_session` flows that require authentication, check merchant membership, and only confirm/cancel a session in a permitted state.
- Added `merchant_admin_access_v1` migration and matching `supabase/migrations/20261012174029_merchant_admin_access_v1.sql` repository file: merchant owners/admins can read their own merchant profile and manage their own provider configuration.
- Deployed `assign-merchant-admin` Edge Function v4 (JWT required; caller must be platform Super Admin). New accounts are created with a generated one-time password, require a password change on first sign-in, and are linked to the merchant owner membership server-side. Existing email accounts are linked without changing their current passwords.
- Added Admin form fields for merchant owner name/email and status badges to identify merchants without an active owner/admin membership.
- Separated the portals by hostname: `admin.etaabo.com` is Super Admin-only, while `merchant.etaabo.com` is the merchant login/dashboard and password-change portal. The app now routes legacy `/admin`, `/merchant`, `/login`, and `/set-password` paths to the correct subdomain and rejects temporary-password sessions from accessing the merchant dashboard before changing their password.
- Added `/set-password` for new accounts and `/merchant` dashboard route for signed-in owner/admin memberships. Merchant dashboard queries only the signed-in user's memberships and then only those merchant IDs.
- Merchant credential handoff now points to `https://merchant.etaabo.com/`; the public payment link remains on `https://etaabo.com/pay?merchant=...`.
- Merchant Admin dashboard now provides tenant-scoped business profile fields (name, contact number, currency) and EVC Plus/eDahab/Premier receiving-number + USSD-template settings, protected by merchant-manager RLS policies.
- Added `classify_financial_transaction` RPC so outgoing transaction classification requires platform admin or merchant manager authorization and cannot be used to mark incoming transactions as classified.
- Added `resolve_public_device(_token)` and `/p/:deviceToken`. Every device receives an immutable random public token; the route resolves only active devices tied to an active merchant and branch. Payment sessions now record the resolved `device_id` and `branch_id`.
- Added `DevicesPanel` to the Super Admin and Merchant Admin dashboards to create devices for Table Mini, Counter Stand, and Mobile Card, copy unique public URLs, and revoke lost devices without reusing their token.
- Hardened public payment-session insertion using the `is_active_payment_target` SECURITY DEFINER check so anonymous sessions can only point to an active merchant, valid branch, and active non-revoked device that belongs to that merchant/branch.
- Updated Payment Sessions UI to use protected RPCs instead of writing confirmation fields from the browser.
- Corrected Money In/Out UI so categorizing an outgoing transaction changes `review_state`, not provider `verification_state`; categorization is not treated as proof of payment.
- Fixed Tap2Pay to use only explicitly configured active payment methods; removed the silent legacy EVC fallback so a missing provider configuration cannot route a payment to an unintended number.
- Added strict validation for provider receiving numbers, exactly one `{phone}` and `{amount}` placeholder, USSD wrapper characters, and the maximum session amount before creating a payment session. The selected provider template is used without changing its placeholder order.
- Encodes `#` in the `tel:` URI so the USSD terminator is not parsed as a URL fragment; added unit tests for template validation, provider-specific substitution, maximum amount, and safe dialer link generation.

Not yet verified complete: invited-user journey end-to-end (including Supabase Auth redirect allow-list), first platform-admin bootstrap, branch-level cashier UI/permissions, immutable device-token public route, SMS Reader pairing/parsing/sync, old backend data migration, production deployment cutover, and a passing build/unit/end-to-end test run.

## Proposed data model

### Merchant and access
- `merchants`: merchant profile, public slug/id, branding, currency, active status.
- `profiles`: public user profile linked to Supabase Auth.
- `user_roles`: platform-level roles, including super-admin.
- `merchant_memberships`: user-to-merchant role mapping (`owner`, `admin`, `cashier`); branch-scoped access should be explicit.
- `branches`: merchant-owned branch records with name, location/notes, active state.
- `devices`: merchant/branch hardware records with immutable unique token, type (`table_mini`, `counter_stand`, `mobile_card`), public URL token, active/revoked state, and timestamps. Do not hard-delete lost devices; revoke them.
- `merchant_payment_methods`: one record per merchant/provider receiving number and provider-specific USSD template. Validate template placeholders and never reuse one provider's configuration for another provider.

### Payment initiation
- `payment_sessions`: merchant, branch/device if available, payment method/provider, amount/currency, optional payer reference, status (`initiated`, `manual_confirmed`, `cancelled`), initiated/confirmed timestamps and confirming user.
- Public access should only read an active merchant/device/payment method and create a narrowly scoped payment session. Public clients must not update confirmation status or read other sessions.
- Manual confirmation must be authorized staff action and be labelled as manual, not provider-verified.

### Money tracking / SMS reader
- `financial_transactions`: merchant/branch/reader, direction (`incoming`/`outgoing`), provider, amount/currency, counterparty, transaction ID, occurred time, source, category, review/verification state and sanitized excerpt only when necessary.
- `expense_categories`: categories for expense, internal transfer, refund, and other. An outgoing transaction starts unclassified / needs review. Classification is accounting categorization, not independent provider verification.
- `sms_readers`: paired Android reader per merchant/branch/SIM; pairing state, last sync, app version, device label and revocation timestamps. Never store SIM secrets.
- Deduplicate by provider + transaction ID when present; otherwise use a stable content/time fingerprint with careful collision handling. Keep ingestion idempotent and retry-safe.
- Reader API must authenticate paired device and scope every write to its assigned merchant/branch. Only financial SMS matching provider-specific parsers should be uploaded; unrelated messages must stay on device.

### Loyalty
- `loyalty_customers`: manually created by merchant, merchant-scoped phone/name/customer code, points/stamps, active state.
- `loyalty_rewards`: merchant-scoped reward definitions and redemption history if redemption is enabled.
- Never auto-create loyalty customers from every SMS payer number.

## Authorization and tenant isolation

- Enable RLS on every exposed public table.
- Platform super-admin permissions must come from protected server-controlled role data, not user-editable metadata.
- Merchant owners/admins may manage their merchant's settings, branches, devices, payment methods, loyalty and staff within policy.
- Cashiers should only see the merchant/branch data assigned to them and may manually confirm sessions if explicitly permitted.
- Public payment routes should not expose financial ledgers, payer histories, private merchant settings, or other sessions.
- Use explicit grants as well as RLS. Keep service-role/secret keys server-side only.
- Storage uploads must be scoped to the authenticated merchant/authorized user; public read is only for intended branding assets.

## Main app routes / pages

- `/`: public eTaabo landing/onboarding.
- `/p/:deviceToken`: immutable NFC/QR URL resolved server-side to active merchant, branch and device.
- `/pay`: legacy compatibility only during transition; do not depend on a mutable merchant query parameter for permanent hardware links.
- `/login` and `/admin`: protected dashboard.
- Dashboard: money-in/out totals, counts, date filters and branch/provider breakdown; no unsupported profit claim.
- Payment Sessions: initiated / manually confirmed / cancelled and audit details.
- Money In / Money Out: searchable financial ledger and category review.
- Needs Review: unclassified outgoing and ambiguous/duplicate SMS records.
- Branches, Devices, SMS Readers, Users, Settings, Reports/CSV and Loyalty.

## Build sequence

1. Inspect and reconcile existing Supabase schema with the actual app hooks and components.
2. Audit and test existing schema/RLS for branch/device/membership/SMS-reader/loyalty models; add any missing migration history and tenant tests.
3. Create the first Auth admin securely and test authorization.
4. Extend and test the immutable device-token route end-to-end on the custom domain, including revoked-token rejection and NFC/QR equivalence.
5. Add unit tests for SMS parsers, transaction deduplication, and tenant permission boundaries.
6. Implement Android SMS Reader pairing, financial-only parsing, offline queue and retry-safe sync.
7. Run build/lint/tests and end-to-end tests against the owned Supabase project.
8. Export/import any required old data, configure Cloudflare deployment, verify production URLs, then disconnect Lovable hosting/backend.

## Acceptance criteria

- Tapping/scanning a device opens the correct active merchant and branch.
- Customer-entered amount is validated; no PIN is requested or stored.
- A Tap2Pay initiation never becomes paid automatically merely because USSD/dialer opened.
- Manual confirmation records who confirmed and when.
- SMS Reader ingests only supported financial SMS, handles duplicate retries safely, and never uploads unrelated personal messages.
- RLS tests prove cross-merchant/branch data cannot be read or changed.
- Admin and cashier permissions are tested independently.
- Public payment routes cannot query private transaction ledgers.
- The app builds and its routes work on the independent host before Lovable is disconnected.
