---
name: FastAPI and Vite static serving
description: The campus artifact combines a built Vite frontend with FastAPI in one same-origin workflow.
---

The managed web workflow must build the Vite bundle before starting Uvicorn, and FastAPI must explicitly mount the built asset directory; otherwise the root HTML can load while its JavaScript and CSS return 404s.

**Why:** The artifact router exposes one web service and the frontend relies on relative API requests, so separate dev servers would require extra proxy routing and would break the requested same-origin setup.

**How to apply:** For future changes to this app, keep the build-first Uvicorn command and verify both `/` and `/assets/*` through the shared preview proxy.