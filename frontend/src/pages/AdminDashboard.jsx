import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  Avatar,
  Tooltip,
  InputAdornment,
  TablePagination,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  createTheme,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  History as HistoryIcon,
  Login as LoginIcon,
  UploadFile as UploadIcon,
  Assessment as AnalysisIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  AccessTime as TimeIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Chat as ChatIcon,
  FolderOpen as FolderIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { adminAPI } from '../services/api'
import { useTheme as useAppTheme } from '../ThemeContext'

/* ── Helpers ──────────────────────────────────────────────── */
// Backend returns UTC timestamps via datetime.utcnow().isoformat() — no 'Z' suffix.
// Append 'Z' so JS parses them as UTC and converts to local time correctly.
const toUtcDate = (iso) => {
  if (!iso) return null
  // Already has timezone info
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
  if (!iso) return 'Never'
  const d = toUtcDate(iso)
  if (!d) return 'Never'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const activityIcon = (action) => {
  switch (action) {
    case 'login': return <LoginIcon fontSize="small" color="success" />
    case 'upload': return <UploadIcon fontSize="small" color="primary" />
    case 'analysis': return <AnalysisIcon fontSize="small" color="warning" />
    case 'create_user': return <PersonAddIcon fontSize="small" color="info" />
    case 'delete_user': return <PersonRemoveIcon fontSize="small" color="error" />
    default: return <HistoryIcon fontSize="small" color="disabled" />
  }
}

const activityColor = (action) => {
  const map = { login: 'success', upload: 'primary', analysis: 'warning', create_user: 'info', delete_user: 'error' }
  return map[action] || 'default'
}

/* ── Main Component ───────────────────────────────────────── */
export default function AdminDashboard() {
  const { isDark, toggle: toggleTheme } = useAppTheme()

  // Build a MUI theme that follows our app dark/light setting
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
      error:   { main: '#ef4444' },
      info:    { main: '#A6A9D0' },
    },
    shape: { borderRadius: 10 },
    typography: { fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif' },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
        },
      },
    },
  }), [isDark])

  const [tab, setTab] = useState(0)
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [actLoading, setActLoading] = useState(true)
  const [error, setError] = useState('')

  // Add-user dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ company_id: '', company_name: '', password: '', role: 'user' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  // Activity filters
  const [actSearch, setActSearch] = useState('')
  const [actFilter, setActFilter] = useState('all')
  const [actPage, setActPage] = useState(0)
  const [actRowsPerPage, setActRowsPerPage] = useState(10)
  const [historyDeletePeriod, setHistoryDeletePeriod] = useState('month')

  // User Documents state
  const [userDocs, setUserDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsSearch, setDocsSearch] = useState('')
  const [docsFilter, setDocsFilter] = useState('all')
  const [docsPage, setDocsPage] = useState(0)
  const [docsRowsPerPage, setDocsRowsPerPage] = useState(10)

  // Uploaded Files state (actual files on disk)
  const [userFiles, setUserFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [monitorActionLoading, setMonitorActionLoading] = useState(false)

  /* Auth guard */
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const isAdmin = currentUser.role === 'admin'

  /* ── Data fetchers ─────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('')
    try { setUsers(await adminAPI.listUsers()) }
    catch (e) { setError(e?.response?.data?.detail || 'Failed to load users') }
    finally { setLoading(false) }
  }, [])

  const fetchActivities = useCallback(async () => {
    setActLoading(true)
    try { setActivities(await adminAPI.listActivities(null, 5000)) }
    catch { /* silent */ }
    finally { setActLoading(false) }
  }, [])

  const fetchUserDocs = useCallback(async () => {
    setDocsLoading(true)
    try { setUserDocs(await adminAPI.getUserDocuments(null, 500)) }
    catch { /* silent */ }
    finally { setDocsLoading(false) }
  }, [])

  const fetchUserFiles = useCallback(async () => {
    setFilesLoading(true)
    try { setUserFiles(await adminAPI.getUserFiles()) }
    catch { /* silent */ }
    finally { setFilesLoading(false) }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try { setAnalytics(await adminAPI.getAnalytics()) }
    catch { setAnalytics(null) }
    finally { setAnalyticsLoading(false) }
  }, [])

  const fetchAutoDeleteSettings = useCallback(async () => {
    try {
      const cfg = await adminAPI.getAutoDeleteSettings()
      if (cfg?.history_period) {
        setHistoryDeletePeriod(cfg.history_period)
      }
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    if (isAdmin) { fetchUsers(); fetchActivities(); fetchUserDocs(); fetchUserFiles(); fetchAnalytics(); fetchAutoDeleteSettings() }
  }, [isAdmin, fetchUsers, fetchActivities, fetchUserDocs, fetchUserFiles, fetchAnalytics, fetchAutoDeleteSettings])

  const refreshAll = () => { fetchUsers(); fetchActivities(); fetchUserDocs(); fetchUserFiles(); fetchAnalytics(); fetchAutoDeleteSettings() }

  /* ── Add user ──────────────────────────────────────────── */
  const handleOpenAdd = () => {
    setFormData({ company_id: '', company_name: '', password: '', role: 'user' })
    setFormError('')
    setDialogOpen(true)
  }

  const handleAddUser = async () => {
    const { company_id, company_name, password, role } = formData
    if (!company_id.trim() || !company_name.trim() || !password) { setFormError('All fields are required'); return }
    if (company_id.trim().length < 3) { setFormError('Company ID must be at least 3 characters'); return }
    if (password.length < 6) { setFormError('Password must be at least 6 characters'); return }
    setSubmitting(true); setFormError('')
    try {
      await adminAPI.createUser(company_id.trim(), company_name.trim(), password, role)
      toast.success(`User "${company_id.trim()}" created successfully`)
      setDialogOpen(false)
      refreshAll()
    } catch (e) { setFormError(e?.response?.data?.detail || 'Failed to create user') }
    finally { setSubmitting(false) }
  }

  /* ── Delete user ───────────────────────────────────────── */
  const handleDeleteClick = (u) => { setSelectedUser(u); setDeleteDialogOpen(true) }
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return
    try {
      await adminAPI.deleteUser(selectedUser.company_id)
      toast.success(`User "${selectedUser.company_id}" deleted`)
      setDeleteDialogOpen(false); setSelectedUser(null)
      refreshAll()
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to delete user') }
  }

  const handleSaveAutoDeleteSettings = async () => {
    setSettingsSaving(true)
    try {
      await adminAPI.updateAutoDeleteSettings(historyDeletePeriod)
      toast.success(`Auto delete duration updated to ${historyDeletePeriod.replace('_', ' ')}`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update auto delete settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleDeleteMonitoringData = async (targetType, value = null, deleteAll = false, label = 'item') => {
    setMonitorActionLoading(true)
    try {
      const res = await adminAPI.deleteChatTrackerData(targetType, value, deleteAll)
      toast.success(`Deleted ${res.deleted || 0} chat records for ${label}`)
      await fetchAnalytics()
      await fetchHistory()
      await fetchActivities()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to delete monitoring data')
    } finally {
      setMonitorActionLoading(false)
    }
  }

  /* ── Access guard ──────────────────────────────────────── */
  if (!isAdmin) {
    return (
      <MuiThemeProvider theme={muiTheme}>
        <Box sx={{ py: 4 }}>
          <Alert severity="error" variant="filled">Access Denied — Only administrators can access this page.</Alert>
        </Box>
      </MuiThemeProvider>
    )
  }

  /* ── Computed ──────────────────────────────────────────── */
  const adminCount = users.filter(u => u.role === 'admin').length
  const userCount = users.filter(u => u.role === 'user').length
  const onlineRecent = users.filter(u => {
    if (!u.last_login) return false
    return (Date.now() - toUtcDate(u.last_login).getTime()) < 86400000 // 24h
  }).length

  // Build a complete upload list: upload activity history + disk-backed files.
  const diskFileIndex = {}
  ;(userFiles || []).forEach((f) => {
    const key = `${f.user || ''}::${(f.filename || '').toLowerCase()}`
    if (!diskFileIndex[key]) {
      diskFileIndex[key] = []
    }
    diskFileIndex[key].push(f)
  })

  const allUploadedDocs = (userDocs || [])
    .filter((d) => d.action === 'upload')
    .map((d, idx) => {
      const key = `${d.user || ''}::${(d.filename || '').toLowerCase()}`
      const diskMatch = (diskFileIndex[key] || [])[0] || null
      return {
        id: `${d.user || 'user'}_${d.timestamp || idx}`,
        user: d.user,
        user_name: d.user_name || d.company_name || d.user,
        company_name: d.company_name,
        filename: d.filename,
        uploaded_at: d.timestamp || diskMatch?.uploaded_at,
        size_bytes: diskMatch?.size_bytes || null,
        stored_name: diskMatch?.stored_name || null,
      }
    })

  // Build a complete activities stream: backend activity log + upload records.
  // This ensures Upload actions appear even when activity windows are trimmed.
  const uploadActivityRows = allUploadedDocs.map((d) => ({
    user: d.user,
    action: 'upload',
    detail: d.filename ? `Uploaded ${d.filename}` : 'Uploaded document',
    timestamp: d.uploaded_at || '',
  }))

  const combinedActivities = [...(activities || []), ...uploadActivityRows]
    .filter((a) => a && a.user)
    .reduce((acc, row) => {
      const key = `${row.user || ''}::${row.action || ''}::${row.detail || ''}::${row.timestamp || ''}`
      if (!acc.map[key]) {
        acc.map[key] = true
        acc.items.push(row)
      }
      return acc
    }, { map: {}, items: [] }).items
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))

  const filteredActivities = combinedActivities.filter(a => {
    if (actFilter !== 'all' && a.action !== actFilter) return false
    if (actSearch && !a.user?.toLowerCase().includes(actSearch.toLowerCase()) &&
        !a.detail?.toLowerCase().includes(actSearch.toLowerCase())) return false
    return true
  })

  // Per-user activity counts (based on complete combined activity stream)
  const userActivityMap = {}
  combinedActivities.forEach(a => {
    if (!userActivityMap[a.user]) userActivityMap[a.user] = { logins: 0, uploads: 0, analyses: 0, total: 0 }
    userActivityMap[a.user].total++
    if (a.action === 'login') userActivityMap[a.user].logins++
    if (a.action === 'upload') userActivityMap[a.user].uploads++
    if (a.action === 'analysis') userActivityMap[a.user].analyses++
  })

  // Stat-card palette — theme-aware backgrounds
  const statCards = [
    { icon: <GroupIcon />, value: users.length, label: 'Total Accounts', color: '#35627A', bg: isDark ? '#1f3645' : '#e8eff2' },
    { icon: <PersonIcon />, value: userCount, label: 'Users', color: '#0891b2', bg: isDark ? '#083344' : '#ecfeff' },
    { icon: <AdminIcon />, value: adminCount, label: 'Admins', color: '#d97706', bg: isDark ? '#422006' : '#fffbeb' },
    { icon: <TimeIcon />, value: onlineRecent, label: 'Active (24h)', color: '#16a34a', bg: isDark ? '#052e16' : '#f0fdf4' },
  ]

  const theadBg = isDark ? '#1e293b' : '#f1f5f9'

  return (
    <MuiThemeProvider theme={muiTheme}>
    <CssBaseline />
    <Box sx={{ minHeight: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <AdminIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={700}>Admin Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage users and monitor all user activities
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton onClick={toggleTheme} size="small"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5 }}>
              {isDark ? <LightModeIcon fontSize="small" sx={{ color: '#fbbf24' }} /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button startIcon={<RefreshIcon />} onClick={refreshAll} variant="outlined" size="small">
            Refresh
          </Button>
        </Box>
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

      {/* ── Tabs ──────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tab icon={<PersonIcon />} iconPosition="start" label="User Management" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<FolderIcon />} iconPosition="start" label="User Documents" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="User Activities" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<AnalysisIcon />} iconPosition="start" label="Monitoring" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>

        {/* ────────────── TAB 0: User Management ────────── */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Registered Users
              </Typography>
              <Button startIcon={<AddIcon />} onClick={handleOpenAdd} variant="contained" size="small"
                sx={{ borderRadius: 2, textTransform: 'none' }}>
                Add User
              </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer>
              {loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theadBg }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Company ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Company Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Last Login</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Activity</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography color="text.secondary" sx={{ py: 3 }}>No users found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user, idx) => {
                        const ua = userActivityMap[user.company_id] || { logins: 0, uploads: 0, analyses: 0, total: 0 }
                        return (
                          <TableRow key={user.company_id} hover>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{
                                  width: 28, height: 28, fontSize: 13,
                                  bgcolor: user.role === 'admin' ? 'warning.main' : 'primary.main',
                                }}>
                                  {user.company_id.charAt(0).toUpperCase()}
                                </Avatar>
                                <strong>{user.company_id}</strong>
                              </Box>
                            </TableCell>
                            <TableCell>{user.company_name}</TableCell>
                            <TableCell>
                              <Chip label={user.role} size="small" variant="outlined"
                                color={user.role === 'admin' ? 'warning' : 'info'} />
                            </TableCell>
                            <TableCell>
                              <Tooltip title={fmtDate(user.last_login)}>
                                <span>{fmtRelative(user.last_login)}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title={`${ua.logins} logins`}>
                                  <Chip icon={<LoginIcon />} label={ua.logins} size="small" variant="outlined" color="success" sx={{ fontSize: 11 }} />
                                </Tooltip>
                                <Tooltip title={`${ua.uploads} uploads`}>
                                  <Chip icon={<UploadIcon />} label={ua.uploads} size="small" variant="outlined" color="primary" sx={{ fontSize: 11 }} />
                                </Tooltip>
                                <Tooltip title={`${ua.analyses} analyses`}>
                                  <Chip icon={<AnalysisIcon />} label={ua.analyses} size="small" variant="outlined" color="warning" sx={{ fontSize: 11 }} />
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell>{fmtDate(user.created_at)}</TableCell>
                            <TableCell align="center">
                              {user.role !== 'admin' ? (
                                <IconButton color="error" size="small" onClick={() => handleDeleteClick(user)} title="Delete user">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              ) : (
                                <Chip label="Protected" size="small" color="default" sx={{ fontSize: 11 }} />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </TableContainer>
          </Box>
        )}

        {/* ────────────── TAB 1: User Documents ─────────── */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            {/* ── Uploaded Files Section ── */}
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileIcon color="primary" /> Uploaded Files
            </Typography>

            {/* Search bar for files */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small" placeholder="Search user or filename..."
                value={docsSearch} onChange={e => { setDocsSearch(e.target.value); setDocsPage(0) }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 260 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                {(() => {
                  const q = docsSearch.toLowerCase()
                  const f = allUploadedDocs.filter(d =>
                    !q || d.user?.toLowerCase().includes(q) || d.user_name?.toLowerCase().includes(q) || d.company_name?.toLowerCase().includes(q) || d.filename?.toLowerCase().includes(q)
                  )
                  return `${f.length} files`
                })()}
              </Typography>
            </Box>

            <TableContainer>
              {filesLoading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
              ) : (
                (() => {
                  const q = docsSearch.toLowerCase()
                  const filtered = allUploadedDocs.filter(d =>
                    !q || d.user?.toLowerCase().includes(q) || d.user_name?.toLowerCase().includes(q) || d.company_name?.toLowerCase().includes(q) || d.filename?.toLowerCase().includes(q)
                  )
                  return (
                    <>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: theadBg }}>
                            <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>User Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>File Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Uploaded At</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filtered.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} align="center">
                                <Box sx={{ py: 4, textAlign: 'center' }}>
                                  <FolderIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                  <Typography color="text.secondary">No uploaded files found</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Files will appear here when users upload documents via the chat
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filtered
                              .slice(docsPage * docsRowsPerPage, docsPage * docsRowsPerPage + docsRowsPerPage)
                              .map((f, idx) => {
                                const sizeLabel = f.size_bytes
                                  ? (f.size_bytes > 1024 * 1024
                                    ? `${(f.size_bytes / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(f.size_bytes / 1024).toFixed(1)} KB`)
                                  : '—'
                                const ext = f.filename?.split('.').pop()?.toLowerCase() || ''
                                const isPDF = ext === 'pdf'
                                return (
                                  <TableRow key={f.id || idx} hover>
                                    <TableCell>{docsPage * docsRowsPerPage + idx + 1}</TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'primary.main' }}>
                                          {f.user?.charAt(0)?.toUpperCase() || '?'}
                                        </Avatar>
                                        <strong>{f.user}</strong>
                                      </Box>
                                    </TableCell>
                                    <TableCell>{f.user_name || f.company_name || f.user || '—'}</TableCell>
                                    <TableCell>{f.company_name || '—'}</TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Chip
                                          label={isPDF ? 'PDF' : ext.toUpperCase()}
                                          size="small"
                                          color={isPDF ? 'error' : 'info'}
                                          variant="outlined"
                                          sx={{ fontSize: 10, height: 20, mr: 0.5 }}
                                        />
                                        <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
                                          {f.filename}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2">{sizeLabel}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" color="text.secondary">
                                        {fmtDate(f.uploaded_at)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Tooltip title={f.stored_name ? 'Download file' : 'File metadata only (not available on disk)'}>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          disabled={!f.stored_name}
                                          onClick={() => {
                                            const url = adminAPI.downloadUserFile(f.user, f.stored_name)
                                            window.open(url, '_blank')
                                          }}
                                        >
                                          <DownloadIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                          )}
                        </TableBody>
                      </Table>
                      <TablePagination
                        component="div"
                        count={filtered.length}
                        page={docsPage}
                        onPageChange={(_, p) => setDocsPage(p)}
                        rowsPerPage={docsRowsPerPage}
                        onRowsPerPageChange={e => { setDocsRowsPerPage(parseInt(e.target.value, 10)); setDocsPage(0) }}
                        rowsPerPageOptions={[10, 25, 50]}
                      />
                    </>
                  )
                })()
              )}
            </TableContainer>
          </Box>
        )}

        {/* ────────────── TAB 2: User Activities ─────────── */}
        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small" placeholder="Search user or detail..."
                value={actSearch} onChange={e => { setActSearch(e.target.value); setActPage(0) }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 220 }}
              />
              <TextField
                select size="small" value={actFilter}
                onChange={e => { setActFilter(e.target.value); setActPage(0) }}
                InputProps={{ startAdornment: <InputAdornment position="start"><FilterIcon fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All Activities</MenuItem>
                <MenuItem value="login">Logins</MenuItem>
                <MenuItem value="upload">Uploads</MenuItem>
                <MenuItem value="analysis">Analyses</MenuItem>
                <MenuItem value="create_user">User Created</MenuItem>
                <MenuItem value="delete_user">User Deleted</MenuItem>
              </TextField>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                {filteredActivities.length} activities
              </Typography>
            </Box>

            <TableContainer>
              {actLoading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
              ) : (
                <>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: theadBg }}>
                        <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Detail</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredActivities.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary" sx={{ py: 3 }}>No activities recorded yet</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredActivities
                          .slice(actPage * actRowsPerPage, actPage * actRowsPerPage + actRowsPerPage)
                          .map((a, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>{actPage * actRowsPerPage + idx + 1}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: 'grey.400' }}>
                                    {a.user?.charAt(0)?.toUpperCase() || '?'}
                                  </Avatar>
                                  <strong>{a.user}</strong>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  icon={activityIcon(a.action)}
                                  label={a.action?.replace('_', ' ')}
                                  size="small"
                                  variant="outlined"
                                  color={activityColor(a.action)}
                                  sx={{ textTransform: 'capitalize', fontSize: 12 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 340 }}>
                                  {a.detail || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Tooltip title={fmtDate(a.timestamp)}>
                                  <Typography variant="body2" color="text.secondary">{fmtRelative(a.timestamp)}</Typography>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={filteredActivities.length}
                    page={actPage}
                    onPageChange={(_, p) => setActPage(p)}
                    rowsPerPage={actRowsPerPage}
                    onRowsPerPageChange={e => { setActRowsPerPage(parseInt(e.target.value, 10)); setActPage(0) }}
                    rowsPerPageOptions={[10, 25, 50]}
                  />
                </>
              )}
            </TableContainer>
          </Box>
        )}

        {/* ────────────── TAB 3: Monitoring ─────────────── */}
        {tab === 3 && (
          <Box sx={{ p: 2 }}>
            {analyticsLoading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
            ) : (
              (() => {
                const tracker = analytics?.chat_tracker || {}
                const topUsers = tracker.top_chat_users || []
                const topQueries = tracker.top_search_queries || []
                const mostActive = tracker.most_active_chat_user

                return (
                  <>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                      Monitoring Dashboard
                    </Typography>

                    <Paper elevation={0} sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 190 }}>
                          Auto delete time duration
                        </Typography>
                        <TextField
                          select
                          size="small"
                          value={historyDeletePeriod}
                          onChange={e => setHistoryDeletePeriod(e.target.value)}
                          sx={{ minWidth: 180 }}
                        >
                          <MenuItem value="week">Once a week</MenuItem>
                          <MenuItem value="month">Once a month</MenuItem>
                          <MenuItem value="three_months">Three months</MenuItem>
                        </TextField>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSaveAutoDeleteSettings}
                          disabled={settingsSaving}
                          sx={{ textTransform: 'none' }}
                        >
                          {settingsSaving ? 'Saving...' : 'Save duration'}
                        </Button>
                      </Box>
                    </Paper>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <CardContent>
                            <Typography variant="caption" color="text.secondary">Most Active User</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
                              {mostActive?.company_name || mostActive?.user || '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {mostActive ? `${mostActive.chats} chat messages` : 'No chat data'}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <CardContent>
                            <Typography variant="caption" color="text.secondary">Total Chat Messages</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
                              {tracker.total_chat_messages ?? 0}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <CardContent>
                            <Typography variant="caption" color="text.secondary">Most Asked Questions</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
                              {topQueries.length}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>Top Users by Chat Usage</Typography>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              startIcon={<DeleteIcon />}
                              disabled={monitorActionLoading || topUsers.length === 0}
                              onClick={() => handleDeleteMonitoringData('top_user', null, true, 'all top users')}
                              sx={{ textTransform: 'none' }}
                            >
                              Clear All
                            </Button>
                          </Box>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: theadBg }}>
                                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Chats</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="center">Delete</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {topUsers.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center"><Typography sx={{ py: 2 }} color="text.secondary">No data yet</Typography></TableCell></TableRow>
                              ) : (
                                topUsers.map((u, idx) => (
                                  <TableRow key={`${u.user}-${idx}`} hover>
                                    <TableCell>{idx + 1}</TableCell>
                                    <TableCell><strong>{u.user}</strong></TableCell>
                                    <TableCell>{u.company_name || '—'}</TableCell>
                                    <TableCell><Chip size="small" color="info" label={u.chats} /></TableCell>
                                    <TableCell align="center">
                                      <IconButton
                                        color="error"
                                        size="small"
                                        disabled={monitorActionLoading}
                                        onClick={() => handleDeleteMonitoringData('top_user', u.user, false, `user ${u.user}`)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Paper elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>Most Asked Questions</Typography>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteIcon />}
                          disabled={monitorActionLoading || topQueries.length === 0}
                          onClick={() => handleDeleteMonitoringData('search_query', null, true, 'all asked questions')}
                          sx={{ textTransform: 'none' }}
                        >
                          Clear All
                        </Button>
                      </Box>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: theadBg }}>
                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Query</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Count</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">Delete</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topQueries.length === 0 ? (
                            <TableRow><TableCell colSpan={4} align="center"><Typography sx={{ py: 2 }} color="text.secondary">No data yet</Typography></TableCell></TableRow>
                          ) : (
                            topQueries.slice(0, 5).map((q, idx) => (
                              <TableRow key={`${q.query}-${idx}`} hover>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 700 }}>{q.query}</Typography></TableCell>
                                <TableCell>{q.count}</TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    color="error"
                                    size="small"
                                    disabled={monitorActionLoading}
                                    onClick={() => handleDeleteMonitoringData('search_query', q.query, false, 'selected query')}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  </>
                )
              })()
            )}
          </Box>
        )}

      </Paper>

      {/* ── Add User Dialog ───────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField label="Company ID" fullWidth margin="normal" required
            value={formData.company_id}
            onChange={e => setFormData({ ...formData, company_id: e.target.value })}
            placeholder="e.g. ACME-001" inputProps={{ minLength: 3, maxLength: 50 }}
          />
          <TextField label="Company Name" fullWidth margin="normal" required
            value={formData.company_name}
            onChange={e => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="e.g. Acme Corporation"
          />
          <TextField label="Password" type="password" fullWidth margin="normal" required
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 6 characters" inputProps={{ minLength: 6 }}
          />
          <TextField label="Role" select fullWidth margin="normal"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleAddUser} variant="contained" disabled={submitting} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {submitting ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────── */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedUser?.company_id}</strong> ({selectedUser?.company_name})?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ borderRadius: 2, textTransform: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
    </MuiThemeProvider>
  )
}
