const utils    = require('../utils');
const hosts    = require('./hosts');

function kittenMQ () {
  let _that   = this;
  let _config = {
    hosts         : [],// list of brokers mirror URLs for High Avaibility
    keysDirectory : 'keys',
    keysName      : 'client',
    clientId      : 'myclient-id' // The client id, it must be globally unique
  };
  let _hosts = null;

  let _listen = function listen (host, packet) {
    console.log(host, packet);
  }

  /**
   * Connect to brokers
   * @param {Object} config
   * @param {Function} callback
   */
  function connect (config, callback) {
    _config = Object.assign(_config, config);

    utils.getPrivateAndPublicKeys(_config.keysDirectory, _config.keysName, (keys) => {
      _config.privateKey = keys.private;
      _config.publicKey  = keys.public;

      hosts.connect(config, _listen, (connectedHosts) => {
        _hosts = connectedHosts;

        hosts.broadcast(_hosts.sockets, keys.public);
        callback();
      });
    });
  }

  /**
   * Disconnect client from hosts
   * @param {Function} callback
   */
  function disconnect (callback) {
    hosts.disconnect(_hosts, callback);
  }

  function send (channel, msg, callback) {

  }

  function listen (channel, callback) {

  }

  function consume (channel, callback) {

  }

  this.connect    = connect;
  this.disconnect = disconnect;
  this.send       = send;
  this.listen     = listen;
  this.consume    = consume;

  return this;
};


module.exports = kittenMQ;

