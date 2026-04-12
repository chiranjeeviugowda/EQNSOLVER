import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import sympy as sp


class EquationSolver:
    def __init__(self, equations_path: str) -> None:
        self.equations_path = Path(equations_path)
        self.equations = self._load_equations()
        self._equation_index = {eq["name"]: eq for eq in self.equations}

    def _load_equations(self) -> List[Dict[str, Any]]:
        with self.equations_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def list_categories(self) -> List[str]:
        categories = {eq["category"] for eq in self.equations}
        return sorted(categories)

    def list_equations(self, category: str | None = None) -> List[Dict[str, Any]]:
        if not category:
            return self.equations
        return [eq for eq in self.equations if eq["category"] == category]

    def solve(
        self, equation_name: str, variables: Dict[str, float], solve_for: str
    ) -> Tuple[float, List[str], Dict[str, Any]]:
        equation = self._equation_index.get(equation_name)
        if not equation:
            raise ValueError(f"Unknown equation: {equation_name}")

        formula = equation["formula"]
        left, right = [side.strip() for side in formula.split("=")]

        symbols: Dict[str, sp.Symbol] = {}
        for var in equation["variables"]:
            symbols[var] = sp.Symbol(var)

        if solve_for not in symbols:
            raise ValueError(
                f"Variable '{solve_for}' is not defined in equation '{equation_name}'"
            )

        local_scope = {**symbols, "pi": sp.pi}

        try:
            expr_left = sp.sympify(left, locals=local_scope)
            expr_right = sp.sympify(right, locals=local_scope)
        except Exception as exc:
            raise ValueError(f"Failed to parse formula '{formula}': {exc}") from exc

        eq_expr = sp.Eq(expr_left, expr_right)

        substitutions = {}
        for key, value in variables.items():
            if key not in symbols:
                continue
            substitutions[symbols[key]] = float(value)

        if symbols[solve_for] in substitutions:
            substitutions.pop(symbols[solve_for], None)

        available_vars = set(variables.keys())
        required_vars = set(equation["variables"]) - {solve_for}
        if not required_vars.issubset(available_vars):
            missing = sorted(required_vars - available_vars)
            raise ValueError(
                "Missing required variables for this solve target: " + ", ".join(missing)
            )

        substituted = eq_expr.subs(substitutions)

        try:
            raw_solutions = sp.solve(substituted, symbols[solve_for], dict=False)
        except Exception as exc:
            raise ValueError(f"Unable to solve equation: {exc}") from exc

        if not raw_solutions:
            raise ValueError("No valid solution found.")

        numeric_solutions = []
        for candidate in raw_solutions:
            evaluated = sp.N(candidate)
            if evaluated.is_real:
                numeric_solutions.append(float(evaluated))

        if not numeric_solutions:
            numeric_solutions = [float(sp.N(raw_solutions[0]))]

        result = numeric_solutions[0]

        steps = [
            f"Selected equation: {equation_name}",
            f"Formula: {formula}",
            f"Solve for: {solve_for}",
            f"Substitutions: { {k: v for k, v in variables.items() if k != solve_for} }",
            f"Computed {solve_for} = {result}",
        ]

        return result, steps, equation
