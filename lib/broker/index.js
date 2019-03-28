const path      = require('path');
const fs        = require('fs');
const utils     = require('../utils');
const sockets   = require('./sockets');
const routes    = require('../routes');
const queue     = require('./queue');
const constants = require('./constants');
const rules     = require('./rules');

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
    },

    requeueLimit    : 5,
    requeueInterval : 100 // seconds
  };

  // Merge configs
  _config         = Object.assign(_config, config);
  let _clients    = {};
  let _queues     = {};
  let _rules      = rules(_config.rules);
  let _publicKeys = {};
  let _sockets    = null;

  /**
   * Load public keys
   * @param {String} directory
   */
  function _loadKeys (directory) {
    if (!fs.existsSync(directory)) {
      return;
    }

    let _files = fs.readdirSync(directory);

    for (var i = 0; i < _files.length; i++) {
      if (path.extname(_files[i]) !== '.pub') {
        continue;
      }

      let _filename          = path.basename(_files[i], '.pub');
      _publicKeys[_filename] = fs.readFileSync(path.join(directory, _files[i]), 'utf8');
    }
  }

  /**
   * Follow clients listeners & consumers
   * @param {String} clientId
   * @param {String} handlerId
   * @param {Array} channelParts
   * @param {Int} clientType
   */
  function _addToClients (clientId, handlerId, channelParts, clientType) {
    if (!_clients[clientId]) {
      _clients[clientId] = [];
    }

    _clients[clientId].push([channelParts, handlerId, clientType]);
  }


  let _listenManagement = function listenManagement (packet) {
  }

  /**
   * Send to clients
   * @param {Object} acks
   * @param {Array} clients
   * @param {Object} item { handlerId, data }
   * @param {Object} headers
   * @param {String} error
   */
  function _sendToClients (acks, clients, item, headers, isQueue = true, error = null) {
    for (var i = 0; i < clients.length; i++) {
      let _client = clients[i].split('@');
      let _packet = {
        headers,
        data : item.data
      };

      if (!headers) {
        _packet.headers = {
          handlerId : _client[1],
          messageId : utils.randU32Sync(),
          channel   : item.channel,
          error
        };
      }

      if (isQueue) {
        acks[clients[i] + '|' + _packet.headers.messageId] = _packet.headers;
      }

      _sockets.broker.sendFromServer(_client[0], _packet);
    }
  }

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

    if (_route === routes.QUEUE_ACK || _route === routes.QUEUE_NACK) {
      return _onReceiveAck(client, packet.data.headers.handlerId, packet.data.headers.messageId, packet.data.data, _route === routes.QUEUE_NACK);
    }
  }

  /**
   * Register a queue and its handler
   * @param {String} client clientId#nodeId
   * @param {String} channel endpoint/version/param
   * @param {Int} clientType LISTEN or CONSUME
   */
  function _registerQueueAndHandler (client, handlerId, channel, clientType) {
    let _client               = client.split('#');
    let _clientHandler        = _client[1] + '@' + handlerId;
    let _fullyQualifiedClient = client + '@' + handlerId;
    let _channelParts         = channel.split('/');
    let _endpoint             = _channelParts[0];

    // A consumer cannot listen for all queues
    if (_endpoint === '*') {
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.BAD_ENPOINT );
    }

    if (!_queues[_endpoint]) {
      _queues[_endpoint] = queue.queue(_sendToClients, _config.requeueLimit, _config.requeueInterval);
    }

    _tree = _queues[_endpoint].tree;

    let _version = _channelParts[1];
    // A consumer cannot listen for all versions of an endpoint
    if (_version === '*') {
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.BAD_ENPOINT );
    }

    if (!_tree.subTrees[_version]) {
      _tree.addNode(_version);
    }

    _tree = _tree.subTrees[_version];

    let _param = _channelParts[2];

    if (_param === '*') {
      let _isAllowed = _rules.isAllowed(_client[0], _channelParts);
      if (!_isAllowed) {
        return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.NOT_ALLOWED );
      }

      _addToClients(client, handlerId, _channelParts, clientType);
      return _tree.addClient(_client[0], _clientHandler, clientType);
    }

    if (!_tree.subTrees[_param]) {
      _tree.addNode(_param);
    }

    _tree = _tree.subTrees[_param];

    let _isAllowed = _rules.isAllowed(_client[0], _channelParts);
    if (!_isAllowed) {
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.NOT_ALLOWED );
    }

    _addToClients(client, handlerId, _channelParts, clientType);
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
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.BAD_ENPOINT );
    }

    let _version = _channelParts[1];
    // A client cannot broadcast a message to * versions
    if (_version === '*') {
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.BAD_ENPOINT );
    }

    if (!_queues[_endpoint]) {
      _queues[_endpoint] = queue.queue(_sendToClients, _config.requeueLimit, _config.requeueInterval);
    }

    let _queue     = _queues[_endpoint];
    let _tree      = _queue.tree;
    let _tempQueue = null;

    if (!_rules.isAllowed(client.split('#')[0], _channelParts, false)) {
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false, constants.ERRORS.NOT_ALLOWED );
    }

    if (!_tree.subTrees[_version]) {
      _tree.addNode(_version);
    }
    _tree = _tree.subTrees[_version];

    if (_tree.clientNodes) {
      _tempQueue = _queue.addInQueue(_item, _tree, _tempQueue);
    }

    let _param = _channelParts[2];
    if (_param === '*') {
      _tempQueue = _queue.addChildrenInQueue(_item, _tree, _tempQueue);
      // Send confirmation to client
      _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false );
      return _queue.commit(_tempQueue);
    }

    if (! _tree.subTrees[_param] && _param !== '*') {
      _tree.addNode(_param);
    }
    _tree = _tree.subTrees[_param];

    _tempQueue = _queue.addInQueue(_item, _tree, _tempQueue);
    _queue.commit(_tempQueue);
    // Send confirmation to client
    _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null }, null, false );
  }

  /**
   * Handler when receiving ack answer
   * @param {String} client client_1#node_1
   * @param {Int} handlerId
   * @param {Int} messageId
   * @param {Boolean} isNack
   */
  function _onReceiveAck (client, handlerId, messageId, channel, isNack) {
    if (!_config.isMaster) {
      return;
    }

    let _channelParts         = channel.split('/');
    let _fullyQualifiedClient = client + '@' + handlerId;
    let _queue                = _queues[_channelParts[0]];

    if (!_queue) {
      return;
    }

    if (isNack) {
      return _queue.nack(_fullyQualifiedClient + '|' + messageId);
    }

    _queue.ack(_fullyQualifiedClient + '|' + messageId);
  };

  /**
   * Handler when client disconnects
   * @param {String} clientId
   */
  function _onClientDisconnect (clientId) {
    if (!_clients[clientId]) {
      return;
    }

    let _clientQueues = _clients[clientId];
    for (var i = 0; i < _clientQueues.length; i++) {
      let _clientQueue = _clientQueues[i];
      let _queue       = _queues[_clientQueue[0][0]];
      if (!_queue) {
        continue;
      }

      let _tree = _queue.tree;

      if (!_tree.subTrees[_clientQueue[0][1]]) {
        continue;
      }

      _tree = _tree.subTrees[_clientQueue[0][1]];
      if (_clientQueue[0][2] === '*') {
        _tree.removeClient(clientId, _clientQueue[1],_clientQueue[2]);
        continue;
      }

      if (!_tree.subTrees[_clientQueue[0][2]]) {
        continue;
      }

      _tree = _tree.subTrees[_clientQueue[0][2]];
      _tree.removeClient(clientId, _clientQueue[1],_clientQueue[2]);
    }

    delete _clients[clientId];
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
   * Start broker
   * @param {Function} callback
   */
  function start (callback) {
    _loadKeys(_config.registeredClientsPath);
    _sockets = sockets.start(_config, _publicKeys, _onClientDisconnect, _listenBroker, _listenManagement);
    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, keys => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;
      callback();
    });
  }

  return {
    stop,
    start,
    get _sockets () {
      return _sockets;
    },
    _queues,
    clients : _clients
  };
}

module.exports = broker;
