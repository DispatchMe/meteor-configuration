Meteor.methods({
  'dispatch:configuration/getForEntity': function (type, id, options) {
    if (!Configuration._entityTypeWrite[type](this.userId, id))
      throw new Meteor.Error('access-denied', 'Entity type "write" function prohibited this action');

    return Configuration.getForEntity(type, id, options, true);
  },
  'dispatch:configuration/setForEntity': function (type, id, props, overwrite) {
    return Configuration.setForEntity(type, id, props, overwrite);
  }
});
