const package = require('../../package.json');

const AGGREGATORS = {
  COUNT : {
    init : {
      start : 0
    },
    add : function (prevState) {
      if (!prevState) {
        prevState = { value : this.init.start };
      }
      if (prevState.value > Number.MAX_SAFE_INTEGER) {
        prevState = { value : this.init.start };
      }

      return { value : prevState.value + 1 };
    },
    getStartValue : function () {
      return { value : this.init.start };
    }
  },

  SUM : {
    init : {
      start : 0
    },
    add : function (prevState, value) {
      if (!prevState) {
        prevState = { value : this.init.start };
      }
      if (prevState.value > Number.MAX_SAFE_INTEGER) {
        prevState = { value : this.init.start };
      }
      return { value : prevState.value + (value || this.init.start) };
    },
    getStartValue : function () {
      return { value : this.init.start };
    }
  },

  AVG : {
    init : {
      start : 0,
      count : 0
    },
    add : function (prevState, value) {
      if (!prevState) {
        prevState = {
          value : this.init.start,
          count : this.init.count
        };
      }

      if (prevState.value > Number.MAX_SAFE_INTEGER || prevState.count > Number.MAX_SAFE_INTEGER) {
        prevState = {
          value : this.init.start,
          count : this.init.count
        };
      }

      if (!value) {
        value = 0;
      }

      prevState.count++;
      prevState.value += (value - prevState.value) / prevState.count;
      return prevState;
    },

    getStartValue : function () {
      return { value : this.init.start, count : this.init.count };
    }
  }
};

let COUNTERS = {
  UPTIME : {
    label       : 'kitten_mq_info_uptime',
    description : { version : package.version },
    value () {
      return process.uptime();
    }
  },

  MESSAGES_COUNT : {
    label       : 'kitten_mq_messages_sent_count',
    description : null,
    agg         : 'COUNT',
    aggValue    : AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  },
  MESSAGES_COUNT_SEC : {
    label       : 'kitten_mq_messages_sent_per_seconds_average',
    description : null,
    agg         : 'AVG',
    aggValue    : AGGREGATORS.AVG.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  },

  MESSAGES_RECEIVED_COUNT : {
    label       : 'kitten_mq_messages_received_count',
    description : null,
    agg         : 'COUNT',
    aggValue    : AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  },
  MESSAGES_RECEIVED_COUNT_SEC : {
    label       : 'kitten_mq_messages_received_per_seconds_average',
    description : null,
    agg         : 'AVG',
    aggValue    : AGGREGATORS.AVG.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  },

  MESSAGES_ACK_COUNT : {
    label       : 'kitten_mq_messages_acked_count',
    description : null,
    agg         : 'COUNT',
    aggValue    : AGGREGATORS.COUNT.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  },
  MESSAGES_ACK_COUNT_SEC : {
    label       : 'kitten_mq_messages_acked_per_seconds_average',
    description : null,
    agg         : 'AVG',
    aggValue    : AGGREGATORS.AVG.getStartValue(),
    value () {
      return this.aggValue.value;
    }
  }
};

setInterval(() => {
  COUNTERS.MESSAGES_COUNT_SEC.aggValue          = AGGREGATORS.AVG.getStartValue();
  COUNTERS.MESSAGES_RECEIVED_COUNT_SEC.aggValue = AGGREGATORS.AVG.getStartValue();
  COUNTERS.MESSAGES_ACK_COUNT_SEC.aggValue      = AGGREGATORS.AVG.getStartValue();
}, 1000);

module.exports = {
  COUNTERS,
  AGGREGATORS,

  COUNTER_NAMESPACES : {
    MESSAGES_COUNT              : 'MESSAGES_COUNT',
    MESSAGES_COUNT_SEC          : 'MESSAGES_COUNT_SEC',
    MESSAGES_RECEIVED_COUNT     : 'MESSAGES_RECEIVED_COUNT',
    MESSAGES_RECEIVED_COUNT_SEC : 'MESSAGES_RECEIVED_COUNT_SEC',
    MESSAGES_ACK_COUNT          : 'MESSAGES_ACK_COUNT',
    MESSAGES_ACK_COUNT_SEC      : 'MESSAGES_ACK_COUNT_SEC',
  },

  register (counter) {
    COUNTERS[counter.label] = counter;
  },

  /**
   * Update counter
   * @param {Object} object.counterId
   * @param {Object} object.subCounterId
   * @param {Object} object.value
   */
  update ({ counterId, subCounterId, value }) {
    let counter = COUNTERS[counterId];

    if (!counter) {
      return;
    }

    if (subCounterId && counter.counters) {
      counter = counter.counters[subCounterId];
    }

    if (!counter) {
      return;
    }

    counter.aggValue = AGGREGATORS[counter.agg].add(counter.aggValue, value);
  },

  /**
   * Get counter values
   * @returns {Array} [{ label : String, description : Object, value : * }]
   */
  getAll () {
    let res = [];

    for (const counterKey in COUNTERS) {
      let counter = COUNTERS[counterKey];

      if (counter.counters) {
        for (const subCounterKey in counter.counters) {
          let subCounter = counter.counters[subCounterKey];

          let description = { ...counter.description, ...subCounter.description};

          res.push({
            description,
            label       : counter.label,
            value       : subCounter.value()
          });
        }

        continue;
      }

      res.push({
        label       : counter.label,
        description : counter.description,
        value       : counter.value()
      });
    }

    return res;
  }

};
