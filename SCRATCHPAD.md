# Scratchpad — Claude Code Source Build

## 当前状态
- 接手流程进行中：Step 2-3 完成（.track/ + CLAUDE.md）
- 下一步：Step 4-5 确认目标 → 进入开发流程

## 项目背景
- Claude Code v2.1.88 反编译源码，1884 个 TS/TSX 文件
- 108 个内部模块缺失（feature flag 死代码消除）
- 已有构建脚本（build.mjs）但未跑通
- 目标：build + run → 学习架构 → Go 重写

## 关键发现
- build.mjs 有 5 轮迭代 stub 机制
- 运行时依赖未在 package.json 声明（@anthropic-ai/sdk, react, zod 等）
- feature() 全部替换为 false，内部模块走 stub
