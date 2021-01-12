const menu        = ['Clients', 'Messages'];
let selectedMenu  = menu[0];
let selectedQueue = null;
let queueOpen     = null;

/**
 * Preview queue
 */
function onClickOpenQueue (queueDiv, queue) {
  // fetch('/queue/' + encodeURIComponent(queue))
  // .then(res => {
  //   return res.json()
  // })
  // .then(res => {
  //   console.log(res);
  // })
  // .catch(e => {
  //   console.log('Cannot GET /queue/' + queue, e);
  // })

  if (queueOpen) {
    queueOpen.removeChild(queueOpen.lastChild);
    selectedMenu = menu[0];
  }

  queueOpen = queueDiv;
  queueDiv.appendChild(renderPreviewQueue(queue));
}

function onClickQueuePreviewMenuItem (queue, menuItem, divContent) {
  divContent.innerHTML = '';
  switch (menuItem) {
    case menu[0]:
      divContent.appendChild(createClientsList(queue));
      break;
    case menu[1]:
      divContent.appendChild(renderMessagesList(queue));
      break;
    // case menu[2]:
    //   break;
  }
}

function onClickOpenMessage (index, div) {
  div.innerHTML = '';

  fetch('/queue/' + encodeURIComponent(selectedQueue) + '/' + index)
  .then(res => {
    return res.json()
  })
  .then(message => {
    const p = document.createElement('p');
    p.textContent = 'Preview message';
    div.appendChild(p);

    if (!message) {
      const span = document.createElement('span');
      span.textContent = 'No message';
      return div.appendChild(span);
    }

    const pre = document.createElement('pre');
    message.message.headers = message.headers;
    pre.textContent = JSON.stringify(message.message, null, 2);
    div.appendChild(pre);
  })
  .catch(e => {
    console.log('Cannot GET /queue/' + selectedQueue, e);
    divPagination.textContent = 'No message';
  });
}

function renderMessagesListPagination (divPagination, divPreview, limit, offset) {
  divPagination.innerHTML = '';

  const p = document.createElement('p');
  p.textContent = 'First 10 items';
  divPagination.appendChild(p);

  fetch('/queue/' + encodeURIComponent(selectedQueue) + '/' + limit + '/' + offset)
  .then(res => {
    return res.json();
  })
  .then(messages => {
    messages.forEach((message, index) => {
      const divMessage = document.createElement('div');
      divMessage.className    = 'flex flex-d-row';
      divMessage.style.color  = '#2563EB';
      divMessage.style.cursor = 'pointer';
      divMessage.onclick = function () {
        onClickOpenMessage((limit * offset) + index, divPreview)
      }

      for (let attribute in message) {
        const div = document.createElement('div');
        div.style.marginRight = '.5rem';
        div.textContent = attribute + ': ' + message[attribute];
        divMessage.appendChild(div);
      }

      divPagination.appendChild(divMessage);
    });
  })
  .catch(e => {
    console.log('Cannot GET /queue/' + selectedQueue, e);
    divPagination.textContent = 'No message';
  });
}

function renderMessagesList (queue) {
  const limit = 10;
  let offset  = 0;

  const div           = document.createElement('div');
  const divPagination = document.createElement('div');
  const divPreview    = document.createElement('div');
  div.className = 'flex flex-d-column';
  divPagination.className = 'flex-1';
  divPreview.className = 'mt-1';
  renderMessagesListPagination(divPagination, divPreview, limit, offset);

  div.appendChild(divPagination);
  div.appendChild(divPreview);
  return div;
}

/**
 * Render preview queue menu
 * @param {Div} divMenu
 * @param {Div} divContent
 * @param {Object} queue
 */
function renderPreviewQueueMenu (divMenu, divContent, queue) {
  divMenu.innerHTML = '';
  const ul   = document.createElement('ul');
  menu.forEach(menuItem => {
    const li = document.createElement('li');
    li.textContent = menuItem;

    if (menuItem === selectedMenu) {
      li.style.fontWeight = 'bold';
    }

    li.style.padding = '.25rem';
    li.style.cursor  = 'pointer';
    li.onclick = function () {
      selectedMenu = menuItem;
      onClickQueuePreviewMenuItem(queue, menuItem, divContent);
      renderPreviewQueueMenu(divMenu, divContent, queue);
    }
    ul.appendChild(li);
  });
  divMenu.appendChild(ul);
}

/**
 * Render preview queue
 * @param {Object} queue
 */
function renderPreviewQueue (queue) {
  const div        = document.createElement('div');
  div.className = 'flex flex-d-row preview-queue';
  const divMenu    = document.createElement('div');
  divMenu.style['width'] = '160px';
  const divContent = document.createElement('div');
  divContent.className = 'flex-1';

  renderPreviewQueueMenu(divMenu, divContent, queue);
  onClickQueuePreviewMenuItem(queue, menu[0], divContent);

  div.appendChild(divMenu);
  div.appendChild(divContent);
  return div;
}

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
  progressBarDiv.className    = 'bg-grey tooltip';

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

  divMain.style.padding      = '.3em';
  divMain.style.width        = '100%';
  divMain.style.overflow     = 'hidden';
  divSeconday.style.padding  = '.3em';
  divSeconday.style.width    = '100%';
  divSeconday.style.overflow = 'hidden';

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

  for (let id in queue.tree.ids) {
    let idTree = queue.tree.ids[id];

    for (let client in idTree) {
      let nodeId = idTree[client];

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
  return div;
}

function createRawItem (title, value) {
  const div      = document.createElement('div');
  const divTitle = document.createElement('div');
  let divContent = document.createElement('div');

  divTitle.innerHTML   = title;

  if (value.nodeType) {
    divContent.appendChild(value);
  }
  else {
    divContent.innerHTML = value;
  }

  div.appendChild(divTitle);
  div.appendChild(divContent);
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
  queueTitle.innerHTML = name;

  queueDiv.appendChild(queueTitle);

  let queueList          = document.createElement('div');
  let queueMainItem      = document.createElement('div');
  let queueSecondaryItem = document.createElement('div');

  queueMainItem.className      = 'internal-queue';
  queueSecondaryItem.className = 'internal-queue';

  queueMainItem.appendChild(createProgressBar(queue.queueLength, 'Real'));
  queueSecondaryItem.appendChild(createProgressBar(queue.queueSecondaryLength, 'Waiting'));

  queueList.className = 'card-box mt-2';

  const main      = createRawItem('Real', queueMainItem);
  const secondary = createRawItem('Secondary', queueSecondaryItem);
  main.style.flex = 1;
  secondary.style.flex = 1;

  queueList.appendChild(main);
  queueList.appendChild(secondary);

  for (let stat in queue.stats) {
    let item = createRawItem(stat, queue.stats[stat]);
    item.style.width     = '100px';
    item.style.textAlign = 'right';
    queueList.appendChild(item);
  }

  queueDiv.appendChild(queueList);

  const seeLink       = document.createElement('a');
  seeLink.textContent = 'See queue';
  seeLink.onclick     = function () {
    selectedQueue = name;
    onClickOpenQueue(queueDiv, queue);
  };

  queueDiv.appendChild(seeLink);

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

// refreshTimeout = setTimeout(() => {
//   location.reload();
// }, pollInterval);
