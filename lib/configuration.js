/* global SimpleSchema:false - from aldeed:simple-schema */

Configuration = new EventEmitter();

Configuration.Collection = new Mongo.Collection('entity_configuration');

// This is done as a function for use in testing
Configuration._reset = function() {
  Configuration._entityTypes = [];
  Configuration._entityTypeInherits = {};
  Configuration._entityTypePublish = {};
  Configuration._entityTypeWrite = {};
  Configuration._entityTypeForbiddenFields = {};
};
Configuration._reset();

/**
 * Go through each property in a SimpleSchema and make it optional
 * (because all configuration settings are optional so we can do inheritance)
 * @param  {SimpleSchema} simpleSchema
 * @return {SimpleSchema}
 */
function makeSchemaOptional(simpleSchema) {
  var schema = simpleSchema.schema();
  for (var key in schema) {
    if (schema.hasOwnProperty(key)) {
      var prop = schema[key];
      prop.optional = true;
    }
  }
  return new SimpleSchema(schema);
}

/**
 * Set the configuration object schema.
 *
 * @param {SimpleSchema} simpleSchema
 */
Configuration.setSchema = function(simpleSchema) {
  Configuration._schema = simpleSchema = makeSchemaOptional(simpleSchema);
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

  ss.addValidator(function() {
    if (this.isFromTrustedCode) return;

    ss.messages({
      '_config_forbidden': '[label] cannot be overridden for the ' + type + ' entity type'
    });

    // Extract type from the ID
    var id = this.docId;
    if (typeof id !== 'string') return '_config_forbidden';
    if (id === '_default') return;

    // We are assuming that entity IDs will never have an underscore, which is pretty safe
    var type = id.match(/^.*(?=_)/);
    var forbidden = Configuration._entityTypeForbiddenFields[type];
    if (!forbidden) return '_config_forbidden';

    function keyIsForbidden(key) {
      return _.any(forbidden, function(forbiddenKey) {
        return forbiddenKey === key || key.indexOf(forbiddenKey + '.') > -1;
      });
    }

    if (this.isSet && keyIsForbidden(this.key)) {
      return '_config_forbidden';
    }
  });

  Configuration.Collection.attachSchema(ss, {
    replace: true
  });
};

/**
 * Set the schema for a specific nested prefix. Useful for other packages to define their own configuration
 * using a unique prefix
 * @param {String} prefix       The prefix
 * @param {SimpleSchema} simpleSchema The schema to use for that property
 */
Configuration.setSchemaForPrefix = function(prefix, prefixSchema) {
  var schema;
  if (Configuration._schema) {
    schema = Configuration._schema.schema();
  } else {
    schema = {};
  }

  if (prefixSchema instanceof SimpleSchema) prefixSchema = prefixSchema.schema();
  for (var k in prefixSchema) {
    if (prefixSchema.hasOwnProperty(k)) {
      schema[prefix + '.' + k] = prefixSchema[k];
    }
  }

  Configuration.setSchema(new SimpleSchema(schema));
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
Configuration.addEntityType = function(type, options) {
  check(type, String);
  check(options, Match.Optional(Match.ObjectIncluding({
    inherit: Match.Optional(Match.OneOf('default', Function)),
    write: Match.Optional(Function),
    publish: Match.Optional(Function)
  })));

  // If options is undefined, just set it to a blank object so we don't get "cannot read property of undefined"
  // errors below
  options = options || {};

  // It's OK to call this twice and redefine an entity type, but we don't want
  // to add it to the entityTypes list again in that case.
  if (!_.contains(Configuration._entityTypes, type)) {
    Configuration._entityTypes.push(type);
  }

  Configuration._entityTypeForbiddenFields[type] = options.cannotOverride || [];

  // Some of these things are only used in server code
  if (Meteor.isServer) {
    Configuration._entityTypePublish[type] = options.publish || _.constant(undefined);
    Configuration._entityTypeWrite[type] = options.write || _.constant(true);

    var inherit = options.inherit || 'default';
    // If it's the string "default", we change to a function that returns "default" for consistency
    if (inherit === 'default') inherit = _.constant('default');
    Configuration._entityTypeInherits[type] = inherit;
  }

  // Add a convenience function
  Configuration[type] = Meteor.wrapAsync(function(id, options, callback) {
    return Configuration.getForEntity(type, id, options, callback);
  });
};

/**
 * Returns the default configuration document, as last passed to `Configuration.setDefault`
 * @returns {Object} Config doc. Must be valid according to your schema.
 */
Configuration.getDefault = function(bind) {
  var queryOptions = bind ? {
    bind: true
  } : {};
  var configDoc = Configuration.Collection.findOne('_default', queryOptions);
  return configDoc && configDoc.config;
};

Configuration.hasDefault = function() {
  return Configuration.Collection.find('_default').count() === 1;
};

/**
 * Has a default been defined for this prefix?
 * @param  {String}  prefix
 * @return {Boolean}
 */
Configuration.hasDefaultForPrefix = function(prefix) {
  if (!Configuration.hasDefault()) {
    return false;
  }
  var def = Configuration.getDefault();
  if (!def) {
    return false;
  }

  return def.hasOwnProperty(prefix);
};



/* Meteor uses old underscore, so add _.constant */
_.constant = function(value) {
  return function() {
    return value;
  };
};
