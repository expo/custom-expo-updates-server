import fs from 'fs';
import fsPromises from 'fs/promises';
import mime from 'mime';
import { NextApiRequest, NextApiResponse } from 'next';
import nullthrows from 'nullthrows';
import path from 'path';

import {
  generatePatchAsync,
  getLatestUpdateBundlePathForRuntimeVersionAsync,
  getLaunchAssetPathsByUpdateIdAsync,
  getMetadataAsync,
  getUpdateBundlePathsForRuntimeVersionAsync,
} from '../../common/helpers';

export default async function assetsEndpoint(req: NextApiRequest, res: NextApiResponse) {
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

  const enableDiff = req.headers['expo-enable-diff'];
  const currentUpdateId = req.headers['expo-current-update-id'];
  const requestedUpdateId = req.headers['expo-requested-update-id'];
  if (
    enableDiff &&
    typeof currentUpdateId === 'string' &&
    typeof requestedUpdateId === 'string' &&
    currentUpdateId !== requestedUpdateId
  ) {
    const patchPath = path.join('update-diffs', currentUpdateId, requestedUpdateId);
    try {
      await fsPromises.access(patchPath, fs.constants.F_OK);
      const stat = await fsPromises.stat(patchPath);
      console.log('Serving patch:', patchPath, ' Size:', stat.size);
      res.setHeader('Content-Type', 'application/vnd.bsdiff');
      res.setHeader('Content-Length', String(stat.size));
      res.statusCode = 200;
      res.end(await fsPromises.readFile(patchPath, null));
      return;
    } catch {
      // Not found -> fall through to generate
    }
    const paths = await getUpdateBundlePathsForRuntimeVersionAsync(runtimeVersion);
    const launchAssetPathsByUpdateId = await getLaunchAssetPathsByUpdateIdAsync(
      runtimeVersion,
      paths,
      platform,
    );
    const currentLaunchAssetPath = launchAssetPathsByUpdateId[currentUpdateId];
    const requestedLaunchAssetPath = launchAssetPathsByUpdateId[requestedUpdateId];
    if (currentLaunchAssetPath && requestedLaunchAssetPath) {
      const updateDiffsDir = path.join('update-diffs', currentUpdateId);
      try {
        await fsPromises.mkdir(updateDiffsDir, { recursive: true });
      } catch (err) {
        console.error('Failed to ensure update-diffs dir exists:', err);
        res.status(500).json({ error: 'Internal error preparing diff directory.' });
        return;
      }
      const diffFilePath = path.join(updateDiffsDir, requestedUpdateId);
      const { size } = await generatePatchAsync(
        diffFilePath,
        currentLaunchAssetPath,
        requestedLaunchAssetPath,
      );
      console.log('Serving patch:', diffFilePath, ' Size:', size);
      res.setHeader('Content-Type', 'application/vnd.bsdiff');
      res.setHeader('Content-Length', String(size));
      res.statusCode = 200;
      res.end(await fsPromises.readFile(patchPath, null));
      return;
    } else {
      console.log(
        'Could not find launch asset paths for both updates:',
        currentUpdateId,
        requestedUpdateId,
      );
    }
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
    (asset: any) => asset.path === assetName.replace(`${updateBundlePath}/`, ''),
  );
  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === assetName.replace(`${updateBundlePath}/`, '');

  if (!fs.existsSync(assetPath)) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" does not exist.` });
    return;
  }

  try {
    const asset = await fsPromises.readFile(assetPath, null);

    res.statusCode = 200;
    res.setHeader(
      'content-type',
      isLaunchAsset ? 'application/javascript' : nullthrows(mime.getType(assetMetadata.ext)),
    );
    res.end(asset);
  } catch (error) {
    console.log(error);
    res.statusCode = 500;
    res.json({ error });
  }
}
