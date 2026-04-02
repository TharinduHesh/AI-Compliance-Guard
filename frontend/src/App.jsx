import React, { useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { ThemeProvider } from './ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import UploadDocument from './pages/UploadDocument'
import AnalysisResults from './pages/AnalysisResults'
import Frameworks from './pages/Frameworks'
import About from './pages/About'
import History from './pages/History'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'

function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('token'))

  const handleAuth = useCallback(() => setAuthed(true), [])
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuthed(false)
  }, [])

  // Not logged in → show Login/Register
  if (!authed) {
    return (
      <ThemeProvider>
        <Login onAuth={handleAuth} />
        <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false}
          newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
      </ThemeProvider>
    )
  }

  // Determine default landing page based on role
  const userRole = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').role } catch { return 'user' }
  })()
  const defaultRoute = userRole === 'admin' ? '/admin' : '/chat'
  const isAdmin = userRole === 'admin'

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />

        {/* Users only get the full-screen Chat page (no navbar) */}
        <Route path="/chat" element={
          isAdmin
            ? <Navigate to="/admin" replace />
            : <Chat onLogout={handleLogout} />
        } />

        {/* Shared authenticated pages — wrapped in Layout */}
        <Route path="/dashboard" element={<Layout onLogout={handleLogout}><UserDashboard /></Layout>} />
        <Route path="/upload" element={<Layout onLogout={handleLogout}><UploadDocument /></Layout>} />
        <Route path="/results/:analysisId" element={<Layout onLogout={handleLogout}><AnalysisResults /></Layout>} />
        <Route path="/frameworks" element={<Layout onLogout={handleLogout}><Frameworks /></Layout>} />
        <Route path="/history" element={<Layout onLogout={handleLogout}><History /></Layout>} />
        <Route path="/about" element={<Layout onLogout={handleLogout}><About /></Layout>} />

        {/* Admin-only route */}
        <Route path="/admin" element={isAdmin ? <Layout onLogout={handleLogout}><AdminDashboard /></Layout> : <Navigate to="/chat" replace />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </ThemeProvider>
  )
}

export default App
