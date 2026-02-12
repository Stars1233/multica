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
import { Loader2, Terminal, RefreshCw, Check } from 'lucide-react'

interface OAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  providerName: string
  loginCommand?: string
  onSuccess?: () => void
}

export function OAuthDialog({
  open,
  onOpenChange,
  providerId,
  providerName,
  loginCommand,
  onSuccess,
}: OAuthDialogProps) {
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await window.electronAPI.provider.importOAuth(providerId)
      if (result.ok) {
        setSuccess(true)
        setExpiresAt(result.expiresAt ?? null)
        // Auto-close after a short delay
        setTimeout(() => {
          onOpenChange(false)
          onSuccess?.()
        }, 1500)
      } else {
        setError(result.error ?? 'Failed to import credentials')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setImporting(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setError(null)
      setSuccess(false)
      setExpiresAt(null)
    }
    onOpenChange(isOpen)
  }

  const formatExpiry = (timestamp: number) => {
    const remaining = timestamp - Date.now()
    if (remaining <= 0) return 'expired'
    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5" />
            Configure {providerName}
          </DialogTitle>
          <DialogDescription>
            {providerName} uses OAuth authentication. Please log in via the command line first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Login instructions */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              1. Open your terminal and run:
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-sm">
              {loginCommand ?? `${providerId} login`}
            </div>
            <p className="text-sm text-muted-foreground">
              2. Complete the login process in your browser
            </p>
            <p className="text-sm text-muted-foreground">
              3. Click "Refresh" below to import your credentials
            </p>
          </div>

          {/* Status messages */}
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-md p-3 text-sm flex items-center gap-2">
              <Check className="size-4" />
              <span>
                Credentials imported successfully!
                {expiresAt && ` (expires in ${formatExpiry(expiresAt)})`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || success}>
            {importing ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="size-4 mr-2" />
            )}
            Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OAuthDialog
