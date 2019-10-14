/**
 * Get a tooltip
 * @param {String} text to display in tooltip
 * @returns {Object}
 */
function getTooltip (text) {
  let tooltipText       = document.createElement('div');
  tooltipText.className = 'tooltip-text';
  tooltipText.innerHTML = text;
  return tooltipText;
}

/**
 * Create progress bar
 * @param {Int} queueValue
 * @param {String} internalQueueName  progress bar name
 * @returns {Object}
 */
function createProgressBar (queueValue, internalQueueName) {
  let progressBarDiv      = document.createElement('div');
  let progressBarValueDiv = document.createElement('div');

  let lengthQueue = (queueValue / maxItemsInQueue) * 100;
  let colorClass  = 'bg-green';

  if (lengthQueue >= 50) {
    colorClass  = 'bg-orange';
  }
  if (lengthQueue === 100) {
    colorClass  = 'bg-red';
  }

  progressBarValueDiv.style.width  = lengthQueue + '%';
  progressBarValueDiv.style.height = '100%';
  progressBarValueDiv.className    = colorClass;

  progressBarDiv.appendChild(progressBarValueDiv);
  progressBarDiv.style.height = '20px';
  progressBarDiv.style.width  = '100%';
  progressBarDiv.className    = 'bg-grey tooltip ml-1';

  progressBarDiv.appendChild(getTooltip(internalQueueName + '<br>' + queueValue + ' / ' + maxItemsInQueue));

  return progressBarDiv;
}

/**
 * Create last items div
 * @param {Object} queue
 * @returns {Object}
 */
function createLastItems (queue) {
  let objectsDiv = document.createElement('div');

  let divMain     = document.createElement('div');
  let divSeconday = document.createElement('div');

  divMain.innerHTML     = 'Last item in queue';
  divSeconday.innerHTML = 'Last item in queue';

  divMain.style.padding     = '.3em';
  divMain.style.width       = '100%';
  divSeconday.style.padding = '.3em';
  divSeconday.style.width   = '100%';

  let lastObjectSecondaryDiv = document.createElement('pre');
  let lastObjectMainDiv      = document.createElement('pre');

  lastObjectMainDiv.innerHTML      = JSON.stringify(queue.lastItem          ? queue.lastItem[1]          : null, null, 2);
  lastObjectSecondaryDiv.innerHTML = JSON.stringify(queue.lastItemSecondary ? queue.lastItemSecondary[1] : null, null, 2);

  lastObjectMainDiv.className      = 'mt-1';
  lastObjectSecondaryDiv.className = 'mt-1';

  divMain.appendChild(lastObjectMainDiv);
  divSeconday.appendChild(lastObjectSecondaryDiv);

  objectsDiv.appendChild(divMain);
  objectsDiv.appendChild(divSeconday);

  objectsDiv.className = 'card-box';

  return objectsDiv;
}

/**
 * Create client list
 * @param {Object} queue
 * @returns {Object}
 */
function createClientsList (queue) {
  let div   = document.createElement('div');
  let title = document.createElement('h2');
  let ul    = document.createElement('ul');

  title.innerHTML = '<b>Registered clients</b>';
  div.appendChild(title);

  let description       = document.createElement('p');
  description.innerHTML = 'c = consumer, l = listener';
  div.appendChild(description);

  let clients = {};

  for (var i = 0; i < queue.tree.ids.length; i++) {
    let id = queue.tree.ids[i];

    for (let client in queue.tree.clientNodes[i]) {
      let nodeId = queue.tree.clientNodes[i][client];

      for (var j = 0; j < nodeId.nodes.length; j++) {
        let node     = nodeId.nodes[j].split('#');
        let clientId = node[0];

        if (!clients[clientId]) {
          clients[clientId] = []
        }

        let value = { label : id, isConsumer : client === 'root' };
        if (clients[clientId].map(e => e.label === value.label && e.isConsumer === value.isConsumer).indexOf(true) === -1) {
          clients[clientId].push(value);
        }
      }
    }
  }

  for (client in clients) {
    let li = document.createElement('li');
    let ids = clients[client].map((id) => {
      return '<span><i>' + (id.isConsumer ? '[c]' : '[l]') + '</i> ' + id.label + '</span>';
    }).join(', ');
    li.innerHTML = client + ' : ' + ids;

    ul.appendChild(li);
  }

  ul.style.overflow      = 'auto';
  ul.style['max-height'] = '300px';

  div.appendChild(ul);
  ul.className  = 'mt-1';
  div.className = 'mt-2';
  return div;
}

/**
 * Create queue div
 * @param {String} name queue name
 * @param {Object} queue
 */
function createQueueItem (name, queue) {
  let queueDiv = document.createElement('div');
  queueDiv.style.width = '100%';

  let queueTitle       = document.createElement('h1');
  queueTitle.innerHTML = 'Queue: ' + name;

  queueDiv.appendChild(queueTitle);

  let queueList          = document.createElement('div');
  let queueMainItem      = document.createElement('div');
  let queueSecondaryItem = document.createElement('div');

  queueMainItem.innerHTML      = 'Real';
  queueSecondaryItem.innerHTML = 'Waiting';
  queueMainItem.className      = 'internal-queue';
  queueSecondaryItem.className = 'internal-queue';

  queueMainItem.appendChild(createProgressBar(queue.queue.length, 'Real'));
  queueSecondaryItem.appendChild(createProgressBar(queue.queueSecondary._nbMessages, 'Waiting'));

  queueList.className = 'card-box mt-2';

  queueList.appendChild(queueMainItem);
  queueList.appendChild(queueSecondaryItem);
  queueDiv.appendChild(queueList);

  queueDiv.appendChild(createLastItems(queue));
  queueDiv.appendChild(createClientsList(queue));

  queueDiv.className = 'card';
  return queueDiv;
}

function render () {
  let container = document.getElementById('app');

  for (let channel in queues) {
    container.appendChild(createQueueItem(channel, queues[channel]));
  }
}

render();
