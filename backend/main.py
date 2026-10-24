from fastapi import FastAPI, HTTPException # HTTP gives proper error responses instead of just crashing
from fastapi.middleware.cors import CORSMiddleware # Allow React fontend to talk to backend
from scanner import scan_wifi
from storage import get_measurements, save_measurement, clear_measurements


app = FastAPI()

app.add_middleware(   # Allow requests coming from the React frontend
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # React frontend address
    allow_methods=["*"],  # Allow GET, POST, DELETE
    allow_headers=["*"],  # Allow all headers
)

@app.get("/api/wifi")
def get_wifi():
    # Calls the scanner to get live wifi data
    result = scan_wifi()

    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
# If scanner returns error, sends back a 503 error to the frontend
    return result

@app.get("/api/measurements")
def get_all_measurements():

    measurements = get_measurements() # call storage to get saved measurements

    return measurements