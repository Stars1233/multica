package usage

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// scanCodex reads Codex CLI session logs from ~/.codex/sessions/YYYY/MM/DD/*.jsonl
// and extracts token usage from "token_count" event lines.
func (s *Scanner) scanCodex() []Record {
	root := codexLogRoot()
	if root == "" {
		return nil
	}

	// Glob for session files: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
	pattern := filepath.Join(root, "*", "*", "*", "*.jsonl")
	files, err := filepath.Glob(pattern)
	if err != nil {
		s.logger.Debug("codex glob error", "error", err)
		return nil
	}

	var allRecords []Record
	for _, f := range files {
		record := s.parseCodexFile(f)
		if record != nil {
			allRecords = append(allRecords, *record)
		}
	}

	return mergeRecords(allRecords)
}

// codexLogRoot returns the Codex sessions directory.
func codexLogRoot() string {
	if codexHome := os.Getenv("CODEX_HOME"); codexHome != "" {
		dir := filepath.Join(codexHome, "sessions")
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir
		}
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	dir := filepath.Join(home, ".codex", "sessions")
	if info, err := os.Stat(dir); err == nil && info.IsDir() {
		return dir
	}
	return ""
}

// codexEvent represents a line in a Codex session JSONL file.
type codexEvent struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
	Payload   *struct {
		Type string          `json:"type"`
		Msg  json.RawMessage `json:"msg"`
	} `json:"payload"`
}

// codexTokenCount represents the token_count info structure.
type codexTokenCount struct {
	Info *struct {
		TotalTokenUsage *struct {
			InputTokens           int64 `json:"input_tokens"`
			OutputTokens          int64 `json:"output_tokens"`
			CachedInputTokens     int64 `json:"cached_input_tokens"`
			ReasoningOutputTokens int64 `json:"reasoning_output_tokens"`
			TotalTokens           int64 `json:"total_tokens"`
		} `json:"total_token_usage"`
		Model string `json:"model"`
	} `json:"info"`
}

// parseCodexFile extracts the final cumulative token_count from a Codex session file.
// Returns nil if no usage data found.
func (s *Scanner) parseCodexFile(path string) *Record {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	// Extract date from directory path: .../sessions/YYYY/MM/DD/file.jsonl
	date := extractDateFromPath(path)
	if date == "" {
		return nil
	}

	var lastUsage *codexTokenCount
	var lastModel string

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()

		// Fast pre-filter
		if !bytesContains(line, `"token_count"`) {
			continue
		}

		// Try direct event format: {"type": "event_msg", "payload": {"type": "token_count", ...}}
		var evt codexEvent
		if err := json.Unmarshal(line, &evt); err != nil {
			continue
		}

		// Check if payload contains token_count
		if evt.Payload != nil && evt.Payload.Type == "token_count" {
			var tc codexTokenCount
			if err := json.Unmarshal(evt.Payload.Msg, &tc); err == nil && tc.Info != nil && tc.Info.TotalTokenUsage != nil {
				lastUsage = &tc
				if tc.Info.Model != "" {
					lastModel = tc.Info.Model
				}
				continue
			}
		}

		// Also try flat format where msg is at top level
		var tc codexTokenCount
		if err := json.Unmarshal(line, &tc); err == nil && tc.Info != nil && tc.Info.TotalTokenUsage != nil {
			lastUsage = &tc
			if tc.Info.Model != "" {
				lastModel = tc.Info.Model
			}
		}
	}

	if lastUsage == nil || lastUsage.Info == nil || lastUsage.Info.TotalTokenUsage == nil {
		return nil
	}

	model := lastModel
	if model == "" {
		model = "unknown"
	}

	usage := lastUsage.Info.TotalTokenUsage
	return &Record{
		Date:             date,
		Provider:         "codex",
		Model:            model,
		InputTokens:      usage.InputTokens,
		OutputTokens:     usage.OutputTokens + usage.ReasoningOutputTokens,
		CacheReadTokens:  usage.CachedInputTokens,
		CacheWriteTokens: 0, // Codex doesn't have cache write tokens
	}
}

// extractDateFromPath extracts YYYY-MM-DD from a path like .../sessions/2026/03/26/file.jsonl
func extractDateFromPath(path string) string {
	parts := strings.Split(filepath.ToSlash(path), "/")
	// Look for sessions/YYYY/MM/DD pattern
	for i := 0; i < len(parts)-3; i++ {
		if parts[i] == "sessions" && len(parts[i+1]) == 4 && len(parts[i+2]) == 2 && len(parts[i+3]) == 2 {
			return parts[i+1] + "-" + parts[i+2] + "-" + parts[i+3]
		}
	}
	return ""
}
