import { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, AlertCircle, CheckCircle, Activity, Eye, Edit2, Download, Save, X } from 'lucide-react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedReport, setEditedReport] = useState('');


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
    const fullReport = `MEDICAL DIAGNOSTIC REPORT

Detected Condition: ${result.disease}

TOP 3 PREDICTIONS:
${result.top_3.map((item, idx) => `${idx + 1}. ${item.disease}: ${item.probability}`).join('\n')}

================================
MEDICAL REPORT:
================================

${reportText}

================================
DISCLAIMER:
This is an AI-assisted preliminary assessment and should not be used as a substitute for professional medical evaluation. Please consult with a qualified ophthalmologist for definitive diagnosis and treatment plans.`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fullReport));
    element.setAttribute('download', `Report_${result.disease}_${new Date().getTime()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="app-container">
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
            <div className="diagnosis-card glass-panel">
              <div className="card-header">
                <h2>Diagnostic Results</h2>
                <div className="status-badge success">
                  <CheckCircle size={16} />
                  <span>Analysis Complete</span>
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
                    Download
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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
