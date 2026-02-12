import { useState, useEffect } from "react";
import { cn } from "@multica/ui/lib/utils";

interface MulticaIconProps extends React.ComponentProps<"span"> {
  /**
   * If true, play a one-time entrance spin animation.
   */
  animate?: boolean;
  /**
   * If true, disable hover spin animation.
   */
  noSpin?: boolean;
  /**
   * If true, show a border around the icon.
   */
  bordered?: boolean;
}

/**
 * Pure CSS 8-pointed asterisk icon matching the Multica logo.
 * Uses currentColor so it adapts to light/dark themes automatically.
 * Clip-path polygon traced from the original SVG path coordinates.
 */
export function MulticaIcon({
  className,
  animate = false,
  noSpin = false,
  bordered = false,
  ...props
}: MulticaIconProps) {
  const [entranceDone, setEntranceDone] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setEntranceDone(true), 600);
    return () => clearTimeout(timer);
  }, [animate]);

  if (bordered) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center p-1.5 border border-border rounded-md",
          className
        )}
        aria-hidden="true"
        {...props}
      >
        <span
          className={cn(
            "block size-3.5",
            !entranceDone && "animate-entrance-spin",
            entranceDone && !noSpin && "hover:animate-spin"
          )}
        >
          <span
            className="block size-full bg-current"
            style={{
              clipPath: `polygon(
                45% 62.1%, 45% 100%, 55% 100%, 55% 62.1%,
                81.8% 88.9%, 88.9% 81.8%, 62.1% 55%, 100% 55%,
                100% 45%, 62.1% 45%, 88.9% 18.2%, 81.8% 11.1%,
                55% 37.9%, 55% 0%, 45% 0%, 45% 37.9%,
                18.2% 11.1%, 11.1% 18.2%, 37.9% 45%, 0% 45%,
                0% 55%, 37.9% 55%, 11.1% 81.8%, 18.2% 88.9%
              )`,
            }}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block size-[1em]",
        !entranceDone && "animate-entrance-spin",
        entranceDone && !noSpin && "hover:animate-spin",
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <span
        className="block size-full bg-current"
        style={{
          clipPath: `polygon(
            45% 62.1%, 45% 100%, 55% 100%, 55% 62.1%,
            81.8% 88.9%, 88.9% 81.8%, 62.1% 55%, 100% 55%,
            100% 45%, 62.1% 45%, 88.9% 18.2%, 81.8% 11.1%,
            55% 37.9%, 55% 0%, 45% 0%, 45% 37.9%,
            18.2% 11.1%, 11.1% 18.2%, 37.9% 45%, 0% 45%,
            0% 55%, 37.9% 55%, 11.1% 81.8%, 18.2% 88.9%
          )`,
        }}
      />
    </span>
  );
}
