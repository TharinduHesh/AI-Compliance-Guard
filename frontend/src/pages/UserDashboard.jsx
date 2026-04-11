import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Card, CardContent, Typography, Button, Paper, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Divider, CircularProgress, Alert,
  ThemeProvider as MuiThemeProvider, CssBaseline, createTheme,
} from '@mui/material'
import {
  Chat as ChatIcon,
  UploadFile as UploadIcon,
  Assessment as AnalysisIcon,
  History as HistoryIcon,
  Security as SecurityIcon,
  TrendingUp as TrendIcon,
  Description as DocIcon,
  Info as InfoIcon,
  ArrowForward as ArrowIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { useTheme as useAppTheme } from '../ThemeContext'

/* ── Helpers ───────────────────────────────────────────────── */
// Backend uses datetime.utcnow().isoformat() — no 'Z' suffix.
// Append 'Z' so JS treats them as UTC and converts to local time.
const toUtcDate = (iso) => {
  if (!iso) return null
  if (iso.endsWith('Z') || iso.includes('+')) return new Date(iso)
  return new Date(iso + 'Z')
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  return toUtcDate(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const fmtRelative = (iso) => {
  if (!iso) return ''
  const d = toUtcDate(iso)
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ── Component ─────────────────────────────────────────────── */
export default function UserDashboard() {
  const navigate = useNavigate()
  const { isDark, toggle: toggleTheme } = useAppTheme()

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      ...(isDark ? {
        background: { default: '#0f172a', paper: '#1e293b' },
        text: { primary: '#e2e8f0', secondary: '#94a3b8' },
        divider: '#334155',
      } : {
        background: { default: '#f8fafc', paper: '#ffffff' },
        text: { primary: '#1e293b', secondary: '#475569' },
        divider: '#e2e8f0',
      }),
      primary: { main: '#35627A' },
      success: { main: '#8E9A98' },
      warning: { main: '#B46258' },
      error: { main: '#ef4444' },
      info: { main: '#A6A9D0' },
    },
    shape: { borderRadius: 10 },
    typography: { fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif' },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: isDark ? '#334155' : '#e2e8f0' } } },
    },
  }), [isDark])

  /* ── User info ───────────────────────────────────────────── */
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const isAdmin = currentUser.role === 'admin'

  /* ── Analysis history from localStorage ──────────────────── */
  const [history, setHistory] = useState([])

  useEffect(() => {
    try {
      const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
      })()
      const historyKey = `analysisHistory:${currentUser.company_id || 'anonymous'}`
      const saved = localStorage.getItem(historyKey) || localStorage.getItem('analysisHistory')
      if (saved) setHistory(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  /* ── Derived stats ───────────────────────────────────────── */
  const totalAnalyses = history.length
  const avgCompliance = totalAnalyses > 0
    ? Math.round(history.reduce((s, h) => s + (h.complianceScore || 0), 0) / totalAnalyses)
    : 0
  const recentUploads = history.filter(h => {
    if (!h.analyzedAt) return false
    const d = toUtcDate(h.analyzedAt)
    return d && (Date.now() - d.getTime()) < 7 * 86400000
  }).length

  const theadBg = isDark ? '#1e293b' : '#f1f5f9'

  const statCards = [
    { icon: <AnalysisIcon />, value: totalAnalyses, label: 'Total Analyses', color: '#35627A', bg: isDark ? '#1f3645' : '#e8eff2' },
    { icon: <UploadIcon />, value: recentUploads, label: 'This Week', color: '#A6A9D0', bg: isDark ? '#2d304c' : '#ececf8' },
    { icon: <TrendIcon />, value: `${avgCompliance}%`, label: 'Avg Compliance', color: '#8E9A98', bg: isDark ? '#2a3332' : '#edf1f0' },
    { icon: <SecurityIcon />, value: 4, label: 'Frameworks', color: '#B46258', bg: isDark ? '#442925' : '#f5dfdc' },
  ]

  const quickActions = [
    ...(!isAdmin ? [{ icon: <ChatIcon />, title: 'AI Chat', desc: 'Ask compliance questions', path: '/chat', color: '#35627A' }] : []),
    { icon: <UploadIcon />, title: 'Upload Document', desc: 'Analyze a new document', path: '/upload', color: '#B46258' },
    { icon: <HistoryIcon />, title: 'History', desc: 'View past analyses', path: '/history', color: '#8E9A98' },
    { icon: <DocIcon />, title: 'Frameworks', desc: 'Browse supported frameworks', path: '/frameworks', color: '#A6A9D0' },
    { icon: <InfoIcon />, title: 'About', desc: 'Learn about AIComplianceGuard', path: '/about', color: '#E5AEA9' },
  ]

  const getRiskColor = (level) => {
    const l = (level || '').toLowerCase()
    if (l.includes('low')) return 'success'
    if (l.includes('medium')) return 'warning'
    if (l.includes('high')) return 'error'
    return 'default'
  }

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100%' }}>

        {/* ── Header ────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              {currentUser.company_id?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">
                Welcome back, <strong>{currentUser.company_name || currentUser.company_id || 'User'}</strong>
              </Typography>
            </Box>
          </Box>
          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton onClick={toggleTheme} size="small"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5 }}>
              {isDark ? <LightModeIcon fontSize="small" sx={{ color: '#fbbf24' }} /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* ── Stat Cards ────────────────────────────────────── */}
        <Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
          {statCards.map((s, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Avatar sx={{ bgcolor: s.bg, color: s.color, width: 48, height: 48 }}>
                    {s.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} lineHeight={1}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* ── Quick Actions ─────────────────────────────────── */}
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Quick Actions</Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {quickActions.map((a, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Card
                elevation={0}
                onClick={() => navigate(a.path)}
                sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: 2,
                  cursor: 'pointer', transition: 'all .15s',
                  '&:hover': { borderColor: a.color, transform: 'translateY(-2px)', boxShadow: 3 },
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Avatar sx={{ bgcolor: isDark ? `${a.color}22` : `${a.color}18`, color: a.color, width: 44, height: 44, mx: 'auto', mb: 1 }}>
                    {a.icon}
                  </Avatar>
                  <Typography variant="subtitle2" fontWeight={600}>{a.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* ── Recent Analysis History ───────────────────────── */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon color="primary" fontSize="small" />
              <Typography variant="h6" fontWeight={600}>Recent Analyses</Typography>
            </Box>
            {history.length > 0 && (
              <Button size="small" endIcon={<ArrowIcon />} onClick={() => navigate('/history')} sx={{ textTransform: 'none' }}>
                View All
              </Button>
            )}
          </Box>

          <TableContainer>
            {history.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <DocIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">No analyses yet</Typography>
                <Button variant="contained" size="small" sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
                  startIcon={<UploadIcon />} onClick={() => navigate('/upload')}>
                  Upload Your First Document
                </Button>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theadBg }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>File Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Frameworks</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Risk Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Compliance</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.slice(0, 10).map((item, idx) => (
                    <TableRow key={item.analysisId || idx} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                          {item.fileName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(item.frameworks || []).map(f => (
                            <Chip key={f} label={f.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.riskLevel || 'N/A'} size="small" color={getRiskColor(item.riskLevel)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.complianceScore != null ? `${item.complianceScore}%` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{fmtDate(item.analyzedAt)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="primary"
                          onClick={() => navigate(`/results/${item.analysisId}`, { state: { results: item.results } })}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Paper>
      </Box>
    </MuiThemeProvider>
  )
}
