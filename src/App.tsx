import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { Loading } from './components/ui'
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
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))

export default function App() {
  return (
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
            <Route path="design-system" element={<DesignSystemPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
