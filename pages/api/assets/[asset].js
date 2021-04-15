import fs from 'fs';
import path from 'path';
import mime from 'mime';

export default function assetsEndpoint(req, res) {
  const assetName = req.query.asset;

  if (!assetName) {
    res.statusCode = 400;
    res.json({ error: 'No asset name provided.' });
    res.end();
    return;
  }

  const assetPath = path.resolve('assets', assetName);

  if (!fs.existsSync(assetPath)) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" does not exist.` });
    res.end();
    return;
  }

  try {
    const asset = fs.readFileSync(assetPath, null);

    res.statusCode = 200;
    res.setHeader('content-type', mime.getType(path.extname(assetName)));
    res.end(asset);
  } catch (error) {
    res.statusCode = 500;
    res.json({ error });
    res.end();
  }
}
