const express = require('express');

function createSolveRouter(solver) {
  const router = express.Router();

  router.post('/solve', (req, res) => {
    try {
      const equation = req.body.equation || req.body.equation_name;
      const solveFor = req.body.solveFor || req.body.solve_for;
      const variables = req.body.variables || {};

      if (!equation) {
        return res.status(400).json({ detail: 'equation is required' });
      }

      if (!solveFor) {
        return res.status(400).json({ detail: 'solveFor (or solve_for) is required' });
      }

      const solved = solver.solve({ equation, solveFor, variables });

      return res.json({
        equation: solved.equation.name,
        equation_name: solved.equation.name,
        category: solved.equation.category,
        solve_for: solveFor,
        result: solved.result,
        steps: solved.steps,
      });
    } catch (error) {
      return res.status(400).json({ detail: error.message });
    }
  });

  return router;
}

module.exports = {
  createSolveRouter,
};
