
import { useEffect, useState } from "react";

import { getSurveys } from "../services/api";
import type { Survey } from "../types/survey";

interface SavedSurveysProps {
  onOpenSurvey: (survey: Survey) => void;
  onCreateSurvey: () => void;
}

function SavedSurveys({
  onOpenSurvey,
  onCreateSurvey,
}: SavedSurveysProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load all saved surveys when this page opens.
  useEffect(() => {
    async function loadSurveys() {
      try {
        const data = await getSurveys();
        setSurveys(data);
      } catch {
        setError("Could not load saved surveys.");
      } finally {
        setLoading(false);
      }
    }

    loadSurveys();
  }, []);

  // Delete a survey after confirmation.
  async function handleDeleteSurvey(surveyId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this survey? This cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(surveyId);
    setError("");

    try {
      const response = await fetch(
        `/api/surveys/${encodeURIComponent(surveyId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete survey.");
      }

      // Remove the deleted survey from the list.
      setSurveys((previous) =>
        previous.filter((survey) => survey.id !== surveyId)
      );
    } catch (error) {
      console.error(error);
      setError("Could not delete the survey. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="saved-surveys-page">
      <div className="saved-surveys-header">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Saved Surveys</h2>
          <p>
            Open an existing building to continue measuring
            Wi-Fi coverage, or start a new survey.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={onCreateSurvey}
        >
          + New Survey
        </button>
      </div>

      {loading && (
        <p className="saved-surveys-status">
          Loading saved surveys...
        </p>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {!loading && surveys.length === 0 && !error && (
        <div className="empty-surveys">
          <h3>No Saved Surveys Yet</h3>
          <p>
            Create your first building survey to start
            collecting Wi-Fi measurements.
          </p>
          <button
            className="button-primary"
            onClick={onCreateSurvey}
          >
            Create Survey
          </button>
        </div>
      )}

      {!loading && surveys.length > 0 && (
        <div className="saved-surveys-grid">
          {surveys.map((survey) => (
            <div className="saved-survey-card" key={survey.id}>
              <div className="saved-survey-card-top">
                <div className="saved-survey-icon">▦</div>

                <div>
                  <h3>{survey.building_name}</h3>
                  <p>
                    Created{" "}
                    {new Date(
                      survey.created_at
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="saved-survey-details">
                <span>
                  {survey.floors.length} floor
                  {survey.floors.length !== 1 ? "s" : ""}
                </span>

                <span>
                  {survey.floors.filter(
                    (floor) => floor.floorplan
                  ).length}{" "}
                  floor plan(s)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="button-primary"
                  onClick={() => onOpenSurvey(survey)}
                  disabled={deletingId === survey.id}
                >
                  Open Survey
                </button>

                <button
                  className="button-secondary"
                  style={{ color: "#dc2626" }}
                  onClick={() => handleDeleteSurvey(survey.id)}
                  disabled={deletingId !== null}
                >
                  {deletingId === survey.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedSurveys;
