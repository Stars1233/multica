import { useEffect, useState } from 'react'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import { TooltipProvider } from '@multica/ui/components/ui/tooltip'
import { Toaster } from './components/toaster'
import Layout from './pages/layout'
import HomePage from './pages/home'
import ChatPage from './pages/chat'
import ToolsPage from './pages/tools'
import SkillsPage from './pages/skills'
import ChannelsPage from './pages/channels'
import CronsPage from './pages/crons'
import OnboardingPage from './pages/onboarding'
import { useOnboardingStore } from './stores/onboarding'
import { useHubStore } from './stores/hub'
import { useProviderStore } from './stores/provider'
import { useChannelsStore } from './stores/channels'
import { useSkillsStore } from './stores/skills'
import { useToolsStore } from './stores/tools'
import { useCronJobsStore } from './stores/cron-jobs'

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const completed = useOnboardingStore((s) => s.completed)
  if (!completed) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <OnboardingGuard>
            <HomePage />
          </OnboardingGuard>
        ),
      },
      { path: 'chat', element: <ChatPage /> },
      { path: 'tools', element: <ToolsPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'channels', element: <ChannelsPage /> },
      { path: 'crons', element: <CronsPage /> },
    ],
  },
])

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false)
  const setCompleted = useOnboardingStore((s) => s.setCompleted)

  useEffect(() => {
    // Load onboarding state from file system
    async function hydrateOnboardingState() {
      try {
        const completed = await window.electronAPI.appState.getOnboardingCompleted()
        setCompleted(completed)
      } catch (err) {
        console.error('[App] Failed to load onboarding state:', err)
        // Default to false if load fails
        setCompleted(false)
      } finally {
        setIsHydrated(true)
      }
    }

    hydrateOnboardingState()

    // Initialize hub and prefetch global data at app startup
    useHubStore.getState().init()
    useProviderStore.getState().fetch()
    useChannelsStore.getState().fetch()
    useSkillsStore.getState().fetch()
    useToolsStore.getState().fetch()
    useCronJobsStore.getState().fetch()
  }, [setCompleted])

  // Show nothing while loading onboarding state to prevent flash
  if (!isHydrated) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="multica-theme">
        <div className="h-dvh bg-background" />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="multica-theme">
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
