const path      = require('path');
const fs        = require('fs');
const jwt       = require('kitten-jwt');
const utils     = require('../utils');
const sockets   = require('./sockets');
const routes    = require('../routes');
const queue     = require('./queue');
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
  let _acks    = {}

  /**
   * Send to clients
   * @param {Array} clients
   * @param {Object} item { handlerId, data }
   */
  function _sendToClients (clients, item, error = false) {
    for (var i = 0; i < clients.length; i++) {
      let _client = clients[i].split('@');
      let _packet = {
        headers : {
          handlerId : _client[1],
          messageId : utils.randU32Sync(),
          channel   : item.channel,
          error
        },
        data : item.data
      };

      if (!error) {
        _acks[clients[i] + '_' + _packet.headers.messageId] = 1;
      }

      _sockets.broker.sendFromServer(_client[0], _packet);
    }
  }

  let _queues = {};

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
      return _onReveiveSendAction(client, packet.data.headers.handlerId, packet.data.data.channel, packet.data.data.data);
    }

    if (_route === routes.QUEUE_ACK) {
      return _onReceiveAck(client, packet.data.headers.handlerId, packet.data.headers.messageId, packet.data.data);
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
    let _client               = client.split('#');
    let _clientHandler        = _client[1] + '@' + handlerId;
    let _fullyQualifiedClient = client + '@' + handlerId;
    let _channelParts         = channel.split('/');
    let _endpoint             = _channelParts[0];

    // A consumer cannot listen for all queues
    if (_endpoint === '*') {
      return _sendToClients([_fullyQualifiedClient], { handlerId, data : null }, constants.ERRORS.BAD_ENPOINT );
    }

    if (!_queues[_endpoint]) {
      _queues[_endpoint] = queue.queue(_sendToClients);
    }

    _tree = _queues[_endpoint].tree;

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
   * @param {Int} handlerId id of the sender's callback
   * @param {String} channel endpoint/version/param
   * @param {*} data packet's data
   */
  function _onReveiveSendAction (client, handlerId, channel, data) {
    // We must know if the current broker is allowed to route the packet. Only the master broker
    // is allowed to route packets.

    if (!_config.isMaster) {
      return;
    }

    let _channelParts         = channel.split('/');
    let _endpoint             = _channelParts[0];
    let _item                 = { data, channel };
    let _fullyQualifiedClient = client + '@' + handlerId;

    // A client cannot broadcast a message
    if (_endpoint === '*') {
      return _sendToClients([_fullyQualifiedClient], { handlerId, data : null }, constants.ERRORS.BAD_ENPOINT );
    }

    if (!_queues[_endpoint]) {
      _queues[_endpoint] = queue.queue(_sendToClients);
    }

    let _queue = _queues[_endpoint];
    let _tree  = _queue.tree;

    if (_tree.clientNodes) {
      _queue.addInQueue(_item, _tree);
    }

    let _version = _channelParts[1];
    if (_version === '*') {
      _queue.addInQueueWithChildren(_item, _tree);
      return _queue.commit();
    }

    if (!_tree.subTrees[_version] && _version !== '*') {
      _tree.addNode(_version);
    }
    _tree = _tree.subTrees[_version];

    if (_tree.clientNodes) {
      _queue.addInQueue(_item, _tree);
    }

    let _param = _channelParts[2];
    if (_param === '*') {
      _queue.addInQueueWithChildren(_item, _tree);
      return _queue.commit();
    }

    if (! _tree.subTrees[_param] && _param !== '*') {
      _tree.addNode(_param);
    }
    _tree = _tree.subTrees[_param];

    _queue.addInQueue(_item, _tree);
    _queue.commit();
  }

  /**
   * Handler when receiving ack answer
   * @param {String} client client_1#node_1
   * @param {Int} handlerId
   * @param {Int} messageId
   */
  function _onReceiveAck (client, handlerId, messageId, channel) {
    if (!_config.isMaster) {
      return;
    }

    let _channelParts         = channel.split('/');
    let _fullyQualifiedClient = client + '@' + handlerId;

    if (_acks === undefined) {
      return;
    }

    let _queue = _queues[_channelParts[0]];

    if (!_queue) {
      return;
    }

    _queue.ack();
    delete _acks[_fullyQualifiedClient + '_' + messageId];
  };

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
    _queues,
    clients : _clients
  };
}

module.exports = broker;
