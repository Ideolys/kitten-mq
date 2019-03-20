const Socket = require('kitten-socket');
const fs     = require('fs');
const path   = require('path');
const routes = require('../routes');


module.exports = {

  /**
   * Start broker sockets
   * @param {Object} config
   */
  start : function (config, listenerBroker, listenerManagement) {
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
    _socketServer.on('message', (packet, client) => {
      if (packet.type && packet.type === 'REGISTER') {
        // @todo do domething with client on register
        return;
      }

      if (packet.data.route && packet.data.route === routes.REGISTER_CLIENT) {
        let _pathKey = path.join(config.registeredClientsPath, client.id + '.pub');
        if (!fs.existsSync(_pathKey)) {
          fs.writeFileSync(_pathKey, packet.data.data);
        }
      }

      listenerBroker(packet);
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
