Meteor.methods({
  'dispatch:configuration/getForEntity': function (type, id, options) {
    if (!Configuration._entityTypeWrite[type](this.userId, id))
      throw new Meteor.Error('access-denied', 'Entity type "write" function prohibited this action');

    options = options || {};

    // If inherit is explicitly false, we only want the actual config for this entity.
    var configDoc;
    if (options.inherit === false) {
      configDoc = Configuration.Collection.findOne(type + '_' + id);
    } else {
      var extendList = Configuration._resolveInheritance(type, id, _.omit(options, 'inherit'));
      configDoc = Configuration._extendEntity(type, id, extendList, null);
    }

    return configDoc;
  }
});