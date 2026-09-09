import type { NextApiRequest, NextApiResponse } from 'next';

import { artifactViewEnabled, getArtifactReportAsync } from '../../common/artifacts';

export default async function artifactsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (!artifactViewEnabled()) {
    res.status(404).json({ error: 'Artifact view is disabled.' });
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    res.status(405).json({ error: 'Expected GET.' });
    return;
  }
  res.setHeader('cache-control', 'private, max-age=0');
  res.status(200).json(await getArtifactReportAsync());
}
