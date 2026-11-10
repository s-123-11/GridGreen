
import os
from fastapi.responses import StreamingResponse
from reports import generate_pdf_report

import ee
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

PROJECT_ID = os.getenv("EE_PROJECT_ID")

if not PROJECT_ID:
    raise ValueError("EE_PROJECT_ID is missing from the .env file")

try:
    ee.Initialize(project=PROJECT_ID)
    print("Google Earth Engine initialized successfully")
except Exception as error:
    print("Earth Engine initialization failed:", error)
    raise

from pydantic import BaseModel
from vegetation import analyze_vegetation

app = FastAPI(title="GridGreen Vegetation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "GridGreen API is running",
        "earth_engine": "Connected"
    }


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "earth_engine": "connected",
        "project": PROJECT_ID
    }


class VegetationRequest(BaseModel):
    coordinates: list[list[float]]
    start_date: str
    end_date: str
    buffer_m: float = 30
    ndvi_threshold: float = 0.40

class ReportRequest(BaseModel):
    selected_line_name: str = "Selected power line"
    coordinates: list[list[float]]
    start_place: str = "Not provided"
    end_place: str = "Not provided"
    vegetation: dict
    comparison: dict | None = None


@app.post("/api/vegetation/analyze")
def vegetation_analysis(request: VegetationRequest):
    try:
        return analyze_vegetation(
            coordinates=request.coordinates,
            start_date=request.start_date,
            end_date=request.end_date,
            buffer_m=request.buffer_m,
            ndvi_threshold=request.ndvi_threshold
        )
    except Exception as error:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.post("/api/vegetation/latest")
def latest_vegetation(request: VegetationRequest):
    try:
        from datetime import date, timedelta

        today = date.today()
        start = today - timedelta(days=60)

        return analyze_vegetation(
            coordinates=request.coordinates,
            start_date=start.isoformat(),
            end_date=today.isoformat(),
            buffer_m=request.buffer_m,
            ndvi_threshold=request.ndvi_threshold
        )
    except Exception as error:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

@app.post("/api/reports/pdf")
def create_pdf_report(request: ReportRequest):
    report_data = request.model_dump()

    pdf_file = generate_pdf_report(report_data)

    return StreamingResponse(
        pdf_file,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="GridGreen_Report.pdf"'
        },
    )