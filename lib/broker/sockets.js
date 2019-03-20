const Socket = require('kitten-socket');
const fs     = require('fs');
const path   = require('path');
const routes = require('../routes');
const utils  = require('../utils');

function getClientId (id) {
  return id.split('#');
}

module.exports = {

  /**
   * Start broker sockets
   * @param {Object} config
   */
  start : function (config, clients, listenerBroker, listenerManagement) {
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
        let _clientId = getClientId(packet.data.uid);

        if (!clients[_clientId[0]]) {
          clients[_clientId[0]] = [];
        }

        clients[_clientId[0]].push(_clientId[1]);
        return;
      }

      if (packet.data.route && packet.data.route === routes.REGISTER_CLIENT) {
        let _pathKey = path.join(config.registeredClientsPath, getClientId(client.id)[0] + '.pub');

        utils.createDirIfNotExists(config.registeredClientsPath);

        if (!fs.existsSync(_pathKey)) {
          fs.writeFileSync(_pathKey, packet.data.data);
        }
      }

      listenerBroker(packet, client.id);
    });

    /**
     * Handler for closing sockets
     */
    _socketServer.on('close', (client) => {
      let _clientId = getClientId(client.id);
      let _index    = clients[_clientId[0]].indexOf(_clientId[1]);
      clients[_clientId[0]].splice(_index, 1);
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
