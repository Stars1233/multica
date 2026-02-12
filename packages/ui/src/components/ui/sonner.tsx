"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"
import { CheckCircle, Info, AlertCircle, XCircle, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle className="size-4 text-emerald-500" />
        ),
        info: (
          <Info className="size-4 text-blue-500" />
        ),
        warning: (
          <AlertCircle className="size-4 text-amber-500" />
        ),
        error: (
          <XCircle className="size-4 text-red-500" />
        ),
        loading: (
          <Loader2 className="size-4 text-muted-foreground animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
