Meteor.methods({
  'dispatch:configuration/getForEntity': function (type, id, options) {
    if (!Configuration._entityTypeWrite[type](this.userId, id))
      throw new Meteor.Error('access-denied', `Entity type "write" function prohibited getForEntity by user ${this.userId} for ${type} ${id}`);

    return Configuration.getForEntity(type, id, options, true);
  },
  'dispatch:configuration/setForEntity': function (type, id, props, overwrite) {
    if (!Configuration._entityTypeWrite[type](this.userId, id))
      throw new Meteor.Error('access-denied', `Entity type "write" function prohibited setForEntity by user ${this.userId} for ${type} ${id}`);

    return Configuration.setForEntity(type, id, props, overwrite);
  },
  'dispatch:configuration/setDefault': function (doc) {
    if (!Configuration._canEditDefault(this.userId))
      throw new Meteor.Error('access-denied', `User ${this.userId} does not have permission to setDefault`);

    return Configuration.setDefault(doc);
  },
  'dispatch:configuration/setDefaultForPrefix': function (prefix, data) {
    if (!Configuration._canEditDefault(this.userId))
      throw new Meteor.Error('access-denied', `User ${this.userId} does not have permission to setDefaultForPrefix`);

    return Configuration.setDefaultForPrefix(prefix, data);
  },
});
