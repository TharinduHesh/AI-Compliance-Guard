import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material'

function History() {
  const [history, setHistory] = useState([])
  const [filteredHistory, setFilteredHistory] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const navigate = useNavigate()
  const historyKey = (() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      return `analysisHistory:${currentUser.company_id || 'anonymous'}`
    } catch {
      return 'analysisHistory:anonymous'
    }
  })()

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredHistory(history)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = history.filter(
        (item) =>
          item.fileName.toLowerCase().includes(query) ||
          item.frameworks.some((f) => f.toLowerCase().includes(query)) ||
          item.riskLevel.toLowerCase().includes(query)
      )
      setFilteredHistory(filtered)
    }
  }, [searchQuery, history])

  const loadHistory = () => {
    try {
      const savedHistory = localStorage.getItem(historyKey)
      const legacyHistory = localStorage.getItem('analysisHistory')
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory)
        setHistory(parsed)
        setFilteredHistory(parsed)
      } else if (legacyHistory) {
        // Backward compatibility for previously stored data
        const parsed = JSON.parse(legacyHistory)
        setHistory(parsed)
        setFilteredHistory(parsed)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const handleView = (item) => {
    navigate(`/results/${item.analysisId}`, { state: { results: item.results } })
  }

  const handleDeleteClick = (item) => {
    setSelectedItem(item)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (selectedItem) {
      const updatedHistory = history.filter((item) => item.analysisId !== selectedItem.analysisId)
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory))
      setHistory(updatedHistory)
      setFilteredHistory(updatedHistory)
      setDeleteDialogOpen(false)
      setSelectedItem(null)
    }
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      localStorage.removeItem(historyKey)
      setHistory([])
      setFilteredHistory([])
    }
  }

  const getRiskColor = (level) => {
    const lowerLevel = (level || '').toLowerCase()
    if (lowerLevel.includes('low')) return 'success'
    if (lowerLevel.includes('medium')) return 'warning'
    if (lowerLevel.includes('high')) return 'error'
    return 'default'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    // Backend returns UTC without 'Z' — append it so JS parses correctly
    const iso = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z'
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const exportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compliance_history_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (history.length === 0) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Analysis History
        </Typography>
        <Alert severity="info" sx={{ mt: 3 }}>
          No analysis history found. Upload and analyze documents to see them here.
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/upload')}
          sx={{ mt: 2 }}
        >
          Upload Document
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Analysis History
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportHistory}
            size="small"
          >
            Export
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearAll}
            size="small"
          >
            Clear All
          </Button>
        </Box>
      </Box>

      <TextField
        fullWidth
        placeholder="Search by filename, framework, or risk level..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Total analyses: {filteredHistory.length}
      </Typography>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#1e3a8a' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>File Name</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Frameworks</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Risk Level</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Compliance</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredHistory.map((item) => (
              <TableRow
                key={item.analysisId}
                hover
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell>{formatDate(item.analyzedAt)}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {item.fileName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {item.frameworks.map((framework) => (
                      <Chip
                        key={framework}
                        label={framework.toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.riskLevel}
                    color={getRiskColor(item.riskLevel)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {item.complianceScore}%
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    color="primary"
                    onClick={() => handleView(item)}
                    title="View Results"
                    size="small"
                  >
                    <ViewIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteClick(item)}
                    title="Delete"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Analysis</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the analysis for "{selectedItem?.fileName}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default History
