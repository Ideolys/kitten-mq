const constants = require('./constants');

let clientConsume = 'root';

let tree = JSON.stringify({
  clientNodes : null,
  queue       : [],
  currentItem : null,
  subTrees    : {}
});

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
 * @param {Function} handlerForQueue
 * @returns {Object}
 */
function queueTree (handlerForQueue) {
  let _tree = JSON.parse(tree);

  function _processItemInQueue () {
    _tree.currentItem = _tree.queue.shift();

    if (!_tree.currentItem) {
      return;
    }

    let _clients = [];
    for (let client in _tree.clientNodes) {
      let _clientNodes = _tree.clientNodes[client];

      _clientNodes.lastNode++;

      if (_clientNodes.lastNode >= _clientNodes.nodes.length) {
        _clientNodes.lastNode = 0;
      }


      _clients.push(_clientNodes.nodes[_clientNodes.lastNode]);
    }

    handlerForQueue(_clients, _tree.currentItem);
  }

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
    _tree.subTrees[node] = queueTree(handlerForQueue);
    return _tree.subTrees[node];
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
   * Add item in the queue
   * @param {Object} item
   */
  _tree.addInQueue = function addInQueue (item) {
    _tree.queue.push(item);

    if (_tree.queue.length > 1) {
      return;
    }

    _processItemInQueue();
  },

  /**
   * Confirm current item
   */
  _tree.confirmCurrentItem = function confirmCurrentItem () {
    _processItemInQueue();
  }

  return _tree;
}

module.exports = queueTree;
