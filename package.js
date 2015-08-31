Package.describe({
  name: 'dispatch:configuration',
  summary: 'App configuration manager with inheritance',
  version: '0.0.1'
});

Package.onUse(function (api) {
  api.use([
    'underscore',
    'templating',
    'check',
    'aldeed:simple-schema',
    'aldeed:collection2',
    'aldeed:autoform',
    'dispatch:bound-document',
    'gfk:underscore-deep'
  ]);

  api.imply('aldeed:simple-schema');

  api.addFiles([
    'lib/configuration.js',
    'lib/user.js'
  ], ['client', 'server']);

  api.addFiles([
    'lib/server/publish.js',
    'lib/server/write.js'
  ], 'server');

  api.addFiles([
    'lib/client/client.js',
    'lib/client/editForm.html',
    'lib/client/editForm.js'
  ], 'client');

  api.export('Configuration');
});

Package.onTest(function (api) {
  api.use('sanjo:jasmine@0.16.4');

  api.use([
    'dispatch:configuration'
  ]);

  api.addFiles([
    'tests.js'
  ]);
});
