const WebSocket = require('ws');
const yt = require('./core');

const wss = new WebSocket.Server({ port: 12345 });

wss.on('connection', function connection(ws) {

    ws.on('message', function incoming(message) {
        var action = ''; try { action = JSON.parse(message); } catch (e) { };
        if (action.command == 'download') {
            dl(ws, action.videoId);
        }
    });

});

function dl(ws, videoId) {
    const item = { videoId, state: 'QUEUE' };
    sendUpdate(ws, item);
    yt.download(videoId, {
        start: (ctx) => { item.state = 'START'; sendUpdate(ws, item) },
        metadata: (ctx) => {
            item.state = 'METADATA';
            item.metadata = ctx.metadata;
            item.filename = ctx.filename;
            sendUpdate(ws, item)
        },
        cover: (ctx) => { item.state = 'COVER'; item.hasCover = ctx.hasCover; sendUpdate(ws, item) },
        downloadStart: (ctx) => { item.state = 'DL_START'; sendUpdate(ws, item) },
        downloadEnd: (ctx) => { item.state = 'DL_END'; sendUpdate(ws, item) },
        end: (ctx) => { item.state = 'END'; sendUpdate(ws, item) },
    })
        .then(() => { item.state = 'DONE'; sendUpdate(ws, item) })
        .catch(err => { item.state = 'FAIL'; item.error = err.stack; sendUpdate(ws, item) });
}

function sendUpdate(ws, item) {
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ command: 'update', item }));
}