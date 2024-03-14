import fs from 'fs';
import mime from 'mime';
import { Request, Response, NextFunction } from 'express';
import nullthrows from 'nullthrows';
import path from 'path';

import {
  getMetadataAsync,
  getAssetPathAsync,
  getLatestUpdateBundlePathForRuntimeVersionAsync,
} from '../common/helpers';

export default async function assetsEndpoint(req: Request, res: Response, next: NextFunction = ()=>{}) {
  const { asset: assetName, runtimeVersion, platform } = req.query;

  if (!assetName || typeof assetName !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No asset name provided.' });
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    res.statusCode = 400;
    res.json({ error: 'No platform provided. Expected "ios" or "android".' });
    return;
  }

  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No runtimeVersion provided.' });
    return;
  }

  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  } catch (error: any) {
    res.statusCode = 404;
    res.json({
      error: error.message,
    });
    return;
  }

  const { metadataJson } = await getMetadataAsync({
    updateBundlePath,
    runtimeVersion,
  });

  const assetPath = await getAssetPathAsync(assetName);
  const assetMetadata = metadataJson.fileMetadata[platform].assets.find(
    (asset: any) => asset.path === assetName.replace(`${updateBundlePath}/`, '')
  );
  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === assetName.replace(`${updateBundlePath}/`, '');

  if (!fs.existsSync(assetPath)) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" does not exist.` });
    return;
  }

  try {
    const asset = fs.readFileSync(assetPath, null);

    res.statusCode = 200;
    res.setHeader(
      'content-type',
      isLaunchAsset ? 'application/javascript' : nullthrows(mime.getType(assetMetadata.ext))
    );
    res.end(asset);
  } catch (error) {
    res.statusCode = 500;
    res.json({ error });
  }

}
