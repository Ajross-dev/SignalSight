SignalSight 📡

A collaborative Wi-Fi coverage analysis platform that makes invisible wireless dead zones visible on an interactive floor plan — powered by AI.

Built at the Ohio State University Hackathon in under 24 hours.

What It Does

Most buildings have Wi-Fi dead zones. You've felt it — your video call drops, your file won't upload. But nobody actually knows where those dead zones are.

SignalSight fixes that.

How It Works
Upload a floor plan image of any building
Walk around and click your location to record live Wi-Fi signal readings
Watch a real-time heatmap build as strong and weak zones appear
Enter your network equipment and budget
Generate an AI-powered report with router placement recommendations

No specialized hardware. No expensive software. Just a Windows laptop connected to Wi-Fi.

Demo

We mapped the Ohio Union at Ohio State University in real time across 3 floors using 3 laptops simultaneously. Every measurement on the map is a real Wi-Fi reading from the actual building.

Features
🗺️ Interactive floor plan — upload any image and click to record measurements
🌡️ Live heatmap — color coded signal strength overlay (red = weak, green = strong)
📡 Real Wi-Fi scanning — reads live signal data from Windows via netsh
🤖 AI analysis — Claude generates a professional network report with coverage score, dead zones, router placement recommendations, and equipment suggestions within your budget
💾 Report saving — all generated reports are saved and downloadable
👥 Multi-device — multiple laptops can contribute to the same heatmap simultaneously
Tech Stack
Frontend — React + TypeScript + Vite
Backend — Python + FastAPI
Wi-Fi Scanner — Windows netsh via Python subprocess
AI — Anthropic Claude API (claude-sonnet-4-6)
Storage — JSON files
How To Run Locally (Windows)

Requirements

Windows (Wi-Fi scanning uses netsh)
Python 3.10+
Node.js 18+
An Anthropic API key — get one here

1. Clone the repo

bash
git clone https://github.com/Ajross-dev/SignalSight.git
cd SignalSight

2. Set up the backend

bash
cd backend
py -m pip install -r requirements.txt

Create a .env file in the backend folder:

ANTHROPIC_API_KEY=your-api-key-here

Start the backend:

bash
py -m uvicorn main:app --host 127.0.0.1 --port 8000

3. Set up the frontend

Open a second terminal:

bash
cd frontend
npm install
npm run dev

4. Open the app

Go to http://localhost:5173 in your browser.

API Endpoints
GET /api/wifi — get current live Wi-Fi signal
POST /api/measurements — record a new measurement at (x, y)
GET /api/measurements — get all saved measurements
DELETE /api/measurements — clear measurements
POST /api/surveys — create a new building survey
GET /api/surveys — list all surveys
POST /api/analyze — generate AI network analysis report
GET /api/reports — list all saved reports
GET /api/reports/{id}/download — download report as JSON
How The Wi-Fi Scanner Works

Our scanner.py runs the Windows netsh wlan show interfaces command via Python's subprocess library, parses the output line by line, and extracts the SSID and signal strength.

python
# What scanner.py returns
{"ssid": "WiFi@OSU", "signal": 84}
How The AI Analysis Works

After collecting measurements, users enter their network equipment and budget. The backend sends everything to Claude via the Anthropic API and gets back a structured report:

json
{
  "coverage_score": 72,
  "summary": "Strong coverage near entrance, dead zones in east wing...",
  "dead_zones": [{"x": 0.8, "y": 0.9, "signal": 23, "severity": "critical"}],
  "router_recommendations": [{"x": 0.75, "y": 0.7, "reason": "Addresses critical dead zone"}],
  "equipment_recommendations": "TP-Link EAP670 Wi-Fi 6 (~$120) within your $500 budget"
}
Team

Built at the Ohio State University Hackathon by:

Roba Abdeta — Backend (scanner.py, analysis.py) | Kent State University CS '28
[Teammate 2 Name] — Backend (storage.py, main.py)
[Teammate 3 Name] — Frontend (React, heatmap, UI)
Future Ideas
Mac and Linux support
Multi-building campus dashboard
Automatic router placement markers on the heatmap
PDF report export
Live WebSocket updates
