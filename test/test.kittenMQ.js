const path   = require('path');
const fs     = require('fs');
const should = require('should');
const broker = require('../index').broker;
const client = require('../index').client;
const Socket = require('kitten-socket');

const configBroker1 = {
  serviceId             : 'broker-1',
  registeredClientsPath : path.join(__dirname, 'clients'),
  keysDirectory         : path.join(__dirname, 'keys'),
  keysName              : 'broker1',
  socketServer          : {
    port            : 1234,
    logs            : 'packets',
    packetsFilename : 'broker1.log'
  },
  managementSocket : {
    port            : 1235,
    logs            : 'packets',
    packetsFilename : 'management1.log'
  }
};

const configBroker2 = {
  serviceId             : 'broker-1',
  registeredClientsPath : path.join(__dirname, 'clients'),
  keysDirectory         : path.join(__dirname, 'keys'),
  keysName              : 'broker2',
  socketServer          : {
    port            : 1236,
    logs            : 'packets',
    packetsFilename : 'broker2.log'
  },
  managementSocket : {
    port            : 1237,
    logs            : 'packets',
    packetsFilename : 'management2.log'
  }
};

describe('kitten-mq', () => {
  before(done => {
    if (fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pem'))) {
      fs.unlinkSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pem'));
    }
    if (fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pub'))) {
      fs.unlinkSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pub'));
    }
    if (fs.existsSync(path.join(configBroker2.keysDirectory, configBroker2.keysName + '.pub'))) {
      fs.unlinkSync(path.join(configBroker2.keysDirectory, configBroker2.keysName + '.pub'));
    }
    if (fs.existsSync(path.join(configBroker2.keysDirectory, configBroker2.keysName + '.pem'))) {
      fs.unlinkSync(path.join(configBroker2.keysDirectory, configBroker2.keysName + '.pem'));
    }
    done();
  });


  describe('broker', () => {

    describe('instanciation', () => {

      it('should instanciate brocker socket server', done => {
        let _broker             = broker(configBroker1);
        let _socketClientBroker = new Socket(configBroker1.socketServer.port);

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

      it('should instanciate management socket server', done => {
        let _broker                 = broker(configBroker1);
        let _socketClientManagement = new Socket(configBroker1.managementSocket.port);

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

      it('should have created private and public keys', done => {
        let _broker1 = broker(configBroker1);

        should(fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pem'))).eql(true);
        should(fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pub'))).eql(true);

        _broker1.stop(done);
      });

      it('should have sent public key', done => {
        let _client = client();

        if (fs.existsSync(path.join(__dirname, 'clients', 'client-1.pub'))) {
          fs.unlinkSync(path.join(__dirname, 'clients', 'client-1.pub'));
        }

        let _broker1 = broker(configBroker1);

        setTimeout(() => {
          _client.connect({
            clientId      : 'client-1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {

            setTimeout(() => {
              should(fs.existsSync(path.join(__dirname, 'clients', 'client-1.pub'))).eql(true);
              _client.disconnect(() => {
                _broker1.stop(done);
              });
            }, 50);
          });
        }, 100);
      });
    });

  });

  describe('client', () => {

    describe('connect', () => {
      it('should connect to hosts', done => {
        let _client = client();

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        setTimeout(() => {
          _client.connect({
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port,
              'localhost:' + configBroker2.socketServer.port
            ]
          }, () => {
            _client.disconnect(() => {
              _broker1.stop(() => {
                _broker2.stop(done);
              });
            });
          });
        }, 100);
      });

      it('should have created private and public keys', done => {
        let _client = client();

        if (fs.existsSync(path.join(__dirname, 'keys', 'client.pem'))) {
          fs.unlinkSync(path.join(__dirname, 'keys', 'client.pem'));
        }
        if (fs.existsSync(path.join(__dirname, 'keys', 'client.pub'))) {
          fs.unlinkSync(path.join(__dirname, 'keys', 'client.pub'));
        }

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        setTimeout(() => {
          _client.connect({
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port,
              'localhost:' + configBroker2.socketServer.port
            ]
          }, () => {
            should(fs.existsSync(path.join(__dirname, 'keys', 'client.pem'))).eql(true);
            should(fs.existsSync(path.join(__dirname, 'keys', 'client.pub'))).eql(true);

            _client.disconnect(() => {
              _broker1.stop(() => {
                _broker2.stop(done);
              });
            });
          });
        }, 100);
      });

    });
  });

});
