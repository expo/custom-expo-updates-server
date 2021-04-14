import { createMocks } from 'node-mocks-http';
import handleAssets from '../pages/api/assets/[asset].js';

test('returns asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset:
        '085794d4fc1bfd7f3521393c8519b59f8ce80063b53dcfe9cf19800000e4fd89.png',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('image/png');
});
