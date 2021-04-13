import { createMocks } from 'node-mocks-http';
import handleManifest from '../pages/api/manifest';

test('returns 400 with POST request', async () => {
  const { req, res } = createMocks({ method: 'POST' });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});
