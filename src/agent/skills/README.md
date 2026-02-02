# Skills System

[English](./README.md) | [中文](./README.zh-CN.md)

Skills extend agent capabilities through `SKILL.md` definition files.

## Table of Contents

- [SKILL.md Specification](#skillmd-specification)
- [Skill Invocation](#skill-invocation)
- [Loading & Precedence](#loading--precedence)
- [CLI Commands](#cli-commands)

---

## SKILL.md Specification

Each skill is a directory containing a `SKILL.md` file with YAML frontmatter + Markdown content.

### Basic Structure

```markdown
---
name: My Skill
version: 1.0.0
description: What this skill does
metadata:
  emoji: "🔧"
  requires:
    bins: [git]
---

# Instructions

Detailed instructions injected into the agent's system prompt...
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `version` | string | No | Version number |
| `description` | string | No | Short description |
| `homepage` | string | No | Homepage URL |
| `metadata` | object | No | See below |
| `config` | object | No | See below |
| `install` | array | No | See below |

### metadata.requires

Defines eligibility requirements:

```yaml
metadata:
  emoji: "📝"
  requires:
    bins: [git, node]        # All must exist
    anyBins: [npm, pnpm]     # At least one must exist
    env: [API_KEY]           # All must be set
    platforms: [darwin, linux]  # Current OS must match
```

| Field | Description |
|-------|-------------|
| `bins` | Required binaries (all must exist in PATH) |
| `anyBins` | Alternative binaries (at least one must exist) |
| `env` | Required environment variables |
| `platforms` | Supported platforms: `darwin`, `linux`, `win32` |

### config

Runtime configuration options:

```yaml
config:
  enabled: true
  requiresConfig: ["skills.myskill.apiKey"]
  options:
    timeout: 30000
```

### install

Dependency installation specifications:

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

**Supported install kinds:**

| Kind | Description | Key Fields |
|------|-------------|------------|
| `brew` | Homebrew | `package`, `cask` |
| `npm` | npm/pnpm/yarn | `package`, `global` |
| `uv` | Python uv | `package` |
| `go` | Go install | `package` |
| `download` | Download & extract | `url`, `archiveType` |

**Common fields:** `id`, `label`, `platforms`, `when`

---

## Skill Invocation

Skills can be invoked by users via slash commands (`/skill-name`) or automatically by the AI model.

### User Invocation

In the interactive CLI, type `/` followed by a skill name to invoke it:

```
You: /pdf analyze report.pdf
```

**Tab completion**: Type `/p` then press Tab to see matching skills like `/pdf`.

**List available skills**: Type `/help` to see all available skill commands.

### Invocation Control

Control how skills can be invoked using frontmatter fields:

```yaml
---
name: My Skill
user-invocable: true           # Can be invoked via /command (default: true)
disable-model-invocation: false # Include in AI prompt (default: false)
---
```

| Field | Default | Description |
|-------|---------|-------------|
| `user-invocable` | `true` | Enable `/command` invocation in CLI |
| `disable-model-invocation` | `false` | If `true`, skill is hidden from AI's system prompt |

**Use cases:**

- **User-only skill** (`disable-model-invocation: true`): User can invoke via `/command`, but AI won't use it automatically
- **AI-only skill** (`user-invocable: false`): AI can use it, but no `/command` available
- **Disabled skill** (both `false`): Hidden from both user and AI

### Command Dispatch

For advanced integrations, skills can dispatch directly to tools:

```yaml
---
name: PDF Tool
command-dispatch: tool
command-tool: pdf-processor
command-arg-mode: raw
---
```

| Field | Description |
|-------|-------------|
| `command-dispatch` | Set to `tool` to enable tool dispatch |
| `command-tool` | Name of the tool to invoke |
| `command-arg-mode` | How arguments are passed (`raw` = as-is) |

### Command Name Normalization

Skill names are normalized for command use:

- Converted to lowercase
- Special characters replaced with underscores
- Truncated to 32 characters max
- Duplicate names get numeric suffixes (e.g., `pdf_2`)

---

## Loading & Precedence

Skills load from two sources with precedence (lowest to highest):

| Priority | Source | Path | Description |
|----------|--------|------|-------------|
| 1 | managed | `~/.super-multica/skills/` | Global skills (CLI-installed + bundled) |
| 2 | profile | `~/.super-multica/agent-profiles/<id>/skills/` | Profile-specific skills |

Higher priority sources override skills with the same ID.

### Initialization

On first run, bundled skills are automatically copied to the managed directory (`~/.super-multica/skills/`). This makes them editable and allows users to customize or remove them.

### Adding Profile-Specific Skills

Profile-specific skills are not installed via CLI. Instead, manually create them in the profile's skills directory:

```bash
# Create profile skills directory
mkdir -p ~/.super-multica/agent-profiles/<profile-id>/skills/<skill-name>

# Create the SKILL.md file
cat > ~/.super-multica/agent-profiles/<profile-id>/skills/<skill-name>/SKILL.md << 'EOF'
---
name: My Profile Skill
version: 1.0.0
description: A skill specific to this profile
---

# Instructions

Your skill instructions here...
EOF
```

Profile skills automatically override managed skills with the same ID, allowing per-profile customization.

### Eligibility Filtering

After loading, skills are filtered by:

1. Platform check (`platforms`)
2. Binary check (`bins`, `anyBins`)
3. Environment check (`env`)
4. Config check (`requiresConfig`)
5. Enabled check (`config.enabled`)

Only skills passing all checks are marked as eligible.

---

## CLI Commands

All commands use the unified `multica` CLI (or `pnpm multica` during development).

### List Skills

```bash
multica skills list           # List all skills
multica skills list -v        # Verbose mode
multica skills status         # Summary status
multica skills status <id>    # Specific skill status
```

### Install from GitHub

**Example: Installing from [anthropics/skills](https://github.com/anthropics/skills)**

The repository structure:
```
anthropics/skills/
├── skills/
│   ├── algorithmic-art/
│   │   └── SKILL.md
│   ├── brand-guidelines/
│   │   └── SKILL.md
│   ├── pdf/
│   │   └── SKILL.md
│   └── ... (16 skills total)
```

Install the entire repository (all 16 skills):
```bash
multica skills add anthropics/skills
# Installs to: ~/.super-multica/skills/skills/
# All skills available: algorithmic-art, brand-guidelines, pdf, etc.
```

Install a single skill only:
```bash
multica skills add anthropics/skills/skills/pdf
# Installs to: ~/.super-multica/skills/pdf/
# Only the pdf skill is installed
```

Install from a specific branch or tag:
```bash
multica skills add anthropics/skills@main
```

Using full URL:
```bash
multica skills add https://github.com/anthropics/skills
multica skills add https://github.com/anthropics/skills/tree/main/skills/pdf
```

Force overwrite existing:
```bash
multica skills add anthropics/skills --force
```

**Supported formats:**

| Format | Example | Description |
|--------|---------|-------------|
| `owner/repo` | `anthropics/skills` | Clone entire repository |
| `owner/repo/path` | `anthropics/skills/skills/pdf` | Single directory (sparse checkout) |
| `owner/repo@ref` | `anthropics/skills@v1.0.0` | Specific branch or tag |
| Full URL | `https://github.com/anthropics/skills` | GitHub URL |
| Full URL + path | `https://github.com/.../tree/main/skills/pdf` | URL with specific path |

### Remove Skills

```bash
multica skills remove <name>   # Remove installed skill
multica skills remove          # List installed skills
```

### Install Dependencies

```bash
multica skills install <id>              # Install skill dependencies
multica skills install <id> <install-id> # Specific install option
```

---

## Status Diagnostics

The `status` command provides detailed diagnostics for understanding why skills are or aren't eligible.

### Summary Status

```bash
multica skills status        # Show summary with grouping by issue type
multica skills status -v     # Verbose mode with hints
```

Output shows:
- Total/eligible/ineligible counts
- Ineligible skills grouped by issue type (binary, env, platform, etc.)

### Detailed Skill Status

```bash
multica skills status <skill-id>
```

Output includes:
- Basic skill info (name, version, source, path)
- **Eligibility status** with detailed diagnostics
- **Requirements checklist** showing which binaries/env vars are present
- **Install options** with availability status
- **Quick actions** with actionable hints to resolve issues

### Diagnostic Types

| Type | Description | Example Hint |
|------|-------------|--------------|
| `disabled` | Skill disabled in config | Enable via `skills.<id>.enabled: true` |
| `not_in_allowlist` | Bundled skill not allowed | Add to `config.allowBundled` array |
| `platform` | Platform mismatch | "Only works on: darwin, linux" |
| `binary` | Missing required binary | "brew install git" |
| `any_binary` | No alternative binary found | "Install any of: npm, pnpm, yarn" |
| `env` | Missing environment variable | "export OPENAI_API_KEY=..." |
| `config` | Missing config value | "Set config path: browser.enabled" |

---

## Async Serialization

The skills system uses async serialization to prevent concurrent operations from corrupting files or causing race conditions.

### How It Works

Operations with the same key are executed sequentially:

```typescript
import { serialize, SerializeKeys } from "./skills/index.js";

// These will execute sequentially, not in parallel
const p1 = serialize(SerializeKeys.skillAdd("my-skill"), () => addSkill(...));
const p2 = serialize(SerializeKeys.skillAdd("my-skill"), () => addSkill(...));

// This runs in parallel (different key)
const p3 = serialize(SerializeKeys.skillAdd("other-skill"), () => addSkill(...));
```

### Built-in Serialization

The following operations are automatically serialized:
- `addSkill()` - by skill name
- `removeSkill()` - by skill name
- `installSkill()` - by skill ID

### Utility Functions

```typescript
import {
  isProcessing,   // Check if key is being processed
  getQueueLength, // Get pending operations count
  getActiveKeys,  // Get all active operation keys
  waitForKey,     // Wait for key operations to complete
  waitForAll,     // Wait for all operations
} from "./skills/index.js";
```

---

## Troubleshooting

**Skill not showing as eligible?**

Run `pnpm skills:cli status <skill-id>` to see detailed diagnostics with actionable hints.

**Override a bundled skill?**

Create a skill with the same ID in `~/.super-multica/skills/` or profile skills directory.

**Hot reload not working?**

Ensure `chokidar` is installed: `pnpm add chokidar`

**Concurrent operations causing issues?**

All add/remove/install operations are automatically serialized. If you're building custom integrations, use the `serialize()` function with appropriate keys.
