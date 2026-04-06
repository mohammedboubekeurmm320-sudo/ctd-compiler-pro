// ============================================================
// Router principal — CTD Compiler Pro
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage, UnauthorizedPage, PendingSetupPage } from '@/pages/auth/AuthPages'
import { SuperAdminDashboard } from '@/pages/superadmin/SuperAdminDashboard'
import { ProjectsListPage } from '@/pages/projects/ProjectsListPage'
import { CreateProjectPage } from '@/pages/projects/CreateProjectPage'
import { ProjectDashboard } from '@/pages/projects/ProjectDashboard'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { CTDFormPage } from '@/pages/ctd/CTDFormPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AuditTrailPage } from '@/pages/audit/AuditTrailPage'
import { ExportCTDPage } from '@/pages/ctd/ExportCTDPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { ToastContainer } from '@/components/ui/ToastContainer'

export function AppRouter() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/pending-setup" element={<PendingSetupPage />} />

        {/* Routes protégées */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProjectsListPage />} />

          {/* Projets */}
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/new" element={
            <ProtectedRoute roles={['redactor', 'admin']}>
              <CreateProjectPage />
            </ProtectedRoute>
          } />
          <Route path="/projects/:projectId" element={<ProjectDashboard />} />
          <Route path="/projects/:projectId/documents" element={<DocumentsPage />} />
          <Route path="/projects/:projectId/ctd" element={<CTDFormPage />} />
          <Route path="/projects/:projectId/export" element={
            <ProtectedRoute roles={['approver', 'admin']}>
              <ExportCTDPage />
            </ProtectedRoute>
          } />

          {/* Audit trail */}
          <Route path="/audit" element={
            <ProtectedRoute roles={['admin', 'approver', 'reviewer', 'super_admin']}>
              <AuditTrailPage />
            </ProtectedRoute>
          } />

          {/* Admin société */}
          <Route path="/admin/users" element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          } />

          {/* Settings */}
          <Route path="/settings" element={
            <ProtectedRoute roles={['admin', 'super_admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* Super Admin */}
          <Route path="/superadmin" element={
            <ProtectedRoute roles={['super_admin']} requireTenant={false}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
