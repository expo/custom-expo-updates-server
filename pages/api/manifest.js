import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime';
import updates from '../../updates';

function createdDate(filePath) {
  const { birthtime } = fs.statSync(filePath);

  return birthtime;
}

function createHash(file, hasingAlgorithm) {
  return crypto.createHash(hasingAlgorithm).update(file).digest('hex');
}

function getAssetMetadata({ runtimeVersion, channel, updateId, file, ext }) {
  const assetPath = `rtv-${runtimeVersion}/${channel}/${updateId}/${file}`;
  const asset = fs.readFileSync(
    path.resolve(__dirname, `../../updates/${assetPath}`),
    'utf8'
  );
  const extension = ext ? ext : path.extname(file);
  const assetHash = createHash(asset, 'sha256');
  const keyHash = createHash(asset, 'md5');

  return {
    hash: assetHash,
    // TODO: Use the ID (md5 hash of asset) + extension
    key: `${keyHash}.${extension}`,
    contentType: ext ? mime.getType(ext) : mime.getType(path.extname(file)),
    url: `http://localhost:3000/api/assets/${assetPath}`,
  };
}

export default async (req, res) => {
  if (req.method !== 'GET') {
    // Bad method. Expected GET.
    res.statusCode = 400;
    return;
  }

  const platform = req.headers['expo-platform'];

  if (platform !== 'ios' && platform !== 'android') {
    // Unsupported platform. Expected either ios or android.
    res.statusCode = 400;
    return;
  }

  const channel = req.headers['expo-channel-name'];

  if (!channel) {
    // Channel name is required.
    res.statusCode = 400;
    return;
  }

  const runtimeVersion = req.headers['expo-runtime-version'];
  const updateId = updates[`rtv-${runtimeVersion}`][0];
  const updatePath = path.resolve(
    __dirname,
    `../../updates/rtv-${runtimeVersion}/${channel}/${updateId}/metadata.json`
  );
  // here: SELECT ... from sqllight
  const updateMetaData = await import(updatePath);

  if (!updateMetaData) {
    // No update available for given runtime version.
    res.statusCode = 400;
    return;
  }

  const headerKeys = Object.keys(req.headers);
  if (headerKeys.includes('expo-accept-signature')) {
    // Signatures not supported.
    res.statusCode = 400;
    // res.setHeader('expo-manifest-signature-version', 0);
    // res.setHeader('expo-manifest-signature', 'TODO: RSA SHA256 signature');
    return;
  }

  const platformSpecificFileMetaData = updateMetaData.fileMetadata[platform];

  res.statusCode = 200;
  res.setHeader('expo-protocol-version', 0);
  res.setHeader('expo-sfv-version', 0);
  res.setHeader('cache-control', 'private, max-age=0');
  res.setHeader('content-type', 'application/json; charset=utf-8');

  // TODO: likely need to set expo-channel-name or something to branchname=main here?
  res.setHeader('expo-manifest-filters', 'expo-sfv'); // https://github.com/expo/expo/pull/12461/files#diff-614d87057000eaabea63ab796f5900e93015e1d17baf98b15301a16a01fc8f58R90
  res.json({
    id: updateId // generated when run /publish, this platform specific update id,
    createdAt: createdDate(updatePath),
    runtimeVersion: runtimeVersion,
    launchAsset: getAssetMetadata({
      runtimeVersion,
      channel,
      updateId,
      file: platformSpecificFileMetaData.bundle,
    }),
    assets: platformSpecificFileMetaData.assets.map((asset) =>
      getAssetMetadata({
        runtimeVersion,
        channel,
        updateId,
        file: asset.path,
        ext: asset.ext,
      })
    ),
    updateMetadata: {
      updateGroup: '', // genereated when you run /publish, and is update group,
      updateGroupCreatedAt: createdDate(updatePath),
      branchName: '', // when you /publish, you give us a branch name as expo-channel-name
    },
  });
};
