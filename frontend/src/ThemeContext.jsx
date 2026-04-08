import React, { createContext, useContext, useState, useCallback } from 'react'

/* ================================================================
   THEME CONTEXT — dark / light mode with localStorage persistence
   ================================================================ */

const DARK = {
  mode: 'dark',
  // Backgrounds
  bg:          '#0f172a',
  bgSidebar:   '#111827',
  bgCard:      '#1e293b',
  bgBubbleAI:  '#1a1f2e',
  bgInput:     '#1e293b',
  bgHover:     '#1a2332',
  bgWelcome:   '#1e293b',
  // Borders
  border:      '#1f2937',
  borderLight: '#334155',
  borderInput: '#334155',
  // Text
  text:        '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted:   '#64748b',
  textDimmed:  '#475569',
  textHeading: '#f1f5f9',
  // Accent
  accent:      '#35627A',
  accentDark:  '#2B5165',
  accentBg:    '#233845',
  accentText:  '#A6A9D0',
  accentLight: '#A6A9D0',
  // Error
  errorBg:     'rgba(239,68,68,0.12)',
  errorBorder: 'rgba(239,68,68,0.3)',
  errorText:   '#fca5a5',
  // User bubble
  userGrad1:   '#35627A',
  userGrad2:   '#A6A9D0',
  userLabel:   '#E5AEA9',
  // Scrollbar
  scrollThumb: '#334155',
  // Button states
  btnDisabled: '#374151',
  btnDisabledText: '#64748b',
  // Glow
  glowColor:   'rgba(53,98,122,0.12)',
}

const LIGHT = {
  mode: 'light',
  bg:          '#f8fafc',
  bgSidebar:   '#ffffff',
  bgCard:      '#ffffff',
  bgBubbleAI:  '#f1f5f9',
  bgInput:     '#ffffff',
  bgHover:     '#f1f5f9',
  bgWelcome:   '#f1f5f9',
  border:      '#e2e8f0',
  borderLight: '#cbd5e1',
  borderInput: '#cbd5e1',
  text:        '#1e293b',
  textSecondary: '#475569',
  textMuted:   '#64748b',
  textDimmed:  '#94a3b8',
  textHeading: '#0f172a',
  accent:      '#35627A',
  accentDark:  '#2B5165',
  accentBg:    '#F5F5F5',
  accentText:  '#35627A',
  accentLight: '#A6A9D0',
  errorBg:     'rgba(239,68,68,0.08)',
  errorBorder: 'rgba(239,68,68,0.25)',
  errorText:   '#dc2626',
  userGrad1:   '#35627A',
  userGrad2:   '#A6A9D0',
  userLabel:   '#35627A',
  scrollThumb: '#cbd5e1',
  btnDisabled: '#e2e8f0',
  btnDisabledText: '#94a3b8',
  glowColor:   'rgba(53,98,122,0.08)',
}

const ThemeContext = createContext({ theme: DARK, isDark: true, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      return saved ? saved === 'dark' : true // default dark
    } catch { return true }
  })

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
      return next
    })
  }, [])

  const theme = isDark ? DARK : LIGHT

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
