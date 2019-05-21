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

let index = {
  /**
   * Sort
   * @param {*} a
   * @param {*} b
   * @return {Int}
   */
  sort : function sort (a, b) {
    if (a === null && b === null) {
      return 0;
    }

    if (a === null) {
      return -1;
    }

    if (b === null) {
      return 1;
    }

    if (a < b) {
      return -1;
    }

    if (a > b) {
      return 1;
    }

    return 0;
  },

  /**
   * Insert value at specified index
   * @param {Array} array
   * @param {int} index
   * @param {*} value
   * @return {Array}
   */
  insertAt : function insertAt (array, index, value) {
    array.splice(index, 0, value);
    return array;
  },

  /**
   * Removed value at specified index
   * @param {Array} array
   * @param {*} index
   * @returns {Array}
   */
  removeAt : function removeAt (array, index) {
    array.splice(index, 1);
    return array;
  },

  /**
   * BinarySearh
   * @param {Array} array
   * @param {*} value
   * @returns {Object} { found : Boolean, index : Int }
   */
  binarySearch : function binarySearch (array, value) {
    var lo = 0;
    var hi = array.length;
    var compared;
    var mid;


    while (lo < hi) {
      mid = ((lo + hi) / 2) | 0;
      compared = this.sort(value, array[mid]);
      if (compared === 0) {
        return {
          found : true,
          index : mid
        };
      } else if (compared < 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    return {
      found : false,
      index : hi
    };
  }
};

module.exports = {
  index,

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
  },

  /**
   * Find inddex value
   * @param {Array} array
   * @param {String/Int} value
   */
  find (array, value) {
    var _index = -1;

    for (var i = 0, len = array.length; i < len; i++) {
      if (array[i] == value) {
        return i;
      }
    }

    return _index;
  }
}
