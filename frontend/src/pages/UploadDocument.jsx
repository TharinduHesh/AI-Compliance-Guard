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
    iso27001: true,
    iso9001: false,
    nist: false,
    gdpr: false,
  })
  const [includeCIA, setIncludeCIA] = useState(true)
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
      // Fallback to demo mode when backend is unavailable
      const mockFileId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const mockResponse = {
        file_id: mockFileId,
        file_name: uploadedFile.name,
        file_hash: `sha256_${Math.random().toString(36).substr(2, 32)}`,
        file_size: uploadedFile.size,
        uploaded_at: new Date().toISOString()
      }
      setFileId(mockFileId)
      setUploadProgress(mockResponse)
      setActiveStep(1)
      toast.warning('Running in demo mode (backend unavailable)')
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

      const response = await complianceAPI.analyzeDocument(
        fileId,
        selectedFrameworks,
        includeCIA,
        frameworks.iso9001
      )

      saveToHistory(response)
      toast.success('Analysis completed!')
      navigate(`/results/${response.analysis_id}`, { state: { results: response } })
    } catch (error) {
      console.error('Analysis error:', error)
      // Generate mock analysis results for demo mode
      const mockAnalysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const selectedFrameworks = Object.keys(frameworks).filter((key) => frameworks[key])
      
      const mockResults = {
        analysis_id: mockAnalysisId,
        file_name: file?.name || 'demo_document.pdf',
        frameworks: selectedFrameworks,
        compliance_results: {
          iso27001: {
            compliance_percentage: 78.5,
            matched_controls_count: 89,
            total_controls: 114,
            total_clauses: 45,
            matched_clauses: 35,
            missing_controls: [
              { control_id: 'A.5.1', title: 'Policies for information security', category: 'Organizational', priority: 'High' },
              { control_id: 'A.5.15', title: 'Access control', category: 'Access Control', priority: 'High' },
              { control_id: 'A.8.9', title: 'Configuration management', category: 'Asset Management', priority: 'Medium' },
              { control_id: 'A.8.19', title: 'Installation of software', category: 'Asset Management', priority: 'Medium' },
              { control_id: 'A.8.23', title: 'Web filtering', category: 'Asset Management', priority: 'Low' }
            ],
            weak_clauses: [
              { text: 'Passwords should be changed periodically', section: '2.1', reason: 'Missing specific timeframe requirements' }
            ]
          }
        },
        cia_analysis: includeCIA ? {
          cia_balance_index: 72.4,
          balance_rating: 'Good',
          cia_coverage: {
            confidentiality: 85,
            integrity: 70,
            availability: 62
          },
          confidentiality_score: 85,
          integrity_score: 70,
          availability_score: 62,
          classification: 'Confidentiality-Heavy',
          recommendations: [
            'Increase availability controls by implementing redundancy measures',
            'Add more integrity validation clauses for data verification',
            'Balance CIA triad by strengthening availability requirements'
          ]
        } : null,
        risk_prediction: {
          risk_level: 'Medium Risk',
          probability: 0.42,
          confidence: 87,
          probability_distribution: {
            'Low Risk': 25,
            'Medium Risk': 58,
            'High Risk': 17
          },
          recommendations: [
            'Address missing high-priority controls (A.5.1, A.5.15)',
            'Strengthen policy statements with specific requirements',
            'Increase CIA balance by adding availability controls',
            'Implement regular compliance reviews'
          ]
        },
        audit_readiness: {
          audit_readiness_score: 78.5,
          readiness_level: 'GOOD',
          score: 78.5,
          level: 'GOOD',
          recommendation: 'Your organization shows good compliance posture. Focus on resolving high-priority missing controls before the audit.'
        },
        hybrid_analysis: {
          overall_cci: 68.4,
          cci_scores: { iso27001: 68.4 },
          layer1_structural: {
            iso27001: {
              structural_score: 65,
              present: 18,
              partial: 8,
              missing: 7,
              section_results: [
                { clause: 'A.5.1', title: 'Policies for information security', status: 'present', keyword_coverage: 85, cia_pillar: 'confidentiality' },
                { clause: 'A.5.15', title: 'Access control', status: 'missing', keyword_coverage: 0, cia_pillar: 'confidentiality' },
                { clause: 'A.8.9', title: 'Configuration management', status: 'partial', keyword_coverage: 40, cia_pillar: 'integrity' },
                { clause: 'A.8.24', title: 'Use of cryptography', status: 'present', keyword_coverage: 92, cia_pillar: 'confidentiality' },
                { clause: 'A.8.14', title: 'Redundancy of information processing', status: 'missing', keyword_coverage: 0, cia_pillar: 'availability' },
              ],
              cia_structural_flags: { missing_confidentiality: 2, missing_integrity: 1, missing_availability: 3 }
            }
          },
          layer2_semantic: {
            iso27001: {
              semantic_score: 72,
              strong_count: 18,
              partial_count: 12,
              weak_count: 15,
              clause_matches: [
                { clause_text: 'All employees must follow password policies set by IT department', best_control_id: 'A.5.17', best_control_title: 'Authentication information', similarity: 0.82, compliance_level: 'strong' },
                { clause_text: 'Data backups should be performed weekly', best_control_id: 'A.8.13', best_control_title: 'Information backup', similarity: 0.75, compliance_level: 'strong' },
                { clause_text: 'Visitors must sign in at reception', best_control_id: 'A.7.2', best_control_title: 'Physical entry', similarity: 0.58, compliance_level: 'partial' },
                { clause_text: 'Software updates are installed when available', best_control_id: 'A.8.19', best_control_title: 'Installation of software', similarity: 0.48, compliance_level: 'partial' },
                { clause_text: 'Company assets are tracked in a spreadsheet', best_control_id: 'A.5.9', best_control_title: 'Inventory of information', similarity: 0.35, compliance_level: 'weak' },
              ]
            }
          },
          layer3_reasoning: {
            iso27001: {
              reasoning_confidence: 68,
              source: 'rule_based',
              executive_summary: 'The document demonstrates moderate compliance with ISO 27001 standards. Major gaps exist in access control policies and availability measures. Immediate attention is needed for 7 missing mandatory sections.',
              gap_explanations: [
                { explanation: 'Access control policy (A.5.15) is entirely absent - this is a critical requirement for information security management.', cia_impact: 'High impact on Confidentiality' },
                { explanation: 'No redundancy or failover provisions found (A.8.14) - availability of critical systems is not addressed.', cia_impact: 'High impact on Availability' },
                { explanation: 'Configuration management (A.8.9) is only partially addressed - lacks specific baselines and change tracking procedures.', cia_impact: 'Medium impact on Integrity' },
              ],
              improvement_suggestions: [
                'Add a dedicated access control policy section with role-based access definitions',
                'Implement and document redundancy measures for critical information processing facilities',
                'Strengthen configuration management with baseline configurations and automated change tracking',
                'Replace vague language ("should", "may") with mandatory language ("shall", "must")',
              ],
              rewritten_clauses: [
                { original: 'Passwords should be changed periodically', improved: 'Passwords shall be changed every 90 days and must meet complexity requirements of minimum 12 characters with uppercase, lowercase, numeric, and special characters.' },
                { original: 'Data backups should be performed weekly', improved: 'Data backups shall be performed daily for critical systems and weekly for non-critical systems, with backup integrity verified through automated restoration testing monthly.' },
              ],
              cia_impact_summary: {
                confidentiality: { status: 'at_risk', impact: 'Missing access control and 2 confidentiality-related controls' },
                integrity: { status: 'covered', impact: 'Partial coverage with room for improvement in change management' },
                availability: { status: 'at_risk', impact: 'No redundancy or disaster recovery provisions documented' }
              }
            }
          }
        },
        analyzed_at: new Date().toISOString()
      }

      // Add mock results for other selected frameworks
      if (frameworks.iso9001) {
        mockResults.compliance_results.iso9001 = {
          compliance_percentage: 82.0,
          matched_controls_count: 82,
          total_controls: 100,
          total_clauses: 45,
          matched_clauses: 37,
          missing_controls: [
            { control_id: 'Q.4.1', title: 'Quality objectives', category: 'Planning', priority: 'High' },
            { control_id: 'Q.7.1', title: 'Resources', category: 'Support', priority: 'Medium' }
          ]
        }
        mockResults.hybrid_analysis.cci_scores.iso9001 = 74.2
        mockResults.hybrid_analysis.layer1_structural.iso9001 = {
          structural_score: 72, present: 8, partial: 2, missing: 2,
          section_results: [
            { clause: 'Q.4.1', title: 'Quality objectives', status: 'missing', keyword_coverage: 0, cia_pillar: null },
            { clause: 'Q.5.2', title: 'Quality policy', status: 'present', keyword_coverage: 88, cia_pillar: null },
          ]
        }
        mockResults.hybrid_analysis.layer2_semantic.iso9001 = {
          semantic_score: 78, strong_count: 20, partial_count: 10, weak_count: 7, clause_matches: []
        }
        mockResults.hybrid_analysis.layer3_reasoning.iso9001 = {
          reasoning_confidence: 71, source: 'rule_based',
          executive_summary: 'Good alignment with ISO 9001 quality management requirements. Minor gaps in quality objectives documentation.',
          gap_explanations: [{ explanation: 'Quality objectives (Q.4.1) not explicitly documented.', cia_impact: null }],
          improvement_suggestions: ['Define measurable quality objectives aligned with quality policy'],
          rewritten_clauses: [],
          cia_impact_summary: {}
        }
        mockResults.hybrid_analysis.overall_cci = Math.round(
          (mockResults.hybrid_analysis.cci_scores.iso27001 + 74.2) / 2 * 10
        ) / 10
      }

      if (frameworks.nist) {
        mockResults.compliance_results.nist = {
          compliance_percentage: 75.0,
          matched_controls_count: 81,
          total_controls: 108,
          total_clauses: 45,
          matched_clauses: 34,
          missing_controls: [
            { control_id: 'ID.AM-1', title: 'Physical devices and systems', category: 'Identify', priority: 'High' },
            { control_id: 'PR.AC-1', title: 'Identities and credentials', category: 'Protect', priority: 'High' }
          ]
        }
        const fwCount = Object.keys(mockResults.hybrid_analysis.cci_scores).length
        mockResults.hybrid_analysis.cci_scores.nist = 66.8
        mockResults.hybrid_analysis.layer1_structural.nist = {
          structural_score: 62, present: 7, partial: 3, missing: 4,
          section_results: [
            { clause: 'ID.AM-1', title: 'Physical devices and systems', status: 'missing', keyword_coverage: 0, cia_pillar: 'availability' },
            { clause: 'PR.AC-1', title: 'Identities and credentials', status: 'missing', keyword_coverage: 0, cia_pillar: 'confidentiality' },
          ]
        }
        mockResults.hybrid_analysis.layer2_semantic.nist = {
          semantic_score: 70, strong_count: 15, partial_count: 11, weak_count: 8, clause_matches: []
        }
        mockResults.hybrid_analysis.layer3_reasoning.nist = {
          reasoning_confidence: 65, source: 'rule_based',
          executive_summary: 'Moderate alignment with NIST CSF. Gaps in asset management and identity management functions.',
          gap_explanations: [{ explanation: 'Asset inventory (ID.AM-1) not addressed.', cia_impact: 'Medium impact on Availability' }],
          improvement_suggestions: ['Implement comprehensive asset inventory covering all physical and virtual devices'],
          rewritten_clauses: [],
          cia_impact_summary: {}
        }
        const total = Object.values(mockResults.hybrid_analysis.cci_scores).reduce((a, b) => a + b, 0)
        mockResults.hybrid_analysis.overall_cci = Math.round(total / Object.keys(mockResults.hybrid_analysis.cci_scores).length * 10) / 10
      }

      if (frameworks.gdpr) {
        mockResults.compliance_results.gdpr = {
          compliance_percentage: 71.0,
          matched_controls_count: 40,
          total_controls: 57,
          total_clauses: 45,
          matched_clauses: 32,
          missing_controls: [
            { control_id: 'Art.32', title: 'Security of processing', category: 'Security', priority: 'High' },
            { control_id: 'Art.33', title: 'Breach notification', category: 'Breach', priority: 'High' }
          ]
        }
        mockResults.hybrid_analysis.cci_scores.gdpr = 63.5
        mockResults.hybrid_analysis.layer1_structural.gdpr = {
          structural_score: 58, present: 5, partial: 3, missing: 3,
          section_results: [
            { clause: 'Art.32', title: 'Security of processing', status: 'missing', keyword_coverage: 0, cia_pillar: 'confidentiality' },
            { clause: 'Art.33', title: 'Breach notification', status: 'missing', keyword_coverage: 0, cia_pillar: 'integrity' },
          ]
        }
        mockResults.hybrid_analysis.layer2_semantic.gdpr = {
          semantic_score: 68, strong_count: 14, partial_count: 10, weak_count: 8, clause_matches: []
        }
        mockResults.hybrid_analysis.layer3_reasoning.gdpr = {
          reasoning_confidence: 62, source: 'rule_based',
          executive_summary: 'Below-average GDPR compliance. Critical gaps in security processing and breach notification procedures.',
          gap_explanations: [{ explanation: 'Breach notification process (Art.33) not documented.', cia_impact: 'High impact on Integrity' }],
          improvement_suggestions: ['Establish a 72-hour breach notification procedure as required by GDPR Art.33'],
          rewritten_clauses: [],
          cia_impact_summary: { confidentiality: { status: 'at_risk', impact: 'Processing security not addressed' } }
        }
        const total = Object.values(mockResults.hybrid_analysis.cci_scores).reduce((a, b) => a + b, 0)
        mockResults.hybrid_analysis.overall_cci = Math.round(total / Object.keys(mockResults.hybrid_analysis.cci_scores).length * 10) / 10
      }
saveToHistory(mockResults)
      
      toast.info('Demo mode: Showing sample analysis results')
      navigate(`/results/${mockAnalysisId}`, { state: { results: mockResults } })
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
