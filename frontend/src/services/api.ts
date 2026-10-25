import type {
  AnalysisRequest,
  AnalysisReport,
} from "../types/analysis";

import type {
  Measurement,
  MeasurementRequest,
} from "../types/measurements";

import type {
  Survey,
  CreateSurveyRequest,
} from "../types/survey";

const API_URL = "/api";

// Get all saved Wi-Fi measurements.
// Optional IDs let us retrieve readings for one survey or floor.
export async function getMeasurements(
  surveyId?: string,
  floorId?: string
): Promise<Measurement[]> {
  const params = new URLSearchParams();

  if (surveyId) {
    params.set("survey_id", surveyId);
  }

  if (floorId) {
    params.set("floor_id", floorId);
  }

  const query = params.toString();

  const url = `${API_URL}/measurements${query ? `?${query}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load measurements (${response.status})`);
  }

  return response.json();
}

// Record a real Wi-Fi measurement at the selected location.
export async function recordMeasurement(
  data: MeasurementRequest
): Promise<Measurement> {
  const response = await fetch(`${API_URL}/measurements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Failed to record measurement (${response.status}): ${text}`
    );
  }

  if (!text) {
    throw new Error("Backend returned an empty measurement response");
  }

  return JSON.parse(text) as Measurement;
}

// Delete ALL saved Wi-Fi measurements.
// The backend does not yet support clearing one floor only.
export async function clearMeasurements(): Promise<void> {
  const response = await fetch(`${API_URL}/measurements`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear measurements (${response.status})`);
  }
}

// Create a building survey with its floors.
// The backend generates IDs for the survey and each floor.
export async function createSurvey(
  data: CreateSurveyRequest
): Promise<Survey> {
  const response = await fetch(`${API_URL}/surveys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to create survey (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

// Get all building surveys saved in the backend.
export async function getSurveys(): Promise<Survey[]> {
  const response = await fetch(`${API_URL}/surveys`);

  if (!response.ok) {
    throw new Error(`Failed to load surveys (${response.status})`);
  }

  return response.json();
}

// Get a specific building survey by its ID.
export async function getSurvey(id: string): Promise<Survey> {
  const response = await fetch(
    `${API_URL}/surveys/${encodeURIComponent(id)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to load survey (${response.status})`);
  }

  return response.json();
}



/**
 * Sends the survey information to Claude for analysis.
 * The backend generates and saves a report.
 */
export async function analyzeSurvey(
  data: AnalysisRequest
): Promise<AnalysisReport> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze Wi-Fi coverage.");
  }

  return response.json();
}

/**
 * Gets previously generated reports.
 * Optionally filters reports by survey ID.
 */
export async function getReports(
  surveyId?: string
): Promise<AnalysisReport[]> {
  const url = surveyId
    ? `/api/reports?survey_id=${encodeURIComponent(surveyId)}`
    : "/api/reports";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to load reports.");
  }

  return response.json();
}

/**
 * Gets one saved AI analysis report.
 */
export async function getReport(
  reportId: string
): Promise<AnalysisReport> {
  const response = await fetch(
    `/api/reports/${encodeURIComponent(reportId)}`
  );

  if (!response.ok) {
    throw new Error("Failed to load the report.");
  }

  return response.json();
}

/**
 * Deletes one Wi-Fi measurement.
 */
export async function deleteMeasurement(
  measurementId: string
): Promise<void> {
  const response = await fetch(
    `/api/measurements/${encodeURIComponent(measurementId)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete measurement.");
  }
}

/**
 * Clears measurements for one floor only.
 * Does not affect other floors or surveys.
 */
export async function clearFloorMeasurements(
  surveyId: string,
  floorId: string
): Promise<number> {
  const response = await fetch(
    `/api/surveys/${encodeURIComponent(surveyId)}/floors/${encodeURIComponent(floorId)}/measurements`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to clear floor measurements.");
  }

  const result: { deleted_count: number } = await response.json();

  return result.deleted_count;
}
