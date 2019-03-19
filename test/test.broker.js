const path   = require('path');
const fs     = require('fs');
const should = require('should');
const broker = require('../index').broker;
const Socket = require('kitten-socket');

const config = {
  serviceId             : 'broker-1',
  registeredClientsPath : path.join(__dirname, 'clients'),
  keysDirectory         : path.join(__dirname, 'keys'),
  keysName              : 'broker',
  socketServer          : {
    port            : 1234,
    logs            : 'packets',
    packetsFilename : 'broker.log'
  },
  managementSocket : {
    port            : 1235,
    logs            : 'packets',
    packetsFilename : 'management.log'
  }
};

describe('broker', () => {

  before(done => {
    if (fs.existsSync(path.join(config.keysDirectory, config.keysName + '.pem'))) {
      fs.unlinkSync(path.join(config.keysDirectory, config.keysName + '.pem'));
    }
    if (fs.existsSync(path.join(config.keysDirectory, config.keysName + '.pub'))) {
      fs.unlinkSync(path.join(config.keysDirectory, config.keysName + '.pub'));
    }
    done();
  });

  describe('instanciation', () => {

    it('should intanciate brocker socket server', done => {
      let _broker             = broker(config);
      let _socketClientBroker = new Socket(config.socketServer.port);

      // start the client
      _socketClientBroker.startClient(() => {
        _socketClientBroker.send('1# hello, Im the client');
      });
      _socketClientBroker.on('message', function (messageFromServer) {
        if (messageFromServer.data.type) {
          return;
        }

        should(messageFromServer.data).eql('Hi, Im the server, Im the boss, the client is not the king here! So listen to me');
        _socketClientBroker.stop(() => {
          _broker.stop(done);
        });
      });
      _broker._sockets.broker.on('message', function (messageFromClient) {
        if (messageFromClient.data.type) {
          return;
        }

        should(messageFromClient.data).eql('1# hello, Im the client');
        messageFromClient.send('Hi, Im the server, Im the boss, the client is not the king here! So listen to me');
      });
    });

    it('should intanciate management socket server', done => {
      let _broker                 = broker(config);
      let _socketClientManagement = new Socket(config.managementSocket.port);

      // start the client
      _socketClientManagement.startClient(() => {
        _socketClientManagement.send('1# hello, Im the client');
      });
      _socketClientManagement.on('message', function (messageFromServer) {
        if (messageFromServer.data.type) {
          return;
        }

        should(messageFromServer.data).eql('Hi, Im the server, Im the boss, the client is not the king here! So listen to me');
        _socketClientManagement.stop(() => {
          _broker.stop(done);
        });
      });
      _broker._sockets.management.on('message', function (messageFromClient) {
        if (messageFromClient.data.type) {
          return;
        }

        should(messageFromClient.data).eql('1# hello, Im the client');
        messageFromClient.send('Hi, Im the server, Im the boss, the client is not the king here! So listen to me');
      });
    });
  });

});
