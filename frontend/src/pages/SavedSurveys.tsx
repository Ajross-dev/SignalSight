import { useEffect, useState } from "react";

import { getSurveys }  from "../services/api";
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

      {!loading && !error && surveys.length === 0 && (
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

      {!loading && !error && surveys.length > 0 && (
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

              <button
                className="button-primary"
                onClick={() => onOpenSurvey(survey)}
              >
                Open Survey
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedSurveys;
