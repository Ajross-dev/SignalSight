import { useState } from "react";
import type { Floor } from "../types/survey";

interface FloorTabsProps {
  floors: Floor[];
  selectedFloorId: string;
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onRenameFloor: (id: string, name: string) => void;
  disabled?: boolean;
}

function FloorTabs({
  floors,
  selectedFloorId,
  onSelectFloor,
  onAddFloor,
  onRenameFloor,
}: FloorTabsProps) {
  // Track which floor is currently being renamed.
  const [editingFloorId, setEditingFloorId] = useState<string | null>(
    null
  );

  // Store the name while the user is editing.
  const [newName, setNewName] = useState("");

  // Start editing a floor's name.
  function handleStartEdit(floor: Floor) {
    setEditingFloorId(floor.id);
    setNewName(floor.name);
  }

  // Save the updated name.
  function handleSaveEdit(id: string) {
    // Prevent empty floor names.
    if (!newName.trim()) return;

    onRenameFloor(id, newName.trim());
    setEditingFloorId(null);
  }

  return (
    <div className="floor-tabs">
      {floors.map((floor) => (
        <div key={floor.id} className="floor-tab-group">
          {editingFloorId === floor.id ? (
            // Show an input when renaming.
            <div className="floor-edit">
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSaveEdit(floor.id);
                  }

                  if (event.key === "Escape") {
                    setEditingFloorId(null);
                  }
                }}
                autoFocus
              />

              <button
                className="floor-save-button"
                onClick={() => handleSaveEdit(floor.id)}
              >
                Save
              </button>
            </div>
          ) : (
            <>
              {/* Select this floor. */}
              <button
                className={
                  selectedFloorId === floor.id
                    ? "floor-tab active"
                    : "floor-tab"
                }
                onClick={() => onSelectFloor(floor.id)}
              >
                {floor.name}
              </button>

              {/* Rename this floor. */}
              <button
                className="floor-rename-button"
                onClick={() => handleStartEdit(floor)}
                title={`Rename ${floor.name}`}
                aria-label={`Rename ${floor.name}`}
              >
                ✎
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add another floor. */}
      <button className="add-floor-button" onClick={onAddFloor}>
        + Add Floor
      </button>
    </div>
  );
}

export default FloorTabs;
