const Socket = require('kitten-socket');
const utils  = require('../utils');
const jwt    = require('kitten-jwt');

function hosts (config) {
  let _hosts = {
    sockets : []
  };
  let _config = config;

  /**
   * @param {Object} config
   * @param {Function} listen
   */
  _hosts.connect = function connect (listen, callback) {
    var i = 0;

    /**
     * Connect to the next host
     * @param {Function} callback
     */
    function _processNextHost (callback) {
      if (i >= _config.hosts.length) {
        return callback();
      }

      let _currentHost = _config.hosts[i];
      let _host        = _currentHost.split('@');
      let _serviceId   = _host[1];
      _host            = _host[0].split(':');

      let _socket = new Socket(_host[1], _host[0], {
        uid : _config.clientId
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

      // _socket.on('error', (err) => {
      //   if (err.code === 'ECONNREFUSED') {
      //     if (!_hosts.sockets[i]) {
      //       _hosts.sockets[i] = {
      //         socket : _socket,
      //         host   : _host,
      //         id     : _serviceId
      //       };
      //     }
      //     _hosts.sockets[i].isConnected = false;
      //     i++;
      //     return _processNextHost(callback);
      //   }
      // });
    }

    _processNextHost(callback);
  }

  function _iterator (handler, pointer = 0) {
    while (pointer < _hosts.sockets.length) {
      handler.call(null, _hosts.sockets[pointer].socket, _hosts.sockets[pointer].id);
      pointer++;
    }
  }

  /**
   * Disconnect from hosts
   * @param {Function} callback
   */
  _hosts.disconnect = function disconnect (callback) {
    let _currentHost = _hosts.sockets.shift();

    if(!_currentHost) {
      if (callback) {
        return callback();
      }

      return;
    }

    _currentHost.socket.stop(() => {
      _hosts.disconnect(callback);
    });
  };

  /**
   * Broadcast data to hosts
   * @param {String} clientId
   * @param {String}privateKey key to sign jwt
   * @param {String}route
   * @param {Int} handlerId
   * @param {*} data
   * @param {Int} messageId id gereated by broker
   */
  _hosts.broadcast = function broadcast (clientId, privateKey, route, handlerId, data, messageId) {
    _iterator((socket, serviceId) => {
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

      _packet.headers.authorization = 'Bearer ' + jwt.getToken(clientId.split('#')[0], serviceId, privateKey);
      socket.send(_packet);
    });
  }

  return _hosts;
}

module.exports = hosts;
