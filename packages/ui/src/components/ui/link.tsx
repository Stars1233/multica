import * as React from "react"
import { cn } from "@multica/ui/lib/utils"

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  external?: boolean
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, external = true, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          "text-primary underline-offset-4 hover:underline cursor-pointer transition-colors",
          className
        )}
        {...(external && {
          target: "_blank",
          rel: "noopener noreferrer",
        })}
        {...props}
      >
        {children}
      </a>
    )
  }
)
Link.displayName = "Link"

export { Link }
