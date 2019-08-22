const yt = require('./core');

if (process.argv.length == 3) {
    yt.download(process.argv[2], {
        start: (ctx) => console.log('Start: ', ctx.videoId),
        metadata: (ctx) => console.log('Metadata: ', ctx.metadata),
        cover: (ctx) => console.log('HasCover: ', ctx.hasCover ? 'YES' : 'NO'),
        downloadStart: (ctx) => console.log('downloadStart'),
        downloadEnd: (ctx) => console.log('downloadEnd'),
        end: (ctx) => console.log('end'),
    })
    .then(() => console.log('DONE'))
    .catch(err => console.log(err));
} else {
    console.log('Usage: node index.js <video_id>');
}