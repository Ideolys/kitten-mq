const should          = require('should');
const path            = require('path');
const fs              = require('fs');
const broker          = require('../index').broker;
const queue           = require('../lib/broker/queue').queue;
const { randU32Sync } = require('../lib/utils');
const constants       = require('../lib/broker/constants');
const cli             = require('../lib/cli');

const socketName     = 'test_socket_cli';
const tempFolderPath = path.join(__dirname, '.temp');
const socketPath     = path.join(tempFolderPath, 'socket');

const _configBroker1 = {
  serviceId             : 'broker-1',
  registeredClientsPath : path.join(__dirname, 'clients_broker_1'),
  keysDirectory         : path.join(__dirname, 'keys_broker_1'),
  keysName              : 'broker1',
  socketServer          : {
    port            : 1234,
    logs            : 'packets',
    packetsFilename : 'broker1.log'
  },
  isMaster : true,
  logLevel : 4,
  requeueInterval : 0.5,
  isManagementInterface : false
};


let configBroker1 = path.join(__dirname, 'config-broker-1.json');

describe('CLI', () => {

  before(done => {
    if (fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pem'))) {
      fs.unlinkSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pem'));
    }
    if (fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pub'))) {
      fs.unlinkSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pub'));
    }
    fs.writeFileSync(configBroker1, JSON.stringify(_configBroker1));
    let _configBrokerRedeliver1 = JSON.parse(JSON.stringify(_configBroker1));
        _configBrokerRedeliver1.requeueLimit    = 3;
        _configBrokerRedeliver1.requeueInterval = 0.1;
    done();
  });

  beforeEach(() => {
    function deleteKeys (directory) {
      if (!fs.existsSync(directory)) {
        return;
      }

      let _files = fs.readdirSync(directory);

      for (var i = 0; i < _files.length; i++) {
        fs.unlinkSync(path.join(directory, _files[i]));
      }
    }

    deleteKeys(path.join(__dirname, 'clients_broker_1'));
  });

  describe('basic function', () => {

    it('should set and get client socket', done => {
      cli.setClient({name:'socket'})
      should(cli.getClient()).eql({name:'socket'});
      done();
    });

    it('should format a message before sending', done => {
      const message  = {name:'socket'};
      const _message = JSON.stringify(message);
      should(cli.formatMessage(message)).eql(_message.length + '#' + _message);
      done();
    });

    it('should return an error if no valid queue name sent', done => {
      let queueObject = queue('endpoint/v1', () => {}, { maxItemsInQueue : 10 });
      queueObject.addInQueue(1, { data : { label : 'bla' }}, randU32Sync());

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'unknow'});
      should(_queue).eql({ action: 'list', result: [], error: 'Queue not found' });
      done();
    });

    it('should return list of active queue without message', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      done();
    });
   
    it('should return list of active queue with message', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1', includeMessage : true, isPrimary : true, isRequeue : true, isSecondary : true});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0].name).eql('chan2');
      should(_queue.result[0].primary.keys[0].count).eql(3);
      should(_queue.result[0].primary.keys[0].message).lengthOf(3);
      should(_queue.result[0].primary.keys[0].message[0].label).eql('bla_2');
      should(_queue.result[0].primary.keys[0].message[1].label).eql('bla_3');
      should(_queue.result[0].primary.keys[0].message[2].label).eql('bla_4');
      
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0].name).eql('chan3');
      should(_queue.result[0].primary.keysRequeue[0].count).eql(3);
      should(_queue.result[0].primary.keysRequeue[0].message).lengthOf(3);
      should(_queue.result[0].primary.keysRequeue[0].message[0].label).eql('bla_1');
      should(_queue.result[0].primary.keysRequeue[0].message[1].label).eql('bla_2');
      should(_queue.result[0].primary.keysRequeue[0].message[2].label).eql('bla_3');
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0].name).eql('channel name');
      should(_queue.result[0].secondary.keys[0].count).eql(2);
      should(_queue.result[0].secondary.keys[0].message).lengthOf(2);
      should(_queue.result[0].secondary.keys[0].message[0].label).eql('bla');
      should(_queue.result[0].secondary.keys[0].message[1].label).eql('bli');
      done();
    });

    it('should delete an active queue', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'endpoint/v1', isPrimary : true, isRequeue : true, isSecondary : true});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('queue endpoint/v1 dropped');
      done();
    });

    it('should delete an active queue for a specific channel', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'endpoint/v1', channel : 'chan3', isPrimary : true, isRequeue : true, isSecondary : true});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('queue endpoint/v1 chan3 dropped for primary, requeue, secondary. (3 messages)');
      done();
    });

    it('should delete an active queue for a specific channel in requeue ', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'endpoint/v1', channel : 'chan3', isPrimary : false, isRequeue : true, isSecondary : false});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('queue endpoint/v1 chan3 dropped for requeue. (3 messages)');
      done();
    });

    it('should delete an active queue for a specific channel in primary ', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'endpoint/v1', channel : 'chan2', isPrimary : true, isRequeue : false, isSecondary : false});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('queue endpoint/v1 chan2 dropped for primary. (3 messages)');
      done();
    });

    it('should delete an active queue for a specific channel in secondary ', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'endpoint/v1', channel : 'channel name', isPrimary : false, isRequeue : false, isSecondary : true});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('queue endpoint/v1 channel name dropped for secondary. (2 messages)');
      done();
    });

    it('should delete nothing with a bad queue name', done => {
      let iterator = 0;

      let handler  = (acks, clients, data, header) => {
        if (!header.nbRequeues ) {
          acks[header.messageId].headers         = header;
          acks[header.messageId].headers.created = Date.now()
          if(acks[header.messageId].message[0] === 'chan3')
            queueObject.nack(header.messageId, 10);
          iterator++;
          return;
        }
        return;
      };

      let queueObject = queue('endpoint/v1', handler, { maxItemsInQueue : 10, requeueLimit : 10, requeueInterval : 2 });


      queueObject.addClient('chan3', 'client-2', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan3', { data : { label : 'bla_1' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan3', { data : { label : 'bla_3' }}, randU32Sync()); // in queue

      queueObject.addInQueue('channel name', { data : { label : 'bla' }}, randU32Sync());
      queueObject.addInQueue('channel name', { data : { label : 'bli' }}, randU32Sync());

      queueObject.addClient('chan2', 'client-1', '123456', constants.LISTENER_TYPES.CONSUME);

      queueObject.addInQueue('chan2', { data : { label : 'bla_1' }}, randU32Sync()); // in current process
      queueObject.addInQueue('chan2', { data : { label : 'bla_2' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_3' }}, randU32Sync()); // in queue
      queueObject.addInQueue('chan2', { data : { label : 'bla_4' }}, randU32Sync()); // in queue

      let queues = [];
      queues['endpoint/v1'] = queueObject;

      const _queue = cli.list(queues, {queue: 'endpoint/v1'});
      should(_queue.action).eql('list');
      should(_queue.result).have.lengthOf(1);
      should(_queue.result[0]).be.an.Object();
      should(_queue.result[0].name).eql('endpoint/v1');

      should(_queue.result[0].primary.count).eql(3);
      should(_queue.result[0].primary.countRequeue).eql(3);
      should(_queue.result[0].primary.keys).have.lengthOf(1);
      should(_queue.result[0].primary.keys[0]).eql({name : 'chan2', count : 3, message : [] });
      should(_queue.result[0].primary.keysRequeue).have.lengthOf(1);
      should(_queue.result[0].primary.keysRequeue[0]).eql({name : 'chan3', count : 3, message : [] });

      should(_queue.result[0].secondary.count).eql(2);
      should(_queue.result[0].secondary.keys).have.lengthOf(1);
      should(_queue.result[0].secondary.keys[0]).eql({name : 'channel name', count : 2, message : [] });
      // 
      const _res = cli.deleteQueue(queues, {queue: 'bad name', isPrimary : true, isRequeue : true, isSecondary : true});
      should(_res.action).eql('delete');
      should(_res.result.message).eql('no queue available');
      done();
    });


  });
  
  describe('socket connexion', () => {
    before(done => {
      if(!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath);
      done();
    });

    it('should init the socket connexion with the CLI', done => {
      const _broker    = broker(configBroker1);

      _broker.start({socketName}, function() {
        fs.writeFileSync(socketPath, socketName);

        const _socketName = fs.readFileSync(socketPath, 'utf8');
        cli.connect(_socketName, client => {
          cli.setClient(client);
          client.buffer        = '';
          client.contentLength = null;
          client.setEncoding('utf-8');
          client.on('data', function(data) {
            cli.onData(data, client);
          });

          client.on('message', function (message) {
            should(message.action).eql('list');
            should(message.result).eql([]);
            closeSocket();
            done();

          });
           
          client.on('end', function(data) {
            client.destroy();
          });

          let data = { from : 'CLI', action : 'list', options : {} };
          cli.send(data);
        })
      });
    });

  });

});

function closeSocket() {
  client = cli.getClient();
  if(client) {
    client.destroy();
  }
}
