# Super Multica Product Capabilities

> This document is the single source of truth for all product capabilities. It describes **what exists** and **what value it provides to users**. All subsequent documents (user journeys, UI design, copywriting, design systems) should reference this document.

---

## 1. Product Definition

**Super Multica** is your personal AI Agent that runs entirely on your machine. It can read files, execute commands, search the web, and remember everything you tell it—all while keeping your data local and under your control.

> **Core narrative**: "A personal AI Agent running on your computer. Your data, your API keys, your control."

**Product Focus (Current Version)**:
- **Primary**: Personal use — one user, one agent, local-first
- **Secondary**: Remote access via phone/web (optional, for power users)

**Core architecture**:

```
Desktop App (standalone, primary)
  └─ Hub (embedded, manages agent)
     └─ Agent Engine (LLM execution, sessions, skills, tools)
        └─ (Optional) Gateway → remote access (web/mobile)
```

---

## 2. Core Value Propositions

> **Design Reference**: This section summarizes key value propositions for UI/UX design, copywriting, and user communication decisions. Use this as a quick reference when deciding what to emphasize in interfaces and messaging.

### 2.1 Primary Differentiators

These are the core values that distinguish Super Multica. Communicate them in order of priority.

**Tier 1 — Core Identity (Always communicate)**

| Value | User-Facing Message | Technical Basis |
|-------|---------------------|-----------------|
| **Personal AI Agent** | "Your own AI assistant, running on your machine" | Desktop-first, embedded Hub, single-user focus |
| **Capable** | "Read files, run commands, search the web, remember things" | 12 built-in tools across file/runtime/web/memory |
| **Local-First** | "Your data never leaves your computer" | All data stored in `~/.super-multica/`, no cloud dependency |

**Tier 2 — Trust & Control (Reinforce throughout)**

| Value | User-Facing Message | Technical Basis |
|-------|---------------------|-----------------|
| **Your Keys, Your Control** | "Use your own API keys, switch models anytime" | 10 LLM providers, user-owned credentials |
| **Safe Execution** | "Every command requires your approval" | 4-layer security assessment + approval protocol |
| **Persistent Memory** | "Your agent remembers what you tell it" | Profile system + Memory tools |

**Tier 3 — Power Features (Available, not prominent)**

| Value | User-Facing Message | Technical Basis |
|-------|---------------------|-----------------|
| **Extensible Skills** | "Teach your agent new abilities" | Modular skill system with hot-reload |
| **Remote Access** | "Access from phone or web when needed" | Gateway + Device pairing (optional) |

### 2.2 Trust-Building Points

These messages should be reinforced throughout the user journey, especially during onboarding and when requesting sensitive permissions.

| Context | What User Worries About | How We Address It |
|---------|------------------------|-------------------|
| First launch | "Will this access my files?" | Explicit permission acknowledgment with clear scope |
| API key entry | "Where is my key stored?" | "Stored locally in `~/.super-multica/credentials.json5`. Never sent to our servers." |
| Command execution | "What if it runs something dangerous?" | 4-layer safety check + mandatory user approval + allow-once/allow-always options |
| Memory storage | "What does it remember about me?" | User-controlled, file-based, inspectable at `~/.super-multica/agent-profiles/` |
| Remote access | "Who can access my agent?" | Device whitelist with explicit approval, one-time tokens, 30s expiry |

### 2.3 Feature Priority Matrix

Use this when designing interfaces to determine information hierarchy and feature prominence.

| Priority | Features | Where to Expose | Design Guidance |
|----------|----------|-----------------|-----------------|
| **P0 - Always Visible** | Chat, Agent status (running/idle), Approval dialogs | Main UI, always accessible | Cannot be hidden or collapsed |
| **P1 - Dashboard** | Current provider/model, Available tools, Session info | Home/Dashboard, 1 click away | Show what agent can do |
| **P2 - Configuration** | Provider selection, Profile/Skills management, Tool policy | Settings or sidebar sections | Available but not prominent |
| **P3 - Power Features** | Remote access (QR/Gateway), Device management, Memory inspection | Settings → Advanced | Hidden from casual users |
| **P4 - Developer** | CLI commands, Session JSONL format, Gateway config | Documentation only | Not exposed in UI |

**Key Change**: QR code and remote access moved from P0 to P3. Dashboard (agent capabilities) moved up to P1.

### 2.4 Messaging Tone Guidelines

| Situation | Tone | Example |
|-----------|------|---------|
| Explaining privacy | Reassuring, factual | "All data stays on your machine. We can't access it even if we wanted to." |
| Requesting permission | Clear, non-alarming | "Multica needs to read files to help you. You control which files." |
| Command approval | Cautious but not scary | "Review this command before running." (not "DANGER: This could harm your system!") |
| Error states | Helpful, actionable | "API key invalid. Check your key in Settings → Providers." |
| Success states | Brief, confident | "Connected." (not "Successfully connected to the server!") |

---

## 3. User Model

**Current Version**: Single-user, personal agent.

| Role | Definition | Platform |
|------|-----------|----------|
| **You** | The person running the Desktop app | Desktop (Electron) |

You own your agent. You control what it can do, which LLM it uses, and what it remembers.

**Future Consideration**: Remote access allows you to chat with your agent from other devices (phone, web). This is an optional power feature, not the primary use case.

**User-Facing Value**: "Your personal AI agent. Runs on your machine, works for you."

---

## 4. Functional Modules

### 4.1 Agent Engine

> **User-Facing Value**: "Your personal AI that lives on your computer. It can read your files, run commands, search the web, and remember everything you tell it."

The core execution unit. Your Agent receives messages, calls an LLM, executes tools, and returns responses.

#### 4.1.1 Agent Lifecycle

| State | Description |
|-------|-------------|
| Created | AsyncAgent instantiated, assigned UUIDv7 session ID |
| Idle | Awaiting `write()` call (user message) |
| Running | Processing message: LLM call → tool execution → response |
| Closed | Agent terminated, no further messages accepted |

Each `write()` call is queued. Messages are processed sequentially (one at a time).

#### 4.1.2 Agent Execution Loop

1. Receive user message via `write(content)`
2. Resolve API credentials (with auth profile rotation)
3. Build/update system prompt from profile
4. Call LLM provider with message history
5. If LLM requests tool calls → execute tools → feed results back to LLM → repeat
6. Save all messages to session storage
7. Check context window utilization → compact if needed
8. Emit events to subscribers (streaming to UI)

#### 4.1.3 Auth Profile Rotation

When an API call fails, the system classifies the error and may rotate to a different API key:

| Error Type | Examples | Rotates? |
|-----------|----------|----------|
| `auth` | 401, 403, invalid key | Yes |
| `rate_limit` | 429, rate limit exceeded | Yes |
| `billing` | Out of credits, quota exceeded | Yes |
| `timeout` | Connection timeout | Yes |
| `format` | 400, malformed request | No |
| `unknown` | Other errors | No |

Failed profiles enter cooldown. Rotation continues until success or all profiles exhausted.

Tracking file: `~/.super-multica/.auth-profiles/usage-stats.json`

#### 4.1.4 Subagent Spawning

Agents can spawn child agents via the `sessions_spawn` tool:

- Subagents get isolated sessions
- Tool restrictions: `sessions_spawn` denied (no nested spawning)
- System prompt mode: `minimal` or `none`
- Parameters: task (required), label, model override, cleanup policy (`delete` or `keep`), timeout
- Results announced back to parent automatically

#### 4.1.5 Agent Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `profileId` | string | none | Agent profile to load |
| `provider` | string | `kimi-coding` | LLM provider |
| `model` | string | provider default | Model within provider |
| `reasoningMode` | `off` / `on` / `stream` | `off` | Display thinking/reasoning |
| `compactionMode` | `count` / `tokens` / `summary` | `tokens` | Context compaction strategy |
| `contextWindowTokens` | number | 200,000 | Override model's context window |
| `enableSkills` | boolean | `true` | Enable skills system |

---

### 4.2 LLM Providers

> **User-Facing Value**: "Use your own API keys. Switch between Claude, GPT, Gemini, and more. Your keys, your choice."

Ten providers supported. Two auth methods: OAuth (CLI login) and API Key.

| ID | Display Name | Auth | Default Model | Available Models |
|----|-------------|------|---------------|------------------|
| `claude-code` | Claude Code | OAuth | claude-opus-4-5 | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| `openai-codex` | Codex | OAuth | gpt-5.2 | gpt-5.2, gpt-5.2-codex, gpt-5.1-codex, gpt-5.1-codex-mini, gpt-5.1-codex-max |
| `anthropic` | Anthropic | API Key | claude-sonnet-4-5 | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| `openai` | OpenAI | API Key | gpt-4o | gpt-4o, gpt-4o-mini, o1, o1-mini |
| `kimi-coding` | Kimi Code | API Key | kimi-k2-thinking | kimi-k2-thinking, k2p5 |
| `google` | Google AI | API Key | gemini-2.0-flash | gemini-2.0-flash, gemini-1.5-pro |
| `groq` | Groq | API Key | llama-3.3-70b-versatile | llama-3.3-70b-versatile, mixtral-8x7b-32768 |
| `mistral` | Mistral | API Key | mistral-large-latest | mistral-large-latest, codestral-latest |
| `xai` | xAI (Grok) | API Key | grok-beta | grok-beta, grok-vision-beta |
| `openrouter` | OpenRouter | API Key | anthropic/claude-3.5-sonnet | anthropic/claude-3.5-sonnet, openai/gpt-4o |

**Default provider fallback**: config > credentials.json5 > `kimi-coding`

**OAuth providers** require external CLI login (`claude login` / `codex login`).

**API Key providers** are configured in `~/.super-multica/credentials.json5`.

**Multiple API keys per provider** are supported via auth profiles (e.g., `openai`, `openai:backup`). The system rotates between them on failure.

---

### 4.3 Tools

> **User-Facing Value**: "Your agent can read files, write code, run commands, search the web, and remember things for you."

Tools are capabilities the Agent can invoke during execution.

#### 4.3.1 Built-in Tools

| Tool | Category | Description |
|------|----------|-------------|
| `read` | File | Read file contents (with optional offset/limit) |
| `write` | File | Create or overwrite files |
| `edit` | File | Make precise edits to existing files |
| `glob` | File | Find files by pattern (default limit: 100, max: 1000) |
| `exec` | Runtime | Run shell commands (auto-backgrounds after 10s) |
| `process` | Runtime | Manage background processes (start, stop, list, output) |
| `web_search` | Web | Search the web (Brave or Perplexity provider) |
| `web_fetch` | Web | Fetch and extract URL content (markdown/text, max 50k chars, 15min cache) |
| `memory_get` | Memory | Read from agent's persistent memory |
| `memory_set` | Memory | Write to agent's persistent memory (max 1MB per value) |
| `memory_list` | Memory | List memory entries (default limit: 100, max: 1000) |
| `memory_delete` | Memory | Delete memory entries |
| `sessions_spawn` | Subagent | Spawn a child agent for a specific task |

#### 4.3.2 Tool Groups (shortcuts for policy)

| Group | Tools Included |
|-------|---------------|
| `group:fs` | read, write, edit, glob |
| `group:runtime` | exec, process |
| `group:web` | web_search, web_fetch |
| `group:memory` | memory_get, memory_set, memory_delete, memory_list |
| `group:subagent` | sessions_spawn |
| `group:core` | read, write, edit, glob, exec, process, web_search, web_fetch |

#### 4.3.3 Tool Policy System (3 layers)

| Layer | Scope | Description |
|-------|-------|-------------|
| 1. Global | All agents | `allow` / `deny` lists (wildcard supported: `mem*`, `*`) |
| 2. Provider | Per LLM provider | Narrower restrictions per provider (e.g., deny `exec` for Google) |
| 3. Subagent | Child agents only | `sessions_spawn` denied by default |

**Priority**: Deny always overrides Allow. Empty allow list = deny all.

#### 4.3.4 Exec Tool Details

- Default yield timeout: 10,000ms (auto-backgrounds if not complete)
- Supports `timeoutMs` for hard kill (SIGTERM)
- Output includes: stdout+stderr, exitCode, truncation flag, process ID if backgrounded

#### 4.3.5 Exec Approval Protocol

> **User-Facing Value**: "Every shell command requires your explicit approval. You're always in control."

The exec tool implements a 4-layer security assessment before any command execution:

| Layer | Check | Examples | Result if Failed |
|-------|-------|----------|------------------|
| 1. Whitelist | Glob pattern match against allowed commands | `git *`, `npm install` | Skip to next layer |
| 2. Shell Syntax | Dangerous shell constructs detection | `$(...)`, backticks, pipes to dangerous commands | `dangerous` |
| 3. Safe Binaries | ~40 known-safe read-only commands | `ls`, `cat`, `grep`, `git status` | `safe` if matched |
| 4. Danger Patterns | 25+ regex patterns for risky operations | `rm -rf`, `chmod 777`, `curl | sh` | `dangerous` if matched |

**Risk Levels**:

| Level | Meaning | User Action Required |
|-------|---------|---------------------|
| `safe` | Read-only or whitelisted command | Auto-approved (configurable) |
| `needs-review` | Unknown command, not obviously dangerous | User must approve |
| `dangerous` | Matches danger pattern or shell injection risk | User must approve with warning |

**User Approval Options**:

| Option | Effect | Persistence |
|--------|--------|-------------|
| Allow Once | Execute this command only | This execution only |
| Allow Always | Add to session whitelist | Until session ends |
| Deny | Block execution | This execution only |

**Approval Flow**:

```
Agent requests exec("npm install express")
    ↓
4-layer security check → "needs-review"
    ↓
Desktop shows approval dialog:
  "The agent wants to run: npm install express"
  [Allow Once] [Allow Always] [Deny]
    ↓
User clicks "Allow Once"
    ↓
Command executes, result returned to agent
```

**Design Guidance**: This is a core trust-building feature. The approval dialog should be:
- Clear and non-alarming for safe commands
- Appropriately cautious for dangerous commands
- Never auto-dismissed or timed out (user must act)

#### 4.3.6 Web Search Details

- Brave provider: up to 10 results, country filtering, freshness filters (`pd`/`pw`/`pm`/`py`)
- Perplexity provider: AI-synthesized answers
- Default count: 5 results, 1 hour cache

---

### 4.4 Profile System

> **User-Facing Value**: "Give your agent a personality. Define how it talks, what it knows, and how it works."

A Profile defines an Agent's identity, personality, knowledge, and configuration.

#### 4.4.1 Profile File Structure

```
~/.super-multica/agent-profiles/{profileId}/
├── soul.md           # Identity: name, role, personality, behavior boundaries
├── user.md           # User information: name, preferences, context
├── workspace.md      # Workspace conventions, coding standards, project rules
├── memory.md         # Long-term knowledge base (read by agent at startup)
├── config.json       # Optional: provider, model, thinking level, tool policy
├── memory/           # Key-value persistent memory storage
│   ├── key1.json
│   └── key2.json
└── skills/           # Profile-specific skills (override global)
    └── {skill-name}/
        └── SKILL.md
```

#### 4.4.2 Profile Config (config.json)

```json
{
  "name": "Jarvis",
  "style": "concise and direct",
  "provider": "anthropic",
  "model": "claude-sonnet-4-5",
  "thinkingLevel": "medium",
  "tools": {
    "allow": ["group:fs", "web_fetch"],
    "deny": ["exec"]
  }
}
```

#### 4.4.3 Profile Operations

| Operation | CLI | Desktop |
|-----------|-----|---------|
| List profiles | `multica profile list` | Via Hub info |
| Create profile | `multica profile new <id>` | - |
| Interactive setup | `multica profile setup <id>` | - |
| View profile | `multica profile show <id>` | - |
| Edit in file manager | `multica profile edit <id>` | - |
| Delete profile | `multica profile delete <id>` | - |

**Profile ID rules**: alphanumeric, hyphens, underscores only.

#### 4.4.4 System Prompt Composition

The system prompt is built dynamically from profile files:

| Section | Source | Mode: full | Mode: minimal | Mode: none |
|---------|--------|-----------|--------------|-----------|
| Identity | soul.md + config | Yes | Partial | Single line |
| User | user.md | On-demand | No | No |
| Workspace | workspace.md | Yes | No | No |
| Memory | memory.md | On-demand | No | No |
| Safety | Built-in constitution | Yes | Yes | Yes |
| Tools | Active tool list | Yes | Core only | No |
| Skills | Skill instructions | Yes | No | No |
| Runtime | OS, model, hostname | Yes | Essential | No |
| Subagent | Task context | If applicable | Yes | Yes |

**Progressive disclosure**: soul.md, user.md, memory.md are loaded on-demand (not injected in full at startup) to save tokens.

---

### 4.5 Memory System

> **User-Facing Value**: "Your agent remembers what you tell it. Preferences, facts, context—it's all there next time."

Agents can persistently store and recall information across sessions.

#### 4.5.1 Storage

- Location: `~/.super-multica/agent-profiles/{profileId}/memory/`
- Format: One JSON file per key
- Key rules: alphanumeric, underscore, dot, hyphen. Max 128 chars.
- Dots in keys are escaped as `__DOT__` in filenames
- Max value size: 1MB

#### 4.5.2 Entry Format

```json
{
  "value": "any JSON value",
  "description": "optional human-readable description",
  "createdAt": 1717689600000,
  "updatedAt": 1717689600000
}
```

#### 4.5.3 Memory Tools

| Tool | Input | Output |
|------|-------|--------|
| `memory_get` | `{ key }` | `{ found, value?, description?, updatedAt? }` |
| `memory_set` | `{ key, value, description? }` | `{ success, error? }` |
| `memory_delete` | `{ key }` | `{ success, existed, error? }` |
| `memory_list` | `{ prefix?, limit? }` | `{ keys[], total, truncated }` |

**Design principle**: Agents cannot "remember" mentally. All persistence must be file-based ("TEXT > BRAIN").

---

### 4.6 Skills System

> **User-Facing Value**: "Teach your agent new tricks. Install skills for Git, code review, and more."

Skills are modular, self-contained capabilities defined via `SKILL.md` files. They extend what an Agent can do.

#### 4.6.1 Skill File Format (SKILL.md)

```yaml
---
name: Skill Name
description: What this skill does
version: 1.0.0
metadata:
  emoji: "📝"
  os: [darwin, linux]           # Platform restriction (optional)
  always: false                 # Skip eligibility checks (optional)
  tags: [productivity, coding]
  requires:
    bins: [node, npm]           # ALL must exist in PATH
    anyBins: [python3, python]  # At least ONE must exist
    env: [OPENAI_API_KEY]       # ALL must be set
    config: [custom.setting]    # Config paths must be truthy
---
# Full markdown instructions follow...
```

#### 4.6.2 Skill Sources & Precedence

| Source | Location | Precedence |
|--------|----------|-----------|
| Bundled | `skills/` in project | Lowest |
| Global (user-installed) | `~/.super-multica/skills/` | Medium |
| Profile-specific | `~/.super-multica/agent-profiles/{id}/skills/` | Highest (overrides) |

Profile skills with the same ID completely replace global/bundled versions.

#### 4.6.3 Bundled Skills

| Skill | ID | Description | Requirements |
|-------|----|-------------|-------------|
| Git Commit Helper | `commit` | Create well-formatted conventional commits | `git` binary |
| Code Review | `code-review` | Structured code review with security focus | None |
| Profile Setup | `profile-setup` | Interactive wizard to personalize agent profile | None |
| Skill Creator | `skill-creator` | Create, edit, manage custom skills | None (always eligible) |

#### 4.6.4 Eligibility Check Sequence

1. Explicit disable in config → ineligible
2. Bundled + not in allowlist → ineligible
3. Platform mismatch (OS) → ineligible
4. `always: true` flag → eligible (skip remaining)
5. Missing required binary → ineligible
6. No alternative binary found → ineligible
7. Missing env var → ineligible
8. Missing config path → ineligible
9. All checks pass → eligible

Returns human-readable failure reasons (e.g., "Required binary not found: git").

#### 4.6.5 Skill Invocation

- **User invocation**: `/skillname args` in interactive CLI
- **Model invocation**: Agent reads skill instructions from system prompt and follows them
- **Hot reload**: File watcher detects SKILL.md changes, reloads automatically (250ms debounce)

#### 4.6.6 Skill Installation

```bash
multica skills add owner/repo              # Clone entire repository
multica skills add owner/repo/skill-name   # Clone single skill
multica skills add owner/repo@branch       # Specific branch/tag
multica skills add owner/repo -p my-agent  # Install to profile
```

---

### 4.7 Session Management

> **User-Facing Value**: "Pick up where you left off. Your conversation history is always saved."

Sessions persist conversation history across interactions.

#### 4.7.1 Session Storage

- Location: `~/.super-multica/sessions/{sessionId}/session.jsonl`
- Format: JSON Lines (one JSON object per line)
- Session IDs: UUIDv7 (time-ordered)
- Each line is either a message entry, meta entry, or compaction entry

#### 4.7.2 Message Format

Messages follow the LLM API format:

```json
{"type": "message", "role": "user", "content": [{"type": "text", "text": "Hello"}]}
{"type": "message", "role": "assistant", "content": [{"type": "text", "text": "Hi!"}, {"type": "tool_use", "id": "...", "name": "read", "input": {"path": "/foo"}}]}
{"type": "message", "role": "user", "content": [{"type": "tool_result", "tool_use_id": "...", "content": "file contents"}]}
```

#### 4.7.3 Session Metadata

```json
{"type": "meta", "provider": "anthropic", "model": "claude-sonnet-4-5", "reasoningMode": "off", "contextWindowTokens": 200000}
```

#### 4.7.4 Context Window Management

| Parameter | Value | Description |
|-----------|-------|-------------|
| Hard minimum | 16,000 tokens | Block execution below this |
| Warning threshold | 32,000 tokens | Warn if context window smaller |
| Default context | 200,000 tokens | Fallback if model unknown |
| Safety margin | 20% | Buffer for estimation inaccuracy |
| Compaction trigger | 80% utilization | Start compacting |
| Compaction target | 50% utilization | Target after compaction |
| Min keep messages | 10 | Never remove below this |
| Reserve tokens | 1,024 | Reserved for response generation |

#### 4.7.5 Compaction Modes

| Mode | Strategy | Speed | Quality |
|------|----------|-------|---------|
| `tokens` (default) | Remove oldest messages until reaching 50% target | Fast | Good (preserves recent context) |
| `count` | Remove oldest when count > 80, keep last 60 | Fastest | Adequate |
| `summary` | LLM generates incremental summary of removed messages | Slow (API call) | Best (preserves meaning) |

#### 4.7.6 Session Operations

| Operation | CLI Command |
|-----------|-------------|
| List sessions | `multica session list` |
| View session | `multica session show <id>` (supports partial ID) |
| Delete session | `multica session delete <id>` |
| Resume session | `multica --session <id> "continue..."` |

---

### 4.8 Hub

The Hub manages your agent. It runs embedded in the Desktop app—you don't need to think about it.

#### 4.8.1 Responsibilities

- Create, list, restore, close agents
- Persist agent metadata to disk (`~/.super-multica/agents/agents.json`)
- Route messages between local IPC and remote Gateway
- Handle device verification and whitelisting
- Process RPC requests from connected clients

#### 4.8.2 Hub RPC Methods

| Method | Description | Error Codes |
|--------|-------------|-------------|
| `verify` | Verify device with token | UNAUTHORIZED, REJECTED |
| `getAgentMessages` | Fetch message history (default: 50, offset: 0) | INVALID_PARAMS, AGENT_NOT_FOUND |
| `getHubInfo` | Get Hub ID and status | - |
| `listAgents` | List all agents | - |
| `createAgent` | Create new agent | - |
| `deleteAgent` | Delete agent | - |
| `updateGateway` | Update Gateway connection | - |

#### 4.8.3 Hub Singleton

One Hub per ecosystem. In Desktop mode, it's embedded in the Electron main process. It generates a persistent Hub ID stored at `~/.super-multica/hub-id`.

---

### 4.9 Gateway

NestJS WebSocket server that enables remote client access to your agent.

**Note**: Optional component. Most users don't need this for personal use.

#### 4.9.1 Purpose

Bridges remote clients (web/mobile) to your agent. **Not needed for local Desktop use** — the primary use case.

#### 4.9.2 Connection Protocol

- Transport: Socket.io
- Path: `/ws`
- Port: 3000 (default)

#### 4.9.3 Timeouts

| Parameter | Value |
|-----------|-------|
| Ping interval | 25 seconds |
| Ping timeout | 20 seconds |
| RPC default timeout | 10 seconds |
| Verify timeout | 30 seconds |
| Reconnect delay | 1 second |

#### 4.9.4 Message Routing

- Each message has `from` (sender device ID) and `to` (target device ID)
- Gateway validates: sender is registered, `from` matches socket, target exists
- Supports streaming via `StreamAction` (message_start, message_update, message_end, tool events)

#### 4.9.5 Error Codes

| Code | Meaning |
|------|---------|
| NOT_REGISTERED | Sender not registered |
| INVALID_MESSAGE | `from` field mismatch |
| DEVICE_NOT_FOUND | Target device not online |

---

### 4.10 Device Pairing & Verification

> **User-Facing Value**: "Access your agent from your phone when you need it."

**Note**: This is a power feature for users who want remote access. Not part of core onboarding or primary UI.

How remote devices (web/mobile) connect to your agent.

#### 4.10.1 QR Code Generation (Desktop)

The Desktop app generates a QR code containing:

```json
{
  "type": "multica-connect",
  "gateway": "http://localhost:3000",
  "hubId": "uuid",
  "agentId": "uuid",
  "token": "random-uuid",
  "expires": 1694000000000
}
```

- Token: one-time use, random UUID
- Expiry: 30 seconds from generation
- Auto-refresh: new token generated when expired
- Also available as URL: `multica://connect?gateway=...&hub=...&agent=...&token=...&exp=...`

#### 4.10.2 Connection Code Formats (accepted by client)

| Format | Example |
|--------|---------|
| JSON | `{"type":"multica-connect","gateway":"..."}` |
| Base64 JSON | Base64-encoded JSON string |
| URL | `multica://connect?gateway=...&hub=...&agent=...&token=...&exp=...` |

#### 4.10.3 Verification Flow

```
1. Mobile scans QR / pastes code
2. Client parses code, validates expiry
3. Client connects to Gateway via Socket.io
4. Gateway sends "registered" event
5. Client auto-sends "verify" RPC with token + device metadata
6. Hub validates token (one-time, checks expiry)
7. Hub triggers confirmation dialog on Desktop
   - Shows: device name (parsed from User-Agent), device ID
   - Options: "Allow" or "Reject"
   - Timeout: 60 seconds (auto-reject)
8. If allowed: device added to whitelist, persisted to disk
9. If rejected: connection closed
```

#### 4.10.4 Device Whitelist

- Location: `~/.super-multica/client-devices/whitelist.json`
- Format:

```json
{
  "version": 1,
  "devices": [{
    "deviceId": "uuid",
    "agentId": "uuid",
    "addedAt": 1694000000000,
    "meta": {
      "userAgent": "Mozilla/5.0...",
      "platform": "Linux",
      "language": "en-US"
    }
  }]
}
```

#### 4.10.5 Reconnection (whitelisted device)

Whitelisted devices reconnect without needing a new token or user confirmation. Hub checks `isAllowed(deviceId)` and returns immediately.

#### 4.10.6 Device Management (Desktop)

- View verified devices list with metadata
- Revoke individual devices (remove from whitelist)
- No fine-grained permissions (all-or-nothing access)

#### 4.10.7 Security Model

| Aspect | Detail |
|--------|--------|
| Token lifetime | 30 seconds |
| Token usage | One-time (deleted after consumption) |
| Token storage | In-memory only (lost on Hub restart) |
| Device ID | Browser: UUID in localStorage. Persistent until cleared. |
| Whitelist | Persisted to disk. Survives restarts. |
| Authorization | All verified devices have equal access |
| Message auth | Hub checks whitelist on every non-verify message |

---

### 4.11 Credentials System

#### 4.11.1 Files

| File | Purpose | Permissions |
|------|---------|-------------|
| `~/.super-multica/credentials.json5` | LLM providers + tool API keys | 0o600 |
| `~/.super-multica/skills.env.json5` | Skill/plugin environment variables | 0o600 |

Format: JSON5 (supports comments, trailing commas, unquoted keys).

#### 4.11.2 credentials.json5 Structure

```json5
{
  version: 1,
  llm: {
    provider: "openai",           // Default provider
    providers: {
      openai: { apiKey: "sk-...", model: "gpt-4o" },
      anthropic: { apiKey: "sk-ant-...", model: "claude-sonnet-4-5" },
      "openai:backup": { apiKey: "sk-..." },  // Auth profile for rotation
    },
    order: {
      openai: ["openai", "openai:backup"],  // Rotation order
    },
  },
  tools: {
    brave: { apiKey: "brv-..." },
    perplexity: { apiKey: "pplx-...", model: "perplexity/sonar-pro" },
  },
}
```

#### 4.11.3 skills.env.json5 Structure

```json5
{
  env: {
    LINEAR_API_KEY: "lin-...",
    GITHUB_TOKEN: "ghp_...",
  },
}
```

#### 4.11.4 Environment Variable Overrides

| Variable | Purpose |
|----------|---------|
| `SMC_CREDENTIALS_PATH` | Override credentials.json5 path |
| `SMC_SKILLS_ENV_PATH` | Override skills.env.json5 path |
| `SMC_CREDENTIALS_DISABLE=1` | Disable credentials loading |

---

### 4.12 Channel Integration

> **User-Facing Value**: "Chat with your agent from Telegram when you're away from your desk."

**Note**: Power feature for users who want additional access methods. Not part of core experience.

Channels enable external messaging platforms to communicate with the Agent. Currently supported: Telegram.

#### 4.12.1 Architecture

```
External Platform (Telegram)
    ↓
Channel Adapter (grammy library)
    ↓
Channel Manager (message routing)
    ↓
Hub → Agent Engine
    ↓
Response routed back via lastRoute
```

#### 4.12.2 Telegram Channel

| Feature | Description |
|---------|-------------|
| **Connection Mode** | Long polling (default) or Webhook |
| **Bot Setup** | User creates bot via @BotFather, provides token |
| **Message Handling** | Text messages forwarded to Agent |
| **Response Routing** | Replies sent back to same Telegram chat |
| **Message Chunking** | Long responses split into multiple messages (4096 char limit) |

**Setup Flow**:

1. User opens @BotFather in Telegram
2. Creates new bot with `/newbot`
3. Copies bot token (format: `123456789:ABCdefGHI...`)
4. Pastes token in Multica Desktop → Settings → Channels
5. Bot starts, ready to receive messages

**Status Indicators**:

| Status | Meaning | User Action |
|--------|---------|-------------|
| `starting` | Bot initializing | Wait |
| `running` | Bot active, receiving messages | None |
| `error` | Connection failed | Check token, retry |
| `stopped` | Bot disabled | Enable in settings |

#### 4.12.3 Message Path Routing

The system maintains a `lastRoute` to ensure responses go back through the correct channel:

| Message Source | Route | Response Destination |
|----------------|-------|---------------------|
| Desktop IPC | `local` | Desktop chat UI |
| Web/Mobile via Gateway | `gateway:{deviceId}` | Same device via Gateway |
| Telegram | `telegram:{chatId}` | Same Telegram chat |

**Design Note**: This routing is automatic. Users don't need to understand it, but it enables seamless multi-channel conversations.

#### 4.12.4 Future Extensibility

The channel architecture is designed to support additional platforms:

| Potential Channel | Status | Notes |
|-------------------|--------|-------|
| Discord | Planned | Similar bot model to Telegram |
| Slack | Planned | Workspace app integration |
| WhatsApp | Considered | Business API required |
| Email | Considered | IMAP/SMTP integration |

**Design Guidance**: When designing channel settings UI, use a consistent pattern:
- Platform icon + name
- Connection status indicator
- Setup/configure button
- Disconnect option

---

## 5. Platform Details

### 5.1 Desktop App (Primary)

**Technology**: Electron + Vite + React 19

**Window**: 1200x800, context isolation enabled, node integration disabled

#### 5.1.1 Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | Agent status, current provider/model, quick actions |
| `/chat` | Chat | Message history, chat input |
| `/tools` | Tools | Tool listing and inspection |
| `/skills` | Skills | Skill listing and management |
| `/settings` | Settings | Provider config, remote access, advanced options |

**Navigation**: Sidebar (planned) — Dashboard, Chat, Tools, Skills, Settings

**Dashboard Focus**: Show what your agent can do and its current state, not "how to connect devices".

#### 5.1.2 Dashboard Components (Planned)

| Component | Description | Priority |
|-----------|-------------|----------|
| Agent Status | Running/Idle indicator, current task if any | P0 |
| Provider Info | Current provider + model, token usage if available | P1 |
| Quick Actions | "Start Chat", "New Session" | P1 |
| Capabilities Overview | Available tools and skills summary | P1 |
| Session History | Recent conversations, quick resume | P2 |
| Settings Access | Link to provider config, advanced settings | P2 |

**Moved to Settings → Remote Access**:
- QR Code for device pairing
- Connected devices list
- Gateway configuration

#### 5.1.3 Chat Page Modes

| Mode | Transport | When Used |
|------|-----------|-----------|
| Local Agent | IPC (Electron) | Desktop user talks directly to embedded agent |
| Remote Agent | WebSocket via Gateway | Desktop user connects to another Hub's agent |

Mode switcher available at top of chat page.

#### 5.1.4 Desktop IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `localChat:send` | Renderer → Main | Send message to agent |
| `localChat:subscribe` | Renderer → Main | Subscribe to agent events |
| `hub:device-confirm-request` | Main → Renderer | Show device confirmation dialog |
| `hub:device-confirm-response` | Renderer → Main | User's allow/reject decision |

---

### 5.2 Web App

**Technology**: Next.js 16 + App Router

**Port**: 3001

**Features**:
- Always requires Gateway connection (no local agent)
- Uses shared `@multica/ui` Chat component
- PWA-capable (service worker, offline page)
- Responsive layout (mobile-first)
- Light/dark theme toggle

**Page**: Single page rendering `<Chat />` component with `ConnectPrompt` for initial connection.

---

### 5.3 Mobile App

**Technology**: Expo + React Native

**Status**: Demo/prototype (hardcoded mock messages)

**Features**:
- QR code scanner for device pairing
- Keyboard-avoiding input bar
- Auto-expanding text input (max 120px)
- Auto-scroll to bottom on new messages

---

### 5.4 CLI

**Entry point**: `multica` (alias: `mu`)

#### 5.4.1 Commands

| Command | Description |
|---------|-------------|
| `multica` | Interactive chat mode (default) |
| `multica run "<prompt>"` | Non-interactive single prompt |
| `multica chat` | Explicit interactive mode |
| `multica session list/show/delete` | Session management |
| `multica profile list/new/setup/show/edit/delete` | Profile management |
| `multica skills list/status/install/add/remove` | Skill management |
| `multica tools list/groups/profiles` | Tool inspection |
| `multica credentials init/show/edit` | Credentials management |
| `multica dev [service]` | Development servers |

#### 5.4.2 Interactive Mode Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/exit` `/quit` `/q` | Exit |
| `/clear` | Clear session |
| `/session` | Show current session ID |
| `/new` | Start new session |
| `/multiline` | Toggle multi-line input mode |
| `/provider` | Show provider status |
| `/model [name]` | Switch model |
| `/{skillName} [args]` | Execute skill |

**Features**: Autocomplete (Shift+Tab), status bar (session/provider/model), multi-line mode (end with `.`).

#### 5.4.3 Development Servers

| Service | Command | Port |
|---------|---------|------|
| Desktop (default) | `multica dev` | Electron window |
| Gateway | `multica dev gateway` | 3000 |
| Web | `multica dev web` | 3001 |
| All | `multica dev all` | 3000 + 3001 |

---

## 6. UI Component Library

Shared package: `@multica/ui`. Used by Desktop, Web, and Mobile.

### 6.1 Chat Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Chat` | (none, uses stores) | Full chat view: connect prompt + message list + input |
| `ChatInput` | `onSubmit`, `disabled`, `placeholder` | Tiptap editor. Enter=send, Shift+Enter=newline, IME-safe |
| `ChatInputRef` | (imperative) | `getText()`, `setText()`, `focus()`, `clear()` |
| `MessageList` | `messages`, `streamingIds` | Renders messages with markdown, tool calls, streaming |
| `ConnectPrompt` | (none, uses stores) | QR scan + paste code UI for remote connection |
| `ChatSkeleton` | (none) | Loading skeleton |
| `ToolCallItem` | `message` | Tool execution display: status dot, label, subtitle, expandable results |

### 6.2 Markdown Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Markdown` | `children`, `mode` (`minimal`/`full`) | Rendered markdown with syntax highlighting |
| `StreamingMarkdown` | `content`, `isStreaming`, `mode` | Incremental markdown with animated cursor |
| `CodeBlock` | (internal) | Syntax-highlighted code block with copy button |

### 6.3 Base UI Components (Shadcn/UI)

button, input, textarea, card, dialog, alert-dialog, dropdown-menu, select, combobox, badge, label, field, input-group, switch, skeleton, separator, sheet, sidebar, tooltip, sonner (toasts)

### 6.4 Utility Components

| Component | Description |
|-----------|-------------|
| `QRScannerView` | Camera-based QR scanner |
| `QRScannerSheet` | Sheet variant of QR scanner |
| `Spinner` | Animated loading spinner |
| `ThemeProvider` | Light/dark theme context |
| `ThemeToggle` | Theme switch button |

---

## 7. Data Persistence Locations

| Data | Location | Format | Lifetime |
|------|----------|--------|----------|
| Credentials | `~/.super-multica/credentials.json5` | JSON5 | User-managed |
| Skills env | `~/.super-multica/skills.env.json5` | JSON5 | User-managed |
| Agent profiles | `~/.super-multica/agent-profiles/{id}/` | MD + JSON | User-managed |
| Agent memory | `~/.super-multica/agent-profiles/{id}/memory/` | JSON per key | Agent-managed |
| Sessions | `~/.super-multica/sessions/{id}/session.jsonl` | JSONL | Until deleted |
| Agent records | `~/.super-multica/agents/agents.json` | JSON | Persistent |
| Hub ID | `~/.super-multica/hub-id` | Plain text UUID | Generated once |
| Device whitelist | `~/.super-multica/client-devices/whitelist.json` | JSON | Until revoked |
| Auth profile stats | `~/.super-multica/.auth-profiles/usage-stats.json` | JSON | Runtime tracking |
| Verification tokens | In-memory | Map | Lost on restart |
| Browser device ID | localStorage: `multica-device` | UUID string | Until cleared |
| Saved connection | localStorage: `multica-connection` | JSON | Until disconnected |

---

## 8. Current Limitations

| Area | Limitation | Notes |
|------|-----------|-------|
| Agent count | Desktop creates 1 primary agent on startup | Hub API supports multi-agent (`createAgent`/`listAgents`), but UI only shows one |
| Device permissions | All-or-nothing access | No per-device capability restrictions |
| Role system | No formal RBAC | Owner is implicit admin |
| Mobile app | Demo/prototype | Hardcoded mock data, no real agent connection |
| Offline web | PWA shell only | Cannot function without Gateway |
| Skill marketplace | No registry | Install via GitHub URL only |
| Real-time collaboration | Single agent, sequential messages | No concurrent message processing |
| File upload | Not supported | Agent can only read files on Owner's filesystem |

---

*Document generated: 2026-02-11*
*Source: codebase analysis on branch feat/onboarding-check*
*Updates:*
- *Added Core Value Propositions (Section 2), Exec Approval Protocol (4.3.5), Channel Integration (4.12)*
- *2026-02-11: **Product positioning shift** — from "distributed framework" to "personal AI agent". Remote access demoted to power feature. Dashboard replaces connection-focused home page.*
