const path       = require('path');
const fs         = require('fs');
const utils      = require('../utils');
const sockets    = require('./sockets');
const routes     = require('../routes');
const queue      = require('./queue');
const constants  = require('./constants');
const rules      = require('./rules');
const serverHTTP = require('./management/serverHTTP');
const stats      = require('./stats');
const logger     = require('./logger');
const log        = logger.log;

function formatRoute (channelObj) {
  return channelObj.endpoint + '/' + channelObj.version + '/' + (channelObj.ids || channelObj.id);
}

/**
 * Define a broker
 * @param {Object} config
 */
function broker (configPath, isProd = false) {
  let _config = {
    serviceId             : 'broker-1',
    registeredClientsPath : 'clients',
    logsDirectory         : 'logs',
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
    maxItemsInQueue : 1000,
    requeueLimit    : 5,
    requeueInterval : 100 // seconds
  };

  // Merge configs
  let _clients    = {};
  let _queues     = {};
  let _rules      = null;
  let _publicKeys = {};
  let _sockets    = null;

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

  function _getError (message, error) {
    return {
      message,
      error
    };
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
        data : item.data,
      };

      if (!headers) {
        _packet.headers = {};
      }

      let messageId = null;
      if (headers && headers.messageId) {
        messageId = headers.messageId
      }
      else if (_packet.headers.messageId) {
        messageId = _packet.headers.messageId;
      }
      else {
        messageId = utils.randU32Sync();
      }

      _packet.headers.messageId = messageId,
      _packet.headers.channel   = item.channel,
      _packet.headers.created   = Date.now(),
      _packet.headers.handlerId = _client[1];
      _packet.headers.error     = error;

      if (isQueue) {
        acks[_packet.headers.messageId].headers = _packet.headers;
      }

      // We must know if the current broker is allowed to send the packet. Only the master broker
      // is allowed to send packets.
      if (!_config.isMaster) {
        continue;
      }

      stats.update({
        counterId : stats.COUNTER_NAMESPACES.MESSAGES_COUNT,
        value     : 1
      });
      stats.update({
        counterId : stats.COUNTER_NAMESPACES.MESSAGES_COUNT_SEC,
        value     : 1
      });

      log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'to=' + _client[0] + ';router=' + formatRoute(item.channel) + ';messageId=' + _packet.headers.messageId + ';packet sent (' + (isQueue ? 'queue' : 'callback') + ')');
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
      return _registerQueueAndHandler(client, packet.data.headers.handlerId, packet.data.data, _route === routes.QUEUE_LISTEN ? constants.LISTENER_TYPES.LISTEN : constants.LISTENER_TYPES.CONSUME, _route);
    }

    if (_route === routes.QUEUE_SEND) {
      return _onReveiveSendAction(client, packet.data.headers.handlerId, packet.data.data.channel, packet.data.data.data, _route);
    }

    if (_route === routes.QUEUE_ACK || _route === routes.QUEUE_NACK) {
      return _onReceiveAck(client, packet.data.headers.handlerId, packet.data.headers.messageId, packet.data.data, _route === routes.QUEUE_NACK, _route);
    }

    if (_route === routes.QUEUE_LISTEN_ADD_ID || _route === routes.QUEUE_LISTEN_REMOVE_ID || _route === routes.QUEUE_CONSUME_REMOVE_ID || _route === routes.QUEUE_CONSUME_ADD_ID) {
      return _onReceiveAddOrRemoveId(client, packet.data.headers.handlerId, packet.data.data, _route);
    }


    log(logger.LEVELS.DEBUG, logger.NAMESPACES.ROUTER, 'from=' + client + ';router=' + _route + ';no route is matching');
  }

  /**
   * Register a queue and its handler
   * @param {String} client clientId#nodeId
   * @param {String/Object} channel endpoint/version/param or { endpijtn : String, version : String, id : Array }
   * @param {Int} clientType LISTEN or CONSUME
   * @param {String} route
   */
  function _registerQueueAndHandler (client, handlerId, channel, clientType, route) {
    let _client               = client.split('#');
    let _clientHandler        = _client[1] + '@' + handlerId;
    let _fullyQualifiedClient = client + '@' + handlerId;
    let _channel              = {};
    if (typeof channel === 'string') {
      let _channelParts = channel.split('/');
      _channel.endpoint = _channelParts[0];
      _channel.version  = _channelParts[1];
      _channel.id       = _channelParts[2];
    }
    else {
      _channel    = channel;
      _channel.id = _channel.ids;
    }

    log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';registering listener/consumer');

    // A consumer cannot listen for all queues
    if (_channel.endpoint === '*') {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to register listener/consumer, cannot register on "*"');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_ENPOINT_ALL));
    }

     // A consumer cannot listen for all versions of an endpoint
     if (_channel.version === '*') {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to register listener/consumer, cannot register on "endpoint/*"');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_ENPOINT_ALL));
    }

    let _keyQueue = _channel.endpoint + '/' + _channel.version;

    if (!_queues[_keyQueue]) {
      _queues[_keyQueue] = queue.queue(_keyQueue, _sendToClients, _config);
    }

    _tree = _queues[_keyQueue].tree;

    if (_channel.id === '*') {
      let _isAllowed = _rules.isAllowed(_client[0], _client[1], _channel, true, _tree);
      if (!_isAllowed) {
        log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to register listener/consumer, not allowed');
        return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.NOT_ALLOWED));
      }

      _addToClients(client, handlerId, _channel, clientType);
      log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';listener/consumer registered');
      return _queues[_keyQueue].addClient(_channel.id, _client[0], _clientHandler, clientType);
    }

    let _isAllowed = _rules.isAllowed(_client[0], _client[1], _channel, true, _tree);
    if (!_isAllowed) {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to register listener/consumer, not allowed');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.NOT_ALLOWED));
    }

    _addToClients(client, handlerId, _channel, clientType);
    _queues[_keyQueue].addClient(_channel.id, _client[0], _clientHandler, clientType);
    log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';listener/consumer registered');
  }

  /**
   * handler when on receiving send action
   * @param {String} client clientId#nodeId
   * @param {Int} handlerId id of the sender's callback
   * @param {String} channel endpoint/version/param
   * @param {*} data packet's data
   * @param {String} route
   */
  function _onReveiveSendAction (client, handlerId, channel, data, route) {
    let _channelParts         = channel.split('/');
    let _fullyQualifiedClient = client + '@' + handlerId;

    let _channel = {};
    _channel.endpoint = _channelParts[0];
    _channel.version  = _channelParts[1];
    _channel.id       = _channelParts[2];

    log(logger.LEVELS.INFO, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';publishing');

    let _item = { data, channel : _channel };
    // A client cannot broadcast a message
    if (_channel.endpoint === '*') {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to publish, cannot publish on "*"');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_ENPOINT_ALL));
    }

    // A client cannot broadcast a message to * versions
    if (_channel.version === '*') {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to publish, cannot publish on "endpoint/*"');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_ENPOINT_ALL));
    }

    let _keyQueue = _channel.endpoint + '/' + _channel.version;

    if (!_queues[_keyQueue]) {
      _queues[_keyQueue] = queue.queue(_keyQueue, _sendToClients, _config);
    }

    let _queue  = _queues[_keyQueue];
    let _client = client.split('#');
    if (!_rules.isAllowed(_client[0], _client[1], _channel, false)) {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to publish, not allowed');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.NOT_ALLOWED));
    }

    let _errors = _queue.addInQueue(_channel.id, _item);
    if (_errors) {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed to publish, validation failed');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_FORMAT, _errors));
    }

    // Send confirmation to client
    _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false );
    log(logger.LEVELS.INFO, logger.NAMESPACES.PUBLISHER, 'from=' + client + ';router=' + formatRoute(_channel) + ';published');
  }

  /**
   * Handler when receiving ack answer
   * @param {String} client client_1#node_1
   * @param {Int} handlerId
   * @param {Int} messageId
   * @param {Boolean} isNack
   * @param {String} route
   */
  function _onReceiveAck (client, handlerId, messageId, channel, isNack, route) {
    let _fullyQualifiedClient = client + '@' + handlerId;
    let _queue                = _queues[channel.endpoint + '/' + channel.version];

    log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + channel.endpoint + '/' + channel.version + ';messageId=' + messageId + ';acking ' + (isNack ? '"NACK"' : '"ACK"'));

    if (!_queue) {
      log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + channel.endpoint + '/' + channel.version + ';messageId=' + messageId + ';failed to ack, queue undefined');
      return;
    }

    stats.update({
      counterId : stats.COUNTER_NAMESPACES.MESSAGES_ACK_COUNT,
      value     : 1
    });
    stats.update({
      counterId : stats.COUNTER_NAMESPACES.MESSAGES_ACK_COUNT_SEC,
      value     : 1
    });

    log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + channel.endpoint + '/' + channel.version + ';messageId=' + messageId + ';acked');
    if (isNack) {
      return _queue.nack(messageId);
    }

    _queue.ack(messageId);
  };

  /**
   * On receive listen add id
   * @param {String} client
   * @param {Int} handlerId callback for listener.addId(id, callback)
   * @param {Object} data { id : int, handlerId : Int // main listener id to rattach, channel : String }
   * @param {String} route internal route
   */
  function _onReceiveAddOrRemoveId (client, handlerId, data, route) {
    let _client        = client.split('#');
    let _channel       = {};
    let _clientHandler = _client[1] + '@' + data.handlerId;

    if (typeof data.channel === 'string') {
      let _channelParts = data.channel.split('/');
      _channel.endpoint = _channelParts[0];
      _channel.version  = _channelParts[1];
      _channel.id       = _channelParts[2];
    }
    else {
      _channel = data.channel;
    }

    _channel.id = data.id;

    log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';trying to add/remove id');

    let _fullyQualifiedClient = client + '@' + handlerId;
    let _queueKey             = _channel.endpoint + '/' + _channel.version;
    if (!_queues[_queueKey]) {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed, queue undefined');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.BAD_ENPOINT));
    }

    let _isAllowed = _rules.isAllowed(_client[0], _client[1], _channel, true, _tree);
    if (!_isAllowed) {
      log(logger.LEVELS.DEBUG, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';failed, queue undefined');
      return _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false, _getError(constants.ERRORS.NOT_ALLOWED));
    }

    let _type = (route === routes.QUEUE_LISTEN_ADD_ID || route === routes.QUEUE_LISTEN_REMOVE_ID) ? constants.LISTENER_TYPES.LISTEN : constants.LISTENER_TYPES.CONSUME;

    if (route === routes.QUEUE_LISTEN_ADD_ID || route === routes.QUEUE_CONSUME_ADD_ID) {
      _queues[_queueKey].addClient(_channel.id, _client[0], _clientHandler, _type);
      log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';id added');
    }
    if (route === routes.QUEUE_LISTEN_REMOVE_ID || route === routes.QUEUE_CONSUME_REMOVE_ID) {
      _queues[_queueKey].tree.removeClient(_client[0], _clientHandler, _type, _channel.id);
      log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + ';router=' + formatRoute(_channel) + ';id removed');
    }

    // Notify client
    _sendToClients(null, [_fullyQualifiedClient], { handlerId, data : null, channel : _channel }, null, false );
  }

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
      let _queue       = _queues[_clientQueue[0].endpoint + '/' + _clientQueue[0].version];
      if (!_queue) {
        continue;
      }

      let _tree   = _queue.tree;
      let _client = clientId.split('#');
      _tree.removeClient(_client[0], _client[1] + '@' + _clientQueue[1],_clientQueue[2]);
    }

    delete _clients[clientId];
  }

  /**
   * Set isMaster config property
   * @param {Boolean} isMaster
   */
  function setIsMaster (isMaster) {
    _config.isMaster = isMaster;
  }

  /**
   * Stop broker
   * @param {Function} callback
   */
  function stop (callback) {
    _sockets.broker.stop(callback);
  }

  /**
   * Start broker
   * @param {Function} callback
   */
  function start (callback) {
    reload();
    if (isProd) {
      logger.init(_config.logsDirectory);
    }
    logger.setLogLevel(_config.logLevel || logger.LEVELS.INFO);
    _sockets = sockets.start(_config, _publicKeys, _onClientDisconnect, _listenBroker);
    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, keys => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;
      callback();
    });
  }

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
   * Reload broker configuration
   * @param {Object} config
   */
  function reload () {
    // Reload global config
    try {
      _config = Object.assign(_config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
    }
    catch (e) {
      console.log(e);
    }

    utils.createDirIfNotExists(_config.registeredClientsPath);
    utils.createDirIfNotExists(_config.keysDirectory);

    // Reload public keys
    _loadKeys(_config.registeredClientsPath);

    // Reload channel formats
    let _channels = _config.channels;

    if (_channels) {
      for (let channel in _channels) {
        if (!_queues[channel]) {
          _queues[channel] = queue.queue(channel, _sendToClients, _config, _channels[channel]);
        }

        _queues[channel].reload(_channels[channel]);
      }
    }

    // Reload Rules
    _rules = rules(_config.rules);

    // Reload sockets
    if (_sockets) {
      _sockets.reload(_config);
    }

    if (_config.isManagementInterface !== false) {
      serverHTTP.init(_config, _queues);
    }

    console.log('Broker reloaded!');
  }

  return {
    stop,
    start,
    reload,
    get _sockets () {
      return _sockets;
    },
    _queues,
    clients : _clients,
    setIsMaster
  };
}

module.exports = broker;
