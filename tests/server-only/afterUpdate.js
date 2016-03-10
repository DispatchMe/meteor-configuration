describe('getForEntities', function() {
  beforeEach(function() {
    Configuration.setSchema(new SimpleSchema({
      foo: {
        type: String,
      },
      'nested': {
        type: Object,
      },
      'nested.foo': {
        type: String,
      },
    }));

    spyOn(Meteor, 'userId').and.returnValue('123');
  });

  it('emits "afterUpdate" after setDefault', function () {
    let emittedResult;

    Configuration.once('afterUpdate', ({ userId, _id, modifier, result }) => {
      emittedResult = result;
      expect(userId).toEqual('123');
      expect(_id).toEqual('_default');
      expect(modifier).toEqual({
        $set: {
          config: {
            foo: 'bar',
          },
        },
      });
    });

    const result = Configuration.setDefault({
      foo: 'bar',
    });

    expect(emittedResult).toEqual(result);
  });

  it('emits "afterUpdate" after setDefaultForPrefix', function () {
    let emittedResult;

    Configuration.once('afterUpdate', ({ userId, _id, modifier, result }) => {
      emittedResult = result;
      expect(userId).toEqual('123');
      expect(_id).toEqual('_default');
      expect(modifier).toEqual({
        $set: {
          'config.nested': {
            foo: 'bar',
          },
        },
      });
    });

    const result = Configuration.setDefaultForPrefix('nested', {
      foo: 'bar',
    });

    expect(emittedResult).toEqual(result);
  });

  it('emits "afterUpdate" after setForEntity', function () {
    let emittedResult;

    Configuration.once('afterUpdate', ({ userId, _id, modifier, result }) => {
      emittedResult = result;
      expect(userId).toEqual('123');
      expect(_id).toEqual('user_1');
      expect(modifier).toEqual({
        $set: {
          'config.foo': 'bar',
          entityType: 'user',
          entityId: '1',
        },
      });
    });

    const result = Configuration.setForEntity('user', '1', {
      foo: 'bar',
    });

    expect(emittedResult).toEqual(result);
  });
});