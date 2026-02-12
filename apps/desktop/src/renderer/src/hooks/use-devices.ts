import { useState, useEffect, useCallback } from 'react'
import { toast } from '@multica/ui/components/ui/sonner'

// Minimum loading time for user perception (ms)
const MIN_LOADING_TIME = 600

export interface DeviceMeta {
  userAgent?: string
  platform?: string
  language?: string
  clientName?: string
}

export interface DeviceEntry {
  deviceId: string
  agentId: string
  addedAt: number
  meta?: DeviceMeta
}

export interface UseDevicesReturn {
  devices: DeviceEntry[]
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
  revokeDevice: (deviceId: string) => Promise<boolean>
}

export function useDevices(): UseDevicesReturn {
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Initial fetch (silent, no toast)
  const fetchDevices = useCallback(async () => {
    try {
      const list = await window.electronAPI?.hub.listDevices()
      setDevices((list as DeviceEntry[]) ?? [])
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Manual refresh (with feedback)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    const startTime = Date.now()

    try {
      const list = await window.electronAPI?.hub.listDevices()

      // Ensure minimum loading time for user perception
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
      }

      setDevices((list as DeviceEntry[]) ?? [])
      toast.success('Device list refreshed')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Failed to refresh devices', { description: message })
      console.error('Failed to refresh devices:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const revokeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI?.hub.revokeDevice(deviceId)
      if (result?.ok) {
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
        toast.success('Device removed')
        return true
      }
      toast.error('Failed to remove device')
      return false
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Failed to remove device', { description: message })
      console.error('Failed to revoke device:', err)
      return false
    }
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  // Subscribe to device list changes pushed from main process (silent refresh)
  useEffect(() => {
    window.electronAPI?.hub.onDevicesChanged(() => {
      fetchDevices()
    })
    return () => {
      window.electronAPI?.hub.offDevicesChanged()
    }
  }, [fetchDevices])

  return { devices, loading, refreshing, refresh, revokeDevice }
}
