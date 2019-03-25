const path   = require('path');
const fs     = require('fs');
const jwt    = require('kitten-jwt');
const crypto = require('crypto');

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
   * Create directory if not exists
   * @param {String} path path to the directory
   */
  createDirIfNotExists : function (path) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  },

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
      this.createDirIfNotExists(keysDirectory);

      return jwt.generateECDHKeys(keysDirectory, keysName, (err) => {
        if (err) {
          console.log('Cannot create public and private keys');
          throw new err;
        }

        callback(_readKeys(_privateKeyPath, _publicKeyPath));
      });
    }

    callback(_readKeys(_privateKeyPath, _publicKeyPath));
  },

  /**
   * Get random 32 bits integer
   */
  randU32Sync : function randU32Sync() {
    return crypto.randomBytes(4).readUInt32BE(0, true);
  }

}
