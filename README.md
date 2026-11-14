# `becho-web`

Becho Web Application — React Marketplace & Admin Panel built with Vite + TypeScript.

## Structure

```text
src/
├── api/            # API client wrapper
├── pages/
│   ├── Marketplace/ # Buyer / Seller frontend routes
│   └── Admin/       # Admin panel routes
├── App.tsx          # Application router definition
├── main.tsx         # Entrypoint
└── index.css        # Global CSS design tokens
```

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment setup:
   ```bash
   cp .env.example .env
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

Requires `becho-api` running on `http://localhost:4000` (see its README). The dev server runs on port 3000,
which must be listed in the API's `CORS_ORIGINS`.

## Notes

- Sessions persist in `localStorage`; expired access tokens are refreshed automatically (`src/api/client.ts`).
- The city picked in the navbar (`LocationContext`) filters Browse and is the default location for new listings.
- Prices are shown in INR with Indian digit grouping (`src/utils/format.ts`).

## Deploying (Cloudflare Pages)

Build command `npm run build`, output `dist`, env `VITE_API_URL=https://<api-host>/api/v1` and `NODE_VERSION=20`. `public/_redirects` handles client-side routes. Full staging guide: `becho-api/DEPLOY.md`.
