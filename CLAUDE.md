# Claude Code Source (v2.1.88) — Build & Study

> 反编译的 Claude Code CLI 源码，目标：构建运行 + 学习架构 + Go 重写参考

## Tool Type
- **类型**: CLI 工具（反编译源码研究）
- **Language**: TypeScript (TSX/React for terminal UI)
- **Runtime**: Node.js >= 18（原版为 Bun，本项目用 esbuild 替代构建）
- **Package Manager**: npm

## Project Structure
```
claude-code-source-code-main/
├── src/                    # 1884 个 TS/TSX 源文件（反编译）
│   ├── entrypoints/        # CLI 入口（cli.tsx → main.tsx）
│   ├── tools/              # 30+ Tool 实现（文件、Bash、Agent、MCP 等）
│   ├── services/           # API 客户端、MCP、OAuth、Analytics
│   ├── ink/                # 自定义 React 终端 UI 框架（Yoga 布局）
│   ├── commands/           # 50+ CLI 命令
│   ├── state/              # 全局状态管理（React Context + Zustand）
│   ├── coordinator/        # 多 Agent 编排
│   ├── query/              # Query 引擎（对话循环）
│   ├── server/             # HTTP/WebSocket 分离会话服务
│   └── ...
├── scripts/                # 构建脚本
│   ├── build.mjs           # esbuild 打包（迭代 stub + 5 轮重试）
│   ├── prepare-src.mjs     # 源码预处理（替换 bun:bundle/MACRO）
│   └── ...
├── stubs/                  # Bun 运行时 stub
├── vendor/                 # 原生模块源码（audio/image/url-handler）
├── docs/                   # 反编译分析报告（EN/ZH）
├── package.json            # 构建依赖（esbuild + typescript）
└── tsconfig.json           # TS 配置
```

## Known Limitations
- **108 个缺失模块**：feature() 门控的内部代码，已在编译时死代码消除，无法恢复
- **Bun 依赖**：原版使用 Bun 编译时 intrinsics（feature()、MACRO、bun:bundle），本项目用 esbuild + stub 替代
- **无测试**：反编译代码不含测试文件
- **外部依赖**：运行时需要 @anthropic-ai/sdk、react、zod 等 npm 包（未在 package.json 中声明）

## Commands
```bash
# 安装依赖
npm install

# 预处理源码（替换 bun:bundle → stub，替换 MACRO → 字面量）
npm run prepare-src

# 构建（预处理 + esbuild 打包 → dist/cli.js）
npm run build

# 运行
node dist/cli.js --version
node dist/cli.js -p "Hello"

# 类型检查（不输出文件）
npm run check
```

## Architecture Overview

### 数据流
```
CLI Entry (entrypoints/cli.tsx)
  → main.tsx (初始化: auth, telemetry, MCP, tools)
  → QueryEngine.ts (对话循环)
  → query.ts → Claude API (services/api/claude.ts)
  → Tool 执行 (permissions → Tool.ts → 具体工具)
  → State 更新 (AppState.tsx)
  → UI 渲染 (ink/ React 终端框架)
```

### 核心抽象
- **Tool 接口**: `{ name, description, inputSchema, execute, canUse? }` — 统一工具抽象
- **Permission 系统**: bypass / yolo / strict 三级权限模式
- **Feature Flag**: `feature('X')` 编译时门控 → 本项目全部替换为 `false`
- **MCP**: 动态发现 + 注册外部工具/资源

## AI Config

```yaml
auto_commit: true
auto_push: false
commit_format: "type(task-id): description"
update_progress: true
update_changelog: false          # 研究项目，不需要 changelog
update_devlog: on_session_end
update_tasks: true
update_test_plan: false          # 反编译项目无测试体系
update_user_journeys: false
update_decisions: on_decision
```

## Workflow Rules

- 每次完成一个 task 后：
  1. 在 `.track/TASKS.md` 中将对应 task 标记为 `[x]`
  2. 更新 `.track/PROGRESS.md`
  3. 自动 git commit，message 格式：`type(T-XX): 简短描述`
- 每次做出重要技术决策后，在 `.track/DECISIONS.md` 中记录
- 每个工作会话结束前：更新 `.track/devlogs/YYYY-MM-DD.md`

## Code Quality — 全局视角，拒绝堆叠

- **改动前先理解全局**：理解现有代码结构后再改
- **复用优先**：不重复造轮子
- **最小改动原则**：以让代码能构建运行为目标，不做过度重构

## Development Notes
- 创建日期: 2026-03-31
- Phase 1 目标：让 TS 代码 build + run
- Phase 2 目标（后续）：基于 Go 重写
