import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { CheckCircle, Info, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { useTheme } from './theme-provider'

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4 text-emerald-500" />,
        info: <Info className="size-4 text-blue-500" />,
        warning: <AlertCircle className="size-4 text-amber-500" />,
        error: <XCircle className="size-4 text-red-500" />,
        loading: <Loader2 className="size-4 text-muted-foreground animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
