// Relocates Next's native SWC binary so Next falls back to WASM SWC.
// This is ONLY a workaround for local sandboxes/VMs where mmap of the native
// .node binary faults (SIGBUS). It must NOT run in CI / on Vercel, where the
// native binary works and is required for a fast, correct production build.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (process.env.VERCEL || process.env.CI || process.env.KEEP_NATIVE_SWC) {
  console.log('Skipping SWC relocation (CI/Vercel/native requested).');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodeModulesNext = path.join(__dirname, '../node_modules/@next');

if (fs.existsSync(nodeModulesNext)) {
  const entries = fs.readdirSync(nodeModulesNext);
  for (const entry of entries) {
    if (entry.startsWith('swc-') && !entry.endsWith('.bak')) {
      const fullPath = path.join(nodeModulesNext, entry);
      const bakPath = path.join(nodeModulesNext, entry + '.bak');
      try {
        if (fs.existsSync(bakPath)) {
          fs.rmSync(bakPath, { recursive: true, force: true });
        }
        fs.renameSync(fullPath, bakPath);
        console.log(`Relocated native SWC binary ${entry} -> ${entry}.bak for WASM fallback.`);
      } catch (err) {
        console.warn(`Could not relocate ${entry}:`, err.message);
      }
    }
  }
}
