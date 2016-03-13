/* global BoundDocument:false - from dispatch:bound-document */

Configuration.subscription = Meteor.subscribe('__entity_configuration');

/**
 * Get the configuration object for an entity, extended with all inherited values.
 *
 * @param {String} type The type of entity, e.g., 'user'
 * @param {String} id The entity ID (Currently no support for ObjectId)
 * @param {Options} options Additional options
 * @param {Boolean} options.inherit Set to false to retrieve configuration for this entity without going through
 *                                  inheritance
 * @param {Boolean} options.bind Set to true to return a bound document which will automatically update the database
 *                               when modified
 * @param {Function} callback A callback function that receives error, config. If options.bind == true,
 *   non-object properties within it will set into the database using the dispatch:bound-document package
 */
Configuration.getForEntity = function(type, id, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  options = options || {};

  Meteor.call('dispatch:configuration/getForEntity', type, id, _.omit(options, 'bind'), function (error, configDoc) {
    if (error || !configDoc) {
      if(typeof callback === 'function') callback(error, configDoc);
      return;
    }

    if (options.bind === true) configDoc = new BoundDocument(Configuration.Collection, configDoc);

    if(typeof callback === 'function') callback(null, configDoc.config);

  });
};

/**
 * Sets the full configuration document for an entity.
 *
 * This function has two valid signatures:
 * 1) Configuration.setForEntity(type, id, props, callback)
 * 2) Configuration.setForEntity(type, id, props, overwrite, callback)
 *
 *
 * @param {String} type         Entity type
 * @param {String} id           Entity _id
 * @param {Object} props        Config properties, or entire doc if overwrite is true.
 *                              Must be valid according to your schema.
 * @param {Boolean} overwrite   Whether to override all existing config with provided props,
 *                              or to just update the provided props. Applies only when there is an
 *                              existing document
 * @param {Function} [callback] Optional callback
 */
Configuration.setForEntity = function(type, id, props, overwrite, callback) {
  if (typeof overwrite === 'function') {
    callback = overwrite;
    overwrite = false;
  }

  if (!_.contains(Configuration._entityTypes, type)) {
    throw new Error('You must call Configuration.addEntityType to add this entity type first');
  }

  Meteor.call('dispatch:configuration/setForEntity', type, id, props, overwrite, callback);
};

/**
 * Sets the default configuration document.
 *
 * @param {Object} doc Config doc. Must be valid according to your schema.
 * @param {Function} [callback] Optional callback
 */
Configuration.setDefault = function(doc, callback) {
  Meteor.call('dispatch:configuration/setDefault', doc, callback);
};

/**
 * Set the configuration defaults for a particular prefix. Useful for packages
 * that register their own unique configuration
 * @param {String}   prefix   The prefix
 * @param {Object}   data     The default dataa
 * @param {Function} [callback] Optional callback
 */
Configuration.setDefaultForPrefix = function(prefix, data, callback) {
  Meteor.call('dispatch:configuration/setDefaultForPrefix', prefix, data, callback);
};
