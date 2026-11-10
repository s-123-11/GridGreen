from io import BytesIO
from urllib.parse import urlparse

import requests
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)
from reportlab.graphics.shapes import Drawing, Line, Circle, String


def create_corridor_diagram(coordinates):
    drawing = Drawing(480, 150)

    if not coordinates or len(coordinates) < 2:
        drawing.add(String(20, 70, "Corridor geometry unavailable"))
        return drawing

    lats = [point[0] for point in coordinates]
    lons = [point[1] for point in coordinates]

    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)

    lat_range = max(max_lat - min_lat, 0.000001)
    lon_range = max(max_lon - min_lon, 0.000001)

    points = []

    for lat, lon in coordinates:
        x = 30 + ((lon - min_lon) / lon_range) * 420
        y = 30 + ((lat - min_lat) / lat_range) * 90
        points.append((x, y))

    for index in range(len(points) - 1):
        x1, y1 = points[index]
        x2, y2 = points[index + 1]
        drawing.add(Line(x1, y1, x2, y2, strokeColor=colors.green, strokeWidth=3))

    start_x, start_y = points[0]
    end_x, end_y = points[-1]

    drawing.add(Circle(start_x, start_y, 5, fillColor=colors.blue))
    drawing.add(Circle(end_x, end_y, 5, fillColor=colors.red))

    drawing.add(String(start_x, max(start_y + 10, 45), "Start", fontSize=9))
    drawing.add(String(end_x, max(end_y + 10, 45), "End", fontSize=9))

    return drawing


def download_ndvi_image(image_url):
    if not image_url:
        return None

    parsed_url = urlparse(image_url)

    if parsed_url.scheme != "https" or parsed_url.hostname != "earthengine.googleapis.com":
        return None

    try:
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()

        if not response.headers.get("Content-Type", "").startswith("image/"):
            return None

        return BytesIO(response.content)

    except requests.RequestException:
        return None


def generate_pdf_report(data):
    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        textColor=colors.HexColor("#176B3A"),
        fontSize=20,
        spaceAfter=12,
    )

    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#176B3A"),
        spaceBefore=12,
        spaceAfter=7,
    )

    story = []

    vegetation = data.get("vegetation") or {}
    comparison = data.get("comparison") or {}
    selected_line = data.get("selected_line_name", "Selected power line")

    story.append(Paragraph("GRIDGREEN", title_style))
    story.append(
        Paragraph("Vegetation Encroachment Monitoring Report", styles["Heading2"])
    )
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. Project Details", heading_style))

    project_data = [
        ["Parameter", "Details"],
        ["Power line", str(selected_line)],
        ["Start location", str(data.get("start_place", "Not provided"))],
        ["End location", str(data.get("end_place", "Not provided"))],
        ["Satellite", str(vegetation.get("satellite", "Not available"))],
        ["Latest image date", str(vegetation.get("latest_image_date", "Not available"))],
        ["Image count", str(vegetation.get("image_count", "Not available"))],
        ["Resolution", f"{vegetation.get('resolution_meters', 'N/A')} metres"],
        ["Corridor buffer", f"{vegetation.get('buffer_meters', 'N/A')} metres"],
        ["NDVI threshold", str(vegetation.get("ndvi_threshold", "N/A"))],
    ]

    table = Table(project_data, colWidths=[55 * mm, 105 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#176B3A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    story.append(table)

    story.append(Paragraph("2. Corridor Geometry", heading_style))
    story.append(
        Paragraph(
            "The following diagram represents the selected power-line geometry. "
            "It is a schematic and is not a geographic basemap.",
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 8))
    story.append(create_corridor_diagram(data.get("coordinates", [])))

    story.append(Paragraph("3. Vegetation Analysis", heading_style))

    analysis_data = [
        ["Measurement", "Result"],
        ["Vegetation coverage", f"{vegetation.get('vegetation_coverage_percent', 'N/A')}%"],
        ["Mean NDVI", str(vegetation.get("mean_ndvi", "N/A"))],
    ]

    analysis_table = Table(analysis_data, colWidths=[80 * mm, 80 * mm])
    analysis_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#176B3A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))

    story.append(analysis_table)
    coverage = float(vegetation.get("vegetation_coverage_percent", 0))

    if coverage > 55:
        risk_priority = "HIGH"
    elif coverage > 35:
        risk_priority = "MEDIUM"
    else:
        risk_priority = "LOW"

    story.append(Paragraph("4. Risk Monitoring", heading_style))

    risk_data = [
        ["Risk Parameter", "Result"],
        ["Vegetation coverage", f"{coverage}%"],
        ["Inspection priority", risk_priority],
    ]

    risk_table = Table(risk_data, colWidths=[80 * mm, 80 * mm])

    risk_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#176B3A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))

    story.append(risk_table)

    image_data = download_ndvi_image(
        vegetation.get("ndvi_visualization_url")
    )

    if image_data:
        story.append(Paragraph("5. NDVI Visualization", heading_style))

        image_reader = ImageReader(image_data)
        image_width, image_height = image_reader.getSize()

        display_width = 160 * mm
        display_height = display_width * image_height / image_width

        story.append(
            Image(
                image_data,
                width=display_width,
                height=display_height,
            )
        )
    else:
        story.append(
            Paragraph(
                "NDVI visualization could not be retrieved when this report was generated.",
                styles["BodyText"],
            )
        )

    if comparison:
        story.append(Paragraph("6. Historical Comparison", heading_style))

        previous = comparison.get("previous", {})
        current = comparison.get("current", {})

        comparison_data = [
            ["Measurement", "Previous period", "Current period"],
            [
                "Vegetation coverage",
                f"{previous.get('vegetation_coverage_percent', 'N/A')}%",
                f"{current.get('vegetation_coverage_percent', 'N/A')}%",
            ],
            [
                "Mean NDVI",
                str(previous.get("mean_ndvi", "N/A")),
                str(current.get("mean_ndvi", "N/A")),
            ],
        ]

        comparison_table = Table(
            comparison_data,
            colWidths=[60 * mm, 50 * mm, 50 * mm],
        )

        comparison_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#176B3A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 7),
        ]))

        story.append(comparison_table)

    story.append(Paragraph("Important Notes", heading_style))
    story.append(
        Paragraph(
            "Vegetation coverage is estimated from Sentinel-2 NDVI pixels "
            "within the selected corridor buffer. The 10-metre satellite "
            "resolution does not identify individual branches or measure "
            "tree-to-conductor clearance. Risk priorities are project-level "
            "screening indicators, not official electrical safety assessments. "
            "On-site inspection is required for safety decisions.",
            styles["BodyText"],
        )
    )

    document.build(story)
    output.seek(0)

    return output