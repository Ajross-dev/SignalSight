import type { AnalysisReport as AnalysisReportData } from "../types/analysis";

interface AnalysisReportProps {
  report: AnalysisReportData;
  onBack: () => void;
}

function AnalysisReport({ report, onBack }: AnalysisReportProps) {
  // Separate the AI results from the measured coverage statistics.
  const { analysis, coverage } = report;

  // Format the date when the report was generated.
  const reportDate = new Date(report.created_at).toLocaleString();

  return (
    <div className="analysis-report-page">

      {/* Report heading */}
      <div className="report-header">
        <div>
          <p className="eyebrow">SIGNALSIGHT AI</p>
          <h2>Wi-Fi Coverage Analysis</h2>
          <p>
            AI-generated insights and recommendations for your network.
          </p>
          <small>Generated: {reportDate}</small>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Overview statistics */}
      <div className="report-stats">
        <div className="report-stat-card">
          <span>Coverage Score</span>
          <strong>{analysis.coverage_score}/100</strong>
        </div>

        <div className="report-stat-card">
          <span>Measurements Analyzed</span>
          <strong>{coverage.measurement_count}</strong>
        </div>

        <div className="report-stat-card">
          <span>Dead Zones Detected</span>
          <strong>{analysis.dead_zones.length}</strong>
        </div>
      </div>

      {/* AI network summary */}
      <section className="report-section">
        <h3>Network Summary</h3>
        <p>{analysis.summary}</p>
      </section>

      {/* Signal strength statistics */}
      <section className="report-section">
        <h3>Signal Strength Overview</h3>

        <div className="report-list-item">
          <strong>Average Signal Strength</strong>
          <p>
            {coverage.average_signal === null
              ? "No measurements available"
              : `${coverage.average_signal}%`}
          </p>
        </div>

        <div className="report-list-item">
          <strong>Strong Measurements (70% or higher)</strong>
          <p>{coverage.strong_measurement_count}</p>
        </div>

        <div className="report-list-item">
          <strong>Weak Measurements (Below 40%)</strong>
          <p>{coverage.weak_measurement_count}</p>
        </div>
      </section>

      {/* Dead zones */}
      <section className="report-section">
        <h3>Detected Dead Zones</h3>

        {analysis.dead_zones.length === 0 ? (
          <p>
            No dead zones were identified from the recorded measurements.
          </p>
        ) : (
          analysis.dead_zones.map((zone, index) => (
            <div className="report-list-item" key={index}>
              <strong>Dead Zone {index + 1}</strong>

              <p>{zone.description}</p>

              <small>
                Position: ({zone.x.toFixed(2)}, {zone.y.toFixed(2)})
                {" | "}
                Signal Strength: {zone.signal}%
              </small>
            </div>
          ))
        )}
      </section>

      {/* Router placement recommendations */}
      <section className="report-section">
        <h3>Router Placement Recommendations</h3>

        {analysis.router_placement_suggestions.length === 0 ? (
          <p>No additional router placement suggestions.</p>
        ) : (
          analysis.router_placement_suggestions.map(
            (suggestion, index) => (
              <div className="report-list-item" key={index}>
                <strong>Recommendation {index + 1}</strong>
                <p>{suggestion}</p>
              </div>
            )
          )
        )}
      </section>

      {/* Equipment recommendations */}
      <section className="report-section">
        <h3>Equipment Recommendations</h3>

        {analysis.equipment_recommendations.length === 0 ? (
          <p>No equipment upgrades recommended.</p>
        ) : (
          analysis.equipment_recommendations.map(
            (recommendation, index) => (
              <div className="report-list-item" key={index}>
                <strong>Option {index + 1}</strong>
                <p>{recommendation}</p>
              </div>
            )
          )
        )}
      </section>

      {/* Download report */}
      <div className="report-footer">
        <a
          className="button-secondary"
          href={`/api/reports/${encodeURIComponent(report.id)}/download`}
          download
        >
          Download Report (JSON)
        </a>
      </div>

    </div>
  );
}

export default AnalysisReport;
