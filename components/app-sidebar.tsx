"use client"

import * as React from "react"
import { GalleryVerticalEnd, type LucideIcon } from "lucide-react"
import { MENU_STRUCTURE, type MenuItem } from "@/lib/menu-structure"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  user_type?: string
  role?: {
    id: string
    name: string
  }
  permissions?: string[]
}


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<User | null>(null)
  const [userPermissions, setUserPermissions] = React.useState<string[]>([])
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "FTK Logistics"

  React.useEffect(() => {
    // Load user data from localStorage
    const loadUserData = async () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser)
          setUser(userData)
          
          // If user is admin, fetch their role permissions
          if (userData.user_type === 'admin') {
            await fetchUserPermissions(userData.id)
          }
        } catch (error) {
          console.error('Error parsing user data:', error)
        }
      }
    }

    // Initial load
    loadUserData()

    // Listen for user data updates from Account page
    const handleUserDataUpdate = () => {
      loadUserData()
    }

    // Add event listener
    window.addEventListener('userDataUpdated', handleUserDataUpdate)

    // Cleanup event listener
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate)
    }
  }, [])

  const fetchUserPermissions = async (userId: string) => {
    try {
      console.log('Fetching permissions for admin user:', userId)
      const response = await fetch('/api/users/permissions', {
        headers: {
          'Authorization': `Bearer ${userId}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Permissions API response:', data)
        if (data.permissions && data.permissions.length > 0) {
          setUserPermissions(data.permissions)
          console.log('Successfully loaded user permissions:', data.permissions)
        } else {
          console.warn('No permissions returned from API, using empty array')
          setUserPermissions([]) // This will trigger fallback in filterNavItems
        }
      } else {
        console.error('Failed to fetch user permissions:', response.status, response.statusText)
        setUserPermissions([]) // This will trigger fallback in filterNavItems
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error)
      setUserPermissions([]) // This will trigger fallback in filterNavItems
    }
  }

  // Use the single source of truth for menu structure
  const allNavItems = MENU_STRUCTURE

  // Filter navigation items based on user permissions

  const filterNavItems = (items: MenuItem[]) => {
    // Determine which permissions to use
    let permissionsToCheck: string[] = []
    
    if (user?.user_type === 'admin') {
      // For admin users, use their role-based permissions
      if (userPermissions.length > 0) {
        permissionsToCheck = userPermissions
      } else {
        // Fallback: show all admin menus if permissions haven't loaded yet or failed to load
        // This prevents admin users from seeing a blank sidebar
        permissionsToCheck = [
          'dashboard', 'get-quote', 'orders', 'balance', 'saved-addresses', 'insurance',
          'insurance-quotes', 'insurance-certificates', 'customers', 'roles', 
          'payment-config', 'recharge-review', 'top-up-history', 'support'
        ]
        console.log('Admin user: Using fallback permissions due to no role permissions loaded')
      }
    } else {
      // For customer users, use their direct permissions or defaults
      if (user?.permissions && user.permissions.length > 0) {
        permissionsToCheck = user.permissions
      } else {
        // No permissions defined, show default customer menus
        permissionsToCheck = ['dashboard', 'get-quote', 'orders', 'balance', 'saved-addresses', 'insurance', 'insurance-quotes', 'insurance-certificates', 'support']
      }
    }

    // Filter based on permissions
    return items.filter(item => {
      if (permissionsToCheck.includes(item.key)) {
        // If parent menu is permitted, filter sub-items
        if (item.items) {
          item.items = item.items.filter((subItem) => 
            permissionsToCheck.includes(subItem.key)
          )
        }
        return true
      }
      return false
    })
  }

  const navItems = filterNavItems(allNavItems)

  const data = {
    user: {
      name: user?.full_name || "User",
      email: user?.email || "user@example.com",
      avatar: "",
    },
    teams: [
      {
        name: companyName,
        logo: GalleryVerticalEnd,
        plan: "",
      },
    ],
    navMain: navItems,
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NavMain items={data.navMain as any} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
