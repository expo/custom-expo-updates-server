const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const crypto = require('crypto');
const mime = require('mime');
const sqlite3 = require('sqlite3').verbose();

const expoUpdateBundlePath = process.argv[2];
const runtimeVersion = process.argv[3];

// 1. load files from the bundle.
if (!expoUpdateBundlePath) {
  throw new Error(
    'You must provide a path to a previously bundled Expo update as an argument to this command.\nExample:\n\nyarn publish ../my-app/dist 1\n\n'
  );
}

if (!runtimeVersion) {
  throw new Error(
    'You must provide a runtime version as an argument to this command.\nExample:\n\nyarn publish ../my-app/dist 1\n\n'
  );
}

const resolvedPath = path.resolve(
  __dirname,
  expoUpdateBundlePath,
  'metadata.json'
);
const metadataJSONExists = fs.existsSync(resolvedPath);

if (!metadataJSONExists) {
  throw new Error(
    'There is no metadata.json file at this path. Please provide a path to an Expo update you created with "expo export --experimental-bundle --force".'
  );
}

const metadataJSONFile = require(resolvedPath);

if (metadataJSONFile.bundler !== 'metro') {
  throw new Error('Only bundles created with Metro are currently supported.');
}

const db = new sqlite3.Database('updates.db');

db.run(
  'CREATE TABLE IF NOT EXISTS updates(id TEXT, rtv TEXT, platform TEXT, created_at TEXT, group_id TEXT, manifest_fragment TEXT)'
);

const updateGroupId = uuid.v4();
const createdAt = new Date().toISOString();

db.serialize(() => {
  ['ios', 'android'].map((platform) => {
    const launchAssetLocation = metadataJSONFile.fileMetadata[platform].bundle;
    const assetsLocation = metadataJSONFile.fileMetadata[platform].assets;

    function createHash(file, hashingAlgorithm) {
      return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
    }

    function saveFileAndGetAssetMetadata({ filePath, ext, isLaunchAsset }) {
      const assetFilePath = path.resolve(
        __dirname,
        expoUpdateBundlePath,
        filePath
      );
      const asset = fs.readFileSync(assetFilePath, null);
      const assetHash = createHash(asset, 'sha256');
      const keyHash = createHash(asset, 'md5');
      const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
      const urlExtensionSuffix = ext ? `.${ext}` : '';
      const contentType = isLaunchAsset
        ? 'application/javascript'
        : mime.getType(ext);
      const assetNameHash = createHash(`${asset}${contentType}`, 'sha256');
      const formattedAssetFileName = `${assetNameHash}.${mime.getExtension(
        contentType
      )}`;

      fs.writeFileSync(
        `./assets/${formattedAssetFileName}`,
        asset,
        (err, data) => {
          console.log({ err, data });
        }
      );

      return {
        hash: assetHash,
        key: `${keyHash}.${keyExtensionSuffix}`,
        contentType,
        url: `http://localhost:3000/api/assets/${formattedAssetFileName}`,
      };
    }

    const manifestFragment = {
      launchAsset: saveFileAndGetAssetMetadata({
        filePath: launchAssetLocation,
        isLaunchAsset: true,
      }),
      assets: assetsLocation.map((asset) =>
        saveFileAndGetAssetMetadata({
          filePath: asset.path,
          ext: asset.ext,
        })
      ),
    };

    const updateId = uuid.v4();

    db.run(
      `INSERT INTO updates(id, rtv, platform, created_at, group_id, manifest_fragment) VALUES(?, ?, ?, ?, ?, ?)`,
      [
        updateId,
        runtimeVersion,
        platform,
        createdAt,
        updateGroupId,
        JSON.stringify(manifestFragment),
      ],
      function (err) {
        if (err) {
          return console.log(err.message);
        }

        console.log(
          `✅ Successfully added update\nPlatform: ${platform}\nRTV: ${runtimeVersion}\nGroup ID: ${updateGroupId}\nUpdate ID: ${updateId}\nCreated At: ${createdAt}\n\n`
        );
      }
    );
  });
});

db.close();
