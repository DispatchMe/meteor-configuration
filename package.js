Package.describe({
  name: 'dispatch:configuration',
  summary: 'App configuration manager with inheritance',
  version: '0.1.7'
});

Package.onUse(function(api) {
  api.use([
    'underscore@1.0.3',
    'templating@1.1.1',
    'check@1.0.5',
    'aldeed:simple-schema@1.3.3',
    'aldeed:collection2@2.5.0',
    'dispatch:bound-document@0.0.2',
    'gfk:underscore-deep@1.0.0'
  ]);

  api.imply('aldeed:simple-schema');

  api.addFiles([
    'lib/configuration.js',
    'lib/user.js'
  ], ['client', 'server']);

  api.addFiles([
    'lib/server/server.js',
    'lib/server/publish.js',
    'lib/server/write.js',
    'lib/server/methods.js',
  ], 'server');

  api.addFiles([
    'lib/client/client.js'
  ], 'client');

  api.export('Configuration');
});

Package.onTest(function(api) {
  api.use('sanjo:jasmine@0.19.0');

  api.use([
    'mongo',
    'tracker',
    'dispatch:configuration',
    'aldeed:simple-schema'
  ]);

  api.addFiles([
    'tests/inheritance.js'
  ]);
  api.addFiles([
    'tests/server-only/bulk.js',
    'tests/server-only/setSchema.js'
  ], 'server');
});
