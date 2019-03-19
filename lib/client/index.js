function kittenMQ () {
  var _that   = this;
  let _config = {
    hosts    : [],                    // list of brokers mirror URLs for High Avaibility
    serverId : 'mybroker-service-1',  // broker unique id, defined on the broker side
    pubKey   : 'key',                 // The public key of this client sent to the broker
    privKey  : 'key',                 // The private key of the client used to generate tokens
    clientId : 'myclient-id'          // The client id, it must be globally unique
  };

  function connect (config, callback) {
    _config = config;
  }

  function send (channel, msg, callback) {

  }

  function listen (channel, callback) {

  }

  function consume (channel, callback) {

  }

  this.connect = connect;
  this.send    = send;
  this.listen  = listen;
  this.consume = consume;
};


module.exports = kittenMQ;

