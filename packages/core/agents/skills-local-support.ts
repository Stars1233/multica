// Providers whose runtime actually honours the per-agent `skills_local`
// toggle today. Claude isolates `~/.claude/skills` via `CLAUDE_CONFIG_DIR`;
// Codex isolates `~/.codex/skills` via per-task `CODEX_HOME`. Every other
// provider currently stores the field but treats it as a no-op at exec
// time, so surfacing the toggle in their agent pages would mislead users
// into thinking it gates host-skill access for them. See MUL-2603 discussion.
export const SKILLS_LOCAL_SUPPORTED_PROVIDERS = ["claude", "codex"] as const;

export function isSkillsLocalSupportedProvider(
  provider: string | null | undefined,
): boolean {
  if (!provider) return false;
  return (SKILLS_LOCAL_SUPPORTED_PROVIDERS as readonly string[]).includes(
    provider,
  );
}
