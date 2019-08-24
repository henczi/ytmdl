var ws = new WebSocket('ws://localhost:12345');

var EVENTS = { onAction: function () {} };

ws.onmessage = function (event) {
    var message = event.data;
    var action = ''; try { action = JSON.parse(message); } catch (e) { };
    console.log(action);
    if (EVENTS.onAction) {
        EVENTS.onAction(action);
    }
};

function downloadById(videoId) {
    if (ws.readyState == ws.OPEN) {
        ws.send(JSON.stringify({ command: 'download', videoId }));
    }
}

function download() {
    var url = new URL(location.href);
    var videoId = url.searchParams.get('v');
    if (videoId) {
        downloadById(videoId);
    }
}

/* ===== UI ===== */

var ytdApp = document.querySelector('ytd-app');
ytdApp.style.transformOrigin = 'left top';
ytdApp.style.transform = 'scale(0.75)';

var dlApp = document.createElement('div');
document.body.appendChild(dlApp);
dlApp.style.position = 'absolute';
dlApp.style.top = '0';
dlApp.style.right = '0';
dlApp.style.width = '25vw';
dlApp.style.minHeight = '100vh';

var dlList = document.createElement('div');
dlList.style.position = 'absolute';
dlList.style.top = '0';
dlList.style.left = '0';
dlList.style.width = '100%';
dlList.style.paddingTop = '35px';
dlApp.appendChild(dlList);

var dlButton = document.createElement('button');
dlButton.textContent = 'Download';
dlButton.onclick = download;
dlButton.style.position = 'sticky';
dlButton.style.top = '0';
dlButton.style.left = '0';
dlButton.style.width = '100%';
dlButton.style.height = '35px';
dlApp.appendChild(dlButton);

stateToColor = {
    'FAIL': 'red',
    'DONE': 'green',
    'DL_START': 'blue',
}

function createOrUpdateItem(item) {
    var el = dlList.querySelector('#dl-item-' + item.videoId);
    if (!el) {
        el = document.createElement('div');
        el.setAttribute('id', 'dl-item-' + item.videoId);
        dlList.appendChild(el);
    }

    var itemContent = '';
    if (item.metadata) {
        itemContent = `
            <h3>${item.videoId} - <strong style="color: ${stateToColor[item.state] || 'black'}">${item.state}</strong></h3>
            <h2>${item.metadata.artist} - ${item.metadata.title}</h2>
            <h4>${item.metadata.album} ${item.metadata.year}</h4>
            <h4>Cover: ${item.hasCover ? 'YES' : 'NO'}</h4>
        `;
    } else {
        itemContent = `
            <h3>${item.videoId} - ${item.state}</h3>
            <h2>${item.filename}</h2>
        `;
    }
    el.innerHTML = `
        <div style="margin:10px; padding:10px; border-top: 2px solid black;">
            ${itemContent}
        </div>
    `;
}

EVENTS.onAction = function(action) {
    if (action.command == 'update') {
        createOrUpdateItem(action.item);
    }
}
