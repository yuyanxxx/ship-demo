import * as React from "react"

const TABLET_MIN_BREAKPOINT = 768
const TABLET_MAX_BREAKPOINT = 1366 // Include resolutions up to 1366px

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${TABLET_MIN_BREAKPOINT}px) and (max-width: ${TABLET_MAX_BREAKPOINT}px)`)
    const onChange = () => {
      const width = window.innerWidth
      setIsTablet(width >= TABLET_MIN_BREAKPOINT && width <= TABLET_MAX_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    const width = window.innerWidth
    setIsTablet(width >= TABLET_MIN_BREAKPOINT && width <= TABLET_MAX_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isTablet
}