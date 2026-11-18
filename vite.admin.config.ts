import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Admin portal: a separate app (own origin/subdomain) built from the same codebase.
//   npm run dev:admin   → http://localhost:3001
//   npm run build:admin → dist-admin/
const here = fileURLToPath(new URL('.', import.meta.url));
// Build constant sent with beta feedback (see src/feedback/feedback.ts).
const { version } = JSON.parse(readFileSync(`${here}package.json`, 'utf8')) as { version: string };

export default defineConfig({
  root: `${here}admin`,
  envDir: here, // share .env / .env.production with the marketplace
  publicDir: `${here}public`,
  // Separate dep-optimizer cache so both dev servers can run at once.
  cacheDir: `${here}node_modules/.vite-admin`,
  // The page lives in admin/, the code in src/: map /src to the shared source folder.
  resolve: { alias: { '/src': `${here}src` } },
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 3001, open: false },
  build: { outDir: `${here}dist-admin`, emptyOutDir: true },
});
