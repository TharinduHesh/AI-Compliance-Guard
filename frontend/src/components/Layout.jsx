import React, { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  Container,
  Button,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  createTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import SecurityIcon from '@mui/icons-material/Security'
import ChatIcon from '@mui/icons-material/Chat'
import DashboardIcon from '@mui/icons-material/Dashboard'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import AssessmentIcon from '@mui/icons-material/Assessment'
import HistoryIcon from '@mui/icons-material/History'
import InfoIcon from '@mui/icons-material/Info'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { useNavigate } from 'react-router-dom'
import { useTheme as useAppTheme } from '../ThemeContext'

/* Admin sees ALL pages (full control). Users see everything except Admin. */
const adminPages = [
  { name: 'Admin Panel', path: '/admin', icon: <AdminPanelSettingsIcon /> },
  { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
]

const userPages = [
  { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { name: 'AI Chat', path: '/chat', icon: <ChatIcon /> },
  { name: 'Upload Document', path: '/upload', icon: <UploadFileIcon /> },
  { name: 'Frameworks', path: '/frameworks', icon: <AssessmentIcon /> },
  { name: 'History', path: '/history', icon: <HistoryIcon /> },
  { name: 'About', path: '/about', icon: <InfoIcon /> },
]

function Layout({ children, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const userRole = (() => { try { return JSON.parse(localStorage.getItem('user'))?.role } catch { return null } })()
  const isChatRoute = location.pathname === '/chat'
  const pages = userRole === 'admin'
    ? adminPages
    : (isChatRoute ? userPages.filter((page) => page.path !== '/dashboard') : userPages)
  const { isDark } = useAppTheme()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (onLogout) onLogout()
    navigate('/')
  }

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
    },
    typography: { fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif' },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  }), [isDark])

  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const sidebarBg = isDark ? '#111827' : '#1e293b'
  const footerBg = isDark ? '#111827' : '#1e293b'
  const footerBorder = isDark ? '#1f2937' : '#334155'

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2, color: 'white' }}>
        🔐 AIComplianceGuard
      </Typography>
      <Divider sx={{ borderColor: footerBorder }} />
      <List>
        {pages.map((page) => (
          <ListItem
            key={page.name}
            component={Link}
            to={page.path}
            selected={location.pathname === page.path}
            sx={{
              color: 'white',
              '&.Mui-selected': {
                backgroundColor: '#1e3a8a',
                color: 'white',
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
              },
              '&:hover': {
                backgroundColor: '#334155',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'white' }}>{page.icon}</ListItemIcon>
            <ListItemText primary={page.name} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ borderColor: footerBorder }} />
      <List>
        <ListItem
          button
          onClick={handleLogout}
          sx={{ color: 'white', '&:hover': { backgroundColor: '#334155' } }}
        >
          <ListItemIcon sx={{ color: 'white' }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  )

  return (
    <MuiThemeProvider theme={muiTheme}>
    <CssBaseline />
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={2}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <SecurityIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
            <Typography
              variant="h6"
              noWrap
              component={Link}
              to="/"
              sx={{
                mr: 2,
                display: { xs: 'none', md: 'flex' },
                fontWeight: 700,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              AIComplianceGuard
            </Typography>

            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
              {pages.map((page) => (
                <Button
                  key={page.name}
                  component={Link}
                  to={page.path}
                  sx={{
                    my: 2,
                    color: 'white',
                    display: 'block',
                    backgroundColor:
                      location.pathname === page.path ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  {page.name}
                </Button>
              ))}
            </Box>

            <Button
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{
                color: 'white',
                textTransform: 'none',
                ml: 1,
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              Logout
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: 240,
            backgroundColor: sidebarBg,
            color: '#ffffff',
          },
        }}
      >
        {drawer}
      </Drawer>

      {location.pathname === '/chat' ? (
        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
          {children}
        </Box>
      ) : (
        <>
          <Box component="main" sx={{ flexGrow: 1, py: 3, backgroundColor: 'background.default' }}>
            <Container maxWidth="xl">{children}</Container>
          </Box>
          <Box
            component="footer"
            sx={{
              py: 3,
              px: 2,
              mt: 'auto',
              backgroundColor: footerBg,
              borderTop: `1px solid ${footerBorder}`,
            }}
          >
            <Container maxWidth="xl">
              <Typography variant="body2" sx={{ color: '#94a3b8' }} align="center">
                © 2026 AIComplianceGuard - Secure AI-Powered Compliance Validation Platform
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }} align="center" display="block">
                All Right Reserved
              </Typography>
            </Container>
          </Box>
        </>
      )}
    </Box>
    </MuiThemeProvider>
  )
}

export default Layout
