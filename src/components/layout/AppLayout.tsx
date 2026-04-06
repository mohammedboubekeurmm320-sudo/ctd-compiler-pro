// ============================================================
// Layout principal — Sidebar + Header
// ============================================================

import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, FolderOpen, FileText, Settings,
  LogOut, ChevronLeft, ChevronRight, Shield, Users,
  ClipboardList, Bell
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  badge?: number
}

export function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Tableau de bord',
      icon: <LayoutDashboard size={18} />,
    },
    {
      to: '/projects',
      label: 'Projets CTD',
      icon: <FolderOpen size={18} />,
    },
    {
      to: '/documents',
      label: 'Documents',
      icon: <FileText size={18} />,
    },
    {
      to: '/audit',
      label: 'Audit trail',
      icon: <ClipboardList size={18} />,
      roles: ['admin', 'approver', 'reviewer', 'super_admin'],
    },
    {
      to: '/admin/users',
      label: 'Utilisateurs',
      icon: <Users size={18} />,
      roles: ['admin'],
    },
    {
      to: '/superadmin',
      label: 'Super Admin',
      icon: <Shield size={18} />,
      roles: ['super_admin'],
    },
    {
      to: '/settings',
      label: 'Paramètres',
      icon: <Settings size={18} />,
      roles: ['admin', 'super_admin'],
    },
  ]

  const visibleItems = navItems.filter(item =>
    !item.roles || (role && item.roles.includes(role))
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {/* Logo */}
        <div className={clsx(
          'flex items-center gap-3 px-4 py-4 border-b border-gray-100',
          collapsed && 'justify-center px-2'
        )}>
          <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">CTD Compiler</p>
              <p className="text-xs text-gray-400 truncate">Pro</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && item.badge > 0 && (
                <Badge variant="danger">{item.badge}</Badge>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Profil utilisateur */}
        <div className={clsx(
          'border-t border-gray-100 p-3 space-y-2',
          collapsed && 'flex flex-col items-center'
        )}>
          {!collapsed && (
            <div className="px-2 py-1">
              <p className="text-xs font-medium text-gray-700 truncate">{profile?.full_name || 'Utilisateur'}</p>
              <p className="text-xs text-gray-400 capitalize">{role}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={clsx(
              'flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-500',
              'hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors',
              collapsed && 'justify-center'
            )}
            title="Se déconnecter"
          >
            <LogOut size={16} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>

        {/* Toggle collapse */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm"
          style={{ position: 'sticky', marginLeft: 'auto', marginRight: collapsed ? '-12px' : '-12px' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-500">
              {profile?.full_name || 'Chargement...'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 text-sm font-medium">
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
