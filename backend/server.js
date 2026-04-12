const express = require('express');
const cors = require('cors');

const { EquationSolver } = require('./services/solver');
const { createSolveRouter } = require('./routes/solve');

const app = express();
const solver = new EquationSolver();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/equations', (req, res) => {
  const category = req.query.category;
  const equations = solver.listEquations(category);

  res.json({
    count: equations.length,
    categories: solver.listCategories(),
    equations,
  });
});

app.use('/', createSolveRouter(solver));

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Node solver API listening on http://127.0.0.1:${port}`);
});
