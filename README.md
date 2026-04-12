# Engineering Equation Solver

Full-stack equation solver with a neon-themed frontend and FastAPI backend.

## Project Structure

- `frontend/` Vanilla JavaScript UI
- `backend/` FastAPI service, symbolic solver engine, and equation database

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend Setup

Serve the `frontend` folder with any static server:

```bash
cd frontend
python -m http.server 5500
```

Then open `http://127.0.0.1:5500`.

## API

- `GET /health`
- `GET /equations?category=Mechanics`
- `POST /solve`

Example solve request:

```json
{
  "equation_name": "Electrical - Ohm Law v01",
  "solve_for": "V",
  "variables": {
    "I": 5,
    "R": 4
  }
}
```
