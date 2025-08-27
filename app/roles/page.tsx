'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { CommonHeader } from '@/components/common-header'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, UserCog, Loader2, Settings } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Badge } from '@/components/ui/badge'

interface Role {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
  _count?: {
    user_roles: number
  }
}

export default function RolesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const isTablet = useMediaQuery('(max-width: 768px)')
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [assigningRoles, setAssigningRoles] = useState(false)
  const [assignmentResult, setAssignmentResult] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [initializationResult, setInitializationResult] = useState<string | null>(null)
  
  // Add immediate check for localStorage
  useEffect(() => {
    console.log('[RolesPage] Component mounted, checking localStorage immediately')
    const storedUser = localStorage.getItem('user')
    console.log('[RolesPage] localStorage user:', storedUser)
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      console.log('[RolesPage] Parsed localStorage user:', parsed)
      if (parsed.user_type === 'admin') {
        console.log('[RolesPage] User is admin from localStorage, preventing redirect')
        setIsInitialized(true)
      }
    }
  }, [])

  useEffect(() => {
    console.log('[RolesPage] Main useEffect triggered, user:', user, 'isInitialized:', isInitialized)
    
    // If we haven't checked localStorage yet, wait
    if (!isInitialized && !user) {
      console.log('[RolesPage] Waiting for initialization...')
      return
    }
    
    if (!user && !isInitialized) {
      console.log('[RolesPage] No user found after initialization, redirecting to login')
      router.push('/login')
      return
    }

    // If we have a user from context, use it
    if (user) {
      console.log('[RolesPage] User type:', user.user_type)
      if (user.user_type !== 'admin') {
        console.log('[RolesPage] User is not admin, showing error message')
        setErrorMessage('Access Denied: This page is only accessible to administrators.')
        setLoading(false)
        return
      }

      console.log('[RolesPage] User is admin, fetching roles')
      fetchRoles()
    } else if (isInitialized) {
      // User from localStorage is admin, fetch roles
      console.log('[RolesPage] Initialized from localStorage, fetching roles')
      fetchRoles()
    }
  }, [user, router, isInitialized])

  const fetchRoles = async () => {
    try {
      console.log('[RolesPage] fetchRoles started')
      const userData = localStorage.getItem('user')
      console.log('[RolesPage] userData from localStorage:', userData)
      
      if (!userData) {
        console.log('[RolesPage] No userData in localStorage')
        setErrorMessage('Not authenticated')
        setLoading(false)
        return
      }

      const parsedUser = JSON.parse(userData)
      console.log('[RolesPage] parsedUser:', parsedUser)
      console.log('[RolesPage] Making API request to /api/roles')
      
      const response = await fetch('/api/roles', {
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`
        }
      })
      
      console.log('[RolesPage] Response status:', response.status)
      console.log('[RolesPage] Response ok:', response.ok)
      
      const data = await response.json()
      console.log('[RolesPage] Response data:', data)
      
      if (data.error && data.error.includes('table not found')) {
        console.log('[RolesPage] Database tables not found error')
        setErrorMessage('Database tables not set up. Please run the migration SQL in Supabase.')
        setRoles([])
      } else if (!response.ok) {
        console.log('[RolesPage] Response not ok, error:', data.error)
        throw new Error(data.error || 'Failed to fetch roles')
      } else {
        console.log('[RolesPage] Roles fetched successfully:', data)
        setRoles(data.roles || data || [])
        setErrorMessage('')
      }
    } catch (error) {
      console.error('[RolesPage] Error fetching roles:', error)
      setErrorMessage('Failed to load roles')
    } finally {
      console.log('[RolesPage] fetchRoles completed')
      setLoading(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!deleteRoleId) return

    try {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setErrorMessage('Not authenticated')
        return
      }

      const parsedUser = JSON.parse(userData)
      const response = await fetch(`/api/roles/${deleteRoleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete role')
      }

      setRoles(roles.filter(role => role.id !== deleteRoleId))
      setDeleteRoleId(null)
    } catch (error) {
      console.error('Error deleting role:', error)
      setErrorMessage('Failed to delete role')
    }
  }

  const handleAssignAdminRoles = async () => {
    setAssigningRoles(true)
    setAssignmentResult(null)

    try {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setErrorMessage('Not authenticated')
        return
      }

      const parsedUser = JSON.parse(userData)
      const response = await fetch('/api/roles/assign-admin-roles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign admin roles')
      }

      // Show success message with details
      const { summary } = result
      const message = `✅ Admin roles assigned successfully!\n• ${summary.assigned_count} admin users assigned Super Admin role\n• ${summary.skipped_count} already had the role\n• ${summary.failed_count} failed assignments`
      
      setAssignmentResult(message)
      
      // Refresh the roles list to show updated user counts
      await fetchRoles()
    } catch (error) {
      console.error('Error assigning admin roles:', error)
      setAssignmentResult(`❌ Failed to assign admin roles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAssigningRoles(false)
    }
  }

  const handleInitializeRoles = async () => {
    setInitializing(true)
    setInitializationResult(null)

    try {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setErrorMessage('Not authenticated')
        return
      }

      const parsedUser = JSON.parse(userData)
      const response = await fetch('/api/roles/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize roles system')
      }

      // Show success message with details
      const { operations, summary } = result
      const message = `✅ Roles system initialized successfully!\n• ${summary.roles_created} roles created\n• ${summary.permissions_created} permission sets created\n• ${summary.users_assigned} admin users assigned\n\nDetails:\n${operations.join('\n')}`
      
      setInitializationResult(message)
      
      // Refresh the roles list
      await fetchRoles()
    } catch (error) {
      console.error('Error initializing roles system:', error)
      setInitializationResult(`❌ Failed to initialize roles system: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setInitializing(false)
    }
  }

  if (loading) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader searchPlaceholder="Search roles..." />
          <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (errorMessage) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader searchPlaceholder="Search roles..." />
          <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-500 font-semibold mb-4">{errorMessage}</p>
                {user?.user_type !== 'admin' && (
                  <Button onClick={() => router.push('/')}>
                    Go to Dashboard
                  </Button>
                )}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader searchPlaceholder="Search roles..." />
        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Role Management</h1>
              <p className="text-muted-foreground">Manage user roles and permissions</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={handleInitializeRoles}
                disabled={initializing}
              >
                {initializing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Initialize System
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleAssignAdminRoles}
                disabled={assigningRoles}
              >
                {assigningRoles ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserCog className="mr-2 h-4 w-4" />
                    Auto-Assign Admin Roles
                  </>
                )}
              </Button>
              <Button onClick={() => router.push('/roles/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Role
              </Button>
            </div>
          </div>

          {initializationResult && (
            <div className={`mb-4 p-4 rounded-lg border ${
              initializationResult.includes('❌') 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <pre className="whitespace-pre-wrap text-sm">{initializationResult}</pre>
            </div>
          )}

          {assignmentResult && (
            <div className={`mb-4 p-4 rounded-lg border ${
              assignmentResult.includes('❌') 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <pre className="whitespace-pre-wrap text-sm">{assignmentResult}</pre>
            </div>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? 'default' : 'secondary'}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{role._count?.user_roles || 0} users</TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/roles/${role.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRoleId(role.id)}
                          disabled={role.name === 'Super Admin' || role.name === 'Customer'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this role? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRole}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}