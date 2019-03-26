const Socket = require('kitten-socket');
const utils  = require('../utils');
const jwt    = require('kitten-jwt');

/**
 * @param {Object} config
 * @param {Function} listen
 */
function connect (config, listen, callback) {
  var i = 0;

  let _hosts = {
    sockets : []
  };

  /**
   * Connect to the next host
   * @param {Function} callback
   */
  function _processNextHost (callback) {
    if (i >= config.hosts.length) {
      return callback();
    }

    let _currentHost = config.hosts[i];

    let _host      = _currentHost.split('@');
    let _serviceId = _host[1];
    _host          = _host[0].split(':');

    let _socket = new Socket(_host[1], _host[0], {
      uid : config.clientId
    });

    _host = _host[0] + ':' + _host[1];

    _socket.on('error', function (err) {
      if (err.code && err.code === 'ECONNREFUSED') {
        let _error = `The host "${ _host }" is unreachbale`;
        console.log(_error);
      }
    });

    _socket.on('message', (packet) => {
      if (packet.data.type === 'REGISTERED') {
        i++;
        return _processNextHost(callback);
      }

      listen.call(null, _host, packet.data);
    });

    _socket.startClient(() => {
      _hosts.sockets.push({
        socket : _socket,
        host   : _host,
        id     : _serviceId
      });
    });
  }

  _processNextHost(() => {
    callback(_hosts);
  });
}

/**
 * Disconnect from hosts
 * @param {Array} hosts
 * @param {Function} callback
 */
function disconnect (hosts, callback) {
  let _currentHost = hosts.sockets.shift();

  if(!_currentHost) {
    return callback();
  }

  _currentHost.socket.stop(() => {
    disconnect(hosts, callback);
  });
}

function _iterator (hosts, handler, pointer = 0) {
  while (pointer < hosts.length) {
    handler.call(null, hosts[pointer].socket, hosts[pointer].id);
    pointer++;
  }
}

/**
 * Broadcast data to hosts
 * @param {String} clientId
 * @param {String}privateKey key to sign jwt
 * @param {Array} hosts
 * @param {String}route
 * @param {Int} handlerId
 * @param {*} data
 * @param {Int} messageId id gereated by broker
 */
function broadcast (clientId, privateKey, hosts, route, handlerId, data, messageId) {
  _iterator(hosts, (socket, serviceId) => {
    let _packet = {
      headers : {},
      route,
      data
    };

    if (handlerId) {
      _packet.headers.handlerId = handlerId;
    }

    if (messageId) {
      _packet.headers.messageId = messageId;
    }

    _packet.headers.authorization = 'Bearer ' +jwt.getToken(clientId.split('#')[0], serviceId, privateKey);
    socket.send(_packet);
  });
}

module.exports = {
  connect,
  disconnect,
  broadcast
};
