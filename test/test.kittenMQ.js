const path      = require('path');
const fs        = require('fs');
const should    = require('should');
const spawn     = require('child_process').spawn;
const broker    = require('../index').broker;
const client    = require('../index').client;
const Socket    = require('kitten-socket');
const constants = require('../lib/broker/constants');
const rootPath  = process.cwd();

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

const _configBroker2 = {
  serviceId             : 'broker-2',
  registeredClientsPath : path.join(__dirname, 'clients_broker_2'),
  keysDirectory         : path.join(__dirname, 'keys_broker_2'),
  keysName              : 'broker2',
  socketServer          : {
    port            : 1236,
    logs            : 'packets',
    packetsFilename : 'broker2.log',
  },
  logLevel        : 4,
  requeueInterval : 0.5,
  isManagementInterface : false
};

let configBroker1          = path.join(__dirname, 'config-broker-1.json');
let configBroker2          = path.join(__dirname, 'config-broker-2.json');
let configBrokerRedeliver1 = path.join(__dirname, 'config-broker-redeliver-1.json');
let configBrokerRedeliver2 = path.join(__dirname, 'config-broker-redeliver-2.json');
let configBrokerFormat     = path.join(__dirname, 'config-broker-format.json');
let configBrokerRule       = path.join(__dirname, 'config-broker-rule.json');
let configBrokerToken      = path.join(__dirname, 'config-broker-token.json');

describe('kitten-mq', () => {

  before(done => {
    if (fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pem'))) {
      fs.unlinkSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pem'));
    }
    if (fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pub'))) {
      fs.unlinkSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pub'));
    }
    if (fs.existsSync(path.join(_configBroker2.keysDirectory, _configBroker2.keysName + '.pub'))) {
      fs.unlinkSync(path.join(_configBroker2.keysDirectory, _configBroker2.keysName + '.pub'));
    }
    if (fs.existsSync(path.join(_configBroker2.keysDirectory, _configBroker2.keysName + '.pem'))) {
      fs.unlinkSync(path.join(_configBroker2.keysDirectory, _configBroker2.keysName + '.pem'));
    }

    fs.writeFileSync(configBroker1, JSON.stringify(_configBroker1));
    fs.writeFileSync(configBroker2, JSON.stringify(_configBroker2));

    let _configBrokerRedeliver1 = JSON.parse(JSON.stringify(_configBroker1));
    _configBrokerRedeliver1.requeueLimit    = 3;
    _configBrokerRedeliver1.requeueInterval = 0.1;
    let _configBrokerRedeliver2 = JSON.parse(JSON.stringify(_configBroker2));
    _configBrokerRedeliver2.requeueLimit    = 3;
    _configBrokerRedeliver2.requeueInterval = 0.1;

    fs.writeFileSync(configBrokerRedeliver1, JSON.stringify(_configBrokerRedeliver1));
    fs.writeFileSync(configBrokerRedeliver2, JSON.stringify(_configBrokerRedeliver2));
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
    deleteKeys(path.join(__dirname, 'clients_broker_2'));
    // deleteKeys(path.join(__dirname, 'keys'));
  });

  describe('broker', () => {

    describe('instanciation', () => {

      it('should instanciate brocker socket server', done => {
        let _broker = broker(configBroker1);
        _broker.start(() => {

          let _socketClientBroker = new Socket(_configBroker1.socketServer.port);

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
      });

      it('should have created private and public keys', done => {
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          should(fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pem'))).eql(true);
          should(fs.existsSync(path.join(_configBroker1.keysDirectory, _configBroker1.keysName + '.pub'))).eql(true);

          _broker1.stop(done);
        });
      });

      it('should have sent public key', done => {
        let _client = client();

        if (fs.existsSync(path.join(__dirname, 'clients_broker_1', 'client-1.pub'))) {
          fs.unlinkSync(path.join(__dirname, 'clients_broker_1', 'client-1.pub'));
        }

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client.connect({
            clientId      : 'client-1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            setTimeout(() => {
              should(fs.existsSync(path.join(__dirname, 'clients_broker_1', 'client-1.pub'))).eql(true);
              _client.disconnect(() => {
                _broker1.stop(done);
              });
            }, 50);
          });
        });
      });

      it('should send messages to each broker', done => {
        let _client1 = client();

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0']).be.ok();
                should(_broker2._queues['endpoint/1.0']).be.ok();

                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);

                _client1.disconnect(() => {
                  _broker2.stop(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client1.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should ack messages on both sides', done => {
        let _client1 = client();

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              let _nbCalls = 0;

              _client1.listen('endpoint/1.0/test', (err, msg) => {
                _nbCalls++;
                should(err).be.not.ok();
                should(msg).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0'].currentItem).eql(undefined);
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);

                should(_broker2._queues['endpoint/1.0'].currentItem).eql(undefined);
                should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                should(_nbCalls).eql(1);

                _client1.disconnect(() => {
                  _broker2.stop(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client1.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should set isMaster', done => {
        let _client1 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            let _nbCalls = 0;

            _client1.listen('endpoint/1.0/*', (err) => {
              should(err).not.be.ok();
              _nbCalls++;

              _broker1.setIsMaster(false);
              _client1.send('endpoint/1.0/test', { test : 'hello world' });
            });

            setTimeout(() => {
              should(_nbCalls).eql(1);
              _client1.disconnect(() => {
                _broker1.stop(done);
              });
            }, 200);

            setTimeout(() => {
              _client1.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });
            }, 20);
          });
        });
      });

    });

  });

  describe('client', () => {

    describe('connect', () => {
      it('should connect to hosts', done => {
        let _client = client();

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            should(_client.isConnected()).is.False();

            _client.connect({
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              should(_client.isConnected()).is.True();
              _client.disconnect(() => {
                should(_client.isConnected()).is.False();
                _broker1.stop(() => {
                  _broker2.stop(done);
                });
              });
            });
          });
        });
      });

      it('should not call the connect callback after each reconnect', done => {
        let _client = client();
        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);
        _broker1.start(() => {
          _broker2.start(() => {
            _client.connect({
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              _client.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                should(err).not.ok();
                should(_broker1._queues['endpoint/1.0']).be.ok();
                should(_broker2._queues['endpoint/1.0']).be.ok();
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                _broker1.stop(() => {
                  setTimeout(()=> {
                    _broker1.start(() => {
                      should(_broker1._queues['endpoint/1.0']).be.ok();
                      should(_broker2._queues['endpoint/1.0']).be.ok();
                      should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                      should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                      setTimeout(() => {
                        _client.disconnect(() => {
                          _broker1.stop(() => {
                            _broker2.stop(done);
                          });
                        });
                      }, 200);
                    });
                  }, 1000);
                });
              });
            });
          });
        });
      });

      it('should connect to hosts with correct token', done => {
        let _client = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.socketServer.token = '0f1fe85a-b75b-45a9-8518-20b9b7d02edb';
        fs.writeFileSync(configBrokerToken, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerToken);

        _broker1.start(() => {
          _client.connect({
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker.socketServer.port + '@' + _configBroker.serviceId + '#' + _configBroker.socketServer.token
            ]
          }, () => {
            _client.disconnect(() => {
              _broker1.stop(done);
            });
          });
        });
      });

      it('should not connect to hosts with incorrect token', done => {
        let _client = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.socketServer.token = '0f1fe85a-b75b-45a9-8518-20b9b7d02edb';
        fs.writeFileSync(configBrokerToken, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerToken);
        let _hasBeenCalled = false;

        _broker1.start(() => {
          _client.connect({
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker.socketServer.port + '@' + _configBroker.serviceId + '#1700f5e0-400e-49a7-9fee-4a61324f2ef4'
            ]
          }, () => {
            _hasBeenCalled = true;
          });

          setTimeout(() => {
            should(_hasBeenCalled).eql(false);
            _client.disconnect(() => {
              _broker1.stop(done);
            });
          }, 500);
        });
      });

      it('should have created private and public keys', done => {
        let _client  = client();
        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client.connect({
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
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
          });
        });
      });

    });

    describe('listen()', () => {

      it('should listen to a queue', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/test', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should declare listener handler even if no client is connected yet, and catch pending message', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        // set consume handler before to connect
        _client1.listen('endpoint/1.0/test', (err, packet) => {
          console.log('consume', err, packet);
          should(err).not.ok();
          should(packet).eql({
            test : 'hello world'
          });

          setTimeout(() => {
            should(_broker1._queues['endpoint/1.0'].queue).eql([]);
            _client1.disconnect(() => {
              _client2.disconnect(() => {
                _broker1.stop(done);
              });
            });
          }, 20);
        });

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  console.log('message sent', err);
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should not listen to /* ', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client_1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client_2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('*', (err) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should not send to /* ', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/1', (err) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });
              });

              setTimeout(() => {
                _client2.send('*', { test : 'hello world' }, (err) => {
                  should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple clients', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListenClient1HasBeenCalled = false;
        let _isListenClient2HasBeenCalled = false;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _isListenClient1HasBeenCalled = true;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.0/test', (err, packet) => {
                _isListenClient2HasBeenCalled = true;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_isListenClient1HasBeenCalled).eql(true);
                should(_isListenClient2HasBeenCalled).eql(true);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should not listen for multiple listeners if it is the same client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListener1HasBeenCalled = false;
        let _isListener2HasBeenCalled = false;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _isListener1HasBeenCalled = true;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _isListener2HasBeenCalled = true;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_isListener1HasBeenCalled).eql(!_isListener2HasBeenCalled);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should route packets to listeners in round-robin way if the same client has been used', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls = [];

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _handlerCalls.push('handler1');
              });

              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _handlerCalls.push('handler2');
              });

              setTimeout(() => {
                should(_handlerCalls).eql(['handler1', 'handler2', 'handler1', 'handler2']);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
            });
          });
        });
      });

      it('should route packets to listeners in round-robin way if the same client has been used & for other client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls          = [];
        let _nbCallsHandlerClient2 = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _handlerCalls.push('handler1');
              });

              _client1.listen('endpoint/1.0/test', (err, packet) => {
                _handlerCalls.push('handler2');
              });

              _client2.listen('endpoint/1.0/test', (err, packet) => {
                _nbCallsHandlerClient2++;
              });

              setTimeout(() => {
                should(_handlerCalls).eql(['handler1', 'handler2', 'handler1', 'handler2']);
                should(_nbCallsHandlerClient2).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 400);

              setTimeout(() => {
                for (var i = 0; i < 4; i++) {
                  _client2.send('endpoint/1.0/test', { test : 'hello world' });
                }
              }, 50)
            });
          });
        });
      });

      it('should listen for multiple params /endpoint/version/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }
                else {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '3' });
                }

                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple params /endpoint/version/* & listen for /endpoint/version/1', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls        = 0;
        let _nbCallsClient2 = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }
                else {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '3' });
                }

                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsClient2++;
                should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });

                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);
                should(_nbCallsClient2).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should not listen for multiple params /endpoint/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });
                _nbCalls++;
              });

              setTimeout(() => {
                should(_nbCalls).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should not listen for multiple params /endpoint/* & listen for /endpoint/1.0/* &  & listen for /endpoint/1.1/3', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCallsListener1 = 0;
        let _nbCallsListener2 = 0;
        let _nbCallsListener3 = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });
                _nbCallsListener1++;
              });

              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsListener2++;

                if (_nbCallsListener2 === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCallsListener2 === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }

                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.1/3', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsListener3++;
                should(info.channel).eql({ endpoint : 'endpoint', version : '1.1', id : '3' });

                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_nbCallsListener1).eql(1);
                should(_nbCallsListener2).eql(2);
                should(_nbCallsListener3).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen to a queue after packet is sent', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });

              _client1.listen('endpoint/1.0/test', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should listen for multiple ids', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbCallsListener2 = 0;

              _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.0/4', (err, packet) => {
                _nbCallsListener2++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });


              setTimeout(() => {
                should(_nbCallsListener1).eql(3);
                should(_nbCallsListener2).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 50);
            });
          });
        });
      });

      it('should listen for multiple ids : one addId', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbCallsAddId     = 0;
              let _nbErrors         = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.addId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }

                _nbCallsAddId++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsAddId).eql(1);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple ids : multiple addId', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.addId(2, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });
              _listener.addId(3, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });
              _listener.addId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple ids : multiple addId (Array definition)', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.addId([2, 3, 4]);

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple ids & add do nothing if already defined id is added', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.addId(1, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple ids & remove id', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;
              let _nbCallsRemoveId  = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.removeId(3, (err) => {
                if (err) {
                  _nbErrors++;
                }
                _nbCallsRemoveId++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsRemoveId).eql(1);
                should(_nbCallsListener1).eql(2);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should listen for multiple ids & remove do nothing if id is not listened', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _listener.removeId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should track ids : add', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet, info) => {});

            _listener.addId(2, () => {
              should(_listener._handler.ids).eql([1, 2]);

              _listener.addId(3, (err) => {
                should(_listener._handler.ids).eql([1, 2, 3]);

                _client1.disconnect(() => {
                  _broker1.stop(done);
                });
              });
            });
          });
        });
      });

      it('should track ids : remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {});

            _listener.removeId(1, () => {
              should(_listener._handler.ids).eql([2, 3]);

              _listener.removeId(3, (err) => {
                should(_listener._handler.ids).eql([2]);

                _client1.disconnect(() => {
                  _broker1.stop(done);
                });
              });
            });
          });
        });
      });

      it('should track ids : add & remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {});

            _listener.removeId(1, () => {
              should(_listener._handler.ids).eql([2, 3]);

              _listener.addId(4, () => {
                should(_listener._handler.ids).eql([2, 3, 4]);

                _listener.removeId(3, (err) => {
                  should(_listener._handler.ids).eql([2, 4]);

                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should track ids with string endpoint: add & remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _listener = _client1.listen('endpoint/1.0/1', (err, packet, info) => {});

            _listener.removeId(1, () => {
              should(_listener._handler.ids).eql([]);

              _listener.addId(4, () => {
                should(_listener._handler.ids).eql([4]);

                _listener.removeId(4, (err) => {
                  should(_listener._handler.ids).eql([]);

                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should listen for multiple ids', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsClient1 = 0;
              let _nbCallsClient2 = 0;

              let _listener = _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                _nbCallsClient1++;
              });

              _client2.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                _nbCallsClient2++;
              });

              setTimeout(() => {
                should(_nbCallsClient1).eql(1);
                should(_nbCallsClient2).eql(2);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 300);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' }, () => {
                  _listener.removeId(1, () => {
                    _client2.send('endpoint/1.0/1', { test : 'hello world' });
                  });
                });
              }, 20);
            });
          });
        });
      });
    });

    describe('consume()', () => {

      it('should consume a queue', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });

                ack();

                setTimeout(() => {
                  should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 20);
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should declare consume handler even if no client is connected yet, and consume message', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        // set consume handler before to connect
        _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
          console.log('consume', err, packet);
          should(err).not.ok();
          should(packet).eql({
            test : 'hello world'
          });

          ack();

          setTimeout(() => {
            should(_broker1._queues['endpoint/1.0'].queue).eql([]);
            _client1.disconnect(() => {
              _client2.disconnect(() => {
                _broker1.stop(done);
              });
            });
          }, 20);
        });

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  console.log('message sent', err);
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should not consume /* ', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('*', (err) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should consume for multiple clients', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListenClient1HasBeenCalled = false;
        let _isListenClient2HasBeenCalled = false;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
              _isListenClient1HasBeenCalled = true;
              ack();
              should(err).not.ok();
              should(packet).eql({
                test : 'hello world'
              });
            });

            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.consume('endpoint/1.0/test', (err, packet, ack) => {
                _isListenClient2HasBeenCalled = true;
                ack();
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_isListenClient1HasBeenCalled).eql(true);
                should(_isListenClient2HasBeenCalled).eql(false);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should not consume for multiple listeners if it is the same client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListener1HasBeenCalled = false;
        let _isListener2HasBeenCalled = false;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _isListener1HasBeenCalled = true;
                ack();
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _isListener2HasBeenCalled = true;
                ack();
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              setTimeout(() => {
                should(_isListener1HasBeenCalled).eql(!_isListener2HasBeenCalled);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should route packets to listeners in round-robin way if the same client has been used', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls = [];

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _handlerCalls.push('handler1');
                ack();
              });

              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _handlerCalls.push('handler2');
                ack();
              });

              setTimeout(() => {
                should(_handlerCalls).eql(['handler1', 'handler2', 'handler1', 'handler2']);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
            });
          });
        });
      });

      it('should route packets to listeners in round-robin way if the same client has been used & for other client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls = [];

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
              _handlerCalls.push('handler1');
              ack();
            });

            _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
              _handlerCalls.push('handler2');
              ack();
            });

            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.consume('endpoint/1.0/test', (err, packet, ack) => {
                _handlerCalls.push('handler3');
                ack();
              });

              setTimeout(() => {
                should(_handlerCalls).eql(['handler1', 'handler2', 'handler3', 'handler1']);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 200);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
            });
          });
        });
      });

      it('should consume for multiple params /endpoint/version/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }
                else {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '3' });
                }

                should(packet).eql({
                  test : 'hello world'
                });

                ack();
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple params /endpoint/version/* & consume for /endpoint/version/1', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls        = 0;
        let _nbCallsClient2 = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }
                else {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '3' });
                }

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              _client2.consume('endpoint/1.0/1', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsClient2++;
                should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);
                should(_nbCallsClient2).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should not consume for multiple params /endpoint/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/*', (err, packet, ack, info) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL })
                _nbCalls++;
              });

              setTimeout(() => {
                should(_nbCalls).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should not consume for multiple params /endpoint/* & consume for /endpoint/1.0/* &  & consume for /endpoint/1.1/3', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCallsListener1 = 0;
        let _nbCallsListener2 = 0;
        let _nbCallsListener3 = 0;

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/*', (err, packet, ack, info) => {
                should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });
                _nbCallsListener1++;
              });

              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsListener2++;

                if (_nbCallsListener2 === 1) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '1' });
                }
                else if (_nbCallsListener2 === 2) {
                  should(info.channel).eql({ endpoint : 'endpoint', version : '1.0', id : '2' });
                }

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              _client2.consume('endpoint/1.1/3', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsListener3++;
                should(info.channel).eql({ endpoint : 'endpoint', version : '1.1', id : '3' });

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              setTimeout(() => {
                should(_nbCallsListener1).eql(1);
                should(_nbCallsListener2).eql(2);
                should(_nbCallsListener3).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume to a queue after packet is sent', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });

              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                ack();

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should consume for multiple ids : multiple ids', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;

              _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, done) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              setTimeout(() => {
                should(_nbCallsListener1).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids : one addId', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;
              let _nbCallsAddId     = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, done) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.addId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }
                _nbCallsAddId++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsAddId).eql(1);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids : multiple addId', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet, done) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.addId(2, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });
              _consumer.addId(3, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });
              _consumer.addId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids : multiple addId (Array definition)', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;
              let _nbCallsAddId     = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet, done) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.addId([2, 3, 4], (err) => {
                if (err) {
                  _nbErrors++;
                }
                _nbCallsAddId++;
              });

              setTimeout(() => {
                should(_nbCallsAddId).eql(1);
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(4);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
                _client2.send('endpoint/1.0/4', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids & add do nothing if already defined id is added', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, done) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.addId(1, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids & remove id', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;
              let _nbCallsRemoveId  = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, done, info) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.removeId(3, (err) => {
                if (err) {
                  _nbErrors++;
                }
                _nbCallsRemoveId++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsRemoveId).eql(1);
                should(_nbCallsListener1).eql(2);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should consume for multiple ids & remove do nothing if id is not listened', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbErrors         = 0;

              let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, done, info) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              _consumer.removeId(4, (err) => {
                if (err) {
                  _nbErrors++;
                }
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(3);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        });
      });

      it('should track ids : add', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet, info) => {});

            _consumer.addId(2, () => {
              should(_consumer._handler.ids).eql([1, 2]);

              _consumer.addId(3, (err) => {
                should(_consumer._handler.ids).eql([1, 2, 3]);

                _client1.disconnect(() => {
                  _broker1.stop(done);
                });
              });
            });
          });
        });
      });

      it('should track ids : remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {});

            _consumer.removeId(1, () => {
              should(_consumer._handler.ids).eql([2, 3]);

              _consumer.removeId(3, (err) => {
                should(_consumer._handler.ids).eql([2]);

                _client1.disconnect(() => {
                  _broker1.stop(done);
                });
              });
            });
          });
        });
      });

      it('should track ids : add & remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _consumer = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [1, 2, 3] }, (err, packet, info) => {});

            _consumer.removeId(1, () => {
              should(_consumer._handler.ids).eql([2, 3]);

              _consumer.addId(4, () => {
                should(_consumer._handler.ids).eql([2, 3, 4]);

                _consumer.removeId(3, (err) => {
                  should(_consumer._handler.ids).eql([2, 4]);

                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should track ids with string endpoint: add & remove', done => {
        let _client1 = client();
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {

            let _consumer = _client1.consume('endpoint/1.0/1', (err, packet, info) => {});

            _consumer.removeId(1, () => {
              should(_consumer._handler.ids).eql([]);

              _consumer.addId(4, () => {
                should(_consumer._handler.ids).eql([4]);

                _consumer.removeId(4, (err) => {
                  should(_consumer._handler.ids).eql([]);

                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });
            });
          });
        });
      });

      it('should consume ids : consume with no id, then addId', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            let _nbCallsListener1 = 0;
            let _consumer1 = _client1.consume({ endpoint : 'endpoint', version : '1.0', ids : [] }, (err, packet, done, info) => {
              _nbCallsListener1++;
              should(err).not.ok();
              should(packet).eql({
                test : 'hello world'
              });
              done();
            });

            _consumer1.addId([1], (err) => {
              if (err) {
                _nbErrors++;
              }
            });

            _client2.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {

              let _nbCallsListener2 = 0;
              let _nbErrors         = 0;
              _client2.consume({ endpoint : 'endpoint', version : '1.0', ids : [1] }, (err, packet, done, info) => {
                _nbCallsListener2++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                done();
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
                should(_nbCallsListener1).eql(2);
                should(_nbCallsListener2).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
              }, 60);
            });
          });
        });
      });
    });

    describe('send()', () => {

      it('should not be able to send a ack', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send('endpoint/endpoint/1', { test : 'hello world' }, (err, msg, info) => {
                  try {
                    info();
                  }
                  catch (e) {
                    should(e.message).eql('info is not a function');
                    should(info).be.an.Object();
                  }

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }, 20);
            });
          });
        });
      });

      it('should not send to /endpoint/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send('endpoint/*', { test : 'hello world' }, (err) => {
                  should(err).eql({ message : constants.ERRORS.BAD_ENPOINT_ALL });
                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }, 20);
            });
          });
        });
      });

      it('should not send to /endpoint/version/[id1, id2]', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, { test : 'hello world' }, (err) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }, 20);
            });
          });
        });
      });

      it('should send to /endpoint/versions/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _isListener1HasBeenCalled = false;
              let _isListener2HasBeenCalled = false;

              _client1.listen('endpoint/1.0/1', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                _isListener1HasBeenCalled = true;
              });

              _client1.listen('endpoint/1.0/2', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                _isListener2HasBeenCalled = true;
              });

              setTimeout(() => {
                should(_isListener1HasBeenCalled).eql(true);
                should(_isListener2HasBeenCalled).eql(true);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should send to /endpoint/param', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _isListener1HasBeenCalled = false;
              let _isListener2HasBeenCalled = false;

              _client1.listen('endpoint/1.0/1', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                _isListener1HasBeenCalled = true;
              });

              _client1.listen('endpoint/1.0/2', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
                _isListener2HasBeenCalled = true;
              });

              setTimeout(() => {
                should(_isListener1HasBeenCalled).eql(false);
                should(_isListener2HasBeenCalled).eql(true);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should send the message even if no client is connected yet', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            let _isListenerHasBeenCalled = false;

            _client1.listen('endpoint/1.0/1', (err, packet) => {
              should(err).not.ok();
              should(packet).eql({
                test : 'hello world'
              });
              _isListenerHasBeenCalled = true;
            });

            // send it before to connect
            _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
              should(err).not.ok();
            });

            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                should(_isListenerHasBeenCalled).eql(true);
                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 1500); // retry timer is set as 1000ms
            });
          });
        });
      });
    });

    describe('redeliver', () => {

      it('should resend the message until the limit is reached : timeout', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRedeliver1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _nbCalls++;

                if (_nbCalls === 3) {
                  ack();
                }
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);
                should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 4000);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should resend the message until the limit is reached to another consumer : timeout', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRedeliver1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            let _nbCallsListener1 = 0;
            _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
              _nbCallsListener1++;

              if (_nbCallsListener1 > 2) {
                ack();
              }
            });

            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener2 = 0;

              _client2.consume('endpoint/1.0/test', (err, packet, ack) => {
                _nbCallsListener2++;
                if (_nbCallsListener2 > 2) {
                  ack();
                }
              });

              setTimeout(() => {
                should(_nbCallsListener1).eql(2);
                should(_nbCallsListener2).eql(1);
                should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 3000);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should resend the message until the limit is reached : timeout & 2 brokers', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRedeliver1);
        let _broker2 = broker(configBrokerRedeliver2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                  'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
                ]
              }, () => {
                let _nbCalls = 0;
                _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                  _nbCalls++;

                  if (_nbCalls === 3) {
                    ack();
                  }
                });

                setTimeout(() => {
                  should(_nbCalls).eql(3);
                  should(_broker1._queues['endpoint/1.0']).be.ok();
                  should(_broker1._queues['endpoint/1.0'].currentItem).eql(undefined);
                  should(_broker2._queues['endpoint/1.0']).be.ok();
                  should(_broker2._queues['endpoint/1.0'].currentItem).eql(undefined);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(() => {
                        _broker2.stop(done);
                      });
                    });
                  });
                }, 3500);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                  });
                }, 20);
              });
            });
          });
        });
      });

      it('should resend the message : ack false', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRedeliver1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.consume('endpoint/1.0/test', (err, packet, ack, info) => {
                _nbCalls++;

                if (_nbCalls === 1) {
                  return ack(false);
                }

                should(info.nbRequeues).eql(1);
                ack();
              });

              setTimeout(() => {
                should(_nbCalls).eql(2);
                should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 2000);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should resend the message when ack is false : 2 brokers', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRedeliver1);
        let _broker2 = broker(configBrokerRedeliver2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                  'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
                ]
              }, () => {
                let _nbCalls = 0;
                _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                  _nbCalls++;
                  ack(false);

                  if (_nbCalls === 3) {
                    ack();
                  }
                });

                setTimeout(() => {
                  should(_nbCalls).eql(3);
                  should(_broker1._queues['endpoint/1.0']).be.ok();
                  should(_broker1._queues['endpoint/1.0'].currentItem).eql(undefined);
                  should(_broker2._queues['endpoint/1.0']).be.ok();
                  should(_broker2._queues['endpoint/1.0'].currentItem).eql(undefined);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(() => {
                        _broker2.stop(done);
                      });
                    });
                  });
                }, 3500);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                  });
                }, 20);
              });
            });
          });
        });
      });

      it('should resent message : nack with delay', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let firstTry = null;
              _client1.consume('endpoint/1.0/test', (err, packet, ack, headers) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });

                if (!headers.nbRequeues) {
                  firstTry = Date.now();
                  ack(false, 1);
                }
                else {
                  ack();
                  should(Date.now()).be.aboveOrEqual(firstTry + 1000);
                  should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                  should(_broker1._queues['endpoint/1.0'].queueRequeue).eql([]);
                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

    });

    describe('format', () => {

      it('should not send to listener if bad format', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            map : {
              id    : ['int'],
              label : ['string']
            }
          }
        }

        fs.writeFileSync(configBrokerFormat, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerFormat);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker.socketServer.port + '@' + _configBroker.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker.socketServer.port + '@' + _configBroker.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.listen('endpoint/1.0/*', (err) => {
                _nbCalls++;
              });

              let _nbErrors = 0;
              setTimeout(() => {
                _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                  should(err.message).eql(constants.ERRORS.BAD_FORMAT);
                  should(err.error).be.an.Array().and.have.lengthOf(2);
                  _nbErrors++;
                });
              }, 20);

              setTimeout(() => {
                should(_nbCalls).eql(0);
                should(_nbErrors).eql(1);

                _client2.disconnect(() => {
                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  })
                });
              }, 100);
            });
          });
        });
      });

      it('should send to listener if correct format', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            map : {
              id    : ['int'],
              label : ['string']
            }
          }
        }
        fs.writeFileSync(configBrokerFormat, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerFormat);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.listen('endpoint/1.0/*', (err, msg) => {
                _nbCalls++;
                should(msg).eql({
                  id    : 1,
                  label : 'SpaceX'
                });
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/*', { id : 1, label : 'SpaceX' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);

              setTimeout(() => {
                should(_nbCalls).eql(1);

                _client2.disconnect(() => {
                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  })
                });
              }, 100);
            });
          });
        });
      });

      it('should send to listener if correct format : sub array', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            map : {
              id       : ['int'],
              label    : ['string'],
              products : ['array', {
                id    : ['int'],
                label : ['string']
              }]
            }
          }
        }

        fs.writeFileSync(configBrokerFormat, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerFormat);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls      = 0;
              let _expectedData = {
                id : 1,
                label : 'SpaceX',
                products : [
                  { id : 1, label : 'BFR'      },
                  { id : 2, label : 'Falcon 9' },
                ]
              };
              _client1.listen('endpoint/1.0/*', (err, msg) => {
                _nbCalls++;
                should(msg).eql(_expectedData);
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/*', _expectedData, (err) => {
                  should(err).not.ok();
                });
              }, 20);

              setTimeout(() => {
                should(_nbCalls).eql(1);

                _client2.disconnect(() => {
                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  })
                });
              }, 100);
            });
          });
        });
      });

      it('should send to listener if correct format : sub object', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            map : {
              id      : ['int'],
              label   : ['string'],
              company : ['object', {
                id    : ['int'],
                label : ['string']
              }]
            }
          }
        }

        fs.writeFileSync(configBrokerFormat, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerFormat);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls      = 0;
              let _expectedData = {
                id      : 1,
                label   : 'Falcon 9',
                company : {
                  id    : 1,
                  label : 'SpaceX'
                }
              };
              _client1.listen('endpoint/1.0/*', (err, msg) => {
                _nbCalls++;
                should(msg).eql(_expectedData);
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/*', _expectedData, (err) => {
                  should(err).not.ok();
                });
              }, 20);

              setTimeout(() => {
                should(_nbCalls).eql(1);

                _client2.disconnect(() => {
                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  })
                });
              }, 100);
            });
          });
        });
      });
    });

    describe('rules', () => {

      describe('read', () => {

        it('should allow client1 and client2', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;
          let _isErrorHasBeenCalled         = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client1.listen('endpoint/1.0/2', (err, packet) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _isErrorHasBeenCalled = true;
                });

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                  });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 and client2 to read', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/test']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                _client1.listen('endpoint/1.0/test', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client2.listen('endpoint/1.0/test', (err, packet) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                  });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 to read and client2 : /endpoint/1.0/* & listen to /endpoint/1.0/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;
                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint/1.1/2', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 to read and client2 : /endpoint/1.0/* & listen to /endpoint/1.0/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;
                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint/1.1/*', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/*', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 to read and client2 : /endpoint/* & listen to /endpoint/version/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;

                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint_2/1.0/1', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 to read and client2 : /endpoint/* & listen to /endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint_2/1.0/*', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/*', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client_*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;
          let _isErrorHasBeenCalled         = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client1.listen('endpoint/1.0/2', (err, packet) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _isErrorHasBeenCalled = true;
                });

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                  });
                }, 20);
              });
            });
          });
        });

        it('should allow client_* : /endpoint/1.0/* & listen to /endpoint/1.0/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;
                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint/1.1/2', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client_* : /endpoint/1.0/* & listen to /endpoint/1.0/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;
                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint/1.1/*', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/*', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client_* : /endpoint/* & listen to /endpoint/version/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;

                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint_2/1.0/1', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client_* : /endpoint/* & listen to /endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _isListenClient1HasBeenCalled = false;
                let _isListenClient2HasBeenCalled = false;
                let _isErrorHasBeenCalled         = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _isListenClient1HasBeenCalled = true;
                  should(err).not.ok();
                });

                _client1.listen('endpoint_2/1.0/*', (err, packet) => {
                  _isErrorHasBeenCalled = true;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client2.listen('endpoint/1.0/*', (err, packet, info) => {
                  _isListenClient2HasBeenCalled = true;
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_isListenClient1HasBeenCalled).eql(true);
                  should(_isListenClient2HasBeenCalled).eql(true);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client1 and refused client2 to read : !endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['!endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                _nbCallsListener1++;

                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener2 = 0;
                let _nbErrors         = 0;

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _nbErrors++;
                });

                _client2.listen('endpoint/1.0/3', (err, packet) => {
                  _nbCallsListener2++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  should(_nbCallsListener1).eql(2);
                  should(_nbCallsListener2).eql(1);
                  should(_nbErrors).eql(1);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                  _client2.send('endpoint/1.0/2', { test : 'hello world' });
                  _client2.send('endpoint/1.0/3', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should allow client_* to read : !endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['!endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                _nbCallsListener1++;

                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener2 = 0;
                let _nbErrors         = 0;

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _nbErrors++;
                });

                _client2.listen('endpoint/1.0/3', (err, packet) => {
                  _nbCallsListener2++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client2.listen('endpoint/1.0/3', (err, packet) => {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                  _nbErrors++;
                });

                setTimeout(() => {
                  should(_nbCallsListener1).eql(2);
                  should(_nbCallsListener2).eql(1);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                  _client2.send('endpoint/1.0/2', { test : 'hello world' });
                  _client2.send('endpoint/1.0/3', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

        it('should not add : !endpoint/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['!endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                _nbCallsListener1++;

                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener2 = 0;

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  _nbCallsListener2++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  should(_nbCallsListener1).eql(2);
                  should(_nbCallsListener2).eql(1);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/1', { test : 'hello world' });
                  _client2.send('endpoint/1.0/2', { test : 'hello world' });
                  _client2.send('endpoint/1.0/3', { test : 'hello world' });
                }, 20);
              });
            });
          });
        });

      });

      describe('write', () => {

        it('should allow client1 & client2 to write : rule endpoint/version/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived   = 0;
                let _nbMessagesSent       = 0;
                let _isErrorHasBeenCalled = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _isErrorHasBeenCalled = true;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(3);
                  should(_nbErrors).eql(1);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/*']
            }
          ];
          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint_2/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(3);
                  should(_nbErrors).eql(1);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 200);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/version/param & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived   = 0;
                let _nbMessagesSent       = 0;
                let _isErrorHasBeenCalled = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _isErrorHasBeenCalled = true;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/version/* & send to endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived   = 0;
                let _nbMessagesSent       = 0;
                let _isErrorHasBeenCalled = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _isErrorHasBeenCalled = true;
                  });

                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/* & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived   = 0;
                let _nbMessagesSent       = 0;
                let _isErrorHasBeenCalled = false;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });
                _client1.listen('endpoint/1.1/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint_2/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _isErrorHasBeenCalled = true;
                  });

                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_isErrorHasBeenCalled).eql(true);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/version/param', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived   = 0;
                let _nbMessagesSent       = 0;
                let _nbErrors             = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(3);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });
                _client1.listen('endpoint/1.1/*', (err, packet, info) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client1.send('endpoint_2/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint_2/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(3);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 250);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/version/param & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/1']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client1.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                    should(err).not.ok();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 100);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/version/* & send to endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });
                  _client2.send('endpoint/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/* & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/*']
            }
          ];

          fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(configBrokerRule);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
                ]
              }, () => {
                let _nbMessagesReceived = 0;
                let _nbMessagesSent     = 0;
                let _nbErrors           = 0;

                _client1.listen('endpoint/1.0/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });
                _client1.listen('endpoint/1.1/*', (err, packet) => {
                  _nbMessagesReceived++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                setTimeout(() => {
                  _client1.send('endpoint_2/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });
                  _client2.send('endpoint_2/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                    _nbErrors++;
                  });

                  _client1.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });

                  _client2.send('endpoint/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).not.eql();
                    _nbMessagesSent++;
                  });
                }, 20);

                setTimeout(() => {
                  should(_nbMessagesSent).eql(_nbMessagesReceived);
                  should(_nbMessagesSent).eql(2);
                  should(_nbErrors).eql(2);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 150);
              });
            });
          });
        });
      });
    });

    describe('disconnection', () => {

      it('should connect/disconnect then connect same client', done => {
        let _client1 = client();
        let _client2 = client();

        let _configClient = {
          clientId      : 'client_1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
          ]
        };
        _configClient2 = {
          clientId      : 'client_2',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
          ]
        };

        let _broker1 = broker(configBroker1);

        let _nbDisconnections = 0;

        let _register = () => {
          should(_client1.isConnected()).is.False();
          should(_client2.isConnected()).is.False();

          _client1.connect(_configClient, () => {
            should(_client1.isConnected()).is.True();
            _client2.connect(_configClient2, () => {
              should(_client2.isConnected()).is.True();

              _client2.listen('endpoint/1.0/test', (err, packet) => {});

              _client1.listen('endpoint/1.0/test', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });

                // Little timeout to let time to listeners to register
                setTimeout(() => {
                  _client1.disconnect(() => {
                    should(_client1.isConnected()).is.False();

                    _client2.disconnect(() => {
                      _nbDisconnections++;
                      should(_client2.isConnected()).is.False();

                      if (_nbDisconnections > 1) {
                        return _broker1.stop(done);
                      }

                      _register();
                    });
                  });
                }, 150)
              });

              setTimeout(() => {
                _client1.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 40);
            });
          });
        }

        _broker1.start(_register);
      });

      it('should add message in waiting queue if no client is listening', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {

              _client1.consume('endpoint/1.0/test', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client1.disconnect();

              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0'].queueSecondary['test']).have.lengthOf(1);
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(1);
                _client2.disconnect(() => {
                  _broker1.stop(done);
                });
              }, 60);

              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should send "waiting" messages when client is reconnecting', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _configClient1 = {
          clientId      : 'client_1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
          ]
        };

        _broker1.start(() => {
          _client1.connect(_configClient1, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {

              function client1 () {
                _client1.consume('endpoint/1.0/test', (err, packet) => {
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });

                  should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                  should(_broker1._queues['endpoint/1.0'].queueSecondary['test']).eql([]);
                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }

              client1();
              _client1.disconnect();

              setTimeout(() => {
                _client1.connect(_configClient1, () => {
                  client1();
                });
              }, 60);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should not add message in waiting queue if limit is reached', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker             = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.maxItemsInQueue = 2;

        fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerRule);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {

              _client1.consume('endpoint/1.0/test', (err, packet) => {
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client1.disconnect();

              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0'].queueSecondary['test']).have.lengthOf(2);
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(2);
                _client2.disconnect(() => {
                  _broker1.stop(done);
                });
              }, 60);

              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
                _client2.send('endpoint/1.0/test', { test : 'hello world 2' });
                _client2.send('endpoint/1.0/test', { test : 'hello world 3' });
              }, 20);
            });
          });
        });
      });

      it('should send waiting messages when client is reconnecting : different ids', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _configClient1 = {
          clientId      : 'client_1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
          ]
        };

        _broker1.start(() => {
          _client1.connect(_configClient1, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;

              function client1 () {
                _client1.consume('endpoint/1.0/*', (err, packet, done) => {
                  should(err).not.ok();
                  _nbCalls++;
                  done();
                });
              }

              client1();
              _client1.disconnect();

              setTimeout(() => {
                _client1.connect(_configClient1, () => {
                  client1();

                  setTimeout(() => {
                    should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                    should(_broker1._queues['endpoint/1.0'].queueSecondary['test']).eql([]);
                    should(_broker1._queues['endpoint/1.0'].queueSecondary['1']).eql([]);
                    should(_nbCalls).eql(2);

                    _client1.disconnect(() => {
                      _client2.disconnect(() => {
                        _broker1.stop(done);
                      });
                    });
                  }, 60);
                });
              }, 60);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
                _client2.send('endpoint/1.0/1'   , { test : 'hello world 2' });
              }, 20);
            });
          });
        });
      });

      it('should send waiting messages when client is reconnecting : 2 brokers', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);
        let _broker2 = broker(configBroker2);

        let _configClient1 = {
          clientId      : 'client_1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
            'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId,
          ]
        };

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect(_configClient1, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId,
                  'localhost:' + _configBroker2.socketServer.port + '@' + _configBroker2.serviceId
                ]
              }, () => {
                let _nbCalls = 0;

                function client1 () {
                  _client1.consume('endpoint/1.0/*', (err, packet, done) => {
                    should(err).not.ok();
                    _nbCalls++;
                    done();
                  });
                }

                client1();
                _client1.disconnect();

                setTimeout(() => {
                  _client1.connect(_configClient1, () => {
                    client1();

                    setTimeout(() => {
                      should(_broker1._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                      should(_broker1._queues['endpoint/1.0'].queueSecondary['test']).eql([]);
                      should(_broker1._queues['endpoint/1.0'].queueSecondary['1']).eql([]);

                      should(_broker2._queues['endpoint/1.0'].queueSecondary._nbMessages).eql(0);
                      should(_broker2._queues['endpoint/1.0'].queueSecondary['test']).eql([]);
                      should(_broker2._queues['endpoint/1.0'].queueSecondary['1']).eql([]);
                      should(_nbCalls).eql(2);

                      _client1.disconnect(() => {
                        _client2.disconnect(() => {
                          _broker1.stop(() => {
                            _broker2.stop(done);
                          });
                        });
                      });
                    }, 60);
                  });
                }, 60);

                setTimeout(() => {
                  _client2.send('endpoint/1.0/test', { test : 'hello world' });
                  _client2.send('endpoint/1.0/1'   , { test : 'hello world 2' });
                }, 20);
              });
            });
          });
        });
      });

      it('should start/stop the broker without dropping packets', done => {
        let _client1 = client();

        let _configClient = {
          clientId      : 'client_1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId + '@' + configBroker1.serviceId
          ]
        };

        executeCluster(['broker.js'], (err) => {
          let _nbMessagesSent     = 0;
          let _nbMessagesReceived = 0;

          _client1.connect(_configClient, () => {});

          setTimeout(() => {
            _client1.listen('endpoint/1.0/test', (err, packet, info) => {
              should(err).not.ok();
              should(packet).eql({
                test : 'hello world'
              });
              _nbMessagesReceived++;
            });
          }, 50);

          var _interval = setInterval(() => {
            _nbMessagesSent++;
            _client1.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
              should(err).not.ok();
            });
          }, 50);

          setTimeout(() => {
            stopCluster(() => {
              executeCluster(['broker.js'], (err) => {
                setTimeout(() => {
                  clearInterval(_interval);
                  setTimeout(() => {
                    _client1.disconnect(() => {
                      stopCluster(() => {
                        should(_nbMessagesSent).be.approximately(_nbMessagesReceived, 2);
                        done();
                      });
                    });
                  }, 800);
                }, 200);
              });
            });
          }, 300);
        });
      });

    });

    describe('reload', () => {

      it('should reload channel formats', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            map : {
              id    : ['int'],
              label : ['string']
            }
          }
        };

        fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerRule);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.listen('endpoint/1.0/*', (err) => {
                _nbCalls++;
              });

              let _nbErrors = 0;
              setTimeout(() => {
                _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                  should(err.message).eql(constants.ERRORS.BAD_FORMAT);
                  should(err.error).be.an.Array().and.have.lengthOf(2);
                  _nbErrors++;
                });
              }, 20);

              setTimeout(() => {
                should(_nbCalls).eql(0);
                should(_nbErrors).eql(1);

                _configBroker.channels = {
                  'endpoint/1.0' : {
                    map : {
                      test : ['string']
                    }
                  }
                };

                fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

                _broker1.reload();

                _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_nbCalls).eql(1);

                  _client2.disconnect(() => {
                    _client1.disconnect(() => {
                      _broker1.stop(done);
                    })
                  });
                }, 40);
              }, 60);
            });
          });
        });
      });

      it('should reload rules', done => {
        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.rules = [
          {
            client : 'client_1',
            read   : ['endpoint/1.0/1']
          }
        ];

        fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBrokerRule);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbCallsListener2 = 0;

              _client1.listen('endpoint/1.0/1', (err, packet) => {
                _nbCallsListener1++;
                should(err).not.ok();
                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client1.listen('endpoint/1.0/2', (err, packet) => {
                _nbCallsListener2++;

                if (_nbCallsListener2 === 1) {
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                }
              });

              _client2.listen('endpoint/1.0/1', (err, packet) => {
                _isListenClient2HasBeenCalled = true;
                should(err).not.ok();
              });

              setTimeout(() => {
                should(_nbCallsListener1).eql(1);
                should(_nbCallsListener2).eql(1);

                let _nbCallsListener3 = 0;
                let _nbCallsListener4 = 0;

                _configBroker.rules = [
                  {
                    client : 'client_1',
                    read   : ['endpoint/1.0/2']
                  }
                ];

                fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

                _broker1.reload();

                _client1.listen('endpoint/1.0/1', (err, packet) => {
                  _nbCallsListener3++;
                  should(err).eql({ message : constants.ERRORS.NOT_ALLOWED });
                });

                _client1.listen('endpoint/1.0/2', (err, packet) => {
                  _nbCallsListener4++;
                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client2.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });

                setTimeout(() => {
                  should(_nbCallsListener3).eql(1);
                  should(_nbCallsListener4).eql(1);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                }, 60);
              }, 150);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' }, (err) => {
                  should(err).not.ok();
                });
              }, 20);
            });
          });
        });
      });

      it('should reload channel config', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(_configBroker1));
        _configBroker.channels = {
          'endpoint/1.0' : {
            prefetch : 1
          }
        };

        fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

        let _broker1 = broker(configBrokerRule);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + _configBroker1.socketServer.port + '@' + _configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              let acks     = [];
              _client1.consume('endpoint/1.0/*', (err, message, ack, info) => {
                _nbCalls++;
                acks.push(ack);

                if (_nbCalls === 3) {
                  ack();
                }
              });

              _configBroker.channels = {
                'endpoint/1.0' : {
                  prefetch : 2
                }
              };

              fs.writeFileSync(configBrokerRule, JSON.stringify(_configBroker));

              _broker1.reload();

              _client2.send('endpoint/1.0/bla', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });
              _client2.send('endpoint/1.0/bla', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });
              _client2.send('endpoint/1.0/bla', { test : 'hello world' }, (err) => {
                should(err).not.ok();
              });

              setTimeout(() => {
                should(_nbCalls).eql(2);

                acks.forEach(ack => ack());

                _client2.disconnect(() => {
                  _client1.disconnect(() => {
                    _broker1.stop(done);
                  })
                });
              }, 200);
            });
          });
        });
      });

    });
  });

});


var tempFolderPath = path.join(__dirname, '.temp');
var pidsFilePath   = path.join(tempFolderPath, 'pids');

function executeCluster(params, callback){
  killPreviousPids();

  var _executionPath = path.join(rootPath, 'test', 'datasets');

  program = spawn('node', params, { cwd : _executionPath, stdio :  [ process.stdin, process.stdout, process.stderr, 'ipc' ] });

  setTimeout(callback, 1500);
  program.on('message', function (msg) {
    if(msg !== null && typeof msg === 'object' && msg.ready && callback){
    }
  });

  program.on('error', (err) => {
    console.log(err);
  })

  fs.appendFileSync(pidsFilePath, program.pid + '\n', 'utf8');
}


function stopCluster(callback){
  if(program){
    process.kill(program.pid);
    program = null;
  }

  setTimeout(function(){
    callback();
  }, 500);
}

function prepareTempFolder () {
  if(!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath);
  if(!fs.existsSync(pidsFilePath))   fs.writeFileSync(pidsFilePath, '', 'utf8');
}

function killPreviousPids () {
  prepareTempFolder();
  var pids = fs.readFileSync(pidsFilePath, 'utf8').split('\n');
  pids.forEach(function (pid) {
    if(pid !== ''){
      try{ process.kill(pid); }
      catch(e){}
    }
  });
  fs.writeFileSync(pidsFilePath, '', 'utf8');
}
