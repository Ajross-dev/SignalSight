
import { useEffect, useRef } from "react";
import type { Measurement } from "../types/measurements";

interface HeatmapProps {
  measurements: Measurement[];
}

function Heatmap({ measurements }: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);

    if (measurements.length === 0) return;

    const image = context.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const normalizedX = x / width;
        const normalizedY = y / height;

        let weightedSignal = 0;
        let totalWeight = 0;
        let nearestDistance = Infinity;

        for (const measurement of measurements) {
          const dx = normalizedX - measurement.x;
          const dy = normalizedY - measurement.y;

          const distanceSquared = dx * dx + dy * dy;
          const distance = Math.sqrt(distanceSquared);

          nearestDistance = Math.min(nearestDistance, distance);

          const weight = 1 / (distanceSquared + 0.001);

          weightedSignal += measurement.signal * weight;
          totalWeight += weight;
        }

        const signal = weightedSignal / totalWeight;

        let red = 0;
        let green = 0;

        if (signal < 50) {
          red = 255;
          green = (signal / 50) * 255;
        } else {
          red = ((100 - signal) / 50) * 255;
          green = 255;
        }

        // Fade the heatmap away from recorded measurements.
        const fadeStart = 0.08;
        const fadeEnd = 0.30;

        const opacity = Math.max(
          0,
          Math.min(1, (fadeEnd - nearestDistance) / (fadeEnd - fadeStart))
        );

        const index = (y * width + x) * 4;

        image.data[index] = red;
        image.data[index + 1] = green;
        image.data[index + 2] = 0;
        image.data[index + 3] = opacity * 190;
      }
    }

    context.putImageData(image, 0, 0);
  }, [measurements]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={500}
      className="heatmap-canvas"
    />
  );
}

export default Heatmap;
