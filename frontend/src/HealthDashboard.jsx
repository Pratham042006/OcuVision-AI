import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle, Clock, Stethoscope } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Patient Health Digital Twin Dashboard
 * Tracks retinal health progression and provides longitudinal analysis
 * Uses localStorage to persist scan history per patient
 */
function HealthDashboard({ currentResult, patientId }) {
  // Generate patient-specific storage key
  const storageKey = `retinalScanHistory_${patientId}`;
  
  // Load scan history from localStorage
  const [patientHistory, setPatientHistory] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Add current result to history if it's new
  useEffect(() => {
    if (currentResult) {
      const newScan = {
        date: new Date().toISOString(),
        disease: currentResult.disease,
        severity: currentResult.severity,
        damage_percentage: currentResult.damage_percentage || 0,
        quality: currentResult.quality_score,
        status: 'scan'
      };

      // Check if this scan is already in history (avoid duplicates from re-renders)
      const isDuplicate = patientHistory.some(
        scan => scan.date === newScan.date && scan.disease === newScan.disease
      );

      if (!isDuplicate) {
        const updated = [...patientHistory, newScan];
        setPatientHistory(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    }
  }, [currentResult?.disease, currentResult?.damage_percentage]); // Depend on these to detect real changes

  const isFirstScan = patientHistory.length <= 1;
  
  // Calculate trend
  const severityOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
  const getTrend = () => {
    if (patientHistory.length < 2) return 'new';
    const current = severityOrder[patientHistory[patientHistory.length - 1].severity] || 2;
    const previous = severityOrder[patientHistory[patientHistory.length - 2].severity] || 2;
    return current > previous ? 'worsening' : current < previous ? 'improving' : 'stable';
  };

  const trend = getTrend();

  return (
    <div className="health-dashboard glass-panel">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>👁️ Retinal Health Digital Twin</h2>
          <p className="subtitle">Longitudinal Health Tracking & Progression Analysis</p>
        </div>
        <div className={`trend-badge ${isFirstScan ? 'new' : trend}`}>
          {isFirstScan ? (
            <>
              <Clock size={18} />
              <span>Baseline Established</span>
            </>
          ) : trend === 'worsening' ? (
            <>
              <TrendingUp size={18} />
              <span>Worsening</span>
            </>
          ) : trend === 'improving' ? (
            <>
              <TrendingDown size={18} />
              <span>Improving</span>
            </>
          ) : (
            <>
              <Stethoscope size={18} />
              <span>Stable</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline or First Scan Message */}
      {isFirstScan ? (
        <div className="first-scan-message">
          <div className="message-icon">📋</div>
          <div className="message-content">
            <h3>First Scan Recorded</h3>
            <p>This is the baseline scan for the patient's digital health twin. Future scans will be compared against this baseline to track disease progression and treatment response.</p>
            <div className="message-actions">
              <div className="action-item">
                <span className="action-number">1</span>
                <span className="action-text">Baseline established today</span>
              </div>
              <div className="action-item">
                <span className="action-number">2</span>
                <span className="action-text">Schedule next follow-up in {currentResult?.referral_timeframe || '4-6 weeks'}</span>
              </div>
              <div className="action-item">
                <span className="action-number">3</span>
                <span className="action-text">Compare results at future visits</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="patient-timeline">
            <h3 className="timeline-title">📅 Progression Timeline ({patientHistory.length} scans)</h3>
            
            {/* Health Progression Charts */}
            <div className="charts-container">
              {/* Severity Trend Chart - Damage Percentage Based */}
              <div className="chart-card">
                <h4 className="chart-title">Retinal Damage Progression (%)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={patientHistory.map((record, idx) => ({
                    index: idx + 1,
                    date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    damage: record.damage_percentage || 0,
                    severity: record.severity,
                    disease: record.disease
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74, 144, 226, 0.2)" />
                    <XAxis dataKey="date" stroke="#7a8aaa" />
                    <YAxis stroke="#7a8aaa" domain={[0, 100]} label={{ value: 'Damage (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(15, 28, 63, 0.95)',
                        border: '1px solid #4a90e2',
                        borderRadius: '8px',
                        color: '#e0e8f0'
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              backgroundColor: 'rgba(15, 28, 63, 0.95)',
                              border: '1px solid #4a90e2',
                              borderRadius: '8px',
                              padding: '10px',
                              color: '#e0e8f0'
                            }}>
                              <p style={{ margin: '0 0 5px 0' }}>Scan Date: {data.date}</p>
                              <p style={{ margin: '0 0 5px 0' }}>Damage: {data.damage.toFixed(1)}% ({data.severity})</p>
                              <p style={{ margin: 0 }}>Disease: {data.disease}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="damage" 
                      stroke="#4a90e2" 
                      strokeWidth={3}
                      dot={{ fill: '#4a90e2', r: 5 }}
                      activeDot={{ r: 7, fill: '#6ba3f5' }}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Timeline items */}
          <div className="timeline-container">
            {patientHistory.map((record, idx) => (
              <div key={idx} className={`timeline-item ${idx === patientHistory.length - 1 ? 'current' : ''}`}>
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-date">
                    {new Date(record.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="timeline-info">
                    <span className="disease-tag">{record.disease}</span>
                    <span className={`severity-indicator severity-${record.severity.toLowerCase()}`}>
                      {record.severity}
                    </span>
                    <span className="quality-score">Quality: {record.quality}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="timeline-summary">
            <p>📊 Showing {patientHistory.length} scan(s) | Trend: <strong>{trend}</strong></p>
          </div>
        </div>
        </>
      )}

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon disease">
            <AlertCircle size={20} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Primary Condition</div>
            <div className="metric-value">{currentResult?.disease || 'N/A'}</div>
            <div className="metric-subtext">Current diagnosis</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon severity">
            <TrendingUp size={20} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Disease Trajectory</div>
            <div className={`metric-value trend-${trend}`}>
              {trend === 'worsening' ? '📈 Worsening' : trend === 'improving' ? '📉 Improving' : '➡️ Stable'}
            </div>
            <div className="metric-subtext">Over past 90 days</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon quality">
            <CheckCircle size={20} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Image Quality</div>
            <div className="metric-value">{currentResult?.quality_score || 0}/100</div>
            <div className="metric-subtext">{currentResult?.quality_level || 'Unknown'}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon timeline">
            <Clock size={20} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Follow-up Due</div>
            <div className="metric-value">
              {currentResult?.referral_timeframe || '4-6 weeks'}
            </div>
            <div className="metric-subtext">Recommended interval</div>
          </div>
        </div>
      </div>

      {/* Health Recommendations */}
      <div className="recommendations-section">
        <h3 className="section-title">💊 Personalized Health Recommendations</h3>
        <div className="recommendations-list">
          {currentResult && (
            <>
              {/* Priority 1: Based on Urgency and Severity */}
              <div className="recommendation priority-1">
                <div className="rec-icon">🔴</div>
                <div className="rec-content">
                  <div className="rec-title">
                    {currentResult.urgency === 'Emergency' ? '🚨 EMERGENCY: Immediate Medical Attention Required' : 
                     currentResult.urgency === 'Urgent' ? '⚠️ Urgent: Schedule Specialist Consultation' : 
                     'Important: Schedule Specialist Consultation'}
                  </div>
                  <div className="rec-description">
                    {currentResult.urgency === 'Emergency' ? 
                      `Contact ${currentResult.specialist} immediately or visit emergency department. Diagnosed with ${currentResult.disease} showing ${currentResult.damage_percentage}% retinal damage.` :
                      `See ${currentResult.specialist} within ${currentResult.referral_timeframe} for comprehensive evaluation. Retinal damage at ${currentResult.damage_percentage}% requires professional assessment.`
                    }
                  </div>
                </div>
              </div>

              {/* Priority 2: Monitoring Based on Severity and Damage */}
              <div className="recommendation priority-2">
                <div className="rec-icon">🟡</div>
                <div className="rec-content">
                  <div className="rec-title">
                    {currentResult.severity === 'Critical' ? '🔍 Very Frequent Monitoring Required' :
                     currentResult.severity === 'High' ? '📊 Increase Monitoring Frequency' : 
                     currentResult.severity === 'Medium' ? '📅 Regular Monitoring Schedule' :
                     '✓ Standard Monitoring'}
                  </div>
                  <div className="rec-description">
                    {currentResult.severity === 'Critical' ? 
                      'Weekly retinal imaging and specialist consultation recommended given critical damage levels.' :
                     currentResult.severity === 'High' ? 
                      `Monthly retinal screening instead of annual schedule. With ${currentResult.damage_percentage}% damage, frequent monitoring is essential.` :
                     currentResult.severity === 'Medium' ? 
                      'Quarterly retinal imaging recommended to track disease progression.' :
                      'Continue standard annual eye examinations.'}
                  </div>
                </div>
              </div>

              {/* Priority 3: Lifestyle and Management */}
              <div className="recommendation priority-3">
                <div className="rec-icon">🟢</div>
                <div className="rec-content">
                  <div className="rec-title">
                    {currentResult.disease.includes('DR') ? '🩺 Diabetes Management' :
                     currentResult.disease.includes('RP') ? '🧬 Genetic Management' :
                     currentResult.disease.includes('AMD') ? '💊 Age-Related Management' :
                     '✨ Daily Health Management'}
                  </div>
                  <div className="rec-description">
                    {currentResult.disease.includes('DR') ? 
                      'Maintain tight glycemic control (HbA1c <7%), manage blood pressure, and follow prescribed diabetes medications.' :
                     currentResult.disease.includes('RP') ? 
                      'Vitamin A supplementation may help. Genetic counseling recommended for family members.' :
                     currentResult.disease.includes('AMD') ? 
                      'AREDS2 vitamins, lutein, and zeaxanthin supplementation. Avoid smoking and UV exposure.' :
                      'Maintain a balanced diet rich in antioxidants, regular exercise, and follow prescribed medications.'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Health Twin Stats */}
      <div className="twin-stats">
        <h3 className="section-title">📊 Digital Twin Health Metrics</h3>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">Total Scans</div>
            <div className="stat-value">{patientHistory.length}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Risk Level</div>
            <div className={`stat-value risk-${currentResult?.severity?.toLowerCase() || 'medium'}`}>
              {currentResult?.severity || 'Medium'}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Current Quality</div>
            <div className="stat-value">
              {currentResult?.quality_score || 0}%
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Last Scan</div>
            <div className="stat-value">
              Today
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .health-dashboard {
          margin-top: 2rem;
          padding: 2rem;
          animation: slideIn 0.6s ease-out 0.5s both;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(74, 144, 226, 0.3);
        }

        .header-title h2 {
          color: #e0e8f0;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
        }

        .subtitle {
          color: #7a8aaa;
          font-size: 0.9rem;
          margin: 0;
        }

        .trend-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .trend-badge.stable {
          background: rgba(76, 175, 80, 0.2);
          color: #a3d977;
          border: 1px solid #4caf50;
        }

        .trend-badge.worsening {
          background: rgba(255, 87, 34, 0.2);
          color: #ff9966;
          border: 1px solid #ff5722;
        }

        .trend-badge.new {
          background: rgba(74, 144, 226, 0.2);
          color: #6ba3f5;
          border: 1px solid #4a90e2;
        }

        .first-scan-message {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.15) 0%, rgba(100, 120, 180, 0.1) 100%);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 10px;
          margin-bottom: 2rem;
          align-items: flex-start;
        }

        .message-icon {
          font-size: 2.5rem;
          flex-shrink: 0;
        }

        .message-content h3 {
          color: #e0e8f0;
          font-size: 1.2rem;
          margin: 0 0 0.5rem 0;
        }

        .message-content p {
          color: #a0b0c0;
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0 0 1rem 0;
        }

        .message-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .action-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(42, 82, 152, 0.3);
          border-radius: 6px;
        }

        .action-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #4a90e2;
          color: #0f1c3f;
          border-radius: 50%;
          font-weight: 600;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .action-text {
          color: #c0d0e0;
          font-size: 0.9rem;
        }

        .patient-timeline {
          margin-bottom: 2rem;
        }

        .timeline-title {
          color: #4a90e2;
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }

        .timeline-summary {
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(74, 144, 226, 0.15);
          border-left: 3px solid #4a90e2;
          border-radius: 4px;
        }

        .timeline-summary p {
          color: #a0b0c0;
          font-size: 0.9rem;
          margin: 0;
        }

        .timeline-summary strong {
          color: #4a90e2;
          font-weight: 600;
        }

        .timeline-container {
          display: flex;
          gap: 1.5rem;
          overflow-x: auto;
          padding: 1rem 0;
          scrollbar-width: thin;
          scrollbar-color: #4a90e2 rgba(74, 144, 226, 0.1);
        }

        .timeline-container::-webkit-scrollbar {
          height: 4px;
        }

        .timeline-container::-webkit-scrollbar-thumb {
          background: #4a90e2;
          border-radius: 2px;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          min-width: 200px;
          padding: 1rem;
          background: rgba(42, 82, 152, 0.2);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .timeline-item.current {
          border-color: #4a90e2;
          background: rgba(74, 144, 226, 0.15);
          box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
        }

        .timeline-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #4a90e2;
          margin-top: 4px;
          flex-shrink: 0;
        }

        .timeline-item.current .timeline-dot {
          width: 16px;
          height: 16px;
          box-shadow: 0 0 10px #4a90e2;
        }

        .timeline-date {
          color: #7a8aaa;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .timeline-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .disease-tag {
          color: #4a90e2;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .severity-indicator {
          font-size: 0.8rem;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-weight: 600;
          display: inline-block;
          width: fit-content;
        }

        .severity-indicator.severity-low {
          background: rgba(76, 175, 80, 0.2);
          color: #a3d977;
        }

        .severity-indicator.severity-medium {
          background: rgba(255, 152, 0, 0.2);
          color: #ffb366;
        }

        .severity-indicator.severity-high {
          background: rgba(255, 87, 34, 0.2);
          color: #ff9966;
        }

        .severity-indicator.severity-critical {
          background: rgba(244, 67, 54, 0.2);
          color: #ff6666;
        }

        .quality-score {
          color: #a0b0c0;
          font-size: 0.8rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          background: rgba(42, 82, 152, 0.15);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 10px;
          transition: all 0.3s ease;
        }

        .metric-card:hover {
          background: rgba(42, 82, 152, 0.25);
          border-color: #4a90e2;
          transform: translateY(-2px);
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .metric-icon.disease {
          background: rgba(255, 87, 34, 0.2);
          color: #ff9966;
        }

        .metric-icon.severity {
          background: rgba(255, 152, 0, 0.2);
          color: #ffb366;
        }

        .metric-icon.quality {
          background: rgba(76, 175, 80, 0.2);
          color: #a3d977;
        }

        .metric-icon.timeline {
          background: rgba(74, 144, 226, 0.2);
          color: #6ba3f5;
        }

        .metric-label {
          color: #7a8aaa;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .metric-value {
          color: #e0e8f0;
          font-size: 1.3rem;
          font-weight: 700;
        }

        .metric-value.trend-worsening {
          color: #ff9966;
        }

        .metric-value.trend-improving {
          color: #a3d977;
        }

        .metric-subtext {
          color: #7a8aaa;
          font-size: 0.8rem;
          margin-top: 0.25rem;
        }

        .recommendations-section {
          margin-bottom: 2rem;
        }

        .section-title {
          color: #4a90e2;
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .recommendation {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #4a90e2;
        }

        .recommendation.priority-1 {
          background: rgba(255, 87, 34, 0.1);
          border-left-color: #ff5722;
        }

        .recommendation.priority-2 {
          background: rgba(255, 152, 0, 0.1);
          border-left-color: #ff9800;
        }

        .recommendation.priority-3 {
          background: rgba(76, 175, 80, 0.1);
          border-left-color: #4caf50;
        }

        .rec-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .rec-title {
          color: #e0e8f0;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .rec-description {
          color: #a0b0c0;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .twin-stats {
          margin-top: 2rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
        }

        .stat-box {
          text-align: center;
          padding: 1rem;
          background: rgba(42, 82, 152, 0.15);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 8px;
        }

        .stat-label {
          color: #7a8aaa;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .stat-value {
          color: #e0e8f0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .stat-value.risk-low {
          color: #a3d977;
        }

        .stat-value.risk-medium {
          color: #ffb366;
        }

        .stat-value.risk-high {
          color: #ff9966;
        }

        .stat-value.risk-critical {
          color: #ff6666;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .health-dashboard {
            padding: 1rem;
          }

          .dashboard-header {
            flex-direction: column;
            gap: 1rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Chart Styles */
        .charts-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .chart-card {
          padding: 1.5rem;
          background: rgba(42, 82, 152, 0.2);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 10px;
        }

        .chart-title {
          color: #4a90e2;
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
          text-align: center;
        }

        .charts-container :global(.recharts-wrapper) {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
        }

        .charts-container :global(.recharts-text) {
          fill: #7a8aaa;
        }

        .charts-container :global(.recharts-cartesian-axis-line) {
          stroke: rgba(74, 144, 226, 0.2);
        }

        .charts-container :global(.recharts-tooltip-wrapper) {
          outline: none;
        }

        .charts-container :global(.recharts-default-tooltip) {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}

export default HealthDashboard;
