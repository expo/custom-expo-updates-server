import fs from 'fs';
import path from 'path';
import mime from 'mime';

export default function assetsEndpoint(req, res) {
  const assetName = req.query.asset;
  const contentType = req.query.contentType;

  if (!assetName) {
    res.statusCode = 400;
    res.json({ error: 'No asset name provided.' });
    return;
  }

  const assetPath = path.resolve(assetName);

  if (!fs.existsSync(assetPath)) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" does not exist.` });
    return;
  }

  try {
    const asset = fs.readFileSync(assetPath, null);

    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.end(asset);
  } catch (error) {
    res.statusCode = 500;
    res.json({ error });
  }
}
