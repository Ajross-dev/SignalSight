import json
import math
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4


DATA_FILE = Path(__file__).resolve().parent / "data" / "measurements.json"
SURVEYS_FILE = DATA_FILE.with_name("surveys.json")
FLOORPLANS_DIR = DATA_FILE.parent / "floorplans"
REPORTS_DIR = DATA_FILE.parent / "reports"
MAX_FLOORPLAN_BYTES = 10 * 1024 * 1024
FLOORPLAN_TYPES = {
    "image/jpeg": (".jpg", lambda content: content.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda content: content.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        ".webp",
        lambda content: len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP",
    ),
}
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
    survey_id: str | None = None,
    floor_id: str | None = None,
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
    if survey_id is not None:
        _validate_identifier("survey_id", survey_id)
        measurement["survey_id"] = survey_id
    if floor_id is not None:
        _validate_identifier("floor_id", floor_id)
        if survey_id is None:
            raise ValueError("survey_id is required when floor_id is provided")
        measurement["floor_id"] = floor_id

    with _storage_lock:
        measurements = _read_measurements()
        measurements.append(measurement)
        _write_measurements(measurements)

    return measurement


def delete_measurement(measurement_id: str) -> bool:
    """Remove one saved measurement, returning whether it existed."""
    with _storage_lock:
        measurements = _read_measurements()
        remaining = [
            measurement
            for measurement in measurements
            if measurement.get("id") != measurement_id
        ]
        if len(remaining) == len(measurements):
            return False
        _write_measurements(remaining)
        return True


def clear_measurements(
    survey_id: str | None = None,
    floor_id: str | None = None,
) -> int:
    """Remove measurements matching the supplied survey and optional floor."""
    if floor_id is not None and survey_id is None:
        raise ValueError("survey_id is required when floor_id is provided")

    with _storage_lock:
        measurements = _read_measurements()
        if survey_id is None:
            remaining: list[dict[str, object]] = []
        else:
            remaining = [
                measurement
                for measurement in measurements
                if not (
                    measurement.get("survey_id") == survey_id
                    and (
                        floor_id is None
                        or measurement.get("floor_id") == floor_id
                    )
                )
            ]
        deleted_count = len(measurements) - len(remaining)
        if deleted_count:
            _write_measurements(remaining)
        return deleted_count


def save_floorplan(
    content: bytes,
    original_filename: str,
    content_type: str,
) -> dict[str, str]:
    """Validate and persist a floor-plan image under a generated filename."""
    if not isinstance(content, bytes) or not content or len(content) > MAX_FLOORPLAN_BYTES:
        raise ValueError("Floor plan must be a non-empty image no larger than 10 MB")
    image_format = FLOORPLAN_TYPES.get(content_type)
    if image_format is None or not image_format[1](content):
        raise ValueError("Floor plan data does not match its JPEG, PNG, or WebP type")

    extension = image_format[0]
    filename = f"{uuid4()}{extension}"
    display_name = Path(original_filename.replace("\\", "/")).name.strip()
    if not display_name:
        display_name = filename
    path = FLOORPLANS_DIR / filename
    with _storage_lock:
        FLOORPLANS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    return {
        "filename": filename,
        "original_filename": display_name,
        "content_type": content_type,
        "url": f"/api/floorplans/{filename}",
    }


def get_floorplan_path(filename: str) -> Path | None:
    """Resolve a generated floor-plan filename without allowing path traversal."""
    try:
        name, extension = filename.rsplit(".", 1)
        UUID(name)
    except (AttributeError, ValueError):
        return None
    if f".{extension}" not in {".jpg", ".png", ".webp"}:
        return None

    path = FLOORPLANS_DIR / filename
    return path if path.is_file() else None


def create_survey(
    building_name: str,
    address: str,
    floors: list[dict[str, object]],
    router_count: int,
    equipment: list[str],
    budget: float | None,
    pain_points: list[str],
) -> dict[str, object]:
    """Save a new building survey and assign stable IDs to its floors."""
    _validate_identifier("building_name", building_name)
    saved_floors: list[dict[str, object]] = []
    for floor in floors:
        name = floor.get("name")
        if not isinstance(name, str):
            raise ValueError("Each floor must have a name")
        _validate_identifier("floor name", name)
        saved_floors.append(
            {
                **floor,
                "id": str(uuid4()),
                "name": name.strip(),
            }
        )

    survey: dict[str, object] = {
        "id": str(uuid4()),
        "building_name": building_name.strip(),
        "address": address,
        "floors": saved_floors,
        "router_count": router_count,
        "equipment": equipment,
        "budget": budget,
        "pain_points": pain_points,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    with _storage_lock:
        surveys = _read_json_list(SURVEYS_FILE, "surveys")
        surveys.append(survey)
        _write_json_atomic(SURVEYS_FILE, surveys)
    return survey


def get_surveys() -> list[dict[str, object]]:
    """Return all saved surveys."""
    with _storage_lock:
        return _read_json_list(SURVEYS_FILE, "surveys")


def get_survey(survey_id: str) -> dict[str, object] | None:
    """Return one survey by ID."""
    with _storage_lock:
        return next(
            (
                survey
                for survey in _read_json_list(SURVEYS_FILE, "surveys")
                if survey.get("id") == survey_id
            ),
            None,
        )


def save_report(
    survey_id: str,
    floor_id: str | None,
    coverage: dict[str, object],
    analysis: dict[str, object],
) -> dict[str, object]:
    """Persist a generated survey analysis as a JSON report."""
    report: dict[str, object] = {
        "id": str(uuid4()),
        "survey_id": survey_id,
        "floor_id": floor_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "coverage": coverage,
        "analysis": analysis,
    }
    with _storage_lock:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        _write_json_atomic(REPORTS_DIR / f"{report['id']}.json", report)
    return report


def get_reports() -> list[dict[str, object]]:
    """Return all saved reports, newest first."""
    with _storage_lock:
        if not REPORTS_DIR.exists():
            return []
        reports = [
            _read_json_object(path)
            for path in REPORTS_DIR.glob("*.json")
            if path.is_file()
        ]
    return sorted(
        reports,
        key=lambda report: str(report.get("created_at", "")),
        reverse=True,
    )


def get_report(report_id: str) -> dict[str, object] | None:
    """Return one saved report by generated UUID."""
    try:
        normalized_id = str(UUID(report_id))
    except (AttributeError, ValueError):
        return None

    path = REPORTS_DIR / f"{normalized_id}.json"
    with _storage_lock:
        if not path.is_file():
            return None
        return _read_json_object(path)


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

    return _read_json_list(DATA_FILE, "measurements")


def _write_measurements(measurements: list[dict[str, object]]) -> None:
    """Write measurements atomically so interrupted writes do not corrupt the file."""
    _write_json_atomic(DATA_FILE, measurements)


def _read_json_list(path: Path, description: str) -> list[dict[str, object]]:
    """Read a JSON array of objects from the requested storage file."""
    if not path.exists():
        return []
    values = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(values, list) or any(
        not isinstance(value, dict)
        or not all(isinstance(key, str) for key in value)
        for value in values
    ):
        raise ValueError(f"Stored {description} must be a JSON array of objects")
    return values


def _read_json_object(path: Path) -> dict[str, object]:
    """Read and validate a JSON object from the requested storage file."""
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not all(
        isinstance(key, str) for key in value
    ):
        raise ValueError(f"Stored report at {path.name} must be a JSON object")
    return value


def _write_json_atomic(path: Path, value: object) -> None:
    """Write JSON atomically so interrupted writes do not corrupt storage."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f"{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(value, temporary_file, indent=2)
            temporary_file.write("\n")

        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass