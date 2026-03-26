package daemon

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/multica-ai/multica/server/internal/daemon/execenv"
	"github.com/multica-ai/multica/server/internal/daemon/usage"
	"github.com/multica-ai/multica/server/pkg/agent"
)

// Daemon is the local agent runtime that polls for and executes tasks.
type Daemon struct {
	cfg    Config
	client *Client
	logger *slog.Logger
}

// New creates a new Daemon instance.
func New(cfg Config, logger *slog.Logger) *Daemon {
	return &Daemon{
		cfg:    cfg,
		client: NewClient(cfg.ServerBaseURL),
		logger: logger,
	}
}

// Run starts the daemon: pairs if needed, registers runtimes, then polls for tasks.
func (d *Daemon) Run(ctx context.Context) error {
	agentNames := make([]string, 0, len(d.cfg.Agents))
	for name := range d.cfg.Agents {
		agentNames = append(agentNames, name)
	}
	d.logger.Info("starting daemon", "agents", agentNames, "workspace_id", d.cfg.WorkspaceID, "server", d.cfg.ServerBaseURL, "repos_root", d.cfg.ReposRoot)

	if strings.TrimSpace(d.cfg.WorkspaceID) == "" {
		workspaceID, err := d.ensurePaired(ctx)
		if err != nil {
			return err
		}
		d.cfg.WorkspaceID = workspaceID
		d.logger.Info("pairing completed", "workspace_id", workspaceID)
	}

	runtimes, err := d.registerRuntimes(ctx)
	if err != nil {
		return err
	}
	runtimeIDs := make([]string, 0, len(runtimes))
	for _, rt := range runtimes {
		d.logger.Info("registered runtime", "id", rt.ID, "provider", rt.Provider, "status", rt.Status)
		runtimeIDs = append(runtimeIDs, rt.ID)
	}

	go d.heartbeatLoop(ctx, runtimes)
	go d.usageScanLoop(ctx, runtimes)
	return d.pollLoop(ctx, runtimeIDs)
}

func (d *Daemon) registerRuntimes(ctx context.Context) ([]Runtime, error) {
	var runtimes []map[string]string
	for name, entry := range d.cfg.Agents {
		version, err := agent.DetectVersion(ctx, entry.Path)
		if err != nil {
			d.logger.Warn("skip registering runtime", "name", name, "error", err)
			continue
		}
		runtimes = append(runtimes, map[string]string{
			"name":    fmt.Sprintf("Local %s", strings.ToUpper(name[:1])+name[1:]),
			"type":    name,
			"version": version,
			"status":  "online",
		})
	}
	if len(runtimes) == 0 {
		return nil, fmt.Errorf("no agent runtimes could be registered")
	}

	req := map[string]any{
		"workspace_id": d.cfg.WorkspaceID,
		"daemon_id":    d.cfg.DaemonID,
		"device_name":  d.cfg.DeviceName,
		"runtimes":     runtimes,
	}

	rts, err := d.client.Register(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("register runtimes: %w", err)
	}
	if len(rts) == 0 {
		return nil, fmt.Errorf("register runtimes: empty response")
	}
	return rts, nil
}

func (d *Daemon) ensurePaired(ctx context.Context) (string, error) {
	// Use a deterministic agent for the pairing session metadata (prefer codex for backward compat).
	var firstName string
	var firstEntry AgentEntry
	for _, preferred := range []string{"codex", "claude"} {
		if entry, ok := d.cfg.Agents[preferred]; ok {
			firstName = preferred
			firstEntry = entry
			break
		}
	}
	version, err := agent.DetectVersion(ctx, firstEntry.Path)
	if err != nil {
		return "", err
	}

	session, err := d.client.CreatePairingSession(ctx, map[string]string{
		"daemon_id":       d.cfg.DaemonID,
		"device_name":     d.cfg.DeviceName,
		"runtime_name":    d.cfg.RuntimeName,
		"runtime_type":    firstName,
		"runtime_version": version,
	})
	if err != nil {
		return "", fmt.Errorf("create pairing session: %w", err)
	}
	if session.LinkURL != nil {
		d.logger.Info("open this link to pair the daemon", "url", *session.LinkURL)
	} else {
		d.logger.Info("pairing session created", "token", session.Token)
	}

	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		current, err := d.client.GetPairingSession(ctx, session.Token)
		if err != nil {
			return "", fmt.Errorf("poll pairing session: %w", err)
		}

		switch current.Status {
		case "approved", "claimed":
			if current.WorkspaceID == nil || strings.TrimSpace(*current.WorkspaceID) == "" {
				return "", fmt.Errorf("pairing session approved without workspace")
			}
			if err := SavePersistedConfig(d.cfg.ConfigPath, PersistedConfig{
				WorkspaceID: strings.TrimSpace(*current.WorkspaceID),
			}); err != nil {
				return "", err
			}
			if current.Status != "claimed" {
				if _, err := d.client.ClaimPairingSession(ctx, current.Token); err != nil {
					return "", fmt.Errorf("claim pairing session: %w", err)
				}
			}
			return strings.TrimSpace(*current.WorkspaceID), nil
		case "expired":
			return "", fmt.Errorf("pairing session expired before approval")
		}

		if err := sleepWithContext(ctx, d.cfg.PollInterval); err != nil {
			return "", err
		}
	}
}

func (d *Daemon) heartbeatLoop(ctx context.Context, runtimes []Runtime) {
	ticker := time.NewTicker(d.cfg.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, rt := range runtimes {
				resp, err := d.client.SendHeartbeat(ctx, rt.ID)
				if err != nil {
					d.logger.Warn("heartbeat failed", "runtime_id", rt.ID, "error", err)
					continue
				}

				// Handle pending ping requests.
				if resp.PendingPing != nil {
					go d.handlePing(ctx, rt, resp.PendingPing.ID)
				}
			}
		}
	}
}

func (d *Daemon) handlePing(ctx context.Context, rt Runtime, pingID string) {
	d.logger.Info("ping requested", "runtime_id", rt.ID, "ping_id", pingID, "provider", rt.Provider)

	start := time.Now()

	entry, ok := d.cfg.Agents[rt.Provider]
	if !ok {
		d.client.ReportPingResult(ctx, rt.ID, pingID, map[string]any{
			"status":      "failed",
			"error":       fmt.Sprintf("no agent configured for provider %q", rt.Provider),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		return
	}

	backend, err := agent.New(rt.Provider, agent.Config{
		ExecutablePath: entry.Path,
		Logger:         d.logger,
	})
	if err != nil {
		d.client.ReportPingResult(ctx, rt.ID, pingID, map[string]any{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		return
	}

	pingCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	session, err := backend.Execute(pingCtx, "Respond with exactly one word: pong", agent.ExecOptions{
		MaxTurns: 1,
		Timeout:  60 * time.Second,
	})
	if err != nil {
		d.client.ReportPingResult(ctx, rt.ID, pingID, map[string]any{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		return
	}

	// Drain messages
	go func() {
		for range session.Messages {
		}
	}()

	result := <-session.Result
	durationMs := time.Since(start).Milliseconds()

	if result.Status == "completed" {
		d.logger.Info("ping completed", "runtime_id", rt.ID, "ping_id", pingID, "duration_ms", durationMs)
		d.client.ReportPingResult(ctx, rt.ID, pingID, map[string]any{
			"status":      "completed",
			"output":      result.Output,
			"duration_ms": durationMs,
		})
	} else {
		errMsg := result.Error
		if errMsg == "" {
			errMsg = fmt.Sprintf("agent returned status: %s", result.Status)
		}
		d.logger.Warn("ping failed", "runtime_id", rt.ID, "ping_id", pingID, "error", errMsg)
		d.client.ReportPingResult(ctx, rt.ID, pingID, map[string]any{
			"status":      "failed",
			"error":       errMsg,
			"duration_ms": durationMs,
		})
	}
}

func (d *Daemon) usageScanLoop(ctx context.Context, runtimes []Runtime) {
	scanner := usage.NewScanner(d.logger)

	// Build provider -> runtime ID mapping.
	providerToRuntime := make(map[string]string)
	for _, rt := range runtimes {
		providerToRuntime[rt.Provider] = rt.ID
	}

	report := func() {
		records := scanner.Scan()
		if len(records) == 0 {
			return
		}

		// Group records by provider to send to the correct runtime.
		byProvider := make(map[string][]map[string]any)
		for _, r := range records {
			byProvider[r.Provider] = append(byProvider[r.Provider], map[string]any{
				"date":              r.Date,
				"provider":          r.Provider,
				"model":             r.Model,
				"input_tokens":      r.InputTokens,
				"output_tokens":     r.OutputTokens,
				"cache_read_tokens": r.CacheReadTokens,
				"cache_write_tokens": r.CacheWriteTokens,
			})
		}

		for provider, entries := range byProvider {
			runtimeID, ok := providerToRuntime[provider]
			if !ok {
				d.logger.Debug("no runtime for provider, skipping usage report", "provider", provider)
				continue
			}
			if err := d.client.ReportUsage(ctx, runtimeID, entries); err != nil {
				d.logger.Warn("usage report failed", "provider", provider, "runtime_id", runtimeID, "error", err)
			} else {
				d.logger.Info("usage reported", "provider", provider, "runtime_id", runtimeID, "entries", len(entries))
			}
		}
	}

	// Initial scan on startup.
	report()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			report()
		}
	}
}

func (d *Daemon) pollLoop(ctx context.Context, runtimeIDs []string) error {
	pollOffset := 0
	pollCount := 0
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		claimed := false
		n := len(runtimeIDs)
		for i := 0; i < n; i++ {
			rid := runtimeIDs[(pollOffset+i)%n]
			task, err := d.client.ClaimTask(ctx, rid)
			if err != nil {
				d.logger.Warn("claim task failed", "runtime_id", rid, "error", err)
				continue
			}
			if task != nil {
				d.logger.Info("task received", "task_id", task.ID, "issue_id", task.IssueID, "title", task.Context.Issue.Title)
				d.handleTask(ctx, *task)
				claimed = true
				pollOffset = (pollOffset + i + 1) % n
				break
			}
		}

		if !claimed {
			pollCount++
			if pollCount%20 == 1 {
				d.logger.Debug("poll: no tasks", "runtimes", runtimeIDs, "cycle", pollCount)
			}
			pollOffset = (pollOffset + 1) % n
			if err := sleepWithContext(ctx, d.cfg.PollInterval); err != nil {
				return err
			}
		} else {
			pollCount = 0
		}
	}
}

func (d *Daemon) handleTask(ctx context.Context, task Task) {
	provider := task.Context.Runtime.Provider
	d.logger.Info("picked task", "task_id", task.ID, "issue_id", task.IssueID, "provider", provider, "title", task.Context.Issue.Title)

	if err := d.client.StartTask(ctx, task.ID); err != nil {
		d.logger.Error("start task failed", "task_id", task.ID, "error", err)
		return
	}

	_ = d.client.ReportProgress(ctx, task.ID, fmt.Sprintf("Launching %s", provider), 1, 2)

	result, err := d.runTask(ctx, task)
	if err != nil {
		d.logger.Error("task failed", "task_id", task.ID, "error", err)
		if failErr := d.client.FailTask(ctx, task.ID, err.Error()); failErr != nil {
			d.logger.Error("fail task callback failed", "task_id", task.ID, "error", failErr)
		}
		return
	}

	_ = d.client.ReportProgress(ctx, task.ID, "Finishing task", 2, 2)

	switch result.Status {
	case "blocked":
		if err := d.client.FailTask(ctx, task.ID, result.Comment); err != nil {
			d.logger.Error("report blocked task failed", "task_id", task.ID, "error", err)
		}
	default:
		d.logger.Info("task completed", "task_id", task.ID, "status", result.Status)
		if err := d.client.CompleteTask(ctx, task.ID, result.Comment, result.BranchName); err != nil {
			d.logger.Error("complete task failed", "task_id", task.ID, "error", err)
		}
	}
}

func (d *Daemon) runTask(ctx context.Context, task Task) (TaskResult, error) {
	provider := task.Context.Runtime.Provider
	entry, ok := d.cfg.Agents[provider]
	if !ok {
		return TaskResult{}, fmt.Errorf("no agent configured for provider %q", provider)
	}

	// Prepare isolated execution environment.
	taskCtx := execenv.TaskContextForEnv{
		IssueTitle:         task.Context.Issue.Title,
		IssueDescription:   task.Context.Issue.Description,
		AcceptanceCriteria: task.Context.Issue.AcceptanceCriteria,
		ContextRefs:        task.Context.Issue.ContextRefs,
		WorkspaceContext:   task.Context.WorkspaceContext,
		AgentName:          task.Context.Agent.Name,
		AgentSkills:        convertSkillsForEnv(task.Context.Agent.Skills),
	}
	env, err := execenv.Prepare(execenv.PrepareParams{
		WorkspacesRoot: d.cfg.WorkspacesRoot,
		ReposRoot:      d.cfg.ReposRoot,
		TaskID:         task.ID,
		AgentName:      task.Context.Agent.Name,
		Task:           taskCtx,
	}, d.logger)
	if err != nil {
		return TaskResult{}, fmt.Errorf("prepare execution environment: %w", err)
	}

	// Inject runtime-specific config (meta skill) so the agent discovers .agent_context/.
	if err := execenv.InjectRuntimeConfig(env.WorkDir, provider, taskCtx); err != nil {
		d.logger.Warn("execenv: inject runtime config failed (non-fatal)", "error", err)
	}
	defer func() {
		if cleanupErr := env.Cleanup(!d.cfg.KeepEnvAfterTask); cleanupErr != nil {
			d.logger.Warn("cleanup env failed", "task_id", task.ID, "error", cleanupErr)
		}
	}()

	prompt := BuildPrompt(task)

	backend, err := agent.New(provider, agent.Config{
		ExecutablePath: entry.Path,
		Logger:         d.logger,
	})
	if err != nil {
		return TaskResult{}, fmt.Errorf("create agent backend: %w", err)
	}

	d.logger.Info("starting agent", "provider", provider, "task_id", task.ID, "workdir", env.WorkDir, "branch", env.BranchName, "env_type", env.Type, "model", entry.Model, "timeout", d.cfg.AgentTimeout.String())

	session, err := backend.Execute(ctx, prompt, agent.ExecOptions{
		Cwd:     env.WorkDir,
		Model:   entry.Model,
		Timeout: d.cfg.AgentTimeout,
	})
	if err != nil {
		return TaskResult{}, err
	}

	// Drain message channel (log tool uses, ignore text since Result has output)
	go func() {
		for msg := range session.Messages {
			switch msg.Type {
			case agent.MessageToolUse:
				d.logger.Debug("tool-use", "provider", provider, "tool", msg.Tool, "call_id", msg.CallID)
			case agent.MessageError:
				d.logger.Error("agent error", "provider", provider, "content", msg.Content)
			}
		}
	}()

	result := <-session.Result

	switch result.Status {
	case "completed":
		if result.Output == "" {
			return TaskResult{}, fmt.Errorf("%s returned empty output", provider)
		}
		return TaskResult{
			Status:     "completed",
			Comment:    result.Output,
			BranchName: env.BranchName,
			EnvType:    string(env.Type),
		}, nil
	case "timeout":
		return TaskResult{}, fmt.Errorf("%s timed out after %s", provider, d.cfg.AgentTimeout)
	default:
		errMsg := result.Error
		if errMsg == "" {
			errMsg = fmt.Sprintf("%s execution %s", provider, result.Status)
		}
		return TaskResult{Status: "blocked", Comment: errMsg}, nil
	}
}

func convertSkillsForEnv(skills []SkillData) []execenv.SkillContextForEnv {
	if len(skills) == 0 {
		return nil
	}
	result := make([]execenv.SkillContextForEnv, len(skills))
	for i, s := range skills {
		result[i] = execenv.SkillContextForEnv{
			Name:    s.Name,
			Content: s.Content,
		}
		for _, f := range s.Files {
			result[i].Files = append(result[i].Files, execenv.SkillFileContextForEnv{
				Path:    f.Path,
				Content: f.Content,
			})
		}
	}
	return result
}
