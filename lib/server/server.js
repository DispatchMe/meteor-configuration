/* global MongoObject:false = from aldeed:simple-schema */


/**
 * Figure out list of entities to extend from based on the inherit() function on each entity
 * definition.
 *
 * @param  {String} type    entity type
 * @param  {String} id      entity ID
 * @param  {Object} options arbitrary options to pass to inherit() function for context
 * @return {Array}          Array of arrays, like this: [["<entity>", "<id>"], ["<entity>", "<id>"]]
 */
Configuration._resolveInheritance = function(type, id, options) {
  var requestedTypeInheritFunction = Configuration._entityTypeInherits[type];
  var whatToInherit = requestedTypeInheritFunction ? requestedTypeInheritFunction(id, options) : 'default';
  var extendList = [];
  while (whatToInherit !== 'default') {
    // whatToInherit should be [entityType, entityId]
    // TODO should support ObjectId
    // Check doesn't support [String,String] so we assert the length afterwards
    check(whatToInherit, [String]);
    if (whatToInherit.length !== 2) {
      throw new Error('Inherit function must return an array of ["<type>", "<id>"]');
    }

    extendList.push(whatToInherit);

    // Next level
    requestedTypeInheritFunction = Configuration._entityTypeInherits[whatToInherit[0]];
    whatToInherit = requestedTypeInheritFunction ? requestedTypeInheritFunction(whatToInherit[1], options) :
      'default';
  }
  return extendList;
};

/**
 * Extend an entity given a list of configuration documents to extend from.
 *
 * This is used by both Configuration.getForEntity and Configuration.getForEntities (bulk)
 *
 * @param  {String} type       The type of entity
 * @param  {String} id         The entity ID
 * @param  {Array} extendList  Result of Configuration._resolveInheritance
 * @param  {Object} cache      If provided, is expected to be key/value pairs of id:document.
 *                             Used by getForEntities to avoid multiple unnecessary queries
 * @return {Object}            The resulting document
 */
Configuration._extendEntity = function(type, id, extendList, cache) {
  // Otherwise start with default or empty
  var configDoc = Configuration.Collection.findOne('_default') || {};

  // Then extend with inherited types in reverse order
  var extendId;
  var doc;
  for (var i = extendList.length - 1; i >= 0; i--) {
    doc = null;
    extendId = extendList[i][0] + '_' + extendList[i][1];
    if (cache) {
      doc = cache[extendId];
      if (!doc) {
        console.warn('Cache provided but key %s is not in the cache!', extendId);
      }

    }

    // Failsafe here to find it if it's not in the cache
    if (!doc) {
      doc = Configuration.Collection.findOne(extendId);
      // Add it to the cache so we can reuse it later, if we need it
      if (cache) {
        cache[extendId] = doc;
      }

    }
    _.deepExtend(configDoc, doc, true);
  }

  // And finally extend with the actual requested type
  var mainDoc;
  var mainId = type + '_' + id;
  if (cache) {
    mainDoc = cache[mainId];
  }
  if (!mainDoc) {
    mainDoc = Configuration.Collection.findOne(mainId);
  }
  _.deepExtend(configDoc, mainDoc, true);

  // Because of all the extending we've done, we could not use
  // bind: true in the findOne calls or various props would be
  // bound to various doc IDs. We want all props bound to the requested
  // ID regardless of where the values came from.
  //
  // Also, the `_id` at this point should be the requested type ID, but
  // if the requested type does not exist yet, it will be some other ID,
  // so we will set it here. This is why we use specific _id instead of
  // random.
  configDoc._id = mainId;

  return configDoc;
};

/**
 * Match up the array indices for the input and output of a bulk retrieval function. Results
 * will have the same index as their entity request. If there is no result for an entity request,
 * the array's element at that index will be an empty object
 *
 * @param  {Array} entities Array of entity objects with "type" and "id" properties
 * @param  {Array} results  Documents retrieved from Configuration.Collection
 * @return {Array}          Array with potential blank ({}) elements if the config was not found
 */
var matchBulkIndices = function(entities, results) {
  var fixedArray = [];

  var result;
  entities.forEach(function(entity) {
    result = _.findWhere(results, {
      _id: entity[0] + '_' + entity[1]
    });
    if (result) {
      fixedArray.push(result.config);
    } else {
      fixedArray.push({});
    }
  });

  return fixedArray;
};

/**
 * Retrieve the configuration for multiple entities, optimized to perform minimal database queries
 *
 * @param  {Array<Object>} entities Array of entity tuples consisting of ["<type>", "<id>"] elements
 * @param  {Options} options  The `inherit: false` option will give you just the pure entity
 *                            configuration object without inheriting. Any other options you
 *                            pass are passed to the type's `inherit` function to allow
 *                            context-specific inheritance logic.
 * @return {Array}            Array of resolved configuration objects. The indices are the same as the
 *                            provided entities array.
 */
Configuration.getForEntities = function(entities, options) {
  options = options || {};
  check(entities, [
    [String]
  ]);

  var ids = entities.map(function(entity) {
    return entity[0] + '_' + entity[1];
  });

  // If inherit is explicitly false, we only want the actual configs for these entities.
  if (options.inherit === false) {
    return matchBulkIndices(entities, Configuration.Collection.find({
      _id: {
        $in: ids
      }
    }).fetch());
  }

  // Get a unique list of configuration docs to find based on the resolved inheritance trees for each
  // of the provided entities
  var inheritanceTrees = [];
  var docsToFindById = [];
  entities.forEach(function(entity) {
    var extendList = Configuration._resolveInheritance(entity[0], entity[1], options);
    inheritanceTrees.push(extendList);
    // We want to find this one, in addition to all the things it needs to inherit from.
    docsToFindById.push(entity[0] + '_' + entity[1]);
    extendList.forEach(function(extend) {
      docsToFindById.push(extend[0] + '_' + extend[1]);
    });
  });

  // Find all the inherited docs and store them by ID in a map to pass to _extendEntity as the cache
  var documentCache = {};
  Configuration.Collection.find({
    _id: {
      $in: docsToFindById
    }
  }).forEach(function(doc) {
    documentCache[doc._id] = doc;
  });

  // If they don't exist, still put them in a cache as an empty object so we don't do unnecessary finds
  docsToFindById.forEach(function(docId) {
    if (!documentCache[docId]) {
      documentCache[docId] = {};
    }
  });

  // Now we can do the same stuff as the Configuration.getForEntity. Index
  // of entities will be the same as index in inheritanceTrees, so we'll use
  // that value in the call to Configuration._extendEntity
  var results = [];
  entities.forEach(function(entity, index) {
    results.push(Configuration._extendEntity(entity[0], entity[1], inheritanceTrees[index], documentCache).config);
  });

  // The above already did the same thing as matchBulkIndices, so no need to run that here.
  return results;
};

Configuration.getForEntity = function(type, id, options, fullDoc) {
 options = options || {};

  // If inherit is explicitly false, we only want the actual config for this entity.
  var configDoc;
  if (options.inherit === false) {
    configDoc = Configuration.Collection.findOne(type + '_' + id);
  } else {
    var extendList = Configuration._resolveInheritance(type, id, _.omit(options, 'inherit'));
    configDoc = Configuration._extendEntity(type, id, extendList, null);
  }

  return fullDoc ? configDoc : configDoc.config;
};

Configuration.setForEntity = function(type, id, props, overwrite) {
  // Are we overwriting? Or just updating individual props?
  var modifier = {};

  if (overwrite) {
    modifier.$set = {
      config: props
    };
  } else {
    modifier.$set = new MongoObject({
      config: props
    }).getFlatObject({
      keepArrays: true
    });
  }

  modifier.$set.entityType = type;
  modifier.$set.entityId = id;

  Configuration.Collection.update({
    _id: type + '_' + id
  }, modifier, {
    upsert: true,
    filter: false
  });
};
