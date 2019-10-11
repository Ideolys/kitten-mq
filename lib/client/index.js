const utils     = require('../utils');
const hosts     = require('./hosts');
const routes    = require('../routes');
const constants = require('../broker/constants');

function kittenMQ () {
  let _config = {
    hosts         : [],// list of brokers mirror URLs for High Avaibility
    keysDirectory : 'keys',
    keysName      : 'client',
    clientId      : 'myclient-id' // The client id, it must be globally unique
  };
  let _hosts        = null;
  let _handlers     = {};
  let _sendHandlers = {};

  /**
   * Ack a message
   * @param {Int} handlerId
   * @param {Int} messageId
   * @param {Boolean} isAck true = ack, false = nack
   */
  let _ack = function ack (channel, handlerId, messageId, isAck = true) {
    _hosts.broadcast(_config.clientId, _config.privateKey, isAck ? routes.QUEUE_ACK : routes.QUEUE_NACK, handlerId, channel, messageId);
  };

  /**
   * Listener for socket server
   * @param {String} host 'host:port'
   * @param {Object} packet { headers, data }
   */
  let _listenSocket = function listenSocket (host, packet) {
    if (!packet.headers || (packet.headers && !packet.headers.handlerId )) {
      return;
    }

    let _handlerId = packet.headers.handlerId;
    let _info      = JSON.parse(JSON.stringify(packet.headers));

    if (_sendHandlers[_handlerId]) {

      if (packet.headers.error) {
        return _sendHandlers[_handlerId].call(null, packet.headers.error, null, _info);
      }

      _sendHandlers[_handlerId].call(null, null, packet.data, _info);
      return;
    }

    if (!_handlers[_handlerId]) {
      // @todo return an error for broker
      return;
    }

    if (packet.headers.error) {
      return _handlers[_handlerId].callback.call(null, packet.headers.error, null, _ack, _info);
    }

    _handlers[_handlerId].callback.call(null, null, packet.data, _ack, _info);
  }

  /**
   * Connect to brokers
   * @param {Object} config
   * @param {Function} callback
   */
  function connect (config, callback) {
    _config           = Object.assign(_config, config);
    _config.clientId += '#' + utils.randU32Sync();

    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, (keys) => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;

      _hosts           = hosts(_config);
      _hosts.onConnect = _redefineHandlers;
      _hosts.connect(_listenSocket, () => {
        _hosts.broadcast(_config.clientId, _config.privateKey, routes.REGISTER_CLIENT, null, keys.public);

        if (callback) {
          callback();
        }
      });
    });
  }

  /**
   * Disconnect client from hosts
   * @param {Function} callback
   */
  function disconnect (callback) {
    _hosts.disconnect(callback);
  }

  /**
   * Send a message
   * @param {String} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @param {*} data JSON
   * @param {Function} callback (err, data, info)
   */
  function send (channel, data, callback) {
    let _id = utils.randU32Sync();

    if (callback) {
      // Register handler
      _sendHandlers[_id] = (err, data, info) => {
        callback(err, data, info);
        delete _sendHandlers[_id];
      };
    }

    if (typeof channel !== 'string') {
      return callback({ message : 'Not allowed' });
    }

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_SEND, _id, { channel, data });
  }

  /**
   * Listen a channel
   * @param {String/Object} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @example { endpoint : String, version : String, ids : Array }
   * @param {Function} callback (err, data, info)
   * @returns {Object} { addId : Function, removeId : Function }
   */
  function listen (channel, callback) {
    let _id = utils.randU32Sync();
    // Register handler
    _handlers[_id]         = {};
    _handlers[_id].channel = channel;

    if (typeof channel === 'string') {
      channel = channel.split('/');

      _handlers[_id].channel = {
        endpoint : channel[0],
        version  : channel[1],
        ids      : channel[2]
      };
    }

    if (!Array.isArray(_handlers[_id].channel.ids)) {
      _handlers[_id].channel.ids = [_handlers[_id].channel.ids];
    }

    _handlers[_id].type     = constants.LISTENER_TYPES.LISTEN;
    _handlers[_id].callback = (err, data, done, info) => {
      if (!err) {
        done.call(null, info.channel, _id, info.messageId);
      }

      callback.call(null, err, data, info);
    };

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_LISTEN, _id, _handlers[_id].channel);

    return {
      _handler : _handlers[_id].channel,

      /**
       * Add an id to listen
       * @param {Int} id
       * @param {Function} callback
       */
      addId : function (id, callback) {
        let _idAdd    = utils.randU32Sync();
        if (callback) {
          // Register handler
          _sendHandlers[_idAdd] = (err) => {
            callback.call(null, err);
          };
        }

        _handlers[_id].channel.ids.push(id);
        _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_LISTEN_ADD_ID, _idAdd, { id : id, handlerId : _id, channel : _handlers[_id].channel });
      },

      /**
       * Remove an id from listen
       * @param {Int} id
       * @param {Function} callback
       */
      removeId : function (id, callback) {
        let _idRemove = utils.randU32Sync();
        if (callback) {
          // Register handler
          _sendHandlers[_idRemove] = (err) => {
            callback.call(null, err);
          };
        }

        var _index = utils.find(_handlers[_id].channel.ids, id);
        if (_index !== -1) {
          _handlers[_id].channel.ids.splice(_index, 1);
        }

        _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_LISTEN_REMOVE_ID, _idRemove, { id : id, handlerId : _id, channel : _handlers[_id].channel });
      }
    }
  }

  /**
   * Consume a channel
   * @param {String} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @example { endpoint : String, version : String, ids : Array }
   * @param {Function} callback (err, data, info)
   * @returns {Object} { addId : Function, removeId : Function }
   */
  function consume (channel, callback) {
    let _id = utils.randU32Sync();

    // Register handler
    _handlers[_id]         = {};
    _handlers[_id].channel = channel;

    if (typeof channel === 'string') {
      channel = channel.split('/');

      _handlers[_id].channel = {
        endpoint : channel[0],
        version  : channel[1],
        ids      : channel[2]
      };
    }

    if (!Array.isArray(_handlers[_id].channel.ids)) {
      _handlers[_id].channel.ids = [_handlers[_id].channel.ids];
    }

    _handlers[_id].type     = constants.LISTENER_TYPES.CONSUME;
    _handlers[_id].callback = (err, data, done, info) => {
      /**
       * Ack or Nack
       * @param {Boolean} isAck true = ack, false = nack
       */
      let _done = (isAck = true) => {
        done.call(null, info.channel, _id, info.messageId, isAck);
      };

      callback.call(null, err, data, _done, info);
    };

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_CONSUME, _id, _handlers[_id].channel);


    return {
      _handler : _handlers[_id].channel,

      /**
       * Add an id to listen
       * @param {Int} id
       * @param {Function} callback
       */
      addId : function (id, callback) {
        let _idAdd = utils.randU32Sync();
        if (callback) {
          // Register handler
          _sendHandlers[_idAdd] = (err) => {
            callback.call(null, err);
          };
        }
        _handlers[_id].channel.ids.push(id);
        _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_CONSUME_ADD_ID, _idAdd, { id : id, handlerId : _id, channel : _handlers[_id].channel });
      },

      /**
       * Remove an id from listen
       * @param {Int} id
       * @param {Function} callback
       */
      removeId : function (id, callback) {
        let _idRemove = utils.randU32Sync();
        if (callback) {
          // Register handler
          _sendHandlers[_idRemove] = (err) => {
            callback.call(null, err);
          };
        }

        var _index = utils.find(_handlers[_id].channel.ids, id)
        if (_index !== -1) {
          _handlers[_id].channel.ids.splice(_index, 1);
        }

        _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_CONSUME_REMOVE_ID, _idRemove, { id : id, handlerId : _id, channel : _handlers[_id].channel });
      }
    }
  }

  /**
   * Redefine handlers when reconnecting to host
   * @param {Object} socket { socket, id }
   */
  function _redefineHandlers (socket) {
    for (var id in _handlers) {
      var _handler = _handlers[id];

      var _route = _handler.type === constants.LISTENER_TYPES.LISTEN ? routes.QUEUE_LISTEN : routes.QUEUE_CONSUME;
      _hosts.write(socket, _config.clientId, _config.privateKey, _route, id, _handler.channel);
    }
  }

  return {
    connect,
    disconnect,
    send,
    listen,
    consume
  };
};


module.exports = kittenMQ;
