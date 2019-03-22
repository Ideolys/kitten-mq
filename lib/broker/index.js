const path      = require('path');
const fs        = require('fs');
const jwt       = require('kitten-jwt');
const utils     = require('../utils');
const sockets   = require('./sockets');
const routes    = require('../routes');
const queueTree = require('./queueTree');
const constants = require('./constants');

/**
 * Define a broker
 * @param {Object} config
 */
function broker (config) {
  let _config = {
    serviceId             : 'broker-1',
    nodes                 : [],
    registeredClientsPath : 'clients',
    keysDirectory         : '',
    keysName              : '',
    isMaster              : false,
    socketServer          : {
      port            : 1234,
      host            : 'localhost',
      logs            : 'packets',
      packetsFilename : 'broker.log',
      token           : null
    },
    managementSocket : {
      port            : 1235,
      host            : 'localhost',
      logs            : 'packets',
      packetsFilename : 'management.log',
      token           : null
    }
  };


  let _listenManagement = function listenManagement (packet) {
  }

  // Merge configs
  _config      = Object.assign(_config, config);
  let _clients = {};

  let _queues  = queueTree((clients, item) => {
    for (var i = 0; i < clients.length; i++) {
      let _client = clients[i].split('@');
      _sockets.broker.sendFromServer(_client[0], {
        headers : {
          handlerId : _client[1],
          channel   : item.channel
        },
        data : item.data
      });
    }
  });

  /**
   * Router
   * @param {Object} packet
   * @param {String} clientId
   */
  let _listenBroker = function route (packet, client) {
    let _route = packet.data.route;
    if (!_route) {
      return;
    }

    if (_route === routes.QUEUE_LISTEN || _route === routes.QUEUE_CONSUME) {

      return _registerQueueAndHandler(client, packet.data.headers.handlerId, packet.data.data, _route === routes.QUEUE_LISTEN ? constants.LISTENER_TYPES.LISTEN : constants.LISTENER_TYPES.CONSUME);
    }

    if (_route === routes.QUEUE_SEND) {
      return _onReveiveSendAction(client, packet.data.data.channel, packet.data.data.data);
    }
  }

  /**
   * Register a queue and its handler
   * @param {String} client clientId#nodeId
   * @param {String} channel endpoint/version/param
   * @param {Int} clientType LISTEN or CONSUME
   */
  function _registerQueueAndHandler (client, handlerId, channel, clientType) {
    // @todo is client allowed to listen/consume
    let _client        = client.split('#');
    let _clientHandler = _client[1] + '@' + handlerId;
    let _channelParts  = channel.split('/');
    let _endpoint      = _channelParts[0];

    // A consumer cannot listen for all queues
    if (_endpoint === '*') {
      // @todo reutrn an error for the client
      return;
    }

    if (!_queues.subTrees[_endpoint]) {
      _queues.addNode(_endpoint);
    }
    _tree = _queues.subTrees[_endpoint];

    let _version = _channelParts[1];
    if (_version === '*') {
      _tree.addClient(_client[0], _clientHandler, clientType);
      return;
    }

    if (!_tree.subTrees[_version]) {
      _tree.addNode(_version);
    }

    _tree = _tree.subTrees[_version];

    let _param = _channelParts[2];

    if (_param === '*') {
      _tree.addClient(_client[0], _clientHandler, clientType);
      return;
    }

    if (!_tree.subTrees[_param]) {
      _tree.addNode(_param);
    }

    _tree = _tree.subTrees[_param];

    _tree.addClient(_client[0], _clientHandler, clientType);
  }

  /**
   * handler when on receiving send action
   * @param {String} client clientId#nodeId
   * @param {String} channel endpoint/version/param
   * @param {*} data packet's data
   */
  function _onReveiveSendAction (client, channel, data) {
    // We must know if the current broker is allowed to route the packet. ONly the master broker
    // is allowed to route packets.

    if (!_config.isMaster) {
      // Handle a queue of packets to send
      return;
    }

    let _channelParts = channel.split('/');
    let _endpoint     = _channelParts[0];
    let _item         = { data, channel };

    // A client cannot broadcast a message
    if (_endpoint === '*') {
      // @todo return error for handler
      return;
    }

    // A client cannot send a message to a non existing queue
    let _tree = _queues.subTrees[_endpoint];

    if (!_tree) {
      // @todo return an error for handler
      return;
    }

    if (_tree.clientNodes) {
      _tree.addInQueue(_item);
    }

    let _version = _channelParts[1];

    if (_version === '*') {
      _tree.addInQueue(_item);
    }

    // A client cannot send a message to a non existing queue
    _tree = _tree.subTrees[_version];
    if (!_tree) {
      // @todo return an error for handler
      return;
    }

    if (_tree.clientNodes) {
      _tree.addInQueue(_item);
    }

    let _param = _channelParts[2];
    if (_param === '*') {
      _tree.addInQueue(_item);
    }

    // A client cannot send a message to a non existing queue
    _tree = _tree.subTrees[_param];
    if (!_tree) {
      // @todo return an error for handler
      return;
    }

    _tree.addInQueue(_item);
  }

  /**
   * Stop broker
   * @param {Function} callback
   */
  function stop (callback) {
    _sockets.broker.stop(() => {
      _sockets.management.stop(callback);
    });
  }

  /**
   * Initialisation
   */
  let _sockets = sockets.start(_config, _clients, _listenBroker, _listenManagement);
  utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, keys => {
    _config.privateKey = keys.private;
    _config.publicKey  = keys.public;
  });

  return {
    stop,
    _sockets,
    clients : _clients
  };
}

module.exports = broker;

/*

  Route => /endpoint/version/id

  endpoint1 : {

    versions : {
      1 : {
        param : {

          1 : {

          },
          1 : {

          }
        }
      }
    }
  }

  endpoint -> versions -> param

*/
