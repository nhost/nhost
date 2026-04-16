import { v4 as uuidv4 } from 'uuid';

export default (req, res) => {
  const name = req.query.name || 'world';
  res.status(200).json({ message: `Hello, ${name}!`, requestId: uuidv4() });
};
