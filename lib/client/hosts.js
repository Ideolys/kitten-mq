const Socket = require('kitten-socket');

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

    let _host  = _currentHost.split('@');
    let _token = _host[1];
    _host      = _host[0].split(':');

    let _socket = new Socket(_host[1], _host[0], {
      uid   :  config.clientId,
      token : _token
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

      listen.call(null, _host, packet);
    });

    _socket.startClient(() => {
      _hosts.sockets.push({
        socket : _socket,
        host   : _host
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
    handler.call(null, hosts[pointer].socket);
    pointer++;
  }
}

/**
 * Broadcast data to hosts
 * @param {Array} hosts
 * @param {*} data
 */
function broadcast (hosts, route, data) {
  _iterator(hosts, (socket) => {
    socket.send({
      route,
      data
    });
  });
}

module.exports = {
  connect,
  disconnect,
  broadcast
};
