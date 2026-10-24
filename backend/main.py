import math
import subprocess
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, StringConstraints

from scanner import scan_wifi
from storage import clear_measurements, save_measurement


Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class MeasurementRequest(BaseModel):
    scan_id: Identifier
    device_id: Identifier
    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)


app = FastAPI()


@app.post("/api/measurements", status_code=201)
def create_measurement(request: MeasurementRequest) -> dict[str, object]:
    """Scan Wi-Fi and save the reading at the requested floor-plan location."""
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
    )


@app.delete("/api/measurements", status_code=204)
def delete_measurements() -> None:
    """Delete all saved measurements."""
    clear_measurements()