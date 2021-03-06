const Socket = require('kitten-socket');
const fs     = require('fs');
const path   = require('path');
const routes = require('../routes');
const utils  = require('../utils');
const jwt    = require('kitten-jwt');
const logger = require('./logger');
const log    = logger.log;

function getClientId (id) {
  return id.split('#');
}

module.exports = {

  /**
   * Start broker sockets
   * @param {Object} config
   */
  start : function (config, publicKeys, listenerDisconnect, listenerBroker) {
    let _socketServer = null;
    let _config       = config;

    _socketServer = new Socket(_config.socketServer.port, _config.socketServer.host, {
      logsDirectory      : _config.socketServer.logs            || 'packets',
      logsFilename       : _config.socketServer.packetsFilename || 'broker.log',
      token              : _config.socketServer.token,
      onSocketRegisterFn : (packet, client, callback) => {
        // Deny socket registration while broker is stopping
        if (_config.isStopping) {
          log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'Deny connection attempt from=' + packet.data.uid);
          return callback(false);
        }

        callback(true);
      }
    });
    _socketServer.startServer(() => {
      console.log('Broker started');
    });
    _socketServer.on('warning', (err) => {
      console.log('Broker not started! ' + err.message);
    });

    /**
     * handler for new messages
     */
    _socketServer.on('message', (packet, client) => {
      if (packet.data.type && packet.data.type === 'REGISTER') {
        return log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + (client.id || packet.data.uid) + ';type=socket registration (kitten-socket)');
      }

      if (!packet.data.route) {
        return log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + client.id + ';type=no route specified');
      }

      if (client.id === undefined) {
        return log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + client.id + ';type=no client id');
      }

      let _clientId = getClientId(client.id);

      // Register a client
      if (packet.data.route && packet.data.route === routes.REGISTER_CLIENT) {
        let _pathKey = path.join(_config.registeredClientsPath, _clientId[0] + '.pub');

        utils.createDirIfNotExists(_config.registeredClientsPath);

        if (!fs.existsSync(_pathKey)) {
          fs.writeFileSync(_pathKey, packet.data.data);
          publicKeys[_clientId[0]] = packet.data.data;
        }
        return;
      }

      if (!packet.data.headers || !packet.data.headers.authorization) {
        log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + client.id + ';type=no authorization header');
        return;
      }

      let _verify = jwt.verifyHTTPHeaderFn(_config.serviceId, (req, res, payload, callback) => {
        let _clientId = payload.iss;
        callback(publicKeys[_clientId]);
      });

      _verify(packet.data, null, (err) => {
        if (err) {
          log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + client.id + ';type=bad token');
          return;
        }

        listenerBroker(packet, client.id);
      });
    });

    /**
     * Handler for closing sockets
     */
    _socketServer.on('close', (client) => {
      // If id is not defined, the socket must have been denied (config.isStopping = true)
      if (client.id) {
        log(logger.LEVELS.INFO, logger.NAMESPACES.SOCKET, 'from=' + client.id + ';type=disconnect');
      }
      listenerDisconnect(client.id);
    });

    return {
      broker : _socketServer,
      reload : config => {
        _config = config;
      }
    };
  }
};
