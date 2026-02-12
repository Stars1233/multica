import { create } from 'zustand'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 800

// Types matching the IPC response
export interface ToolInfo {
  name: string
  description?: string
  group: string
  enabled: boolean
}

// Tool descriptions (for UI display)
const TOOL_DESCRIPTIONS: Record<string, string> = {
  read: 'Read file contents',
  write: 'Write content to file',
  edit: 'Edit file with search/replace',
  glob: 'Find files by pattern',
  exec: 'Execute shell commands',
  process: 'Manage background processes',
  web_fetch: 'Fetch content from URLs',
  web_search: 'Search the web via Devv Search',
  memory_get: 'Get stored memory value',
  memory_set: 'Store a memory value',
  memory_delete: 'Delete a memory value',
  memory_list: 'List all memory keys',
  memory_search: 'Search memory files for keywords',
  cron: 'Create and manage scheduled tasks',
}

interface ToolsStore {
  // State
  tools: ToolInfo[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetch: () => Promise<void>
  refresh: (options?: { silent?: boolean }) => Promise<void>
  toggleTool: (toolName: string) => Promise<void>
  setToolStatus: (toolName: string, enabled: boolean) => Promise<void>
}

export const useToolsStore = create<ToolsStore>()((set, get) => ({
  tools: [],
  loading: false,
  error: null,
  initialized: false,

  fetch: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.tools.list()

      if (Array.isArray(result)) {
        // Add descriptions to tools
        const toolsWithDesc = result.map((tool: { name: string; enabled: boolean; group: string }) => ({
          ...tool,
          description: TOOL_DESCRIPTIONS[tool.name],
        }))
        set({
          tools: toolsWithDesc,
          initialized: true,
        })
      } else {
        set({ error: 'Invalid response from tools:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[ToolsStore] Failed to load:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async (options?: { silent?: boolean }) => {
    set({ loading: true, error: null })

    const startTime = Date.now()

    try {
      const result = await window.electronAPI.tools.list()

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      if (Array.isArray(result)) {
        const toolsWithDesc = result.map((tool: { name: string; enabled: boolean; group: string }) => ({
          ...tool,
          description: TOOL_DESCRIPTIONS[tool.name],
        }))
        set({ tools: toolsWithDesc })
        if (!options?.silent) toast.success('Tools refreshed')
      } else {
        set({ error: 'Invalid response from tools:list' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to refresh tools', { description: message })
      console.error('[ToolsStore] Failed to refresh:', message)
    } finally {
      set({ loading: false })
    }
  },

  toggleTool: async (toolName: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.tools.toggle(toolName)
      const typedResult = result as { error?: string; enabled?: boolean }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to toggle tool', { description: typedResult.error })
        return
      }

      // Update local state
      set((state) => ({
        tools: state.tools.map((tool) =>
          tool.name === toolName
            ? { ...tool, enabled: typedResult.enabled ?? !tool.enabled }
            : tool
        ),
      }))

      toast.success(`${toolName} ${typedResult.enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to toggle tool', { description: message })
      console.error('[ToolsStore] Failed to toggle:', message)
    }
  },

  setToolStatus: async (toolName: string, enabled: boolean) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.tools.setStatus(toolName, enabled)
      const typedResult = result as { error?: string }

      if (typedResult.error) {
        set({ error: typedResult.error })
        toast.error('Failed to update tool', { description: typedResult.error })
        return
      }

      // Update local state
      set((state) => ({
        tools: state.tools.map((tool) =>
          tool.name === toolName ? { ...tool, enabled } : tool
        ),
      }))

      toast.success(`${toolName} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to update tool', { description: message })
      console.error('[ToolsStore] Failed to set status:', message)
    }
  },
}))

// Selector helpers
export const selectEnabledTools = (tools: ToolInfo[]) =>
  tools.filter(t => t.enabled)

export const selectEnabledToolsCount = (tools: ToolInfo[]) =>
  tools.filter(t => t.enabled).length
