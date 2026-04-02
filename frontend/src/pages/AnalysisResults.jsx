import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingIcon,
  ExpandMore as ExpandMoreIcon,
  Shield as ShieldIcon,
  Psychology as PsychologyIcon,
  Rule as RuleIcon,
  Fingerprint as SemanticIcon,
} from '@mui/icons-material'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']
const CIA_COLORS = ['#6366f1', '#22c55e', '#f59e0b']

function AnalysisResults() {
  const location = useLocation()
  const { analysisId } = useParams()
  const results = (() => {
    if (location.state?.results) return location.state.results

    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const historyKey = `analysisHistory:${currentUser.company_id || 'anonymous'}`
      const ownHistory = JSON.parse(localStorage.getItem(historyKey) || '[]')
      const legacyHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]')
      const combined = [...ownHistory, ...legacyHistory]
      const item = combined.find(h => String(h.analysisId) === String(analysisId))
      return item?.results || null
    } catch {
      return null
    }
  })()

  if (!results) {
    return (
      <Box>
        <Alert severity="error">
          No analysis results found. Please upload and analyze a document first.
        </Alert>
      </Box>
    )
  }

  const hybrid = results.hybrid_analysis || null
  const overallCCI = hybrid?.overall_cci ?? null

  const getRiskColor = (level) => {
    if (level === 'Low Risk') return 'success'
    if (level === 'Medium Risk') return 'warning'
    return 'error'
  }

  const getRiskIcon = (level) => {
    if (level === 'Low Risk') return <CheckIcon />
    if (level === 'Medium Risk') return <WarningIcon />
    return <ErrorIcon />
  }

  const getStatusChip = (status) => {
    if (status === 'present') return <Chip size="small" label="Present" color="success" />
    if (status === 'partial') return <Chip size="small" label="Partial" color="warning" />
    return <Chip size="small" label="Missing" color="error" />
  }

  const getLevelChip = (level) => {
    if (level === 'strong') return <Chip size="small" label="Strong" color="success" />
    if (level === 'partial') return <Chip size="small" label="Partial" color="warning" />
    return <Chip size="small" label="Weak" color="error" />
  }

  const getCCIGrade = (score) => {
    if (score >= 85) return { label: 'Excellent', color: '#22c55e' }
    if (score >= 70) return { label: 'Good', color: '#3b82f6' }
    if (score >= 50) return { label: 'Fair', color: '#f59e0b' }
    return { label: 'Poor', color: '#ef4444' }
  }

  // CIA chart
  const ciaData = results.cia_analysis
    ? [
        { name: 'Confidentiality', value: results.cia_analysis.cia_coverage?.confidentiality || 0 },
        { name: 'Integrity', value: results.cia_analysis.cia_coverage?.integrity || 0 },
        { name: 'Availability', value: results.cia_analysis.cia_coverage?.availability || 0 },
      ]
    : []

  // Compliance bar chart
  const complianceData = Object.entries(results.compliance_results || {}).map(([framework, data]) => ({
    name: framework.toUpperCase(),
    score: data.compliance_percentage || 0,
  }))

  // CCI per-framework data
  const cciRadarData = hybrid
    ? Object.keys(hybrid.cci_scores || {}).map((fw) => ({
        framework: fw.toUpperCase(),
        structural: hybrid.layer1_structural?.[fw]?.structural_score || 0,
        semantic: hybrid.layer2_semantic?.[fw]?.semantic_score || 0,
        reasoning: hybrid.layer3_reasoning?.[fw]?.reasoning_confidence || 0,
        cci: hybrid.cci_scores?.[fw] || 0,
      }))
    : []

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Hybrid Compliance Analysis Results
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Analysis ID: {analysisId} | Document: {results.file_name}
      </Typography>

      {/* ─── CCI Score Banner ──────────────────────────────────── */}
      {overallCCI !== null && (
        <Paper
          elevation={4}
          sx={{
            p: 3, mb: 3,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            borderLeft: `6px solid ${getCCIGrade(overallCCI).color}`,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <Typography variant="overline" sx={{ color: '#94a3b8' }}>
                Compliance Confidence Index (CCI)
              </Typography>
              <Typography
                variant="h2"
                sx={{ fontWeight: 700, color: getCCIGrade(overallCCI).color }}
              >
                {overallCCI}
              </Typography>
              <Chip
                label={getCCIGrade(overallCCI).label}
                sx={{
                  mt: 1,
                  bgcolor: getCCIGrade(overallCCI).color,
                  color: '#fff',
                  fontWeight: 600,
                }}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                <strong>CCI Formula:</strong> (Structural × 0.4) + (Semantic × 0.4) + (AI Reasoning × 0.2)
              </Typography>
              {cciRadarData.map((d) => (
                <Box key={d.framework} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#e2e8f0' }}>
                    {d.framework}
                  </Typography>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={3}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Structural: <strong>{d.structural}%</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Semantic: <strong>{d.semantic}%</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Reasoning: <strong>{d.reasoning}%</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        CCI: <strong style={{ color: getCCIGrade(d.cci).color }}>{d.cci}</strong>
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ─── Risk Prediction ───────────────────────────────────── */}
      {results.risk_prediction && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5">Audit Risk Assessment</Typography>
            <Chip
              icon={getRiskIcon(results.risk_prediction.risk_level)}
              label={results.risk_prediction.risk_level}
              color={getRiskColor(results.risk_prediction.risk_level)}
              size="large"
            />
          </Box>
          <Typography variant="body2" color="text.secondary" paragraph>
            Confidence: {results.risk_prediction.confidence}%
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {['Low Risk', 'Medium Risk', 'High Risk'].map((lvl) => {
              const probColor = lvl === 'Low Risk' ? 'success' : lvl === 'Medium Risk' ? 'warning' : 'error'
              return (
                <Grid item xs={4} key={lvl}>
                  <Typography variant="body2" color="text.secondary">{lvl}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={results.risk_prediction.probability_distribution?.[lvl] || 0}
                    color={probColor}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption">
                    {results.risk_prediction.probability_distribution?.[lvl] || 0}%
                  </Typography>
                </Grid>
              )
            })}
          </Grid>

          {results.audit_readiness && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>
                Audit Readiness: {results.audit_readiness.readiness_level}
              </strong>{' '}
              (Score: {results.audit_readiness.audit_readiness_score}/100)
              <Typography variant="body2" sx={{ mt: 1 }}>
                {results.audit_readiness.recommendation}
              </Typography>
            </Alert>
          )}

          {results.risk_prediction.recommendations?.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>Recommendations</Typography>
              <List dense>
                {results.risk_prediction.recommendations.map((rec, i) => (
                  <ListItem key={i}>
                    <ListItemIcon><TrendingIcon color="primary" /></ListItemIcon>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      )}

      {/* ─── Framework Compliance + CIA Charts ─────────────────── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Framework Compliance Scores</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#8884d8" name="Compliance %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {results.cia_analysis && (
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>CIA Balance Analysis</Typography>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Typography variant="h3" color="primary">
                    {results.cia_analysis.cia_balance_index}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Balance Index (0-100)
                  </Typography>
                  <Chip
                    label={results.cia_analysis.balance_rating}
                    color={results.cia_analysis.balance_rating === 'Excellent' ? 'success' : 'warning'}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={ciaData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {ciaData.map((_, i) => (
                        <Cell key={i} fill={CIA_COLORS[i % CIA_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* ─── 3-Layer Hybrid Architecture Details ───────────────── */}
      {hybrid && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldIcon color="primary" /> 3-Layer Hybrid Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Layer 1: Deterministic structural verification &nbsp;|&nbsp;
            Layer 2: Semantic alignment engine &nbsp;|&nbsp;
            Layer 3: AI reasoning &amp; improvement generator
          </Typography>

          {Object.keys(hybrid.layer1_structural || {}).map((fw) => {
            const l1 = hybrid.layer1_structural[fw]
            const l2 = hybrid.layer2_semantic?.[fw]
            const l3 = hybrid.layer3_reasoning?.[fw]
            const cci = hybrid.cci_scores?.[fw]

            return (
              <Accordion key={fw} defaultExpanded={fw === Object.keys(hybrid.layer1_structural)[0]}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="h6">{fw.toUpperCase()}</Typography>
                    {cci != null && (
                      <Chip
                        label={`CCI: ${cci}`}
                        size="small"
                        sx={{ bgcolor: getCCIGrade(cci).color, color: '#fff', fontWeight: 600 }}
                      />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Layer scores summary */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <RuleIcon color="info" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Layer 1: Structural
                          </Typography>
                          <Typography variant="h4" color="info.main">
                            {l1?.structural_score || 0}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {l1?.present || 0} present / {l1?.partial || 0} partial / {l1?.missing || 0} missing
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <SemanticIcon color="secondary" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Layer 2: Semantic
                          </Typography>
                          <Typography variant="h4" color="secondary.main">
                            {l2?.semantic_score || 0}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {l2?.strong_count || 0} strong / {l2?.partial_count || 0} partial / {l2?.weak_count || 0} weak
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <PsychologyIcon color="warning" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Layer 3: AI Reasoning
                          </Typography>
                          <Typography variant="h4" color="warning.main">
                            {l3?.reasoning_confidence || 0}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Source: {l3?.source || 'rule_based'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Layer 1: Structural results table */}
                  {l1?.section_results?.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Layer 1 — Structural Compliance (Mandatory Sections)
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Clause</TableCell>
                              <TableCell>Required Section</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Keyword Coverage</TableCell>
                              <TableCell>CIA Pillar</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {l1.section_results.map((sr, i) => (
                              <TableRow key={i} sx={sr.status === 'missing' ? { bgcolor: 'error.50' } : {}}>
                                <TableCell><strong>{sr.clause}</strong></TableCell>
                                <TableCell>{sr.title}</TableCell>
                                <TableCell>{getStatusChip(sr.status)}</TableCell>
                                <TableCell>{sr.keyword_coverage}%</TableCell>
                                <TableCell>
                                  {sr.cia_pillar ? (
                                    <Chip size="small" label={sr.cia_pillar} variant="outlined" />
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Layer 2: Semantic matches */}
                  {l2?.clause_matches?.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Layer 2 — Semantic Similarity (Top Matches)
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Document Clause</TableCell>
                              <TableCell>Best Control Match</TableCell>
                              <TableCell>Similarity</TableCell>
                              <TableCell>Level</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {l2.clause_matches.slice(0, 15).map((cm, i) => (
                              <TableRow key={i}>
                                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cm.clause_text}
                                </TableCell>
                                <TableCell>
                                  <strong>{cm.best_control_id}</strong>: {cm.best_control_title}
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 600,
                                      color: cm.similarity >= 0.7 ? 'success.main'
                                        : cm.similarity >= 0.45 ? 'warning.main' : 'error.main'
                                    }}
                                  >
                                    {(cm.similarity * 100).toFixed(1)}%
                                  </Typography>
                                </TableCell>
                                <TableCell>{getLevelChip(cm.compliance_level)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Layer 3: Reasoning output */}
                  {l3 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Layer 3 — AI Reasoning &amp; Gap Analysis
                      </Typography>

                      {l3.executive_summary && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <strong>Executive Summary:</strong> {l3.executive_summary}
                        </Alert>
                      )}

                      {l3.gap_explanations?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Gap Explanations</Typography>
                          <List dense>
                            {l3.gap_explanations.map((g, i) => (
                              <ListItem key={i}>
                                <ListItemIcon>
                                  <ErrorIcon color="error" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={typeof g === 'string' ? g : g.explanation}
                                  secondary={g.cia_impact ? `CIA Impact: ${g.cia_impact}` : null}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}

                      {l3.improvement_suggestions?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Improvement Suggestions</Typography>
                          <List dense>
                            {l3.improvement_suggestions.map((s, i) => (
                              <ListItem key={i}>
                                <ListItemIcon>
                                  <TrendingIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={s} />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}

                      {l3.rewritten_clauses?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Rewritten Clauses</Typography>
                          {l3.rewritten_clauses.map((rc, i) => (
                            <Card key={i} variant="outlined" sx={{ mb: 1, p: 1.5 }}>
                              <Typography variant="caption" color="error.main">
                                Original: {rc.original}
                              </Typography>
                              <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
                                Improved: {rc.improved}
                              </Typography>
                            </Card>
                          ))}
                        </Box>
                      )}

                      {/* CIA Impact Summary */}
                      {l3.cia_impact_summary && Object.keys(l3.cia_impact_summary).length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>CIA Impact Assessment</Typography>
                          <Grid container spacing={1}>
                            {['confidentiality', 'integrity', 'availability'].map((pillar) => {
                              const impact = l3.cia_impact_summary[pillar]
                              if (!impact) return null
                              return (
                                <Grid item xs={12} sm={4} key={pillar}>
                                  <Card
                                    variant="outlined"
                                    sx={{
                                      p: 1.5,
                                      borderColor: impact.status === 'at_risk' ? 'error.main' : 'success.main',
                                    }}
                                  >
                                    <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                      {pillar}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={impact.status === 'at_risk' ? 'At Risk' : 'Covered'}
                                      color={impact.status === 'at_risk' ? 'error' : 'success'}
                                    />
                                    {impact.impact && (
                                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                        {impact.impact}
                                      </Typography>
                                    )}
                                  </Card>
                                </Grid>
                              )
                            })}
                          </Grid>
                        </Box>
                      )}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )
          })}
        </Paper>
      )}

      {/* ─── Legacy: Detailed Framework Results ────────────────── */}
      {Object.entries(results.compliance_results || {}).map(([framework, data]) => (
        <Paper key={framework} elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>{framework.toUpperCase()} Analysis</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">Compliance %</Typography>
              <Typography variant="h4" color="primary">{data.compliance_percentage}%</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">Matched Controls</Typography>
              <Typography variant="h4">{data.matched_controls_count}/{data.total_controls}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">Total Clauses</Typography>
              <Typography variant="h4">{data.total_clauses}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">Matched Clauses</Typography>
              <Typography variant="h4">{data.matched_clauses}</Typography>
            </Grid>
          </Grid>

          {data.missing_controls?.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>Missing Controls (Top 5)</Typography>
              <List dense>
                {data.missing_controls.slice(0, 5).map((control, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon><ErrorIcon color="error" /></ListItemIcon>
                    <ListItemText
                      primary={`${control.control_id}: ${control.title}`}
                      secondary={`Category: ${control.category} | Priority: ${control.priority}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      ))}

      {/* ─── CIA Recommendations ───────────────────────────────── */}
      {results.cia_analysis?.recommendations?.length > 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>CIA Balance Recommendations</Typography>
          <List>
            {results.cia_analysis.recommendations.map((rec, idx) => (
              <ListItem key={idx}>
                <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
                <ListItemText primary={rec} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}

export default AnalysisResults
