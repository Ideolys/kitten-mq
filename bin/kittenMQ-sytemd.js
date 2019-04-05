const path = require('path');
const fs   = require('fs');
const os   = require('os');
const user = os.userInfo().username;

/**
 * Create systemd service
 */
function checkSystemdConfigFile () {
  try {
    fs.writeFileSync(
      path.join('/etc', 'systemd', 'system', 'kitten-mq.service'),
      fs.readFileSync(path.join(__dirname, 'kittenMQ.service'), 'utf8').replace(/@user/g, user)
    );
  }
  catch (e) {
    throw e;
  }
}

module.exports = function install () {
  checkSystemdConfigFile();
};
