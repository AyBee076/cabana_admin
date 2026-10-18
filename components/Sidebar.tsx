'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from "@/components/LogoutButton";
import {
  SquaresFourIcon,
  PackageIcon,
  PlusCircleIcon,
  TagIcon,
  StackIcon,
  GearIcon,
} from '@phosphor-icons/react'

const links = [
  { href: '/', label: 'Dashboard', icon: SquaresFourIcon },
  { href: '/products', label: 'All products', icon: PackageIcon },
  { href: '/categories', label: 'Categories', icon: TagIcon },
  { href: '/inventory', label: 'Inventory', icon: StackIcon },
  { href: '/settings', label: 'Settings', icon: GearIcon },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">
          Clothing Admin
        </h2>
      </div>

      <ul className="flex-1 space-y-0.5 px-3">
        {links.map((link) => {
          const active = pathname === link.href
          const Icon = link.icon
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon
                  size={18}
                  weight={active ? 'fill' : 'regular'}
                  className={active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
                />
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className=" border-gray-200 p-3 mb-20">
        <LogoutButton />
      </div>
    </nav>
  )
}