
import type {
  Measurement,
  MeasurementRequest,
} from "../types/measurements";

const API_URL = "/api";

// Get all saved Wi-Fi measurements
export async function getMeasurements(): Promise<Measurement[]> {
  const response = await fetch(`${API_URL}/measurements`);

  if (!response.ok) {
    throw new Error(`Failed to load measurements (${response.status})`);
  }

  return response.json();
}

// Record a real Wi-Fi measurement at the selected location
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

// Delete all saved Wi-Fi measurements
export async function clearMeasurements(): Promise<void> {
  const response = await fetch(`${API_URL}/measurements`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear measurements (${response.status})`);
  }
}
