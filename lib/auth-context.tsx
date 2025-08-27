"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  fullName: string
  full_name?: string
  phone?: string
  user_type?: string
  role?: {
    id: string
    name: string
  }
  permissions?: string[]
}

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  
  const setUser = (newUser: User | null) => {
    console.log('[AuthContext] setUser called with:', newUser)
    setUserState(newUser)
  }

  useEffect(() => {
    console.log('[AuthContext] Checking for stored user data')
    // Check for stored user data on component mount
    const storedUser = localStorage.getItem('user')
    console.log('[AuthContext] Stored user data:', storedUser)
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        console.log('[AuthContext] Parsed user:', parsedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error('[AuthContext] Error parsing stored user data:', error)
        localStorage.removeItem('user')
      }
    } else {
      console.log('[AuthContext] No stored user data found')
    }
  }, [])

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}