function rules (rules) {
  let _rules   = {}; // key -> endpoint
  let _cache   = {}; // key -> client + channel

  let _clientsRead  = {};
  let _clientsWrite = {};

  /**
   * Push to rules
   * @param {String} client
   * @param {Object} rule { client : String, read : [], write : [] }
   * @param {Boolean} isRead
   */
  function _push (client, rule, isRead = true) {
    if (!(rule && Array.isArray(rule))) {
      return;
    }

    let _isGeneric = false;
    if (/\*$/.test(client)) {
      _isGeneric = true;
      client = client.replace('*', '');
    }
    else {
      if (isRead) {
        _clientsRead[client] = 1;
      }
      else {
        _clientsWrite[client] = 1;
      }
    }

    for (var j = 0; j < rule.length; j++) {
      let _rule         = rule[j];
      let _channelParts = _rule.split('/');

      if (!_rules[_channelParts[0]]) {
        _rules[_channelParts[0]] = {};
      }

      if (!_rules[_channelParts[0]][_channelParts[1]]) {
        _rules[_channelParts[0]][_channelParts[1]] = {
          clients  : [],
          generics : []
        };
      }

      if (_channelParts[1] === '*') {
        _rules[_channelParts[0]][_channelParts[1]][_isGeneric ? 'generics' : 'clients'].push(client);
        continue;
      }

      if (!_rules[_channelParts[0]][_channelParts[1]][_channelParts[2]]) {
        _rules[_channelParts[0]][_channelParts[1]][_channelParts[2]] = {
          clients  : [],
          generics : []
        };
      }

      _rules[_channelParts[0]][_channelParts[1]][_channelParts[2]][_isGeneric ? 'generics' : 'clients'].push(client);
    }
  }

  /**
   * Is client in rule
   * @param {Object} rule { clients : [], generics : [] }
   * @param {String} client
   * @returns {Boolean}
   */
  function _isClientInList (rule, client) {
    if (rule.clients.indexOf(client) !== -1) {
      return true;
    }

    for (var i = 0; i < rule.generics.length; i++) {
      if (client.slice(0, rule.generics[i].length) === rule.generics[i]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Initialization
   */

  if (Array.isArray(rules)) {
    for (var i = 0; i < rules.length; i++) {
      let _rule = rules[i];

      // Read
      _push(_rule.client, _rule.read);

      // Write
      _push(_rule.client, _rule.write, false);
    }
  }

  return {
    _rules,
    _cache,

    /**
     * Is client allowed to read or write on channel
     * The result is cached
     * @param {String} client
     * @param {Array} channelParts [0] -> endpoint, [1] -> version, [2] -> param
     * @param {Boolean} isRead
     * @return {Boolean}
     */
    isAllowed : function (client, channelParts, isRead = true) {
      let _res              = true;
      let _isClientHasRules = false;

      let _cacheKey = client + '@' + channelParts.join('/');

      if (_cache[_cacheKey]) {
        return _cache[_cacheKey];
      }

      if (isRead) {
        _isClientHasRules = !!_clientsRead[client];
      }
      else {
        _isClientHasRules = !!_clientsWrite[client];
      }

      if (!_rules[channelParts[0]]) {
        _cache[_cacheKey] = _res && !_isClientHasRules;
        return _cache[_cacheKey];
      }


      if (!_rules[channelParts[0]][channelParts[1]]) {
        if (!_rules[channelParts[0]]['*']) {
          _cache[_cacheKey] = _res && !_isClientHasRules;
          return _cache[_cacheKey];
        }
        else {
          channelParts[1] = '*';
        }
      }

      if (channelParts[1] === '*') {
        _res = _isClientInList(_rules[channelParts[0]][channelParts[1]], client);

        if (_res) {
          if (isRead) {
            _clientsRead[client]  = _isClientHasRules = true;
          }
          else {
            _clientsWrite[client] = _isClientHasRules = true;
          }
        }

        _cache[_cacheKey] = _res === _isClientHasRules;
        return _cache[_cacheKey];
      }

      if (!_rules[channelParts[0]][channelParts[1]][channelParts[2]]) {
        if (!_rules[channelParts[0]][channelParts[1]]['*']) {
          _cache[_cacheKey] = _res && !_isClientHasRules;
          return _cache[_cacheKey];
        }
        else {
          channelParts[2] = '*';
        }
      }

      _res = _isClientInList(_rules[channelParts[0]][channelParts[1]][channelParts[2]], client);

      if (_res) {
        if (isRead) {
          _clientsRead[client]  = _isClientHasRules = true;
        }
        else {
          _clientsWrite[client] = _isClientHasRules = true;
        }
      }

      _cache[_cacheKey] = _res === _isClientHasRules;
      return _cache[_cacheKey];
    }
  }
}

module.exports = rules;
