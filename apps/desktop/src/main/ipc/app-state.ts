/**
 * App State IPC handlers for Electron main process.
 *
 * Manages application-level state like onboarding status.
 * State is persisted to ~/.super-multica/app-state.json
 */
import { ipcMain } from 'electron'
import { appStateManager } from '@multica/core'

/**
 * Register all App State IPC handlers.
 */
export function registerAppStateIpcHandlers(): void {
  /**
   * Get onboarding completed status.
   */
  ipcMain.handle('appState:getOnboardingCompleted', async (): Promise<boolean> => {
    return appStateManager.getOnboardingCompleted()
  })

  /**
   * Set onboarding completed status.
   */
  ipcMain.handle(
    'appState:setOnboardingCompleted',
    async (_event, completed: boolean): Promise<void> => {
      appStateManager.setOnboardingCompleted(completed)
      console.log(`[IPC] Onboarding completed set to: ${completed}`)
    }
  )
}
