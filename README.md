# eTaabo

eTaabo is a Somali-focused payment platform for NFC/QR Tap2Pay, optional SMS-based money monitoring, merchant reporting, and digital loyalty.

## Stack

- React + Vite + TypeScript
- Supabase (Database, Auth, Storage, Realtime-ready)
- Tailwind CSS + shadcn/ui
- PWA

## Backend

This repository is connected to the independently owned eTaabo Supabase project. It no longer depends on Lovable Cloud for backend services.

Required client environment variables:

```env
VITE_SUPABASE_PROJECT_ID=your_project_ref
VITE_SUPABASE_URL=https://your_project_ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Product scope

eTaabo V1 focuses on Tap/QR payments, optional SMS money monitoring, incoming/outgoing transaction tracking, reports, devices/branches, and digital loyalty.


## Cloudflare deployment

eTaabo is prepared for Cloudflare Workers Static Assets using `wrangler.jsonc`.

Cloudflare project:
- Worker name: `etaabo`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Output directory: `dist`

The SPA fallback is configured with `not_found_handling = "single-page-application"`, so routes such as `/pay` and `/admin` work on direct refresh.

For manual production publishing from GitHub Actions, create a Cloudflare Deploy Hook targeting `main` and save it as the GitHub Actions secret:

```
CLOUDFLARE_DEPLOY_HOOK
```

Then run **Actions → Publish eTaabo → Run workflow**.
