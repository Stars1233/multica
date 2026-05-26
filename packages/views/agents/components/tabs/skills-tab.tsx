"use client";

import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Agent,
  AgentRuntime,
  AgentSkillsLocal,
} from "@multica/core/types";
import { api } from "@multica/core/api";
import { isSkillsLocalSupportedProvider } from "@multica/core/agents";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  skillListOptions,
  workspaceKeys,
} from "@multica/core/workspace/queries";
import { Button } from "@multica/ui/components/ui/button";
import { SkillAddDialog } from "../skill-add-dialog";
import { SkillsLocalToggle } from "../skills-local-toggle";
import { useT } from "../../../i18n";

export function SkillsTab({
  agent,
  runtime,
}: {
  agent: Agent;
  /**
   * The runtime this agent is bound to, if known. Used to decide whether
   * the host-skill merge toggle is meaningful for this agent — only Claude
   * and Codex runtimes honour `skills_local` today (MUL-2603). When the
   * runtime is missing (parent couldn't resolve it, e.g. it was deleted)
   * the toggle is hidden — there is no usable provider context to gate on.
   */
  runtime?: AgentRuntime | null;
}) {
  const { t } = useT("agents");
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  // Default missing values to "merge". Older backends omit the field
  // entirely; the documented platform default wins on drift (see
  // AgentSkillsLocal — "ignore" is the explicit hardening opt-in).
  const currentSkillsLocal: AgentSkillsLocal =
    agent.skills_local === "ignore" ? "ignore" : "merge";
  const [skillsLocalSaving, setSkillsLocalSaving] = useState(false);
  const skillsLocalApplies = isSkillsLocalSupportedProvider(runtime?.provider);
  // Same query the SkillAddDialog uses (TanStack Query dedupes by key, so
  // this isn't an extra request) — used here only to grey out the "Add
  // skill" button when the workspace has zero skills total. When skills
  // exist but are all already attached, we still open the dialog: it
  // filters out attached skills and renders a localised "no more skills
  // to add" empty state, which is more useful than a mysterious
  // greyed-out button.
  const { data: workspaceSkills = [] } = useQuery(skillListOptions(wsId));
  const [removing, setRemoving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const handleSkillsLocalChange = async (next: AgentSkillsLocal) => {
    if (next === currentSkillsLocal || skillsLocalSaving) return;
    setSkillsLocalSaving(true);
    try {
      await api.updateAgent(agent.id, { skills_local: next });
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
      toast.success(t(($) => $.tab_body.skills.local_saved_toast));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t(($) => $.tab_body.skills.local_save_failed_toast),
      );
    } finally {
      setSkillsLocalSaving(false);
    }
  };

  const handleRemove = async (skillId: string) => {
    setRemoving(true);
    try {
      const newIds = agent.skills
        .filter((s) => s.id !== skillId)
        .map((s) => s.id);
      await api.setAgentSkills(agent.id, { skill_ids: newIds });
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(($) => $.tab_body.skills.remove_failed_toast));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t(($) => $.tab_body.skills.intro)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          disabled={workspaceSkills.length === 0}
          className="shrink-0"
        >
          <Plus className="h-3 w-3" />
          {t(($) => $.tab_body.skills.add_action)}
        </Button>
      </div>

      {skillsLocalApplies && (
        <SkillsLocalToggle
          value={currentSkillsLocal}
          onChange={handleSkillsLocalChange}
          disabled={skillsLocalSaving}
          hintScope="tab"
        />
      )}


      {agent.skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t(($) => $.tab_body.skills.empty_title)}
          </p>
          <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
            {t(($) => $.tab_body.skills.empty_hint)}
          </p>
          {workspaceSkills.length > 0 && (
            <Button
              onClick={() => setShowAdd(true)}
              size="sm"
              className="mt-3"
            >
              <Plus className="h-3 w-3" />
              {t(($) => $.tab_body.skills.add_action)}
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {agent.skills.map((skill) => (
            <li
              key={skill.id}
              className="flex items-center gap-2.5 rounded-md border px-3 py-2"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{skill.name}</div>
                {skill.description && (
                  <div className="truncate text-xs text-muted-foreground">
                    {skill.description}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(skill.id)}
                disabled={removing}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SkillAddDialog agent={agent} open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
