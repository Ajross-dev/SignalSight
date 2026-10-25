
import type { Measurement } from "./measurements";

// A floor in our React dashboard.
export interface Floor {
  id: string;
  name: string;
  floorPlan: string | null;
  measurements: Measurement[];
}

// A survey stored in the backend.
export interface Survey {
  id: string;
  building_name: string;
  address: string;
  floors: SavedFloor[];
  router_count: number;
  equipment: string[];
  budget: number | null;
  pain_points: string[];
  created_at: string;
}

// Information about an uploaded floor plan.
export interface SavedFloorPlan {
  filename: string;
  original_filename: string;
  content_type: string;
  url: string;
}

// A floor returned by the backend.
export interface SavedFloor {
  id: string;
  name: string;
  floorplan?: SavedFloorPlan;
}

// Data sent when creating a survey.
export interface CreateSurveyRequest {
  building_name: string;
  address: string;
  floors: CreateFloorRequest[];
  router_count: number;
  equipment: string[];
  budget: number | null;
  pain_points: string[];
}

// Floor information sent to the backend.
export interface CreateFloorRequest {
  name: string;
  floorplan?: {
    filename: string;
    content_type: string;
    content_base64: string;
  };
}
