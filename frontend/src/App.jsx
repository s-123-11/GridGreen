
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Map as MapIcon, Activity, FileText, Settings,
  Search, Bell, Menu, Leaf, Zap, AlertTriangle,
  TrendingUp, TreePine, ChevronDown, Download,
  CalendarDays, Layers, ShieldCheck, ArrowUpRight
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

const spans = [
  { id: "SP-001", vegetation: 18, distance: 22, risk: "Low", change: "+2%" },
  { id: "SP-002", vegetation: 42, distance: 12, risk: "Medium", change: "+8%" },
  { id: "SP-003", vegetation: 68, distance: 6, risk: "High", change: "+15%" },
  { id: "SP-004", vegetation: 31, distance: 17, risk: "Low", change: "+3%" },
  { id: "SP-005", vegetation: 74, distance: 5, risk: "High", change: "+19%" },
];

const route = [
  [13.115, 77.535],
  [13.122, 77.548],
  [13.130, 77.560],
  [13.139, 77.573],
  [13.148, 77.586],
  [13.157, 77.599],
];

function FitSelectedLocations({ startCoords, endCoords }) {
  const map = useMap();

  useEffect(() => {
    if (startCoords && endCoords) {
      const bounds = [
        [startCoords.lat, startCoords.lon],
        [endCoords.lat, endCoords.lon]
      ];

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 14
      });
    } else if (startCoords) {
      map.setView(
        [startCoords.lat, startCoords.lon],
        13
      );
    } else if (endCoords) {
      map.setView(
        [endCoords.lat, endCoords.lon],
        13
      );
    }
  }, [map, startCoords, endCoords]);

  return null;
}
function createCorridorSections(coordinates, sectionLength = 250) {
  if (!coordinates || coordinates.length < 2) {
    return [];
  }

  const R = 6371000;

  const toRadians = (value) => value * Math.PI / 180;

  const getDistance = (a, b) => {
    const lat1 = toRadians(a[0]);
    const lat2 = toRadians(b[0]);
    const dLat = toRadians(b[0] - a[0]);
    const dLon = toRadians(b[1] - a[1]);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const interpolate = (a, b, fraction) => [
    a[0] + (b[0] - a[0]) * fraction,
    a[1] + (b[1] - a[1]) * fraction
  ];

  const sections = [];
  let sectionStart = coordinates[0];
  let remaining = sectionLength;

  for (let i = 0; i < coordinates.length - 1; i++) {
    let current = coordinates[i];
    const end = coordinates[i + 1];

    let distanceLeft = getDistance(current, end);

    while (distanceLeft > 0) {
      if (distanceLeft >= remaining) {
        const fraction = remaining / distanceLeft;
        const sectionEnd = interpolate(current, end, fraction);

        sections.push({
          id: `SP-${String(sections.length + 1).padStart(3, "0")}`,
          start: sectionStart,
          end: sectionEnd,
          length: sectionLength
        });

        current = sectionEnd;
        sectionStart = sectionEnd;
        distanceLeft = getDistance(current, end);
        remaining = sectionLength;
      } else {
        remaining -= distanceLeft;
        distanceLeft = 0;
      }
    }
  }

  if (remaining < sectionLength) {
    sections.push({
      id: `SP-${String(sections.length + 1).padStart(3, "0")}`,
      start: sectionStart,
      end: coordinates[coordinates.length - 1],
      length: sectionLength - remaining
    });
  }

  return sections;
}

function App() {
  
  const [startPlace, setStartPlace] = useState("Rajanakunte");
  const [endPlace, setEndPlace] = useState("Yelahanka");

  
const [startSuggestions, setStartSuggestions] = useState([]);
const [endSuggestions, setEndSuggestions] = useState([]);

const [searchingStart, setSearchingStart] = useState(false);
const [searchingEnd, setSearchingEnd] = useState(false);

  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);

  const [powerLines, setPowerLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const corridorSections = selectedLine
  ? createCorridorSections(selectedLine.coordinates, 250)
  : [];

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  
  // Start location autocomplete
  useEffect(() => {
    if (
  startPlace.trim().length < 3 ||
  startCoords?.name === startPlace.trim()
) {
  setStartSuggestions([]);
  return;
}
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setSearchingStart(true);

        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(startPlace)}&limit=5`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error("Location search failed");

        const data = await response.json();

        const uniquePlaces = Array.from(
          new Map(
            (data.features || []).map((place) => [
              `${place.properties.name}-${place.geometry.coordinates.join(",")}`,
              place,
            ])
          ).values()
        );

        setStartSuggestions(uniquePlaces);
        console.log("START SUGGESTIONS:", uniquePlaces);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Start search failed:", error);
        }
      } finally {
        setSearchingStart(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [startPlace]);

  // End location autocomplete
  useEffect(() => {
    if (
  endPlace.trim().length < 3 ||
  endCoords?.name === endPlace.trim()
) {
  setEndSuggestions([]);
  return;
}

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setSearchingEnd(true);

        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(endPlace)}&limit=5`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error("Location search failed");

        const data = await response.json();

        const uniquePlaces = Array.from(
          new Map(
            (data.features || []).map((place) => [
              `${place.properties.name}-${place.geometry.coordinates.join(",")}`,
              place,
            ])
          ).values()
        );

        setEndSuggestions(uniquePlaces);
        console.log("END SUGGESTIONS:", uniquePlaces);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("End search failed:", error);
        }
      } finally {
        setSearchingEnd(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endPlace]);


  // Convert a place name into geographic coordinates
  async function geocodePlace(place) {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Location search service is unavailable.");
    }

    const results = await response.json();

    if (!results.length) {
      throw new Error(`Location not found: ${place}`);
    }

    return {
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
      name: results[0].display_name
    };
  }

  // Search power-line geometries inside the bounding area
  async function fetchPowerLines(start, end) {
    const padding = 0.03;

    const south = Math.min(start.lat, end.lat) - padding;
    const north = Math.max(start.lat, end.lat) + padding;
    const west = Math.min(start.lon, end.lon) - padding;
    const east = Math.max(start.lon, end.lon) + padding;

    // Avoid sending excessively large queries to the public service
    if ((north - south) * (east - west) > 0.25) {
      throw new Error(
        "The selected locations are too far apart for one Overpass search. Please select a smaller area."
      );
    }

    const query = `
      [out:json][timeout:30];
      (
        way["power"="line"](${south},${west},${north},${east});
        way["power"="minor_line"](${south},${west},${north},${east});
      );
      out geom;
    `;

    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: "data=" + encodeURIComponent(query)
      }
    );

    if (!response.ok) {
      throw new Error(
        "Power-line service is busy or unavailable. Please try again later."
      );
    }

    const data = await response.json();

    return data.elements
      .filter(
        (element) =>
          element.type === "way" &&
          element.geometry &&
          element.geometry.length >= 2
      )
      .map((element) => ({
        id: element.id,
        tags: element.tags || {},
        coordinates: element.geometry.map((point) => [
          point.lat,
          point.lon
        ]),
        name:
          element.tags?.name ||
          element.tags?.ref ||
          `Power line ${element.id}`,
        voltage: element.tags?.voltage || "Not specified",
        powerType: element.tags?.power || "line"
      }));
  }

  // Main location and power-line search
  async function searchCorridor() {
    setSearching(true);
    setSearchError("");
    setSearchMessage("");
    setPowerLines([]);
    setSelectedLine(null);

    try {
      if (!startPlace.trim() || !endPlace.trim()) {
        throw new Error("Please enter both starting and ending locations.");
      }

      const start = await geocodePlace(startPlace);
      const end = await geocodePlace(endPlace);

      setStartCoords(start);
      setEndCoords(end);

      const lines = await fetchPowerLines(start, end);

      setPowerLines(lines);

      if (lines.length === 0) {
        setSearchMessage(
          "No mapped power lines found in this search area. Try a larger search area or another location."
        );
      } else {
        setSearchMessage(
          `${lines.length} mapped power-line segment(s) found. Select a line on the map or from the list.`
        );
      }
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setSearching(false);
    }
  }

  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("All");

  const filteredSpans = filter === "All"
    ? spans
    : spans.filter((span) => span.risk === filter);

  const navigation = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Corridor Map", icon: MapIcon },
    { name: "Vegetation Analysis", icon: Leaf },
    { name: "Risk Monitoring", icon: Activity },
    { name: "Reports", icon: FileText },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div className="app">

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Leaf size={23} /></div>
          <div>
            <h2>GridGreen</h2>
            <span>VEGETATION INTELLIGENCE</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className={`nav-item ${active === item.name ? "active" : ""}`}
                onClick={() => {
                  setActive(item.name);
                  setMenuOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot"></span>
            System operational
          </div>
          <div className="user-profile">
            <div className="avatar">GG</div>
            <div>
              <strong>GridGreen Admin</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">

        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> {active}
          </div>

          <div className="top-actions">
            <span className="live-status">
              <span className="status-dot"></span> DEMO MODE
            </span>
            <button className="icon-button"><Bell size={19} /></button>
            <div className="top-avatar">GG</div>
          </div>
        </header>

        <div className="content">

          <section className="page-heading">
            <div>
              <div className="eyebrow">POWER LINE VEGETATION MONITORING</div>
              <h1>{active === "Overview" ? "Dashboard Overview" : active}</h1>
              <p>Monitor vegetation growth and inspection priorities along power line corridors.</p>
            </div>

            <button className="date-button">
              <CalendarDays size={17} />
              Demo analysis
              <ChevronDown size={16} />
            </button>
          </section>
          
           
<section className="panel location-panel">
  <div className="panel-heading">
    <div>
      <h3>Find Electricity Transmission Lines</h3>
      <p>Choose your starting and ending locations</p>
    </div>
    <Zap size={22} className="green-icon" />
  </div>

  <div className="location-form">
    
<div className="location-field">
  <label>START LOCATION</label>

  <input
    value={startPlace}
    onChange={(e) => {
      setStartPlace(e.target.value);
      setStartCoords(null);
    }}
    placeholder="Enter starting location"
    autoComplete="off"
  />

  {searchingStart && <p>Searching locations...</p>}

  {startSuggestions.length > 0 && (
    <div className="suggestion-list">
      {startSuggestions.map((place, index) => (
        <div
          className="suggestion-item"
          key={index}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const p = place.properties;

            const name = p.name || "";
            const area =
              p.city || p.district || p.locality || "";
            const state = p.state || "";

            setStartPlace(
              [name, area, state].filter(Boolean).join(", ")
            );

            setStartCoords({
              lat: place.geometry.coordinates[1],
              lon: place.geometry.coordinates[0],
              name: name,
            });

            setStartSuggestions([]);
          }}
        >
          {[
            place.properties.name,
            place.properties.city ||
              place.properties.district ||
              place.properties.locality,
            place.properties.state,
          ].filter(Boolean).join(", ")}
        </div>
      ))}
    </div>
  )}
</div>


    
<div className="location-field">
  <label>END LOCATION</label>

  <input
    value={endPlace}
    onChange={(e) => {
      setEndPlace(e.target.value);
      setEndCoords(null);
    }}
    placeholder="Enter ending location"
    autoComplete="off"
  />

  {searchingEnd && <p>Searching locations...</p>}

  {endSuggestions.length > 0 && (
    <div className="suggestion-list">
      {endSuggestions.map((place, index) => (
        <div
          className="suggestion-item"
          key={index}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const p = place.properties;

            const name = p.name || "";
            const area =
              p.city || p.district || p.locality || "";
            const state = p.state || "";

            setEndPlace(
              [name, area, state].filter(Boolean).join(", ")
            );

            setEndCoords({
              lat: place.geometry.coordinates[1],
              lon: place.geometry.coordinates[0],
              name: name,
            });

            setEndSuggestions([]);
          }}
        >
          {[
            place.properties.name,
            place.properties.city ||
              place.properties.district ||
              place.properties.locality,
            place.properties.state,
          ].filter(Boolean).join(", ")}
        </div>
      ))}
    </div>
  )}
</div>


    <button
      className="search-power-button"
      onClick={searchCorridor}
      disabled={searching}
    >
      <Search size={17} />
      {searching ? "Searching..." : "Find Power Lines"}
    </button>
  </div>

  {startCoords && endCoords && (
    <div className="coordinate-info">
      <span>Start: {startCoords.lat.toFixed(5)}, {startCoords.lon.toFixed(5)}</span>
      <span>End: {endCoords.lat.toFixed(5)}, {endCoords.lon.toFixed(5)}</span>
    </div>
  )}

  {searchError && (
    <div className="search-error">{searchError}</div>
  )}

  {searchMessage && (
    <div className="search-success">{searchMessage}</div>
  )}

  {powerLines.length > 0 && (
    <div className="power-line-results">
      <strong>Available mapped power lines</strong>

      {powerLines.map((line) => (
        <button
          key={line.id}
          className={`power-line-option ${
            selectedLine?.id === line.id ? "selected" : ""
          }`}
          onClick={() => setSelectedLine(line)}
        >
          <span>
            <Zap size={15} />
            {line.name}
          </span>
          <small>
            {line.powerType} · {line.voltage}
          </small>
        </button>
      ))}
    </div>
  )}

  {selectedLine && (
    <div className="selected-line-info">
      <ShieldCheck size={17} />
      Selected: {selectedLine.name} · OSM ID: {selectedLine.id}
    </div>
  )}
</section>
{active === "Overview" && (
  <>
          <div className="demo-notice">
            <AlertTriangle size={17} />
            <span>
              Demonstration data only. Vegetation values and risk levels are simulated,
              not real satellite measurements.
            </span>
          </div>

          <section className="stats-grid">
            <StatCard
              icon={<MapIcon/>}
              title="Monitored corridor"
              value="5.0 km"
              note="Sample route length"
              color="green"
            />
            <StatCard
              icon={<TreePine />}
              title="Vegetation coverage"
              value="46.6%"
              note="Simulated coverage"
              color="blue"
            />
            <StatCard
              icon={<AlertTriangle />}
              title="High-risk spans"
              value="2"
              note="Require inspection review"
              color="orange"
            />
            <StatCard
              icon={<Activity />}
              title="Total spans"
              value="5"
              note="250 m target span length"
              color="purple"
            />
          </section>

          <section className="main-grid">

            <div className="panel map-panel">
              <div className="panel-heading">
                <div>
                  <h3>Corridor Monitoring Map</h3>
                  <p>Sample transmission corridor · Bengaluru region</p>
                </div>
                <button className="small-button"><Layers size={15} /> Layers</button>
              </div>

              <div className="map-container">
                <MapContainer
                  center={[13.137, 77.567]}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="leaflet-map"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  
{startCoords && (
  <CircleMarker
    center={[startCoords.lat, startCoords.lon]}
    radius={8}
    pathOptions={{
      color: "#ffffff",
      fillColor: "#16a34a",
      fillOpacity: 1,
      weight: 2
    }}
  >
    <Popup>Start: {startPlace}</Popup>
  </CircleMarker>
)}

{endCoords && (
  <CircleMarker
    center={[endCoords.lat, endCoords.lon]}
    radius={8}
    pathOptions={{
      color: "#ffffff",
      fillColor: "#2563eb",
      fillOpacity: 1,
      weight: 2
    }}
  >
    <Popup>End: {endPlace}</Popup>
  </CircleMarker>
)}

{powerLines.map((line) => (
  <Polyline
    key={line.id}
    positions={line.coordinates}
    eventHandlers={{
      click: () => setSelectedLine(line)
    }}
    pathOptions={{
      color:
        selectedLine?.id === line.id
          ? "#16a34a"
          : "#e69b35",
      weight:
        selectedLine?.id === line.id
          ? 7
          : 4,
      opacity: 0.9
    }}
  >
    <Popup>
      <strong>{line.name}</strong>
      <br />
      Power type: {line.powerType}
      <br />
      Voltage: {line.voltage}
      <br />
      OSM ID: {line.id}
      <br />
      <button onClick={() => setSelectedLine(line)}>
        Select this power line
      </button>
    </Popup>
  </Polyline>
))}

                  
<Polyline
  positions={
    startCoords && endCoords
      ? [
          [startCoords.lat, startCoords.lon],
          [endCoords.lat, endCoords.lon]
        ]
      : route
  }
  pathOptions={{
    color: "#16a34a",
    weight: 6,
    opacity: 0.9
  }}
/>


                  {spans.map((span, index) => {
                    const riskColor = span.risk === "High"
                      ? "#ef4444"
                      : span.risk === "Medium"
                      ? "#eab308"
                      : "#16a34a";

                    return (
                      <CircleMarker
                        key={span.id}
                        center={
  startCoords && endCoords
    ? [
        startCoords.lat +
          ((endCoords.lat - startCoords.lat) * (index + 1)) / spans.length,
        startCoords.lon +
          ((endCoords.lon - startCoords.lon) * (index + 1)) / spans.length
      ]
    : route[index + 1]
}
                        radius={9}
                        pathOptions={{
                          color: "#ffffff",
                          weight: 2,
                          fillColor: riskColor,
                          fillOpacity: 1
                        }}
                      >
                        <Popup>
                          <strong>{span.id}</strong><br />
                          Risk: {span.risk}<br />
                          Vegetation: {span.vegetation}%
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>

                <div className="map-legend">
                  <strong>Risk levels</strong>
                  <span><i className="dot green"></i> Low</span>
                  <span><i className="dot yellow"></i> Medium</span>
                  <span><i className="dot red"></i> High</span>
                </div>
              </div>
            </div>

            <div className="panel summary-panel">
              <div className="panel-heading">
                <div>
                  <h3>Risk Summary</h3>
                  <p>Distribution across sample spans</p>
                </div>
                <ShieldCheck size={21} className="green-icon" />
              </div>

              <div className="risk-total">
                <strong>5</strong>
                <span>Total monitored spans</span>
              </div>

              <RiskBar label="High risk" value={40} count={2} color="red" />
              <RiskBar label="Medium risk" value={20} count={1} color="yellow" />
              <RiskBar label="Low risk" value={40} count={2} color="green" />

              <div className="summary-note">
                <AlertTriangle size={17} />
                <span>2 sample spans are marked for inspection priority.</span>
              </div>
            </div>

          </section>
            <section className="panel table-panel">
  <div className="panel-heading">
    <div>
      <h3>Generated Corridor Sections</h3>
      <p>
        {selectedLine
          ? `Selected power line: ${selectedLine.name}`
          : "Select a power line to generate 250-metre sections"}
      </p>
    </div>

    <span className="risk-badge low">
      {corridorSections.length} Sections
    </span>
  </div>

  {corridorSections.length > 0 ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>SECTION ID</th>
            <th>LENGTH</th>
            <th>START COORDINATES</th>
            <th>END COORDINATES</th>
          </tr>
        </thead>

        <tbody>
          {corridorSections.map((section) => (
            <tr key={section.id}>
              <td><strong>{section.id}</strong></td>
              <td>{section.length.toFixed(1)} m</td>
              <td>
                {section.start[0].toFixed(5)},
                {section.start[1].toFixed(5)}
              </td>
              <td>
                {section.end[0].toFixed(5)},
                {section.end[1].toFixed(5)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>
      Search for power lines and select one to generate corridor sections.
    </p>
  )}
</section>
          <section className="panel table-panel">
            <div className="panel-heading table-heading">
              <div>
                <h3>Corridor Span Analysis</h3>
                <p>Vegetation statistics for individual sample spans</p>
              </div>

              <div className="table-actions">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="All">All risks</option>
                  <option value="High">High risk</option>
                  <option value="Medium">Medium risk</option>
                  <option value="Low">Low risk</option>
                </select>
                <button className="small-button">
                  <Download size={15} /> Export
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SPAN ID</th>
                    <th>VEGETATION COVER</th>
                    <th>ESTIMATED DISTANCE</th>
                    <th>GROWTH CHANGE</th>
                    <th>RISK LEVEL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpans.map((span) => (
                    <tr key={span.id}>
                      <td><strong>{span.id}</strong></td>
                      <td>
                        <div className="cover-cell">
                          <span>{span.vegetation}%</span>
                          <div className="mini-bar">
                            <div style={{ width: `${span.vegetation}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td>{span.distance} m</td>
                      <td className="growth">
                        <TrendingUp size={15} /> {span.change}
                      </td>
                      <td><span className={`risk-badge ${span.risk.toLowerCase()}`}>
                        {span.risk}
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
            </>
)}
{active !== "Overview" && (
  <SectionPage
  active={active}
  selectedLine={selectedLine}
  startCoords={startCoords}
  endCoords={endCoords}
  startPlace={startPlace}
  endPlace={endPlace}
  powerLines={powerLines}
  setSelectedLine={setSelectedLine}
/>
)}

          <footer>
            <span>GridGreen © 2026</span>
            <span>Computer Vision · Satellite Vegetation Monitoring</span>
          </footer>

        </div>
      </main>
    </div>
  );
}

function SectionPage({
  active,
  selectedLine,
  startCoords,
  endCoords,
  startPlace,
  endPlace,
  powerLines,
  setSelectedLine
}) {
    const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");

  const [vegetationResult, setVegetationResult] = useState(null);
const [comparisonResult, setComparisonResult] = useState(null);

const [analysisLoading, setAnalysisLoading] = useState(false);
const [analysisError, setAnalysisError] = useState("");

const [analysisStartDate, setAnalysisStartDate] = useState("2026-09-01");
const [analysisEndDate, setAnalysisEndDate] = useState("2026-11-05");

const [previousStartDate, setPreviousStartDate] = useState("2026-06-01");
const [previousEndDate, setPreviousEndDate] = useState("2026-08-31");

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);

  const [startCoordinates, setStartCoordinates] = useState(null);
  const [endCoordinates, setEndCoordinates] = useState(null);

  const [searchingStart, setSearchingStart] = useState(false);
  const [searchingEnd, setSearchingEnd] = useState(false);

  const [reportLoading, setReportLoading] = useState(false);
const [reportError, setReportError] = useState("");

  
const displayRoute =
  startCoords && endCoords
    ? Array.from({ length: spans.length + 1 }, (_, index) => {
        const fraction = index / spans.length;

        return [
          startCoords.lat +
            (endCoords.lat - startCoords.lat) * fraction,

          startCoords.lon +
            (endCoords.lon - startCoords.lon) * fraction
        ];
      })
    : route;
    
async function runLatestAnalysis() {
  if (!selectedLine) {
    setAnalysisError("Please select a power line first.");
    return;
  }

  setAnalysisLoading(true);
  setAnalysisError("");
  setVegetationResult(null);

  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/vegetation/latest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: selectedLine.coordinates,
          start_date: analysisStartDate,
          end_date: analysisEndDate,
          buffer_m: 30,
          ndvi_threshold: 0.40
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Satellite analysis failed.");
    }

    setVegetationResult(data);
  } catch (error) {
    setAnalysisError(error.message);
  } finally {
    setAnalysisLoading(false);
  }
}


async function runHistoricalComparison() {
  if (!selectedLine) {
    setAnalysisError("Please select a power line first.");
    return;
  }

  setAnalysisLoading(true);
  setAnalysisError("");
  setComparisonResult(null);

  try {
    const analyzePeriod = async (startDate, endDate) => {
      const response = await fetch(
        "http://127.0.0.1:8000/api/vegetation/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: selectedLine.coordinates,
            start_date: startDate,
            end_date: endDate,
            buffer_m: 30,
            ndvi_threshold: 0.40
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Historical analysis failed.");
      }

      return data;
    };

    const [previous, current] = await Promise.all([
      analyzePeriod(previousStartDate, previousEndDate),
      analyzePeriod(analysisStartDate, analysisEndDate)
    ]);

    setComparisonResult({
      previous,
      current,
      coverageChange:
        current.vegetation_coverage_percent -
        previous.vegetation_coverage_percent,
      ndviChange: current.mean_ndvi - previous.mean_ndvi
    });

  } catch (error) {
    setAnalysisError(error.message);
  } finally {
    setAnalysisLoading(false);
  }
}

const downloadReport = async () => {
  if (!selectedLine || !vegetationResult) {
    setReportError("Please select a power line and run vegetation analysis first.");
    return;
  }

  setReportLoading(true);
  setReportError("");

  try {
    const response = await fetch("http://127.0.0.1:8000/api/reports/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selected_line_name: selectedLine.name || "Selected power line",
        coordinates: selectedLine.coordinates,
        start_place: startPlace,
        end_place: endPlace,
        vegetation: vegetationResult,
        comparison: comparisonResult,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF report.");
    }

    const pdfBlob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(pdfBlob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "GridGreen_Report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    setReportError(error.message);
  } finally {
    setReportLoading(false);
  }
};


if (active === "Corridor Map") {
  
  return (
    <div className="page-section">
      
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Transmission Corridor Map</h3>
            <p>Interactive geographical monitoring</p>
          </div>

          <span className="risk-badge low">Map Active</span>
        </div>

        <div className="map-toolbar">
          <div>
            <strong>Study Area</strong>
            <span>Demonstration corridor · Bengaluru region</span>
          </div>

          <div className="map-layer-control">
            <span>Map layer</span>
            <select id="corridor-layer">
              <option value="street">Street Map</option>
              <option value="satellite">Satellite</option>
            </select>
          </div>
        </div>

        
<div className="corridor-map-container">
  <MapContainer
    center={
      startCoords && endCoords
        ? [
            (startCoords.lat + endCoords.lat) / 2,
            (startCoords.lon + endCoords.lon) / 2
          ]
        : [13.137, 77.567]
    }
    zoom={12}
    scrollWheelZoom={true}
    className="leaflet-map"
  >
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />

    <FitSelectedLocations
  startCoords={startCoords}
  endCoords={endCoords}
/>

    {/* Starting location */}
    {startCoords && (
      <CircleMarker
        center={[startCoords.lat, startCoords.lon]}
        radius={9}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#16a34a",
          fillOpacity: 1,
          weight: 2
        }}
      >
        <Popup>Start: {startPlace}</Popup>
      </CircleMarker>
    )}

    {/* Ending location */}
    {endCoords && (
      <CircleMarker
        center={[endCoords.lat, endCoords.lon]}
        radius={9}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#2563eb",
          fillOpacity: 1,
          weight: 2
        }}
      >
        <Popup>End: {endPlace}</Popup>
      </CircleMarker>
    )}

    {/* Actual mapped power lines */}
    {powerLines.map((line) => (
      <Polyline
        key={line.id}
        positions={line.coordinates}
        eventHandlers={{
          click: () => setSelectedLine(line)
        }}
        pathOptions={{
          color:
            selectedLine?.id === line.id
              ? "#16a34a"
              : "#e69b35",
          weight:
            selectedLine?.id === line.id ? 7 : 4,
          opacity: 0.9
        }}
      >
        <Popup>
          <strong>{line.name}</strong>
          <br />
          Power type: {line.powerType}
          <br />
          Voltage: {line.voltage}
          <br />
          OSM ID: {line.id}
        </Popup>
      </Polyline>
    ))}

    {/* Existing demonstration route */}
    
<Polyline
  positions={
    selectedLine
      ? selectedLine.coordinates
      : displayRoute
  }
  pathOptions={{
    color: "#16a34a",
    weight: 6,
    opacity: 0.9
  }}
/>

    {/* Existing vegetation risk markers */}
    {spans.map((span, index) => (
      <CircleMarker
        key={span.id}
        center={displayRoute[index + 1]}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor:
            span.risk === "High"
              ? "#ef4444"
              : span.risk === "Medium"
              ? "#eab308"
              : "#16a34a",
          fillOpacity: 1
        }}
      >
        <Popup>
          <strong>{span.id}</strong>
          <br />
          Vegetation: {span.vegetation}%
          <br />
          Estimated distance: {span.distance} m
          <br />
          Risk: {span.risk}
        </Popup>
      </CircleMarker>
    ))}
  </MapContainer>
</div>


        <div className="map-bottom-info">
          <span><i className="dot green"></i> Low risk</span>
          <span><i className="dot yellow"></i> Medium risk</span>
          <span><i className="dot red"></i> High risk</span>
        </div>

        <div className="demo-notice">
          <AlertTriangle size={17} />
          This corridor and its vegetation measurements are currently
          demonstration data, not verified power-line or satellite data.
        </div>
      </div>

      <div className="panel">
        <h3>Corridor Span Information</h3>
        <p>Click a marker on the map to inspect its sample measurements.</p>

        <div className="page-list-row">
          <strong>Total spans</strong>
          <span>5</span>
        </div>

        <div className="page-list-row">
          <strong>Target span length</strong>
          <span>250 metres</span>
        </div>

        <div className="page-list-row">
          <strong>Corridor buffer</strong>
          <span>30 metres each side (planned)</span>
        </div>
      </div>

    </div>
  );
}


  
if (active === "Vegetation Analysis") {
  return (
    <div className="page-section">

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Satellite Vegetation Analysis</h3>
            <p>Sentinel-2 imagery and NDVI measurements</p>
          </div>
          <Leaf size={23} className="green-icon" />
        </div>

        <div className="page-list-row">
          <strong>Selected power line</strong>
          <span>{selectedLine?.name || "No power line selected"}</span>
        </div>

        <div className="analysis-grid">
          <div className="location-field">
            <label>ANALYSIS START DATE</label>
            <input
              type="date"
              value={analysisStartDate}
              onChange={(e) => setAnalysisStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>ANALYSIS END DATE</label>
            <input
              type="date"
              value={analysisEndDate}
              onChange={(e) => setAnalysisEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="search-power-button"
          onClick={runLatestAnalysis}
          disabled={analysisLoading || !selectedLine}
        >
          <Search size={17} />
          {analysisLoading ? "Analysing..." : "Fetch Latest Satellite Data"}
        </button>

        {analysisError && (
          <div className="search-error">{analysisError}</div>
        )}

        {analysisLoading && (
          <p>Fetching Sentinel-2 imagery and calculating NDVI...</p>
        )}
      </div>

      {vegetationResult && (
        <div className="panel">
          <h3>Latest Satellite Analysis Results</h3>

          <div className="analysis-grid">
            <StatCard
              icon={<Leaf />}
              title="Vegetation Coverage"
              value={`${vegetationResult.vegetation_coverage_percent}%`}
              note="Pixels with NDVI ≥ 0.40"
              color="green"
            />

            <StatCard
              icon={<Activity />}
              title="Mean NDVI"
              value={vegetationResult.mean_ndvi}
              note="Average vegetation index"
              color="blue"
            />

            <StatCard
              icon={<Layers />}
              title="Satellite Images"
              value={vegetationResult.image_count}
              note="Images in selected period"
              color="purple"
            />
          </div>
          <div className="panel">
  <h3>NDVI Vegetation Map</h3>
  <p>Satellite-derived vegetation distribution</p>

  <img
    src={vegetationResult.ndvi_visualization_url}
    alt="Sentinel-2 NDVI vegetation map"
    style={{
      width: "100%",
      maxHeight: "450px",
      objectFit: "contain",
      borderRadius: "10px",
      background: "#e5e7eb"
    }}
  />

  <p>
    Green shades indicate higher NDVI values.
    Brown shades indicate lower NDVI values.
  </p>
</div>

          <div className="page-list-row">
            <strong>Latest image date</strong>
            <span>{vegetationResult.latest_image_date}</span>
          </div>

          <div className="page-list-row">
            <strong>Satellite source</strong>
            <span>{vegetationResult.satellite}</span>
          </div>

          <div className="page-list-row">
            <strong>Spatial resolution</strong>
            <span>{vegetationResult.resolution_meters} metres</span>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Historical Vegetation Comparison</h3>
        <p>Compare vegetation growth between two satellite periods.</p>

        <h4>Previous period</h4>

        <div className="analysis-grid">
          <div className="location-field">
            <label>START DATE</label>
            <input
              type="date"
              value={previousStartDate}
              onChange={(e) => setPreviousStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>END DATE</label>
            <input
              type="date"
              value={previousEndDate}
              onChange={(e) => setPreviousEndDate(e.target.value)}
            />
          </div>
        </div>

        <h4>Current period</h4>

        <div className="analysis-grid">
          <div className="location-field">
            <label>START DATE</label>
            <input
              type="date"
              value={analysisStartDate}
              onChange={(e) => setAnalysisStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>END DATE</label>
            <input
              type="date"
              value={analysisEndDate}
              onChange={(e) => setAnalysisEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="search-power-button"
          onClick={runHistoricalComparison}
          disabled={analysisLoading || !selectedLine}
        >
          <Activity size={17} />
          {analysisLoading ? "Comparing..." : "Compare Vegetation"}
        </button>

        {comparisonResult && (
          <div>
            <h3>Comparison Results</h3>

            <div className="analysis-grid">
              <StatCard
                icon={<Leaf />}
                title="Previous Coverage"
                value={`${comparisonResult.previous.vegetation_coverage_percent}%`}
                note={`${comparisonResult.previous.latest_image_date}`}
                color="blue"
              />

              <StatCard
                icon={<Leaf />}
                title="Current Coverage"
                value={`${comparisonResult.current.vegetation_coverage_percent}%`}
                note={`${comparisonResult.current.latest_image_date}`}
                color="green"
              />

              <StatCard
                icon={<TrendingUp />}
                title="Coverage Change"
                value={`${comparisonResult.coverageChange > 0 ? "+" : ""}${comparisonResult.coverageChange.toFixed(2)} pp`}
                note="Percentage-point change"
                color="purple"
              />

              <StatCard
                icon={<Activity />}
                title="NDVI Change"
                value={`${comparisonResult.ndviChange > 0 ? "+" : ""}${comparisonResult.ndviChange.toFixed(4)}`}
                note="Change in mean NDVI"
                color="blue"
              />
            </div>

            <p>
              {comparisonResult.coverageChange > 0
                ? "Vegetation coverage increased during the comparison period."
                : comparisonResult.coverageChange < 0
                ? "Vegetation coverage decreased during the comparison period."
                : "Vegetation coverage remained unchanged."}
            </p>
          </div>
        )}
      </div>

      <div className="demo-notice">
        <AlertTriangle size={17} />
        NDVI measures vegetation greenness, not tree height or electrical
        clearance. Results are satellite-based estimates.
      </div>

    </div>
  );
}

if (active === "Vegetation Analysis") {
  return (
    <div className="page-section">

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Satellite Vegetation Analysis</h3>
            <p>Sentinel-2 imagery and NDVI measurements</p>
          </div>
          <Leaf size={23} className="green-icon" />
        </div>

        <div className="page-list-row">
          <strong>Selected power line</strong>
          <span>{selectedLine?.name || "No power line selected"}</span>
        </div>

        <div className="analysis-grid">
          <div className="location-field">
            <label>ANALYSIS START DATE</label>
            <input
              type="date"
              value={analysisStartDate}
              onChange={(e) => setAnalysisStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>ANALYSIS END DATE</label>
            <input
              type="date"
              value={analysisEndDate}
              onChange={(e) => setAnalysisEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="search-power-button"
          onClick={runLatestAnalysis}
          disabled={analysisLoading || !selectedLine}
        >
          <Search size={17} />
          {analysisLoading ? "Analysing..." : "Fetch Latest Satellite Data"}
        </button>

        {analysisError && (
          <div className="search-error">{analysisError}</div>
        )}

        {analysisLoading && (
          <p>Fetching Sentinel-2 imagery and calculating NDVI...</p>
        )}
      </div>

      {vegetationResult && (
        <div className="panel">
          <h3>Latest Satellite Analysis Results</h3>

          <div className="analysis-grid">
            <StatCard
              icon={<Leaf />}
              title="Vegetation Coverage"
              value={`${vegetationResult.vegetation_coverage_percent}%`}
              note="Pixels with NDVI ≥ 0.40"
              color="green"
            />

            <StatCard
              icon={<Activity />}
              title="Mean NDVI"
              value={vegetationResult.mean_ndvi}
              note="Average vegetation index"
              color="blue"
            />

            <StatCard
              icon={<Layers />}
              title="Satellite Images"
              value={vegetationResult.image_count}
              note="Images in selected period"
              color="purple"
            />
          </div>

          <div className="page-list-row">
            <strong>Latest image date</strong>
            <span>{vegetationResult.latest_image_date}</span>
          </div>

          <div className="page-list-row">
            <strong>Satellite source</strong>
            <span>{vegetationResult.satellite}</span>
          </div>

          <div className="page-list-row">
            <strong>Spatial resolution</strong>
            <span>{vegetationResult.resolution_meters} metres</span>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Historical Vegetation Comparison</h3>
        <p>Compare vegetation growth between two satellite periods.</p>

        <h4>Previous period</h4>

        <div className="analysis-grid">
          <div className="location-field">
            <label>START DATE</label>
            <input
              type="date"
              value={previousStartDate}
              onChange={(e) => setPreviousStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>END DATE</label>
            <input
              type="date"
              value={previousEndDate}
              onChange={(e) => setPreviousEndDate(e.target.value)}
            />
          </div>
        </div>

        <h4>Current period</h4>

        <div className="analysis-grid">
          <div className="location-field">
            <label>START DATE</label>
            <input
              type="date"
              value={analysisStartDate}
              onChange={(e) => setAnalysisStartDate(e.target.value)}
            />
          </div>

          <div className="location-field">
            <label>END DATE</label>
            <input
              type="date"
              value={analysisEndDate}
              onChange={(e) => setAnalysisEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="search-power-button"
          onClick={runHistoricalComparison}
          disabled={analysisLoading || !selectedLine}
        >
          <Activity size={17} />
          {analysisLoading ? "Comparing..." : "Compare Vegetation"}
        </button>

        {comparisonResult && (
          <div>
            <h3>Comparison Results</h3>

            <div className="analysis-grid">
              <StatCard
                icon={<Leaf />}
                title="Previous Coverage"
                value={`${comparisonResult.previous.vegetation_coverage_percent}%`}
                note={`${comparisonResult.previous.latest_image_date}`}
                color="blue"
              />

              <StatCard
                icon={<Leaf />}
                title="Current Coverage"
                value={`${comparisonResult.current.vegetation_coverage_percent}%`}
                note={`${comparisonResult.current.latest_image_date}`}
                color="green"
              />

              <StatCard
                icon={<TrendingUp />}
                title="Coverage Change"
                value={`${comparisonResult.coverageChange > 0 ? "+" : ""}${comparisonResult.coverageChange.toFixed(2)} pp`}
                note="Percentage-point change"
                color="purple"
              />

              <StatCard
                icon={<Activity />}
                title="NDVI Change"
                value={`${comparisonResult.ndviChange > 0 ? "+" : ""}${comparisonResult.ndviChange.toFixed(4)}`}
                note="Change in mean NDVI"
                color="blue"
              />
            </div>

            <p>
              {comparisonResult.coverageChange > 0
                ? "Vegetation coverage increased during the comparison period."
                : comparisonResult.coverageChange < 0
                ? "Vegetation coverage decreased during the comparison period."
                : "Vegetation coverage remained unchanged."}
            </p>
          </div>
        )}
      </div>

      <div className="demo-notice">
        <AlertTriangle size={17} />
        NDVI measures vegetation greenness, not tree height or electrical
        clearance. Results are satellite-based estimates.
      </div>

    </div>
  );
}


  
if (active === "Risk Monitoring") {
  const coverage = vegetationResult?.vegetation_coverage_percent;

  const riskLevel =
    coverage == null
      ? null
      : coverage > 55
      ? "High"
      : coverage > 35
      ? "Medium"
      : "Low";

  const riskColor =
    riskLevel === "High"
      ? "red"
      : riskLevel === "Medium"
      ? "yellow"
      : "green";

  return (
    <div className="page-section">

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Vegetation Risk Monitoring</h3>
            <p>Inspection priorities based on satellite vegetation analysis</p>
          </div>
          <ShieldCheck size={23} className="green-icon" />
        </div>

        {!vegetationResult ? (
          <div className="page-placeholder">
            <AlertTriangle size={40} />
            <h3>No Analysis Available</h3>
            <p>
              Run satellite vegetation analysis first to calculate
              the corridor inspection priority.
            </p>
          </div>
        ) : (
          <>
            <div className="analysis-grid">

              <StatCard
                icon={<Leaf />}
                title="Vegetation Coverage"
                value={`${coverage.toFixed(2)}%`}
                note="Current satellite measurement"
                color="green"
              />

              <StatCard
                icon={<Activity />}
                title="Mean NDVI"
                value={vegetationResult.mean_ndvi}
                note="Average vegetation index"
                color="blue"
              />

              <StatCard
                icon={<AlertTriangle />}
                title="Inspection Priority"
                value={riskLevel}
                note="Based on proposed coverage thresholds"
                color="orange"
              />

            </div>

            <div className="page-list-row">
              <strong>Selected power line</strong>
              <span>{selectedLine?.name || "Not available"}</span>
            </div>

            <div className="page-list-row">
              <strong>Latest satellite image</strong>
              <span>{vegetationResult.latest_image_date}</span>
            </div>

            <div className="page-list-row">
              <strong>Satellite source</strong>
              <span>{vegetationResult.satellite}</span>
            </div>

            <div className="page-list-row">
              <strong>Vegetation threshold</strong>
              <span>NDVI ≥ {vegetationResult.ndvi_threshold}</span>
            </div>

            <div className="panel-heading">
              <h3>Inspection Priority Classification</h3>
            </div>

            <RiskBar
              label="High priority"
              value={coverage > 55 ? 100 : 0}
              count={coverage > 55 ? 1 : 0}
              color="red"
            />

            <RiskBar
              label="Medium priority"
              value={coverage > 35 && coverage <= 55 ? 100 : 0}
              count={coverage > 35 && coverage <= 55 ? 1 : 0}
              color="yellow"
            />

            <RiskBar
              label="Low priority"
              value={coverage <= 35 ? 100 : 0}
              count={coverage <= 35 ? 1 : 0}
              color="green"
            />

            {comparisonResult && (
              <div className="summary-note">
                <TrendingUp size={17} />
                <span>
                  Vegetation coverage changed by{" "}
                  {comparisonResult.coverageChange > 0 ? "+" : ""}
                  {comparisonResult.coverageChange.toFixed(2)}
                  percentage points between the selected periods.
                </span>
              </div>
            )}

            <div className="demo-notice">
              <AlertTriangle size={17} />
              These are corridor-level inspection priorities based on
              vegetation coverage only. They do not establish electrical
              clearance or actual conductor safety. Distance measurements
              and field inspection are required for that assessment.
            </div>
          </>
        )}
      </div>

    </div>
  );
}


  if (active === "Reports") {
    return (
      <div className="page-section">
        <div className="panel">
          <h3>Analysis Reports</h3>
          <p>Generate a printable report of the current demonstration.</p>

          <div className="page-placeholder">
            <FileText size={45} />
            <h2>GridGreen Report</h2>
            <p>Sample corridor analysis · 5 spans</p>
            <button
  onClick={downloadReport}
  disabled={reportLoading}
>
  {reportLoading ? "Generating PDF..." : "Generate PDF Report"}
</button>
{reportError && (
  <p style={{ color: "red" }}>{reportError}</p>
)}
          </div>
        </div>
      </div>
    );
  }

  if (active === "Settings") {
    return (
      <div className="page-section">
        <div className="panel">
          <h3>Application Settings</h3>

          <div className="page-list-row">
            <div>
              <strong>Application Name</strong>
              <p>GridGreen Vegetation Monitoring</p>
            </div>
          </div>

          <div className="page-list-row">
            <div>
              <strong>Satellite Source</strong>
              <p>Sentinel-2 (planned integration)</p>
            </div>
          </div>

          <div className="page-list-row">
            <div>
              <strong>Distance Unit</strong>
              <p>Metres</p>
            </div>
          </div>

          <div className="page-list-row">
            <div>
              <strong>Application Version</strong>
              <p>Version 1.0</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}


function StatCard({ icon, title, value, note, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <span className="stat-title">{title}</span>
      <h2>{value}</h2>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function RiskBar({ label, value, count, color }) {
  return (
    <div className="risk-bar-item">
      <div className="risk-bar-label">
        <span>{label}</span>
        <strong>{count} spans ({value}%)</strong>
      </div>
      <div className="risk-track">
        <div className={color} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}

export default App;
