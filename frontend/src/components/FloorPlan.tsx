
import type { MouseEvent } from "react";
import type { Measurement } from "../types/measurements";
import Heatmap from "./HeatMap";

interface Location {
  x: number;
  y: number;
}

interface FloorPlanProps {
  selectedLocation: Location | null;
  onLocationSelect: (x: number, y: number) => void;
  measurements: Measurement[];
  showHeatmap: boolean;
  floorPlan: string | null;
}

function FloorPlan({
  selectedLocation,
  onLocationSelect,
  measurements,
  showHeatmap,
  floorPlan,
}: FloorPlanProps) {

  // Convert a click on the map into coordinates between 0 and 1.
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    onLocationSelect(
      Math.max(0, Math.min(1, x)),
      Math.max(0, Math.min(1, y))
    );
  }

  return (
    <div className="floor-plan" onClick={handleClick}>

      {/* Uploaded floor plan appears behind everything else. */}
      {floorPlan && (
        <img
          src={floorPlan}
          alt="Uploaded building floor plan"
          className="floor-plan-image"
          draggable={false}
        />
      )}

      {/* Display the heatmap when enabled. */}
      {showHeatmap && <Heatmap measurements={measurements} />}

      {/* Instructions when there are no recorded measurements. */}
      {measurements.length === 0 && (
        <p className="floor-plan-label">
          Click anywhere on the map to select your first location
        </p>
      )}

      {/* Display all recorded Wi-Fi measurements. */}
      {measurements.map((measurement) => (
        <div
          key={measurement.id}
          className="measurement-marker"
          style={{
            left: `${measurement.x * 100}%`,
            top: `${measurement.y * 100}%`,
            backgroundColor:
              measurement.signal >= 70
                ? "#22c55e"
                : measurement.signal >= 40
                  ? "#eab308"
                  : "#ef4444",
          }}
          title={`${measurement.ssid}: ${measurement.signal}%`}
        >
          {Math.round(measurement.signal)}%
        </div>
      ))}

      {/* Highlight the location selected by the user. */}
      {selectedLocation && (
        <div
          className="selected-marker"
          style={{
            left: `${selectedLocation.x * 100}%`,
            top: `${selectedLocation.y * 100}%`,
          }}
        />
      )}
    </div>
  );
}

export default FloorPlan;
