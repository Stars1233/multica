import { create } from 'zustand'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 800

interface ProviderStore {
  // State
  providers: ProviderStatus[]
  current: CurrentProviderInfo | null
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetch: () => Promise<void>
  setProvider: (providerId: string, modelId?: string, options?: { silent?: boolean }) => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

export const useProviderStore = create<ProviderStore>()((set, get) => ({
  providers: [],
  current: null,
  loading: false,
  error: null,
  initialized: false,

  fetch: async () => {
    // Skip if already initialized
    if (get().initialized) return

    set({ loading: true, error: null })

    try {
      const [providerList, currentInfo] = await Promise.all([
        window.electronAPI.provider.list(),
        window.electronAPI.provider.current(),
      ])

      set({
        providers: providerList,
        current: currentInfo,
        initialized: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      console.error('[ProviderStore] Failed to load providers:', message)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    set({ loading: true, error: null })

    const startTime = Date.now()

    try {
      const [providerList, currentInfo] = await Promise.all([
        window.electronAPI.provider.list(),
        window.electronAPI.provider.current(),
      ])

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      set({
        providers: providerList,
        current: currentInfo,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      toast.error('Failed to refresh providers', { description: message })
      console.error('[ProviderStore] Failed to refresh providers:', message)
    } finally {
      set({ loading: false })
    }
  },

  setProvider: async (providerId: string, modelId?: string, options?: { silent?: boolean }) => {
    set({ error: null })

    try {
      const result = await window.electronAPI.provider.set(providerId, modelId)

      if (result.ok) {
        // Quick refresh without minimum delay for setProvider
        const [providerList, currentInfo] = await Promise.all([
          window.electronAPI.provider.list(),
          window.electronAPI.provider.current(),
        ])
        set({ providers: providerList, current: currentInfo })

        // Find provider name for toast
        if (!options?.silent) {
          const provider = providerList.find(p => p.id === providerId)
          toast.success(`Switched to ${provider?.name ?? providerId}`)
        }
        return { ok: true }
      } else {
        set({ error: result.error ?? 'Unknown error' })
        if (!options?.silent) {
          toast.error('Failed to switch provider', { description: result.error })
        }
        return { ok: false, error: result.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message })
      if (!options?.silent) {
        toast.error('Failed to switch provider', { description: message })
      }
      return { ok: false, error: message }
    }
  },
}))

// Selector helpers
export const selectAvailableProviders = (providers: ProviderStatus[]) =>
  providers.filter(p => p.available)

export const selectProviderById = (providers: ProviderStatus[], id: string) =>
  providers.find(p => p.id === id)
