const EQUATIONS_PATH = "/backend/data/equations.json";

const categorySelect   = document.getElementById("categorySelect");
const equationSelect   = document.getElementById("equationSelect");
const solveForSelect   = document.getElementById("solveForSelect");
const variableInputs   = document.getElementById("variableInputs");
const formulaDisplay   = document.getElementById("formulaDisplay");
const solveButton      = document.getElementById("solveButton");
const btnLabel         = document.getElementById("btnLabel");
const btnSpinner       = document.getElementById("btnSpinner");
const resultDisplay    = document.getElementById("resultDisplay");
const statusBadge      = document.getElementById("statusBadge");

let equationsCache = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function uniqueCategories(eqs) {
  return [...new Set(eqs.map(e => e.category))].sort();
}

function getEquation(name) {
  return equationsCache.find(e => e.name === name) || null;
}

function setLoading(on) {
  solveButton.disabled = on;
  btnLabel.textContent = on ? "Solving..." : "Solve";
  btnSpinner.classList.toggle("hidden", !on);
}

function setStatus(type, text) {
  statusBadge.textContent = text;
  statusBadge.className = "status-badge " + (type || "");
}

function showIdle(msg) {
  resultDisplay.className = "result-idle";
  resultDisplay.textContent = msg;
  setStatus("", "");
}

function showError(msg) {
  resultDisplay.className = "result-error";
  resultDisplay.textContent = msg;
  setStatus("err", "Error");
}

function showResult(data) {
  setStatus("ok", "Solved");

  const hero = document.createElement("div");
  hero.className = "result-hero";
  hero.innerHTML = `
    <span class="result-var">${escHtml(data.solveFor)}</span>
    <span class="result-eq">=</span>
    <span class="result-val">${escHtml(String(data.result))}</span>
  `;

  const meta = document.createElement("div");
  meta.className = "result-meta";
  [
    ["Equation", data.equation],
    ["Category", data.category],
    ["Formula",  data.formula ?? ""],
  ].forEach(([k, v]) => {
    if (!v) return;
    meta.innerHTML += `
      <div class="meta-row">
        <span class="meta-key">${escHtml(k)}</span>
        <span class="meta-val">${escHtml(v)}</span>
      </div>`;
  });

  const stepsBlock = document.createElement("div");
  stepsBlock.className = "steps-block";
  stepsBlock.innerHTML = `<div class="steps-title">Solution Steps</div>`;
  const ul = document.createElement("ul");
  ul.className = "steps-list";
  (data.steps || []).forEach((s, i) => {
    ul.innerHTML += `<li><span class="step-num">${i + 1}.</span>${escHtml(s)}</li>`;
  });
  stepsBlock.appendChild(ul);

  resultDisplay.className = "result-success";
  resultDisplay.replaceChildren(hero, meta, stepsBlock);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderCategories(cats) {
  categorySelect.innerHTML = cats
    .map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`)
    .join("");
}

function renderEquations(category) {
  const filtered = equationsCache.filter(e => e.category === category);
  equationSelect.innerHTML = filtered
    .map(e => `<option value="${escHtml(e.name)}">${escHtml(e.name)}</option>`)
    .join("");
  if (filtered.length) renderEquationDetails(filtered[0].name);
}

function renderEquationDetails(equationName) {
  const eq = getEquation(equationName);
  if (!eq) {
    formulaDisplay.textContent = "";
    solveForSelect.innerHTML = "";
    variableInputs.innerHTML = "";
    return;
  }

  formulaDisplay.textContent = eq.formula;

  solveForSelect.innerHTML = eq.variables
    .map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`)
    .join("");

  renderVariableInputs(eq, solveForSelect.value);
}

function renderVariableInputs(eq, solveFor) {
  const knowns = eq.variables.filter(v => v !== solveFor);
  variableInputs.innerHTML = "";

  knowns.forEach((v, i) => {
    const wrap = document.createElement("div");
    wrap.className = "var-field";
    wrap.innerHTML = `
      <label for="var_${escHtml(v)}">${escHtml(v)}</label>
      <input
        id="var_${escHtml(v)}"
        type="number"
        step="any"
        placeholder="${(i + 2) * 5}"
        data-var="${escHtml(v)}"
      />
      <span class="hint">numeric value</span>
    `;
    variableInputs.appendChild(wrap);
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadEquations() {
  try {
    const res = await fetch(EQUATIONS_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    equationsCache = await res.json();

    const cats = uniqueCategories(equationsCache);
    renderCategories(cats);
    if (cats.length) renderEquations(cats[0]);

    showIdle(`${equationsCache.length} equations loaded. Select one and click Solve.`);
  } catch (err) {
    showError(`Failed to load equations: ${err.message}`);
  }
}

// ── Solve ─────────────────────────────────────────────────────────────────────

function collectVariables(eq, solveFor) {
  const knowns = eq.variables.filter(v => v !== solveFor);
  const vars = {};
  const errors = [];

  knowns.forEach(v => {
    const input = document.querySelector(`input[data-var="${v}"]`);
    input?.classList.remove("error");

    const raw = input?.value.trim();
    if (raw === "" || raw === undefined) {
      errors.push(`${v} is required`);
      input?.classList.add("error");
      return;
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      errors.push(`${v} must be a valid number`);
      input?.classList.add("error");
      return;
    }

    vars[v] = num;
  });

  return { vars, errors };
}

async function solveCurrentEquation() {
  const eqName   = equationSelect.value;
  const solveFor = solveForSelect.value;
  const eq       = getEquation(eqName);

  if (!eq) { showError("No equation selected."); return; }

  const { vars, errors } = collectVariables(eq, solveFor);
  if (errors.length) { showError(errors.join("\n")); return; }

  setLoading(true);
  try {
    const res = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equation: eqName, solveFor, variables: vars }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    // Normalise response — backend returns equation as object or string
    showResult({
      result:   data.result,
      solveFor: data.solveFor ?? solveFor,
      equation: typeof data.equation === "object"
        ? (data.equation?.name ?? eqName)
        : (data.equation ?? eqName),
      category: typeof data.equation === "object"
        ? (data.equation?.category ?? eq.category)
        : eq.category,
      formula:  typeof data.equation === "object"
        ? (data.equation?.formula ?? eq.formula)
        : eq.formula,
      steps:    data.steps ?? [],
    });
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

categorySelect.addEventListener("change", () => renderEquations(categorySelect.value));

equationSelect.addEventListener("change", () => renderEquationDetails(equationSelect.value));

solveForSelect.addEventListener("change", () => {
  const eq = getEquation(equationSelect.value);
  if (eq) renderVariableInputs(eq, solveForSelect.value);
});

solveButton.addEventListener("click", solveCurrentEquation);

// ── Init ──────────────────────────────────────────────────────────────────────

loadEquations();
