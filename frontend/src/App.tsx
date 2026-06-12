import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AssignmentRealtimeProvider } from './context/AssignmentRealtimeContext'
import { ToastProvider } from './context/ToastContext'
import { PublicSettingsProvider } from './context/PublicSettingsContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AccountPage from './pages/AccountPage'
import CoursesPage from './pages/CoursesPage'
import CourseDetailPage from './pages/CourseDetailPage'
import AssignmentPage from './pages/AssignmentPage'
import MySubmissionsPage from './pages/MySubmissionsPage'
import NotFoundPage from './pages/NotFoundPage'
import MobileBlockScreen from './components/MobileBlockScreen'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AssignmentRealtimeProvider>
          <PublicSettingsProvider>
            <div className="app-viewport-wrapper">
              <MobileBlockScreen />
              <div className="app-content">
                <BrowserRouter>
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
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </main>
                  </div>
                </BrowserRouter>
              </div>
            </div>
          </PublicSettingsProvider>
        </AssignmentRealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
