const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const clientJS  = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');
const style     = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const logger    = require('../logger');
const stats     = require('../stats');
const log       = logger.log;
const namespace = logger.NAMESPACES.HTTP;

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

function prepareExportedData (queues) {
  const res = {};

  for (let channel in queues) {
    const _queue = queues[channel];

    res[channel] = {
      queueLength          : _queue.queue.length,
      queueSecondaryLength : _queue.queueSecondary._nbMessages,
      stats                : _queue.getStatistics()
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

    server = http.createServer(function handleRequest (req, res) {
      if (/statistics/.test(req.url)) {
        res.write(createNetdataOutput(queues));
        return res.end();
      }

      res.writeHeader(200, {"Content-Type": "text/html"});
      res.write(getStatusPage(config, prepareExportedData(queues)));
      res.end();
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
