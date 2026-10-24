import { useEffect, useState } from "react";
import FloorPlan from "./components/FloorPlan";
import type { Measurement } from "./types/measurements";
import "./App.css";

import {
  getMeasurements,
  recordMeasurement,
  clearMeasurements,
} from "./services/api";


interface Location {
  x: number;
  y: number;
}

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMeasurements()
      .then(setMeasurements)
      .catch(() => setError("Could not load measurements from backend"));
  }, []);

  function handleLocationSelect(x: number, y: number) {
    setLocation({ x, y });
  }

  async function handleRecordMeasurement() {
    if (!location || loading) return;

    setLoading(true);
    setError("");

    try {
      const newMeasurement = await recordMeasurement({
        scan_id: "demo-survey",
        device_id: "laptop-1",
        x: location.x,
        y: location.y,
      });

      setMeasurements((prev) => [...prev, newMeasurement]);
      setLocation(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record measurement"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleClearMeasurements() {
    setLoading(true);
    setError("");

    try {
      await clearMeasurements();
      setMeasurements([]);
      setLocation(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear measurements"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>SignalSight</h1>
      <p>Visualize Wi-Fi coverage in your building.</p>

      <FloorPlan
        selectedLocation={location}
        onLocationSelect={handleLocationSelect}
        measurements={measurements}
      />

      {location && (
        <p>
          Selected location: X = {location.x.toFixed(2)},
          Y = {location.y.toFixed(2)}
        </p>
      )}

      <button
        onClick={handleRecordMeasurement}
        disabled={!location || loading}
      >
        {loading ? "Recording..." : "Record Measurement"}
      </button>

      <button
        onClick={handleClearMeasurements}
        disabled={loading || measurements.length === 0}
      >
        Clear Measurements
      </button>

      <p>Measurements recorded: {measurements.length}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default App;
