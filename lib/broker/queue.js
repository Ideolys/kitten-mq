const constants = require('./constants');
const { index } = require('../utils');

let clientConsume = 'root';

/**
 * Queue tree
 *
 * If a client defines multiple listeners, only one will be called
 *
 * Structure:
 *
 * {
 *   clientNodes : {
 *     // Consumers
 *     root : {
 *       nodes    : ['client_1#node_1@handler_1', 'client_1#node_2@handler_2', 'client_N#node_N@handler_N'],
 *       lastNode : 0
 *     },
 *
 *     // Listeners
 *     client_1 : {
 *       nodes    : ['client_1#node_3@handler_3', 'client_1#node_4@handler_4'],
 *       lastNode : 1
 *     }
 *   }
 * }
 * @returns {Object}
 */
function queueTree () {
  let _tree = {
    // Indexes
    ids         : [],
    clientIds   : [],
    clientNodes : [],
    clients     : {}  // positions where a client is in indexes
  };


  /**
   * Has node in the tree
   * @param {String} node
   */
  _tree.has = function has (node) {
    return _tree[subTrees[node]];
  };

  /**
   * Add a client in the tree
   * clientId : client#node
   * @param {Array/Int} ids
   * @param {String} client
   * @param {Stirng} node
   * @param {Int} type LISTEN / CONSUME
   */
  _tree.addClient = function addClient (ids, client, node, type) {
    node = client + '#' + node;
    if (type === constants.LISTENER_TYPES.CONSUME) {
      client = clientConsume;
    }

    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    for (var i = 0; i < ids.length; i++) {
      let _id  = ids[i] + '';
      let _res = index.binarySearch(_tree.ids, _id);

      if (!_res.found) {
        _tree.ids[_res.index]         = _id;
        _tree.clientIds[_res.index]   = [];
        _tree.clientNodes[_res.index] = {};
      }

      if (!_tree.clients[client]) {
        _tree.clients[client] = [];
      }

      _tree.clients[client].push(_res.index);
      _tree.clientIds[_res.index].push(client);

      if (!_tree.clientNodes[_res.index][client]) {
        _tree.clientNodes[_res.index][client] = {
          nodes    : [],
          lastNode : -1
        };
      }

      if (_tree.clientNodes[_res.index][client].nodes.indexOf(node) === -1) {
        _tree.clientNodes[_res.index][client].nodes.push(node);
      }
    }
  };

  /**
   * Remove a client from the tree
   * @param {String} client
   * @param {String} node
   * @param {Int} type
   * @param {Int} id @optional
   */
  _tree.removeClient = function removeClient (client, node, type, id) {
    node = client + '#' + node;
    if (type === constants.LISTENER_TYPES.CONSUME) {
      client = clientConsume;
    }

    if (!_tree.clients[client]) {
      return;
    }

    for (var i = _tree.clients[client].length - 1; i >= 0; i--) {

      if (id) {
        if (_tree.ids[_tree.clients[client][i]] != id) {
          continue;
        }
      }

      let _position    = _tree.clients[client][i];
      let _indexClient = _tree.clientIds[_position].indexOf(client);
      if (_indexClient !== -1) {
        _tree.clientIds[_position].splice(_indexClient, 1);
      }

      if (_tree.clientNodes[_position][client] && type === constants.LISTENER_TYPES.CONSUME) {
        let _indexNode = _tree.clientNodes[_position][client].nodes.indexOf(node);
        if (_indexNode !== -1) {
          _tree.clientNodes[_position][client].nodes.splice(_indexNode, 1);
        }
        if (_tree.clientNodes[_position][client].lastNode === _position && _tree.clientNodes[_position][client].lastNode !== -1) {
          _tree.clientNodes[_position][client].lastNode--;
        }
      }
      else {
        delete _tree.clientNodes[_position][client];
      }

      _tree.clients[client].splice(i, 1);
    }
  };


  return _tree;
}

/**
 * Queue
 * @param {Function} handlerForQueue
 */
function queue (handlerForQueue, config) {
  let _queue =  {
    queue          : [],
    curentItem     : null,
    nbAcks         : 0,
    nbExpectedAcks : 0,
    tree           : queueTree()
  };

  let _acks = {};

  /**
   * Process item in the queue
   */
  function _processItemInQueue () {
    _queue.currentItem = _queue.queue.shift();

    if (!_queue.currentItem) {
      return;
    }

    let _clientsToSend    = _getClientsToSend(_queue.currentItem[0]);
    _queue.nbAcks         = 0;
    _queue.nbExpectedAcks = _clientsToSend.length;

    handlerForQueue(
      _acks,
      _clientsToSend,        // clients
      _queue.currentItem[1], // data
      _queue.currentItem[2]  // headers
    );
    setTimeout(_onTimeout, config.requeueInterval * 1000);
  }

  /**
   * Get clients for a position
   * @param {Int} position
   */
  function _getClientsForAPosition (position) {
    let _clients         = [];
    let _clientsAndNodes = _queue.tree.clientNodes[position];

    for (let client in _clientsAndNodes) {
      let _clientNodes = _clientsAndNodes[client];

      _clientNodes.lastNode++;

      if (_clientNodes.lastNode >= _clientNodes.nodes.length) {
        _clientNodes.lastNode = 0;
      }

      if (!_clientNodes.nodes.length) {
        continue;
      }

      _clients.push(_clientNodes.nodes[_clientNodes.lastNode]);
    }

    return _clients;
  }

  /**
   * Get clients for one id
   * @param {Int} id
   */
  function _getClientsForOneId (id) {
    let _clients = [];

    let _res = index.binarySearch(_queue.tree.ids, id);
    if (!_res.found) {
      return _clients;
    }

    return _getClientsForAPosition(_res.index);
  }

  /**
   * Get clients to send item
   * @param {Int} id
   * @returns {Array}
   */
  function _getClientsToSend (id) {
    let _clients = [];

    if (id !== '*') {
      _clients = _clients.concat(_getClientsForOneId(id));
      _clients = _clients.concat(_getClientsForOneId('*'));
      return _clients;
    }

    for (var i = 0; i < _queue.tree.ids.length; i++) {
      _clients = _clients.concat(_getClientsForAPosition(i));
    }

    return _clients;
  }

  /**
   * Resend an item
   * @param {String} ackKey
   */
  function _resend (ackKey) {
    let _headers  = _acks[ackKey];

    if (!_headers) {
      return;
    }

    if (_headers.nbRequeues === undefined) {
      _headers.nbRequeues = 0;
    }

    _headers.nbRequeues++;

    if (_headers.nbRequeues < config.requeueLimit) {
      _queue.queue.push([_queue.currentItem[0], _queue.currentItem[1], _headers]);
    }

    delete _acks[ackKey];
  }

  /**
   * On timeout requeue unacked messages
   */
  function _onTimeout () {
    let _ackKeys = Object.keys(_acks);

    for (var i = 0, len = _ackKeys.length; i < len; i++) {
      _resend(_ackKeys[i]);
    }

    // Process next item
    _processItemInQueue();
  }

  /**
   * Add an item in the queue
   * @param {*} id
   * @param {*} item data to send
   */
  _queue.addInQueue = function (id, item) {
    _queue.queue.push([id, item]);

    if (_queue.queue.length > 1 || _queue.currentItem) {
      return;
    }

    _processItemInQueue();
  };

  /**
   * Confirm current item
   */
  _queue.ack = function ack (acknowledge) {
    delete _acks[acknowledge];
    _queue.nbAcks++;

    if (_queue.nbAcks === _queue.nbExpectedAcks) {
      clearTimeout(_onTimeout);
      _processItemInQueue();
    }
  };

  /**
   * Requeue current item
   */
  _queue.nack = function nack (acknowledge) {
    _resend(acknowledge);
  };

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
