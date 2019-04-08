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
  start : function (config, publicKeys, listenerDisconnect, listenerBroker) {
    let _socketServer = null;
    let _config       = config;

    _socketServer = new Socket(_config.socketServer.port, _config.socketServer.host, {
      logsDirectory : _config.socketServer.logs            || 'packets',
      logsFilename  : _config.socketServer.packetsFilename || 'broker.log',
      token         : _config.socketServer.token
    });
    _socketServer.startServer(() => {
      console.log('Broker started');
    });
    _socketServer.on('Error broker : ', console.error);

    /**
     * handler for new messages
     */
    _socketServer.on('message', (packet, client) => {
      if (packet.data.type && packet.data.type === 'REGISTER') {
        console.log('client=' + client.id + ';route=' + packet.data.type + ';type=REGISTER');
        return;
      }

      if (!packet.data.route) {
        console.log('client=' + client.id + ';route=' + packet.data.route);
        return;
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
        console.log('client=' + client.id + ';route=' + packet.data.type + ';response=NO_AUTH_HEADER');
        return;
      }

      let _verify = jwt.verifyHTTPHeaderFn(_config.serviceId, (req, res, payload, callback) => {
        let _clientId = payload.iss;
        callback(publicKeys[_clientId]);
      });

      let _req = packet.data;

      _verify(_req, null, (err) => {
        if (err) {
          console.log('client=' + client.id + ';route=' + packet.data.type + ';response=UNAUTHORIZED');
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

    return {
      broker : _socketServer,
      reload : config => {
        _config = config;
      }
    };
  }
};
