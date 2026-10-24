export interface Measurement {
  id: string;
  scan_id: string;
  device_id: string;
  x: number;
  y: number;
  ssid: string;
  signal: number;
  timestamp: string;
}

export type MeasurementRequest = Pick<
  Measurement,
  "scan_id" | "device_id" | "x" | "y"
>;