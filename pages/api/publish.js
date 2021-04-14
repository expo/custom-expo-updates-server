import fs from 'fs';

export default async (req, res) => {
  if (req.method !== 'POST') {
    req.statusCode = 400;
    return;
  }

  res.statusCode = 200;
  res.json({ name: 'publish placeholder' });
};
