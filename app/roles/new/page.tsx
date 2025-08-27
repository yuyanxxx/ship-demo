'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { CommonHeader } from '@/components/common-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMediaQuery } from '@/hooks/use-media-query'
import { ArrowLeft } from 'lucide-react'
import { getSerializableMenuStructure } from '@/lib/menu-structure'

// Get menu structure without icons for this page  
const MENU_STRUCTURE = getSerializableMenuStructure()

// Type for menu items
interface MenuItem {
  key: string
  title: string
  url?: string
  items?: MenuItem[]
}

export default function NewRolePage() {
  const { user } = useAuth()
  const router = useRouter()
  const isTablet = useMediaQuery('(max-width: 768px)')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    if (user.user_type !== 'admin') {
      router.push('/roles')
    }
  }, [user, router])

  const handleMenuToggle = (menuKey: string, parentKey?: string) => {
    const newSelected = new Set(selectedMenus)
    
    if (newSelected.has(menuKey)) {
      newSelected.delete(menuKey)
      const menuItem = MENU_STRUCTURE.find(m => m.key === menuKey)
      if (menuItem?.items) {
        menuItem.items.forEach(subItem => newSelected.delete(subItem.key))
      }
    } else {
      newSelected.add(menuKey)
      if (parentKey && !newSelected.has(parentKey)) {
        newSelected.add(parentKey)
      }
    }
    
    setSelectedMenus(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    const permissions: { menu_key: string; menu_title: string; parent_key: string | null; can_view: boolean }[] = []
    
    const processMenuItems = (items: MenuItem[], parentKey?: string) => {
      items.forEach(item => {
        if (selectedMenus.has(item.key)) {
          permissions.push({
            menu_key: item.key,
            menu_title: item.title,
            parent_key: parentKey || null,
            can_view: true
          })
        }
        
        if (item.items) {
          processMenuItems(item.items, item.key)
        }
      })
    }
    
    processMenuItems(MENU_STRUCTURE)

    try {
      const userData = localStorage.getItem('user')
      if (!userData) {
        setErrorMessage('Not authenticated')
        return
      }

      const parsedUser = JSON.parse(userData)
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parsedUser.id}`
        },
        body: JSON.stringify({
          ...formData,
          permissions
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create role')
      }

      setSuccessMessage('Role created successfully')
      setTimeout(() => {
        router.push('/roles')
      }, 1500)
    } catch (error) {
      console.error('Error creating role:', error)
      setErrorMessage('Failed to create role')
    } finally {
      setLoading(false)
    }
  }

  const renderMenuItem = (item: MenuItem, level = 0, parentKey?: string) => {
    const isSelected = selectedMenus.has(item.key)
    const hasSubItems = item.items && item.items.length > 0

    return (
      <div key={item.key} className={`${level > 0 ? 'ml-6' : ''}`}>
        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id={item.key}
            checked={isSelected}
            onCheckedChange={() => handleMenuToggle(item.key, parentKey)}
          />
          <label
            htmlFor={item.key}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {item.title}
          </label>
        </div>
        {hasSubItems && item.items?.map(subItem => renderMenuItem(subItem, level + 1, item.key))}
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader searchPlaceholder="Search..." />
        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push('/roles')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Roles
            </Button>
            <h1 className="text-2xl font-bold">Create New Role</h1>
            <p className="text-muted-foreground">Define a new role with specific permissions</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Information</CardTitle>
                <CardDescription>Basic details about the role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Role Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Sales Manager"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the purpose of this role"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Menu Permissions</CardTitle>
                <CardDescription>Select which menu items this role can access</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MENU_STRUCTURE.map(item => renderMenuItem(item))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/roles')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Role'}
              </Button>
            </div>
          </form>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}