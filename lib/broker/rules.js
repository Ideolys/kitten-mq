const logger = require('./logger');
const log    = logger.log;

function rules (rules) {
  let _rules        = {}; // key -> endpoint
  let _genericRules = [];
  let _cache        = {}; // key -> client + channel

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

      if (_genericRules.indexOf(client) === -1) {
        _genericRules.push(client);
      }
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
      let _isExclusive  = false;

      if (_channelParts[0] === '*') {
        console.log('Cannot define a rule equals to *');
      }

      if (/^!/.test(_channelParts[0])) {
        _isExclusive = true;
        _channelParts[0] = _channelParts[0].replace(/^!/, '');
      }

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
        _rules[_channelParts[0]][_channelParts[1]].isExclusive = _isExclusive
        _rules[_channelParts[0]][_channelParts[1]][_isGeneric ? 'generics' : 'clients'].push(client);
        continue;
      }

      if (!_rules[_channelParts[0]][_channelParts[1]][_channelParts[2]]) {
        _rules[_channelParts[0]][_channelParts[1]][_channelParts[2]] = {
          clients     : [],
          generics    : [],
          isExclusive : _isExclusive
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

  /**
   * Is client in generic rules
   * @param {String} client
   */
  function _isClientInGenericRules (client) {
    for (var i = 0; i < _genericRules.length; i++) {
      if (client.slice(0, _genericRules[i].length) === _genericRules[i]) {
        return true;
      }
    }

    return false;
  }

  return {
    _rules,
    _cache,

    /**
     * Is client allowed to read or write on channel
     * The result is cached
     * @param {String} client
     * @param {String} node
     * @param {Object} channelParts { endpoint : String, version : String, ids : String/Array }
     * @param {Boolean} isRead
     * @param {Object} tree
     * @return {Boolean}
     */
    isAllowed : function (client, node, channelParts, isRead = true, tree) {
      let _res              = true;
      let _isClientHasRules = false;

      let _version = channelParts.version;
      let _ids     = channelParts.id;

      let _channel  = channelParts.endpoint + '/' + channelParts.version + '/' + channelParts.id;
      let _cacheKey = (isRead ? 'R_' : 'W_') + client + '@' + _channel;

      if (_cache[_cacheKey]) {
        return _cache[_cacheKey];
      }

      if (isRead) {
        _isClientHasRules = !!_clientsRead[client];
      }
      else {
        _isClientHasRules = _clientsWrite[client];

        if (_isClientHasRules === undefined) {
          let _isInGenericRule = _isClientInGenericRules(client);
          _isClientHasRules = _clientsWrite[client] = _isInGenericRule;
        }
      }

      if (!_rules[channelParts.endpoint]) {
        _cache[_cacheKey] = _res && !_isClientHasRules;
        return _cache[_cacheKey];
      }

      if (!_rules[channelParts.endpoint][channelParts.version]) {
        if (!_rules[channelParts.endpoint]['*']) {
          _cache[_cacheKey] = _res && !_isClientHasRules;
          return _cache[_cacheKey];
        }
        else {
          _version = '*';
        }
      }

      if (_version === '*') {
        _res = _isClientInList(_rules[channelParts.endpoint][_version], client);

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

      if (!_rules[channelParts.endpoint][_version][channelParts.id]) {
        if (!_rules[channelParts.endpoint][_version]['*']) {
          _cache[_cacheKey] = _res && !_isClientHasRules;
          return _cache[_cacheKey];
        }
        else {
          _ids = '*';
        }
      }

      _res = _isClientInList(_rules[channelParts.endpoint][_version][_ids], client);

      // Maybe there is a rule that listen on * version, so we must try it too
      if (!_res && _rules[channelParts.endpoint]['*']) {
        _res = _isClientInList(_rules[channelParts.endpoint]['*'], client);
      }
      // Maybe there is a rule that listen on * ids, so we must try it too
      if (!_res && _rules[channelParts.endpoint][_version]['*']) {
        _res = _isClientInList(_rules[channelParts.endpoint][_version]['*'], client);
      }

      let _isExclusive = _rules[channelParts.endpoint][_version][_ids].isExclusive;

      if (_isExclusive && isRead) {
        if (!Array.isArray(channelParts.id)) {
          channelParts.ids = [channelParts.id];
        }

        for (var i = 0; i < channelParts.id.length; i++) {
          if (tree.ids[channelParts.id[i]]) {
            _res              = false;
            _isClientHasRules = true;
            break;
          }
        }
      }

      if (_res) {
        if (isRead) {
          _clientsRead[client]  = _isClientHasRules = true;
        }
        else {
          _clientsWrite[client] = _isClientHasRules = true;
        }
      }

      let _isAllowed = _res === _isClientHasRules;

      if (!isRead) {
        _cache[_cacheKey] = _isAllowed;
      }

      if (_isExclusive && !_isAllowed) {
        log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + '#' + node + ';router=' + _channel + ';failed! exclusive route already registered');
      }

      return _isAllowed;
    }
  }
}

module.exports = rules;
