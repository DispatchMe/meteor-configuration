/* global SimpleSchema:false - from aldeed:simple-schema */
/* global BoundDocument:false - from dispatch:bound-document */

Configuration = {};

Configuration.Collection = new Mongo.Collection('entity_configuration');

// This is done as a function for use in testing
Configuration._reset = function () {
  Configuration._entityTypes = [];
  Configuration._entityTypeInherits = {};
  Configuration._entityTypePublish = {};
  Configuration._entityTypeWrite = {};
  Configuration._entityTypeForbiddenFields = {};
};
Configuration._reset();

/**
 * Set the configuration object schema.
 *
 * @param {SimpleSchema} simpleSchema
 */
Configuration.setSchema = function (simpleSchema) {
  Configuration._schema = simpleSchema;

  var ss = new SimpleSchema({
    _id: {
      type: String
    },
    entityType: {
      type: String
    },
    entityId: {
      type: String
    },
    config: {
      type: simpleSchema,
      optional: true
    }
  });

  ss.addValidator(function () {
    if (this.isFromTrustedCode) return;

    // Extract type from the ID
    var id = this.docId;
    if (typeof id !== 'string') return '_config_forbidden';
    if (id === '_default') return;

    // We are assuming that entity IDs will never have an underscore, which is pretty safe
    var type = id.match(/^.*(?=_)/);
    var forbidden = Configuration._entityTypeForbiddenFields[type];
    if (!forbidden) return '_config_forbidden';

    function keyIsForbidden(key) {
      return _.any(forbidden, function (forbiddenKey) {
        return forbiddenKey === key || key.indexOf(forbiddenKey + '.') > -1;
      });
    }

    ss.messages({
      '_config_forbidden': '[label] cannot be overridden for the ' + type + ' entity type'
    });

    if (this.isSet && keyIsForbidden(this.key)) {
      return '_config_forbidden';
    }
  });

  Configuration.Collection.attachSchema(ss, {replace: true});
};

/**
 * Add a custom entity type. Can also be called with type 'user' to change the default user type.
 *
 * Also adds a convenience function: Configuration[type](id, options)
 *
 * @param {String} type    Any string that identifies the type of entity, e.g., user, organization, account, group
 * @param {Object} [options]
 * @param {Function|String} [options.inherit] Returns [entityType, entityId] to inherit from
 *   or "default". Receives the entityId as first argument and any options you pass to
 *   `getForEntity` are provided as the second argument, allowing you to do complex
 *   inheritance based on calling context if necessary.
 * @param {Function} [options.write] Gets the userId and entityId and returns true or false
 *   to allow or disallow updating it from the client
 * @param {Function} [options.publish] Gets the userId and returns the entityId or array of
 *   entityIds that should be published for this type, or returns undefined for none
 * @param {String[]} [options.cannotOverride] List of fields in the schema that cannot
 *   be overridden (must inherit) for this entity type
 */
Configuration.addEntityType = function (type, options) {
  check(type, String);
  check(options, Match.Optional(Match.ObjectIncluding({
    inherit: Match.Optional(Match.OneOf('default', Function)),
    write: Match.Optional(Function),
    publish: Match.Optional(Function)
  })));

  Configuration._entityTypes.push(type);
  Configuration._entityTypePublish[type] = options.publish || _.constant(undefined);
  Configuration._entityTypeWrite[type] = options.write || _.constant(true);
  Configuration._entityTypeForbiddenFields[type] = options.cannotOverride || [];

  var inherit = options.inherit || 'default';
  // If it's the string "default", we change to a function that returns "default" for consistency
  if (inherit === 'default') inherit = _.constant('default');
  Configuration._entityTypeInherits[type] = inherit;

  // Add a convenience function
  Configuration[type] = function (id, options) {
    return Configuration.getForEntity(type, id, options);
  };
};

Configuration._resolveInheritance = function (type, id, options) {
  var requestedTypeInheritFunction = Configuration._entityTypeInherits[type];
  var whatToInherit = requestedTypeInheritFunction ? requestedTypeInheritFunction(id, options) : 'default';
  var extendList = [];
  while (whatToInherit !== 'default') {
    // whatToInherit should be [entityType, entityId]
    // TODO should support ObjectId
    check(whatToInherit, [String, String]);

    extendList.push(whatToInherit);

    // Next level
    requestedTypeInheritFunction = Configuration._entityTypeInherits[whatToInherit[0]];
    whatToInherit = requestedTypeInheritFunction ? requestedTypeInheritFunction(whatToInherit[1], options) : 'default';
  }
  return extendList;
};

/**
 * Get the configuration object for an entity, extended with all inherited values.
 *
 * @param   {String}   type    The type of entity, e.g., 'user'
 * @param   {String}   id      The entity ID (Currently no support for ObjectId)
 * @param   {Object}   options The `inherit: false` option will give you just the pure
 *   entity configuration object without inheriting. Any other options you pass are
 *   passed to the type's `inherit` function to allow context-specific inheritance logic.
 * @returns {Object} A configuration object. Non-object properties within it will set into
 *   the database using the dispatch:bound-document package
 */
Configuration.getForEntity = function (type, id, options) {
  var configDoc;

  options = options || {};

  // If inherit is explicitly false, we only want the actual config for this entity.
  if (options.inherit === false) {
    configDoc = Configuration.Collection.findOne(type + '_' + id, {bind: true});
    return configDoc && configDoc.config;
  }

  // Otherwise start with default or empty
  configDoc = Configuration.Collection.findOne('_default') || {};

  var extendList = Configuration._resolveInheritance(type, id, options);

  // Then extend with inherited types in reverse order
  for (var i = extendList.length - 1; i > 0; i--) {
    _.deepExtend(configDoc, Configuration.Collection.findOne(extendList[i][0] + '_' + extendList[i][1]), true);
  }

  // And finally extend with the actual requested type
  _.deepExtend(configDoc, Configuration.Collection.findOne(type + '_' + id), true);

  // Because of all the extending we've done, we could not use
  // bind: true in the findOne calls or various props would be
  // bound to various doc IDs. We want all props bound to the requested
  // ID regardless of where the values came from.
  //
  // Also, the `_id` at this point should be the requested type ID, but
  // if the requested type does not exist yet, it will be some other ID,
  // so we will set it here. This is why we use specific _id instead of
  // random.
  configDoc._id = type + '_' + id;
  configDoc = new BoundDocument(Configuration.Collection, configDoc);

  return configDoc.config;
};

/**
 * Sets the full configuration document for an entity.
 *
 * @param {String} type Entity type
 * @param {String} id   Entity _id
 * @param {Object} doc  Config doc. Must be valid according to your schema.
 * @param {Function} [callback] Optional callback for the insert or update call.
 */
Configuration.setForEntity = function (type, id, doc, callback) {
  if (!_.contains(Configuration._entityTypes, type)) {
    throw new Error('You must call Configuration.addEntityType to add this entity type first');
  }

  // Since this can be called in client code, we do not use upsert.
  var exists = !!Configuration.Collection.findOne(type + '_' + id, {
    fields: {
      _id: 1
    }
  });

  if (exists) {
    Configuration.Collection.update({
      _id: type + '_' + id
    }, {
      $set: {
        config: doc
      }
    }, callback);
  } else {
    Configuration.Collection.insert({
      _id: type + '_' + id,
      entityType: type,
      entityId: id,
      config: doc
    }, callback);
  }
};

/**
 * Sets the default configuration document.
 *
 * @param {Object} doc Config doc. Must be valid according to your schema.
 * @param {Function} [callback] Optional callback for the insert or update call.
 */
Configuration.setDefault = function (doc, callback) {
  // Since this can be called in client code, we do not use upsert.
  var exists = !!Configuration.Collection.findOne('_default', {
    fields: {
      _id: 1
    }
  });

  if (exists) {
    Configuration.Collection.update({
      _id: '_default'
    }, {
      $set: {
        config: doc
      }
    }, callback);
  } else {
    Configuration.Collection.insert({
      _id: '_default',
      entityType: '_default',
      entityId: '_default',
      config: doc
    }, callback);
  }
};

/**
 * Returns the default configuration document, as last passed to `Configuration.setDefault`
 * @returns {Object} Config doc. Must be valid according to your schema.
 */
Configuration.getDefault = function () {
  var configDoc = Configuration.Collection.findOne('_default', {bind: true});
  return configDoc && configDoc.config;
};

/* Meteor uses old underscore, so add _.constant */
_.constant = function(value) {
  return function() {
    return value;
  };
};
