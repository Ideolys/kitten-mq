const utils  = require('../utils');
const hosts  = require('./hosts');
const routes = require('../routes');
const crypto = require('crypto');

function randU32Sync() {
  return crypto.randomBytes(4).readUInt32BE(0, true);
}

function kittenMQ () {
  let _that   = this;
  let _config = {
    hosts         : [],// list of brokers mirror URLs for High Avaibility
    keysDirectory : 'keys',
    keysName      : 'client',
    clientId      : 'myclient-id' // The client id, it must be globally unique
  };
  let _hosts    = null;
  let _handlers = {};

  let _listenSocket = function listenSocket (host, packet) {
    if (!packet.headers || (packet.headers && !packet.headers.handlerId )) {
      return;
    }

    let _handlerId = packet.headers.handlerId;

    if (!_handlers[_handlerId]) {
      // @todo return an error for broker
      return;
    }


    _handlers[_handlerId].call(null, null, packet.data, { channel : packet.headers.channel });
  }

  /**
   * Connect to brokers
   * @param {Object} config
   * @param {Function} callback
   */
  function connect (config, callback) {
    _config          = Object.assign(_config, config);
    _config.clientId = _config.clientId + '#' + randU32Sync();

    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, (keys) => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;

      hosts.connect(_config, _listenSocket, (connectedHosts) => {
        _hosts = connectedHosts;

        hosts.broadcast(_hosts.sockets, routes.REGISTER_CLIENT, keys.public);
        callback();
      });
    });
  }

  /**
   * Disconnect client from hosts
   * @param {Function} callback
   */
  function disconnect (callback) {
    hosts.disconnect(_hosts, callback);
  }

  function send (channel, data, callback) {
    hosts.broadcast(_hosts.sockets, routes.QUEUE_SEND, null, { channel, data });
  }

  function _listen () {

  }

  /**
   * Listen a channel
   * @param {String} channel
   * @example /endpoint_1/version_1/param_1
   * @example /endpoint_1/version_1/*
   * @example /endpoint_1/*
   * @param {Function} callback
   */
  function listen (channel, callback) {
    let _id = randU32Sync();
    // Register handler
    _handlers[_id] = callback;

    hosts.broadcast(_hosts.sockets, routes.QUEUE_LISTEN, _id, channel);
  }

  function consume (channel, callback) {

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
