import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Box,
  Paper,
  Typography,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Description as FileIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { complianceAPI } from '../services/api'

const steps = ['Upload Document', 'Select Frameworks', 'Analyze']

function UploadDocument() {
  const [activeStep, setActiveStep] = useState(0)
  const [file, setFile] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [frameworks, setFrameworks] = useState({
    iso27001: false,
    iso9001: false,
    nist: false,
    gdpr: false,
  })
  const [includeCIA, setIncludeCIA] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const navigate = useNavigate()

  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0]
    
    if (!uploadedFile) return

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(uploadedFile.type)) {
      toast.error('Please upload a PDF or DOCX file')
      return
    }

    // Validate file size (10MB max)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setFile(uploadedFile)
    setLoading(true)

    try {
      const response = await complianceAPI.uploadDocument(uploadedFile)
      setFileId(response.file_id)
      setUploadProgress(response)
      setActiveStep(1)
      toast.success('Document uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error?.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
  })

  const handleFrameworkChange = (event) => {
    setFrameworks({
      ...frameworks,
      [event.target.name]: event.target.checked,
    })
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setActiveStep(2)

    try {
      const selectedFrameworks = Object.keys(frameworks).filter((key) => frameworks[key])
      
      if (selectedFrameworks.length === 0) {
        toast.error('Please select at least one framework')
        setLoading(false)
        setActiveStep(1)
        return
      }

      const securityFrameworks = ['iso27001', 'nist', 'gdpr']
      const hasSecurityFramework = selectedFrameworks.some((fw) => securityFrameworks.includes(fw))
      const shouldIncludeCIA = includeCIA && hasSecurityFramework

      if (includeCIA && !hasSecurityFramework) {
        toast.info('CIA analysis is intended for security/privacy frameworks and was skipped for this run.')
      }

      const response = await complianceAPI.analyzeDocument(
        fileId,
        selectedFrameworks,
        shouldIncludeCIA,
        frameworks.iso9001
      )

      saveToHistory(response)
      toast.success('Analysis completed!')
      navigate(`/results/${response.analysis_id}`, { state: { results: response } })
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error(error?.response?.data?.detail || 'Analysis failed. Please retry after re-uploading the document.')
      setActiveStep(1)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const saveToHistory = (analysisResults) => {
    try {
      const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
      })()
      const historyKey = `analysisHistory:${currentUser.company_id || 'anonymous'}`

      const historyItem = {
        analysisId: analysisResults.analysis_id,
        fileName: analysisResults.file_name,
        frameworks: analysisResults.frameworks,
        riskLevel: analysisResults.risk_prediction?.risk_level || 'Unknown',
        complianceScore: 
          Object.values(analysisResults.compliance_results)[0]?.compliance_percentage || 0,
        analyzedAt: analysisResults.analyzed_at,
        results: analysisResults,
      }

      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]')
      const updatedHistory = [historyItem, ...existingHistory].slice(0, 50) // Keep last 50 analyses
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory))
    } catch (error) {
      console.error('Error saving to history:', error)
    }
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload Compliance Document
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Upload your compliance policy document for AI-powered analysis
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Paper
          {...getRootProps()}
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.400',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.3s',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop file here' : 'Drag & drop document here'}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            or click to browse
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: PDF, DOCX (Max 10MB)
          </Typography>
          {loading && (
            <Box sx={{ mt: 3 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Uploading...
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {activeStep === 1 && uploadProgress && (
        <Box>
          <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FileIcon sx={{ mr: 2, fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h6">{uploadProgress.file_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(uploadProgress.file_size / 1024).toFixed(2)} KB | Hash: {uploadProgress.file_hash.substring(0, 16)}...
                  </Typography>
                </Box>
              </Box>
              <Alert severity="success" icon={<CheckIcon />}>
                Document uploaded successfully and ready for analysis
              </Alert>
            </CardContent>
          </Card>

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Select Frameworks
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose which frameworks to validate your document against
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox checked={frameworks.iso27001} onChange={handleFrameworkChange} name="iso27001" />
                }
                label="ISO/IEC 27001:2022 - Information Security Management"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={frameworks.iso9001} onChange={handleFrameworkChange} name="iso9001" />
                }
                label="ISO 9001:2015 - Quality Management System"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={frameworks.nist} onChange={handleFrameworkChange} name="nist" />
                }
                label="NIST Cybersecurity Framework 2.0"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={frameworks.gdpr} onChange={handleFrameworkChange} name="gdpr" />
                }
                label="GDPR/PDPA - Data Privacy Regulations"
              />
            </FormGroup>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Analysis Options
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox checked={includeCIA} onChange={(e) => setIncludeCIA(e.target.checked)} />}
                label="Include CIA (Confidentiality, Integrity, Availability) Analysis"
              />
            </FormGroup>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={handleBack}>Back</Button>
            <Button variant="contained" onClick={handleAnalyze} disabled={loading}>
              Analyze Document
            </Button>
          </Box>
        </Box>
      )}

      {activeStep === 2 && loading && (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Analyzing Document...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI models are processing your compliance document. This may take a few moments.
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default UploadDocument
