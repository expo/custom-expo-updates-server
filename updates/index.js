import path from 'path';

export default {
  'rtv-1': [
    {
      id: 'id-1',
      main: 'rtv-1/id-1/metadata.json',
      // main: `.${path.resolve(
      //   __dirname,
      //   '../updates/rtv-1/id-1/metadata.json'
      // )}`,
    },
  ],
  'rtv-2': [
    {
      'id-1': `.${path.resolve(
        __dirname,
        '../updates/rtv-2/id-1/metadata.json'
      )}`,
    },
  ],
};
