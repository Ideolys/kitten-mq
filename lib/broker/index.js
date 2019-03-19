const path   = require('path');
const fs     = require('fs');
const jwt    = require('kitten-jwt');
const utils  = require('../utils');
const sockets = require('./sockets');

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

  // Merge configs
  _config = Object.assign(_config, config);

  let _sockets = sockets.start(_config);

  utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, keys => {
    _config.privateKey = keys.private;
    _config.publicKey  = keys.public;
  });

  /**
   * Stop broker
   * @param {Function} callback
   */
  function stop (callback) {
    _sockets.broker.stop(() => {
      _sockets.management.stop(callback);
    });
  }

  return {
    stop,
    _sockets
  };
}

module.exports = broker;
