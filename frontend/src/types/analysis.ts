export interface AnalysisRequest {
  survey_id: string;
  floor_id?: string | null;

  router_count?: number;
  equipment?: string[];
  budget?: number | null;
  pain_points?: string[];
}

// A weak Wi-Fi location identified by Claude.
export interface DeadZone {
  x: number;
  y: number;
  signal: number;
  description: string;
}

// The structured results returned by Claude.
export interface AnalysisResult {
  coverage_score: number;
  summary: string;
  dead_zones: DeadZone[];
  router_placement_suggestions: string[];
  equipment_recommendations: string[];
}

// Coverage statistics calculated by the backend.
export interface CoverageData {
  measurement_count: number;
  average_signal: number | null;
  weak_measurement_count: number;
  strong_measurement_count: number;
  measurements: {
    x: number;
    y: number;
    signal: number;
  }[];
}

// A completed analysis report saved by the backend.
export interface AnalysisReport {
  id: string;
  survey_id: string;
  floor_id: string | null;
  created_at: string;
  coverage: CoverageData;
  analysis: AnalysisResult;
}
