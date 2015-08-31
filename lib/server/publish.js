Meteor.publish('__entity_configuration', function () {
  var userId = this.userId;
  var selector = {
    $or: [
      // Default is always published
      {
        entityType: '_default',
        entityId: '_default'
      }
    ]
  };

  // Call each type's publish function, which will return an ID or IDs for that type
  _.each(Configuration._entityTypePublish, function (func, type) {
    var idList = func(userId);
    if (!idList) return;

    if (!_.isArray(idList)) idList = [idList];
    if (!idList.length) return;

    selector.$or.push({
      entityType: type,
      entityId: {$in: idList}
    });
  });

  return Configuration.Collection.find(selector);
});
