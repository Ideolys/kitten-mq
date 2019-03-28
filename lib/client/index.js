const utils  = require('../utils');
const hosts  = require('./hosts');
const routes = require('../routes');

function kittenMQ () {
  let _config = {
    hosts         : [],// list of brokers mirror URLs for High Avaibility
    keysDirectory : 'keys',
    keysName      : 'client',
    clientId      : 'myclient-id' // The client id, it must be globally unique
  };
  let _hosts    = null;
  let _handlers = {};

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

    if (!_handlers[_handlerId]) {
      // @todo return an error for broker
      return;
    }

    let _info = JSON.parse(JSON.stringify(packet.headers));

    if (packet.headers.error) {
      return _handlers[_handlerId].call(null, packet.headers.error, null, _ack, _info);
    }

    _handlers[_handlerId].call(null, null, packet.data, _ack, _info);
  }

  /**
   * Connect to brokers
   * @param {Object} config
   * @param {Function} callback
   */
  function connect (config, callback) {
    _config          = Object.assign(_config, config);
    _config.clientId = _config.clientId + '#' + utils.randU32Sync();

    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, (keys) => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;

      _hosts = hosts(_config);
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
    // Register handler
    _handlers[_id] = callback;

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_SEND, _id, { channel, data });
  }

  /**
   * Listen a channel
   * @param {String} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @param {Function} callback (err, data, info)
   */
  function listen (channel, callback) {
    let _id = utils.randU32Sync();
    // Register handler
    _handlers[_id] = (err, data, done, info) => {
      if (!err) {
        done.call(null, info.channel, _id, info.messageId);
      }

      callback.call(null, err, data, info);
    };

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_LISTEN, _id, channel);
  }

  /**
   * Consume a channel
   * @param {String} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @param {Function} callback (err, data, info)
   */
  function consume (channel, callback) {
    let _id = utils.randU32Sync();
    // Register handler
    _handlers[_id] = (err, data, done, info) => {
      /**
       * Ack or Nack
       * @param {Boolean} isAck true = ack, false = nack
       */
      let _done = (isAck = true) => {
        done.call(null, channel, _id, info.messageId, isAck);
      };

      callback.call(null, err, data, _done, info);
    };

    _hosts.broadcast(_config.clientId, _config.privateKey, routes.QUEUE_CONSUME, _id, channel);
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
