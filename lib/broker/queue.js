const logger    = require('./logger');
const log       = logger.log;
const constants = require('./constants');

const schema   = require('./schema');
const validate = require('./validate');

let clientConsume = 'root';

/**
 * Indexof
 * @param {Array} array
 * @param {*} value
 * @returns {Int} index of the value
 */
function indexOf (array, value) {
  let i   = 0;
  let len = array.length;
  while (i < len) {
    if (array[i] === value) {
      return i;
    }

    i++;
  }

  return -1;
}

/**
 * Queue tree
 *
 * If a client defines multiple listeners, only one will be called
 *
 * Structure:
 *
 * For one endpoint/version
 * {
 *   clientNodes : [{
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
 *   }]
 * }
 * @returns {Object}
 */
function queueTree (queueId) {
  let _tree = {
    // Indexes
    ids     : {}, // { id : { client : { nodes : [], lastNode } } }
    clients : {}  // { client1 : [id, id_N] }
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
    let clientIds = _tree.clients[client];

    if (!clientIds) {
      return;
    }

    for (var i = clientIds.length -1; i >= 0; i--) {
      let clientId = clientIds[i];
      if (id) {
        if (clientId != id) {
          continue;
        }
      }

      let idTree = _tree.ids[clientId];
      if (!idTree[client]) {
        continue;
      }

      let nodes     = idTree[client].nodes;
      let indexNode = indexOf(nodes, node);

      if (indexNode === -1) {
        continue;
      }

      nodes.splice(indexNode, 1);

      if (!nodes.length) {
        delete idTree[client];
        clientIds.splice(i, 1);
      }

      log(logger.LEVELS.DEBUG, logger.NAMESPACES.QUEUE, 'queue=' + queueId + ';from=' + node + ';unsubscribed from id=' + (id || clientId));

      if (id && clientId == id) {
        break;
      }
    }

    if (!clientIds.length) {
      delete _tree.clients[client];
    }
  };

  /**
   * Add a client to the tree
   * @param {String} client
   * @param {String} node
   * @param {Int} type
   * @param {Array} ids
   */
  _tree.addClient = function (client, node, type, ids) {
    node = client + '#' + node;
    if (type === constants.LISTENER_TYPES.CONSUME) {
      client = clientConsume;
    };

    let _ids = ids;

    if (!Array.isArray(_ids)) {
      _ids = [_ids];
    }

    for (var i = 0; i < _ids.length; i++) {
      let id     = _ids[i];
      let idTree = _tree.ids[id];

      if (!idTree) {
        _tree.ids[id] = {};
        idTree        = _tree.ids[id];
      }

      if (!_tree.clients[client]) {
        _tree.clients[client] = [];
      }

      if (indexOf(_tree.clients[client], id) === -1) {
        _tree.clients[client].push(id);
      }

      if (!idTree[client]) {
        idTree[client] = {
          nodes    : [],
          lastNode : -1
        };
      }

      if (indexOf(idTree[client].nodes, node) === -1) {
        idTree[client].nodes.push(node);
        log(logger.LEVELS.DEBUG, logger.NAMESPACES.QUEUE, 'queue=' + id + ';node=' + node + ';subscribed to id=' + id);
      }
    }
  }

  /**
   * Get client for an id
   * @param {*} id
   * @returns {Array} clients
   */
  _tree.getClientsForId = function (id) {
    let clients = [];
    let idTree  = _tree.ids[id];

    if (!idTree) {
      return clients;
    }

    for (let client in idTree) {
      let clientNodes = idTree[client];

      clientNodes.lastNode++;

      if (clientNodes.lastNode >= clientNodes.nodes.length) {
        clientNodes.lastNode = 0;
      }

      if (!clientNodes.nodes.length) {
        continue;
      }

      clients.push(clientNodes.nodes[clientNodes.lastNode]);
    }

    return clients;
  }

  return _tree;
}

/**
 * Queue
 * @param {Function} handlerForQueue
 */
function queue (id, handlerForQueue, config, map = {}) {
  let _queue =  {
    queue              : [],
    nbMessagesReceived : 0,
    queueSecondary     : { _nbMessages : 0, _nbMessagesReceived : 0, _nbMessagesDropped : 0 }, // queue of unsent messages because of no clients
    currentItem        : null,
    lastItem           : null,
    lastItemSecondary  : null,
    nbAcks             : 0,
    nbExpectedAcks     : 0,
    tree               : queueTree(id)
  };

  let _acks            = {};
  let _validate        = null;
  let _acksComputation = null;
  reload(map);

  function _enableAcksComputation () {
    if (_acksComputation) {
      return;
    }

    _acksComputation = setInterval(_onTimeout, 1000);
  }
  function _disableAcksComputation () {
    if (!_acksComputation) {
      return;
    }

    clearInterval(_acksComputation);
    _acksComputation = null;
  }

  /**
   * Process item in the queue
   */
  function _processItemInQueue () {
    _queue.currentItem = _queue.queue.shift();
    _enableAcksComputation();

    if (!_queue.currentItem) {
      _disableAcksComputation()
      return;
    }

    let _clientsToSend = _getClientsToSend(_queue.currentItem[0]);

    if (!_clientsToSend.length) {
      if (_queue.queueSecondary._nbMessages >= config.maxItemsInQueue) {
        log(logger.LEVELS.WARN, logger.NAMESPACES.QUEUE, 'queue=' + id + ';seconday queue is full, dropping items');
        _queue.queueSecondary._nbMessagesDropped++;
        return _processItemInQueue();
      }
      if (_queue.queueSecondary._nbMessages >= (config.maxItemsInQueue / 2)) {
        log(logger.LEVELS.WARN, logger.NAMESPACES.QUEUE, 'queue=' + id + ';seconday queue is full at 50%');
      }

      if (!_queue.queueSecondary[_queue.currentItem[0]]) {
        _queue.queueSecondary[_queue.currentItem[0]] = [];
      }
      _queue.queueSecondary._nbMessagesReceived++;
      _queue.queueSecondary[_queue.currentItem[0]].push(_queue.currentItem);
      _queue.queueSecondary._nbMessages++;
      _queue.lastItemSecondary = _queue.currentItem;
      return _processItemInQueue();
    }

    _queue.nbAcks         = 0;
    _queue.nbExpectedAcks = _clientsToSend.length;

    _queue.lastItem = _queue.currentItem;

    handlerForQueue(
      _acks,
      _clientsToSend,        // clients
      _queue.currentItem[1], // data
      _queue.currentItem[2]  // headers
    );
  }

  /**
   * Process one id of the secondary queue
   * @param {String} id
   */
  function _processQueueSecondaryId (id) {
    let _queueMessages = _queue.queueSecondary[id];
    if (!_queueMessages) {
      return;
    }

    let length = _queueMessages.length;
    for (var i = 0; i < length; i++) {
      _queue.queue.push(_queueMessages.shift());
    }

    _queue.queueSecondary._nbMessages -= length;
  }

  /**
   * Process secondary queue when a client is lsitening or consuming
   * @param {String} id
   */
  function _processQueueSecondary (id) {
    if (id !== '*') {
      _processQueueSecondaryId(id);
    }
    else {
      for (let id in _queue.queueSecondary) {
        if (id === '*' || id === '_nbMessages' || id === '_nbMessagesReceived' || id === '_nbMessagesDropped') {
          continue;
        }

        _processQueueSecondaryId(id);
      }
    }

    if (!_queue.currentItem || !_queue.queue.length) {
      _processItemInQueue();
    }
  }

  /**
   * Get clients to send item
   * @param {Int} id
   * @returns {Array}
   */
  function _getClientsToSend (id) {
    let _clients = [];

    if (id !== '*') {
      _clients = _clients.concat(_queue.tree.getClientsForId(id));
      _clients = _clients.concat(_queue.tree.getClientsForId('*'));
      return _clients;
    }

    for (let id in _queue.tree.ids) {
      _clients = _clients.concat(_queue.tree.getClientsForId(id));
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
    var _isPacketHasTime = false;

    for (let ackKey in _acks) {
      if ((_acks[ackKey].created + (config.requeueInterval * 1000)) <= Date.now()) {
        log(logger.LEVELS.DEBUG, logger.NAMESPACES.QUEUE, 'queue=' + id + ';resend packet messageId=' + _acks[ackKey].messageId);
        _resend(ackKey);
      }
      else {
        _isPacketHasTime = true;
      }
    }

    // Process next item
    if (!_isPacketHasTime) {
      _processItemInQueue();
    }
  }

  /**
   * Add a client in the tree
   * clientId : client#node
   * @param {Array/Int} ids
   * @param {String} client
   * @param {Stirng} node
   * @param {Int} type LISTEN / CONSUME
   */
  _queue.addClient = function addClient (ids, client, node, type) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    let _tree = _queue.tree;

    for (var i = 0; i < ids.length; i++) {
      let _id  = ids[i] + '';

      _tree.addClient(client, node, type, _id);

      if (_queue.queueSecondary._nbMessages && (_queue.queueSecondary[_id] || _id === '*')) {
        _processQueueSecondary(_id);
      }
    }
  };

  /**
   * Add an item in the queue
   * @param {*} id
   * @param {*} item data to send
   */
  _queue.addInQueue = function (id, item) {
    let _resValidation = _validate(item.data);
    if (_resValidation.length) {
      return _resValidation;
    }

    _queue.queue.push([id, item]);
    _queue.nbMessagesReceived++;

    if (_queue.queue.length > 1 || _queue.currentItem) {
      return false;
    }

    _processItemInQueue();
    return false;
  };

  /**
   * Confirm current item
   */
  _queue.ack = function ack (acknowledge) {
    delete _acks[acknowledge];
    _queue.nbAcks++;

    if (_queue.nbAcks === _queue.nbExpectedAcks) {
      _processItemInQueue();
    }
  };

  /**
   * Requeue current item
   */
  _queue.nack = function nack (acknowledge) {
    _resend(acknowledge);
  };

  /**
   * Reload configuration
   * Re-evaluate map and valdiate function
   */
  function reload (map = {}) {
    let _schema = schema.analyzeDescriptor(map);
    _validate   = validate.buildValidateFunction(_schema.compilation);
  };

  _queue.reload = reload;

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
