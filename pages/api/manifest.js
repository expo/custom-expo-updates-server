import path from 'path';
import fs from 'fs';
import {
  saveFileAndGetAssetMetadata,
  getMetadataSync,
  convertStringToUUID,
} from '../../common/helpers';

export default async function manifestEndpoint(req, res) {
  const platform = req.headers['expo-platform'];
  const runtimeVersion = req.headers['expo-runtime-version'];
  const channel = req.headers['expo-channel-name'];
  const updateBundlePath = `updates/${runtimeVersion}`;

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.json({ error: 'Expected GET.' });
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    res.statusCode = 400;
    res.json({
      error: 'Unsupported platform. Expected either ios or android.',
    });
    return;
  }

  if (!channel) {
    res.statusCode = 400;
    res.json({ error: 'Channel name is required.' });
    return;
  }

  try {
    const { metadataJson, createdAt, id } = getMetadataSync(updateBundlePath);
    const platformSpecificMetadata = metadataJson.fileMetadata[platform];
    const manifest = {
      id: convertStringToUUID(id),
      createdAt,
      runtimeVersion,
      assets: platformSpecificMetadata.assets.map((asset) =>
        saveFileAndGetAssetMetadata({
          updateBundlePath,
          filePath: asset.path,
          ext: asset.ext,
        })
      ),
      launchAsset: saveFileAndGetAssetMetadata({
        updateBundlePath,
        filePath: platformSpecificMetadata.bundle,
        isLaunchAsset: true,
      }),
      updateMetadata: {
        branchName: channel,
      },
    };

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', 0);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('expo-manifest-filters', `branchname="${channel}"`);
    res.json(manifest);
  } catch (error) {
    res.statusCode = 404;
    res.json({ error });
  }
}
