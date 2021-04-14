import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('updates.db');

function getManifestRowFromDB({ platform, runtimeVersion }) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM updates WHERE platform = ? AND rtv = ? ORDER BY created_at DESC LIMIT 1',
      [platform, runtimeVersion],
      (err, row) => {
        if (!row) {
          reject('No row!');
          return;
        }

        resolve(row);
      }
    );
  });
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

  const headerKeys = Object.keys(req.headers);
  if (headerKeys.includes('expo-accept-signature')) {
    // Signatures not supported.
    res.statusCode = 400;
    // res.setHeader('expo-manifest-signature-version', 0);
    // res.setHeader('expo-manifest-signature', 'RSA SHA256 signature');
    return;
  }

  const runtimeVersion = req.headers['expo-runtime-version'];

  try {
    let manifestRow = await getManifestRowFromDB({
      platform,
      runtimeVersion,
    });

    const parsedManifestFragment = JSON.parse(manifestRow.manifest_fragment);

    const manifest = {
      id: manifestRow.id,
      createdAt: manifestRow.created_at,
      runtimeVersion: manifestRow.rtv,
      assets: parsedManifestFragment.assets,
      launchAsset: parsedManifestFragment.launchAsset,
      updateMetadata: {
        updateGroup: manifestRow.group_id,
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
  } catch {
    res.statusCode = 404;
  }
};
