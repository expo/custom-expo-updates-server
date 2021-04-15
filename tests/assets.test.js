import { createMocks } from 'node-mocks-http';
import handleAssets from '../pages/api/assets/[asset].js';

test('returns asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset:
        '16a405335608716d01677acba7587812ec11e226ade1bcfbbd28e8cae2715a64.js',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('application/javascript');
});

test('returns 404 when asset does not exist', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: 'does-not-exist.png',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(404);
});

test('returns 400 with no asset name', async () => {
  const { req, res } = createMocks({
    method: 'GET',
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(400);
});
