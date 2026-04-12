import { solveEquation } from '../backend/services/solver.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const equation = req.body?.equation;
    const solveFor = req.body?.solveFor;
    const variables = req.body?.variables ?? {};

    if (!equation) {
      return res.status(400).json({ error: 'equation is required' });
    }

    if (!solveFor) {
      return res.status(400).json({ error: 'solveFor is required' });
    }

    const solved = solveEquation({ equation, solveFor, variables });

    return res.status(200).json({
      result: solved.result,
      steps: solved.steps,
      equation: solved.equation.name,
      category: solved.equation.category,
      solveFor,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Unable to solve equation',
    });
  }
}
