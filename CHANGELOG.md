# Kitten mq

### v0.10.3
*2021-01-29*
  - Verify channel argument of methods `client.consume` and `client.listen`.
  - Fix old client acking.

### v0.10.2
*2021-01-20*
  - Remove chars from statistics (`GET /statistics`) in order to be compliant with promotheus.

### v0.10.1
*2021-01-18*
  - Brokers share the same message ids.

### v0.10.0
*2021-01-15*
  - Add command `soft-stop` to gracefully shutdown the broker.

### v0.9.0
*2021-01-14*
  - Add option `prefetch` for channels (broker configuration), default is `1`. It determines the number of unacknowledged messages.
  - Add option `ttl` for channels (broker configuration), add a time to live for messages in queue.
  - Breaking change: if the secondary queue is full, messages are removed from the head instead of the end.
  - Add optional parameter `delay` for `ack` method of a consummer: `ack(false, delay)`.
  - Improve UI:
    + Add stats per queue
    + Add config display
    + Add first 10 items display
    + Add broker's uptime
  - Fix, Statistics "per_seconds" were not correct.
  - Fix, Stats were only availbale for one queue.
  - Fix, reload command was not doing anything.

### v0.8.5
*2020-12-09*
 - Channel validation was not correct.

### v0.8.4
*2020-12-07*
  - Properly exit after command reload.
  - Fix statistics output.

### v0.8.0
*2020-12-07*
  - Add open metrics statistics.

### v0.7.1
  - Add explicit log when not allowing handler registration for exclusive routes already registered.
  - Show dropped items in logs when dropping items in secondary queue.

### v0.7.0
  - Add HTTP route `GET /statistics` for Netdata.
  - Refacto queue tree in order to improve performance and simplify code.
  - Fix a disconnection bug. Disconnected nodes were always in the queue tree.
  - Fix timeout item the queue.

### v0.6.3
  - Add setTimeout to reload the page at specified interval in configuration `pollIntervalHTTP` (in ms). Default value is 5 seconds.
  - Add overflow for last item in queue (UI);

### v0.6.2
  - Add a margin between each queue (UI).
  - Add an overflow for client lists (UI).

### v0.6.1
  - Fix JSON data for UI.

### v0.6.0
  - Enhance logs:
    - Improve log cover
    - Add a config key for master `logLevel = Int` to control lovel of logs among:
      + `1 -> Debug`
      + `2 -> Info`
      + `3 -> Warn`
      + `4 -> Error`
  - Improve requeue feature after packet's timeout. A `setInterval` is used to check every second (not configurable) the acknowledges.
  - Add management UI:
    + HTTP port is `8080` by default. It is configurable with the config parameter `httpServerPort`.
    + Display queues:
      - See internal queue length. A color is used to represent the length: green < 50%, red = 100%, orange > 50% && < 100%.
      - See registered clients
      - See last item in main and secondary queue.
  - Fix queue execution when a client registered and the secondary queue is full.
  - Fix client diconnection : when a client had multiple nodes, the disconnection of one node was unsubscribing all the nodes.

### V0.5.1
  - Fix binary. exec() wast not loaded.

### v0.5.0
  - The callback of kittenMQ.client().connect(config, callback) is called only once now. Before, it was called after each reconnection.

### v0.4.0
  - Update kitten-jwt version (from 0.3.9 to 1.0.0)
