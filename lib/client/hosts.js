const Socket          = require('kitten-socket');
const jwt             = require('kitten-jwt');
const { randU32Sync } = require('../utils');

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
      let _service     = _host[1].split('#');
      let _serviceId   = _service[0];
      let _token       = _service[1];
      _host            = _host[0].split(':');

      let _socket = new Socket(_host[1], _host[0], {
        uid   : _config.clientId,
        token : _token
      });

      _host = _host[0] + ':' + _host[1];

      _socket.on('warning', function (err) {
        if (err.code && err.code === 'ECONNREFUSED') {
          let _error = `The host "${ _host }" is unreachable`;
          console.log(_error);
        }
      });

      _socket.on('message', (packet) => {
        if (packet.data.type === 'REGISTERED') {
          i++;

          if (_hosts.onConnect && i > _config.hosts.length) {
            return _hosts.onConnect({ socket : _socket, id : _serviceId });
          }

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

  _hosts.onConnect = null;

  function _iterator (handler, pointer = 0) {
    while (pointer < _hosts.sockets.length) {
      handler.call(null, _hosts.sockets[pointer]);
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
    messageId = messageId || randU32Sync();

    _iterator(socket => {
      write(socket, clientId, privateKey, route, handlerId, data, messageId);
    });
  }

  /**
   * Send data to a host
   * @param {Object} socket
   * @param {String} clientId
   * @param {String}privateKey key to sign jwt
   * @param {String}route
   * @param {Int} handlerId
   * @param {*} data
   * @param {Int} messageId id gereated by broker
   */
  function write(socket, clientId, privateKey, route, handlerId, data, messageId) {
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

    _packet.headers.authorization = 'Bearer ' + jwt.getToken(clientId.split('#')[0], socket.id, privateKey);
    socket.socket.send(_packet);
  };

  _hosts.write = write;

  return _hosts;
}

module.exports = hosts;
