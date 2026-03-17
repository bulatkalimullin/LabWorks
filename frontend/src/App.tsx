import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PublicSettingsProvider } from './context/PublicSettingsContext'
import Navbar from './components/Navbar'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AccountPage from './pages/AccountPage'
import CoursesPage from './pages/CoursesPage'
import CourseDetailPage from './pages/CourseDetailPage'
import AssignmentPage from './pages/AssignmentPage'
import MySubmissionsPage from './pages/MySubmissionsPage'
import TeacherPanelPage from './pages/TeacherPanelPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminSubmissionsPage from './pages/AdminSubmissionsPage'
import AdminSubmissionDetailPage from './pages/AdminSubmissionDetailPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import MobileBlockScreen from './components/MobileBlockScreen'
import { useAuth } from './context/AuthContext'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || !user?.is_staff) return <Navigate to="/" replace />
  return <AdminLayout>{children}</AdminLayout>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PublicSettingsProvider>
          <div className="app-viewport-wrapper">
            <MobileBlockScreen />
            <div className="app-content">
        <BrowserRouter>
          <Routes>
            <Route path="/admin" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
            <Route path="/admin/submissions" element={<AdminGuard><AdminSubmissionsPage /></AdminGuard>} />
            <Route path="/admin/submissions/:id" element={<AdminGuard><AdminSubmissionDetailPage /></AdminGuard>} />
            <Route path="/admin/users" element={<AdminGuard><AdminUsersPage /></AdminGuard>} />
            <Route path="/admin/settings" element={<AdminGuard><AdminSettingsPage /></AdminGuard>} />

            <Route path="/*" element={
              <div className="app-shell">
                <Navbar />
                <main style={{ flex: 1 }}>
                  <Routes>
                    <Route path="/" element={<CoursesPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/course/:courseId" element={<CourseDetailPage />} />
                    <Route path="/assignment/:assignmentId" element={<AssignmentPage />} />
                    <Route path="/submissions" element={<MySubmissionsPage />} />
                    <Route path="/teacher" element={<TeacherPanelPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>
              </div>
            } />
          </Routes>
        </BrowserRouter>
            </div>
          </div>
        </PublicSettingsProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
