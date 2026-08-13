import * as React from "react"
import { isMobileViewport } from "@/lib/deviceViewport"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => isMobileViewport())

  React.useEffect(() => {
    const onChange = () => setIsMobile(isMobileViewport())
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    onChange()
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return isMobile
}
