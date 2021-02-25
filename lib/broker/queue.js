const logger    = require('./logger');
const log       = logger.log;
const constants = require('./constants');
const utils     = require('../utils');

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
    queueRequeue       : [],
    nbMessagesReceived : 0,
    queueSecondary     : { _nbMessages : 0, _nbMessagesReceived : 0, _nbMessagesDropped : 0 }, // queue of unsent messages because of no clients
    currentItem        : null,
    lastItem           : null,
    lastItemSecondary  : null,
    tree               : queueTree(id)
  };

  let _acks            = {};
  let _validate        = null;
  let _time = null;
  _queue._acks         = _acks;

  stats.register('kitten_mq_queue_messages_count' + id, {
    label       : 'kitten_mq_queue_messages_count',
    description : { queue : id, type : 'main' },
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });
  stats.register('kitten_mq_queue_messages_dropped_count' + id, {
    label       : 'kitten_mq_queue_messages_dropped_count',
    description : { queue : id, type : 'secondary'},
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });
  stats.register('kitten_mq_queue_messages_timeout_count' + id, {
    label       : 'kitten_mq_queue_messages_timeout_count',
    description : { queue : id, type : 'secondary'},
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });
  stats.register('kitten_mq_queue_messages_dead_count' + id, {
    label       : 'kitten_mq_queue_messages_dead_count',
    description : { queue : id, type : '*'},
    agg         : 'COUNT',
    aggValue    : stats.AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  });

  reload(configQueue);

  /**
   * Enable timer (execution each 1s)
   *   look at messages in timeout
   *   requeue messages with delay
   */
  function _enableTimer () {
    if (_time) {
      return;
    }

    _time = setInterval(() => {
      _onTimeout();
      _requeuePackets();
      _processItemInQueue();

      if (configQueue.ttl) {
        _processTTLSecondary();
      }
    }, 1000);
  }

  /**
   * Is limit of unacknowledged messages reached ?
   * @returns {Boolean}
   */
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
    _enableTimer();

    if (!_queue.currentItem) {
      return;
    }

    let _clientsToSend = _getClientsToSend(_queue.currentItem[0]);

    stats.update({
      counterId : 'kitten_mq_queue_messages_count' + id,
      value     : 1
    });

    if (!_clientsToSend.length) {
      _queue.queueSecondary._nbMessagesReceived++;

      if (!_queue.queueSecondary[_queue.currentItem[0]]) {
        _queue.queueSecondary[_queue.currentItem[0]] = [];
      }

      if (_queue.queueSecondary._nbMessages >= config.maxItemsInQueue) {
        let removedItem = _queue.queueSecondary[_queue.currentItem[0]][0];

        _queue.queueSecondary[_queue.currentItem[0]].shift();

        log(logger.LEVELS.WARN, logger.NAMESPACES.QUEUE, 'queue=' + id + ';secondary queue is full, dropping head: ' + JSON.stringify(removedItem));
        _queue.queueSecondary._nbMessagesDropped++;
        _queue.queueSecondary._nbMessages--;

        stats.update({
          counterId : 'kitten_mq_queue_messages_dropped_count' + id,
          value     : 1
        });
      }

      _queue.queueSecondary[_queue.currentItem[0]].push(_queue.currentItem);
      _queue.queueSecondary._nbMessages++;

      _queue.lastItemSecondary = _queue.currentItem;
      return _processItemInQueue();
    }

    _queue.lastItem = _queue.currentItem;

    let headers = _queue.currentItem[2];
    _acks[headers.messageId] = { message : _queue.currentItem };

    handlerForQueue(
      _acks,
      _clientsToSend,        // clients
      _queue.currentItem[1], // data
      headers
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
   * @param {Int} time
   */
  function _resend (ackKey, time) {
    let _ack = _acks[ackKey];

    if (!_ack) {
      return;
    }

    let _headers = _ack.headers;

    if (!_headers) {
      return;
    }

    if (_headers.nbRequeues === undefined) {
      _headers.nbRequeues = 0;
    }

    _headers.nbRequeues++;

    if (_headers.nbRequeues < config.requeueLimit) {
      let item = [_ack.message[0], _ack.message[1], _headers];

      if (time) {
        return _queue.queueRequeue.push([Date.now() + (time * 1000), item]);
      }

      _queue.queue.push(item);
    }

    delete _acks[ackKey];
  }

  /**
   * On timeout requeue unacked messages
   */
  function _onTimeout () {
    for (let ackKey in _acks) {
      if (_acks[ackKey].headers && (_acks[ackKey].headers.created + (config.requeueInterval * 1000)) <= Date.now()) {
        log(logger.LEVELS.DEBUG, logger.NAMESPACES.QUEUE, 'queue=' + id + ';resend packet messageId=' + ackKey);
        stats.update({
          counterId : 'kitten_mq_queue_messages_timeout_count' + id,
          value     : 1
        });
        _resend(ackKey);
      }
    }
  }

  /**
   * Requeue messages that have a delay
   */
  function _requeuePackets () {
    let len = _queue.queueRequeue.length;
    if (!len) {
      return;
    }

    let intermediateQueue = [];

    for (let i = len - 1; i >= 0; i--) {
      // [0] time set before to requeue
      // [1] item to push in default queue
      if (_queue.queueRequeue[i][0] <= Date.now()) {
        intermediateQueue.push(_queue.queueRequeue[i][1]);
        _queue.queueRequeue.splice(i, 1);
      }
    }

    intermediateQueue.reverse();
    intermediateQueue.forEach(i => _queue.queue.push(i));
  }

  function _isMessageExpired (message) {
    return message[3]+ (configQueue.ttl * 1000) <= Date.now();
  }

  /**
   * Remove expired messages in secondary queue
   */
  function _processTTLSecondary () {
    for (let id in _queue.queueSecondary) {
      let _secondaryQueue = _queue.queueSecondary[id];
      let len             = _secondaryQueue.length;

      for (let i = len - 1; i >= 0; i--) {
        // [0] time set before to requeue
        // [1] item to push in default queue
        if (_isMessageExpired(_secondaryQueue[i])) {
          _secondaryQueue.splice(i, 1);
          stats.update({
            counterId : 'kitten_mq_queue_messages_dead_count' + id,
            value     : 1
          });
          stats.update({
            counterId : 'kitten_mq_queue_messages_dropped_count' + id,
            value     : 1
          });
          _queue.queueSecondary._nbMessagesDropped++;
        }
      }
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
   * @param {String} messageId (given by client & share by brokers)
   */
  _queue.addInQueue = function (id, item, messageId) {
    if (item.data == null) {
      return [{ error : 'No value' }];
    }

    let _resValidation = _validate(item.data);
    if (_resValidation.length) {
      return _resValidation;
    }

    _queue.queue.push([id, item, { messageId }, Date.now()]);
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
   * @param {String} acknowledge
   * @param {int} time in seconds before requeuing the message
   */
  _queue.nack = function nack (acknowledge, time = 0) {
    _resend(acknowledge, time);
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

  /**
   * Get statistics of queue
   */
  _queue.getStatistics = function getStatistics () {
    return {
      total   : stats.COUNTERS['kitten_mq_queue_messages_count'  + id].value(),
      dropped : stats.COUNTERS['kitten_mq_queue_messages_dropped_count'  + id].value(),
      timeout : stats.COUNTERS['kitten_mq_queue_messages_timeout_count'  + id].value(),
      dead    : stats.COUNTERS['kitten_mq_queue_messages_dead_count'  + id].value(),
    }
  }

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
