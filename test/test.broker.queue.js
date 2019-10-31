const should = require('should');
const queueTree = require('../lib/broker/queue').queueTree;
const queue     = require('../lib/broker/queue').queue;
const constants = require('../lib/broker/constants');

describe('broker queue & tree', () => {

  describe('tree', () => {

    it('should be a queueTree object', () => {
      let tree = queueTree('idTree');

      should(tree).be.an.Object();
      should(tree.ids).eql({});
      should(tree.clients).eql({});
      should(tree.addClient).be.a.Function();
      should(tree.removeClient).be.a.Function();
      should(tree.getClientsForId).be.a.Function();
    });

    describe('addClient()', () => {

      it('should add a listener client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('client-1');
        should(tree.ids['1']['client-1']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('client-1');
        should(tree.clients['client-1']).eql([1]);
      });

      it('should add a consumer client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('root');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1]);
      });

      it('should add a consumer client and a lister client : same client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('root', 'client-1');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.ids['1']['client-1']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('client-1', 'root');
        should(tree.clients['client-1']).eql([1]);
        should(tree.clients['root']).eql([1]);
      });

      it('should add a consumer client and a lister client : different clients', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('root', 'client-2');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.ids['1']['client-2']).eql({
          nodes    : ['client-2#987654'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root', 'client-2');
        should(tree.clients['root']).eql([1]);
        should(tree.clients['client-2']).eql([1]);
      });

      it('should add consumer clients', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '987654', constants.LISTENER_TYPES.CONSUME, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('root');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456', 'client-1#987654'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1]);
      });

      it('should not add same client twice', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).have.keys('root');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1]);
      });

      it('should add same clients : different ids', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 2);

        should(tree.ids).have.keys('1', '2');
        should(tree.ids['1']).have.keys('root');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.ids['2']).have.keys('root');
        should(tree.ids['2']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1, 2]);
      });

      it('should add multiple clients : different ids', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 2);
        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN , 1);

        should(tree.ids).have.keys('1', '2');
        should(tree.ids['1']).have.keys('root', 'client-2');
        should(tree.ids['1']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.ids['1']['client-2']).eql({
          nodes    : ['client-2#987654'],
          lastNode : -1
        });
        should(tree.ids['2']).have.keys('root');
        should(tree.ids['2']['root']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('root', 'client-2');
        should(tree.clients['root']).eql([1, 2]);
        should(tree.clients['client-2']).eql([1]);
      });

      it('should add a listener client for multiple ids', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, [1, 2]);

        should(tree.ids).have.keys('1', '2');
        should(tree.ids['1']).have.keys('client-1');
        should(tree.ids['1']['client-1']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.ids['2']).have.keys('client-1');
        should(tree.ids['2']['client-1']).eql({
          nodes    : ['client-1#123456'],
          lastNode : -1
        });
        should(tree.clients).have.keys('client-1');
        should(tree.clients['client-1']).eql([1, 2]);
      });

    });

    describe('removeClient()', () => {

      it('should remove a listener client from id 1', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).not.have.keys('client-1');
      });

      it('should remove a consumer client from id 1', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).not.have.keys('root');
      });

      it('should remove a consumer & a listener from id 1 : same client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1]);

        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('root');
        should(tree.clients).not.have.keys('root');
      });

      it('should remove a listener client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 2);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).not.have.keys('client-1');
      });

      it('should remove a consumer client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 2);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).not.have.keys('root');
      });

      it('should remove a consumer & a listener : same client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN , 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 2);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN , 2);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('client-1');
        should(tree.clients).have.keys('root');
        should(tree.clients['root']).eql([1, 2]);

        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME);

        should(tree.ids).have.keys('1');
        should(tree.ids['1']).not.have.keys('root');
        should(tree.clients).not.have.keys('root');
      });

    });

    describe('getClientsForId()', () => {

      it('should not crash if id has not been registered', () => {
        let tree = queueTree('idTree');
        let clients = tree.getClientsForId(1);
        should(clients).eql([]);
      });

      it('should get client for id 1 : listener', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN , 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['client-2'].lastNode).eql(0);
      });

      it('should get client for id 1 : consumer', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.CONSUME , 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['root'].lastNode).eql(0);
      });

      it('should get clients for id 1 : consumers & same client', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-2', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['root'].lastNode).eql(0);
      });

       it('should get clients for id 1 : consumers & different clients', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['root'].lastNode).eql(0);
      });

      it('should get clients for id 1 : listeners', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN, 1);
        tree.addClient('client-2', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['client-2'].lastNode).eql(0);
      });

      it('should get clients for id 1 : listeners & different clients', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654', 'client-1#123456']);
        should(tree.ids[1]['client-2'].lastNode).eql(0);
        should(tree.ids[1]['client-1'].lastNode).eql(0);
      });

      it('should get clients for id 1 : listeners & increment node', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.LISTEN, 1);
        tree.addClient('client-2', '123456', constants.LISTENER_TYPES.LISTEN, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['client-2'].lastNode).eql(0);

        clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#123456']);
        should(tree.ids[1]['client-2'].lastNode).eql(1);
      });

      it('should get clients for id 1 : consumer & increment node', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-2', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['root'].lastNode).eql(0);

        clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#123456']);
        should(tree.ids[1]['root'].lastNode).eql(1);
      });

      it('should get clients for id 1 : consumer & increment node & different clients', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-2', '987654', constants.LISTENER_TYPES.CONSUME, 1);
        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.CONSUME, 1);

        let clients = tree.getClientsForId(1);

        should(clients).eql(['client-2#987654']);
        should(tree.ids[1]['root'].lastNode).eql(0);

        clients = tree.getClientsForId(1);

        should(clients).eql(['client-1#123456']);
        should(tree.ids[1]['root'].lastNode).eql(1);
      });

    });

  });

});
