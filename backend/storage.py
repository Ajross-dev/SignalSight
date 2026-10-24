import json
import math
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


DATA_FILE = Path(__file__).resolve().parent / "data" / "measurements.json"
_storage_lock = threading.Lock()


def get_measurements() -> list[dict[str, object]]:
    """Return saved measurements, or an empty list when storage is not initialized."""
    with _storage_lock:
        return _read_measurements()


def save_measurement(
    scan_id: str,
    device_id: str,
    x: float,
    y: float,
    ssid: str,
    signal: float,
) -> dict[str, object]:
    """Append a scanned Wi-Fi measurement and return its complete record."""
    _validate_identifier("scan_id", scan_id)
    _validate_identifier("device_id", device_id)
    _validate_coordinate("x", x)
    _validate_coordinate("y", y)
    if not isinstance(ssid, str):
        raise ValueError("ssid must be a string")
    if (
        isinstance(signal, bool)
        or not isinstance(signal, (int, float))
        or not math.isfinite(signal)
        or not 0 <= signal <= 100
    ):
        raise ValueError("signal must be a finite number between 0 and 100")

    measurement: dict[str, object] = {
        "id": str(uuid4()),
        "scan_id": scan_id,
        "device_id": device_id,
        "x": x,
        "y": y,
        "ssid": ssid,
        "signal": signal,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with _storage_lock:
        measurements = _read_measurements()
        measurements.append(measurement)
        _write_measurements(measurements)

    return measurement


def clear_measurements() -> None:
    """Remove all saved measurements."""
    with _storage_lock:
        _write_measurements([])


def _validate_identifier(name: str, value: str) -> None:
    """Reject identifiers that are missing or contain only whitespace."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string")


def _validate_coordinate(name: str, value: float) -> None:
    """Ensure a map coordinate is a finite number between zero and one."""
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or not 0 <= value <= 1
    ):
        raise ValueError(f"{name} must be a finite number between 0 and 1")


def _read_measurements() -> list[dict[str, object]]:
    """Load and validate the measurement list from the JSON file."""
    if not DATA_FILE.exists():
        return []

    measurements = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if not isinstance(measurements, list) or any(
        not isinstance(measurement, dict)
        or not all(isinstance(key, str) for key in measurement)
        for measurement in measurements
    ):
        raise ValueError("Stored measurements must be a JSON array of objects")

    return measurements


def _write_measurements(measurements: list[dict[str, object]]) -> None:
    """Write measurements atomically so interrupted writes do not corrupt the file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=DATA_FILE.parent,
            prefix=f"{DATA_FILE.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(measurements, temporary_file, indent=2)
            temporary_file.write("\n")

        os.replace(temporary_path, DATA_FILE)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass