const path      = require('path');
const fs        = require('fs');
const should    = require('should');
const broker    = require('../index').broker;
const client    = require('../index').client;
const Socket    = require('kitten-socket');
const constants = require('../lib/broker/constants');

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
  isMaster : true
};

const configBroker2 = {
  serviceId             : 'broker-2',
  registeredClientsPath : path.join(__dirname, 'clients_2'),
  keysDirectory         : path.join(__dirname, 'keys'),
  keysName              : 'broker2',
  socketServer          : {
    port            : 1236,
    logs            : 'packets',
    packetsFilename : 'broker2.log'
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

    deleteKeys(path.join(__dirname, 'clients'));
    deleteKeys(path.join(__dirname, 'clients_2'));
    deleteKeys(path.join(__dirname, 'keys'));
  });

  describe('broker', () => {

    describe('instanciation', () => {

      it('should instanciate brocker socket server', done => {
        let _broker = broker(configBroker1);
        _broker.start(() => {

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
      });

      it('should have created private and public keys', done => {
        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          should(fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pem'))).eql(true);
          should(fs.existsSync(path.join(configBroker1.keysDirectory, configBroker1.keysName + '.pub'))).eql(true);

          _broker1.stop(done);
        });
      });

      it('should have sent public key', done => {
        let _client = client();

        if (fs.existsSync(path.join(__dirname, 'clients', 'client-1.pub'))) {
          fs.unlinkSync(path.join(__dirname, 'clients', 'client-1.pub'));
        }

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client.connect({
            clientId      : 'client-1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {

            setTimeout(() => {
              should(fs.existsSync(path.join(__dirname, 'clients', 'client-1.pub'))).eql(true);
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
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
              ]
            }, () => {
              setTimeout(() => {
                should(_broker1._queues['endpoint/1.0']).be.ok();
                should(_broker2._queues['endpoint/1.0']).be.ok();

                should(_broker1._queues['endpoint/1.0'].currentItem).be.ok();
                should(_broker2._queues['endpoint/1.0'].currentItem).be.ok();

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
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
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
                should(_broker1._queues['endpoint/1.0'].currentItem).eql(undefined);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
            _client.connect({
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                'localhost:' + configBroker2.socketServer.port
              ]
            }, () => {
              _client.disconnect(() => {
                _broker1.stop(() => {
                  _broker2.stop(done);
                });
              });
            });
          });
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
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client_2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('*', (err) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/1', (err) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);
              });

              setTimeout(() => {
                _client2.send('*', { test : 'hello world' }, (err) => {
                  should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              }, 200);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.0/3');
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.0/3');
                }

                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.0/1', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsClient2++;
                should(info.channel).eql('endpoint/1.0/1');

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);
                _nbCallsListener1++;
              });

              _client1.listen('endpoint/1.0/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsListener2++;

                if (_nbCallsListener2 === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCallsListener2 === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }

                should(packet).eql({
                  test : 'hello world'
                });
              });

              _client2.listen('endpoint/1.1/3', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsListener3++;
                should(info.channel).eql('endpoint/1.1/3');

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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

              _listener.addId(4, (err) => {
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
              });
              _listener.addId(3, (err) => {
                _nbErrors++;
              });
              _listener.addId(4, (err) => {
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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

              _listener.removeId(3, (err) => {
                _nbErrors++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('*', (err) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              }, 100);

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.0/3');
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.0/3');
                }

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              _client2.consume('endpoint/1.0/1', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsClient2++;
                should(info.channel).eql('endpoint/1.0/1');

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/*', (err, packet, ack, info) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL)
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client1.consume('endpoint/*', (err, packet, ack, info) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);
                _nbCallsListener1++;
              });

              _client1.consume('endpoint/1.0/*', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsListener2++;

                if (_nbCallsListener2 === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCallsListener2 === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }

                should(packet).eql({
                  test : 'hello world'
                });
                ack();
              });

              _client2.consume('endpoint/1.1/3', (err, packet, ack, info) => {
                should(err).not.ok();
                _nbCallsListener3++;
                should(info.channel).eql('endpoint/1.1/3');

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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

              _consumer.addId(4, (err) => {
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
              });
              _consumer.addId(3, (err) => {
                _nbErrors++;
              });
              _consumer.addId(4, (err) => {
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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

              _consumer.removeId(3, (err) => {
                _nbErrors++;
              });

              setTimeout(() => {
                should(_nbErrors).eql(0);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                _nbErrors++;
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
    });

    describe('send()', () => {

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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send('endpoint/*', { test : 'hello world' }, (err) => {
                  should(err).eql(constants.ERRORS.BAD_ENPOINT_ALL);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              setTimeout(() => {
                _client2.send({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, { test : 'hello world' }, (err) => {
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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

    });

    describe('redeliver', () => {

      it('should resend the message until the limit is reached : timeout', done => {
        let _client1 = client();
        let _client2 = client();

        let _configBroker = JSON.parse(JSON.stringify(configBroker1));
        _configBroker.requeueLimit    = 3;
        _configBroker.requeueInterval = 0.1;

        let _broker1 = broker(_configBroker);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              let _nbCalls = 0;
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _nbCalls++;
              });

              setTimeout(() => {
                should(_nbCalls).eql(3);
                should(_broker1._queues['endpoint/1.0'].queue).eql([]);
                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 300);

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

        let _configBroker = JSON.parse(JSON.stringify(configBroker1));
        _configBroker.requeueLimit    = 3;
        _configBroker.requeueInterval = 0.1;

        let _broker1 = broker(_configBroker);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              let _nbCallsListener1 = 0;
              let _nbCallsListener2 = 0;
              _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                _nbCallsListener1++;
              });
              _client2.consume('endpoint/1.0/test', (err, packet, ack) => {
                _nbCallsListener2++;
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
              }, 300);

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

        let _configBroker = JSON.parse(JSON.stringify(configBroker1));
        _configBroker.requeueLimit    = 3;
        _configBroker.requeueInterval = 0.1;

        let _configBroker2 = JSON.parse(JSON.stringify(configBroker2));
        _configBroker2.requeueLimit    = 3;
        _configBroker2.requeueInterval = 0.1;

        let _broker1 = broker(_configBroker);
        let _broker2 = broker(_configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                  'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
                ]
              }, () => {
                let _nbCalls = 0;
                _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                  _nbCalls++;
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
                }, 400);

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

        let _configBroker = JSON.parse(JSON.stringify(configBroker1));
        _configBroker.requeueLimit    = 3;
        _configBroker.requeueInterval = 0.1;

        let _broker1 = broker(_configBroker);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client1',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
              }, 300);

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

        let _configBroker = JSON.parse(JSON.stringify(configBroker1));
        _configBroker.requeueLimit    = 3;
        _configBroker.requeueInterval = 0.1;

        let _configBroker2 = JSON.parse(JSON.stringify(configBroker2));
        _configBroker2.requeueLimit    = 3;
        _configBroker2.requeueInterval = 0.1;

        let _broker1 = broker(_configBroker);
        let _broker2 = broker(_configBroker2);

        _broker1.start(() => {
          _broker2.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId,
                  'localhost:' + configBroker2.socketServer.port + '@' + configBroker2.serviceId
                ]
              }, () => {
                let _nbCalls = 0;
                _client1.consume('endpoint/1.0/test', (err, packet, ack) => {
                  _nbCalls++;
                  ack(false);
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
                }, 400);

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


    });

    describe('rules', () => {

      describe('read', () => {

        it('should allow client1 and client2', done => {
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;
          let _isErrorHasBeenCalled         = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/test']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          let _isListenClient1HasBeenCalled = false;
          let _isListenClient2HasBeenCalled = false;
          let _isErrorHasBeenCalled         = false;

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              read   : ['!endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener1 = 0;
                let _nbCallsListener2 = 0;
                let _nbErrors         = 0;

                _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                  _nbCallsListener1++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['!endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener1 = 0;
                let _nbCallsListener2 = 0;
                let _nbErrors         = 0;

                _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                  _nbCallsListener1++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

                _client2.listen('endpoint/1.0/1', (err, packet) => {
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
                  should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              read   : ['!endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
                ]
              }, () => {
                let _nbCallsListener1 = 0;
                let _nbCallsListener2 = 0;

                _client1.listen({ endpoint : 'endpoint', version : '1.0', ids : [1, 2] }, (err, packet) => {
                  _nbCallsListener1++;

                  should(err).not.ok();
                  should(packet).eql({
                    test : 'hello world'
                  });
                });

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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
                }, 100);
              });
            });
          });
        });

        it('should allow client1 & client2 to write : rule endpoint/version/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_1',
              write  : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/2', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });

                  _client2.send('endpoint_2/1.1/1', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
                }, 200);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/version/param & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/1']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });

                  _client2.send('endpoint/1.0/*', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/1.0/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });
                  _client2.send('endpoint/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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
                }, 100);
              });
            });
          });
        });

        it('should allow client_* to write : rule endpoint/* & send to endpoint/param/*', done => {
          let _configBroker = JSON.parse(JSON.stringify(configBroker1));
          _configBroker.rules = [
            {
              client : 'client_*',
              write  : ['endpoint/*']
            }
          ];

          let _client1 = client();
          let _client2 = client();

          let _broker1 = broker(_configBroker);

          _broker1.start(() => {
            _client1.connect({
              clientId      : 'client_1',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client1',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {
              _client2.connect({
                clientId      : 'client_2',
                keysDirectory : path.join(__dirname, 'keys'),
                keysName      : 'client2',
                hosts         : [
                  'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
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
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
                    _nbErrors++;
                  });
                  _client2.send('endpoint_2/1.1/*', { test : 'hello world' }, (err) => {
                    should(err).eql(constants.ERRORS.NOT_ALLOWED);
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

    describe.skip('disconnection', () => {

      it('should not crash if client_1 dies', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        _broker1.start(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId + '@' + configBroker1.serviceId
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client2',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId
              ]
            }, () => {

              _client1.consume('endpoint/1.0/test', (err, packet) => {
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

              _client1.disconnect();

              setTimeout(() => {
                _client1.connect({
                  clientId      : 'client_1',
                  keysDirectory : path.join(__dirname, 'keys'),
                  keysName      : 'client',
                  hosts         : [
                    'localhost:' + configBroker1.socketServer.port + '@' + configBroker1.serviceId + '@' + configBroker1.serviceId
                  ]
                });
              }, 40);

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
  });

});
