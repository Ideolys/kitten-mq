# Kitten mq

### v0.6.0
  - Enhance logs:
    - Improve log cover
    - Add a config key for master `logLevel = Int` to control lovel of logs among:
      + `1 -> Debug`
      + `2 -> Info`
      + `3 -> Warn`
      + `4 -> Error`
  - Improve requeue feature after packet's timeout. A `setInterval` is used to check every second (not configurable) the acknowledges.
  - Fix client diconnection : when a client had multiple nodes, the disconnection of one node was unsubscribing all the nodes.

### V0.5.1
  - Fix binary. exec() wast not loaded.

### v0.5.0
  - The callback of kittenMQ.client().connect(config, callback) is called only once now. Before, it was called after each reconnection.

### v0.4.0
  - Update kitten-jwt version (from 0.3.9 to 1.0.0)
