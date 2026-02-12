import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@multica/ui/components/ui/dialog'
import { Button } from '@multica/ui/components/ui/button'
import { Input } from '@multica/ui/components/ui/input'
import { Label } from '@multica/ui/components/ui/label'
import { Loader2, Key, Check } from 'lucide-react'

type Phase = 'input' | 'saving' | 'testing' | 'success' | 'error'

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  providerName: string
  showModelInput?: boolean
  onSuccess?: (modelId?: string) => void
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerId,
  providerName,
  showModelInput,
  onSuccess,
}: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [error, setError] = useState<string | null>(null)

  const busy = phase === 'saving' || phase === 'testing'

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }

    if (showModelInput && !modelId.trim()) {
      setError('Please enter a model name')
      return
    }

    setError(null)
    setPhase('saving')

    try {
      const result = await window.electronAPI.provider.saveApiKey(providerId, apiKey.trim())
      if (!result.ok) {
        setError(result.error ?? 'Failed to save API key')
        setPhase('error')
        return
      }

      // Test the connection
      setPhase('testing')
      const effectiveModel = showModelInput && modelId.trim() ? modelId.trim() : undefined
      const testResult = await window.electronAPI.provider.test(providerId, effectiveModel)

      if (!testResult.ok) {
        setError(testResult.error ?? 'Connection test failed')
        setPhase('error')
        return
      }

      setPhase('success')
      // Auto-close after brief success display
      setTimeout(() => {
        setApiKey('')
        setModelId('')
        setPhase('input')
        setError(null)
        onOpenChange(false)
        onSuccess?.(effectiveModel)
      }, 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setPhase('error')
    }
  }

  const handleRetry = () => {
    setError(null)
    setPhase('input')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !busy) {
      setApiKey('')
      setModelId('')
      setPhase('input')
      setError(null)
    }
    if (!busy) {
      onOpenChange(isOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Configure {providerName}
          </DialogTitle>
          <DialogDescription>
            Enter your API key to enable {providerName}. The key will be saved and tested automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              disabled={busy || phase === 'success'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) {
                  handleSave()
                }
              }}
            />
          </div>

          {showModelInput && (
            <div className="space-y-2">
              <Label htmlFor="model-id">Model</Label>
              <Input
                id="model-id"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. anthropic/claude-sonnet-4-5"
                disabled={busy || phase === 'success'}
              />
            </div>
          )}

          {/* Status messages */}
          {phase === 'saving' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Saving API key...
            </div>
          )}

          {phase === 'testing' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Testing connection...
            </div>
          )}

          {phase === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="size-4" />
              Connected successfully!
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in <code className="bg-muted px-1 rounded">~/.super-multica/credentials.json5</code>
          </p>
        </div>

        <DialogFooter>
          {phase === 'error' ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleRetry}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={busy || phase === 'success'}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={busy || phase === 'success' || !apiKey.trim() || (showModelInput && !modelId.trim())}
              >
                Save & Test
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ApiKeyDialog
