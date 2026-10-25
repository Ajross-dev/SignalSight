import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import FloorTabs from "./components/FloorTabs";
import FloorPlan from "./components/FloorPlan";
import StatsCard from "./components/StatsCard";
import AnalyzeModal from "./components/AnalyzeModal";

import SavedSurveys from "./pages/SavedSurveys";
import AnalysisReport from "./pages/AnalysisReport";

import type { Floor, Survey } from "./types/survey";
import type { Measurement } from "./types/measurements";
import type { AnalysisReport as AnalysisReportData } from "./types/analysis";

import {
  createSurvey,
  getMeasurements,
  recordMeasurement,
  clearFloorMeasurements,
} from "./services/api";

import "./App.css";

interface Location {
  x: number;
  y: number;
}

function App() {
  // Navigation
  const [page, setPage] = useState<"dashboard" | "surveys" | "report">(
    "dashboard"
  );

  // Building survey
  const [buildingName, setBuildingName] = useState("");
  const [savedSurvey, setSavedSurvey] = useState<Survey | null>(null);

  // Floors
  const [floors, setFloors] = useState<Floor[]>([
    {
      id: "floor-1",
      name: "Floor 1",
      floorPlan: null,
      measurements: [],
    },
  ]);

  const [selectedFloorId, setSelectedFloorId] = useState("floor-1");

  // Uploaded floor plan filenames
  const [floorPlanNames, setFloorPlanNames] = useState<Record<string, string>>(
    {}
  );

  // Wi-Fi measurements
  const [location, setLocation] = useState<Location | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // AI analysis
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [activeReport, setActiveReport] =
    useState<AnalysisReportData | null>(null);

  // Loading and feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // File references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFiles = useRef<Record<string, File>>({});
  const imageUrls = useRef<string[]>([]);

  // Current floor information
  const selectedFloor = floors.find(
    (floor) => floor.id === selectedFloorId
  );

  const floorPlan = selectedFloor?.floorPlan ?? null;
  const floorPlanName = floorPlanNames[selectedFloorId] ?? "";

  // Load saved measurements whenever the selected floor changes.
  useEffect(() => {
    if (!savedSurvey) {
      setMeasurements([]);
      return;
    }

    const surveyId = savedSurvey.id;
    let cancelled = false;

    async function loadMeasurements() {
      try {
        const data = await getMeasurements(surveyId, selectedFloorId);

        if (!cancelled) {
          setMeasurements(data);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load Wi-Fi measurements.");
        }
      }
    }

    setMeasurements([]);
    loadMeasurements();

    return () => {
      cancelled = true;
    };
  }, [savedSurvey, selectedFloorId]);

  // Release temporary image URLs when the app closes.
  useEffect(() => {
    const urls = imageUrls.current;

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Calculate statistics for the selected floor.
  const measurementCount = measurements.length;

  const averageSignal =
    measurementCount > 0
      ? Math.round(
          measurements.reduce(
            (total, measurement) => total + measurement.signal,
            0
          ) / measurementCount
        )
      : null;

  const strongestSignal =
    measurementCount > 0
      ? Math.max(...measurements.map((measurement) => measurement.signal))
      : null;

  const weakestSignal =
    measurementCount > 0
      ? Math.min(...measurements.map((measurement) => measurement.signal))
      : null;

  // Select a location on the floor plan.
  function handleLocationSelect(x: number, y: number) {
    if (loading) return;

    setLocation({ x, y });
    setError("");
    setMessage("");
  }

  // Add another floor before the survey is saved.
  function handleAddFloor() {
    if (savedSurvey || loading) return;

    const newFloor: Floor = {
      id: crypto.randomUUID(),
      name: `Floor ${floors.length + 1}`,
      floorPlan: null,
      measurements: [],
    };

    setFloors((previous) => [...previous, newFloor]);
    setSelectedFloorId(newFloor.id);
    setLocation(null);
  }

  // Switch between floors.
  function handleSelectFloor(id: string) {
    if (loading) return;

    setSelectedFloorId(id);
    setLocation(null);
    setError("");
    setMessage("");
  }

  // Rename a floor before saving.
  function handleRenameFloor(id: string, name: string) {
    if (savedSurvey || loading) return;

    setFloors((previous) =>
      previous.map((floor) =>
        floor.id === id ? { ...floor, name } : floor
      )
    );
  }

  // Upload a floor plan image.
  function handleFloorPlanUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || savedSurvey || loading) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!validTypes.includes(file.type)) {
      setError("Please upload a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Floor plan images must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    imageUrls.current.push(url);

    uploadedFiles.current[selectedFloorId] = file;

    setFloors((previous) =>
      previous.map((floor) =>
        floor.id === selectedFloorId
          ? { ...floor, floorPlan: url }
          : floor
      )
    );

    setFloorPlanNames((previous) => ({
      ...previous,
      [selectedFloorId]: file.name,
    }));

    setLocation(null);
    setError("");
    setMessage("Floor plan uploaded successfully.");

    event.target.value = "";
  }

  // Remove an uploaded floor plan before saving.
  function handleRemoveFloorPlan() {
    if (savedSurvey || loading) return;

    delete uploadedFiles.current[selectedFloorId];

    setFloors((previous) =>
      previous.map((floor) =>
        floor.id === selectedFloorId
          ? { ...floor, floorPlan: null }
          : floor
      )
    );

    setFloorPlanNames((previous) => {
      const updated = { ...previous };
      delete updated[selectedFloorId];
      return updated;
    });

    setLocation(null);
    setMessage("Floor plan removed.");
  }

  // Convert an image into base64 for the backend.
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Could not read the image."));
          return;
        }

        resolve(result.split(",")[1]);
      };

      reader.onerror = () => reject(new Error("Could not read the image."));

      reader.readAsDataURL(file);
    });
  }

  // Save the building and floor plans to the backend.
  async function handleSaveSurvey() {
    if (savedSurvey || loading) return;

    if (!buildingName.trim()) {
      setError("Please enter a building name.");
      return;
    }

    if (floors.some((floor) => !floor.name.trim())) {
      setError("Every floor needs a name.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const floorRequests = await Promise.all(
        floors.map(async (floor) => {
          const file = uploadedFiles.current[floor.id];

          if (!file) {
            return { name: floor.name.trim() };
          }

          return {
            name: floor.name.trim(),
            floorplan: {
              filename: file.name,
              content_type: file.type,
              content_base64: await fileToBase64(file),
            },
          };
        })
      );

      const selectedIndex = floors.findIndex(
        (floor) => floor.id === selectedFloorId
      );

      const survey = await createSurvey({
        building_name: buildingName.trim(),
        address: "",
        floors: floorRequests,
        router_count: 0,
        equipment: [],
        budget: null,
        pain_points: [],
      });

      const savedFloors: Floor[] = survey.floors.map((floor) => ({
        id: floor.id,
        name: floor.name,
        floorPlan: floor.floorplan?.url ?? null,
        measurements: [],
      }));

      const names: Record<string, string> = {};

      survey.floors.forEach((floor) => {
        if (floor.floorplan) {
          names[floor.id] = floor.floorplan.original_filename;
        }
      });

      setSavedSurvey(survey);
      setFloors(savedFloors);
      setFloorPlanNames(names);
      setSelectedFloorId(
        savedFloors[Math.max(selectedIndex, 0)]?.id ?? ""
      );

      setLocation(null);
      setMessage("Survey saved! You can now record Wi-Fi measurements.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save survey."
      );
    } finally {
      setLoading(false);
    }
  }

  // Record a Wi-Fi measurement at the selected location.
  async function handleRecordMeasurement() {
    if (!savedSurvey || !location || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const measurement = await recordMeasurement({
        scan_id: savedSurvey.id,
        device_id: "laptop-1",
        survey_id: savedSurvey.id,
        floor_id: selectedFloorId,
        x: location.x,
        y: location.y,
      });

      setMeasurements((previous) => [...previous, measurement]);
      setLocation(null);
      setMessage("Wi-Fi measurement recorded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record measurement."
      );
    } finally {
      setLoading(false);
    }
  }

  // Clear measurements only from the selected floor.
  async function handleClearMeasurements() {
    if (!savedSurvey || loading) return;

    const confirmed = window.confirm(
      "Delete all measurements on this floor? Other floors and surveys will not be affected."
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const deletedCount = await clearFloorMeasurements(
        savedSurvey.id,
        selectedFloorId
      );

      setMeasurements([]);
      setLocation(null);
      setMessage(`Deleted ${deletedCount} measurements from this floor.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to clear measurements."
      );
    } finally {
      setLoading(false);
    }
  }

  // Open an existing saved survey.
  function handleOpenSurvey(survey: Survey) {
    if (loading || survey.floors.length === 0) return;

    const loadedFloors: Floor[] = survey.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      floorPlan: floor.floorplan?.url ?? null,
      measurements: [],
    }));

    const names: Record<string, string> = {};

    survey.floors.forEach((floor) => {
      if (floor.floorplan) {
        names[floor.id] = floor.floorplan.original_filename;
      }
    });

    setBuildingName(survey.building_name);
    setFloors(loadedFloors);
    setFloorPlanNames(names);
    setSelectedFloorId(loadedFloors[0].id);
    setSavedSurvey(survey);

    setLocation(null);
    setMeasurements([]);
    setActiveReport(null);
    setShowAnalyzeModal(false);

    setError("");
    setMessage(`Opened ${survey.building_name}.`);
    setPage("dashboard");
  }

  // Start a new building survey.
  function handleCreateSurvey() {
    if (loading) return;

    uploadedFiles.current = {};

    setBuildingName("");
    setSavedSurvey(null);

    setFloors([
      {
        id: "floor-1",
        name: "Floor 1",
        floorPlan: null,
        measurements: [],
      },
    ]);

    setSelectedFloorId("floor-1");
    setFloorPlanNames({});
    setLocation(null);
    setMeasurements([]);
    setShowHeatmap(true);

    setActiveReport(null);
    setShowAnalyzeModal(false);

    setError("");
    setMessage("");
    setPage("dashboard");
  }

  // Open the network information form.
  function handleOpenAnalyzeModal() {
    if (!savedSurvey) {
      setError("Please save your survey before analyzing.");
      return;
    }

    if (measurements.length === 0) {
      setError("Record at least one measurement before analyzing.");
      return;
    }

    setError("");
    setMessage("");
    setShowAnalyzeModal(true);
  }

  // Show the report after Claude finishes.
  function handleAnalysisComplete(report: AnalysisReportData) {
    setActiveReport(report);
    setShowAnalyzeModal(false);
    setPage("report");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">◉</div>
          <h1>SignalSight</h1>
        </div>

        <nav className="header-nav">
          <button
            type="button"
            className={`nav-button ${page === "dashboard" ? "active" : ""}`}
            onClick={() => setPage("dashboard")}
            disabled={loading}
          >
            Dashboard
          </button>

          <button
            type="button"
            className={`nav-button ${page === "surveys" ? "active" : ""}`}
            onClick={() => setPage("surveys")}
            disabled={loading}
          >
            Saved Surveys
          </button>
        </nav>
      </header>

      <main className="dashboard">
        {page === "surveys" ? (
          <SavedSurveys
            onOpenSurvey={handleOpenSurvey}
            onCreateSurvey={handleCreateSurvey}
          />
        ) : page === "report" && activeReport ? (
          <AnalysisReport
            report={activeReport}
            onBack={() => setPage("dashboard")}
          />
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">NETWORK SURVEY DASHBOARD</p>
                <h2>Wi-Fi Coverage Survey</h2>
                <p>
                  Map your building, record wireless signal strength, and
                  analyze coverage with AI.
                </p>
              </div>

              <div className="dashboard-status">
                <span className="status-dot" />
                {savedSurvey ? "Survey Saved" : "New Survey"}
              </div>
            </div>

            <div className="workflow-hint">
              <span>1. Set up your building</span>
              <span>2. Upload floor plans</span>
              <span>3. Record measurements</span>
              <span>4. Analyze with AI</span>
            </div>

            {/* Building setup */}
            <section className="dashboard-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">STEP 01</p>
                  <h3>Building Setup</h3>
                  <p>Enter a name for your building survey.</p>
                </div>
              </div>

              <div className="building-setup-row">
                <div className="building-name-field">
                  <label htmlFor="building-name">Building Name</label>
                  <input
                    id="building-name"
                    type="text"
                    placeholder="e.g. Main Office Building"
                    value={buildingName}
                    onChange={(event) => setBuildingName(event.target.value)}
                    disabled={!!savedSurvey || loading}
                  />
                </div>

                <button
                  type="button"
                  className="button-primary"
                  onClick={handleSaveSurvey}
                  disabled={!!savedSurvey || loading}
                >
                  {savedSurvey
                    ? "Survey Saved"
                    : loading
                      ? "Saving..."
                      : "Save Survey"}
                </button>
              </div>
            </section>

            {/* Wi-Fi statistics */}
            <section className="stats-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">LIVE SURVEY RESULTS</p>
                  <h3>Coverage Overview</h3>
                </div>
              </div>

              <div className="stats-grid">
                <StatsCard
                  title="Measurements"
                  value={String(measurementCount)}
                  description="Total Wi-Fi readings on this floor"
                />

                <StatsCard
                  title="Average Signal"
                  value={averageSignal === null ? "--" : `${averageSignal}%`}
                  description="Average signal strength across measurements"
                />

                <StatsCard
                  title="Strongest Signal"
                  value={
                    strongestSignal === null ? "--" : `${strongestSignal}%`
                  }
                  description="Highest recorded Wi-Fi signal strength"
                />

                <StatsCard
                  title="Weakest Signal"
                  value={weakestSignal === null ? "--" : `${weakestSignal}%`}
                  description="Lowest recorded Wi-Fi signal strength"
                />
              </div>
            </section>

            {/* Floor plan */}
            <section className="dashboard-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">STEP 02</p>
                  <h3>Floor Plan & Coverage Map</h3>
                  <p>
                    Upload a floor plan and select locations to record Wi-Fi
                    signal strength.
                  </p>
                </div>
              </div>

              <FloorTabs
                floors={floors}
                selectedFloorId={selectedFloorId}
                onSelectFloor={handleSelectFloor}
                onAddFloor={handleAddFloor}
                onRenameFloor={handleRenameFloor}
                disabled={!!savedSurvey || loading}
              />

              <div className="floorplan-toolbar">
                <div className="floorplan-file-info">
                  <span>
                    {floorPlanName || "No floor plan uploaded"}
                  </span>
                </div>

                <div className="floorplan-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={handleFloorPlanUpload}
                  />

                  {!savedSurvey && (
                    <>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                      >
                        Upload Floor Plan
                      </button>

                      {floorPlan && (
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={handleRemoveFloorPlan}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}

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

              <FloorPlan
                floorPlan={floorPlan}
                measurements={measurements}
                selectedLocation={location}
                showHeatmap={showHeatmap}
                onLocationSelect={handleLocationSelect}
              />

              {location && (
                <div className="selected-location">
                  Selected Location: ({location.x.toFixed(2)},{" "}
                  {location.y.toFixed(2)})
                </div>
              )}
            </section>

            {/* Measurement controls */}
            <section className="dashboard-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">STEP 03</p>
                  <h3>Wi-Fi Measurements</h3>
                  <p>
                    Select a point on the floor plan, then record the current
                    Wi-Fi signal strength.
                  </p>
                </div>
              </div>

              <div className="measurement-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleRecordMeasurement}
                  disabled={!savedSurvey || !location || loading}
                >
                  {loading ? "Working..." : "Record Measurement"}
                </button>

                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleClearMeasurements}
                  disabled={!savedSurvey || measurementCount === 0 || loading}
                >
                  Clear Floor Measurements
                </button>
              </div>
            </section>

            {/* AI analysis */}
            <section className="dashboard-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">STEP 04</p>
                  <h3>AI Network Analysis</h3>
                  <p>
                    Get personalized recommendations for improving wireless
                    coverage using Claude AI.
                  </p>
                </div>
              </div>

              <div className="measurement-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleOpenAnalyzeModal}
                  disabled={!savedSurvey || measurementCount === 0 || loading}
                >
                  ✦ Analyze with AI
                </button>

                {activeReport && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setPage("report")}
                  >
                    View Latest Report
                  </button>
                )}
              </div>
            </section>

            {/* User feedback */}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}
          </>
        )}
      </main>

      {/* AI analysis form */}
      {showAnalyzeModal && savedSurvey && (
        <AnalyzeModal
          surveyId={savedSurvey.id}
          floorId={selectedFloorId}
          onClose={() => setShowAnalyzeModal(false)}
          onComplete={handleAnalysisComplete}
        />
      )}
    </div>
  );
}

export default App;
