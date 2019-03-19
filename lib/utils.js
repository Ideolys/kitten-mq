const path = require('path');
const fs   = require('fs');
const jwt  = require('kitten-jwt');

/**
 * Read private and public key
 * @param {String} privateKeyPath path to private key
 * @param {String} publicKeyPath  path to public key
 * @returns {Object} { private : 'String', public : 'String }
 */
function _readKeys (privateKeyPath, publicKeyPath) {
  return {
    private : fs.readFileSync(privateKeyPath, 'utf-8'),
    public  : fs.readFileSync(publicKeyPath , 'utf-8')
  };
}

module.exports = {

  /**
   * Get and/or generate public/private keys
   * @param {String} keysDirectory path to directory of keys
   * @param {String} keysName name of the private and public key
   * @param {Function} callback returns one param -> { private : 'String', public : 'String' }
   */
  getPrivateAndPublicKeys : function (keysDirectory, keysName, callback) {
    let _publicKeyPath  = path.join(keysDirectory, keysName + '.pub');
    let _privateKeyPath = path.join(keysDirectory, keysName + '.pem');

    if (!fs.existsSync(_publicKeyPath) && !fs.existsSync(_privateKeyPath)) {
      return jwt.generateECDHKeys(keysDirectory, keysName, (err) => {
        if (err) {
          console.log('Cannot create public and private keys');
          throw new err;
        }

        callback(_readKeys(_privateKeyPath, _publicKeyPath));
      });
    }

    callback(_readKeys(_privateKeyPath, _publicKeyPath));
  }

}
