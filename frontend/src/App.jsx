import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore.js'
import useUIStore from './store/uiStore.js'
import AppLayout from './components/Layout/AppLayout.jsx'
import LoginPage from './pages/Auth/LoginPage.jsx'
import RegisterPage from './pages/Auth/RegisterPage.jsx'
import CharacterListPage from './pages/Characters/CharacterListPage.jsx'
import CharacterSheetPage from './pages/Characters/CharacterSheetPage.jsx'
import ProfilePage from './pages/Profile/ProfilePage.jsx'
import SessionListPage from './pages/Sessions/SessionListPage.jsx'
import LobbyPage from './pages/Sessions/LobbyPage.jsx'
import TablePage from './pages/Table/TablePage.jsx'
import StoryEditorPage from './pages/StoryEditor/StoryEditorPage.jsx'
import LandingPage from './pages/Landing/LandingPage.jsx'
import AboutPage from './pages/About/AboutPage.jsx'
import NotFoundPage from './pages/NotFound/NotFoundPage.jsx'

function PublicRoute({ element }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (accessToken) return <Navigate to="/sessions" replace />
  return element
}

function ProtectedLayout() {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (!accessToken) return <Navigate to="/" replace />
  return <AppLayout />
}

export default function App() {
  const design = useUIStore((s) => s.design)
  const bureau = design === 'bureau'

  // body-level, so public pages (landing, login) get the design too
  useEffect(() => {
    document.body.classList.toggle('design-bureau', bureau)
  }, [bureau])

  return (
    <>
    {bureau && <div className="bu-desk-surface" aria-hidden="true" />}
    <Routes>
      <Route path="/" element={<PublicRoute element={<LandingPage />} />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<PublicRoute element={<LoginPage />} />} />
      <Route path="/register" element={<PublicRoute element={<RegisterPage />} />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/sessions" element={<SessionListPage />} />
        <Route path="/sessions/:id" element={<LobbyPage />} />
        <Route path="/table/:id" element={<TablePage />} />
        <Route path="/characters" element={<CharacterListPage />} />
        <Route path="/characters/:id" element={<CharacterSheetPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/story-editor" element={<StoryEditorPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  )
}
