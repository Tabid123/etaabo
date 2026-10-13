# eTaabo SMS Reader (Android)

This is a separate Android companion app for the eTaabo merchant phone that receives supported provider transaction SMS.

## Current capability

- Pairs with an SMS Reader record created in the eTaabo merchant dashboard.
- Receives new SMS only after the user grants the Android `RECEIVE_SMS` permission.
- Processes only messages whose sender ID is explicitly configured in this app for EVC Plus, eDahab, or Premier.
- Parses only a conservative, explicit amount/currency and incoming/outgoing direction pattern.
- Stores parsed financial fields plus the full body of each confidently parsed, sender-allowlisted financial SMS in the encrypted-device-protected local app queue until server acknowledgement. Unrelated SMS is ignored.
- Uploads batches through `sync-sms-reader`; full SMS body is saved to that reader’s paired merchant transaction record and shown in that merchant’s dashboard under the same row-level security rules. Accepted records remain `unverified` and `needs_review`; SMS ingestion never marks a Tap2Pay session as paid.
- Stores the reader secret encrypted using an Android Keystore AES-GCM key and deletes queued records only after the server acknowledges the batch.

## Configure the public Supabase client key

Create `sms-reader-android/local.properties` (do not commit it) with:

```properties
supabase.url=https://ksjheayntmkmiequihsa.supabase.co
supabase.anonKey=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The key is a public client key, never a service-role/secret key. Server credentials belong only in Supabase Edge Function secrets.

## Build

Use JDK 17 and Android SDK Platform 35, then run:

```bash
gradle :app:assembleDebug
gradle :app:testDebugUnitTest
```

## Important parser and release notes

Provider SMS formats and sender IDs must be verified against redacted examples from real EVC Plus, eDahab, and Premier notifications. Until a sender ID is configured and a message has exactly one unambiguous amount with an explicit USD/SOS currency plus a clear direction, the parser ignores it. Only those accepted financial messages have their full body uploaded; unrelated personal SMS is not queued or uploaded.

Before production release, complete device tests for multi-part SMS, actual provider message formats, dual-SIM phones, Android background restrictions, offline retries, pairing expiry/reuse, and device revocation. Google Play treats SMS permissions as sensitive and can require a permissions declaration and approval; review the permitted-use policy before publishing. Permission consent and a visible privacy disclosure must remain prominent.


## Merchant login and device presence

- The Android app supports a Supabase Auth email/password check before pairing.
- Pairing still must be created by the merchant or an authorized admin in the dashboard. The short-lived, one-time pairing code binds the reader to the merchant/branch selected by the dashboard; the app cannot choose another merchant by sending a merchant ID.
- The reader reports authenticated heartbeats through the `ping-sms-reader` Edge Function. The backend stores last-seen time, model/manufacturer, Android version, and app version.
- The dashboard refreshes reader status periodically. "Online hadda" means a successful authenticated heartbeat was received recently; Android can defer periodic work due to power saving, so timing is approximate.
- Apply the new SQL migration and deploy the new `ping-sms-reader` Edge Function before testing the updated app. Never put a service-role key in the Android app.
