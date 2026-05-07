import { compute } from './_utils/hotreload-helper.js';

export default (req, res) => {
  const a = Number(req.query.a) || 0;
  const b = Number(req.query.b) || 0;
  res.status(200).json({ result: compute(a, b) });
};
