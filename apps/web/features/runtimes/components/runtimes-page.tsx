"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Monitor,
  Cloud,
  Wifi,
  WifiOff,
  Server,
  BarChart3,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import type { AgentRuntime, RuntimeUsage, RuntimePingStatus } from "@multica/types";
import { Button } from "@/components/ui/button";
import { api } from "@/shared/api";
import { useAuthStore } from "@/features/auth";
import { useWorkspaceStore } from "@/features/workspace";
import { useWSEvent } from "@/features/realtime";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// Pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

function estimateCost(usage: RuntimeUsage): number {
  // Try to find a matching model in pricing table
  const model = usage.model;
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Try partial match
    for (const [key, p] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(key)) {
        pricing = p;
        break;
      }
    }
  }
  if (!pricing) return 0;

  return (
    (usage.input_tokens * pricing.input +
      usage.output_tokens * pricing.output +
      usage.cache_read_tokens * pricing.cacheRead +
      usage.cache_write_tokens * pricing.cacheWrite) /
    1_000_000
  );
}

function RuntimeModeIcon({ mode }: { mode: string }) {
  return mode === "cloud" ? (
    <Cloud className="h-3.5 w-3.5" />
  ) : (
    <Monitor className="h-3.5 w-3.5" />
  );
}

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === "online";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isOnline
          ? "bg-success/10 text-success"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isOnline ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Runtime List Item
// ---------------------------------------------------------------------------

function RuntimeListItem({
  runtime,
  isSelected,
  onClick,
}: {
  runtime: AgentRuntime;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          runtime.status === "online" ? "bg-success/10" : "bg-muted"
        }`}
      >
        <RuntimeModeIcon mode={runtime.runtime_mode} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{runtime.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {runtime.provider} &middot; {runtime.runtime_mode}
        </div>
      </div>
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${
          runtime.status === "online" ? "bg-success" : "bg-muted-foreground/40"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Usage Section
// ---------------------------------------------------------------------------

function UsageSection({ runtimeId }: { runtimeId: string }) {
  const [usage, setUsage] = useState<RuntimeUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getRuntimeUsage(runtimeId, { days: 30 })
      .then(setUsage)
      .catch(() => setUsage([]))
      .finally(() => setLoading(false));
  }, [runtimeId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">Loading usage...</div>
    );
  }

  if (usage.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed py-6">
        <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">
          No usage data yet
        </p>
      </div>
    );
  }

  // Compute totals
  const totals = usage.reduce(
    (acc, u) => ({
      input: acc.input + u.input_tokens,
      output: acc.output + u.output_tokens,
      cacheRead: acc.cacheRead + u.cache_read_tokens,
      cacheWrite: acc.cacheWrite + u.cache_write_tokens,
      cost: acc.cost + estimateCost(u),
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  );

  // Group by date for the table
  const byDate = new Map<string, RuntimeUsage[]>();
  for (const u of usage) {
    const existing = byDate.get(u.date) ?? [];
    existing.push(u);
    byDate.set(u.date, existing);
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <TokenCard label="Input" value={totals.input} />
        <TokenCard label="Output" value={totals.output} />
        <TokenCard label="Cache Read" value={totals.cacheRead} />
        <TokenCard label="Cache Write" value={totals.cacheWrite} />
      </div>

      {totals.cost > 0 && (
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Estimated cost (30d):{" "}
          </span>
          <span className="text-sm font-semibold">
            ${totals.cost.toFixed(2)}
          </span>
        </div>
      )}

      {/* Daily breakdown table */}
      <div className="rounded-lg border">
        <div className="grid grid-cols-[100px_1fr_80px_80px_80px_80px] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          <div>Date</div>
          <div>Model</div>
          <div className="text-right">Input</div>
          <div className="text-right">Output</div>
          <div className="text-right">Cache R</div>
          <div className="text-right">Cache W</div>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y">
          {[...byDate.entries()].map(([date, rows]) =>
            rows.map((row, i) => (
              <div
                key={`${date}-${row.model}-${i}`}
                className="grid grid-cols-[100px_1fr_80px_80px_80px_80px] gap-2 px-3 py-1.5 text-xs"
              >
                <div className="text-muted-foreground">{date}</div>
                <div className="truncate font-mono">{row.model}</div>
                <div className="text-right tabular-nums">
                  {formatTokens(row.input_tokens)}
                </div>
                <div className="text-right tabular-nums">
                  {formatTokens(row.output_tokens)}
                </div>
                <div className="text-right tabular-nums">
                  {formatTokens(row.cache_read_tokens)}
                </div>
                <div className="text-right tabular-nums">
                  {formatTokens(row.cache_write_tokens)}
                </div>
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}

function TokenCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">
        {formatTokens(value)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection Test (Ping)
// ---------------------------------------------------------------------------

const pingStatusConfig: Record<
  RuntimePingStatus,
  { label: string; icon: typeof Loader2; color: string }
> = {
  pending: { label: "Waiting for daemon...", icon: Loader2, color: "text-muted-foreground" },
  running: { label: "Running test...", icon: Loader2, color: "text-info" },
  completed: { label: "Connected", icon: CheckCircle2, color: "text-success" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive" },
  timeout: { label: "Timeout", icon: XCircle, color: "text-warning" },
};

function PingSection({ runtimeId }: { runtimeId: string }) {
  const [status, setStatus] = useState<RuntimePingStatus | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const handleTest = async () => {
    cleanup();
    setTesting(true);
    setStatus("pending");
    setOutput("");
    setError("");
    setDurationMs(null);

    try {
      const ping = await api.pingRuntime(runtimeId);

      // Poll for result every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const result = await api.getPingResult(runtimeId, ping.id);
          setStatus(result.status as RuntimePingStatus);

          if (result.status === "completed") {
            setOutput(result.output ?? "");
            setDurationMs(result.duration_ms ?? null);
            setTesting(false);
            cleanup();
          } else if (result.status === "failed" || result.status === "timeout") {
            setError(result.error ?? "Unknown error");
            setDurationMs(result.duration_ms ?? null);
            setTesting(false);
            cleanup();
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } catch {
      setStatus("failed");
      setError("Failed to initiate test");
      setTesting(false);
    }
  };

  const config = status ? pingStatusConfig[status] : null;
  const Icon = config?.icon;
  const isActive = status === "pending" || status === "running";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          {testing ? "Testing..." : "Test Connection"}
        </Button>

        {config && Icon && (
          <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
            <Icon className={`h-3 w-3 ${isActive ? "animate-spin" : ""}`} />
            {config.label}
            {durationMs != null && (
              <span className="text-muted-foreground">
                ({(durationMs / 1000).toFixed(1)}s)
              </span>
            )}
          </span>
        )}
      </div>

      {status === "completed" && output && (
        <div className="rounded-lg border bg-success/5 px-3 py-2">
          <pre className="text-xs font-mono whitespace-pre-wrap">{output}</pre>
        </div>
      )}

      {(status === "failed" || status === "timeout") && error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runtime Detail
// ---------------------------------------------------------------------------

function RuntimeDetail({ runtime }: { runtime: AgentRuntime }) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              runtime.status === "online" ? "bg-success/10" : "bg-muted"
            }`}
          >
            <RuntimeModeIcon mode={runtime.runtime_mode} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{runtime.name}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {runtime.provider} &middot;{" "}
              {runtime.device_info || "Unknown device"}
            </p>
          </div>
        </div>
        <StatusBadge status={runtime.status} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="Runtime Mode" value={runtime.runtime_mode} />
          <InfoField label="Provider" value={runtime.provider} />
          <InfoField label="Status" value={runtime.status} />
          <InfoField
            label="Last Seen"
            value={formatLastSeen(runtime.last_seen_at)}
          />
          {runtime.device_info && (
            <InfoField label="Device" value={runtime.device_info} />
          )}
          {runtime.daemon_id && (
            <InfoField label="Daemon ID" value={runtime.daemon_id} mono />
          )}
        </div>

        {/* Connection Test */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Connection Test
          </h3>
          <PingSection runtimeId={runtime.id} />
        </div>

        {/* Usage */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Token Usage (Last 30 Days)
          </h3>
          <UsageSection runtimeId={runtime.id} />
        </div>

        {/* Metadata */}
        {runtime.metadata && Object.keys(runtime.metadata).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">
              Metadata
            </h3>
            <div className="rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(runtime.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <InfoField
            label="Created"
            value={new Date(runtime.created_at).toLocaleString()}
          />
          <InfoField
            label="Updated"
            value={new Date(runtime.updated_at).toLocaleString()}
          />
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm truncate ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RuntimesPage() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const [runtimes, setRuntimes] = useState<AgentRuntime[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [fetching, setFetching] = useState(true);

  const fetchRuntimes = useCallback(async () => {
    if (!workspace) return;
    try {
      const data = await api.listRuntimes({ workspace_id: workspace.id });
      setRuntimes(data);
    } finally {
      setFetching(false);
    }
  }, [workspace]);

  useEffect(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  // Auto-select first runtime
  useEffect(() => {
    if (runtimes.length > 0 && !selectedId) {
      setSelectedId(runtimes[0]!.id);
    }
  }, [runtimes, selectedId]);

  // Real-time updates
  const handleDaemonEvent = useCallback(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  useWSEvent("daemon:register", handleDaemonEvent);
  useWSEvent("daemon:heartbeat", handleDaemonEvent);

  const selected = runtimes.find((r) => r.id === selectedId) ?? null;

  if (isLoading || fetching) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left column - runtime list */}
      <div className="w-72 shrink-0 overflow-y-auto border-r">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <h1 className="text-sm font-semibold">Runtimes</h1>
          <span className="text-xs text-muted-foreground">
            {runtimes.filter((r) => r.status === "online").length}/
            {runtimes.length} online
          </span>
        </div>
        {runtimes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <Server className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No runtimes registered
            </p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              Run{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                multica daemon start
              </code>{" "}
              to register a local runtime.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {runtimes.map((runtime) => (
              <RuntimeListItem
                key={runtime.id}
                runtime={runtime}
                isSelected={runtime.id === selectedId}
                onClick={() => setSelectedId(runtime.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right column - runtime detail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <RuntimeDetail key={selected.id} runtime={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Server className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm">Select a runtime to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
