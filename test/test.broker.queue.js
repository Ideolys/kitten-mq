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

      it('should remove a listener client from id \'1\'', () => {
        let tree = queueTree('idTree');

        tree.addClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, 1);
        tree.removeClient('client-1', '123456', constants.LISTENER_TYPES.LISTEN, '1');

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

  describe('queue', () => {

    it('should define a queue object', () => {
      let queueObject = queue('endpoint/v1', () => {});

      should(queueObject).be.an.Object();
      should(queueObject.queue).be.an.Array().and.have.lengthOf(0);
      should(queueObject.nbMessagesReceived).eql(0);
      should(queueObject.queueSecondary).eql({ _nbMessages : 0, _nbMessagesReceived : 0, _nbMessagesDropped : 0 });
      should(queueObject.currentItem).eql(null);
      should(queueObject.lastItem).eql(null);
      should(queueObject.lastItemSecondary).eql(null);
      should(queueObject.tree).be.an.Object();
      should(queueObject._acks).be.an.Object().and.eql({});

      should(queueObject.addClient).be.a.Function();
      should(queueObject.addInQueue).be.a.Function();
      should(queueObject.ack).be.a.Function();
      should(queueObject.nack).be.a.Function();
    });

    it('should add an item in the waiting queue if no one is listening', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 });

      queueObject.addInQueue(1, { data : { label : 'bla' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(1);
      should(queueObject.queueSecondary[1].length).eql(1);
      should(queueObject.queueSecondary[1][0][1]).eql({ data : { label : 'bla' } });
    });

    it('should drop messages if limit is reached', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 5 });

      for (let i = 0; i < 10; i++) {
        queueObject.addInQueue(1, { data : { label : 'bla_' + i }}, Date.now());
      }


      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(5);
      should(queueObject.queueSecondary._nbMessagesReceived).eql(10);
      should(queueObject.queueSecondary._nbMessagesDropped).eql(5);
      should(queueObject.queueSecondary[1].length).eql(5);
      should(queueObject.queueSecondary[1][0][1]).eql({ data : { label : 'bla_5' } });
      should(queueObject.queueSecondary[1][1][1]).eql({ data : { label : 'bla_6' } });
      should(queueObject.queueSecondary[1][2][1]).eql({ data : { label : 'bla_7' } });
      should(queueObject.queueSecondary[1][3][1]).eql({ data : { label : 'bla_8' } });
      should(queueObject.queueSecondary[1][4][1]).eql({ data : { label : 'bla_9' } });
    });

    it('should drop messages if ttl is reached', done => {
      let queueObject = queue('endpoint/v1', () => {}, {}, { ttl : .5 });

      for (let i = 0; i < 10; i++) {
        queueObject.addInQueue(1, { data : { label : 'bla_' + i }}, Date.now());
      }

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(10);
      should(queueObject.queueSecondary._nbMessagesReceived).eql(10);
      should(queueObject.queueSecondary._nbMessagesDropped).eql(0);
      should(queueObject.queueSecondary[1].length).eql(10);

      setTimeout(() => {
        should(queueObject.queue).have.lengthOf(0);
        should(queueObject.queueSecondary._nbMessages).eql(10);
        should(queueObject.queueSecondary._nbMessagesReceived).eql(10);
        should(queueObject.queueSecondary._nbMessagesDropped).eql(10);
        should(queueObject.queueSecondary[1].length).eql(0);
        done();
      }, 1000);
    });

    it('should drop messages if ttl is reached : multiple ids', done => {
      let queueObject = queue('endpoint/v1', () => {}, {}, { ttl : .5 });

      for (let i = 0; i < 10; i++) {
        queueObject.addInQueue(1, { data : { label : 'bla_' + i }}, Date.now());

        if (i % 2) {
          queueObject.addInQueue(2, { data : { label : 'bla_' + i }}, Date.now());
        }
      }


      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(15);
      should(queueObject.queueSecondary._nbMessagesReceived).eql(15);
      should(queueObject.queueSecondary._nbMessagesDropped).eql(0);
      should(queueObject.queueSecondary[1].length).eql(10);
      should(queueObject.queueSecondary[2].length).eql(5);

      setTimeout(() => {
        should(queueObject.queue).have.lengthOf(0);
        should(queueObject.queueSecondary._nbMessages).eql(15);
        should(queueObject.queueSecondary._nbMessagesReceived).eql(15);
        should(queueObject.queueSecondary._nbMessagesDropped).eql(15);
        should(queueObject.queueSecondary[1].length).eql(0);
        should(queueObject.queueSecondary[2].length).eql(0);
        done();
      }, 1000);
    });

    it('should add an item in the waiting queue and process it when client is registering', done => {
      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();

        should(clients).eql(['client-1#123456']);
        should(data).eql({ data : { label : 'bla' }});
        should(header).have.keys('messageId');
        done();
      };
      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10 });

      queueObject.addInQueue(1, { data : { label : 'bla' }}, Date.now());
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);
    });

    it('should add items in the waiting queue and process them when client is registering', done => {
      let i       = 1;
      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();

        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : 'bla_' + i++ }});
        done();
      };
      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10 });

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);
    });

    it('should not process items that belongs to another id', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 });

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      queueObject.addClient(2, 'client-2', '987654', constants.LISTENER_TYPES.CONSUME);

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(2);
      should(queueObject.queueSecondary).keys(1);
      should(queueObject.queueSecondary[1].length).eql(2);
      should(queueObject.queueSecondary[1][0][1]).eql({ data : { label : 'bla_1' } });
      should(queueObject.queueSecondary[1][1][1]).eql({ data : { label : 'bla_2' } });
    });

    it('should send one item to one client', () => {
      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : 'bla_1' }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now()

        queueObject.ack(header.messageId);
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if not acked by client', done => {
      let iterator = 0;
      let handler  = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(data).eql({ data : { label : 'bla_1' }});

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
        } else {
          should(header.nbRequeues).eql(++iterator);
        }

        if (iterator === 1) {
          delete acks[header.messageId];
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 2, requeueInterval : 0.5 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if not acked by client and wait for time defined in configuration', done => {
      let iterator = 0;
      let handler  = (acks, clients, data, header) => {
        let time = null;

        if (header.nbRequeues) {
          time = header.created + (2.2*1000);
        }
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(data).eql({ data : { label : 'bla_1' }});

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now();
        } else {
          should(header.nbRequeues).eql(++iterator);
          should(time).be.approximately(Date.now(), 1000);
        }

        if (iterator === 1) {
          delete acks[header.messageId];
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 2, requeueInterval : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if not acked by client and then continue to send other items', done => {
      let iterator       = 0;
      let expectedLabels = ['bla_1', 'bla_2', 'bla_1'];
      let receivedLabels = [];

      let handler  = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);

        receivedLabels.push(data.data.label);

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()

          if (!iterator && data.data.label === 'bla_2') {
            queueObject.ack(header.messageId);
            return;
          }
        } else {
          should(header.nbRequeues).eql(++iterator);
        }

        if (iterator === 1) {
          should(receivedLabels).eql(expectedLabels);
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 2, requeueInterval : 0.5 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      should(queueObject.queue).have.lengthOf(1);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item nacked by client', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(data).eql({ data : { label : 'bla_1' } });

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()

          queueObject.nack(header.messageId);
          iterator++;
          return;
        }

        if (iterator === 1) {
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 2, requeueInterval : 0.2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());

      should(queueObject.queue).have.lengthOf(1);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item nacked by client with delay', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(data).eql({ data : { label : 'bla_1' } });

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now();

          queueObject.nack(header.messageId, 1);
          iterator++;
          return;
        }

        if (iterator === 1) {
          should(Date.now()).be.aboveOrEqual(header.created + 1000);
          should(queueObject.queueRequeue.length).eql(0);
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 2, requeueInterval : 0.2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should send one item to multiple clients (3)', done => {
      let handler  = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql([
          'client-1#123456',
          'client-2#123456',
          'client-3#123456'
        ]);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : 'bla' }});

        queueObject.ack('first_packet');
        done();
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);
      queueObject.addClient(1, 'client-2', '123456', constants.LISTENER_TYPES.LISTEN);
      queueObject.addClient(1, 'client-3', '123456', constants.LISTENER_TYPES.LISTEN);

      queueObject.addInQueue(1, { data : { label : 'bla' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should send multiple items to one client : prefetch 3', done => {
      let iterator     = 0;
      let messagesSent = [];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : 'bla_' + (iterator + 1) }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
        iterator++;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 5 }, { prefetch : 3 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_3' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_4' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_5' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_2', 'bla_3']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(2);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should send multiple items to multiple clients : prefetch 3', done => {
      let iterator     = 0;
      let messagesSent = [];

      let handler = (acks, clients, data, header) => {
        iterator++;
        should(acks).be.an.Object();
        if (iterator % 2 === 0) {
          should(clients).eql(['client-2#123457']);
        }
        else {
          should(clients).eql(['client-1#123456']);
        }
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : 'bla_' + (iterator) }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 5 }, { prefetch : 3 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);
      queueObject.addClient(1, 'client-2', '123457', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_3' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_4' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_5' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_2', 'bla_3']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(2);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if not acked with prefetch 2 : first item timeout', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_1'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 2) {
          queueObject.ack(header.messageId);
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.1, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_2', 'bla_1']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if not acked with prefetch 2 : last item timeout', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_2'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.ack(header.messageId);
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.1, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_2', 'bla_2']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if nacked with prefetch 2 : last item', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_2'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.ack(header.messageId);
        }
        if (iterator === 2) {
          queueObject.nack(header.messageId);
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.1, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_2', 'bla_2']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if nacked with prefetch 2 : first item', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_1', 'bla_2'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        //should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers         = header;
        acks[header.messageId].headers.created = Date.now();

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.nack(header.messageId);
        }
        if (iterator === 2) {
          queueObject.ack(header.messageId);
        }
        if (iterator === 3) {
          queueObject.ack(header.messageId);
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.2, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      setTimeout(() => {
        should(iterator).eql(3);
        should(messagesSent).eql(['bla_1', 'bla_1', 'bla_2']);
        done();
      }, 3000);

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if nacked with prefetch 2 and delay: last item', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_2'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        if (!header.nbRequeues) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now();
        }

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.ack(header.messageId);
        }
        if (iterator === 2) {
          queueObject.nack(header.messageId, 1);
        }

        if (iterator === 3) {
          should(Date.now()).be.aboveOrEqual(header.created + 1000);
          should(queueObject.queueRequeue.length).eql(0);
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.1, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend item if nacked with prefetch 2 : first item', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_1'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers = header;

        if (!header.nbRequeues) {
          acks[header.messageId].headers.created = Date.now();
        }

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.nack(header.messageId, 1);
        }
        if (iterator === 2) {
          queueObject.ack(header.messageId);
        }
        if (iterator === 3) {
          queueObject.ack(header.messageId);
          should(queueObject.queueRequeue.length).eql(0);
          should(Date.now()).be.aboveOrEqual(header.created + 1000);
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.2, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should resend items if nacked with prefetch 2', done => {
      let iterator     = 0;
      let messagesSent = [];

      expectedLabels = ['bla_1', 'bla_2', 'bla_1', 'bla_2'];

      let handler = (acks, clients, data, header) => {
        should(acks).be.an.Object();
        should(clients).eql(['client-1#123456']);
        should(header).have.keys('messageId');
        should(data).eql({ data : { label : expectedLabels[iterator] }});

        acks[header.messageId].headers = header;

        if (!header.nbRequeues) {
          acks[header.messageId].headers.created = Date.now();
        }

        messagesSent.push(data.data.label);
        iterator++;

        if (iterator === 1) {
          queueObject.nack(header.messageId, 1);
        }
        else if (iterator === 2) {
          queueObject.nack(header.messageId, 1);
        }
        else if (iterator === 3) {
          queueObject.ack(header.messageId);
          should(queueObject.queueRequeue.length).eql(0);
          should(Date.now()).be.aboveOrEqual(header.created + 1000);
        }
        else if (iterator === 4) {
          queueObject.ack(header.messageId);
          should(queueObject.queueRequeue.length).eql(0);
          should(Date.now()).be.aboveOrEqual(header.created + 1000);
          done();
        }
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueInterval : 0.2, requeueLimit : 2 }, { prefetch : 2 });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue(1, { data : { label : 'bla_1' }}, Date.now());
      queueObject.addInQueue(1, { data : { label : 'bla_2' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);
    });

    it('should not add undefined item in the queue', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 }, { id : ['int'], label : ['string'] });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      let res = queueObject.addInQueue(1, {}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);

      should(res).eql([{
        error : 'No value'
      }]);
    });

    it('should not add null item in the queue', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 }, { id : ['int'], label : ['string'] });
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      let res = queueObject.addInQueue(1, { data : null }, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);

      should(res).eql([{
        error : 'No value'
      }]);
    });

    it('should validate the item before to push in the queue', () => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 }, { map : { id : ['int'], label : ['string'] }});
      queueObject.addClient(1, 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      let res = queueObject.addInQueue(1, { data : { label : 'bla' }}, Date.now());

      should(queueObject.queue).have.lengthOf(0);
      should(queueObject.queueSecondary._nbMessages).eql(0);

      should(res).eql([{
        error : '${must be an integer}',
        field : 'id',
        index : null,
        value : undefined
      }]);
    });

  });

});
