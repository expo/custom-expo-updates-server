// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import fs from 'fs';
import path from 'path';
import updates from '../../updates';

function createdDate(filePath) {
  const { birthtime } = fs.statSync(filePath);

  return birthtime;
}

export default async (req, res) => {
  if (req.method === 'GET') {
    res.statusCode = 200;

    const platform = req.headers['expo-platform'];
    const runtimeVersion = req.headers['expo-runtime-version'];
    const updatePath = updates[`rtv-${runtimeVersion}`][0].main;

    // TODO: figure out how to import this correctly.
    // const updateMetaData = await import(
    //   `.${path.resolve(__dirname, updatePath)}`
    // );
    const updateMetaData = await import(
      '../../updates/rtv-1/id-1/metadata.json'
    );

    console.log({ updatePath, updateMetaData });

    if (!updatePath) {
      throw new Error('No update for given expo-runtime-version.');
    }

    if (platform !== 'ios' && platform !== 'android') {
      throw new Error("Invalid platform. Expected 'ios' or 'android'.");
    }

    // Get the runtime version requested
    // then go into updates/index.js and find the corresponding path
    // then load that update

    const headerKeys = Object.keys(req.headers);

    if (headerKeys.includes('expo-accept-signature')) {
      res.setHeader('expo-manifest-signature-version', 0);
      res.setHeader('expo-manifest-signature', 'TODO: RSA SHA256 signature');
    }

    res.setHeader('expo-protocol-version', 0);
    res.setHeader('expo-sfv-version', 0);

    // TODO: likely need to set expo-channel-name or something to branchname=main here?
    res.setHeader('expo-manifest-filters', 'expo-sfv'); // https://github.com/expo/expo/pull/12461/files#diff-614d87057000eaabea63ab796f5900e93015e1d17baf98b15301a16a01fc8f58R90
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', 'application/json; charset=utf-8');

    res.json({
      id: '1',
      // createdAt: createdDate(
      //   `.${path.resolve(__dirname, '../../dist/metadata.json')}`
      // ),
      runtimeVersion: '',
      launchAsset: { hash: '', key: '', contentType: '', url: '' },
      assets: [
        {
          hash: '',
          key: '',
          contentType: '',
          url: '',
        },
      ],
      updateMetadata: {
        updateGroup: '',
        updateGroupCreatedAt: 'date',
        branchName: '',
      },
    });
  } else {
    res.statusCode = 400;
  }
};
