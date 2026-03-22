import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { chatAPI } from '../services/api'
import { useTheme } from '../ThemeContext'

/* ================================================================
   FULL-SCREEN CHATGPT-STYLE COMPLIANCE CHAT  — dark / light theme
   ================================================================ */

/* ── Theme toggle button (sun / moon) ─────────────────────────── */
function ThemeToggle({ isDark, onToggle, t }) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none', border: 'none', color: t.textMuted,
        cursor: 'pointer', padding: 6, borderRadius: 8,
        display: 'flex', alignItems: 'center', transition: 'color .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = t.accent}
      onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
    >
      {isDark ? (
        /* Sun icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

/* ── Sidebar ──────────────────────────────────────────────────── */
function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, collapsed, onClose, user, onLogout, t, isDark, onToggleTheme, onOpenSettings, onNavigate }) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const searchInputRef = React.useRef(null)

  // Focus input when search opens
  React.useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus()
  }, [searchOpen])

  // Filter conversations by search query
  const filtered = searchQuery.trim()
    ? conversations.filter(c => {
        const q = searchQuery.toLowerCase()
        const title = (c.title || '').toLowerCase()
        const doc = (c.documentName || '').toLowerCase()
        return title.includes(q) || doc.includes(q)
      })
    : conversations

  return (
    <div style={{
      width: collapsed ? 0 : 260,
      minWidth: collapsed ? 0 : 260,
      height: '100%',
      backgroundColor: t.bgSidebar,
      borderRight: `1px solid ${t.border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s, min-width 0.25s',
      overflow: 'hidden',
    }}>
      {/* Top row — New Chat + Close sidebar */}
      <div style={{ padding: '12px 12px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={onNew}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: 'transparent',
            border: `1px solid ${t.borderLight}`,
            borderRadius: 8,
            color: t.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgHover}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Chat
        </button>

        {/* Close sidebar button */}
        <button
          onClick={onClose}
          title="Close sidebar"
          style={{
            background: 'none',
            border: 'none',
            color: t.textMuted,
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color .15s, background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.bgHover; e.currentTarget.style.color = t.text }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = t.textMuted }}
        >
          {/* Sidebar collapse icon — panel left close */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <polyline points="16 15 12 12 16 9"/>
          </svg>
        </button>
      </div>

      {/* Search chats */}
      <div style={{ padding: '0 12px 8px' }}>
        {searchOpen ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: t.bgInput,
            border: `1px solid ${t.borderLight}`,
            borderRadius: 8, padding: '0 10px',
            transition: 'border-color .15s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) }
              }}
              style={{
                flex: 1, border: 'none', outline: 'none',
                backgroundColor: 'transparent', color: t.text,
                fontSize: 13, padding: '9px 0',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none', border: 'none', color: t.textMuted,
                  cursor: 'pointer', padding: 2, display: 'flex',
                  alignItems: 'center', fontSize: 14, lineHeight: 1,
                }}
              >✕</button>
            )}
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
              style={{
                background: 'none', border: 'none', color: t.textMuted,
                cursor: 'pointer', padding: 2, fontSize: 11, fontWeight: 600,
              }}
            >ESC</button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              width: '100%', padding: '9px 12px',
              backgroundColor: 'transparent',
              border: 'none', borderRadius: 8,
              color: t.textMuted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, transition: 'background 0.15s, color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.bgHover; e.currentTarget.style.color = t.text }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = t.textMuted }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search chats
          </button>
        )}
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {searchOpen && searchQuery && filtered.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
            No chats matching "{searchQuery}"
          </div>
        )}
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 2,
              backgroundColor: c.id === activeId ? t.bgCard : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.backgroundColor = t.bgHover }}
            onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 13, color: t.text, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {c.documentName ? `📄 ${c.documentName}` : c.title || 'New chat'}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
              style={{
                background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer',
                padding: 4, borderRadius: 4, fontSize: 14, lineHeight: 1, opacity: 0.5,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
            >✕</button>
          </div>
        ))}
      </div>

      {/* Theme toggle + Settings row */}
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: t.textMuted, fontSize: 12 }}>
          {isDark ? '🌙 Dark' : '☀️ Light'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={onOpenSettings}
            title="Settings"
            style={{
              background: 'none', border: 'none', color: t.textMuted,
              cursor: 'pointer', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center', transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.accent}
            onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} t={t} />
        </div>
      </div>

      {/* Bottom — user info + logout */}
      <div style={{
        padding: '12px', borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: '#1e40af', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {(user?.company_id || 'U')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ color: t.text, fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.company_name || user?.company_id || 'User'}
          </div>
          <div style={{ color: t.textMuted, fontSize: 11 }}>{user?.company_id}</div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            background: 'none', border: 'none', color: t.textMuted,
            cursor: 'pointer', padding: 6, borderRadius: 8,
            display: 'flex', alignItems: 'center', transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Message Bubble ───────────────────────────────────────────── */
function MessageBubble({ role, content, documentName, t }) {
  const isUser = role === 'user'

  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      backgroundColor: isUser ? 'transparent' : t.bgBubbleAI,
      padding: '24px 0',
    }}>
      <div style={{
        maxWidth: 760, width: '100%', display: 'flex', gap: 16, padding: '0 24px',
      }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'white',
          background: isUser
            ? `linear-gradient(135deg, ${t.userGrad1}, ${t.userGrad2})`
            : `linear-gradient(135deg, ${t.accent}, ${t.accentDark})`,
        }}>
          {isUser ? 'U' : 'AI'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, marginBottom: 6,
            color: isUser ? t.userLabel : t.accentText,
          }}>
            {isUser ? 'You' : 'AI Compliance Guard'}
          </div>

          {documentName && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', backgroundColor: t.bgCard,
              borderRadius: 8, border: `1px solid ${t.borderLight}`,
              marginBottom: 8, fontSize: 13, color: t.textSecondary,
            }}>
              📎 {documentName}
            </div>
          )}

          <div className="chat-md" style={{ color: t.text, fontSize: 15, lineHeight: 1.7 }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Typing dots ──────────────────────────────────────────────── */
function TypingIndicator({ t }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      backgroundColor: t.bgBubbleAI, padding: '24px 0',
    }}>
      <div style={{
        maxWidth: 760, width: '100%', display: 'flex', gap: 16, padding: '0 24px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${t.accent}, ${t.accentDark})`,
          color: 'white', fontWeight: 700, fontSize: 14,
        }}>AI</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%', backgroundColor: t.accentLight,
              animation: 'chatPulse 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Welcome screen (centered like ChatGPT) ───────────────────── */
function WelcomeScreen({ onSend, t }) {
  const suggestions = [
    { icon: '📋', title: 'What is ISO 27001?', desc: 'Information security standards' },
    { icon: '🛡️', title: 'Explain the CIA triad', desc: 'Confidentiality, Integrity, Availability' },
    { icon: '📜', title: 'What is GDPR?', desc: 'Data privacy regulations' },
    { icon: '🔍', title: 'How does NIST CSF work?', desc: 'Cybersecurity framework overview' },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, padding: 40,
    }}>
      <img src="/Logo.png" alt="AI Compliance Guard" style={{
        width: 200, height: 200, borderRadius: 24,
        marginBottom: 0, objectFit: 'contain',
      }} />

      <h1 style={{
        fontSize: 30, fontWeight: 700, color: t.textHeading,
        marginBottom: 8, textAlign: 'center', marginTop: 0,
      }}>AI Compliance Guard</h1>

      <p style={{
        color: t.textSecondary, fontSize: 16, textAlign: 'center',
        maxWidth: 520, lineHeight: 1.6, marginBottom: 40,
      }}>
        Upload a compliance document and I'll analyze it against ISO 27001, ISO 9001,
        NIST CSF, or GDPR. I'll find gaps, weak policies, and give you actionable improvements.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12, maxWidth: 560, width: '100%',
      }}>
        {suggestions.map(s => (
          <button
            key={s.title}
            onClick={() => onSend(s.title)}
            style={{
              padding: 16, backgroundColor: t.bgWelcome,
              border: `1px solid ${t.borderLight}`, borderRadius: 12,
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s', color: t.text,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = t.accentLight
              e.currentTarget.style.backgroundColor = t.bgHover
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = t.borderLight
              e.currentTarget.style.backgroundColor = t.bgWelcome
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── File preview chip ────────────────────────────────────────── */
function FilePreview({ file, onRemove, t }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', backgroundColor: t.bgCard,
      border: `1px solid ${t.borderLight}`, borderRadius: 10,
      marginBottom: 8, fontSize: 13, color: t.textSecondary,
    }}>
      📄 <span style={{ color: t.text, fontWeight: 500 }}>{file.name}</span>
      <span style={{ fontSize: 11, color: t.textMuted }}>({(file.size / 1024).toFixed(1)} KB)</span>
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
        padding: '0 2px', fontSize: 16, lineHeight: 1,
      }}>✕</button>
    </div>
  )
}

/* ── Settings Modal ───────────────────────────────────────────── */
const AUTO_DELETE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
]

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { id: 'personalization', label: 'Personalization', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'data', label: 'Data controls', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { id: 'security', label: 'Security', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { id: 'account', label: 'Account', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
]

/* ── Small reusable: setting row with label + control on right ── */
function SettingRow({ label, desc, children, t }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: `1px solid ${t.border}`, gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

/* ── Small reusable: dropdown select ── */
function SettingSelect({ value, options, onChange, t, isDark }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '6px 28px 6px 12px', borderRadius: 8,
        border: `1px solid ${t.borderLight}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        color: t.text, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', outline: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${encodeURIComponent(t.textMuted)}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        fontFamily: 'inherit',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ── Small reusable: toggle switch ── */
function ToggleSwitch({ checked, onChange, t }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        backgroundColor: checked ? t.accent : (t.borderLight || '#555'),
        cursor: 'pointer', position: 'relative',
        transition: 'background-color .2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        backgroundColor: '#fff',
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

/* ── Pill button ── */
function PillButton({ label, variant, onClick, t, isDark }) {
  const isDestructive = variant === 'danger'
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', transition: 'all .15s',
        border: `1px solid ${isDestructive ? (isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)') : t.borderLight}`,
        backgroundColor: 'transparent',
        color: isDestructive ? '#ef4444' : t.text,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = isDestructive
          ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)')
          : t.bgHover
      }}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {label}
    </button>
  )
}

function SettingsModal({ open, onClose, autoDelete, onChangeAutoDelete, onDeleteAllChats, onLogout, user, t, isDark, onToggleTheme }) {
  const [activeTab, setActiveTab] = React.useState('general')
  const [appearance, setAppearance] = React.useState(() => localStorage.getItem('themeMode') || (isDark ? 'dark' : 'light'))
  const [language, setLanguage] = React.useState(() => localStorage.getItem('appLanguage') || 'en')
  const [customInstructions, setCustomInstructions] = React.useState(() => localStorage.getItem('customInstructions') || '')
  const [responseStyle, setResponseStyle] = React.useState(() => localStorage.getItem('responseStyle') || 'default')
  const [useEmoji, setUseEmoji] = React.useState(() => localStorage.getItem('useEmoji') !== 'false')
  const [useHeaders, setUseHeaders] = React.useState(() => localStorage.getItem('useHeaders') !== 'false')
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  if (!open) return null

  const handleAppearanceChange = (val) => {
    setAppearance(val)
    localStorage.setItem('themeMode', val)
    const wantsDark = val === 'dark' || (val === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (wantsDark !== isDark) onToggleTheme()
  }

  const handleLanguageChange = (val) => {
    setLanguage(val)
    localStorage.setItem('appLanguage', val)
  }

  /* ── Tab content renderers ── */
  const renderGeneral = () => (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>General</h3>
      <div style={{ height: 1, backgroundColor: t.border, margin: '12px 0 4px' }} />

      <SettingRow label="Appearance" desc="Control how the app looks." t={t}>
        <SettingSelect value={appearance} onChange={handleAppearanceChange} t={t} isDark={isDark}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Language" t={t}>
        <SettingSelect value={language} onChange={handleLanguageChange} t={t} isDark={isDark}
          options={[
            { value: 'en', label: 'English' },
            { value: 'th', label: 'Thai' },
            { value: 'zh', label: 'Chinese' },
            { value: 'ja', label: 'Japanese' },
            { value: 'ko', label: 'Korean' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Auto-delete chats" desc="Automatically remove chats older than this duration." t={t}>
        <SettingSelect value={autoDelete} onChange={onChangeAutoDelete} t={t} isDark={isDark}
          options={AUTO_DELETE_OPTIONS}
        />
      </SettingRow>
    </div>
  )

  const renderPersonalization = () => (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>Personalization</h3>
      <div style={{ height: 1, backgroundColor: t.border, margin: '12px 0 4px' }} />

      <SettingRow label="Response style" desc="Set the style and tone of how the assistant responds." t={t}>
        <SettingSelect value={responseStyle} onChange={v => { setResponseStyle(v); localStorage.setItem('responseStyle', v) }} t={t} isDark={isDark}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'concise', label: 'Concise' },
            { value: 'detailed', label: 'Detailed' },
            { value: 'formal', label: 'Formal' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Headers & Lists" desc="Use headers and bullet lists in responses." t={t}>
        <ToggleSwitch checked={useHeaders} onChange={v => { setUseHeaders(v); localStorage.setItem('useHeaders', String(v)) }} t={t} />
      </SettingRow>

      <SettingRow label="Emoji" desc="Include emojis in responses." t={t}>
        <ToggleSwitch checked={useEmoji} onChange={v => { setUseEmoji(v); localStorage.setItem('useEmoji', String(v)) }} t={t} />
      </SettingRow>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Custom instructions</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, lineHeight: 1.4 }}>
          Tell the assistant anything you'd like it to know or how you'd like it to respond.
        </div>
        <textarea
          value={customInstructions}
          onChange={e => { setCustomInstructions(e.target.value); localStorage.setItem('customInstructions', e.target.value) }}
          placeholder="e.g. short answer, focus on ISO 27001..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${t.borderLight}`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: t.text, fontSize: 13, fontFamily: 'inherit',
            outline: 'none', resize: 'vertical', lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )

  const renderDataControls = () => (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>Data controls</h3>
      <div style={{ height: 1, backgroundColor: t.border, margin: '12px 0 4px' }} />

      <SettingRow label="Auto-delete duration" desc="Chats older than this are removed on app load." t={t}>
        <SettingSelect value={autoDelete} onChange={onChangeAutoDelete} t={t} isDark={isDark}
          options={AUTO_DELETE_OPTIONS}
        />
      </SettingRow>

      <SettingRow label="Delete all chats" desc="Permanently remove all your conversations." t={t}>
        {!confirmDelete ? (
          <PillButton label="Delete all" variant="danger" onClick={() => setConfirmDelete(true)} t={t} isDark={isDark} />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <PillButton label="Cancel" onClick={() => setConfirmDelete(false)} t={t} isDark={isDark} />
            <PillButton label="Confirm" variant="danger" onClick={() => { onDeleteAllChats(); setConfirmDelete(false) }} t={t} isDark={isDark} />
          </div>
        )}
      </SettingRow>

      {/* Info note */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 10, marginTop: 16,
        backgroundColor: isDark ? 'rgba(250,204,21,0.06)' : 'rgba(202,138,4,0.04)',
        border: `1px solid ${isDark ? 'rgba(250,204,21,0.12)' : 'rgba(202,138,4,0.1)'}`,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
          Expired chats are removed automatically when you open the app.
          Temporary chats are never saved regardless of these settings.
        </div>
      </div>
    </div>
  )

  const renderSecurity = () => (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>Security</h3>
      <div style={{ height: 1, backgroundColor: t.border, margin: '12px 0 4px' }} />

      <SettingRow label="Log out of this device" t={t}>
        <PillButton label="Log out" onClick={onLogout} t={t} isDark={isDark} />
      </SettingRow>

      <SettingRow label="Log out of all devices" desc="Log out of all active sessions across all devices, including your current session." t={t}>
        <PillButton label="Log out all" variant="danger" onClick={onLogout} t={t} isDark={isDark} />
      </SettingRow>
    </div>
  )

  const renderAccount = () => (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>Account</h3>
      <div style={{ height: 1, backgroundColor: t.border, margin: '12px 0 4px' }} />

      <SettingRow label="Company" t={t}>
        <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>
          {user?.company_name || user?.company_id || 'Unknown'}
        </span>
      </SettingRow>

      <SettingRow label="User ID" t={t}>
        <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, fontFamily: 'monospace' }}>
          {user?.company_id || '—'}
        </span>
      </SettingRow>

      <SettingRow label="Plan" t={t}>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
          backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
          color: isDark ? '#a78bfa' : '#6366f1',
        }}>Free</span>
      </SettingRow>
    </div>
  )

  const tabContent = {
    general: renderGeneral,
    personalization: renderPersonalization,
    data: renderDataControls,
    security: renderSecurity,
    account: renderAccount,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '94vw', height: 520, maxHeight: '85vh',
          backgroundColor: t.bgSidebar, borderRadius: 16,
          border: `1px solid ${t.border}`,
          boxShadow: isDark
            ? '0 24px 48px rgba(0,0,0,0.5)'
            : '0 24px 48px rgba(0,0,0,0.15)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <span style={{ color: t.text, fontWeight: 700, fontSize: 16 }}>Settings</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: t.textMuted,
              cursor: 'pointer', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center',
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left nav */}
          <div style={{
            width: 200, minWidth: 200, borderRight: `1px solid ${t.border}`,
            padding: '8px', overflowY: 'auto',
          }}>
            {SETTINGS_TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: 'none',
                    backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent',
                    color: active ? t.text : t.textMuted,
                    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: 'all .15s', textAlign: 'left',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = t.bgHover }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {tab.icon(active ? t.text : t.textMuted)}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
            {tabContent[activeTab]?.()}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Quick chips ──────────────────────────────────────────────── */
function ActionChips({ onSend, hasDoc, t }) {
  const docChips = [
    '🔍 Full compliance analysis',
    '📋 Check against ISO 27001',
    '❌ What controls are missing?',
    '⚠️ Show weak policies',
    '💡 How can I improve?',
    '🛡️ CIA triad analysis',
  ]
  const generalChips = [
    'What is ISO 27001?',
    'Explain CIA triad',
    'What is GDPR?',
    'NIST CSF overview',
  ]
  const chips = hasDoc ? docChips : generalChips

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8,
      justifyContent: 'center', padding: '0 24px 8px',
    }}>
      {chips.map(label => (
        <button
          key={label}
          onClick={() => onSend(label)}
          style={{
            padding: '6px 14px', borderRadius: 20,
            border: `1px solid ${t.borderLight}`, backgroundColor: 'transparent',
            color: t.textSecondary, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = t.accentLight
            e.currentTarget.style.color = t.text
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = t.borderLight
            e.currentTarget.style.color = t.textSecondary
          }}
        >{label}</button>
      ))}
    </div>
  )
}

/* ================================================================
   MAIN CHAT COMPONENT
   ================================================================ */
export default function Chat({ onLogout }) {
  const { theme: t, isDark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [documentName, setDocumentName] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [temporaryChat, setTemporaryChat] = useState(false)
  const [llmStatus, setLlmStatus] = useState(null) // {provider, available, model}
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoDeleteDuration, setAutoDeleteDuration] = useState(() => {
    return localStorage.getItem('autoDeleteDuration') || 'never'
  })
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // On mount: show welcome screen without creating a conversation yet.
  // A conversation is created lazily on first message send.
  const hasInitRef = useRef(false)
  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true
    // No conversation created — just show the welcome screen
    setActiveConvId(null)
    setMessages([])
    setDocumentName(null)

    // Fetch LLM status
    chatAPI.getLLMStatus()
      .then(data => setLlmStatus(data))
      .catch(() => setLlmStatus({ provider: 'none', available: false, model: null }))
  }, [])

  /* ── Auto-delete cleanup ────────────── */
  const getAutoDeleteMs = (dur) => {
    const map = { '1d': 86400000, '7d': 604800000, '30d': 2592000000, '6m': 15778800000, '1y': 31557600000 }
    return map[dur] || null
  }

  useEffect(() => {
    const ms = getAutoDeleteMs(autoDeleteDuration)
    if (!ms) return
    const now = Date.now()
    const expired = conversations.filter(c => {
      const created = new Date(c.createdAt).getTime()
      return (now - created) > ms
    })
    if (expired.length > 0) {
      expired.forEach(c => handleDeleteConversation(c.id))
    }
  }, [autoDeleteDuration, conversations.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoDeleteChange = (value) => {
    setAutoDeleteDuration(value)
    localStorage.setItem('autoDeleteDuration', value)
  }

  /* ── Temporary chat toggle ──────────── */
  const handleToggleTemporaryChat = () => {
    setTemporaryChat(prev => {
      const next = !prev
      if (next) {
        // Entering temporary mode: start a fresh ephemeral chat
        const id = `temp_${Date.now()}`
        setActiveConvId(id)
        setMessages([])
        setDocumentName(null)
        setPendingFile(null)
      } else {
        // Leaving temporary mode: discard temp messages, open latest real chat
        const latest = conversations[0]
        if (latest) {
          setActiveConvId(latest.id)
          setMessages([])
          setDocumentName(latest.documentName || null)
        } else {
          handleNewChat()
        }
      }
      return next
    })
  }

  /* ── Conversation management ─────────── */
  const handleNewChat = async () => {
    // If in temporary mode, just reset the ephemeral session
    if (temporaryChat) {
      const id = `temp_${Date.now()}`
      setActiveConvId(id)
      setMessages([])
      setDocumentName(null)
      setPendingFile(null)
      return
    }
    try {
      const data = await chatAPI.newConversation()
      const c = { id: data.conversation_id, title: 'New chat', documentName: null, createdAt: data.timestamp || new Date().toISOString() }
      setConversations(prev => [c, ...prev])
      setActiveConvId(data.conversation_id)
      setMessages([])
      setDocumentName(null)
      setPendingFile(null)
    } catch {
      const id = `local_${Date.now()}`
      setConversations(prev => [{ id, title: 'New chat', documentName: null, createdAt: new Date().toISOString() }, ...prev])
      setActiveConvId(id)
      setMessages([])
      setDocumentName(null)
      setPendingFile(null)
    }
  }

  const handleSelectConversation = async (id) => {
    setActiveConvId(id)
    try {
      const data = await chatAPI.getConversation(id)
      setMessages(data.messages || [])
      setDocumentName(data.document_name || null)
    } catch { setMessages([]) }
  }

  const handleDeleteConversation = async (id) => {
    try { await chatAPI.deleteConversation(id) } catch {}
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConvId === id) {
      setActiveConvId(null)
      setMessages([])
      setDocumentName(null)
    }
  }

  const handleDeleteAllChats = async () => {
    for (const c of conversations) {
      try { await chatAPI.deleteConversation(c.id) } catch {}
    }
    setConversations([])
    setActiveConvId(null)
    setMessages([])
    setDocumentName(null)
  }

  /* ── Ensure a conversation exists (lazy creation) ── */
  const ensureConversation = async () => {
    if (activeConvId) return activeConvId
    if (temporaryChat) {
      const id = `temp_${Date.now()}`
      setActiveConvId(id)
      return id
    }
    try {
      const data = await chatAPI.newConversation()
      const c = { id: data.conversation_id, title: 'New chat', documentName: null, createdAt: data.timestamp || new Date().toISOString() }
      setConversations(prev => [c, ...prev])
      setActiveConvId(data.conversation_id)
      return data.conversation_id
    } catch {
      const id = `local_${Date.now()}`
      setConversations(prev => [{ id, title: 'New chat', documentName: null, createdAt: new Date().toISOString() }, ...prev])
      setActiveConvId(id)
      return id
    }
  }

  const getApiErrorMessage = (error, fallback) => {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail
    const networkError = error?.code === 'ERR_NETWORK' || !error?.response

    if (status === 401) {
      return '⚠️ Session expired. Please sign out and log in again.'
    }
    if (typeof detail === 'string' && detail.trim()) {
      return `⚠️ ${detail}`
    }
    if (networkError) {
      return '⚠️ Could not reach backend. Make sure it is running at http://localhost:8000'
    }
    return fallback
  }

  /* ── Send message ───────────────────── */
  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg && !pendingFile) return
    if (loading) return
    setInput('')

    // Lazily create conversation on first message
    const convId = await ensureConversation()

    // file + message → upload-and-ask
    if (pendingFile) {
      const file = pendingFile
      setPendingFile(null)
      setMessages(prev => [...prev, { role: 'user', content: msg || `📎 Uploaded: **${file.name}**`, documentName: file.name, timestamp: new Date().toISOString() }])
      setLoading(true)
      try {
        const data = await chatAPI.uploadAndAsk(convId, file, msg || 'Analyze this document for compliance', 'iso27001')
        setActiveConvId(data.conversation_id)
        setDocumentName(data.document_name)
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, documentName: data.document_name, title: data.document_name } : c))
        setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: data.timestamp }])
      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: getApiErrorMessage(error, '⚠️ Failed to upload document.'),
          timestamp: new Date().toISOString(),
        }])
      } finally { setLoading(false) }
      return
    }

    // Normal text
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }])
    setLoading(true)
    if (messages.length === 0 && !temporaryChat) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: msg.slice(0, 40) } : c))
    }
    try {
      const data = await chatAPI.sendMessage(convId, msg)
      setActiveConvId(data.conversation_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: data.timestamp }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: getApiErrorMessage(error, '⚠️ Failed to process your message.'),
        timestamp: new Date().toISOString(),
      }])
    } finally { setLoading(false) }
  }, [input, loading, activeConvId, pendingFile, messages.length, temporaryChat])

  /* ── File handling ──────────────────── */
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx'].includes(ext)) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Only **PDF** and **DOCX** files are supported.', timestamp: new Date().toISOString() }])
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ File too large. Max **10 MB**.', timestamp: new Date().toISOString() }])
      return
    }
    setPendingFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadOnly = async (file) => {
    const convId = await ensureConversation()
    setMessages(prev => [...prev, { role: 'user', content: `📎 Uploaded: **${file.name}**`, documentName: file.name, timestamp: new Date().toISOString() }])
    setLoading(true)
    try {
      const data = await chatAPI.uploadDocument(convId, file)
      setActiveConvId(data.conversation_id)
      setDocumentName(data.document_name)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, documentName: data.document_name, title: data.document_name } : c))
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: data.timestamp }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: getApiErrorMessage(error, '⚠️ Upload failed.'),
        timestamp: new Date().toISOString(),
      }])
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (pendingFile && !input.trim()) {
        const f = pendingFile; setPendingFile(null); handleUploadOnly(f)
      } else {
        sendMessage()
      }
    }
  }

  const isEmpty = messages.length === 0
  const userRole = (() => { try { return JSON.parse(localStorage.getItem('user'))?.role } catch { return 'user' } })()
  const isFullScreen = userRole !== 'admin'

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <>
    <div style={{
      display: 'flex',
      backgroundColor: t.bg,
      overflow: 'hidden',
      ...(isFullScreen
        ? { height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, zIndex: 9999 }
        : { height: '100%', width: '100%' }
      ),
    }}>

      {/* Dynamic styles */}
      <style>{`
        @keyframes chatPulse {
          0%, 80%, 100% { opacity: .3; transform: scale(.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        .chat-md h2 { font-size: 1.15rem; font-weight: 700; margin: 12px 0 6px; color: ${t.textHeading}; }
        .chat-md h3 { font-size: 1.05rem; font-weight: 600; margin: 10px 0 4px; color: ${t.text}; }
        .chat-md p  { margin: 0 0 8px; }
        .chat-md ul, .chat-md ol { margin: 4px 0 8px; padding-left: 20px; }
        .chat-md li { margin-bottom: 3px; }
        .chat-md strong { color: ${t.textHeading}; }
        .chat-md em { color: ${t.textSecondary}; }
        .chat-md blockquote {
          border-left: 3px solid ${t.accentLight}; padding-left: 12px;
          margin: 8px 0; color: ${t.textSecondary}; font-style: italic;
        }
        .chat-md code {
          background: ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}; padding: 1px 5px;
          border-radius: 4px; font-size: .88em;
        }
        .chat-md hr { border: none; border-top: 1px solid ${t.borderLight}; margin: 12px 0; }
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
        .chat-ta::-webkit-scrollbar { width: 4px; }
        .chat-ta::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 2px; }
      `}</style>

      {/* ── Sidebar ───────────────────────── */}
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarCollapsed(true)}
        user={user}
        onLogout={onLogout}
        t={t}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onNavigate={(path) => navigate(path)}
      />

      {/* ── Main area ─────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '10px 16px',
          borderBottom: `1px solid ${t.border}`, backgroundColor: t.bg,
          zIndex: 10, gap: 12, flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarCollapsed(p => !p)}
            title={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
            style={{
              background: 'none', border: 'none', color: t.textSecondary,
              cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex',
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.bgCard; e.currentTarget.style.color = t.text }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = t.textSecondary }}
          >
            {sidebarCollapsed ? (
              /* Panel open icon */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <polyline points="14 9 18 12 14 15"/>
              </svg>
            ) : (
              /* Hamburger icon */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/Logo.png" alt="Logo" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain' }} />
            <span style={{ color: t.text, fontWeight: 600, fontSize: 15 }}>AI Compliance Guard</span>
            {documentName && <span style={{ color: t.accentLight, fontSize: 13, marginLeft: 4 }}>📄 {documentName}</span>}
            {temporaryChat && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                borderRadius: 6, backgroundColor: isDark ? 'rgba(250,204,21,0.12)' : 'rgba(202,138,4,0.1)',
                color: isDark ? '#fbbf24' : '#b45309', marginLeft: 4,
              }}>Temporary</span>
            )}
          </div>

          {/* Temporary Chat toggle */}
          <button
            onClick={handleToggleTemporaryChat}
            title={temporaryChat ? 'Turn off temporary chat' : 'Turn on temporary chat — won\'t appear in history'}
            style={{
              background: temporaryChat
                ? (isDark ? 'rgba(250,204,21,0.12)' : 'rgba(202,138,4,0.1)')
                : 'none',
              border: temporaryChat
                ? `1px solid ${isDark ? 'rgba(250,204,21,0.3)' : 'rgba(202,138,4,0.25)'}`
                : '1px solid transparent',
              color: temporaryChat
                ? (isDark ? '#fbbf24' : '#b45309')
                : t.textMuted,
              cursor: 'pointer', padding: '5px 10px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 500,
              transition: 'all .2s',
            }}
            onMouseEnter={e => {
              if (!temporaryChat) {
                e.currentTarget.style.backgroundColor = t.bgHover
                e.currentTarget.style.color = t.text
              }
            }}
            onMouseLeave={e => {
              if (!temporaryChat) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = t.textMuted
              }
            }}
          >
            {/* Circular arrow icon (like ChatGPT) */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6"/>
              <path d="M2.5 22v-6h6"/>
              <path d="M2.5 11.5a10 10 0 0 1 18.1-4.5l.9 1"/>
              <path d="M21.5 12.5a10 10 0 0 1-18.1 4.5l-.9-1"/>
            </svg>
          </button>

          {/* Theme toggle in top bar (visible when sidebar collapsed) */}
          {sidebarCollapsed && (
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} t={t} />
          )}

          {/* LLM model badge */}
          {llmStatus && (
            <div
              title={llmStatus.available
                ? `Llama model: ${llmStatus.model || llmStatus.provider}`
                : `LLM: ${llmStatus.provider} (rule-based mode)`}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, cursor: 'default',
                backgroundColor: llmStatus.available
                  ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)')
                  : (isDark ? 'rgba(100,116,139,0.15)' : 'rgba(100,116,139,0.1)'),
                color: llmStatus.available
                  ? (isDark ? '#a78bfa' : '#6366f1')
                  : t.textMuted,
              }}
            >
              {llmStatus.available ? '🦙' : '⚡'}
              {llmStatus.available
                ? (llmStatus.model || 'Llama').replace(/\.gguf$/, '').split('/').pop().slice(0, 20)
                : 'Rule-based'}
            </div>
          )}

          <div style={{
            padding: '4px 10px', borderRadius: 12,
            backgroundColor: t.accentBg, color: t.accentText,
            fontSize: 11, fontWeight: 600,
          }}>● Online</div>
        </div>

        {/* Temporary chat banner */}
        {temporaryChat && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '8px 16px',
            backgroundColor: isDark ? 'rgba(250,204,21,0.06)' : 'rgba(202,138,4,0.05)',
            borderBottom: `1px solid ${isDark ? 'rgba(250,204,21,0.15)' : 'rgba(202,138,4,0.12)'}`,
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#fbbf24' : '#b45309'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6"/>
              <path d="M2.5 22v-6h6"/>
              <path d="M2.5 11.5a10 10 0 0 1 18.1-4.5l.9 1"/>
              <path d="M21.5 12.5a10 10 0 0 1-18.1 4.5l-.9-1"/>
            </svg>
            <span style={{
              fontSize: 12, color: isDark ? '#fbbf24' : '#b45309', fontWeight: 500,
            }}>
              This is a temporary chat — it won't appear in your history or sidebar
            </span>
            <button
              onClick={handleToggleTemporaryChat}
              style={{
                background: 'none', border: 'none',
                color: isDark ? '#fbbf24' : '#b45309',
                cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
                fontSize: 12, fontWeight: 600, textDecoration: 'underline',
                opacity: 0.8,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
            >
              Turn off
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="chat-scroll" style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {isEmpty ? (
            <WelcomeScreen onSend={sendMessage} t={t} />
          ) : (
            <>
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} documentName={m.documentName} t={t} />
              ))}
              {loading && <TypingIndicator t={t} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick chips */}
        {!isEmpty && !loading && messages.length <= 4 && (
          <ActionChips onSend={sendMessage} hasDoc={!!documentName} t={t} />
        )}

        {/* ── Input ───────────────────────── */}
        <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ maxWidth: 760, width: '100%' }}>

            {/* Pending file */}
            {pendingFile && <FilePreview file={pendingFile} onRemove={() => setPendingFile(null)} t={t} />}

            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 0,
              backgroundColor: t.bgInput, borderRadius: 16,
              border: `1px solid ${t.borderLight}`, padding: '8px 8px 8px 16px',
            }}>
              {/* Attach */}
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Upload PDF or DOCX"
                style={{
                  background: 'none', border: 'none', color: t.textMuted,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: 6, borderRadius: 8, display: 'flex',
                  alignItems: 'center', flexShrink: 0, marginBottom: 2,
                  transition: 'color .15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.color = t.text }}
                onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="chat-ta"
                rows={1}
                placeholder={documentName ? 'Ask about compliance, missing controls, improvements...' : 'Message AI Compliance Guard...'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  backgroundColor: 'transparent', color: t.text,
                  fontSize: 15, resize: 'none', padding: '8px',
                  maxHeight: 200, lineHeight: 1.5, fontFamily: 'inherit',
                }}
              />

              {/* Send */}
              <button
                onClick={() => {
                  if (pendingFile && !input.trim()) { const f = pendingFile; setPendingFile(null); handleUploadOnly(f) }
                  else sendMessage()
                }}
                disabled={loading || (!input.trim() && !pendingFile)}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  backgroundColor: (input.trim() || pendingFile) && !loading ? t.accent : t.btnDisabled,
                  color: (input.trim() || pendingFile) && !loading ? 'white' : t.btnDisabledText,
                  cursor: (input.trim() || pendingFile) && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all .15s', marginBottom: 2,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>

            <div style={{ textAlign: 'center', color: t.textDimmed, fontSize: 11, marginTop: 8 }}>
              Upload PDF/DOCX compliance documents • Supports ISO 27001, ISO 9001, NIST, GDPR
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Settings Modal */}
    <SettingsModal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      autoDelete={autoDeleteDuration}
      onChangeAutoDelete={handleAutoDeleteChange}
      onDeleteAllChats={handleDeleteAllChats}
      onLogout={onLogout}
      user={user}
      t={t}
      isDark={isDark}
      onToggleTheme={toggleTheme}
    />
    </>
  )
}
