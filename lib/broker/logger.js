const utils = require('../utils');

/**
 * Maybe this is the most efficient/simple way to collect logs in a production environnement
 *
 * How it works?
 * Just include this file in the master process, and use console.log, console.error...
 *
 * - It create a /logs directory and rotate file automatically
 *
 * - It collects logs of
 *   - process.stdout.write
 *   - process.stderr.write
 *   - console.log
 *   - console.dir
 *   - console.error
 *   - someStream.pipe(process.stdout);
 *   - throw new Error('Crash');
 *   - throw 'never do this';
 *   - throw undefined
 *
 * - It is cluster safe
 *   Workers send logs to the master process. The latter append logs in one unique file.
 *   cluster.setupMaster({silent : true}) must be set before forking
 *
 * - It adds the date in front of each log
 */
const fs            = require('fs');
const path          = require('path');
const stream        = require('stream');
const LOG_RETENTION = 10;
var currentDay      = '';

const NAMESPACES = {
  SOCKET    : 'socket   ',
  ROUTER    : 'router   ',
  HANDLER   : 'handler  ',
  PUBLISHER : 'publisher',
  QUEUE     : 'queue    ',
  HTTP      : 'http     '
};
const LEVELS = {
  DEBUG : 1,
  INFO  : 2,
  WARN  : 3,
  ERROR : 4
};
const levelsLabels = [null, 'debug', 'info ', 'warn ', 'error'];
const levelsFns    = [null, 'debug', 'info', 'warn', 'error']
let consoleLevel   = 2;

/**
 * Log according to log level
 * If given level is inferior to base level as defined in the config, the log will be discarded
 * @param {String} level
 * @param {String} message
 * @param {*} data
 */
function log (level, namespace, message, data) {
  if (!(consoleLevel && level >= consoleLevel)) {
    return;
  }

  message = '[' + levelsLabels[level] + '] [' + namespace + '] ' + message;

  if (data) {
    return console[levelsFns[level]](message, data);
  }

  console[levelsFns[level]](message);
}

/**
 * zero padding
 * @param  {String}  n   string
 * @param  {Integer} len total number of character wanted
 * @return {String}      string
 */
function padlz (n, len) {
  for (n+=''; n.length < len; n = '0' + n) {} // eslint-disable-line
  return n;
}

/**
 * Add timestamp at the beginning of the log
 * @return {Stream} Transform stream
 */
function createTimestampTransformStream () {
  return new stream.Transform({
    transform (chunk, encoding, callback) {
      var _date = new Date();
      var _timestamp = _date.getFullYear()  + '-'
        + padlz(_date.getMonth()+1 , 2)     + '-'
        + padlz(_date.getDate()    , 2)     + ' '
        + padlz(_date.getHours()       , 2) + ':'
        + padlz(_date.getMinutes()     , 2) + ':'
        + padlz(_date.getSeconds()     , 2) + '.'
        + padlz(_date.getMilliseconds(), 3) + ' '
      ;
      callback(null, _timestamp + chunk);
    }
  });
}

/**
 * Rotate file stream, and rotation log files
 * @param  {Stream} readableStream stream from which logs come from
 * @param  {Stream} writableStream current file stream where logs go to
 * @param  {String} filename       log filename
 * @return {Stream}                new file stream where logs go to
 */
function rotateStream (readableStream, writableStream, filename) {
  readableStream.pause();
  readableStream.unpipe(writableStream);
  writableStream.end();
  rotateLog(filename);
  var _newWritableStream = fs.createWriteStream(filename, { flags : 'a', encoding : 'utf8',  mode : parseInt('0666',8) });
  readableStream.pipe(_newWritableStream);
  readableStream.resume();
  return _newWritableStream;
}

/**
 * Rotate log file.
 * @Warning, this function is synchrone. But executed once a day, by the master process only, at midnight.
 * @param  {String} filename log file name
 */
function rotateLog (filename) {
  for (var i = LOG_RETENTION; i > 0 ; i--) {
    var _oldFile = filename + '.' + (i-1);
    if (i === 1) {
      _oldFile = filename;
    }
    var _newFile = filename + '.' + i;
    try {
      fs.renameSync(_oldFile, _newFile);
    }
    catch (e) {} // eslint-disable-line
  }
}

module.exports = {
  init : function init (pathDirectory) {
    utils.createDirIfNotExists(pathDirectory);

    const outFilename   = path.join(pathDirectory, 'out.log');
    const errFilename   = path.join(pathDirectory, 'err.log');

    // create the logs directory if it does not exist
    try {
      fs.mkdirSync(pathDirectory);
    }
    catch (e) {} // eslint-disable-line

    const outTransform = createTimestampTransformStream();
    const errTransform = createTimestampTransformStream();
    var   outLogStream = fs.createWriteStream(outFilename, { flags : 'a', encoding : 'utf8',  mode : parseInt('0666',8) });
    var   errLogStream = fs.createWriteStream(errFilename, { flags : 'a', encoding : 'utf8',  mode : parseInt('0666',8) });

    process.stdout.write = outTransform.write.bind(outTransform);
    process.stderr.write = errTransform.write.bind(errTransform);

    outTransform.pipe(outLogStream);
    errTransform.pipe(errLogStream);


    // we should do it when there is a new log to write to improve rotation precision
    setInterval(function () {
      var _date = new Date();
      var _day = _date.getFullYear() + padlz(_date.getMonth() + 1, 2) + padlz(_date.getDate(), 2);
      if (currentDay === '') {
        currentDay = _day;
      }
      else if (currentDay !== _day) {
        console.log('[master] Rotate logs');
        outLogStream = rotateStream(outTransform, outLogStream, outFilename);
        errLogStream = rotateStream(errTransform, errLogStream, errFilename);
        currentDay = _day;
      }
    }, 10000);
  },

  log,
  LEVELS,
  NAMESPACES,
  setLogLevel : function (level) {
    consoleLevel = level;
  }
}
