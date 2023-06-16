const net          = require('net');
const fs           = require('fs');

const cli = {
  currentClient : null,
  /**
   * set the client socket
   * @param {socket} client
   */
  setClient : function (client) {
    if(client) {
      cli.currentClient = client;
    }
  },
  
  /**
   * get the client socket
   * @return {socket} currentClient
   */
  getClient : function () {
    return cli.currentClient;
  },
  
  /**
   * Init cli connexion with socket
   * @param  {object}   options  socketName
   * @param  {Object}   _queues  list of queues
   * @param  {Function} callback 
   * @return {function} callback
   */
  init : function (options, _queues, callback) {
    fs.unlink(options.socketName, (err) => {
      const server = net.createServer(socket => {
        socket.on('message', (message) => {
          if(message.from === 'CLI' && message.action) {
            let data = {};
            switch (message.action) {
              case 'list':
                data = this.list(_queues, message.options);
                break;
              case 'delete':
                data = this.deleteQueue(_queues, message.options);
                break;
              default :
                data = {}
                break;
            }
            socket.write(this.formatMessage(data),'utf-8');
          } else {
            socket.write(this.formatMessage({error : 'no action found'}),'utf-8');
          }
        });
        socket.on('data', (data) => {
          this.onData(data, socket);
        });

        socket.on('end', () => {
          console.log('client disconnected');
        });
      });
      
      server.on('error', (err) => {
        console.log('err',err);
      });

      server.on('connection', socket => {
        socket.buffer        = '';
        socket.contentLength = null;
        socket.setEncoding('utf-8');
        console.log('client connected');
      });

      server.listen(options.socketName, (err, res) => {
        if (callback) callback(null, server);
      });
    });
  },

  /**
   * Connect to a socket server
   * Listen to actions
   * @param {Function} callback
   */
  connect : function (socketName, callback) {
    socket = net.connect(socketName, (err) => {
      if(err)
      console.log('err',err);
    });
    socket.setEncoding('utf-8');
    socket.on('connect', () => {
      if (callback) callback(socket);
    });

    socket.on('error'  , (err) => {
      console.log('err',err);
    });

  },

  /**
   * Send data
   * @param  {Object} data  
   * @param  {socket} socket
   */
  send : function (data, socket) {
    if(!socket) {
      socket = cli.currentClient;
    }
    socket.write(this.formatMessage(data), 'utf-8');
  },

  /**
   * List queue 
   * @param  {Object} queues list of queues
   * @param  {Object} options 
   * @return {Object}        
   */
  list : function (queues, options) {
    const channel = options && options.channel ? options.channel : null;
    // const includeMessage = options && options.includeMessage === true;
    let data = [];
    if( options && options.queue ) {
      if(!queues[options.queue]) {
        return {action : 'list', result : [], error: 'Queue not found'};
      }
        data.push(generateQueueObject(options.queue, queues[options.queue], channel, options));
    } else {
      for (const [name, queue] of Object.entries(queues)) {
        data.push(generateQueueObject(name, queue, channel, options));
      }
    }

    return {action : 'list', result : data};
  },
  /**
   * Empty a queue or delete message into a queue
   * @param  {Obejct} queues  list of queues
   * @param  {Object} options 
   * @return {Object}
   */
  deleteQueue : function (queues, options) {
    if (!options || !options.queue || !queues[options.queue]) {
      return {action : 'delete', result : {message : `no queue available`}};
    }

    if(!options.channel && options.isPrimary && options.isRequeue && options.isSecondary) {
      delete queues[options.queue];
      return {action : 'delete', result : {message : `queue ${options.queue.yellow} dropped`}};
    }
    let str = ''
    let nbDeletedItem = 0;
    if(options.isPrimary) {
      nbDeletedItem += queues[options.queue].empty('primary', options.channel);
      str += 'primary';
    }

    if(options.isRequeue) {
     nbDeletedItem +=  queues[options.queue].empty('requeue', options.channel);
      if(str !== '') {
        str +=', '
      }
        str +='requeue'
    }

    if(options.isSecondary) {
      nbDeletedItem += queues[options.queue].empty('secondary', options.channel)
      if(str !== '') {
        str +=', '
      }
        str +='secondary'
    }


    return {action : 'delete', result : {message : `queue ${options.queue.yellow} ${options.channel.yellow || ''} dropped for ${str}. (${(nbDeletedItem+'').red} messages)`}};

  },
  /**
   * This function is called each time data is received. It buffers the data in socket.buffer and emit the 'message' event when the message is complete
   * @param  {Buffer} rawData raw data received
   * @param  {Object} socket
   */
  onData : function (rawData, socket) {
    var data      =  rawData;
    socket.buffer += data;

    if (socket.contentLength === null) {
      var i = socket.buffer.indexOf('#');
      // Check if the buffer has a #, if not, the end of the buffer string might be in the middle of a content length string
      if (i !== -1) {
        var _rawContentLength = socket.buffer.substring(0, i);
        socket.contentLength  = parseInt(_rawContentLength,10);
        socket.buffer         = socket.buffer.substring(i + 1);

        if (isNaN(socket.contentLength)) {
          socket.contentLength = null;
          socket.buffer        = '';
        }
      }
    }

    if (socket.contentLength !== null) {
      if (socket.buffer.length === socket.contentLength) {
        this.handleMessage(socket.buffer, socket);
      }
      else if (socket.buffer.length > socket.contentLength) {
        var message = socket.buffer.substring(0, socket.contentLength);
        var rest    = socket.buffer.substring(socket.contentLength);
        this.handleMessage(message, socket);
        this.onData(rest, socket);
      }
    }
  },

  /**
   * When the message is decoded and complete, this function is called
   * @param  {String} data
   * @param  {Object} socket
   */
  handleMessage : function (data, socket) {
    socket.contentLength = null;
    socket.buffer        = '';
    const _packet          = JSON.parse(data);
    socket.emit('message', _packet);
  },

  /**
 * Used by send. It transforms the message, add some information for transmission
 * @param  {String} message the message to transform
 * @return {String}         the message ready to be transmitted
 */
  formatMessage : function (message) {
    var _dataStr = JSON.stringify(message);
    var _data    = _dataStr.length + '#' + _dataStr;
    return _data;
  }
};

/**
 * Use by list, generate a queue object 
 * @param  {string} name  
 * @param  {object} queue 
 * @return {object}  
 */
function generateQueueObject (name, queue, channel, options) {
  let _queue = {
    name  : name,
    stats : queue.getStatistics(),
    primary : {
      count        : queue.queue.length,
      countRequeue : queue.queueRequeue.length,
      keys         : [],
      keysRequeue  : [],
    },
    secondary : {
      count : queue.queueSecondary._nbMessages,
      keys  : []
    }
  };

  if(_queue.primary.count > 0) {
    let _tmp = {};
    for(let i = 0; i < _queue.primary.count; i++) {
      const _item = queue.queue[i];
      if (!_tmp[_item[0]]) {
        _tmp[_item[0]] = { 
          count : 0,
          message : []
        };
      }
      _tmp[_item[0]].count++
      if(options.includeMessage && options.isPrimary) {
        _tmp[_item[0]].message.push({
          ..._item[1].channel, 
          // prefix header with underscore '_'
          _messageId  : _item[2].messageId,
          _created    : _item[2].created,
          _handlerId  : _item[2].handlerId,
          _error      : _item[2].error,
          _nbRequeues : _item[2].nbRequeues,
          ..._item[1].data
        })
      }
    }
    for (const [name, item] of Object.entries(_tmp)) {
      if(channel && channel !== name) continue;
      _queue.primary.keys.push({name : name, ...item})
    }
  }

  if(_queue.primary.countRequeue > 0) {
    let _tmp = {};
    for(let i = 0; i < _queue.primary.countRequeue; i++) {
      const _item = queue.queueRequeue[i][1];
      if (!_tmp[_item[0]]) {
       _tmp[_item[0]] = { 
          count : 0,
          message : []
        };
      }
      _tmp[_item[0]].count++
      if(options.includeMessage && options.isRequeue) {
        _tmp[_item[0]].message.push({
          ..._item[1].channel, 
          // prefix header with underscore '_'
          _messageId  : _item[2].messageId,
          _created    : _item[2].created,
          _handlerId  : _item[2].handlerId,
          _error      : _item[2].error,
          _nbRequeues : _item[2].nbRequeues,
          ..._item[1].data
        })
      }
    }
    for (const [name, item] of Object.entries(_tmp)) {
      if(channel && channel !== name) continue;
      _queue.primary.keysRequeue.push({name : name, ...item})
    }
  }

  for (const [key, item] of Object.entries(queue.queueSecondary)) {
    if(typeof item === 'object' && Array.isArray(item)) {
      if(channel && channel !== key) continue;
      let message = [];
      if(options.includeMessage && options.isSecondary) {
        for (let i = 0; i < item.length; i++) {
          message.push({
            ...item[i][1].channel, 
            // prefix header with underscore '_'
            _messageId : item[i][2].messageId,
            ...item[i][1].data
          })
        }
      }
      _queue.secondary.keys.push({name: key, count: item.length, message});
    }
  }

  return _queue;
};


module.exports = cli;