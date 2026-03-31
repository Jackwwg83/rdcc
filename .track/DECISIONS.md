# Decisions

### 2026-03-31 使用 esbuild 替代 Bun 构建
**结论**: 沿用项目已有的 esbuild 构建方案（build.mjs），不尝试安装 Bun
**背景**: 原版 Claude Code 使用 Bun 编译时 intrinsics（feature()、MACRO、bun:bundle），反编译项目已有 esbuild 替代方案
**否决方案**: 安装 Bun 运行时（原因：仍需要 Anthropic 内部的编译配置，不可行）
**影响**: 所有 feature() 调用替换为 false，108 个内部模块走 stub 路径
