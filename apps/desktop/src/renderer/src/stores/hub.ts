import { create } from 'zustand'

// Connection state types
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'registered'

export interface HubInfo {
  hubId: string
  url: string
  connectionState: ConnectionState
  agentCount: number
}

export interface AgentInfo {
  id: string
  closed: boolean
}

interface HubStore {
  // State
  hubInfo: HubInfo | null
  agents: AgentInfo[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  init: () => Promise<void>
  refresh: () => Promise<void>
  reconnect: (url: string) => Promise<{ ok: boolean; error?: string }>
}

export const useHubStore = create<HubStore>()((set, get) => ({
  hubInfo: null,
  agents: [],
  loading: false,
  error: null,
  initialized: false,

  init: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      await window.electronAPI.hub.init()
      const info = await window.electronAPI.hub.info()
      const agentList = await window.electronAPI.hub.listAgents()

      set({
        hubInfo: info as HubInfo,
        agents: agentList as AgentInfo[],
        initialized: true,
      })

      // Subscribe to connection state changes
      window.electronAPI.hub.onConnectionStateChanged((state: string) => {
        set((prev) => ({
          hubInfo: prev.hubInfo
            ? { ...prev.hubInfo, connectionState: state as ConnectionState }
            : prev.hubInfo,
        }))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[HubStore] Failed to initialize:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    set({ error: null })

    try {
      const info = await window.electronAPI.hub.info()
      const agentList = await window.electronAPI.hub.listAgents()

      set({
        hubInfo: info as HubInfo,
        agents: agentList as AgentInfo[],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[HubStore] Failed to refresh:', message)
    }
  },

  reconnect: async (url: string) => {
    set({ error: null })

    try {
      await window.electronAPI.hub.reconnect(url)
      await get().refresh()
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      return { ok: false, error: message }
    }
  },
}))

// Selector helpers
export const selectPrimaryAgent = (agents: AgentInfo[]) => agents[0] ?? null

export const selectIsConnected = (hubInfo: HubInfo | null) => {
  if (!hubInfo) return false
  return hubInfo.connectionState === 'connected' || hubInfo.connectionState === 'registered'
}
