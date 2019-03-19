const Socket = require('kitten-socket');

module.exports = {

  /**
   * Start broker sockets
   * @param {Object} config
   */
  start : function (config) {
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

    _managementSocket = new Socket(config.managementSocket.port, config.managementSocket.host, {
      logsDirectory : config.managementSocket.logs            || 'packets',
      logsFilename  : config.managementSocket.packetsFilename || 'management.log',
      token         : config.managementSocket.token
    });
    _managementSocket.startServer(() => {
      console.log('Management socket started');
    });
    _managementSocket.on('Error management : ', console.error);

    return {
      broker     : _socketServer,
      management : _managementSocket
    };
  }
};
