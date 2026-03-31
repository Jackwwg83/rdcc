# Tasks

## Phase: 让 TS 代码 Build + Run

### 基础设施
- [ ] T-01: git init + 首次 commit
- [ ] T-02: npm install 安装构建依赖
- [ ] T-03: 尝试首次 build，收集所有报错

### 构建修复
- [ ] T-04: 补全缺失的运行时依赖（package.json 中未声明的 npm 包）
- [ ] T-05: 修复 esbuild 打包错误（缺失模块 stub、import 路径等）
- [ ] T-06: 修复类型错误（如需要，以 build 通过为目标）

### 运行验证
- [ ] T-07: `node dist/cli.js --version` 输出版本号
- [ ] T-08: `node dist/cli.js -p "Hello"` 基本对话（需要 API key）
- [ ] T-09: 交互模式启动（REPL）

### 文档沉淀
- [ ] T-10: 记录所有 stub/patch 的决策理由
- [ ] T-11: 记录构建过程中发现的架构洞察
