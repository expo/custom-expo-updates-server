import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('updates.db');

function getManifestRowFromDB({ platform, runtimeVersion }) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM updates WHERE platform = ? AND rtv = ? ORDER BY created_at DESC LIMIT 1',
      [platform, runtimeVersion],
      (err, row) => {
        if (!row) {
          reject(
            `No manifest found with platform "${platform}" and rtv "${runtimeVersion}"`
          );
          return;
        }

        resolve(row);
      }
    );
  });
}

export default async function manifestEndpoint(req, res) {
  const platform = req.headers['expo-platform'];
  const runtimeVersion = req.headers['expo-runtime-version'];
  const channel = req.headers['expo-channel-name'];

  if (req.method !== 'GET') {
    res.statusCode = 400;
    res.json({ error: 'Bad method. Expected GET.' });
    res.end();
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    res.statusCode = 400;
    res.json({
      error: 'Unsupported platform. Expected either ios or android.',
    });
    res.end();
    return;
  }

  if (!channel) {
    res.statusCode = 400;
    res.json({ error: 'Channel name is required.' });
    res.end();
    return;
  }

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
  } catch (error) {
    res.statusCode = 404;
    res.json({ error });
    res.end();
  }
}
