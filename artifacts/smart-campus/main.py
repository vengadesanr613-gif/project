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


# Thiagarajar College of Engineering is in Thiruparankundram, Madurai.
# The campus anchor and bounds are based on the college's OpenStreetMap
# location; building waypoints are kept within the campus footprint.
CAMPUS_NODES: dict[str, dict[str, Any]] = {
    "gate": {
        "name": "TCE Main Gate",
        "short_name": "Main Gate",
        "latitude": 9.8814,
        "longitude": 78.0832,
        "description": "The main entrance to Thiagarajar College of Engineering",
    },
    "admin": {
        "name": "TCE Administration Block",
        "short_name": "Admin",
        "latitude": 9.8821,
        "longitude": 78.0822,
        "description": "Principal's office, administration, and student services",
    },
    "library": {
        "name": "Thiagarajar Central Library",
        "short_name": "Library",
        "latitude": 9.8831,
        "longitude": 78.0816,
        "description": "Central library and study spaces",
    },
    "cse": {
        "name": "CSE Department",
        "short_name": "CSE",
        "latitude": 9.8841,
        "longitude": 78.0809,
        "description": "Computer Science and Engineering",
    },
    "ece": {
        "name": "ECE Department",
        "short_name": "ECE",
        "latitude": 9.8834,
        "longitude": 78.0830,
        "description": "Electronics and Communication Engineering",
    },
    "auditorium": {
        "name": "TCE Main Auditorium",
        "short_name": "Auditorium",
        "latitude": 9.8818,
        "longitude": 78.0815,
        "description": "Talks, performances, and college gatherings",
    },
    "canteen": {
        "name": "TCE Campus Canteen",
        "short_name": "Canteen",
        "latitude": 9.8808,
        "longitude": 78.0819,
        "description": "Meals, snacks, and student seating",
    },
    "hostel": {
        "name": "TCE Hostel Block",
        "short_name": "Hostel",
        "latitude": 9.8794,
        "longitude": 78.0806,
        "description": "Student residence and hostel services",
    },
    "tbi": {
        "name": "TCE AICTE Idea Lab",
        "short_name": "Idea Lab",
        "latitude": 9.8838,
        "longitude": 78.0826,
        "description": "Innovation, prototyping, and entrepreneurship space",
    },
    "sports": {
        "name": "TCE Sports Ground",
        "short_name": "Sports",
        "latitude": 9.8796,
        "longitude": 78.0839,
        "description": "Sports facilities and outdoor campus activity",
    },
}

# Undirected walking graph. Weights are approximate walking minutes.
GRAPH: dict[str, list[tuple[str, int]]] = {
    "gate": [("admin", 3), ("canteen", 4), ("sports", 5)],
    "admin": [("gate", 3), ("library", 3), ("ece", 3), ("tbi", 4)],
    "library": [("admin", 3), ("cse", 3), ("auditorium", 4), ("tbi", 3)],
    "cse": [("library", 3), ("auditorium", 5), ("tbi", 3)],
    "ece": [("admin", 3), ("tbi", 2), ("canteen", 4)],
    "auditorium": [("library", 4), ("cse", 5), ("canteen", 3), ("hostel", 4)],
    "canteen": [("gate", 4), ("ece", 4), ("auditorium", 3), ("hostel", 3)],
    "hostel": [("canteen", 3), ("auditorium", 4), ("sports", 3)],
    "tbi": [("admin", 4), ("library", 3), ("cse", 3), ("ece", 2)],
    "sports": [("gate", 5), ("hostel", 3)],
}

ACTIVE_EVENTS = [
    {
        "id": "innovation-week",
        "title": "Innovation Week Showcase",
        "location": "TCE Main Auditorium",
        "location_key": "auditorium",
        "time": "Today · 4:00 PM",
        "category": "Campus",
        "description": "Student teams present prototypes and research demos at TCE.",
        "accent": "violet",
    },
    {
        "id": "coding-lab",
        "title": "Open Coding Lab",
        "location": "CSE Department",
        "location_key": "cse",
        "time": "Today · 6:30 PM",
        "category": "Workshop",
        "description": "Bring your project and pair with a peer mentor at TCE.",
        "accent": "cyan",
    },
    {
        "id": "community-lunch",
        "title": "Community Lunch",
        "location": "TCE Campus Canteen",
        "location_key": "canteen",
        "time": "Tomorrow · 1:00 PM",
        "category": "Community",
        "description": "A shared table for TCE clubs, societies, and new students.",
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
        ("gate", "admin"): "Walk west along the main approach",
        ("gate", "canteen"): "Follow the south path toward the canteen",
        ("gate", "sports"): "Take the east path toward the sports ground",
        ("admin", "library"): "Continue northwest toward the central library",
        ("admin", "ece"): "Follow the academic path south",
        ("admin", "tbi"): "Walk toward the innovation wing",
        ("library", "cse"): "Continue north toward the CSE department",
        ("library", "auditorium"): "Follow the west path to the auditorium",
        ("library", "tbi"): "Take the path toward the Idea Lab",
        ("cse", "auditorium"): "Follow the south path to the auditorium",
        ("cse", "tbi"): "Walk southeast toward the Idea Lab",
        ("ece", "tbi"): "Continue north toward the Idea Lab",
        ("ece", "canteen"): "Walk south toward the dining area",
        ("auditorium", "canteen"): "Take the east path toward the canteen",
        ("auditorium", "hostel"): "Follow the south path toward the hostel block",
        ("canteen", "hostel"): "Continue south toward the hostel block",
        ("hostel", "sports"): "Walk east toward the sports ground",
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
        "tce-administration-block": "admin",
        "thiagarajar-central-library": "library",
        "library": "library",
        "computer-science": "cse",
        "cse-department": "cse",
        "electronics-and-communication-engineering": "ece",
        "ece-department": "ece",
        "main-auditorium": "auditorium",
        "tce-main-auditorium": "auditorium",
        "campus-canteen": "canteen",
        "tce-campus-canteen": "canteen",
        "hostel-block": "hostel",
        "tce-hostel-block": "hostel",
        "tce-aicte-idea-lab": "tbi",
        "idea-lab": "tbi",
        "sports-ground": "sports",
        "tce-sports-ground": "sports",
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