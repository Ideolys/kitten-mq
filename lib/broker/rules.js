const logger = require('./logger');
const log    = logger.log;

function rules (rules) {
  let _rules        = {}; // key -> endpoint
  let _cache        = {}; // key -> client + channel

  let _genericRulesRead  = [];
  let _genericRulesWrite = [];
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

      let array = isRead ? _genericRulesRead : _genericRulesWrite;

      if (array.indexOf(client) === -1) {
        array.push(client);
      }
    }
    else {
      if (isRead) {
        _clientsRead[client] = true;
      }
      else {
        _clientsWrite[client] = true;
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
  function _isClientInGenericRules (isRead, client) {
    let array = isRead ? _genericRulesRead : _genericRulesWrite;

    for (var i = 0; i < array.length; i++) {
      if (client.slice(0, array[i].length) === array[i]) {
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
      let _res = false;

      let _version = channelParts.version;
      let _ids     = channelParts.id;
      let _channel = channelParts.endpoint + '/' + channelParts.version + '/' + channelParts.id;
      let hasRules = isRead ? _clientsRead[client] === true : _clientsWrite[client] === true;

      // Try to find if client is in generic rule
      if (!hasRules) {
        hasRules = _isClientInGenericRules(isRead, client);
      }


      if (!_rules[channelParts.endpoint]) {
        return !hasRules;
      }

      if (!_rules[channelParts.endpoint][channelParts.version]) {
        if (!_rules[channelParts.endpoint]['*']) {
          return !hasRules;
        }
        else {
          _version = '*';
        }
      }

      if (_version === '*') {
        return _isClientInList(_rules[channelParts.endpoint][_version], client) || !hasRules;
      }

      if (!_rules[channelParts.endpoint][_version][channelParts.id]) {
        if (!_rules[channelParts.endpoint][_version]['*']) {
          return !hasRules;
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
          channelParts.id = [channelParts.id];
        }

        for (var i = 0; i < channelParts.id.length; i++) {
          if (tree.ids[channelParts.id[i]]) {
            log(logger.LEVELS.INFO, logger.NAMESPACES.HANDLER, 'from=' + client + '#' + node + ';router=' + _channel + ';failed! exclusive route already registered;id=' + channelParts.id[i]);
            return false;
          }
        }
      }

      return _res || !hasRules;
    }
  }
}

module.exports = rules;
