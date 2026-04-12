import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'mathjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EQUATIONS_PATH = path.join(__dirname, '..', 'data', 'equations.json');
const EPSILON = 1e-9;

function loadEquations(equationsPath = EQUATIONS_PATH) {
  const raw = fs.readFileSync(equationsPath, 'utf-8');
  return JSON.parse(raw);
}

function splitFormula(formula) {
  const parts = String(formula).split('=');
  if (parts.length !== 2) {
    throw new Error(`Invalid formula '${formula}'. Expected exactly one '=' sign.`);
  }

  return {
    left: parts[0].trim(),
    right: parts[1].trim(),
  };
}

function validateInputs(equation, solveFor, variables) {
  if (!equation.variables.includes(solveFor)) {
    throw new Error(`Variable '${solveFor}' is not defined in equation '${equation.name}'.`);
  }

  const required = equation.variables.filter((variable) => variable !== solveFor);
  const missing = required.filter(
    (variable) => variables[variable] === undefined || variables[variable] === null
  );

  if (missing.length > 0) {
    throw new Error(`Missing required variables for this solve target: ${missing.join(', ')}`);
  }
}

function createResidualFunction(formula, solveFor, variables) {
  const { left, right } = splitFormula(formula);
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

function numericDerivative(fn, x) {
  const h = Math.max(1e-7, Math.abs(x) * 1e-7);
  const f1 = fn(x + h);
  const f2 = fn(x - h);

  if (!Number.isFinite(f1) || !Number.isFinite(f2)) {
    return NaN;
  }

  return (f1 - f2) / (2 * h);
}

function bisect(fn, low, high, maxIterations = 100) {
  let fLow = fn(low);
  const fHigh = fn(high);

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

function findBracketedRoot(fn) {
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
          const root = bisect(fn, x0, x1);
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

function newtonSolve(fn, initialGuess = 1, maxIterations = 60) {
  let current = initialGuess;

  for (let i = 0; i < maxIterations; i += 1) {
    const value = fn(current);
    if (!Number.isFinite(value)) {
      return null;
    }

    if (Math.abs(value) < EPSILON) {
      return current;
    }

    const derivative = numericDerivative(fn, current);
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

function getEquationByIdentifier(equations, identifier) {
  if (!identifier) {
    return null;
  }

  return equations.find((eq) => eq.name === identifier || eq.formula === identifier) || null;
}

export function listEquations(category) {
  const equations = loadEquations();
  if (!category) {
    return equations;
  }
  return equations.filter((eq) => eq.category === category);
}

export function solveEquation({ equation: equationIdentifier, variables = {}, solveFor }) {
  const equations = loadEquations();
  const equation = getEquationByIdentifier(equations, equationIdentifier);

  if (!equation) {
    throw new Error(`Unknown equation: ${equationIdentifier}`);
  }

  if (!solveFor) {
    throw new Error('solveFor is required.');
  }

  validateInputs(equation, solveFor, variables);

  const numericVariables = Object.fromEntries(
    Object.entries(variables)
      .filter(([name]) => name !== solveFor)
      .map(([name, value]) => [name, Number(value)])
  );

  const fn = createResidualFunction(equation.formula, solveFor, numericVariables);
  let result = findBracketedRoot(fn);

  if (result === null) {
    const guesses = [Number(variables[solveFor]), 0, 1, -1, 10, -10, 100, -100].filter((guess) =>
      Number.isFinite(guess)
    );

    for (const guess of guesses) {
      result = newtonSolve(fn, guess);
      if (result !== null) {
        break;
      }
    }
  }

  if (result === null || !Number.isFinite(result)) {
    throw new Error('No valid solution found.');
  }

  const cleanedResult = Object.is(result, -0) ? 0 : Number(result.toPrecision(12));

  return {
    result: cleanedResult,
    steps: [
      `Selected equation: ${equation.name}`,
      `Formula: ${equation.formula}`,
      `Solve for: ${solveFor}`,
      `Substitutions: ${JSON.stringify(numericVariables)}`,
      `Computed ${solveFor} = ${cleanedResult}`,
    ],
    equation,
  };
}
