# Engineering Equation Solver

Serverless-ready equation solver built for Vercel.

## Structure

- `api/solve.js` Vercel serverless endpoint
- `backend/services/solver.js` reusable solver engine
- `backend/data/equations.json` full equations dataset
- `frontend/index.html` user interface
- `frontend/styles.css` neon dark theme styling
- `frontend/app.js` frontend data loading and API integration

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/frontend/`.

## API

### `POST /api/solve`

Request body:

```json
{
  "equation": "Electrical - Ohm Law v01",
  "solveFor": "V",
  "variables": {
    "I": 5,
    "R": 4
  }
}
```

Response:

```json
{
  "result": 20,
  "steps": [
    "Selected equation: Electrical - Ohm Law v01"
  ]
}
```
