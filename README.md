# GridGreen – Vegetation Monitoring System

## Project Overview
GridGreen is a satellite-based vegetation monitoring system designed to identify and monitor vegetation encroachment along electrical power line corridors.

## Key Features
- Satellite imagery using Sentinel-2.
- Vegetation detection using NDVI.
- Automatic vegetation coverage measurement.
- Power line corridor mapping.
- Historical vegetation comparison.
- Vegetation risk monitoring.
- Interactive dashboard and reporting.

## Technologies Used
- Python
- FastAPI
- React.js
- Google Earth Engine
- Sentinel-2 Satellite Imagery
- NDVI
- PostgreSQL / PostGIS
- Leaflet Maps

## Project Structure
- backend – Python API and satellite image processing.
- frontend – React dashboard and mapping interface.

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Project Purpose
To improve vegetation monitoring along power line corridors through satellite imagery, automated analysis, and risk assessment.
