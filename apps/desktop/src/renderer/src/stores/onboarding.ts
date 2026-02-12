import { create } from "zustand"

interface AcknowledgementsState {
  fileSystem: boolean
  shellExecution: boolean
  llmRequests: boolean
  localStorage: boolean
}

interface OnboardingStore {
  // Persisted state (loaded from file system via IPC)
  completed: boolean
  // Transient state (reset on page reload)
  currentStep: number
  acknowledgements: AcknowledgementsState
  allAcknowledged: boolean
  providerConfigured: boolean
  clientConnected: boolean
  // Actions
  setCompleted: (completed: boolean) => void
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setAcknowledgement: (key: keyof AcknowledgementsState, value: boolean) => void
  setProviderConfigured: (configured: boolean) => void
  setClientConnected: (connected: boolean) => void
  completeOnboarding: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => ({
  // Initial state - will be hydrated from file system on app start
  completed: false,
  currentStep: 0,

  acknowledgements: {
    fileSystem: false,
    shellExecution: false,
    llmRequests: false,
    localStorage: false,
  },
  allAcknowledged: false,
  providerConfigured: false,
  clientConnected: false,

  setCompleted: (completed) => set({ completed }),

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set({ currentStep: Math.min(get().currentStep + 1, 4) }),
  prevStep: () => set({ currentStep: Math.max(get().currentStep - 1, 0) }),

  setAcknowledgement: (key, value) => {
    const acknowledgements = { ...get().acknowledgements, [key]: value }
    const allAcknowledged = Object.values(acknowledgements).every(Boolean)
    set({ acknowledgements, allAcknowledged })
  },

  setProviderConfigured: (configured) => set({ providerConfigured: configured }),

  setClientConnected: (connected) => set({ clientConnected: connected }),

  completeOnboarding: async () => {
    // Persist to file system via IPC
    await window.electronAPI.appState.setOnboardingCompleted(true)
    // Update local state
    set({ completed: true, currentStep: 0 })
  },
}))
