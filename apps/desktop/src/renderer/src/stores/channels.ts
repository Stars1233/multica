import { create } from 'zustand'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 800

interface ChannelsStore {
  // State
  states: ChannelAccountStateInfo[]
  config: Record<string, Record<string, Record<string, unknown>> | undefined>
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetch: () => Promise<void>
  refresh: (options?: { silent?: boolean }) => Promise<void>
  saveToken: (channelId: string, accountId: string, token: string) => Promise<{ ok: boolean; error?: string }>
  removeToken: (channelId: string, accountId: string) => Promise<{ ok: boolean; error?: string }>
  stopChannel: (channelId: string, accountId: string) => Promise<{ ok: boolean; error?: string }>
  startChannel: (channelId: string, accountId: string) => Promise<{ ok: boolean; error?: string }>
}

export const useChannelsStore = create<ChannelsStore>()((set, get) => ({
  states: [],
  config: {},
  loading: false,
  error: null,
  initialized: false,

  fetch: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      const [stateList, channelConfig] = await Promise.all([
        window.electronAPI.channels.listStates(),
        window.electronAPI.channels.getConfig(),
      ])

      set({
        states: stateList,
        config: channelConfig,
        initialized: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[ChannelsStore] Failed to load:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async (options?: { silent?: boolean }) => {
    set({ loading: true, error: null })

    const startTime = Date.now()

    try {
      const [stateList, channelConfig] = await Promise.all([
        window.electronAPI.channels.listStates(),
        window.electronAPI.channels.getConfig(),
      ])

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      set({
        states: stateList,
        config: channelConfig,
      })
      if (!options?.silent) toast.success('Channels refreshed')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to refresh channels', { description: message })
      console.error('[ChannelsStore] Failed to refresh:', message)
    } finally {
      set({ loading: false })
    }
  },

  saveToken: async (channelId: string, accountId: string, token: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.channels.saveToken(channelId, accountId, token)

      if (result.ok) {
        await get().refresh()
        toast.success('Channel connected')
        return { ok: true }
      } else {
        set({ error: result.error ?? 'Failed to save token' })
        toast.error('Failed to connect channel', { description: result.error })
        return { ok: false, error: result.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to connect channel', { description: message })
      return { ok: false, error: message }
    }
  },

  removeToken: async (channelId: string, accountId: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.channels.removeToken(channelId, accountId)

      if (result.ok) {
        await get().refresh()
        toast.success('Channel removed')
        return { ok: true }
      } else {
        set({ error: result.error ?? 'Failed to remove token' })
        toast.error('Failed to remove channel', { description: result.error })
        return { ok: false, error: result.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to remove channel', { description: message })
      return { ok: false, error: message }
    }
  },

  stopChannel: async (channelId: string, accountId: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.channels.stop(channelId, accountId)

      if (result.ok) {
        await get().refresh()
        toast.success('Channel stopped')
        return { ok: true }
      } else {
        set({ error: result.error ?? 'Failed to stop channel' })
        toast.error('Failed to stop channel', { description: result.error })
        return { ok: false, error: result.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to stop channel', { description: message })
      return { ok: false, error: message }
    }
  },

  startChannel: async (channelId: string, accountId: string) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.channels.start(channelId, accountId)

      if (result.ok) {
        await get().refresh()
        toast.success('Channel started')
        return { ok: true }
      } else {
        set({ error: result.error ?? 'Failed to start channel' })
        toast.error('Failed to start channel', { description: result.error })
        return { ok: false, error: result.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to start channel', { description: message })
      return { ok: false, error: message }
    }
  },
}))
