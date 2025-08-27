"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = () => {
      const user = localStorage.getItem("user")
      if (!user) {
        router.replace("/login")
      } else {
        try {
          JSON.parse(user)
          setIsAuthenticated(true)
        } catch {
          localStorage.removeItem("user")
          router.replace("/login")
        }
      }
    }

    checkAuth()
  }, [router])

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}