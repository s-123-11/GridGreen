
import ee
from datetime import datetime, timezone


COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"


def create_corridor(coordinates, buffer_m=30):
    if not coordinates or len(coordinates) < 2:
        raise ValueError("At least two power-line coordinates are required.")

    # React coordinates are [latitude, longitude].
    # Earth Engine expects [longitude, latitude].
    ee_coordinates = [
        [point[1], point[0]]
        for point in coordinates
    ]

    line = ee.Geometry.LineString(ee_coordinates)

    return line.buffer(buffer_m)


def mask_clouds(image):
    scl = image.select("SCL")

    clear_pixels = (
        scl.neq(1)
        .And(scl.neq(3))
        .And(scl.neq(8))
        .And(scl.neq(9))
        .And(scl.neq(10))
        .And(scl.neq(11))
    )

    return image.updateMask(clear_pixels)


def analyze_vegetation(
    coordinates,
    start_date,
    end_date,
    buffer_m=30,
    ndvi_threshold=0.40
):
    corridor = create_corridor(coordinates, buffer_m)

    collection = (
        ee.ImageCollection(COLLECTION)
        .filterBounds(corridor)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 80))
        .map(mask_clouds)
    )

    image_count = collection.size().getInfo()

    if image_count == 0:
        raise ValueError(
            "No suitable Sentinel-2 images found for this date range. "
            "Try a wider date range."
        )

    latest_timestamp = (
        collection.aggregate_max("system:time_start").getInfo()
    )

    latest_date = datetime.fromtimestamp(
        latest_timestamp / 1000,
        tz=timezone.utc
    ).strftime("%Y-%m-%d")

    composite = collection.median().clip(corridor)

    nir = composite.select("B8")
    red = composite.select("B4")

    ndvi = (
        nir.subtract(red)
        .divide(nir.add(red))
        .rename("NDVI")
    )

    vegetation = (
        ndvi.gte(ndvi_threshold)
        .rename("vegetation")
    )

    
    ndvi_visualization = ndvi.visualize(
        min=-0.2,
        max=0.8,
        palette=[
            "8c510a",
            "d8b365",
            "f6e8c3",
            "c7eae5",
            "5ab4ac",
            "01665e"
        ]
    )

    ndvi_image_url = ndvi_visualization.getThumbURL({
        "region": corridor,
        "dimensions": 1200,
        "format": "png"
    })


    mean_ndvi = ndvi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=corridor,
        scale=10,
        maxPixels=1e9,
        bestEffort=True
    ).get("NDVI").getInfo()

    vegetation_percentage = vegetation.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=corridor,
        scale=10,
        maxPixels=1e9,
        bestEffort=True
    ).get("vegetation").getInfo()

    if mean_ndvi is None or vegetation_percentage is None:
        raise ValueError(
            "No valid cloud-free pixels were available in this corridor."
        )

    return {
        "latest_image_date": latest_date,
        "image_count": image_count,
        "mean_ndvi": round(mean_ndvi, 4),
        "vegetation_coverage_percent": round(
            vegetation_percentage * 100, 2
        ),
        "ndvi_threshold": ndvi_threshold,
        "buffer_meters": buffer_m,
        "satellite": "Sentinel-2",
        "resolution_meters": 10,
        "ndvi_visualization_url": ndvi_image_url
    }
