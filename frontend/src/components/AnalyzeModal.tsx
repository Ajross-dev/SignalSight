import { useState } from "react";
import type { FormEvent } from "react";
import { analyzeSurvey } from "../services/api";
import type { AnalysisReport } from "../types/analysis";

interface AnalyzeModalProps {
  surveyId: string;
  floorId: string;
  onClose: () => void;
  onComplete: (report: AnalysisReport) => void;
}

function AnalyzeModal({
  surveyId,
  floorId,
  onClose,
  onComplete,
}: AnalyzeModalProps) {
  const [routerCount, setRouterCount] = useState("");
  const [equipment, setEquipment] = useState("");
  const [budget, setBudget] = useState("");
  const [painPoints, setPainPoints] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // Collect the form values and send them to the backend.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (analyzing) return;

    setAnalyzing(true);
    setError("");

    try {
      const report = await analyzeSurvey({
        survey_id: surveyId,
        floor_id: floorId,

        // Empty fields are omitted so the backend can use saved values.
        ...(routerCount.trim() !== "" && {
          router_count: Number(routerCount),
        }),
        ...(equipment.trim() !== "" && {
          equipment: equipment.split(",").map((item) => item.trim()).filter(Boolean),
        }),
        ...(budget.trim() !== "" && {
          budget: Number(budget),
        }),
        ...(painPoints.trim() !== "" && {
          pain_points: [painPoints.trim()],
        }),
      });

      onComplete(report);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to generate analysis."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="analyze-modal-overlay">
      <div
        className="analyze-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analyze-modal-title"
      >
        <div className="analyze-modal-header">
          <div>
            <p className="eyebrow">SIGNALSIGHT AI</p>
            <h2 id="analyze-modal-title">Analyze Wi-Fi Coverage</h2>
            <p>
              Provide some information about your network to receive
              personalized recommendations.
            </p>
          </div>

          <button
            type="button"
            className="analyze-modal-close"
            onClick={onClose}
            disabled={analyzing}
            aria-label="Close analysis form"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="analyze-modal-form">
          <div className="analyze-form-field">
            <label htmlFor="router-count">Number of Routers</label>
            <input
              id="router-count"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 2"
              value={routerCount}
              onChange={(event) => setRouterCount(event.target.value)}
              disabled={analyzing}
            />
          </div>

          <div className="analyze-form-field">
            <label htmlFor="network-equipment">Current Equipment</label>
            <input
              id="network-equipment"
              type="text"
              placeholder="e.g. TP-Link Archer AX55, Wi-Fi Extender"
              value={equipment}
              onChange={(event) => setEquipment(event.target.value)}
              disabled={analyzing}
            />
            <small>Separate multiple devices with commas.</small>
          </div>

          <div className="analyze-form-field">
            <label htmlFor="network-budget">Improvement Budget ($)</label>
            <input
              id="network-budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 500"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              disabled={analyzing}
            />
          </div>

          <div className="analyze-form-field">
            <label htmlFor="network-issues">Known Connectivity Issues</label>
            <textarea
              id="network-issues"
              rows={4}
              placeholder="e.g. Weak signal upstairs and frequent disconnections."
              value={painPoints}
              onChange={(event) => setPainPoints(event.target.value)}
              disabled={analyzing}
            />
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="analyze-modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={analyzing}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={analyzing}
            >
              {analyzing ? "Analyzing Network..." : "✦ Generate Analysis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AnalyzeModal;
