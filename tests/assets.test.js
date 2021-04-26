import { createMocks } from 'node-mocks-http';
import handleAssets from '../pages/api/assets';

test('returns asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      contentType: 'image/jpeg',
      asset: 'updates/1/assets/489ea2f19fa850b65653ab445637a181',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('image/jpeg');
});

test('returns 404 when asset does not exist', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: 'updates/1/assets/does-not-exist.png',
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
