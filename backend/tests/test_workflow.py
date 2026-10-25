import base64
import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

import main
import storage


class FakeClaudeResponse:
    def __init__(self, analysis: dict[str, object] | str) -> None:
        text = analysis if isinstance(analysis, str) else json.dumps(analysis)
        self.body = json.dumps(
            {"content": [{"type": "text", "text": text}]}
        ).encode("utf-8")

    def __enter__(self) -> "FakeClaudeResponse":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self) -> bytes:
        return self.body


class WorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.directory = Path(self.temp_dir.name)
        self.patches = ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(
            patch.object(storage, "DATA_FILE", self.directory / "measurements.json")
        )
        self.patches.enter_context(
            patch.object(storage, "SURVEYS_FILE", self.directory / "surveys.json")
        )
        self.patches.enter_context(
            patch.object(storage, "FLOORPLANS_DIR", self.directory / "floorplans")
        )
        self.patches.enter_context(
            patch.object(storage, "REPORTS_DIR", self.directory / "reports")
        )
    def create_survey(self) -> tuple[str, str, str]:
        survey = main.create_survey_endpoint(
            main.SurveyRequest(
                building_name="Test office",
                address="1 Example Street",
                floors=[main.FloorRequest(name="Ground"), main.FloorRequest(name="First")],
                router_count=2,
                equipment=["Router model A", "Extender model B"],
                budget=750,
                pain_points=["Dropped video calls"],
            )
        )
        return survey["id"], survey["floors"][0]["id"], survey["floors"][1]["id"]

    def test_expected_api_routes_are_registered(self) -> None:
        paths = main.app.openapi()["paths"]
        self.assertIn("/api/measurements", paths)
        self.assertIn("/api/surveys", paths)
        self.assertIn("/api/analyze", paths)
        self.assertIn("/api/reports/{report_id}", paths)
        self.assertIn("/api/reports/{report_id}/download", paths)

    def test_survey_measurement_analysis_and_report_retrieval(self) -> None:
        survey_id, ground_floor_id, first_floor_id = self.create_survey()
        self.patches.enter_context(
            patch.object(
                main,
                "scan_wifi",
                return_value={"ssid": "Office Wi-Fi", "signal": 32},
            )
        )

        measurement = main.create_measurement(
            main.MeasurementRequest(
                scan_id="scan-1",
                device_id="test-laptop",
                x=0.25,
                y=0.75,
                survey_id=survey_id,
                floor_id=ground_floor_id,
            )
        )

        floor_measurements = main.get_all_measurements(
            survey_id=survey_id,
            floor_id=ground_floor_id,
        )
        self.assertEqual([item["id"] for item in floor_measurements], [measurement["id"]])
        self.assertEqual(
            main.get_all_measurements(survey_id=survey_id, floor_id=first_floor_id),
            [],
        )

        claude_analysis = {
            "coverage_score": 42,
            "summary": "Coverage is weak at the measured point.",
            "dead_zones": [
                {
                    "x": 0.25,
                    "y": 0.75,
                    "signal": 32,
                    "description": "Weak signal at the measured location.",
                }
            ],
            "router_placement_suggestions": ["Relocate an access point near this area."],
            "equipment_recommendations": ["Consider a mesh access point within budget."],
        }
        request_context: dict[str, object] = {}

        def fake_urlopen(request: object, timeout: int) -> FakeClaudeResponse:
            self.assertEqual(timeout, 45)
            request_context.update(json.loads(request.data)["messages"][0])
            return FakeClaudeResponse(claude_analysis)

        with (
            patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"}),
            patch.object(main.urllib.request, "urlopen", side_effect=fake_urlopen),
        ):
            report = main.analyze_survey(
                main.AnalysisRequest(
                    survey_id=survey_id,
                    floor_id=ground_floor_id,
                    router_count=3,
                    equipment=["Router model C"],
                    budget=500,
                    pain_points=["Dropped calls", "Slow video"],
                )
            )

        self.assertEqual(report["coverage"]["measurement_count"], 1)
        self.assertEqual(report["coverage"]["measurements"], [{"x": 0.25, "y": 0.75, "signal": 32}])
        self.assertEqual(report["analysis"]["coverage_score"], 42)

        prompt = json.loads(request_context["content"])
        self.assertEqual(prompt["network_information"]["router_count"], 3)
        self.assertEqual(prompt["network_information"]["equipment"], ["Router model C"])
        self.assertEqual(prompt["network_information"]["budget"], 500)
        self.assertEqual(prompt["network_information"]["pain_points"], ["Dropped calls", "Slow video"])
        self.assertEqual(prompt["coverage"]["measurements"], [{"x": 0.25, "y": 0.75, "signal": 32}])

        report_id = report["id"]
        self.assertEqual(main.read_report(report_id), report)

        listed = main.list_reports(survey_id=survey_id)
        self.assertEqual([item["id"] for item in listed], [report_id])

        downloaded = main.download_report(report_id)
        self.assertEqual(json.loads(downloaded.body), report)
        self.assertIn("attachment;", downloaded.headers["content-disposition"])

    def test_measurement_rejects_unknown_floor_and_surfaces_scan_error(self) -> None:
        survey_id, _, _ = self.create_survey()
        with self.assertRaises(HTTPException) as invalid_floor:
            main.create_measurement(
                main.MeasurementRequest(
                    scan_id="scan-invalid",
                    device_id="test-laptop",
                    x=0.5,
                    y=0.5,
                    survey_id=survey_id,
                    floor_id="not-a-floor",
                )
            )
        self.assertEqual(invalid_floor.exception.status_code, 404)

        self.patches.enter_context(
            patch.object(main, "scan_wifi", return_value={"error": "Not connected"})
        )
        with self.assertRaises(HTTPException) as scan_error:
            main.create_measurement(
                main.MeasurementRequest(
                    scan_id="scan-2",
                    device_id="test-laptop",
                    x=0.5,
                    y=0.5,
                    survey_id=survey_id,
                )
            )
        self.assertEqual(scan_error.exception.status_code, 503)
        self.assertEqual(scan_error.exception.detail, "Not connected")
        self.assertEqual(storage.get_measurements(), [])

    def test_analysis_reports_missing_key_and_invalid_provider_response(self) -> None:
        survey_id, _, _ = self.create_survey()
        request = main.AnalysisRequest(survey_id=survey_id)

        with self.assertRaises(HTTPException) as no_measurements:
            main.analyze_survey(request)
        self.assertEqual(no_measurements.exception.status_code, 422)

        storage.save_measurement(
            scan_id="scan-for-analysis",
            device_id="test-laptop",
            x=0.5,
            y=0.5,
            ssid="Office Wi-Fi",
            signal=60,
            survey_id=survey_id,
        )

        with (
            patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""}),
            patch.object(main.urllib.request, "urlopen") as urlopen,
        ):
            with self.assertRaises(HTTPException) as missing_key:
                main.analyze_survey(request)
        self.assertEqual(missing_key.exception.status_code, 503)
        urlopen.assert_not_called()

        with (
            patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"}),
            patch.object(
                main.urllib.request,
                "urlopen",
                return_value=FakeClaudeResponse("not valid JSON"),
            ),
        ):
            with self.assertRaises(HTTPException) as invalid_response:
                main.analyze_survey(request)
        self.assertEqual(invalid_response.exception.status_code, 502)
        self.assertEqual(storage.get_reports(), [])

    def test_floor_plan_upload_is_saved_and_served(self) -> None:
        image_bytes = b"\x89PNG\r\n\x1a\n"
        survey = main.create_survey_endpoint(
            main.SurveyRequest(
                building_name="Floor plan test",
                floors=[
                    main.FloorRequest(
                        name="Ground",
                        floorplan=main.FloorPlanUpload(
                            filename="plan.png",
                            content_type="image/png",
                            content_base64=base64.b64encode(image_bytes).decode(),
                        ),
                    )
                ],
            )
        )
        floorplan = survey["floors"][0]["floorplan"]

        served = main.read_floorplan(floorplan["filename"])
        self.assertEqual(served.path.read_bytes(), image_bytes)


if __name__ == "__main__":
    unittest.main()
