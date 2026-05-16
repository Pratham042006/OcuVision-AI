import { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, AlertCircle, CheckCircle, Activity, Eye, Edit2, Download, Save, X, AlertTriangle, Clock, Stethoscope, BarChart3 } from 'lucide-react';
import RetinalAR from './RetinalAR';
import HealthDashboard from './HealthDashboard';
import './App.css';

function App() {
  const [patientId, setPatientId] = useState(null);
  const [patientInput, setPatientInput] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [activeTab, setActiveTab] = useState('report'); // 'report' or 'ar'

  const handleStartSession = () => {
    if (patientInput.trim()) {
      setPatientId(patientInput.trim());
      setPatientInput('');
    }
  };

  const handleChangePatient = () => {
    setPatientId(null);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
      setEditMode(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/diagnose', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
      setEditedReport(response.data.report);
    } catch (err) {
      console.error(err);
      const backendError = err.response?.data?.detail;
      setError(backendError || 'Failed to process image. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      setResult({ ...result, report: editedReport });
    }
    setEditMode(!editMode);
  };

  const downloadReport = () => {
    const reportText = editMode ? editedReport : result.report;
    const fullReport = `═══════════════════════════════════════════════════════════════════════════════
COMPREHENSIVE RETINAL DIAGNOSTIC REPORT
═══════════════════════════════════════════════════════════════════════════════

REPORT GENERATED: ${new Date().toLocaleString()}

───────────────────────────────────────────────────────────────────────────────
CLINICAL FINDINGS
───────────────────────────────────────────────────────────────────────────────

DETECTED CONDITION: ${result.disease}

IMAGE QUALITY ASSESSMENT:
  • Quality Score: ${result.quality_score}/100
  • Quality Level: ${result.quality_level}

SEVERITY & URGENCY ASSESSMENT:
  • Severity Level: ${result.severity}
  • Urgency: ${result.urgency}
  • Recommended Specialist: ${result.specialist}
  • Suggested Referral Timeframe: ${result.referral_timeframe}

TOP 3 DIAGNOSTIC PREDICTIONS:
${result.top_3.map((item, idx) => `  ${idx + 1}. ${item.disease}: ${item.probability}`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
DETAILED MEDICAL REPORT
───────────────────────────────────────────────────────────────────────────────

${reportText}

───────────────────────────────────────────────────────────────────────────────
RECOMMENDED ACTIONS & FOLLOW-UP
───────────────────────────────────────────────────────────────────────────────

SPECIALIST REFERRAL:
  • Type: ${result.specialist}
  • Priority Level: ${result.urgency}
  • Recommended Timeframe: ${result.referral_timeframe}

ACTION ITEMS:
  1. Schedule appointment with recommended specialist
  2. Bring this report and retinal images to all appointments
  3. Maintain regular eye health monitoring
  4. Report any changes in vision immediately
  5. Follow specialist recommendations for treatment

───────────────────────────────────────────────────────────────────────────────
IMPORTANT DISCLAIMER
───────────────────────────────────────────────────────────────────────────────

This is an AI-assisted preliminary assessment and should NOT be used as a substitute 
for professional medical evaluation. The analysis is based on fundus photography and 
should be confirmed by a qualified ophthalmologist through comprehensive clinical 
examination including dilated eye exam, OCT imaging, and other diagnostic modalities 
as appropriate.

Always consult with a licensed eye care professional for final diagnosis and 
treatment planning.

═══════════════════════════════════════════════════════════════════════════════`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fullReport));
    element.setAttribute('download', `Retinal_Report_${result.disease}_${new Date().getTime()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="app-container">
      {!patientId ? (
        <div className="patient-login">
          <div className="login-card glass-panel">
            <div className="login-header">
              <Eye size={48} className="login-icon" />
              <h1>Retinal Scan Analysis</h1>
              <p className="login-subtitle">Hospital-grade AI Diagnostics</p>
            </div>

            <div className="login-body">
              <div className="form-group">
                <label htmlFor="patientId">Patient ID / Medical Record Number</label>
                <input
                  id="patientId"
                  type="text"
                  placeholder="e.g., PAT-2026-001234 or 12345"
                  value={patientInput}
                  onChange={(e) => setPatientInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleStartSession()}
                  className="patient-input"
                />
              </div>

              <button 
                onClick={handleStartSession}
                disabled={!patientInput.trim()}
                className="btn-primary start-btn"
              >
                <Activity size={18} />
                Start Session
              </button>

              <div className="login-info">
                <p>ℹ️ Enter a unique patient identifier to maintain separate scan history for each patient. All scans will be stored under this ID.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="patient-header-bar">
            <div className="patient-info">
              <Eye size={20} />
              <span className="patient-id">Patient ID: <strong>{patientId}</strong></span>
            </div>
            <button 
              onClick={handleChangePatient}
              className="btn-secondary switch-patient"
            >
              Switch Patient
            </button>
          </header>

          <header className="hero">
            <div className="badge">
              <Activity size={16} className="icon-pulse" />
              <span>AI-Powered Diagnostics</span>
            </div>
            <h1>
              Retinal <span className="text-gradient">Scan Analysis</span>
            </h1>
            <p className="subtitle">
              Hospital-grade retinal diagnosis system
            </p>
          </header>

          <main>
        <div className="upload-section glass-panel">
          {!preview ? (
            <div className="upload-placeholder">
              <label htmlFor="file-upload" className="upload-zone">
                <Upload size={48} className="upload-icon" />
                <h3>Upload Retinal Scan Image</h3>
                <p>Click or drag and drop an image here</p>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          ) : (
            <div className="preview-container">
              <div className="preview-image-wrapper">
                <img src={preview} alt="Preview" className="preview-image" />
                <button className="remove-btn" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>
                  ×
                </button>
              </div>

              {!result && (
                <button
                  className="btn-primary analyze-btn"
                  onClick={handleUpload}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex-center">
                      <div className="spinner"></div> Processing...
                    </span>
                  ) : (
                    <span className="flex-center">
                      <Eye size={18} style={{ marginRight: '8px' }} /> Analyze Scan
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="error-banner glass-panel">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="results-container">
            {result.quality_score < 60 && (
              <div className="quality-warning glass-panel">
                <AlertTriangle size={20} />
                <div className="warning-content">
                  <strong>Image Quality: {result.quality_level}</strong>
                  <p>Quality Score {result.quality_score}/100 - Consider retaking the image for more accurate results</p>
                </div>
              </div>
            )}

            <div className="diagnosis-card glass-panel">
              <div className="card-header">
                <div>
                  <h2>Diagnostic Results</h2>
                </div>
                <div className="header-badges">
                  <div className={`severity-badge severity-${result.severity.toLowerCase()}`}>
                    {result.severity} ({result.damage_percentage}% damage)
                  </div>
                  <div className={`status-badge success`}>
                    <CheckCircle size={16} />
                    <span>Complete</span>
                  </div>
                </div>
              </div>

              <div className="result-grid">
                <div className="diagnosis-info">
                  <h3>Detected Condition</h3>
                  <div className="disease-name">{result.disease}</div>

                  {result.top_3 && (
                    <div className="confidence-section">
                      <h4>Top 3 Predictions</h4>
                      <div className="confidence-list">
                        {result.top_3.map((item, index) => (
                          <div key={index} className="confidence-item">
                            <span className="conf-name">{item.disease}</span>
                            <span className="conf-bar-bg">
                              <div
                                className="conf-bar-fill"
                                style={{ width: item.probability }}
                              ></div>
                            </span>
                            <span className="conf-score">{item.probability}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="visuals">
                  <div className="visual-item">
                    <span>Original</span>
                    <img src={preview} alt="Original" />
                  </div>
                  <div className="visual-item">
                    <span>Grad-CAM Heatmap</span>
                    <img src={result.heatmap} alt="Heatmap" />
                  </div>
                </div>
              </div>
            </div>

            <div className="referral-card glass-panel">
              <div className="card-header">
                <Stethoscope size={20} />
                <h3>Clinical Recommendation & Referral</h3>
              </div>
              
              <div className="referral-grid">
                <div className="referral-item">
                  <div className="referral-icon urgent">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="referral-content">
                    <div className="referral-label">Urgency Level</div>
                    <div className={`referral-value urgency-${result.urgency.toLowerCase()}`}>
                      {result.urgency}
                    </div>
                  </div>
                </div>

                <div className="referral-item">
                  <div className="referral-icon specialist">
                    <Stethoscope size={24} />
                  </div>
                  <div className="referral-content">
                    <div className="referral-label">Recommended Specialist</div>
                    <div className="referral-value">{result.specialist}</div>
                  </div>
                </div>

                <div className="referral-item">
                  <div className="referral-icon timeframe">
                    <Clock size={24} />
                  </div>
                  <div className="referral-content">
                    <div className="referral-label">Suggested Timeframe</div>
                    <div className="referral-value">{result.referral_timeframe}</div>
                  </div>
                </div>

                <div className="referral-item">
                  <div className="referral-icon quality">
                    <BarChart3 size={24} />
                  </div>
                  <div className="referral-content">
                    <div className="referral-label">Image Quality</div>
                    <div className="referral-value">{result.quality_level} ({result.quality_score}/100)</div>
                  </div>
                </div>
              </div>

              <div className="referral-action">
                <div className="action-box">
                  <h4>Next Steps:</h4>
                  <ul>
                    <li>Schedule appointment with {result.specialist}</li>
                    <li>Bring this report and retinal images to consultation</li>
                    <li>Prepare insurance information and medical history</li>
                    <li>Follow any pre-visit instructions from specialist's office</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="report-card glass-panel">
              <div className="card-header">
                <FileText size={20} />
                <h3>Medical Report</h3>
                <div className="report-controls">
                  <button 
                    className="btn-secondary"
                    onClick={toggleEditMode}
                    title={editMode ? 'Save changes' : 'Edit report'}
                  >
                    {editMode ? <Save size={16} /> : <Edit2 size={16} />}
                    {editMode ? 'Save' : 'Edit'}
                  </button>
                  {editMode && (
                    <button 
                      className="btn-secondary cancel"
                      onClick={() => {
                        setEditedReport(result.report);
                        setEditMode(false);
                      }}
                      title="Cancel editing"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  )}
                  <button 
                    className="btn-secondary download"
                    onClick={downloadReport}
                    title="Download report as text"
                  >
                    <Download size={16} />
                    Download Report
                  </button>
                </div>
              </div>
              {editMode ? (
                <textarea 
                  className="report-textarea"
                  value={editedReport}
                  onChange={(e) => setEditedReport(e.target.value)}
                  placeholder="Edit your report here..."
                />
              ) : (
                <div className="report-content">
                  {editedReport || result.report}
                </div>
              )}
            </div>

            <div className="ar-viewer-card glass-panel">
              <div className="card-header">
                <Eye size={20} style={{color: '#4a90e2'}} />
                <h3>3D Retinal Digital Twin</h3>
                <div className="ar-badge">
                  <span>🔬 AR</span>
                </div>
              </div>
              <RetinalAR 
                heatmapImage={result.heatmap} 
                diseaseInfo={{
                  disease: result.disease,
                  severity: result.severity,
                  confidence: result.top_3[0]?.probability || 'N/A'
                }}
              />
            </div>

            <HealthDashboard currentResult={result} patientId={patientId} />
          </div>
        )}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
