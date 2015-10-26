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
Configuration.getForEntity = Meteor.wrapAsync(function(type, id, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  options = options || {};

  Meteor.call('dispatch:configuration/getForEntity', type, id, _.omit(options, 'bind'), function (error, configDoc) {
    if (error || !configDoc) {
      callback(error, configDoc);
      return;
    }

    if (options.bind === true) configDoc = new BoundDocument(Configuration.Collection, configDoc);

    callback(null, configDoc.config);
  });
});
