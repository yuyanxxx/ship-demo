"use client"

import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Search, User, Lock, Save } from "lucide-react"
import { useState, useEffect } from "react"
import { useIsTablet } from "@/hooks/use-tablet"

interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}


export default function AccountPage() {
  const isTablet = useIsTablet()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Full name editing state
  const [fullName, setFullName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [nameError, setNameError] = useState("")
  
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  
  // Real-time validation state
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(true)
  const [doPasswordsMatch, setDoPasswordsMatch] = useState(true)

  // Load user data and settings on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = localStorage.getItem('user')
        if (!storedUser) {
          setIsLoading(false)
          return
        }

        const userData = JSON.parse(storedUser)
        setUser(userData)
        setFullName(userData.full_name || "")
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [])

  const handleUpdateFullName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!fullName.trim() || fullName.trim().length < 2) {
      setNameError("Full name must be at least 2 characters long")
      return
    }

    setIsUpdatingName(true)
    setNameError("")

    try {
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          full_name: fullName.trim()
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Update user in state and localStorage
        const updatedUser = { ...user, full_name: fullName.trim() }
        setUser(updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
        
        // Trigger sidebar refresh
        window.dispatchEvent(new CustomEvent('userDataUpdated'))
      } else {
        setNameError(data.error || 'Failed to update full name')
      }
    } catch (error) {
      setNameError('Network error. Please try again.')
      console.error('Update full name error:', error)
    } finally {
      setIsUpdatingName(false)
    }
  }

  // Real-time password validation handlers
  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value
    setNewPassword(password)
    
    // Validate password length in real-time
    setIsNewPasswordValid(password.length >= 8 || password.length === 0)
    
    // Re-check password match when new password changes
    if (confirmPassword) {
      setDoPasswordsMatch(password === confirmPassword)
    }
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const confirmPass = e.target.value
    setConfirmPassword(confirmPass)
    
    // Validate password match in real-time
    setDoPasswordsMatch(newPassword === confirmPass || confirmPass === "")
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent any event bubbling that might trigger navigation
    
    if (!user) return

    // Reset states
    setPasswordError("")
    setPasswordSuccess("")

    // Validation
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setIsUpdatingPassword(true)

    try {
      const response = await fetch('/api/user/update-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          current_password: currentPassword,
          new_password: newPassword
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setPasswordSuccess("Password updated successfully. You remain logged in.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        // Reset validation states
        setIsNewPasswordValid(true)
        setDoPasswordsMatch(true)
        
        // Explicitly maintain login session - update user data timestamp
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            // Update the user data with current timestamp to indicate session refresh
            const updatedUserData = {
              ...userData,
              session_updated_at: new Date().toISOString(),
              password_updated_at: new Date().toISOString()
            }
            localStorage.setItem('user', JSON.stringify(updatedUserData))
            setUser(updatedUserData)
            
            // Notify other components that user session has been refreshed
            window.dispatchEvent(new CustomEvent('userDataUpdated'))
            
            console.log('User session maintained after password update')
          } catch (error) {
            console.error('Error updating user session data:', error)
            // Fallback: ensure user stays logged in even if session update fails
            console.log('Session update failed, but user remains logged in')
          }
        }
      } else {
        setPasswordError(data.error || 'Failed to update password')
      }
    } catch (error) {
      setPasswordError('Network error. Please try again.')
      console.error('Update password error:', error)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">Loading...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!user) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">Please log in to access your account.</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader />
        
        <div className="flex flex-1 flex-col gap-8 px-4 md:px-12 py-8 w-full xl:w-[70%] mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Account Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="grid gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="mt-1 bg-gray-50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>
                </div>

                <form onSubmit={handleUpdateFullName} className="space-y-4">
                  <div>
                    <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                      Full Name *
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                      placeholder="Enter your full name"
                    />
                    {nameError && (
                      <p className="text-sm text-red-600 mt-1">{nameError}</p>
                    )}
                  </div>
                  
                  <Button type="submit" disabled={isUpdatingName} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {isUpdatingName ? "Updating..." : "Update Name"}
                  </Button>
                </form>
              </CardContent>
            </Card>


            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                      Current Password *
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                      placeholder="Enter your current password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                      New Password *
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={handleNewPasswordChange}
                      className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                      placeholder="Enter your new password"
                    />
                    <p className={`text-xs mt-1 ${
                      newPassword.length > 0 && !isNewPasswordValid 
                        ? "text-red-600" 
                        : "text-gray-500"
                    }`}>
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirm New Password *
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      className={`mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm ${
                        confirmPassword.length > 0 && !doPasswordsMatch
                          ? "border-red-500 focus:border-red-500"
                          : ""
                      }`}
                      placeholder="Confirm your new password"
                    />
                    {confirmPassword.length > 0 && !doPasswordsMatch && (
                      <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  {passwordError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-sm">
                      {passwordSuccess}
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    disabled={isUpdatingPassword || !isNewPasswordValid || !doPasswordsMatch || newPassword.length === 0} 
                    className="flex items-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    {isUpdatingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </AuthGuard>
  )
}