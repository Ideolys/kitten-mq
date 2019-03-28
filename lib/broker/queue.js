const constants = require('./constants');

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
    clientNodes : null,
    subTrees    : {}
  };


  /**
   * Has node in the tree
   * @param {String} node
   */
  _tree.has = function has (node) {
    return _tree[subTrees[node]];
  };

  /**
   * Add a node in the tree
   * @param {String} node
   */
  _tree.addNode = function addNode (node) {
    _tree.subTrees[node] = queueTree();
  };

  /**
   * Add a client in the tree
   * clientId : client#node
   * @param {String} client
   * @param {Stirng} node
   * @param {Int} type LISTEN / CONSUME
   */
  _tree.addClient = function addClient (client, node, type) {
    node = client + '#' + node;
    if (type === constants.LISTENER_TYPES.CONSUME) {
      client = clientConsume;
    }

    if (!_tree.clientNodes) {
      _tree.clientNodes = {};
    }

    if (!_tree.clientNodes[client]) {
      _tree.clientNodes[client] = {
        nodes    : [],
        lastNode : -1
      };
    }

    if (_tree.clientNodes[client].nodes.indexOf(node) === -1) {
      _tree.clientNodes[client].nodes.push(node);
    }
  };

  /**
   * Remove a client from the tree
   * @param {String} client
   * @param {String} node
   * @param {Int} type
   */
  _tree.removeClient = function removeClient (client, node, type) {
    node = client + '@' + node;
    if (type === constants.LISTENER_TYPES.CONSUME) {
      client = clientConsume;
    }

    if (!_tree.clientNodes) {
      return;
    }

    if (!_tree.clientNodes[client]) {
      return;
    }

    let _index = _tree.clientNodes[client].nodes.indexOf(node);

    if (_index !== -1) {
      _tree.clientNodes[client].nodes.splice(_index, 1);
    }

    if (_tree.clientNodes[client].lastNode === _index && _tree.clientNodes[client].lastNode !== -1) {
      _tree.clientNodes[client].lastNode--;
    }
  };

  return _tree;
}

/**
 * Queue
 * @param {Function} handlerForQueue
 */
function queue (handlerForQueue, requeueLimit, requeueInterval) {
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

    _queue.nbAcks         = 0;
    _queue.nbExpectedAcks = _queue.currentItem[0].length;

    handlerForQueue(
      _acks,
      _queue.currentItem[0], // clients
      _queue.currentItem[1], // data
      _queue.currentItem[2]  // headers
    );
    setTimeout(_onTimeout, requeueInterval * 1000);
  }

  /**
   * Get clients to send item
   * @param {Object} tree
   * @returns {Array}
   */
  function _getClientsToSend (tree, isChildren = false, level = 0) {
    let _clients = [];

    if (!isChildren || (isChildren && level)) {
      for (let client in tree.clientNodes) {
        let _clientNodes = tree.clientNodes[client];


        _clientNodes.lastNode++;

        if (_clientNodes.lastNode >= _clientNodes.nodes.length) {
          _clientNodes.lastNode = 0;
        }

        _clients.push(_clientNodes.nodes[_clientNodes.lastNode]);
      }
    }

    if (isChildren) {
      for (let subTree in tree.subTrees) {
        let _clientsSubTree = _getClientsToSend(tree.subTrees[subTree], isChildren, level + 1);

        _clients = _clients.concat(_clientsSubTree);
      }
    }

    return _clients;
  }

  /**
   * Resend an item
   * @param {String} ackKey
   */
  function _resend (ackKey) {
    let _ackParts = ackKey.split('|');
    let _headers  = _acks[ackKey];

    if (_headers.nbRequeues === undefined) {
      _headers.nbRequeues = 0;
    }

    _headers.nbRequeues++;

    if (_headers.nbRequeues < requeueLimit) {
      _queue.queue.push([[_ackParts[0]], _queue.currentItem[1], _headers]);
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
   * @param {*} item data to send
   * @param {Object} tree queue tree
   */
  _queue.addInQueue = function (item, tree, tempQueue, isChildren = false) {
    let _clientsToSend = _getClientsToSend(tree, isChildren);

    if (!tempQueue) {
      return tempQueue = [_clientsToSend, item];
    }

    tempQueue[0] = tempQueue[0].concat(_clientsToSend);

    return tempQueue;
  };

  /**
   * Add an item in the queue with its children
   * @param {*} item data to send
   * @param {Object} tree queue tree
   */
  _queue.addChildrenInQueue = function (item, tree, tempQueue) {
    return _queue.addInQueue(item, tree, tempQueue, true);
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

  /**
   * Commit queue changes by adding temp queue in queue
   */
  _queue.commit = function commit (tempQueue) {
    _queue.queue.push(tempQueue);

    if (_queue.queue.length > 1 || _queue.currentItem) {
      return;
    }

    _processItemInQueue();
  };

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
