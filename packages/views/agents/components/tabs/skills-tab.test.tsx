// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Agent, AgentRuntime } from "@multica/core/types";
import { I18nProvider } from "@multica/core/i18n/react";
import enCommon from "../../../locales/en/common.json";
import enAgents from "../../../locales/en/agents.json";

const TEST_RESOURCES = { en: { common: enCommon, agents: enAgents } };

const mockListSkills = vi.hoisted(() => vi.fn());
const mockUpdateAgent = vi.hoisted(() => vi.fn());

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-1",
}));

vi.mock("@multica/core/api", () => ({
  api: {
    listSkills: (...args: unknown[]) => mockListSkills(...args),
    setAgentSkills: vi.fn(),
    updateAgent: (...args: unknown[]) => mockUpdateAgent(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { SkillsTab } from "./skills-tab";

const agent: Agent = {
  id: "agent-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "Agent",
  description: "",
  instructions: "",
  avatar_url: null,
  runtime_mode: "local",
  runtime_config: {},
  custom_args: [],
  visibility: "workspace",
  status: "idle",
  max_concurrent_tasks: 1,
  model: "",
  owner_id: "user-1",
  skills: [],
  created_at: "2026-04-16T00:00:00Z",
  updated_at: "2026-04-16T00:00:00Z",
  archived_at: null,
  archived_by: null,
};

function makeRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    id: "runtime-1",
    workspace_id: "ws-1",
    daemon_id: null,
    name: "Runtime",
    runtime_mode: "local",
    provider: "claude",
    launch_header: "",
    status: "online",
    device_info: "",
    metadata: {},
    owner_id: null,
    visibility: "public",
    last_seen_at: null,
    created_at: "2026-04-16T00:00:00Z",
    updated_at: "2026-04-16T00:00:00Z",
    ...overrides,
  };
}

function renderSkillsTab(
  overrides: Partial<Agent> = {},
  runtime: AgentRuntime | null = makeRuntime(),
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <I18nProvider locale="en" resources={TEST_RESOURCES}>
      <QueryClientProvider client={queryClient}>
        <SkillsTab agent={{ ...agent, ...overrides }} runtime={runtime} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("SkillsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSkills.mockResolvedValue([]);
    mockUpdateAgent.mockResolvedValue({});
  });

  it("does not render the inline Local Runtime Skills section even for local-runtime agents", async () => {
    // The inline section auto-loaded local skills on every Skills-tab
    // entry, which was both noisy and (under multi-replica deploys) prone
    // to "request not found" because the request store is in-process.
    // Local-skill import now lives behind the explicit Skills page →
    // Add Skill → From Runtime tab; nothing here may auto-load.
    renderSkillsTab();

    // Top informational callout should still render; that's how we know
    // the tab body itself rendered (not stuck in a loading state). The
    // toggle hint also includes the same phrase, so anchor on the intro
    // copy specifically.
    expect(
      await screen.findByText(
        /Workspace skills assigned to this agent/i,
      ),
    ).toBeInTheDocument();

    // The removed section's heading and its trigger button must be gone.
    expect(screen.queryByText("Local Runtime Skills")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Import to Workspace/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the local-skill toggle ON by default (merge — preserves inherit-from-machine behavior)", async () => {
    // Bohan's MUL-2603 product decision: keep the legacy "merge" default so
    // personal workflows that rely on locally installed Claude Skills keep
    // working unchanged. Owners flip the toggle off ("ignore") when they
    // explicitly need to harden a shared agent.
    renderSkillsTab();

    const toggle = await screen.findByRole("switch", {
      name: /Allow locally installed skills/i,
    });
    // Base UI Switch reflects state via data-state; aria-checked is the
    // accessible read.
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("reflects ignore mode when the agent opted into isolation", async () => {
    renderSkillsTab({ skills_local: "ignore" });

    const toggle = await screen.findByRole("switch", {
      name: /Allow locally installed skills/i,
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("renders the toggle for Codex runtimes too", async () => {
    renderSkillsTab({}, makeRuntime({ provider: "codex" }));

    expect(
      await screen.findByRole("switch", {
        name: /Allow locally installed skills/i,
      }),
    ).toBeInTheDocument();
  });

  it("hides the toggle for runtimes that don't honour skills_local", async () => {
    // Only Claude and Codex runtimes actually enforce skills_local at exec
    // time today (MUL-2603); on every other provider the field would be
    // stored but ignored, so the toggle is suppressed to avoid implying
    // behaviour the runtime won't deliver.
    renderSkillsTab({}, makeRuntime({ provider: "copilot" }));

    // The rest of the tab still renders.
    expect(
      await screen.findByText(/Workspace skills assigned to this agent/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", {
        name: /Allow locally installed skills/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("hides the toggle when the runtime cannot be resolved", async () => {
    renderSkillsTab({}, null);

    expect(
      await screen.findByText(/Workspace skills assigned to this agent/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", {
        name: /Allow locally installed skills/i,
      }),
    ).not.toBeInTheDocument();
  });
});
