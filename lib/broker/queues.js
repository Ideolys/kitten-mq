function queues () {
  let _queues = {};

  return {
    create : function (queue) {
      if (this.hash(queue)) {
        return;
      }

      _queues[queue] = {
        clients       : [],
        packets       : [],
        currentPacket : null
      }
    },

    hash : function (queue) {
      return _queues[queue];
    }
  }
}

module.exports = queues;
