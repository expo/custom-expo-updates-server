import fs from 'fs';
import fsPromises from 'fs/promises';
import mime from 'mime';
import { NextApiRequest, NextApiResponse } from 'next';
import nullthrows from 'nullthrows';
import path from 'path';

import {
  getLatestUpdateBundlePathForRuntimeVersionAsync,
  getMetadataAsync,
} from '../../common/helpers';

export default async function assetsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end();
    return;
  }

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

  const assetPath = path.resolve(assetName);
  const assetMetadata = metadataJson.fileMetadata[platform].assets.find(
    (asset: any) => asset.path === assetName.replace(`${updateBundlePath}/`, '')
  );
  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === assetName.replace(`${updateBundlePath}/`, '');

  try {
    const stats = await fsPromises.stat(assetPath);
    const contentType = isLaunchAsset
      ? 'application/javascript'
      : nullthrows(
          mime.getType(assetMetadata.ext),
          `Could not determine mime type for ${assetMetadata.ext}`
        );

    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('content-length', stats.size.toString());

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    // GET request
    const asset = await fsPromises.readFile(assetPath, null);
    res.end(asset);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.statusCode = 404;
      res.json({ error: `Asset "${assetName}" does not exist.` });
      return;
    }
    console.log(error);
    res.statusCode = 500;
    res.json({ error });
  }
}
