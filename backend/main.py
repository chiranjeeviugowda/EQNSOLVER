from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from solver import EquationSolver


BASE_DIR = Path(__file__).resolve().parent
solver = EquationSolver(str(BASE_DIR / "equations.json"))

app = FastAPI(title="Engineering Equation Solver API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SolveRequest(BaseModel):
    equation_name: str = Field(..., description="Name of the equation to solve")
    solve_for: str = Field(..., description="Variable to isolate and compute")
    variables: Dict[str, float] = Field(default_factory=dict)


class SolveResponse(BaseModel):
    equation_name: str
    category: str
    solve_for: str
    result: float
    steps: List[str]


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/equations")
def get_equations(category: Optional[str] = None):
    equations = solver.list_equations(category)
    return {
        "count": len(equations),
        "categories": solver.list_categories(),
        "equations": equations,
    }


@app.post("/solve", response_model=SolveResponse)
def solve_equation(payload: SolveRequest):
    try:
        result, steps, equation = solver.solve(
            equation_name=payload.equation_name,
            variables=payload.variables,
            solve_for=payload.solve_for,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return SolveResponse(
        equation_name=equation["name"],
        category=equation["category"],
        solve_for=payload.solve_for,
        result=result,
        steps=steps,
    )
