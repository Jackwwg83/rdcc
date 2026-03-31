#!/usr/bin/env node
/**
 * create-stub-packages.mjs — Install local packages and stubs into node_modules/
 *
 * For packages with real implementations in packages/, copies them.
 * For unavailable internal packages, creates minimal stubs.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NM = join(ROOT, 'node_modules')
const PKGS = join(ROOT, 'packages')

// ── Phase 1: Copy real local packages from packages/ ─────────────────────
const localPackages = [
  'color-diff-napi',
  'audio-capture-napi',
  'image-processor-napi',
  'modifiers-napi',
  'url-handler-napi',
  '@ant/claude-for-chrome-mcp',
  '@ant/computer-use-input',
  '@ant/computer-use-mcp',
  '@ant/computer-use-swift',
]

let copied = 0
for (const name of localPackages) {
  const src = join(PKGS, name)
  const dest = join(NM, name)
  if (!existsSync(src)) continue

  // Skip if a real npm package is installed (not our version)
  if (existsSync(join(dest, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'))
      if (pkg.version && pkg.version !== '0.0.0-stub' && pkg.version !== '0.0.0') continue
    } catch {}
  }

  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  copied++
  console.log(`  local: ${name}`)
}

// ── Phase 2: Create stubs for truly unavailable packages ──────────────────
const stubs = {
  '@anthropic-ai/sandbox-runtime': `
export class SandboxManager {
  static isSandboxingEnabled() { return false }
  static isSandboxRequired() { return false }
  static getSandboxUnavailableReason() { return null }
  static isSupportedPlatform() { return false }
  static checkDependencies() { return { errors: ['rdcc stub: sandbox not available'] } }
  static async initialize() {}
  static async reset() {}
  static updateConfig() {}
  static wrapWithSandbox(cmd, args) { return { command: cmd, args } }
  static getFsReadConfig() { return {} }
  static getFsWriteConfig() { return {} }
  static getNetworkRestrictionConfig() { return {} }
  static getIgnoreViolations() { return false }
  static getAllowUnixSockets() { return false }
  static getAllowLocalBinding() { return false }
  static getEnableWeakerNestedSandbox() { return false }
  static getProxyPort() { return 0 }
  static getSocksProxyPort() { return 0 }
  static getLinuxHttpSocketPath() { return null }
  constructor() {}
  async start() {}
  async stop() {}
}
export const SandboxRuntimeConfigSchema = { parse: x => x, safeParse: x => ({ success: true, data: x }) }
export class SandboxViolationStore { constructor() {} getViolations() { return [] } }
export function addToExcludedCommands() {}
export function convertToSandboxRuntimeConfig(x) { return x }
export function resolvePathPatternForSandbox(x) { return x }
export function resolveSandboxFilesystemPath(x) { return x }
export function shouldAllowManagedSandboxDomainsOnly() { return false }
`,
  '@anthropic-ai/mcpb': 'export default undefined\n',
  '@anthropic-ai/foundry-sdk': 'export default undefined\n',
}

let stubbed = 0
for (const [name, code] of Object.entries(stubs)) {
  const dir = join(NM, name)
  const pkgJson = join(dir, 'package.json')
  const indexJs = join(dir, 'index.js')

  if (existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'))
      if (pkg.version && pkg.version !== '0.0.0-stub') continue
    } catch {}
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(pkgJson, JSON.stringify({
    name,
    version: '0.0.0-stub',
    type: 'module',
    main: 'index.js',
    exports: { '.': { import: './index.js', default: './index.js' } }
  }, null, 2))
  writeFileSync(indexJs, code.trim() + '\n')
  stubbed++
  console.log(`  stub: ${name}`)
}

console.log(`✅ Installed ${copied} local packages, created ${stubbed} stubs`)
