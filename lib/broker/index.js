const path    = require('path');
const fs      = require('fs');
const jwt     = require('kitten-jwt');
const utils   = require('../utils');
const sockets = require('./sockets');
const routes  = require('../routes');

const LISTENER_TYPES = {
  LISTEN  : 0,
  CONSUME : 1
};

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
  let _queues  = {};

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
      return _registerQueueAndHandler(client, packet.data, _route === routes.QUEUE_LISTEN ? LISTENER_TYPES.LISTEN : LISTENER_TYPES.CONSUME);
    }

    if (_route === routes.QUEUE_SEND) {
      return _onReveiveSendAction(client, packet.data.channel, packet.data.data);
    }
  }

  /**
   * Register a queue and its handler
   * @param {String} client clientId#nodeId
   * @param {String} channel endpoint/version/param
   * @param {Int} clientType LISTEN or CONSUME
   */
  function _registerQueueAndHandler (client, channel, clientType) {
    // @todo is client allowed to listen/consume
    let _client       = { clientId : client, type : clientType };
    let _channelParts = channel.split('/');
    let _endpoint     = _channelParts[0];

    // A consumer cannot listen for all queues
    if (_endpoint === '*') {
      // @todo reutrn an error for the client
      return;
    }

    if (!_queues[_endpoint]) {
      _queues[_endpoint] = {
        clients : [],
        version : {}
      };
    }

    let _version = channel[1];

    if (_version === '*') {
      _queues[_endpoint].clients.push(_client);
      return;
    }

    if (!_queues[_endpoint].versions[_version]) {
      _queues[_endpoint].versions[_version] = {
        clients : [],
        params  : {}
      };
    }

    let _param = channel[2];

    if (_param === '*') {
      _queues[_endpoint].versions[_version].push(_client);
      return;
    }

    if (!_queues[_endpoint].versions[_version].params[_param]) {
      _queues[_endpoint].versions[_version].params[_param] = {
        clients : [],
        params  : {}
      };
    }

    _queues[_endpoint].versions[_version].params[_param].client.push(_client);
  }

  /**
   * Send data to clients
   * @param {Array} clients
   * @param {*} data packet's data
   */
  function _sendTo (clients, data) {
    for (var i = 0; i < clients.length; i++) {
      _sockets.broker.sendFromServer(clients[i], data);
    }
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

    // A client cannot broadcast a message
    if (_endpoint === '*') {
      // @todo return error for handler
      return;
    }

    // A client cannot send a message to a non existing queue
    if (!_queues[_endpoint]) {
      // @todo return an error for handler
      return;
    }

    let _version = _channelParts[1];

    if (_version === '*') {
      return _sendTo(_queues[_endpoint].clients, data);
    }

    // A client cannot send a message to a non existing queue
    if (!_queues[_endpoint].versions[_version]) {
      // @todo return an error for handler
      return;
    }

    let _param = _channelParts[2];
    if (_channelParts === '*') {
      return _sendTo(_queues[_endpoint].versions[_version].clients, data);
    }

    // A client cannot send a message to a non existing queue
    if (!_queues[_endpoint].versions[_version].params[_param]) {
      // @todo return an error for handler
      return;
    }

    _sendTo(_queues[_endpoint].versions[_version].params[_param].clients, data);
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
