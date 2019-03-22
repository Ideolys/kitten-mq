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
  managementSocket : {
    port            : 1235,
    logs            : 'packets',
    packetsFilename : 'management1.log'
  },
  isMaster : true
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

      it('should allow multiple connections for a clientId', done => {
        const _clientConfig = {
          clientId      : 'client-1',
          keysDirectory : path.join(__dirname, 'keys'),
          keysName      : 'client',
          hosts         : [
            'localhost:' + configBroker1.socketServer.port
          ]
        };

        let _broker1 = broker(configBroker1);

        let _client1 = client();
        let _client2 = client();

        setTimeout(() => {
          _client1.connect(_clientConfig, () => {
            _client2.connect(_clientConfig, () => {

              setTimeout(() => {
                should(_broker1.clients).have.key('client-1')
                should(_broker1.clients['client-1']).be.an.Array().and.have.lengthOf(2);

                _client1.disconnect(() => {

                  setTimeout(() =>  {
                    should(_broker1.clients['client-1']).be.an.Array().and.have.lengthOf(1);

                    _client2.disconnect(() => {

                      setTimeout(() => {
                        should(_broker1.clients['client-1']).be.an.Array().and.have.lengthOf(0);
                        _broker1.stop(done);
                      }, 20);
                    });
                  }, 20)
                });
              }, 50);
            });
          });
        }, 50);
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

    describe.only('listen()', () => {

      it('should listen to a queue', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
                  console.log(err);
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should not listen to /* ', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
              ]
            }, () => {
              _client1.listen('*', (err) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              });

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  console.log(err);
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should not send to /* ', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
              ]
            }, () => {
              _client1.listen('endpoint/1.0/1', (err) => {
                should(err).eql(constants.ERRORS.BAD_ENPOINT);
              });

              setTimeout(() => {
                _client2.send('*', { test : 'hello world' }, (err) => {
                  should(err).eql(constants.ERRORS.BAD_ENPOINT);

                  _client1.disconnect(() => {
                    _client2.disconnect(() => {
                      _broker1.stop(done);
                    });
                  });
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should listen for multiple clients', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListenClient1HasBeenCalled = false;
        let _isListenClient2HasBeenCalled = false;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
                  console.log(err);
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should not listen for multiple listeners if it is the same client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _isListener1HasBeenCalled = false;
        let _isListener2HasBeenCalled = false;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
              }, 50);

              setTimeout(() => {
                _client2.send('endpoint/1.0/test', { test : 'hello world' }, (err) => {
                  console.log(err);
                });
              }, 20);
            });
          });
        }, 50);
      });

      it('should route packets to listeners in round-robin way if the same client has been used', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls = [];

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
              }, 100);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
            });
          });
        }, 50);
      });

      it('should route packets to listeners in round-robin way if the same client has been used & for other client', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _handlerCalls          = [];
        let _nbCallsHandlerClient2 = 0;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
              }, 100);

              for (var i = 0; i < 4; i++) {
                _client2.send('endpoint/1.0/test', { test : 'hello world' });
              }
            });
          });
        }, 50);
      });

      it('should listen for multiple params /endpoint/version/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        }, 50);
      });

      it('should listen for multiple params /endpoint/version/* & listen for /endpoint/version/1', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls        = 0;
        let _nbCallsClient2 = 0;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.0/3', { test : 'hello world' });
              }, 20);
            });
          });
        }, 50);
      });

      it('should listen for multiple params /endpoint/*', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCalls = 0;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCalls++;

                if (_nbCalls === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCalls === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.1/3');
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
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        }, 50);
      });

      it('should listen for multiple params /endpoint/* & listen for /endpoint/1.0/* &  & listen for /endpoint/1.1/3', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        let _nbCallsListener1 = 0;
        let _nbCallsListener2 = 0;
        let _nbCallsListener3 = 0;

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
              ]
            }, () => {
              _client1.listen('endpoint/*', (err, packet, info) => {
                should(err).not.ok();
                _nbCallsListener1++;

                if (_nbCallsListener1 === 1) {
                  should(info.channel).eql('endpoint/1.0/1');
                }
                else if (_nbCallsListener1 === 2) {
                  should(info.channel).eql('endpoint/1.0/2');
                }
                else {
                  should(info.channel).eql('endpoint/1.1/3');
                }

                should(packet).eql({
                  test : 'hello world'
                });
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
                should(_nbCallsListener1).eql(3);
                should(_nbCallsListener2).eql(2);
                should(_nbCallsListener3).eql(1);

                _client1.disconnect(() => {
                  _client2.disconnect(() => {
                    _broker1.stop(done);
                  });
                });
              }, 100);

              setTimeout(() => {
                _client2.send('endpoint/1.0/1', { test : 'hello world' });
                _client2.send('endpoint/1.0/2', { test : 'hello world' });
                _client2.send('endpoint/1.1/3', { test : 'hello world' });
              }, 20);
            });
          });
        }, 50);
      });

      it('should listen to a queue after packet is sent', done => {
        let _client1 = client();
        let _client2 = client();

        let _broker1 = broker(configBroker1);

        setTimeout(() => {
          _client1.connect({
            clientId      : 'client_1',
            keysDirectory : path.join(__dirname, 'keys'),
            keysName      : 'client',
            hosts         : [
              'localhost:' + configBroker1.socketServer.port
            ]
          }, () => {
            _client2.connect({
              clientId      : 'client_2',
              keysDirectory : path.join(__dirname, 'keys'),
              keysName      : 'client',
              hosts         : [
                'localhost:' + configBroker1.socketServer.port
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
        }, 50);
      });
    });
  });

});
