# Kitten MQ

Easy to learn, Secure, Business-ready, Resilient & Fast Message Queue system

## Philosophy and why

Most of systems (Kafka, RabbitMQ, ZeroMQ, NSQ, NATS, ...) are either too complex to use/deploy or too "low-level".
First mission: stay simple to learn, simple to use and simple to deploy.

I want a system which provides a beautiful admin dashboard, where each client is authenticated
automatically with an assymetric JWTs (no user/password to maintain for each client!) and where it
is easy to define who has the right to listen/send what.

It must provide a documentation for each channel and follow this principle `one channel endpoint/version = one JSON format` (no surprise!)

Kitten-MQ guarantees that a message will be delivered at least once, though duplicate messages are possible.
Consumers should expect this and de-dupe or perform idempotent operations.

## Features

- no SPF


## Installation

```bash
  npm install kitten-mq --save
```

## Getting started

1) Install a broker: the server which manages queues


2) Use it

```java
  let kittenMQ = require('kitten-mq');

  let config = {
    hosts    : ['mybrokerurl.com:443'],      // list of brokers mirror URLs for High Avaibility
    pubKey   : fs.readfile('kittenMQ.pub'),  // The public key of this client sent to the broker
    privKey  : fs.readfile('kittenMQ.pem'),  // The private key of the client used to generate tokens
    clientId : 'easilys-APP-KEY'             // The client id, it must be globally unique
  };

  // When the client connects for the first time, it pushes the public key on the broker
  // Then, the broker will accept connections for this client only if tokens are generated with the same pub/priv key
  let mq = kittenMQ.client.connect(config, (err) => {
    // if connect failed, it retries automatically and it calls this callback for each retry
    console.log(err);
  });

  // Now, you are ready to send message to a specific channel
  // If the broker is not available, it will re-try automatically until the sending queue is full, then the callback is called with errors
  mq.send('endpoint/v1/120', 'coucou', (err) => {
    console.log(err);
  });

  // You can broadcast the message to all destination IDs of a channel
  mq.send('endpoint/v1/*', 'coucou', (err) => {
    console.log(err);
  });

  // You can listen channel, the message is sent to as many listeners as there are
  mq.listen('endpoint/v1/120', (err, msg) => {
    console.log(msg);
  });

  // Or consume channel, the message is sent to one consumer at a time (round-robin distribution)
  mq.consume('endpoint/v1/120', (err, msg, done, info) => {
    console.log(msg);
    done(false); // requeue if false is passed
  })

  // You can use wildcard to listen many channels, and aknowledge
  mq.listen('endpoint/v1/*', (err, msg, info) => {
    console.log(info.channel.endpoint);
    console.log(info.channel.version);
    console.log(info.channel.id);
    console.log(msg);
  });

  // you can also pass an object to describe the channel
  let _channel = {
    endpoint : 'endpoint',
    version : 'v1',
    id : [123, 22, 33]
  };
  let listener = mq.listen(_channel, (msg) => {
    console.log(msg);
  });
  listener.addId([], (err) => {}); // you can add id to listen at runtime
  listener.removeId([], (err) => {}); // or remove id to listen at runtime

```

## Right Management

The broker has a config file which defines client rights between channels

```javascript
{
  serverId              : 'mybroker-service-1',         // broker unique id, defined on the broker side
  registeredClientsPath : 'path_to_client_public_keys_folder',
  keysDirectory         : 'path_to_brokers_keys',
  keysName              : 'key_name',
  isMaster              : false, // only master is able to send messages to listeners and consumers

  socketServer : {
    port            : 1234, // server port
    host            : 'localhost',
    logs            : 'path_to_packet_logs_directory',
    packetsFilename : 'broker.log', // name of the file to saved unsent packets
    token           : null          // auth token for clients
  },

  maxItemsInQueue : 1000, // max item in queue in one queue (channel)
  requeueLimit    : 5,    // limit of requeues for one packet
  requeueInterval : 100   // requeue interval in seconds

  // Rights
  rules    : [
    {
      client        : 'easilys-*',
      autoAccept    : true,                                 // auto accept new clients which match this client name
      read          : ['gateway/*', 'supplier_invoice/*'],  // the client cannot listen on *
      write         : ['email/*', 'faxes/*']                // syntax is: endpoint/version/id, endpoint/version/* or endpoint/*
    },
    {
      client        : 'email-service-1',
      autoAccept    : false,                                // it must stays at false because
      read          : ['*'],
      write         : ['*']
    },
    {
      client        : 'email-service-2',
      read          : ['*'],
      write         : ['*']
    }
  ],

  channels : [
    // Description des channels :
    {
      'easilys/v1' :{
        map : {
          id : ['int'],
          ...
        }
      }
    }
  ]
}
```

## Concepts to learn

### What is a broker?

A broker is a server which receives message from clients and push them to other clients

### What is a channel?

Kitten-MQ works like a radio. There are channels where everyone (if allowed) can speak or listen to.

Channel names must follow this pattern : `endpoint/version/destination_id`

- `endpoint` can be any alphanumeric string without special characters (only `_` is allowed), consider it like the beginning of a REST API
- `version`  defines the JSON format version `v1, v2, ...`
- `destination_id` can be any urlencoded string you want (at least `/` and `*` must be urlencoded)

One tuple `endpoint/v1` defines a JSON format


### What is the difference between mq.listen and mq.consume?

KittenMQ duplicates messages of a channel to as many listeners, but is there are multiple consumers for the same channel, only one
consumer will receive the message among other

