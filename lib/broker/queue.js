const logger    = require('./logger');
const log       = logger.log;
const constants = require('./constants');

const schema   = require('./schema');
const validate = require('./validate');
const stats    = require('./stats');

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
 * @param {String} id of the queue
 * @param {Function} handlerForQueue
 * @param {Object} config of the broker
 * @param {Object} configQueue config of the queue { map : {}, prefetch, ... }
 */
function queue (id, handlerForQueue, config, configQueue = {}) {
  let _queue =  {
    queue              : [],
    nbMessagesReceived : 0,
    queueSecondary     : { _nbMessages : 0, _nbMessagesReceived : 0, _nbMessagesDropped : 0 }, // queue of unsent messages because of no clients
    currentItem        : null,
    lastItem           : null,
    lastItemSecondary  : null,
    tree               : queueTree(id)
  };

  let _acks            = {};
  let _validate        = null;
  let _acksComputation = null;
  _queue._acks         = _acks;

  stats.register({
    label       : 'kitten_mq_queue_messages_count',
    description : { queue : id, type : 'main' },
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.SUM.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });
  stats.register({
    label       : 'kitten_mq_queue_messages_dropped_count',
    description : { queue : id, type : 'secondary'},
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.SUM.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });
  stats.register({
    label       : 'kitten_mq_queue_messages_timeout_count',
    description : { queue : id, type : 'secondary'},
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.SUM.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });

  reload(configQueue);

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

  function _isPrefetchLimitReached () {
    return Object.keys(_acks).length >= (configQueue.prefetch || 1);
  }

  /**
   * Process item in the queue
   */
  function _processItemInQueue () {
    if (_isPrefetchLimitReached()) {
      return;
    }

    _queue.currentItem = _queue.queue.shift();
    _enableAcksComputation();

    if (!_queue.currentItem) {
      _disableAcksComputation();
      return;
    }

    let _clientsToSend = _getClientsToSend(_queue.currentItem[0]);

    stats.update({
      counterId : 'kitten_mq_queue_messages_count',
      value     : 1
    });

    if (!_clientsToSend.length) {
      _queue.queueSecondary._nbMessagesReceived++;
      if (_queue.queueSecondary._nbMessages >= config.maxItemsInQueue) {
        log(logger.LEVELS.WARN, logger.NAMESPACES.QUEUE, 'queue=' + id + ';secondary queue is full, dropping new item: ' + JSON.stringify(_queue.currentItem));
        _queue.queueSecondary._nbMessagesDropped++;

        stats.update({
          counterId : 'kitten_mq_queue_messages_dropped_count',
          value     : 1
        });

        return _processItemInQueue();
      }
      if (_queue.queueSecondary._nbMessages >= (config.maxItemsInQueue / 2)) {
        log(logger.LEVELS.WARN, logger.NAMESPACES.QUEUE, 'queue=' + id + ';secondary queue is full at 50%');
      }

      if (!_queue.queueSecondary[_queue.currentItem[0]]) {
        _queue.queueSecondary[_queue.currentItem[0]] = [];
      }
      _queue.queueSecondary[_queue.currentItem[0]].push(_queue.currentItem);
      _queue.queueSecondary._nbMessages++;

      _queue.lastItemSecondary = _queue.currentItem;
      return _processItemInQueue();
    }

    _queue.lastItem = _queue.currentItem;

    handlerForQueue(
      _acks,
      _clientsToSend,        // clients
      _queue.currentItem[1], // data
      _queue.currentItem[2]  // headers
    );

    _processItemInQueue();
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
    let _headers = _acks[ackKey];

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
    let _isPacketHasTime = false;

    for (let ackKey in _acks) {
      if ((_acks[ackKey].created + (config.requeueInterval * 1000)) <= Date.now()) {
        log(logger.LEVELS.DEBUG, logger.NAMESPACES.QUEUE, 'queue=' + id + ';resend packet messageId=' + _acks[ackKey].messageId);
        stats.update({
          counterId : 'kitten_mq_queue_messages_timeout_count',
          value     : 1
        });
        _resend(ackKey);
      }
      else {
        _isPacketHasTime = true;
      }
    }

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
    if (item.data == null) {
      return [{ error : 'No value' }];
    }

    let _resValidation = _validate(item.data);
    if (_resValidation.length) {
      return _resValidation;
    }

    _queue.queue.push([id, item]);
    _queue.nbMessagesReceived++;


    stats.update({
      counterId : stats.COUNTER_NAMESPACES.MESSAGES_RECEIVED_COUNT,
      value     : 1
    });
    stats.update({
      counterId : stats.COUNTER_NAMESPACES.MESSAGES_RECEIVED_COUNT_SEC,
      value     : 1
    });

    _processItemInQueue();
    return false;
  };

  /**
   * Confirm current item
   * @param {String} acknowledge (id for the ack)
   */
  _queue.ack = function ack (acknowledge) {
    if (!_acks[acknowledge]) {
      return;
    }

    if (_acks[acknowledge]) {
      delete _acks[acknowledge];
    }

    _processItemInQueue();
  };

  /**
   * Requeue current item
   */
  _queue.nack = function nack (acknowledge) {
    _resend(acknowledge);
    _queue.ack(acknowledge);
  };

  /**
   * Reload configuration
   * Re-evaluate map and valdiate function
   */
  function reload (newConfig = {}) {
    configQueue = newConfig;
    let _schema = schema.analyzeDescriptor(configQueue.map);
    _validate   = validate.buildValidateFunction(_schema.compilation);
  };

  _queue.reload = reload;

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
