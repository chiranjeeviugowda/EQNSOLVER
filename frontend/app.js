const EQUATIONS_PATH = "/backend/data/equations.json";

const categorySelect = document.getElementById("categorySelect");
const equationSelect = document.getElementById("equationSelect");
const solveForSelect = document.getElementById("solveForSelect");
const variablesInput = document.getElementById("variablesInput");
const solveButton = document.getElementById("solveButton");
const resultDisplay = document.getElementById("resultDisplay");

let equationsCache = [];

function setResult(text) {
  resultDisplay.textContent = text;
}

function uniqueCategories(equations) {
  return [...new Set(equations.map((e) => e.category))].sort();
}

function renderCategories(categories) {
  categorySelect.innerHTML = categories
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join("");
}

function renderEquations(category) {
  const filtered = equationsCache.filter((eq) => eq.category === category);
  equationSelect.innerHTML = filtered
    .map((eq) => `<option value="${eq.name}">${eq.name}</option>`)
    .join("");

  if (filtered.length > 0) {
    renderSolveFor(filtered[0].name);
  }
}

function renderSolveFor(equationName) {
  const equation = equationsCache.find((eq) => eq.name === equationName);
  if (!equation) {
    solveForSelect.innerHTML = "";
    return;
  }

  solveForSelect.innerHTML = equation.variables
    .map((v) => `<option value="${v}">${v}</option>`)
    .join("");

  const sampleVars = {};
  equation.variables.slice(0, -1).forEach((v, idx) => {
    sampleVars[v] = Number((idx + 2) * 5);
  });
  variablesInput.value = JSON.stringify(sampleVars, null, 2);
}

async function loadEquations() {
  try {
    const response = await fetch(EQUATIONS_PATH);
    if (!response.ok) {
      throw new Error(`Equation load failed (${response.status})`);
    }

    equationsCache = await response.json();
    const categories = uniqueCategories(equationsCache);

    renderCategories(categories);

    if (categories.length > 0) {
      renderEquations(categories[0]);
    }

    setResult(`Loaded ${equationsCache.length} engineering equations.`);
  } catch (error) {
    setResult(`Failed to load equations: ${error.message}`);
  }
}

async function solveCurrentEquation() {
  try {
    const variables = JSON.parse(variablesInput.value || "{}");

    const payload = {
      equation: equationSelect.value,
      solveFor: solveForSelect.value,
      variables,
    };

    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Solve request failed");
    }

    const lines = [
      `Equation: ${result.equation}`,
      `Category: ${result.category}`,
      `Solved for: ${result.solveFor}`,
      `Result: ${result.result}`,
      "",
      "Steps:",
      ...result.steps.map((s, i) => `${i + 1}. ${s}`),
    ];

    setResult(lines.join("\n"));
  } catch (error) {
    setResult(`Error: ${error.message}`);
  }
}

categorySelect.addEventListener("change", () => {
  renderEquations(categorySelect.value);
});

equationSelect.addEventListener("change", () => {
  renderSolveFor(equationSelect.value);
});

solveButton.addEventListener("click", solveCurrentEquation);

loadEquations();
