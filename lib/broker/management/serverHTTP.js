const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const clientJS  = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');
const style     = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const logger    = require('../logger');
const stats     = require('../stats');
const { config } = require('process');
const log       = logger.log;
const namespace = logger.NAMESPACES.HTTP;
const router    = require('find-my-way')();

let server;

/**
 * Get nav HTML
 * @returns {String}
 */
function _getNav () {
  return `
    <nav>
      <div class="container">
        <h1>Kitten-mq</h1>
      </div>
    </nav>
  `;
}

/**
 * On update state we must re-render HTML status page
 * @param {Int} globalStatus
 * @param {Object} state { status : global status, lastUpdate : last status upfdate, states : Object }
 */
function getStatusPage (config, queues) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>kitten-mq status</title>

        <style>
          ${ style }
        </style>
      </head>
      <body dir="ltr" class="text-lg">
        ${ _getNav() }
        <div class="container" id="app">
        </div>
        <script>
          const queues          = ${JSON.stringify(queues)};
          const maxItemsInQueue = ${ config.maxItemsInQueue };
          const pollInterval    = ${ config.pollIntervalHTTP || 5000 };
          let refreshTimeout    = null;
        </script>
        <script>
          ${ clientJS }
        </script>
      </body>
    </html>
  `;
}

function prepareExportedData (config, queues) {
  const res = {};

  for (let channel in queues) {
    const _queue = queues[channel];

    res[channel] = {
      queueLength          : _queue.queue.length,
      queueSecondaryLength : _queue.queueSecondary._nbMessages,
      stats                : _queue.getStatistics(),
      tree                 : _queue.tree,
      config               : config.channels && config.channels[channel] ? config.channels[channel] : null
    };
  }

  return res;
}

/**
 * Create netdata output
 *
 * Channel : <channel> nbMessagesMain : <Int> nbMessagesSecondary : <Int> nbMessagesDropped : <Int>
 */
function createNetdataOutput (queue) {
  let res        = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n';
  let statistics = stats.getAll();

  for (let i = 0; i < statistics.length; i++) {
    let description = [];

    for (let key in statistics[i].description) {
      description.push(key + '="' + statistics[i].description[key] + '"');
    }

    res += statistics[i].label + '{' + description.join(',') + '} ' + statistics[i].value + '\n';
  }

  return res;
}


module.exports = {
  init : function (config, queues) {
    queues = queues;

    if (server) {
      return;
    }

    router.on('GET', '/statistics', (req, res) => {
      res.write(createNetdataOutput(queues));
      res.end();
    });

    router.on('GET', '/', (req, res) => {
      res.writeHeader(200, {"Content-Type": "text/html"});
      res.write(getStatusPage(config, prepareExportedData(config, queues)));
      res.end();
    });

    router.on('GET', '/queue/:queue/:limit/:offset', (req, res, params) => {
      const queue = queues[params.queue] || {};
      let messages = [];

      if (queue) {
        let offset = parseInt(params.offset, 10);
        let limit  = parseInt(params.limit, 10);

        let masterCursor = 0;
        let i            = offset;
        if (queue.queue.length && queue.queue.length >= offset) {
          let isNext = true;
          masterCursor = i;
          while (isNext) {
            messages.push({ channelId : queue.queue[i][0], id : queue.queue[i][3], queue : 'main' });
            i++;

            if (queue.queue.length === i || limit === i) {
              isNext = false;
            }
          }
        }

        if (queue.queueSecondary._nbMessages) {
          let cursor = 0;
          for (let id in  queue.queueSecondary) {
            if (id.startsWith('_')) {
              continue;
            }

            let queueSecond = queue.queueSecondary[id];

            for (let k = 0; k < queueSecond.length; k++) {
              if (cursor >= masterCursor && cursor <= limit) {
                messages.push({ channelId : queueSecond[k][0], id : queueSecond[k][3], queue : 'secondary' });
              }

              cursor++;
              if (cursor >= limit) {
                break;
              }
            }

            if (cursor >= limit) {
              break;
            }
          }
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify(messages));
      res.end();
    });

    router.on('GET', '/queue/:queue/:index', (req, res, params) => {
      const queue = queues[params.queue] || {};
      let message = null;

      index = parseInt(params.index, 10);

      if (queue) {
        if (queue.queue.length && queue.queue.length >= index) {
          message = { message : queue.queue[index][1], headers : queue.queue[index][2] };
        }

        if (queue.queueSecondary._nbMessages) {
          let cursor = 0;
          let hasBeenFound = false;
          for (let id in  queue.queueSecondary) {
            if (id.startsWith('_')) {
              continue;
            }

            let queueSecond = queue.queueSecondary[id];

            for (let k = 0; k < queueSecond.length; k++) {
              if (cursor === index) {
                message = { message : queueSecond[k][1], headers : queueSecond[k][2] };
                hasBeenFound = true;
                break;
              }
              cursor++;
            }

            if (hasBeenFound) {
              break;
            }
          }
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify(message));
      res.end();
    });

    server = http.createServer((req, res) => {
      router.lookup(req, res);
    });

    server.on('error', console.error);
    server.listen(config.httpServerPort || 8080, (err) => {
      if (err) {
        return log(logger.LEVELS.ERROR, namespace, 'Failed to start HTTP server', err);
      }

      log(logger.LEVELS.INFO, namespace, 'HTTP server started on port ' + (config.httpServerPort || 8080), err);
    });
  }
}
