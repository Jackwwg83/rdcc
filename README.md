# rdcc — Ruidong Code

An AI-powered coding assistant CLI that supports multiple model providers via the Anthropic Messages API protocol.

## Features

- **40+ built-in tools**: File operations, Bash execution, Grep/Glob search, web access, MCP integration, and more
- **Multi-model support**: Works with any model provider that supports the Anthropic Messages API
- **Interactive REPL**: Rich terminal UI with React/Ink
- **Non-interactive mode**: `rdcc -p "your prompt"` for scripting and pipes
- **MCP integration**: Connect to any Model Context Protocol server
- **Agent system**: Multi-agent coordination and delegation
- **Skills & plugins**: Extensible skill system with plugin marketplace support
- **Session management**: Persistent conversations with resume capability

## Quick Start

### Prerequisites

- Node.js >= 18
- An API key from any Anthropic-compatible model provider

### Install from source

```bash
git clone https://github.com/YOUR_USERNAME/rdcc.git
cd rdcc
npm install
npm run build
npm link
```

### Configure

Set your API credentials:

```bash
# For Anthropic
export ANTHROPIC_API_KEY=your-key-here

# For other Anthropic-compatible providers
export ANTHROPIC_BASE_URL=https://your-provider-api.com
export ANTHROPIC_API_KEY=your-key-here
```

### Use

```bash
# Interactive mode
rdcc

# Single prompt (non-interactive)
rdcc -p "explain this codebase"

# With specific model
rdcc -p "hello" --model claude-sonnet-4-20250514

# Minimal mode (faster startup)
rdcc -p "list files" --bare
```

## Supported Providers

Any provider that implements the [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) protocol:

| Provider | Base URL | Status |
|----------|----------|--------|
| Anthropic | `https://api.anthropic.com` (default) | Tested |
| AWS Bedrock | Via `CLAUDE_CODE_USE_BEDROCK=1` | Supported |
| Google Vertex | Via `CLAUDE_CODE_USE_VERTEX=1` | Supported |
| Other compatible providers | Set `ANTHROPIC_BASE_URL` | Should work |

## Project Structure

```
rdcc/
├── src/                    # TypeScript source (1900+ files)
│   ├── entrypoints/        # CLI entry point
│   ├── tools/              # 40+ tool implementations
│   ├── services/           # API client, MCP, analytics
│   ├── ink/                # Custom React terminal UI framework
│   ├── components/         # UI components
│   ├── commands/           # CLI commands
│   ├── coordinator/        # Multi-agent orchestration
│   └── ...
├── packages/               # Local packages
│   ├── color-diff-napi/    # Syntax-highlighted diff rendering
│   └── @ant/              # Internal module stubs
├── scripts/                # Build tooling
│   ├── build.mjs           # esbuild bundler
│   └── create-stub-packages.mjs
├── stubs/                  # Bun runtime stubs
└── dist/                   # Build output (not committed)
```

## Development

```bash
# Build
npm run build

# Run from source
node dist/cli.js --version
node dist/cli.js -p "hello"

# Link globally
npm link
rdcc --version
```

## How It Works

rdcc is built from the Claude Code CLI architecture with multi-model extensibility:

- **Protocol**: Anthropic Messages API (messages, tool_use, streaming)
- **Build**: esbuild bundles 1900+ TypeScript files into a single `dist/cli.js`
- **Runtime**: Node.js with React (Ink) for terminal UI
- **Tools**: Unified `Tool` interface — each tool defines `name`, `description`, `inputSchema`, `execute`
- **MCP**: Full Model Context Protocol client for external tool/resource integration

## License

MIT
