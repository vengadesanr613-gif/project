# Smart Campus Voice Assistant

A FastAPI-powered campus wayfinding app with Dijkstra routing, OpenStreetMap maps, live events, and browser voice guidance.

## Run & Operate

- `pnpm --filter @workspace/smart-campus run dev` — build the React page, then run FastAPI/Uvicorn for the campus app
- `uvicorn main:app --host 0.0.0.0 --port 8080` — run the Python API directly from `artifacts/smart-campus`
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=21691 BASE_PATH=/ pnpm --filter @workspace/smart-campus run build` — build the web page outside the managed workflow

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: FastAPI + Uvicorn
- Frontend: React + Vite + Leaflet
- Routing: Python `heapq` Dijkstra shortest path
- Voice: Web Speech API (speech recognition + speech synthesis)

## Where things live

- `artifacts/smart-campus/main.py` — FastAPI app, campus graph, Dijkstra routing, events, and root page serving
- `artifacts/smart-campus/src/pages/home.tsx` — map, destination search, event cards, and voice drawer
- `artifacts/smart-campus/src/index.css` — campus visual language and responsive layout
- `artifacts/smart-campus/requirements.txt` — Python runtime dependencies

## Architecture decisions

- The main gate is the route origin so each request returns a deterministic walking path.
- The Vite build is served by FastAPI so `/`, `/navigation-route`, and `/events` stay same-origin.
- Leaflet and leaflet-polylinedecorator load in the browser from CDN; the route still renders without the decorator if that CDN is unavailable.

## Product

Students and visitors can choose a campus destination, see a shortest walking route with directional arrows, read step-by-step guidance aloud, use browser voice input, and browse active events.

## User preferences

- Keep frontend requests relative so the page and FastAPI routes share one origin.

## Gotchas

- The managed web workflow builds Vite before starting Uvicorn so FastAPI can serve the compiled assets.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
