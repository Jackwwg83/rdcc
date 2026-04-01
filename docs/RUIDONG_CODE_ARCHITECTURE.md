# Ruidong Code — 总体架构设计

> PM: Claude (rdcc 主会话) | 开发: Codex (opencc 实现)
> 基线: Codex 产品计划 `RUIDONG_CODE_PRODUCT_PLAN_CN.md` 阶段 0-2 已完成

## 1. 产品定位

面向开发者的多模型 AI 编码助手 CLI，以 Anthropic Messages API 协议为基座，支持所有兼容该协议的模型供应商。

**不是什么**：
- 不是 Claude Code 的换皮 — 是独立产品
- 不是 OpenAI 兼容网关 — 第一版只支持 Anthropic 协议
- 不是通用 AI 聊天工具 — 聚焦代码编辑/执行场景

## 2. 系统分层

```
┌─────────────────────────────────────────────────┐
│  CLI 层 (Commander.js)                          │
│  rdcc -p / rdcc (REPL) / rdcc init             │
├─────────────────────────────────────────────────┤
│  展示层 (Ink React TUI)                         │
│  Logo / Messages / PermissionRequest / Settings │
├─────────────────────────────────────────────────┤
│  能力层 (Capability Registry)     ← 阶段 3     │
│  getCapabilities(model) → 静态预设 + 远程查询    │
├─────────────────────────────────────────────────┤
│  Provider 层 (Provider Adapter)   ← 阶段 4     │
│  anthropic / deepseek / qwen / custom           │
├─────────────────────────────────────────────────┤
│  协议层 (Anthropic Messages API)                │
│  messages.create / streaming / tool_use         │
├─────────────────────────────────────────────────┤
│  工具层 (Tool System)                           │
│  Bash / FileEdit / FileRead / Grep / Agent / …  │
├─────────────────────────────────────────────────┤
│  配置层 (Ruidong Config)          ← 阶段 1-2   │
│  ~/.ruidong-code/config.json + env vars          │
└─────────────────────────────────────────────────┘
```

## 3. 阶段 3 详细设计：Capability Registry

### 3.1 核心接口

```typescript
// src/utils/model/capabilities.ts

export interface ModelCapabilities {
  // 基础
  maxInputTokens: number
  maxOutputTokens: number
  
  // 功能支持
  supportsTools: boolean
  supportsStreaming: boolean
  supportsImages: boolean         // vision input
  supportsPDFs: boolean
  
  // Anthropic 特有（其他 provider 可能不支持）
  supportsThinking: boolean       // extended thinking
  supportsAdaptiveThinking: boolean
  supportsStructuredOutput: boolean
  supportsEffort: boolean
  supportedEffortLevels: ('low' | 'medium' | 'high' | 'max')[]
  supportsCaching: boolean        // prompt caching
  supportsBatch: boolean
  
  // 成本（可选，用于 cost tracker）
  costPer1kInput?: number
  costPer1kOutput?: number
}
```

### 3.2 Provider 配置接口

```typescript
// src/utils/model/providerRegistry.ts

export interface ProviderConfig {
  id: string                      // 'anthropic' | 'deepseek' | 'qwen' | 'custom'
  name: string                    // 显示名
  protocol: 'anthropic'           // 第一版只有这一种
  
  // 连接
  baseUrl: string
  apiKeyEnvVar: string            // 读哪个环境变量
  apiKeyValue?: string            // 直接值（优先于 env var）
  
  // 模型
  defaultModel: string
  models: Record<string, Partial<ModelCapabilities>>  // 静态预设
  
  // 可选：远程查询能力
  resolveCapabilities?: (model: string) => Promise<ModelCapabilities | null>
  
  // 可选：请求/响应适配
  transformRequest?: (req: MessageCreateParams) => MessageCreateParams
  transformResponse?: (resp: MessageStream) => MessageStream
}
```

### 3.3 内置 Provider 预设

```typescript
// src/utils/model/presets/anthropic.ts
export const ANTHROPIC_PROVIDER: ProviderConfig = {
  id: 'anthropic',
  name: 'Anthropic',
  protocol: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  defaultModel: 'claude-sonnet-4-20250514',
  models: {
    'claude-opus-4-20250514':   { maxInputTokens: 200000, maxOutputTokens: 32000, supportsThinking: true, supportsAdaptiveThinking: true, supportsTools: true, supportsStreaming: true, supportsImages: true, supportsPDFs: true, supportsStructuredOutput: true, supportsEffort: true, supportedEffortLevels: ['low','medium','high','max'], supportsCaching: true, supportsBatch: true },
    'claude-sonnet-4-20250514': { maxInputTokens: 200000, maxOutputTokens: 16000, supportsThinking: true, supportsAdaptiveThinking: true, supportsTools: true, supportsStreaming: true, supportsImages: true, supportsPDFs: true, supportsStructuredOutput: true, supportsEffort: true, supportedEffortLevels: ['low','medium','high'], supportsCaching: true, supportsBatch: true },
    'claude-haiku-3-5-20241022': { maxInputTokens: 200000, maxOutputTokens: 8192, supportsThinking: false, supportsAdaptiveThinking: false, supportsTools: true, supportsStreaming: true, supportsImages: true, supportsPDFs: false, supportsStructuredOutput: true, supportsEffort: false, supportedEffortLevels: [], supportsCaching: true, supportsBatch: true },
  },
  resolveCapabilities: refreshFromAnthropicAPI,  // 现有 modelCapabilities.ts 逻辑
}

// src/utils/model/presets/deepseek.ts
export const DEEPSEEK_PROVIDER: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  protocol: 'anthropic',
  baseUrl: 'https://api.deepseek.com',
  apiKeyEnvVar: 'DEEPSEEK_API_KEY',
  defaultModel: 'deepseek-chat',
  models: {
    'deepseek-chat':     { maxInputTokens: 64000, maxOutputTokens: 8192, supportsThinking: false, supportsAdaptiveThinking: false, supportsTools: true, supportsStreaming: true, supportsImages: false, supportsPDFs: false, supportsStructuredOutput: false, supportsEffort: false, supportedEffortLevels: [], supportsCaching: false, supportsBatch: false },
    'deepseek-reasoner': { maxInputTokens: 64000, maxOutputTokens: 8192, supportsThinking: true, supportsAdaptiveThinking: false, supportsTools: false, supportsStreaming: true, supportsImages: false, supportsPDFs: false, supportsStructuredOutput: false, supportsEffort: false, supportedEffortLevels: [], supportsCaching: false, supportsBatch: false },
  },
}

// src/utils/model/presets/qwen.ts
export const QWEN_PROVIDER: ProviderConfig = {
  id: 'qwen',
  name: 'Qwen',
  protocol: 'anthropic',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
  apiKeyEnvVar: 'QWEN_API_KEY',
  defaultModel: 'qwen-max',
  models: {
    'qwen-max':   { maxInputTokens: 32000, maxOutputTokens: 8192, supportsThinking: false, supportsAdaptiveThinking: false, supportsTools: true, supportsStreaming: true, supportsImages: true, supportsPDFs: false, supportsStructuredOutput: false, supportsEffort: false, supportedEffortLevels: [], supportsCaching: false, supportsBatch: false },
    'qwen-plus':  { maxInputTokens: 131072, maxOutputTokens: 8192, supportsThinking: false, supportsAdaptiveThinking: false, supportsTools: true, supportsStreaming: true, supportsImages: true, supportsPDFs: false, supportsStructuredOutput: false, supportsEffort: false, supportedEffortLevels: [], supportsCaching: false, supportsBatch: false },
  },
}
```

### 3.4 统一查询入口

```typescript
// src/utils/model/capabilities.ts

const registry = new Map<string, ProviderConfig>()
const DEFAULT_CAPABILITIES: ModelCapabilities = { /* 全 false/0 保底 */ }

export function registerProvider(config: ProviderConfig): void {
  registry.set(config.id, config)
}

// 通过 model 字符串自动匹配 provider
export function resolveProvider(model: string): ProviderConfig | null {
  // 1. 精确匹配：某个 provider 的 models 表有这个 key
  for (const provider of registry.values()) {
    if (model in provider.models) return provider
  }
  // 2. 前缀匹配：claude-* → anthropic, deepseek-* → deepseek
  for (const provider of registry.values()) {
    if (Object.keys(provider.models).some(k => model.startsWith(k.split('-')[0]))) return provider
  }
  // 3. 来自 config.json 的 custom provider
  return getConfiguredProvider()
}

export function getCapabilities(model: string): ModelCapabilities {
  const provider = resolveProvider(model)
  if (!provider) return DEFAULT_CAPABILITIES
  
  // 精确匹配
  const exact = provider.models[model]
  if (exact) return { ...DEFAULT_CAPABILITIES, ...exact }
  
  // 子串匹配（claude-sonnet-4-20250514 匹配 claude-sonnet-4）
  for (const [pattern, caps] of Object.entries(provider.models)) {
    if (model.includes(pattern) || pattern.includes(model)) {
      return { ...DEFAULT_CAPABILITIES, ...caps }
    }
  }
  
  return DEFAULT_CAPABILITIES
}

// 断言辅助
export function assertCapability(model: string, cap: keyof ModelCapabilities): void {
  const caps = getCapabilities(model)
  if (!caps[cap]) {
    throw new Error(`Model ${model} does not support ${cap}`)
  }
}
```

### 3.5 阶段 3 替换清单

Codex 需要把以下分散的判断函数替换为统一入口：

| 现有函数 | 文件 | 替换为 |
|---------|------|--------|
| `modelSupportsStructuredOutputs(model)` | `utils/betas.ts` | `getCapabilities(model).supportsStructuredOutput` |
| `modelSupportsEffort(model)` | `utils/effort.ts` | `getCapabilities(model).supportsEffort` |
| `modelSupportsThinking(model)` | `utils/thinking.ts` | `getCapabilities(model).supportsThinking` |
| `modelSupportsAdaptiveThinking(model)` | `utils/thinking.ts` | `getCapabilities(model).supportsAdaptiveThinking` |
| `getContextWindowForModel(model)` | `utils/model/modelCapabilities.ts` | `getCapabilities(model).maxInputTokens` |
| `getMaxOutputTokens(model)` | `utils/model/modelOptions.ts` | `getCapabilities(model).maxOutputTokens` |

**注意**：不要删除原函数，先做 wrapper 委托到新入口，保证逐步迁移不会一次性破坏全局。

```typescript
// 迁移示例：utils/thinking.ts
export function modelSupportsThinking(model: string): boolean {
  return getCapabilities(model).supportsThinking  // 委托到新入口
}
```

### 3.6 阶段 3 验证矩阵

```bash
# 1. Anthropic（现有行为不变）
ANTHROPIC_API_KEY=xxx claude-src -p "hi" --bare
# 应该正常工作，getCapabilities('claude-sonnet-4-*') 返回完整能力

# 2. 能力查询正确
# 在代码中 assert:
#   getCapabilities('claude-opus-4-20250514').supportsThinking === true
#   getCapabilities('deepseek-chat').supportsThinking === false
#   getCapabilities('unknown-model').supportsTools === false  (保底)

# 3. 回归
npm run build && claude-src --version && claude-src -p "你好" --bare
```

## 4. 阶段 4 详细设计：Provider Adapter

### 4.1 改造目标

把 `services/api/claude.ts` 从"直接调 Anthropic SDK"改成"通过 provider adapter 间接调"。

```
当前:  query.ts → claude.ts → @anthropic-ai/sdk → api.anthropic.com
目标:  query.ts → providerAdapter.ts → anthropicAdapter.ts → @anthropic-ai/sdk → any base URL
```

### 4.2 Adapter 接口

```typescript
// src/services/api/adapter.ts

export interface ProviderAdapter {
  createMessage(params: CreateMessageParams): Promise<MessageStream>
  getModels?(): Promise<string[]>
}

export interface CreateMessageParams {
  model: string
  messages: Message[]
  tools?: Tool[]
  maxTokens: number
  systemPrompt?: string
  thinkingConfig?: ThinkingConfig
  stream: boolean
}
```

### 4.3 Anthropic Adapter（第一版唯一实现）

```typescript
// src/services/api/adapters/anthropic.ts

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic
  
  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: resolveApiKey(config),
      baseURL: config.baseUrl,
    })
  }
  
  async createMessage(params: CreateMessageParams): Promise<MessageStream> {
    // 直接用 @anthropic-ai/sdk，因为所有 provider 都走 Anthropic 协议
    return this.client.messages.stream({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      // thinking 等参数按 capability 条件加
    })
  }
}
```

### 4.4 关键设计：为什么第一版 adapter 很薄

因为第一版所有 provider 都走 Anthropic 协议，adapter 层几乎是透传。**但它的价值在于**：
- 解耦了 `query.ts` 和 `@anthropic-ai/sdk` 的直接依赖
- 后续加 OpenAI 协议 adapter 只需新增一个实现
- Provider 的 base URL / API key 从 config.json 读取，不再硬编码

### 4.5 阶段 4 不要改的

- `Tool.ts` 接口 — 工具系统和模型无关
- `QueryEngine.ts` 的对话循环逻辑 — 只改它调 API 的那一行
- `types/message.ts` — 消息格式保持 Anthropic 格式（因为协议就是 Anthropic）

## 5. 阶段 5-6 概要

### 阶段 5：UI 层读取能力矩阵

- 模型不支持 thinking → 隐藏 thinking 选项
- 模型不支持 images → 隐藏图片附件入口
- 模型不支持 effort → 隐藏 effort 选项
- `--model` 参数校验：未知模型 warning，不支持的 cap 报错

### 阶段 6：品牌完成

- 命令名：`rdcc` 或 `ruidong`
- 配置目录：`~/.ruidong-code/`
- 项目配置：`.ruidong/` + `RUIDONG.md`（兼容读 `.claude/` + `CLAUDE.md`）
- 终端 Logo：RD block art

## 6. 文件变更地图

```
新增:
  src/utils/model/capabilities.ts        ← 统一 capability 入口
  src/utils/model/providerRegistry.ts    ← provider 注册表
  src/utils/model/presets/anthropic.ts   ← Anthropic 预设
  src/utils/model/presets/deepseek.ts    ← DeepSeek 预设
  src/utils/model/presets/qwen.ts        ← Qwen 预设
  src/services/api/adapter.ts            ← Provider adapter 接口
  src/services/api/adapters/anthropic.ts ← Anthropic adapter 实现

改造:
  src/utils/model/providers.ts           ← 扩展 APIProvider 类型
  src/utils/model/modelCapabilities.ts   ← 委托到 capabilities.ts
  src/utils/betas.ts                     ← wrapper 到 getCapabilities
  src/utils/effort.ts                    ← wrapper 到 getCapabilities
  src/utils/thinking.ts                  ← wrapper 到 getCapabilities
  src/services/api/claude.ts             ← 通过 adapter 间接调用
  src/utils/ruidongConfig.ts             ← 增加 provider 注册逻辑

不动:
  src/Tool.ts                            ← 工具系统和模型无关
  src/types/message.ts                   ← 消息格式 = Anthropic 协议
  src/ink/*                              ← TUI 框架不改
  src/commands/*                         ← 命令系统不改
```

## 7. 给 Codex 的执行建议

阶段 3 当前进度：准备建 `getModelCapabilities` 统一入口。

**下一步具体操作**：

1. 新建 `src/utils/model/capabilities.ts` 和 `providerRegistry.ts`
2. 新建 `src/utils/model/presets/anthropic.ts`（从现有 model.ts 提取）
3. 在 `main.tsx` 启动时调用 `registerProvider(ANTHROPIC_PROVIDER)`
4. 把 `modelSupportsThinking()` 和 `getContextWindowForModel()` 改成 wrapper
5. build + 回归验证
6. 再加 `presets/deepseek.ts`，用 DeepSeek 的 Anthropic 兼容 API 实测

**不要做**：
- 不要在阶段 3 改 `services/api/claude.ts`
- 不要新增 UI（模型选择器等）
- 不要写没有调用方的空接口
- 不要一次性替换所有调用点，逐个 wrapper 迁移
