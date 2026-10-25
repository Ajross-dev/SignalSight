import base64
import json
import math
import os
import subprocess
import urllib.error
import urllib.request
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, StringConstraints, ValidationError

from scanner import scan_wifi
from storage import (
    clear_measurements,
    create_survey,
    delete_measurement,
    get_floorplan_path,
    get_measurements,
    get_report,
    get_reports,
    get_survey,
    get_surveys,
    save_floorplan,
    save_measurement,
    save_report,
    delete_survey,
)

load_dotenv()


Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
MAX_FLOORPLAN_BYTES = 10 * 1024 * 1024
FLOORPLAN_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class FloorPlanUpload(BaseModel):
    filename: Identifier
    content_type: str
    content_base64: str


class FloorRequest(BaseModel):
    name: Identifier
    floorplan: FloorPlanUpload | None = None


class SurveyRequest(BaseModel):
    building_name: Identifier
    address: str = ""
    floors: list[FloorRequest] = Field(min_length=1)
    router_count: int = Field(default=0, ge=0)
    equipment: list[str] = Field(default_factory=list)
    budget: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    pain_points: list[str] = Field(default_factory=list)


class MeasurementRequest(BaseModel):
    scan_id: Identifier
    device_id: Identifier
    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)
    survey_id: str | None = None
    floor_id: str | None = None


class AnalysisRequest(BaseModel):
    survey_id: Identifier
    floor_id: str | None = None
    router_count: int | None = Field(default=None, ge=0)
    equipment: list[str] | None = None
    budget: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    pain_points: list[str] | None = None


class DeadZone(BaseModel):
    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)
    signal: float = Field(ge=0, le=100, allow_inf_nan=False)
    description: str


class AnalysisResult(BaseModel):
    coverage_score: int = Field(ge=0, le=100)
    summary: str
    dead_zones: list[DeadZone]
    router_placement_suggestions: list[str]
    equipment_recommendations: list[str]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/wifi")
def get_wifi() -> dict[str, object]:
    """Return the current Wi-Fi details or report a scanner failure."""
    try:
        result = scan_wifi()
    except (OSError, RuntimeError, subprocess.SubprocessError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail=f"Wi-Fi scan failed: {error}",
        ) from error

    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])

    return result


@app.get("/api/measurements")
def get_all_measurements(
    survey_id: str | None = None,
    floor_id: str | None = None,
) -> list[dict[str, object]]:
    """Return saved measurements, optionally filtered to a survey and floor."""
    measurements = get_measurements()
    if survey_id is not None:
        measurements = [
            measurement
            for measurement in measurements
            if measurement.get("survey_id") == survey_id
        ]
    if floor_id is not None:
        measurements = [
            measurement
            for measurement in measurements
            if measurement.get("floor_id") == floor_id
        ]
    return measurements


@app.post("/api/measurements", status_code=201)
def create_measurement(request: MeasurementRequest) -> dict[str, object]:
    """Scan Wi-Fi and save the reading at the requested floor-plan location."""
    if request.floor_id is not None and request.survey_id is None:
        raise HTTPException(
            status_code=422,
            detail="survey_id is required when floor_id is provided",
        )
    if request.survey_id is not None:
        survey = get_survey(request.survey_id)
        if survey is None:
            raise HTTPException(status_code=404, detail="Survey not found")
        floor_ids = {
            floor.get("id")
            for floor in survey.get("floors", [])
            if isinstance(floor, dict)
        }
        if request.floor_id is not None and request.floor_id not in floor_ids:
            raise HTTPException(
                status_code=404,
                detail="Floor not found in the selected survey",
            )

    try:
        scan_result = scan_wifi()
    except (OSError, RuntimeError, subprocess.SubprocessError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail=f"Wi-Fi scan failed: {error}",
        ) from error

    if "error" in scan_result:
        raise HTTPException(status_code=503, detail=scan_result["error"])

    ssid = scan_result.get("ssid")
    signal = scan_result.get("signal")
    if (
        not isinstance(ssid, str)
        or isinstance(signal, bool)
        or not isinstance(signal, (int, float))
        or not math.isfinite(signal)
        or not 0 <= signal <= 100
    ):
        raise HTTPException(
            status_code=503,
            detail="Wi-Fi scanner returned invalid SSID or signal data",
        )

    return save_measurement(
        scan_id=request.scan_id,
        device_id=request.device_id,
        x=request.x,
        y=request.y,
        ssid=ssid,
        signal=signal,
        survey_id=request.survey_id,
        floor_id=request.floor_id,
    )


@app.delete("/api/measurements/{measurement_id}", status_code=204)
def delete_one_measurement(measurement_id: str) -> None:
    """Delete a single measurement by its ID."""
    if not delete_measurement(measurement_id):
        raise HTTPException(status_code=404, detail="Measurement not found")


@app.delete("/api/surveys/{survey_id}/floors/{floor_id}/measurements")
def delete_floor_measurements(survey_id: str, floor_id: str) -> dict[str, int]:
    """Delete all measurements for one floor in a survey."""
    survey = get_survey(survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")
    if not any(
        isinstance(floor, dict) and floor.get("id") == floor_id
        for floor in survey.get("floors", [])
    ):
        raise HTTPException(status_code=404, detail="Floor not found in the survey")

    return {
        "deleted_count": clear_measurements(
            survey_id=survey_id,
            floor_id=floor_id,
        )
    }


@app.delete("/api/measurements")
def delete_measurements(
    survey_id: str | None = None,
    floor_id: str | None = None,
    all: bool = False,
) -> dict[str, int]:
    """Delete measurements for one survey/floor, or all only when explicitly requested."""
    if all and (survey_id is not None or floor_id is not None):
        raise HTTPException(
            status_code=422,
            detail="all=true cannot be combined with survey_id or floor_id",
        )
    if not all and survey_id is None:
        raise HTTPException(
            status_code=422,
            detail="survey_id is required; use all=true to explicitly clear all measurements",
        )
    if floor_id is not None and survey_id is None:
        raise HTTPException(
            status_code=422,
            detail="survey_id is required when floor_id is provided",
        )
    if survey_id is not None:
        survey = get_survey(survey_id)
        if survey is None:
            raise HTTPException(status_code=404, detail="Survey not found")
        if floor_id is not None and not any(
            isinstance(floor, dict) and floor.get("id") == floor_id
            for floor in survey.get("floors", [])
        ):
            raise HTTPException(status_code=404, detail="Floor not found in the survey")
    return {
        "deleted_count": clear_measurements(
            survey_id=survey_id,
            floor_id=floor_id,
        )
    }


@app.post("/api/surveys", status_code=201)
def create_survey_endpoint(request: SurveyRequest) -> dict[str, object]:
    """Create a survey and persist any uploaded floor-plan images."""
    floors: list[dict[str, object]] = []
    for floor_request in request.floors:
        floor: dict[str, object] = {"name": floor_request.name}
        if floor_request.floorplan is not None:
            upload = floor_request.floorplan
            if upload.content_type not in FLOORPLAN_CONTENT_TYPES:
                raise HTTPException(
                    status_code=415,
                    detail="Floor plans must be JPEG, PNG, or WebP images",
                )
            encoded = upload.content_base64
            if len(encoded) > (MAX_FLOORPLAN_BYTES * 4 // 3) + 8:
                raise HTTPException(status_code=413, detail="Floor plan exceeds 10 MB")
            try:
                image_bytes = base64.b64decode(encoded, validate=True)
            except ValueError as error:
                raise HTTPException(
                    status_code=422,
                    detail="Floor plan content must be valid base64",
                ) from error
            if not image_bytes or len(image_bytes) > MAX_FLOORPLAN_BYTES:
                raise HTTPException(status_code=413, detail="Floor plan exceeds 10 MB")
            try:
                floor["floorplan"] = save_floorplan(
                    image_bytes,
                    upload.filename,
                    upload.content_type,
                )
            except ValueError as error:
                raise HTTPException(status_code=415, detail=str(error)) from error
        floors.append(floor)

    return create_survey(
        building_name=request.building_name,
        address=request.address.strip(),
        floors=floors,
        router_count=request.router_count,
        equipment=request.equipment,
        budget=request.budget,
        pain_points=request.pain_points,
    )


@app.get("/api/surveys")
def list_surveys() -> list[dict[str, object]]:
    """List saved building surveys."""
    return get_surveys()


@app.get("/api/surveys/{survey_id}")
def read_survey(survey_id: str) -> dict[str, object]:
    """Return one saved survey."""
    survey = get_survey(survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey


@app.delete("/api/surveys/{survey_id}", status_code=204)
def delete_survey_endpoint(survey_id: str) -> None:
    """Delete a saved survey."""
    if not delete_survey(survey_id):
        raise HTTPException(
            status_code=404,
            detail="Survey not found",
        )


@app.get("/api/floorplans/{filename}")
def read_floorplan(filename: str) -> FileResponse:
    """Serve an uploaded floor-plan image."""
    path = get_floorplan_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    return FileResponse(path)


@app.post("/api/analyze", status_code=201)
def analyze_survey(request: AnalysisRequest) -> dict[str, object]:
    """Analyze survey measurements with Claude and save the resulting report."""
    survey = get_survey(request.survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    floors = survey.get("floors", [])
    if request.floor_id is not None and not any(
        isinstance(floor, dict) and floor.get("id") == request.floor_id
        for floor in floors
    ):
        raise HTTPException(status_code=404, detail="Floor not found in the survey")

    measurements = [
        measurement
        for measurement in get_measurements()
        if measurement.get("survey_id") == request.survey_id
        and (
            request.floor_id is None
            or measurement.get("floor_id") == request.floor_id
        )
    ]
    valid_measurements = [
        measurement
        for measurement in measurements
        if all(
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            for value in (
                measurement.get("x"),
                measurement.get("y"),
                measurement.get("signal"),
            )
        )
    ]
    if not valid_measurements:
        raise HTTPException(
            status_code=422,
            detail="At least one valid Wi-Fi measurement is required for analysis",
        )

    signals = [measurement["signal"] for measurement in valid_measurements]
    coverage = {
        "measurement_count": len(signals),
        "average_signal": round(sum(signals) / len(signals), 1) if signals else None,
        "weak_measurement_count": sum(signal < 40 for signal in signals),
        "strong_measurement_count": sum(signal >= 70 for signal in signals),
        "measurements": [
            {
                "x": measurement["x"],
                "y": measurement["y"],
                "signal": measurement["signal"],
            }
            for measurement in valid_measurements
        ],
    }
    network_information = {
        "router_count": (
            request.router_count
            if request.router_count is not None
            else survey.get("router_count")
        ),
        "equipment": (
            request.equipment
            if request.equipment is not None
            else survey.get("equipment")
        ),
        "budget": (
            request.budget
            if "budget" in request.model_fields_set
            else survey.get("budget")
        ),
        "pain_points": (
            request.pain_points
            if request.pain_points is not None
            else survey.get("pain_points")
        ),
    }
    analysis = _request_claude_analysis(
        survey,
        request.floor_id,
        coverage,
        network_information,
    )
    report = save_report(
        survey_id=request.survey_id,
        floor_id=request.floor_id,
        coverage=coverage,
        analysis=analysis,
    )
    return report


@app.get("/api/reports")
def list_reports(survey_id: str | None = None) -> list[dict[str, object]]:
    """List saved reports, optionally filtered to a survey."""
    reports = get_reports()
    if survey_id is not None:
        reports = [
            report
            for report in reports
            if report.get("survey_id") == survey_id
        ]
    return reports


@app.get("/api/reports/{report_id}")
def read_report(report_id: str) -> dict[str, object]:
    """Return one saved analysis report."""
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: str) -> JSONResponse:
    """Download a saved report as JSON."""
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return JSONResponse(
        content=report,
        headers={
            "Content-Disposition": f'attachment; filename="signalsight-report-{report_id}.json"'
        },
    )


def _request_claude_analysis(
    survey: dict[str, object],
    floor_id: str | None,
    coverage: dict[str, object],
    network_information: dict[str, object],
) -> dict[str, object]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI analysis is not configured; set ANTHROPIC_API_KEY on the backend",
        )

    prompt = {
        "survey": {
            "building_name": survey.get("building_name"),
            "address": survey.get("address"),
        },
        "network_information": network_information,
        "floor_id": floor_id,
        "coverage": coverage,
    }
    payload = json.dumps(
        {
            "model": os.environ.get(
                "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"
            ),
            "max_tokens": 2048,
            "system": (
                "You are a Wi-Fi coverage analyst. Base recommendations only on "
                "the supplied measurements and network details. Explain limitations, "
                "prioritize practical changes within budget, and do not invent "
                "measurements or equipment capabilities. Return only a JSON object "
                "with exactly these keys: coverage_score (integer 0-100), summary "
                "(string), dead_zones (array of objects with normalized x and y "
                "coordinates from 0 to 1, signal from 0 to 100, and description), "
                "router_placement_suggestions (array of strings), and "
                "equipment_recommendations (array of strings). Only report dead "
                "zones at positions present in the supplied measurements."
            ),
            "messages": [
                {
                    "role": "user",
                    "content": json.dumps(prompt, ensure_ascii=True),
                }
            ],
        }
    ).encode("utf-8")
    provider_request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(provider_request, timeout=45) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI analysis provider returned HTTP {error.code}",
        ) from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider is unavailable",
        ) from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider returned an invalid response",
        ) from error

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider returned an invalid response",
        )
    content = result.get("content")
    if not isinstance(content, list):
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider returned an invalid response",
        )
    text = "\n".join(
        block["text"]
        for block in content
        if isinstance(block, dict) and isinstance(block.get("text"), str)
    ).strip()
    if not text:
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider returned no report text",
        )
    try:
        return AnalysisResult.model_validate_json(text).model_dump()
    except (ValidationError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail="AI analysis provider returned an invalid structured report",
        ) from error
