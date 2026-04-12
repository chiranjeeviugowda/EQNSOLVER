const fs = require('fs');
const path = require('path');
const { compile } = require('mathjs');

const EQUATIONS_PATH = path.join(__dirname, '..', 'data', 'equations.json');
const EPSILON = 1e-9;

class EquationSolver {
  constructor(equationsPath = EQUATIONS_PATH) {
    this.equationsPath = equationsPath;
    this.equations = this.loadEquations();
    this.equationIndex = new Map(this.equations.map((eq) => [eq.name, eq]));
  }

  loadEquations() {
    const raw = fs.readFileSync(this.equationsPath, 'utf-8');
    return JSON.parse(raw);
  }

  listCategories() {
    return [...new Set(this.equations.map((eq) => eq.category))].sort();
  }

  listEquations(category) {
    if (!category) {
      return this.equations;
    }
    return this.equations.filter((eq) => eq.category === category);
  }

  getEquation(identifier) {
    if (!identifier) {
      return null;
    }

    if (this.equationIndex.has(identifier)) {
      return this.equationIndex.get(identifier);
    }

    return this.equations.find((eq) => eq.formula === identifier) || null;
  }

  splitFormula(formula) {
    const parts = String(formula).split('=');
    if (parts.length !== 2) {
      throw new Error(`Invalid formula '${formula}'. Expected exactly one '=' sign.`);
    }

    return {
      left: parts[0].trim(),
      right: parts[1].trim(),
    };
  }

  validateInputs(equation, solveFor, variables) {
    if (!equation.variables.includes(solveFor)) {
      throw new Error(`Variable '${solveFor}' is not defined in equation '${equation.name}'.`);
    }

    const required = equation.variables.filter((variable) => variable !== solveFor);
    const missing = required.filter((variable) => variables[variable] === undefined || variables[variable] === null);

    if (missing.length > 0) {
      throw new Error(`Missing required variables for this solve target: ${missing.join(', ')}`);
    }
  }

  createResidualFunction(formula, solveFor, variables) {
    const { left, right } = this.splitFormula(formula);
    const leftExpr = compile(left);
    const rightExpr = compile(right);

    return (candidate) => {
      const scope = {
        ...variables,
        [solveFor]: candidate,
        pi: Math.PI,
        e: Math.E,
      };
      const leftValue = Number(leftExpr.evaluate(scope));
      const rightValue = Number(rightExpr.evaluate(scope));

      if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
        return NaN;
      }

      return leftValue - rightValue;
    };
  }

  numericDerivative(fn, x) {
    const h = Math.max(1e-7, Math.abs(x) * 1e-7);
    const f1 = fn(x + h);
    const f2 = fn(x - h);
    if (!Number.isFinite(f1) || !Number.isFinite(f2)) {
      return NaN;
    }
    return (f1 - f2) / (2 * h);
  }

  bisect(fn, low, high, maxIterations = 100) {
    let fLow = fn(low);
    let fHigh = fn(high);

    if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) {
      return null;
    }

    for (let i = 0; i < maxIterations; i += 1) {
      const mid = (low + high) / 2;
      const fMid = fn(mid);

      if (!Number.isFinite(fMid)) {
        return null;
      }

      if (Math.abs(fMid) < EPSILON) {
        return mid;
      }

      if (fLow * fMid <= 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }

      if (Math.abs(high - low) < EPSILON) {
        return (high + low) / 2;
      }
    }

    return (low + high) / 2;
  }

  findBracketedRoot(fn) {
    const ranges = [
      [-1e-6, 1e-6],
      [-10, 10],
      [-100, 100],
      [-1_000, 1_000],
      [-1_000_000, 1_000_000],
    ];

    for (const [start, end] of ranges) {
      const steps = 200;
      const stepSize = (end - start) / steps;
      let x0 = start;
      let f0 = fn(x0);

      for (let i = 1; i <= steps; i += 1) {
        const x1 = start + i * stepSize;
        const f1 = fn(x1);

        if (Number.isFinite(f0) && Number.isFinite(f1)) {
          if (Math.abs(f0) < EPSILON) {
            return x0;
          }
          if (Math.abs(f1) < EPSILON) {
            return x1;
          }
          if (f0 * f1 < 0) {
            const root = this.bisect(fn, x0, x1);
            if (root !== null) {
              return root;
            }
          }
        }

        x0 = x1;
        f0 = f1;
      }
    }

    return null;
  }

  newtonSolve(fn, initialGuess = 1, maxIterations = 60) {
    let current = initialGuess;

    for (let i = 0; i < maxIterations; i += 1) {
      const value = fn(current);
      if (!Number.isFinite(value)) {
        return null;
      }

      if (Math.abs(value) < EPSILON) {
        return current;
      }

      const derivative = this.numericDerivative(fn, current);
      if (!Number.isFinite(derivative) || Math.abs(derivative) < EPSILON) {
        return null;
      }

      current -= value / derivative;

      if (!Number.isFinite(current)) {
        return null;
      }
    }

    return null;
  }

  solve({ equation: equationIdentifier, variables = {}, solveFor }) {
    const equation = this.getEquation(equationIdentifier);
    if (!equation) {
      throw new Error(`Unknown equation: ${equationIdentifier}`);
    }

    this.validateInputs(equation, solveFor, variables);

    const numericVariables = Object.fromEntries(
      Object.entries(variables)
        .filter(([name]) => name !== solveFor)
        .map(([name, value]) => [name, Number(value)])
    );

    const fn = this.createResidualFunction(equation.formula, solveFor, numericVariables);

    let result = this.findBracketedRoot(fn);

    if (result === null) {
      const guesses = [
        Number(variables[solveFor]),
        0,
        1,
        -1,
        10,
        -10,
        100,
        -100,
      ].filter((guess) => Number.isFinite(guess));

      for (const guess of guesses) {
        result = this.newtonSolve(fn, guess);
        if (result !== null) {
          break;
        }
      }
    }

    if (result === null || !Number.isFinite(result)) {
      throw new Error('No valid solution found.');
    }

    const cleanedResult = Object.is(result, -0) ? 0 : Number(result.toPrecision(12));

    const steps = [
      `Selected equation: ${equation.name}`,
      `Formula: ${equation.formula}`,
      `Solve for: ${solveFor}`,
      `Substitutions: ${JSON.stringify(numericVariables)}`,
      `Computed ${solveFor} = ${cleanedResult}`,
    ];

    return {
      result: cleanedResult,
      steps,
      equation,
    };
  }
}

module.exports = {
  EquationSolver,
};
