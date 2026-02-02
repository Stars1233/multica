# Skills 系统

[English](./README.md) | [中文](./README.zh-CN.md)

Skills 通过 `SKILL.md` 定义文件扩展 Agent 的能力。

## 目录

- [SKILL.md 规范](#skillmd-规范)
- [Skill 调用](#skill-调用)
- [加载与优先级](#加载与优先级)
- [CLI 命令](#cli-命令)

---

## SKILL.md 规范

每个 skill 是一个包含 `SKILL.md` 文件的目录，文件包含 YAML frontmatter 和 Markdown 内容。

### 基本结构

```markdown
---
name: My Skill
version: 1.0.0
description: 这个 skill 的功能描述
metadata:
  emoji: "🔧"
  requires:
    bins: [git]
---

# 说明

注入到 agent 系统提示词中的详细说明...
```

### Frontmatter 字段

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `name` | string | 是 | 显示名称 |
| `version` | string | 否 | 版本号 |
| `description` | string | 否 | 简短描述 |
| `homepage` | string | 否 | 主页 URL |
| `metadata` | object | 否 | 见下文 |
| `config` | object | 否 | 见下文 |
| `install` | array | 否 | 见下文 |

### metadata.requires

定义资格要求：

```yaml
metadata:
  emoji: "📝"
  requires:
    bins: [git, node]        # 全部必须存在
    anyBins: [npm, pnpm]     # 至少一个必须存在
    env: [API_KEY]           # 全部必须设置
    platforms: [darwin, linux]  # 当前操作系统必须匹配
```

| 字段 | 描述 |
|------|------|
| `bins` | 必需的二进制文件（全部必须存在于 PATH 中） |
| `anyBins` | 备选二进制文件（至少一个必须存在） |
| `env` | 必需的环境变量 |
| `platforms` | 支持的平台：`darwin`、`linux`、`win32` |

### config

运行时配置选项：

```yaml
config:
  enabled: true
  requiresConfig: ["skills.myskill.apiKey"]
  options:
    timeout: 30000
```

### install

依赖安装规范：

```yaml
install:
  - kind: brew
    package: jq

  - kind: npm
    package: typescript
    global: true

  - kind: uv
    package: requests

  - kind: go
    package: github.com/example/tool@latest

  - kind: download
    url: https://example.com/tool.tar.gz
    archiveType: tar.gz
    stripComponents: 1
```

**支持的安装类型：**

| 类型 | 描述 | 关键字段 |
|------|------|----------|
| `brew` | Homebrew | `package`、`cask` |
| `npm` | npm/pnpm/yarn | `package`、`global` |
| `uv` | Python uv | `package` |
| `go` | Go install | `package` |
| `download` | 下载并解压 | `url`、`archiveType` |

**通用字段：** `id`、`label`、`platforms`、`when`

---

## Skill 调用

用户可以通过斜杠命令（`/skill-name`）调用 skills，AI 模型也可以自动调用。

### 用户调用

在交互式 CLI 中，输入 `/` 加上 skill 名称来调用：

```
You: /pdf analyze report.pdf
```

**Tab 补全**：输入 `/p` 然后按 Tab 键查看匹配的 skills，如 `/pdf`。

**列出可用 skills**：输入 `/help` 查看所有可用的 skill 命令。

### 调用控制

使用 frontmatter 字段控制 skill 的调用方式：

```yaml
---
name: My Skill
user-invocable: true           # 可通过 /command 调用（默认：true）
disable-model-invocation: false # 包含在 AI 提示词中（默认：false）
---
```

| 字段 | 默认值 | 描述 |
|------|--------|------|
| `user-invocable` | `true` | 在 CLI 中启用 `/command` 调用 |
| `disable-model-invocation` | `false` | 如果为 `true`，skill 对 AI 的系统提示词隐藏 |

**使用场景：**

- **仅用户 skill**（`disable-model-invocation: true`）：用户可通过 `/command` 调用，但 AI 不会自动使用
- **仅 AI skill**（`user-invocable: false`）：AI 可使用，但没有 `/command` 可用
- **禁用 skill**（两者都为 `false`）：对用户和 AI 都隐藏

### 命令分发

对于高级集成，skills 可以直接分发到工具：

```yaml
---
name: PDF Tool
command-dispatch: tool
command-tool: pdf-processor
command-arg-mode: raw
---
```

| 字段 | 描述 |
|------|------|
| `command-dispatch` | 设置为 `tool` 启用工具分发 |
| `command-tool` | 要调用的工具名称 |
| `command-arg-mode` | 参数传递方式（`raw` = 原样传递） |

### 命令名称规范化

Skill 名称会被规范化以用作命令：

- 转换为小写
- 特殊字符替换为下划线
- 截断至最多 32 个字符
- 重复名称添加数字后缀（如 `pdf_2`）

---

## 加载与优先级

Skills 从两个来源加载，优先级从低到高：

| 优先级 | 来源 | 路径 | 描述 |
|--------|------|------|------|
| 1 | managed | `~/.super-multica/skills/` | 全局 skills（CLI 安装 + 内置） |
| 2 | profile | `~/.super-multica/agent-profiles/<id>/skills/` | Profile 专属 skills |

高优先级来源会覆盖具有相同 ID 的 skills。

### 初始化

首次运行时，内置 skills 会自动复制到 managed 目录（`~/.super-multica/skills/`）。这使得用户可以编辑或删除它们。

### 添加 Profile 专属 Skills

Profile 专属 skills 不通过 CLI 安装，需要手动创建在 profile 的 skills 目录中：

```bash
# 创建 profile skills 目录
mkdir -p ~/.super-multica/agent-profiles/<profile-id>/skills/<skill-name>

# 创建 SKILL.md 文件
cat > ~/.super-multica/agent-profiles/<profile-id>/skills/<skill-name>/SKILL.md << 'EOF'
---
name: My Profile Skill
version: 1.0.0
description: 此 profile 专属的 skill
---

# 说明

你的 skill 说明内容...
EOF
```

Profile skills 会自动覆盖同 ID 的 managed skills，允许按 profile 自定义。

### 资格过滤

加载后，skills 会按以下条件过滤：

1. 平台检查（`platforms`）
2. 二进制文件检查（`bins`、`anyBins`）
3. 环境变量检查（`env`）
4. 配置检查（`requiresConfig`）
5. 启用检查（`config.enabled`）

只有通过所有检查的 skills 才会被标记为符合条件。

---

## CLI 命令

所有命令使用统一的 `multica` CLI（开发时使用 `pnpm multica`）。

### 列出 Skills

```bash
multica skills list           # 列出所有 skills
multica skills list -v        # 详细模式
multica skills status         # 汇总状态
multica skills status <id>    # 特定 skill 状态
```

### 从 GitHub 安装

**示例：从 [anthropics/skills](https://github.com/anthropics/skills) 安装**

仓库结构：
```
anthropics/skills/
├── skills/
│   ├── algorithmic-art/
│   │   └── SKILL.md
│   ├── brand-guidelines/
│   │   └── SKILL.md
│   ├── pdf/
│   │   └── SKILL.md
│   └── ... (共 16 个 skills)
```

安装整个仓库（所有 16 个 skills）：
```bash
multica skills add anthropics/skills
# 安装到：~/.super-multica/skills/skills/
# 所有 skills 可用：algorithmic-art、brand-guidelines、pdf 等
```

只安装单个 skill：
```bash
multica skills add anthropics/skills/skills/pdf
# 安装到：~/.super-multica/skills/pdf/
# 只安装 pdf skill
```

从特定分支或标签安装：
```bash
multica skills add anthropics/skills@main
```

使用完整 URL：
```bash
multica skills add https://github.com/anthropics/skills
multica skills add https://github.com/anthropics/skills/tree/main/skills/pdf
```

强制覆盖现有：
```bash
multica skills add anthropics/skills --force
```

**支持的格式：**

| 格式 | 示例 | 描述 |
|------|------|------|
| `owner/repo` | `anthropics/skills` | 克隆整个仓库 |
| `owner/repo/path` | `anthropics/skills/skills/pdf` | 单个目录（稀疏检出） |
| `owner/repo@ref` | `anthropics/skills@v1.0.0` | 特定分支或标签 |
| 完整 URL | `https://github.com/anthropics/skills` | GitHub URL |
| 完整 URL + 路径 | `https://github.com/.../tree/main/skills/pdf` | 带特定路径的 URL |

### 移除 Skills

```bash
multica skills remove <name>   # 移除已安装的 skill
multica skills remove          # 列出已安装的 skills
```

### 安装依赖

```bash
multica skills install <id>              # 安装 skill 依赖
multica skills install <id> <install-id> # 特定安装选项
```

---

## 状态诊断

`status` 命令提供详细的诊断信息，帮助了解 skills 为何符合或不符合条件。

### 汇总状态

```bash
multica skills status        # 显示按问题类型分组的汇总
multica skills status -v     # 详细模式带提示
```

输出显示：
- 总计/符合条件/不符合条件计数
- 按问题类型分组的不符合条件 skills（binary、env、platform 等）

### 详细 Skill 状态

```bash
multica skills status <skill-id>
```

输出包括：
- 基本 skill 信息（名称、版本、来源、路径）
- **资格状态**及详细诊断
- **要求检查表**显示哪些二进制文件/环境变量存在
- **安装选项**及可用性状态
- **快速操作**及可操作的提示

### 诊断类型

| 类型 | 描述 | 示例提示 |
|------|------|----------|
| `disabled` | Skill 在配置中禁用 | 通过 `skills.<id>.enabled: true` 启用 |
| `not_in_allowlist` | 内置 skill 不在允许列表中 | 添加到 `config.allowBundled` 数组 |
| `platform` | 平台不匹配 | "仅支持：darwin、linux" |
| `binary` | 缺少必需的二进制文件 | "brew install git" |
| `any_binary` | 未找到备选二进制文件 | "安装任一：npm、pnpm、yarn" |
| `env` | 缺少环境变量 | "export OPENAI_API_KEY=..." |
| `config` | 缺少配置值 | "设置配置路径：browser.enabled" |

---

## 异步序列化

Skills 系统使用异步序列化来防止并发操作损坏文件或导致竞态条件。

### 工作原理

具有相同键的操作按顺序执行：

```typescript
import { serialize, SerializeKeys } from "./skills/index.js";

// 这些将按顺序执行，而非并行
const p1 = serialize(SerializeKeys.skillAdd("my-skill"), () => addSkill(...));
const p2 = serialize(SerializeKeys.skillAdd("my-skill"), () => addSkill(...));

// 这个并行运行（不同的键）
const p3 = serialize(SerializeKeys.skillAdd("other-skill"), () => addSkill(...));
```

### 内置序列化

以下操作自动序列化：
- `addSkill()` - 按 skill 名称
- `removeSkill()` - 按 skill 名称
- `installSkill()` - 按 skill ID

### 工具函数

```typescript
import {
  isProcessing,   // 检查键是否正在处理
  getQueueLength, // 获取待处理操作数量
  getActiveKeys,  // 获取所有活动操作键
  waitForKey,     // 等待键操作完成
  waitForAll,     // 等待所有操作
} from "./skills/index.js";
```

---

## 故障排除

**Skill 未显示为符合条件？**

运行 `multica skills status <skill-id>` 查看详细诊断及可操作的提示。

**覆盖内置 skill？**

在 `~/.super-multica/skills/` 或配置文件 skills 目录中创建具有相同 ID 的 skill。

**热重载不工作？**

确保安装了 `chokidar`：`pnpm add chokidar`

**并发操作导致问题？**

所有 add/remove/install 操作都会自动序列化。如果你在构建自定义集成，请使用 `serialize()` 函数并使用适当的键。
