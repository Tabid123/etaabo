# eTaabo V1 Technical Architecture

Status: architecture draft; implementation and end-to-end validation are still in progress.

## Product boundary

eTaabo is Tap. Pay. Track. It is not a POS. Customer taps NFC or scans QR, opens a public merchant/device URL, enters the amount manually, chooses a configured mobile-money provider, and continues in the provider flow. eTaabo records a payment session as `initiated`; opening a USSD/dialer screen is not proof of payment. Manual confirmation means a staff member checked the receiving provider message. The optional Android SMS Reader logs provider financial messages separately and does not automatically prove that a specific Tap2Pay session was paid.

Never request or store a mobile-money PIN. Never classify money-in minus money-out as profit. Financial SMS ingestion must filter financial messages only and avoid uploading unrelated personal SMS.

## Current implementation observed

The existing React/Vite app uses Supabase JS and currently queries these tables:
- `merchants`
- `merchant_payment_methods`
- `payment_sessions`
- `financial_transactions`
- `expense_categories`
- `profiles`
- `user_roles`

The new owned Supabase project is `ksjheayntmkmiequihsa`. Current schema has RLS enabled on these tables. The project migration, data migration from the former Lovable-managed backend, authentication setup, and deployment cutover are not yet verified complete.

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
2. Finish schema and RLS policies for branch/device/membership/SMS-reader/loyalty models.
3. Create the first Auth admin securely and test authorization.
4. Build the immutable device-token payment route and validate each provider template.
5. Add unit tests for provider URL/template generation, SMS parsers, transaction deduplication, and permission boundaries.
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
