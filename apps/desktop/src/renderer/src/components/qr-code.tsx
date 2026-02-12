import { useState, useEffect, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@multica/ui/components/ui/button'
import { RefreshCw, CheckCircle, Copy } from 'lucide-react'

export interface QRCodeData {
  type: 'multica-connect'
  gateway: string
  hubId: string
  agentId: string
  token: string
  expires: number
}

export interface ConnectionQRCodeProps {
  gateway: string
  hubId: string
  agentId: string
  /** QR code expiry time in seconds (default: 30) */
  expirySeconds?: number
  /** Size of the QR code in pixels (default: 180) */
  size?: number
  /** Callback when token is refreshed */
  onRefresh?: (data: QRCodeData) => void
}

/**
 * Generate a secure random token for QR code authentication
 */
function generateToken(): string {
  return crypto.randomUUID()
}

/**
 * ConnectionQRCode - A QR code component for sharing Agent connection info
 *
 * Features:
 * - Generates time-limited tokens for secure connections
 * - Countdown timer showing expiry time
 * - Refresh button to generate new token
 * - Copy link button for manual sharing
 * - Decorative corner accents for visual polish
 */
export function ConnectionQRCode({
  gateway,
  hubId,
  agentId,
  expirySeconds = 30,
  size = 180,
  onRefresh,
}: ConnectionQRCodeProps) {
  const [token, setToken] = useState(generateToken)
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + expirySeconds * 1000)
  const [remainingSeconds, setRemainingSeconds] = useState(expirySeconds)
  const [copied, setCopied] = useState(false)

  // Register initial token with Hub on mount
  useEffect(() => {
    window.electronAPI?.hub.registerToken(token, agentId, expiresAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, [])

  // QR code data payload
  const qrData: QRCodeData = useMemo(
    () => ({
      type: 'multica-connect',
      gateway,
      hubId,
      agentId,
      token,
      expires: expiresAt,
    }),
    [gateway, hubId, agentId, token, expiresAt]
  )

  // URL format for the connection
  const connectionUrl = useMemo(() => {
    const params = new URLSearchParams({
      gateway,
      hub: hubId,
      agent: agentId,
      token,
      exp: expiresAt.toString(),
    })
    return `multica://connect?${params.toString()}`
  }, [gateway, hubId, agentId, token, expiresAt])

  // Refresh token handler
  const handleRefresh = useCallback(() => {
    const newToken = generateToken()
    const newExpires = Date.now() + expirySeconds * 1000

    setToken(newToken)
    setExpiresAt(newExpires)
    setRemainingSeconds(expirySeconds)

    // Register new token with Hub for verification
    window.electronAPI?.hub.registerToken(newToken, agentId, newExpires)

    if (onRefresh) {
      onRefresh({
        type: 'multica-connect',
        gateway,
        hubId,
        agentId,
        token: newToken,
        expires: newExpires,
      })
    }
  }, [gateway, hubId, agentId, expirySeconds, onRefresh])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setRemainingSeconds(remaining)

      // Auto-refresh when expired
      if (remaining === 0) {
        handleRefresh()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, handleRefresh])

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  // Format remaining time as M:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Warning state when less than 1 minute remaining
  const isExpiringSoon = remainingSeconds < 60 && remainingSeconds > 0
  const isExpired = remainingSeconds === 0

  return (
    <div className="flex flex-col items-center">
      {/* QR Code with decorative corners */}
      <div className="relative">
        {/* Corner accents */}
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-primary/60 rounded-tl-lg" />
        <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-primary/60 rounded-tr-lg" />
        <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-primary/60 rounded-bl-lg" />
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-primary/60 rounded-br-lg" />

        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <QRCodeSVG
            value={JSON.stringify(qrData)}
            size={size}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
          />
        </div>

        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="mt-4 space-y-2">
        {/* Expiry timer */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono ${
              isExpiringSoon
                ? 'text-orange-500 dark:text-orange-400'
                : isExpired
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-muted-foreground'
            }`}
          >
            {isExpired ? 'Expired' : `Expires in ${formatTime(remainingSeconds)}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={isExpired ? handleRefresh : handleCopyLink}
          >
            {isExpired ? (
              <RefreshCw className="size-3.5 mr-1" />
            ) : copied ? (
              <CheckCircle className="size-3.5 mr-1" />
            ) : (
              <Copy className="size-3.5 mr-1" />
            )}
            {isExpired ? 'Refresh' : (copied ? 'Copied!' : 'Copy Link')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionQRCode
