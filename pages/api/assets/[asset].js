import fs from 'fs';
import path from 'path';
import mime from 'mime';

export default (req, res) => {
  const assetName = req.query.asset;
  const assetPath = path.resolve('assets', assetName);

  if (!assetName) {
    // No asset name provided
    res.statusCode = 400;
    return;
  }

  const assetExists = fs.existsSync(assetPath);

  if (!assetExists) {
    // Asset does not exist
    res.statusCode = 400;
    return;
  }

  const asset = fs.readFileSync(assetPath, null);

  res.statusCode = 200;
  res.setHeader('content-type', mime.getType(path.extname(assetName)));
  res.end(asset);
};
