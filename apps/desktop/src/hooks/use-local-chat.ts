/**
 * Hook for local direct chat with agent via IPC (no Gateway required).
 *
 * This hook bridges IPC events to useMessagesStore, allowing the Chat component
 * to work identically in both local IPC and remote Gateway modes.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useMessagesStore } from '@multica/store'

interface UseLocalChatOptions {
  agentId: string
}

interface UseLocalChatReturn {
  isConnected: boolean
  isLoading: boolean
  sendMessage: (content: string) => void
  disconnect: () => void
}

/**
 * Provides local IPC chat that uses the same useMessagesStore as Gateway mode.
 * This enables full Chat component reuse.
 */
export function useLocalChat({ agentId }: UseLocalChatOptions): UseLocalChatReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const currentStreamRef = useRef<string | null>(null)

  // Subscribe to agent events on mount
  useEffect(() => {
    if (!agentId) return

    const subscribe = async () => {
      const result = await window.electronAPI.localChat.subscribe(agentId)
      if (result.ok) {
        setIsConnected(true)
      }
    }

    subscribe()

    // Load message history from agent session
    const loadHistory = async () => {
      try {
        const result = await window.electronAPI.localChat.getHistory(agentId)
        if (result.messages && result.messages.length > 0) {
          useMessagesStore.getState().loadMessages(result.messages)
        }
      } catch {
        // History load is best-effort
      }
    }
    loadHistory()

    // Listen for events and route to useMessagesStore
    window.electronAPI.localChat.onEvent((event) => {
      if (event.agentId !== agentId) return

      const store = useMessagesStore.getState()

      // Handle error
      if (event.type === 'error') {
        store.addAssistantMessage(event.content ?? 'Unknown error', agentId)
        setIsLoading(false)
        return
      }

      // Handle agent events - same logic as connection-store.ts
      const agentEvent = event.event
      const streamId = event.streamId
      if (!agentEvent || !streamId) return

      if (agentEvent.type === 'message_start') {
        currentStreamRef.current = streamId
        store.startStream(streamId, agentId)
        // Extract initial text if any
        const text = extractTextFromAgentEvent(agentEvent)
        if (text) store.appendStream(streamId, text)
      } else if (agentEvent.type === 'message_update') {
        const text = extractTextFromAgentEvent(agentEvent)
        if (text && currentStreamRef.current) {
          store.appendStream(currentStreamRef.current, text)
        }
      } else if (agentEvent.type === 'message_end') {
        const text = extractTextFromAgentEvent(agentEvent)
        if (currentStreamRef.current) {
          store.endStream(currentStreamRef.current, text)
          currentStreamRef.current = null
        }
        setIsLoading(false)
      }
    })

    return () => {
      window.electronAPI.localChat.offEvent()
      window.electronAPI.localChat.unsubscribe(agentId)
      setIsConnected(false)
    }
  }, [agentId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !agentId || isLoading) return

      // Add user message to store (same as Gateway mode)
      useMessagesStore.getState().addUserMessage(content.trim(), agentId)
      setIsLoading(true)

      // Send via IPC
      const result = await window.electronAPI.localChat.send(agentId, content.trim())
      if (result.error) {
        useMessagesStore.getState().addAssistantMessage(`Error: ${result.error}`, agentId)
        setIsLoading(false)
      }
    },
    [agentId, isLoading]
  )

  const disconnect = useCallback(() => {
    useMessagesStore.getState().clearMessages()
    setIsConnected(false)
    setIsLoading(false)
  }, [])

  return {
    isConnected,
    isLoading,
    sendMessage,
    disconnect,
  }
}

/**
 * Extract text content from AgentEvent message.
 * Same logic as @multica/sdk extractTextFromEvent.
 */
function extractTextFromAgentEvent(event: { message?: { content?: Array<{ type: string; text?: string }> } }): string {
  if (!event.message?.content) return ''
  return event.message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && !!c.text)
    .map((c) => c.text)
    .join('')
}
