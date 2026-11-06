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
