import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { Loading } from './components/ui'
import { DashboardLayout } from './components/member/DashboardLayout'
import { RequireAdmin } from './components/member/RequireAdmin'
import { RequireMember } from './components/member/RequireMember'
import { AuthProvider } from './lib/auth'
import { NotFoundPage } from './pages/NotFoundPage'

// Each page is its own chunk so visitors download only what they open.
const HomePage = lazy(() => import('./pages/HomePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'))
const ActivityDetailPage = lazy(() => import('./pages/ActivityDetailPage'))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OverviewPage = lazy(() => import('./pages/member/OverviewPage'))
const ProfilePage = lazy(() => import('./pages/member/ProfilePage'))
const ContributionsPage = lazy(() => import('./pages/member/ContributionsPage'))
const FundsPage = lazy(() => import('./pages/member/FundsPage'))
const ReportsPage = lazy(() => import('./pages/member/ReportsPage'))
const AssistancePage = lazy(() => import('./pages/member/AssistancePages').then((m) => ({ default: m.AssistancePage })))
const EmploymentPage = lazy(() => import('./pages/member/AssistancePages').then((m) => ({ default: m.EmploymentPage })))
const MedicalPage = lazy(() => import('./pages/member/AssistancePages').then((m) => ({ default: m.MedicalPage })))
const MemberActivitiesPage = lazy(() => import('./pages/member/ActivitiesAnnouncementsDocuments').then((m) => ({ default: m.MemberActivitiesPage })))
const MemberAnnouncementsPage = lazy(() => import('./pages/member/ActivitiesAnnouncementsDocuments').then((m) => ({ default: m.MemberAnnouncementsPage })))
const MemberDocumentsPage = lazy(() => import('./pages/member/ActivitiesAnnouncementsDocuments').then((m) => ({ default: m.MemberDocumentsPage })))
const FirstLoginPage = lazy(() => import('./pages/FirstLoginPage'))
const AddMemberPage = lazy(() => import('./pages/admin/AddMemberPage'))
const SettingsPage = lazy(() => import('./pages/member/SettingsPage'))
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Suspense fallback={<Loading className="min-h-dvh" />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="activities/:slug" element={<ActivityDetailPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="join" element={<JoinPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="first-login" element={<FirstLoginPage />} />
            {/* Members-only area: guarded in the UI by RequireMember AND in the database by RLS / security-definer functions. */}
            <Route path="dashboard" element={<RequireMember />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="contributions" element={<ContributionsPage />} />
                <Route path="funds" element={<FundsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="assistance" element={<AssistancePage />} />
                <Route path="employment" element={<EmploymentPage />} />
                <Route path="medical" element={<MedicalPage />} />
                <Route path="activities" element={<MemberActivitiesPage />} />
                <Route path="announcements" element={<MemberAnnouncementsPage />} />
                <Route path="documents" element={<MemberDocumentsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<RequireAdmin />}>
                  <Route path="members/new" element={<AddMemberPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
            <Route path="design-system" element={<DesignSystemPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
    </AuthProvider>
  )
}
