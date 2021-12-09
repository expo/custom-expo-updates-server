import { convertToDictionary, serializeDictionary } from 'common/structuredFieldValues';
import FormData from 'form-data';
import { NextApiRequest, NextApiResponse } from 'next';

import {
  getAssetMetadataAsync,
  getMetadataAsync,
  getPrivateKeyAsync,
  convertSHA256HashToUUID,
  signRSASHA256,
} from '../../common/helpers';

export default async function manifestEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const platform = req.headers['expo-platform'];
  const runtimeVersion = req.headers['expo-runtime-version'] as string;
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

  try {
    const { metadataJson, createdAt, id } = await getMetadataAsync({
      updateBundlePath,
      runtimeVersion,
    });
    const platformSpecificMetadata = metadataJson.fileMetadata[platform];
    const manifest = {
      id: convertSHA256HashToUUID(id),
      createdAt,
      runtimeVersion,
      assets: await Promise.all(
        (platformSpecificMetadata.assets as any[]).map(async (asset) => {
          return await getAssetMetadataAsync({
            updateBundlePath,
            isLaunchAsset: false,
            filePath: asset.path,
            ext: asset.ext,
            runtimeVersion,
            platform,
          });
        })
      ),
      launchAsset: await getAssetMetadataAsync({
        updateBundlePath,
        filePath: platformSpecificMetadata.bundle,
        isLaunchAsset: true,
        runtimeVersion,
        platform,
        ext: null,
      }),
    };

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', 0);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');

    let signature: string | null = null;
    const acceptSignatureHeader = req.headers['expo-expects-signature'] as string;
    if (acceptSignatureHeader) {
      const privateKey = await getPrivateKeyAsync();
      if (privateKey) {
        const manifestString = JSON.stringify(manifest);
        const hashSignature = signRSASHA256(manifestString, privateKey);
        const dictionary = convertToDictionary({ sig: hashSignature });
        signature = serializeDictionary(dictionary);
      }
    }

    const assetRequestHeaders: { [key: string]: { [key: string]: string } } = {};
    [...manifest.assets, manifest.launchAsset].forEach((asset) => {
      assetRequestHeaders[asset.key] = {
        'test-header': 'test-header-value',
      };
    });

    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: {
        ...(signature ? { 'expo-signature': signature } : {}),
      },
    });
    form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
      contentType: 'application/json',
    });

    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    res.write(form.getBuffer());
    res.end();
  } catch (error) {
    console.error(error);
    res.statusCode = 404;
    res.json({ error });
  }
}
