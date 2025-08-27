/**
 * Single source of truth for menu structure
 * No more duplicated bullshit across components
 */

import { 
  Home,
  Package,
  Calculator,
  Shield,
  MapPin,
  HelpCircle,
  Wallet,
  Users,
  UserCog,
  CreditCard,
  DollarSign,
  type LucideIcon
} from "lucide-react"

export interface MenuItem {
  key: string
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: MenuItem[]
}

export const MENU_STRUCTURE: MenuItem[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    isActive: true,
  },
  {
    key: "get-quote",
    title: "Quote",
    url: "/quotes",
    icon: Calculator,
  },
  {
    key: "orders",
    title: "Orders",
    url: "/orders",
    icon: Package,
  },
  {
    key: "balance",
    title: "Balance",
    url: "/balance",
    icon: Wallet,
  },
  {
    key: "saved-addresses",
    title: "Addresses",
    url: "/addresses",
    icon: MapPin,
  },
  {
    key: "insurance",
    title: "Insurance",
    url: "#",
    icon: Shield,
    items: [
      {
        key: "insurance-quotes",
        title: "Get Quote",
        url: "/insurance/quotes",
      },
      {
        key: "insurance-certificates",
        title: "Certificates",
        url: "/insurance/certificates",
      },
    ],
  },
  {
    key: "customers",
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
  {
    key: "roles",
    title: "Roles",
    url: "/roles",
    icon: UserCog,
  },
  {
    key: "payment-config",
    title: "Payment Config",
    url: "/admin/payment-config",
    icon: CreditCard,
  },
  {
    key: "recharge-review",
    title: "Recharge Review",
    url: "/admin/recharge-review",
    icon: DollarSign,
  },
  {
    key: "top-up-history",
    title: "Top-up History",
    url: "/top-up-history",
    icon: DollarSign,
  },
  {
    key: "support",
    title: "Support",
    url: "/support",
    icon: HelpCircle,
  },
]

/**
 * Get menu structure without icons for serialization
 * Icons can't be serialized for API responses
 */
export function getSerializableMenuStructure() {
  return MENU_STRUCTURE.map(item => ({
    key: item.key,
    title: item.title,
    url: item.url,
    items: item.items?.map(subItem => ({
      key: subItem.key,
      title: subItem.title,
      url: subItem.url,
    }))
  }))
}