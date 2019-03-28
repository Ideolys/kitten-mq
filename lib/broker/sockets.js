const Socket = require('kitten-socket');
const fs     = require('fs');
const path   = require('path');
const routes = require('../routes');
const utils  = require('../utils');
const jwt    = require('kitten-jwt');

function getClientId (id) {
  return id.split('#');
}

module.exports = {

  /**
   * Start broker sockets
   * @param {Object} config
   */
  start : function (config, publicKeys, listenerDisconnect, listenerBroker, listenerManagement) {
    let _socketServer     = null;
    let _managementSocket = null;

    _socketServer = new Socket(config.socketServer.port, config.socketServer.host, {
      logsDirectory : config.socketServer.logs            || 'packets',
      logsFilename  : config.socketServer.packetsFilename || 'broker.log',
      token         : config.socketServer.token
    });
    _socketServer.startServer(() => {
      console.log('Broker socket started');
    });
    _socketServer.on('Error broker : ', console.error);

    /**
     * handler for new messages
     */
    _socketServer.on('message', (packet, client) => {
      if (packet.data.type && packet.data.type === 'REGISTER') {
        return;
      }

      if (!packet.data.route) {
        return;
      }

      let _clientId = getClientId(client.id);

      // Register a client
      if (packet.data.route && packet.data.route === routes.REGISTER_CLIENT) {
        let _pathKey = path.join(config.registeredClientsPath, _clientId[0] + '.pub');

        utils.createDirIfNotExists(config.registeredClientsPath);

        if (!fs.existsSync(_pathKey)) {
          fs.writeFileSync(_pathKey, packet.data.data);
          publicKeys[_clientId[0]] = packet.data.data;
        }
        return;
      }

      if (!packet.data.headers || !packet.data.headers.authorization) {
        return;
      }

      let _verify = jwt.verifyHTTPHeaderFn(config.serviceId, (req, res, payload, callback) => {
        let _clientId = payload.iss;
        callback(publicKeys[_clientId]);
      });

      let _req = packet.data;

      _verify(_req, null, (err) => {
        if (err) {
          return;
        }

        listenerBroker(packet, client.id);
      });
    });

    /**
     * Handler for closing sockets
     */
    _socketServer.on('close', (client) => {
      listenerDisconnect(client.id);
    });

    _managementSocket = new Socket(config.managementSocket.port, config.managementSocket.host, {
      logsDirectory : config.managementSocket.logs            || 'packets',
      logsFilename  : config.managementSocket.packetsFilename || 'management.log',
      token         : config.managementSocket.token
    });
    _managementSocket.startServer(() => {
      console.log('Management socket started');
    });
    _managementSocket.on('Error management : ', console.error);
    _managementSocket.on('message', listenerManagement);

    return {
      broker     : _socketServer,
      management : _managementSocket
    };
  }
};
