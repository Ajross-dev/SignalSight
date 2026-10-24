import { useState } from "react";
import type { Measurement } from "./types/measurements";
import FloorPlan from "./components/FloorPlan";
import "./App.css";


interface Location {
  x: number;
  y: number;
}

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  function handleRecordMeasurement() {
    if (!location) return;

    const newMeasurement: Measurement = {
      id: crypto.randomUUID(),
      scan_id: "demo-survey",
      device_id: "laptop-1",
      x: location.x,
      y: location.y,
      ssid: "Demo-WiFi",
      signal: Math.floor(Math.random() * 101),
      timestamp: new Date().toISOString(),
    };
    setMeasurements([...measurements, newMeasurement]);
    setLocation(null);
  }

  function handleLocationSelect(x: number, y: number) {
    setLocation({ x, y });
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

      <button
        onClick={handleRecordMeasurement}
        disabled={!location}
      >
        Record Measurement
      </button>

      {location && (
        <p>
          Selected location: X = {location.x.toFixed(2)},
          Y = {location.y.toFixed(2)}
        </p>
      )}
    </div>
  );
}

export default App;