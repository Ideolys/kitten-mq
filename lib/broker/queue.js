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

  let _acks      = {};
  let _tempQueue = null;

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

    handlerForQueue(_acks, _queue.currentItem[0], _queue.currentItem[1]);
    // setTimeout(_onTimeout, requeueInterval * 100);
  }

  /**
   * Get clients to send item
   * @param {Object} tree
   * @returns {Array}
   */
  function _getClientsToSend (tree, isChildren = false) {
    let _clients = [];

    for (let client in tree.clientNodes) {
      let _clientNodes = tree.clientNodes[client];


      _clientNodes.lastNode++;

      if (_clientNodes.lastNode >= _clientNodes.nodes.length) {
        _clientNodes.lastNode = 0;
      }

      _clients.push(_clientNodes.nodes[_clientNodes.lastNode]);
    }

    if (isChildren) {
      for (let subTree in tree.subTrees) {
        let _clientsSubTree = _getClientsToSend(tree.subTrees[subTree], true);

        _clients = _clients.concat(_clientsSubTree);
      }
    }

    return _clients;
  }

  function _onTimeout () {

  }

  /**
   * Add an item in the queue
   * @param {*} item data to send
   * @param {Object} tree queue tree
   */
  _queue.addInQueue = function (item, tree, isChildren = false) {
    let _clientsToSend = _getClientsToSend(tree, isChildren);

    if (!_tempQueue) {
      return _tempQueue = [_clientsToSend, item];
    }

    _tempQueue[0] = _tempQueue[0].concat(_clientsToSend);
  };

  /**
   * Add an item in the queue with its children
   * @param {*} item data to send
   * @param {Object} tree queue tree
   */
  _queue.addInQueueWithChildren = function (item, tree) {
    _queue.addInQueue(item, tree, true);
  };

  /**
   * Confirm current item
   */
  _queue.ack = function ack (acknowledge) {
    _queue.nbAcks++;

    delete[acknowledge];

    if (_queue.nbAcks === _queue.nbExpectedAcks) {
      _processItemInQueue();
    }
  }

  _queue.commit = function commit () {
    _queue.queue.push(_tempQueue);

    _tempQueue = null;

    if (_queue.queue.length > 1 || _queue.currentItem) {
      return;
    }

    _processItemInQueue();
  }

  return _queue;
}

exports.queueTree = queueTree;
exports.queue     = queue;
