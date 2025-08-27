"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from '@supabase/supabase-js'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Create Supabase client for auth operations (uses default email service)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function ResetPasswordFormContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isValidSession, setIsValidSession] = useState(false)

  useEffect(() => {
    // Handle Supabase's default auth callback for password reset
    const handleAuthCallback = async () => {
      // Check for auth hash/fragment in URL (Supabase default behavior)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (type === 'recovery' && accessToken && refreshToken) {
        // Set the session using the tokens from URL
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (setSessionError) {
          console.error('Error setting session:', setSessionError)
          setError('Invalid or expired reset link. Please request a new password reset.')
          return
        }

        setIsValidSession(true)
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        // Check if we already have a valid session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setError('Invalid or expired reset link. Please request a new password reset.')
          return
        }
        
        setIsValidSession(true)
      }
    }

    handleAuthCallback()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    try {
      // Use Supabase's updateUser method to update the password
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (error) {
        console.error('Password update error:', error)
        setError('Failed to reset password. Please try again.')
        return
      }

      setMessage('Password has been reset successfully! Redirecting to login...')
      setFormData({ password: "", confirmPassword: "" })
      
      // Sign out the user and redirect to login after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }, 2000)

    } catch (error) {
      setError('Network error. Please try again.')
      console.error('Reset password error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (!isValidSession && !error) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardContent className="p-8 text-center">
            <p>Validating reset link...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Reset your password</h1>
                <p className="text-muted-foreground text-balance">
                  Enter your new password below.
                </p>
              </div>
              
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm">
                  {error}
                </div>
              )}

              {message && (
                <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-sm">
                  {message}
                  <br />
                  <span className="text-xs">Redirecting to login page...</span>
                </div>
              )}

              {!message && (
                <>
                  <div className="grid gap-3">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter your new password"
                      value={formData.password}
                      onChange={handleChange}
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                      required
                    />
                  </div>

                  <div className="grid gap-3">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm your new password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading || !isValidSession}>
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </>
              )}

              <div className="text-center text-sm">
                <a href="/login" className="text-primary hover:underline">
                  Back to login
                </a>
              </div>
            </div>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="/placeholder.svg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-center text-xs text-balance">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </div>
    </div>
  )
}

export function ResetPasswordForm(props: React.ComponentProps<"div">) {
  return (
    <Suspense fallback={
      <div className={cn("flex flex-col gap-6", props.className)}>
        <Card>
          <CardContent className="p-8 text-center">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordFormContent {...props} />
    </Suspense>
  )
}