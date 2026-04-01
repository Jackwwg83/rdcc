#!/usr/bin/env node
/**
 * build.mjs — Best-effort build of rdcc v1.0.0 from source
 *
 * ⚠️  IMPORTANT: A complete rebuild requires the Bun runtime's compile-time
 *     intrinsics (feature(), MACRO, bun:bundle). This script provides a
 *     best-effort build using esbuild. See KNOWN_ISSUES.md for details.
 *
 * What this script does:
 *   1. Copy src/ → build-src/ (original untouched)
 *   2. Replace `feature('X')` → `false`  (compile-time → runtime)
 *   3. Replace `MACRO.VERSION` etc → string literals
 *   4. Replace `import from 'bun:bundle'` → stub
 *   5. Create stubs for missing feature-gated modules
 *   6. Bundle with esbuild → dist/cli.js
 *
 * Requirements: Node.js >= 18, npm
 * Usage:       node scripts/build.mjs
 */

import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VERSION = '2.1.88'
const BUILD = join(ROOT, 'build-src')
const ENTRY = join(BUILD, 'entry.ts')

// ── Helpers ────────────────────────────────────────────────────────────────

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory() && e.name !== 'node_modules') yield* walk(p)
    else yield p
  }
}

async function exists(p) { try { await stat(p); return true } catch { return false } }

async function ensureEsbuild() {
  try { execSync('npx esbuild --version', { stdio: 'pipe' }) }
  catch {
    console.log('📦 Installing esbuild...')
    execSync('npm install --save-dev esbuild', { cwd: ROOT, stdio: 'inherit' })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Copy source
// ══════════════════════════════════════════════════════════════════════════════

await rm(BUILD, { recursive: true, force: true })
await mkdir(BUILD, { recursive: true })
await cp(join(ROOT, 'src'), join(BUILD, 'src'), { recursive: true })
console.log('✅ Phase 1: Copied src/ → build-src/')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1.5: Create missing resource files and module stubs
// ══════════════════════════════════════════════════════════════════════════════

// Text asset placeholders
const textAssets = [
  'utils/yolo-classifier-prompts/auto_mode_system_prompt.txt',
  'utils/yolo-classifier-prompts/permissions_external.txt',
  'utils/yolo-classifier-prompts/permissions_anthropic.txt',
  'utils/ultraplan/prompt.txt',
  'skills/bundled/verify/examples/cli.md',
  'skills/bundled/verify/examples/server.md',
  'skills/bundled/verify/SKILL.md',
]

for (const asset of textAssets) {
  const p = join(BUILD, 'src', asset)
  await mkdir(dirname(p), { recursive: true }).catch(() => {})
  if (!await exists(p)) {
    await writeFile(p, '', 'utf8')
  }
}

// Missing module stubs
const moduleStubs = {
  'utils/protectedNamespace.js': 'export function checkProtectedNamespace() { return false }\n',
  'entrypoints/sdk/runtimeTypes.js': 'export {}\n',
  'entrypoints/sdk/toolTypes.js': 'export {}\n',
  'entrypoints/sdk/coreTypes.generated.js': 'export {}\n',
  'services/compact/cachedMicrocompact.js': 'export default {}\n',
  'ink/devtools.js': 'export {}\n',
  'tools/TungstenTool/TungstenTool.js': 'export const TungstenTool = undefined;\n',
  'utils/filePersistence/types.js': 'export const DEFAULT_UPLOAD_CONCURRENCY = 5;\nexport const FILE_COUNT_LIMIT = 100;\nexport const OUTPUTS_SUBDIR = "outputs";\n',
}

for (const [modPath, content] of Object.entries(moduleStubs)) {
  const p = join(BUILD, 'src', modPath)
  await mkdir(dirname(p), { recursive: true }).catch(() => {})
  if (!await exists(p)) {
    await writeFile(p, content, 'utf8')
  }
}

console.log('✅ Phase 1.5: Created missing resource files and module stubs')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Transform source
// ══════════════════════════════════════════════════════════════════════════════

let transformCount = 0

// MACRO replacements
const MACROS = {
  'MACRO.VERSION': `'${VERSION}'`,
  'MACRO.BUILD_TIME': `''`,
  'MACRO.FEEDBACK_CHANNEL': `'https://github.com/anthropics/claude-code/issues'`,
  'MACRO.ISSUES_EXPLAINER': `'https://github.com/anthropics/claude-code/issues/new/choose'`,
  'MACRO.FEEDBACK_CHANNEL_URL': `'https://github.com/anthropics/claude-code/issues'`,
  'MACRO.ISSUES_EXPLAINER_URL': `'https://github.com/anthropics/claude-code/issues/new/choose'`,
  'MACRO.NATIVE_PACKAGE_URL': `'@anthropic-ai/claude-code'`,
  'MACRO.PACKAGE_URL': `'@anthropic-ai/claude-code'`,
  'MACRO.VERSION_CHANGELOG': `''`,
}

for await (const file of walk(join(BUILD, 'src'))) {
  if (!file.match(/\.[tj]sx?$/)) continue

  let src = await readFile(file, 'utf8')
  let changed = false

  // 2a. feature('X') → false
  if (/\bfeature\s*\(\s*['"][A-Z_]+['"]\s*\)/.test(src)) {
    src = src.replace(/\bfeature\s*\(\s*['"][A-Z_]+['"]\s*\)/g, 'false')
    changed = true
  }

  // 2b. MACRO.X → literals
  for (const [k, v] of Object.entries(MACROS)) {
    if (src.includes(k)) {
      src = src.replaceAll(k, v)
      changed = true
    }
  }

  // 2c. Replace bun:bundle / stubs/bun-bundle import with inline feature()
  if (src.includes("from 'bun:bundle'") || src.includes('from "bun:bundle"') ||
      src.includes("stubs/bun-bundle")) {
    src = src.replace(
      /import\s*\{\s*feature\s*\}\s*from\s*['"][^'"]*(?:bun:bundle|stubs\/bun-bundle[^'"]*)['"]\s*;?\n?/g,
      'const feature = () => false;\n'
    )
    changed = true
  }

  // 2d. Fix jsonc-parser deep import (ESM compat issue on Node 25+)
  if (src.includes("jsonc-parser/lib/esm/main.js")) {
    src = src.replaceAll("jsonc-parser/lib/esm/main.js", "jsonc-parser")
    changed = true
  }

  // 2e. Remove type-only import of global.d.ts
  if (src.includes("import '../global.d.ts'") || src.includes("import './global.d.ts'")) {
    src = src.replace(/import\s*['"][.\/]*global\.d\.ts['"];?\n?/g, '')
    changed = true
  }

  if (changed) {
    await writeFile(file, src, 'utf8')
    transformCount++
  }
}
console.log(`✅ Phase 2: Transformed ${transformCount} files`)

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Create entry wrapper
// ══════════════════════════════════════════════════════════════════════════════

await writeFile(ENTRY, `// rdcc v${VERSION} — built from source
// rdcc - Built from source
import './src/entrypoints/cli.tsx'
`, 'utf8')
console.log('✅ Phase 3: Created entry wrapper')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Iterative stub + bundle
// ══════════════════════════════════════════════════════════════════════════════

await ensureEsbuild()

const OUT_DIR = join(ROOT, 'dist')
await mkdir(OUT_DIR, { recursive: true })
const OUT_FILE = join(OUT_DIR, 'cli.js')

// Run up to 5 rounds of: esbuild → collect missing → create stubs → retry
const MAX_ROUNDS = 5
let succeeded = false

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`\n🔨 Phase 4 round ${round}/${MAX_ROUNDS}: Bundling...`)

  let esbuildOutput = ''
  try {
    esbuildOutput = execSync([
      'npx esbuild',
      `"${ENTRY}"`,
      '--bundle',
      '--platform=node',
      '--target=node18',
      '--format=esm',
      `--outfile="${OUT_FILE}"`,
      `--banner:js=$'#!/usr/bin/env node\\n// rdcc v${VERSION} (built from source)\\n// rdcc - Built from source\\nimport { createRequire as __createRequire } from "node:module";\\nconst require = __createRequire(import.meta.url);\\n'`,
      `'--tsconfig-raw=${JSON.stringify({compilerOptions:{baseUrl:".",paths:{"src/*":["build-src/src/*"]},jsx:"react-jsx"}})}'`,
      '--loader:.txt=text',
      '--loader:.md=text',
      "'--external:bun:*'",
      "'--external:@anthropic-ai/sandbox-runtime'",
      "'--external:@anthropic-ai/mcpb'",
      "'--external:@anthropic-ai/foundry-sdk'",
      '--external:modifiers-napi',
      '--external:image-processor-napi',
      '--external:jsonc-parser',
      '--external:@opentelemetry/exporter-logs-otlp-grpc',
      '--external:@opentelemetry/exporter-logs-otlp-proto',
      '--external:@opentelemetry/exporter-metrics-otlp-grpc',
      '--external:@opentelemetry/exporter-metrics-otlp-proto',
      '--external:@opentelemetry/exporter-trace-otlp-grpc',
      '--external:@opentelemetry/exporter-trace-otlp-proto',
      '--allow-overwrite',
      '--log-level=error',
      '--log-limit=0',
      '--sourcemap',
    ].join(' '), {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    }).stderr?.toString() || ''
    succeeded = true
    break
  } catch (e) {
    esbuildOutput = (e.stderr?.toString() || '') + (e.stdout?.toString() || '')
  }

  // Parse missing modules with importer info
  // esbuild error format:
  //   ✘ [ERROR] Could not resolve "../../assistant/index.js"
  //   (blank line or whitespace)
  //       build-src/src/commands.ts:123:45:
  const errorBlocks = esbuildOutput.split(/✘\s*\[ERROR\]\s*/)
  const missing = [] // array of { mod, importer }
  const seenMods = new Set()

  for (const block of errorBlocks) {
    const resolveMatch = block.match(/^Could not resolve "([^"]+)"/)
    if (!resolveMatch) continue
    const mod = resolveMatch[1]
    if (mod.startsWith('node:') || mod.startsWith('bun:') || mod.startsWith('/')) continue

    // Try to extract importer file path from the next line
    const importerMatch = block.match(/\n\s*(build-src\/[^\s:]+):\d+:\d+/)
    const importer = importerMatch ? importerMatch[1] : null

    const key = `${mod}::${importer || ''}`
    if (!seenMods.has(key)) {
      seenMods.add(key)
      missing.push({ mod, importer })
    }
  }

  if (missing.length === 0) {
    // No more missing modules but still errors — check what
    const errLines = esbuildOutput.split('\n').filter(l => l.includes('ERROR')).slice(0, 5)
    console.log('❌ Unrecoverable errors:')
    errLines.forEach(l => console.log('   ' + l))
    break
  }

  console.log(`   Found ${missing.length} missing modules, creating stubs...`)

  // Create stubs
  let stubCount = 0
  for (const { mod, importer } of missing) {
    const cleanMod = mod.replace(/^\.\//, '')

    // Determine target path for the stub
    let targetPath
    if (mod.startsWith('.') && importer) {
      // Relative import — resolve from importer's directory
      const importerDir = dirname(join(ROOT, importer))
      targetPath = resolve(importerDir, mod)
    } else if (mod.startsWith('.')) {
      // Relative but no importer info — best-effort in build-src/src
      targetPath = join(BUILD, 'src', cleanMod)
    } else {
      // Bare specifier — place in build-src/src
      targetPath = join(BUILD, 'src', cleanMod)
    }

    // Text assets → empty file
    if (/\.(txt|md|json)$/.test(cleanMod)) {
      await mkdir(dirname(targetPath), { recursive: true }).catch(() => {})
      if (!await exists(targetPath)) {
        await writeFile(targetPath, cleanMod.endsWith('.json') ? '{}' : '', 'utf8')
        stubCount++
      }
      continue
    }

    // JS/TS modules → export empty
    if (/\.[tj]sx?$/.test(cleanMod) || !cleanMod.includes('.')) {
      // If no extension, try .js
      let p = targetPath
      if (!cleanMod.includes('.')) p = targetPath + '.js'
      await mkdir(dirname(p), { recursive: true }).catch(() => {})
      if (!await exists(p)) {
        await writeFile(p, `// Auto-generated stub for ${cleanMod}\nexport default undefined;\n`, 'utf8')
        stubCount++
      }
    }
  }
  console.log(`   Created ${stubCount} stubs`)
}

if (succeeded) {
  // Ensure cli.js is executable (for npm link / global install)
  const { chmod } = await import('node:fs/promises')
  await chmod(OUT_FILE, 0o755)
  const size = (await stat(OUT_FILE)).size
  console.log(`\n✅ Build succeeded: ${OUT_FILE}`)
  console.log(`   Size: ${(size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`\n   Usage:  node ${OUT_FILE} --version`)
  console.log(`           node ${OUT_FILE} -p "Hello"`)
} else {
  console.error('\n❌ Build failed after all rounds.')
  console.error('   The transformed source is in build-src/ for inspection.')
  console.error('\n   To fix manually:')
  console.error('   1. Check build-src/ for the transformed files')
  console.error('   2. Create missing stubs in build-src/src/')
  console.error('   3. Re-run: node scripts/build.mjs')
  process.exit(1)
}
