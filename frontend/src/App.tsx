
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import FloorPlan from "./components/FloorPlan";
import StatsCard from "./components/StatsCard";
import type { Measurement } from "./types/measurements";
import {
  getMeasurements,
  recordMeasurement,
  clearMeasurements,
} from "./services/api";
import "./App.css";

interface Location {
  x: number;
  y: number;
}

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Floor plan upload state.
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [floorPlanName, setFloorPlanName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing measurements when the application starts.
  useEffect(() => {
    getMeasurements()
      .then(setMeasurements)
      .catch(() => setError("Could not load measurements from backend"));
  }, []);

  // Release temporary image URLs when replaced or removed.
  useEffect(() => {
    return () => {
      if (floorPlan) {
        URL.revokeObjectURL(floorPlan);
      }
    };
  }, [floorPlan]);

  // Calculate statistics from recorded measurements.
  const signals = measurements.map((measurement) => measurement.signal);

  const averageSignal =
    signals.length > 0
      ? Math.round(
          signals.reduce((sum, signal) => sum + signal, 0) / signals.length
        )
      : 0;

  const strongestSignal =
    signals.length > 0 ? Math.max(...signals) : 0;

  const weakestSignal =
    signals.length > 0 ? Math.min(...signals) : 0;

  // Save the location selected on the map.
  function handleLocationSelect(x: number, y: number) {
    setLocation({ x, y });
  }

  // Record a new Wi-Fi measurement using the backend.
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

      setMeasurements((previous) => [...previous, newMeasurement]);
      setLocation(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record measurement"
      );
    } finally {
      setLoading(false);
    }
  }

  // Remove all measurements from the backend.
  async function handleClearMeasurements() {
    if (loading) return;

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

  // Handle an uploaded floor plan image.
  function handleFloorPlanUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    // Only allow supported image formats.
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      event.target.value = "";
      return;
    }

    // Create a temporary browser URL for the image.
    const imageUrl = URL.createObjectURL(file);

    setFloorPlan(imageUrl);
    setFloorPlanName(file.name);
    setLocation(null);
    setError("");

    event.target.value = "";
  }

  // Remove the uploaded floor plan.
  function handleRemoveFloorPlan() {
    setFloorPlan(null);
    setFloorPlanName("");
    setLocation(null);
  }

  return (
    <div className="app">

      {/* Application header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">◉</div>

          <div>
            <h1>SignalSight</h1>
            <p>Wireless Network Intelligence</p>
          </div>
        </div>

        <div className="status-indicator">
          <span className="status-dot"></span>
          Survey Workspace
        </div>
      </header>

      <main className="dashboard">

        {/* Dashboard heading */}
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">NETWORK ANALYTICS</p>
            <h2>Wi-Fi Coverage Dashboard</h2>

            <p className="dashboard-subtitle">
              Measure signal strength and visualize wireless coverage.
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="stats-grid">
          <StatsCard
            title="Total Measurements"
            value={measurements.length.toString()}
            description="Recorded survey points"
          />

          <StatsCard
            title="Average Signal"
            value={measurements.length ? `${averageSignal}%` : "—"}
            description="Across all readings"
          />

          <StatsCard
            title="Strongest Signal"
            value={measurements.length ? `${strongestSignal}%` : "—"}
            description="Best recorded location"
          />

          <StatsCard
            title="Weakest Signal"
            value={measurements.length ? `${weakestSignal}%` : "—"}
            description="Lowest recorded reading"
          />
        </div>

        {/* Coverage map */}
        <section className="map-card">

          <div className="map-header">
            <div>
              <h3>Coverage Map</h3>

              <p>
                {floorPlanName
                  ? `Floor plan: ${floorPlanName}`
                  : "Select a location on the map to record Wi-Fi signal strength."}
              </p>
            </div>

            <div className="map-actions">

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFloorPlanUpload}
                style={{ display: "none" }}
              />

              {/* Upload button */}
              <button
                className="button-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Floor Plan
              </button>

              {/* Remove image button */}
              {floorPlan && (
                <button
                  className="button-secondary"
                  onClick={handleRemoveFloorPlan}
                >
                  Remove Image
                </button>
              )}

              {/* Heatmap visibility toggle */}
              <label className="heatmap-toggle">
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(event) =>
                    setShowHeatmap(event.target.checked)
                  }
                />
                Show Heatmap
              </label>
            </div>
          </div>

          {/* Interactive floor plan */}
          <FloorPlan
            selectedLocation={location}
            onLocationSelect={handleLocationSelect}
            measurements={measurements}
            showHeatmap={showHeatmap}
            floorPlan={floorPlan}
          />

          {/* Signal strength legend */}
          <div className="map-footer">
            <div className="signal-legend">
              <span>Weak</span>
              <div className="legend-gradient"></div>
              <span>Strong</span>
            </div>

            <span className="measurement-count">
              {measurements.length} measurement
              {measurements.length !== 1 ? "s" : ""}
            </span>
          </div>
        </section>

        {/* Survey controls */}
        <section className="controls-card">
          <div>
            <h3>Survey Controls</h3>

            <p>
              {location
                ? `Selected location: X ${location.x.toFixed(2)}, Y ${location.y.toFixed(2)}`
                : "Click a location on the coverage map to begin."}
            </p>
          </div>

          <div className="control-buttons">
            <button
              className="button-secondary"
              onClick={handleClearMeasurements}
              disabled={loading || measurements.length === 0}
            >
              Clear Measurements
            </button>

            <button
              className="button-primary"
              onClick={handleRecordMeasurement}
              disabled={!location || loading}
            >
              {loading ? "Processing..." : "+ Record Measurement"}
            </button>
          </div>
        </section>

        {/* Display backend or upload errors */}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
