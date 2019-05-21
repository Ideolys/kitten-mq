const path        = require('path');
let broker        = require('../../lib/broker');
let configBroker1 = path.join(__dirname, '..', 'config-broker-1.json');

let _broker = broker(configBroker1);
_broker.start(() => {});
