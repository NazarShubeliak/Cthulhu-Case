import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore.js'
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

function ProtectedLayout() {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (!accessToken) {
    return <Navigate to="/login" replace />
  }
  return <AppLayout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/sessions" replace />} />
        <Route path="/sessions" element={<SessionListPage />} />
        <Route path="/sessions/:id" element={<LobbyPage />} />
        <Route path="/table/:id" element={<TablePage />} />
        <Route path="/characters" element={<CharacterListPage />} />
        <Route path="/characters/:id" element={<CharacterSheetPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/story-editor" element={<StoryEditorPage />} />
      </Route>
    </Routes>
  )
}
