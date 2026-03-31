#!/usr/bin/env node
/**
 * create-stub-packages.mjs — Create stub npm packages for unavailable internal modules
 * Run after npm install to ensure these exist in node_modules/
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NM = join(ROOT, 'node_modules')

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
  '@ant/claude-for-chrome-mcp': `
export const BROWSER_TOOLS = []
export function createClaudeForChromeMcpServer() { return null }
`,
  'color-diff-napi': `
export class ColorDiff { diff() { return [] } }
export class ColorFile { constructor(n, c) { this.name = n; this.content = c } }
export function getSyntaxTheme() { return {} }
export function closest() { return null }
`,
  'modifiers-napi': 'export default undefined\n',
}

let created = 0
for (const [name, code] of Object.entries(stubs)) {
  const dir = join(NM, name)
  const pkgJson = join(dir, 'package.json')
  const indexJs = join(dir, 'index.js')

  // Skip if real package is installed (has more than our stub)
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
  created++
  console.log(`  stub: ${name}`)
}

console.log(`✅ Created ${created} stub packages`)
