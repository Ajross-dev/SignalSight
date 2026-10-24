
import type { MouseEvent } from "react";
import type { Measurement } from "../types/measurements";

interface Location {
  x: number;
  y: number;
}

interface FloorPlanProps {
  selectedLocation: Location | null;
  onLocationSelect: (x: number, y: number) => void;
  measurements: Measurement[];
}

function FloorPlan({
  selectedLocation,
  onLocationSelect,
  measurements,
}: FloorPlanProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    onLocationSelect(x, y);
  }

  return (
    <div className="floor-plan" onClick={handleClick}>
      <p className="floor-plan-label">
        Click to select a location
      </p>

      {/* Blue marker for selected location */}
      {selectedLocation && (
        <div
          className="selected-marker"
          style={{
            left: `${selectedLocation.x * 100}%`,
            top: `${selectedLocation.y * 100}%`,
          }}
        />
      )}

      {/* Colored markers for recorded measurements */}
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
          title={`Signal: ${measurement.signal}%`}
        />
      ))}
    </div>
  );
}

export default FloorPlan;
