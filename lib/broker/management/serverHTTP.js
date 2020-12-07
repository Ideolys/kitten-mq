const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const clientJS  = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');
const logger    = require('../logger');
const stats = require('../stats');
const log       = logger.log;
const namespace = logger.NAMESPACES.HTTP;

let server;
let queues;

/**
 * Get css for page
 * @return {String}
 */
function _getStyleValue () {
  return `
    html, body, div, span, h1, h2, h3, h4, h5, h6, p, a, ul {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 100%;
      font: inherit;
      vertical-align: baseline;
    }

    html {
      background: #f8f9fa;
      font-family: 'Roboto', sans-serif;
      color: #111;
    }

    h1 {
      font-size: 16px;
      font-weight: bold;
    }
    h2 {
      font-size: 16px;
      color: #555;
    }
    ul {
      display: block;
      padding-left: 20px;
    },
    li {
      display: block;
    }

    .container {
      margin: 0 auto;
      max-width: 1200px;
      padding: 1em;
    }

    nav {
      background: white;
    }

    .ml-1 {
      margin-left: .5em;
    }
    .mt-1 {
      margin-top: .5em;
    }
    .mt-2 {
      margin-top: 1em;
    }
    .mb-1 {
      margin-bottom: .5em;
    }
    .border-grey {
      border: 1px solid #f8f9fa;
    }
    .bg-grey {
      background: #f8f9fa;
      color: #111;
    }
    .bg-green {
      background: #32c638;
      color: white;
    }
    .bg-orange {
      background: #ff9700;
      color: white;
    }
    .bg-red {
      background: #f34135;
      color: white;
    }

    .tooltip {
      position: relative;
      display: inline-block;
    }
    .tooltip .tooltip-text {
      visibility: hidden;
      width: 120px;
      background-color: black;
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 5px 0;
      position: absolute;
      z-index: 1;
      top: 150%;
      left: 50%;
      margin-left: -60px;
    }

    .tooltip .tooltip-text::after {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: transparent transparent black transparent;
    }
    .tooltip:hover .tooltip-text {
      visibility: visible;
    }

    .card {
      padding: 1em;
      box-shadow: 0px 1px 3px hsla(0, 0%, 0%, .2);
      background: white;
      margin-bottom: 1em;
    }
    .card-box {
      border-radius: 8px;
      align-items: start;
      justify-content: center;
      display: flex;
      flex-direction: row;
    }
    .internal-queue {
      width: 100%;
      padding: .3em;
      display: flex;
      flex-direction: row;
      space-between: .2em;
    }

    pre { max-height: 200px; resize : none; padding: 1em; background : #f6f6f6; color : #555; margin: 0; font-size: .85rem; overflow:auto }
  `;
}

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
          ${ _getStyleValue() }
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
      res.write(getStatusPage(config, queues));
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
