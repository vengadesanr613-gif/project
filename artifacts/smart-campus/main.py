from heapq import heappop, heappush
from pathlib import Path
from typing import Any
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


app = FastAPI(
    title="Smart Campus AI Voice Assistant",
    description="Campus wayfinding and event discovery API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BUILT_PUBLIC_DIR = Path(__file__).parent / "dist" / "public"
if BUILT_PUBLIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=BUILT_PUBLIC_DIR / "assets"), name="assets")


# Coordinates are intentionally close together so the sample campus renders
# as a compact, walkable area on OpenStreetMap.
CAMPUS_NODES: dict[str, dict[str, Any]] = {
    "gate": {
        "name": "Main Gate",
        "short_name": "Gate",
        "latitude": 12.9719,
        "longitude": 77.5937,
        "description": "The main entrance to campus",
    },
    "admin": {
        "name": "Administration Block",
        "short_name": "Admin",
        "latitude": 12.9728,
        "longitude": 77.5947,
        "description": "Student services and administration",
    },
    "fountain": {
        "name": "Central Fountain",
        "short_name": "Fountain",
        "latitude": 12.9738,
        "longitude": 77.5940,
        "description": "The central campus landmark",
    },
    "cse": {
        "name": "CSE Department",
        "short_name": "CSE",
        "latitude": 12.9745,
        "longitude": 77.5951,
        "description": "Computer Science and Engineering",
    },
    "auditorium": {
        "name": "Open Air Auditorium",
        "short_name": "Auditorium",
        "latitude": 12.9752,
        "longitude": 77.5938,
        "description": "Talks, performances, and campus gatherings",
    },
    "canteen": {
        "name": "Campus Canteen",
        "short_name": "Canteen",
        "latitude": 12.9731,
        "longitude": 77.5960,
        "description": "Meals, snacks, and a shaded seating area",
    },
}

# Undirected walking graph. Weights are approximate walking minutes.
GRAPH: dict[str, list[tuple[str, int]]] = {
    "gate": [("admin", 3), ("fountain", 4)],
    "admin": [("gate", 3), ("fountain", 2), ("cse", 5)],
    "fountain": [("gate", 4), ("admin", 2), ("cse", 4), ("auditorium", 4)],
    "cse": [("admin", 5), ("fountain", 4), ("canteen", 3), ("auditorium", 3)],
    "auditorium": [("fountain", 4), ("cse", 3), ("canteen", 5)],
    "canteen": [("cse", 3), ("auditorium", 5)],
}

ACTIVE_EVENTS = [
    {
        "id": "innovation-week",
        "title": "Innovation Week Showcase",
        "location": "Open Air Auditorium",
        "location_key": "auditorium",
        "time": "Today · 4:00 PM",
        "category": "Campus",
        "description": "Student teams present prototypes and research demos.",
        "accent": "violet",
    },
    {
        "id": "coding-lab",
        "title": "Open Coding Lab",
        "location": "CSE Department",
        "location_key": "cse",
        "time": "Today · 6:30 PM",
        "category": "Workshop",
        "description": "Bring your project and pair with a peer mentor.",
        "accent": "cyan",
    },
    {
        "id": "community-lunch",
        "title": "Community Lunch",
        "location": "Campus Canteen",
        "location_key": "canteen",
        "time": "Tomorrow · 1:00 PM",
        "category": "Community",
        "description": "A shared table for clubs, societies, and new students.",
        "accent": "amber",
    },
]


def shortest_path(start: str, destination: str) -> tuple[list[str], int]:
    distances = {node: float("inf") for node in GRAPH}
    previous: dict[str, str | None] = {node: None for node in GRAPH}
    distances[start] = 0
    queue: list[tuple[int, str]] = [(0, start)]

    while queue:
        distance, current = heappop(queue)
        if distance > distances[current]:
            continue
        if current == destination:
            break
        for neighbor, weight in GRAPH[current]:
            next_distance = distance + weight
            if next_distance < distances[neighbor]:
                distances[neighbor] = next_distance
                previous[neighbor] = current
                heappush(queue, (next_distance, neighbor))

    if distances[destination] == float("inf"):
        raise HTTPException(status_code=404, detail="No route found")

    path: list[str] = []
    current: str | None = destination
    while current is not None:
        path.append(current)
        current = previous[current]
    path.reverse()
    return path, int(distances[destination])


def walking_direction(start: str, end: str) -> str:
    labels = {
        ("gate", "admin"): "Walk east along the main approach",
        ("gate", "fountain"): "Follow the central path toward the fountain",
        ("admin", "fountain"): "Continue south toward the central fountain",
        ("admin", "cse"): "Follow the academic wing east",
        ("fountain", "cse"): "Take the academic path northeast",
        ("fountain", "auditorium"): "Continue north past the fountain",
        ("cse", "canteen"): "Walk south toward the dining courtyard",
        ("cse", "auditorium"): "Follow the path north to the auditorium",
        ("auditorium", "canteen"): "Take the east path toward the canteen",
    }
    return labels.get((start, end), f"Walk from {CAMPUS_NODES[start]['name']} toward {CAMPUS_NODES[end]['name']}")


@app.get("/navigation-route")
def navigation_route(destination: str = Query(..., min_length=1)) -> dict[str, Any]:
    normalized_destination = destination.strip().lower().replace(" ", "-")
    aliases = {
        "main-gate": "gate",
        "entrance": "gate",
        "administration": "admin",
        "administration-block": "admin",
        "central-fountain": "fountain",
        "computer-science": "cse",
        "cse-department": "cse",
        "open-air-auditorium": "auditorium",
        "campus-canteen": "canteen",
    }
    normalized_destination = aliases.get(normalized_destination, normalized_destination)

    if normalized_destination not in CAMPUS_NODES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown destination. Choose one of: {', '.join(CAMPUS_NODES)}",
        )

    start = "gate"
    path, total_minutes = shortest_path(start, normalized_destination)
    waypoints = [
        {
            "key": key,
            "name": CAMPUS_NODES[key]["name"],
            "short_name": CAMPUS_NODES[key]["short_name"],
            "latitude": CAMPUS_NODES[key]["latitude"],
            "longitude": CAMPUS_NODES[key]["longitude"],
            "description": CAMPUS_NODES[key]["description"],
        }
        for key in path
    ]

    directions = [
        {
            "step": index + 1,
            "from": CAMPUS_NODES[current]["name"],
            "to": CAMPUS_NODES[next_node]["name"],
            "text": walking_direction(current, next_node),
            "minutes": next(
                weight for neighbor, weight in GRAPH[current] if neighbor == next_node
            ),
        }
        for index, (current, next_node) in enumerate(zip(path, path[1:]))
    ]
    directions.insert(
        0,
        {
            "step": 0,
            "from": "Current location",
            "to": CAMPUS_NODES[start]["name"],
            "text": "Start at the Main Gate",
            "minutes": 0,
        },
    )
    directions.append(
        {
            "step": len(directions),
            "from": CAMPUS_NODES[normalized_destination]["name"],
            "to": "Destination",
            "text": f"You have arrived at {CAMPUS_NODES[normalized_destination]['name']}",
            "minutes": 0,
        }
    )

    return {
        "destination": normalized_destination,
        "destination_name": CAMPUS_NODES[normalized_destination]["name"],
        "total_minutes": total_minutes,
        "distance_label": f"{max(total_minutes * 75, 80)} m",
        "waypoints": waypoints,
        "directions": directions,
    }


@app.get("/events")
def events() -> dict[str, Any]:
    return {"events": ACTIVE_EVENTS, "count": len(ACTIVE_EVENTS)}


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def index() -> Any:
    # The Vite build is served by FastAPI so the same origin owns both the UI
    # and the relative navigation/event endpoints.
    from fastapi.responses import FileResponse

    built_index = BUILT_PUBLIC_DIR / "index.html"
    source_index = Path(__file__).parent / "index.html"
    return FileResponse(built_index if built_index.exists() else source_index)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080")),
    )