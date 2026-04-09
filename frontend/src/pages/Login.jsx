import React, { useState } from 'react'
import { authAPI } from '../services/api'
import { useTheme } from '../ThemeContext'

/* ================================================================
   FULL-SCREEN LOGIN — dark / light theme support
   Admin-only registration. Users can only log in.
   ================================================================ */

export default function Login({ onAuth }) {
  const { theme: t, isDark, toggle: toggleTheme } = useTheme()

  const [companyId, setCompanyId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!companyId.trim() || !password) {
      setError('Please fill in all required fields')
      return
    }
    if (companyId.trim().length < 3) {
      setError('Company ID must be at least 3 characters')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const res = await authAPI.login(companyId.trim(), password)

      localStorage.setItem('token', res.access_token)

      // Decode JWT to extract role
      let role = 'user'
      try {
        const payload = JSON.parse(atob(res.access_token.split('.')[1]))
        role = payload.role || 'user'
        localStorage.setItem('user', JSON.stringify({
          company_id: payload.sub || companyId.trim(),
          company_name: payload.name || companyId.trim(),
          role,
        }))
      } catch {
        localStorage.setItem('user', JSON.stringify({
          company_id: companyId.trim(),
          company_name: companyId.trim(),
          role: 'user',
        }))
      }

      onAuth && onAuth()
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail

      if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Invalid Company ID or password')
      } else if (status >= 500) {
        setError('Server error while signing in. Please try again in a moment.')
      } else if (status) {
        setError(typeof detail === 'string' ? detail : `Login failed (HTTP ${status}).`)
      } else {
        setError('Cannot reach backend API. Check VITE_API_URL and backend deployment.')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    backgroundColor: t.bg,
    border: `1px solid ${t.borderInput}`,
    borderRadius: 10, color: t.text,
    fontSize: 15, outline: 'none',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* background glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.glowColor} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 2,
          background: t.bgCard, border: `1px solid ${t.borderLight}`,
          borderRadius: 12, padding: '8px 12px',
          color: t.textSecondary, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, transition: 'all .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = t.borderLight}
      >
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
        {isDark ? 'Light' : 'Dark'}
      </button>

      <div style={{
        width: '100%', maxWidth: 420, padding: 32,
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${t.accent}, ${t.accentDark})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{ color: t.textHeading, fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
            AI Compliance Guard
          </h1>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{
          backgroundColor: t.bgCard,
          borderRadius: 16,
          border: `1px solid ${t.borderLight}`,
          padding: 28,
        }}>
          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: t.errorBg,
              border: `1px solid ${t.errorBorder}`,
              borderRadius: 10, padding: '10px 14px',
              color: t.errorText, fontSize: 13,
              marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {/* Company ID */}
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ color: t.textSecondary, fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Company ID
            </span>
            <input
              type="text"
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              placeholder="e.g. ACME-001"
              autoFocus
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = t.accent}
              onBlur={e => e.target.style.borderColor = t.borderInput}
            />
          </label>

          {/* Password */}
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ color: t.textSecondary, fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = t.accent}
              onBlur={e => e.target.style.borderColor = t.borderInput}
            />
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0',
              background: loading ? t.btnDisabled : `linear-gradient(135deg, ${t.accent}, ${t.accentDark})`,
              border: 'none', borderRadius: 10,
              color: 'white', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .15s',
              marginTop: 4,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, marginTop: 20 }}>
          Contact your administrator to get an account
        </p>
      </div>
    </div>
  )
}
