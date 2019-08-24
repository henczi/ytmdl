const fs = require('fs');

const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch');

const config = require('./config');
const COVER_FILENAME = 'tmp-cover.png';

function ffmpegCommand() {
    let command = ffmpeg();
    if (config.FFMPEG_PATH)
        command = command.setFfmpegPath(config.FFMPEG_PATH);
    if (config.FFPROBE_PATH)
        command = command.setFfprobePath(config.FFPROBE_PATH);
    return command;
}

async function getMetadata(ctx) {
    const info = await ytdl.getInfo(ctx.videoId);
    const media_data = info.media || {};

    let media_title = info.title
        || ((info.player_response || {}).videoDetails || {}).title
        || ('UNKNOWN-' + video_id);

    let metadata = {
        title: media_data.song || '',
        artist: media_data.artist || '',
        album: media_data.album || '',
        year: '',
    }

    const description = info.description
        || ((info.player_response || {}).videoDetails || {}).shortDescription
        || '';

    // Auto Generated
    if (description.startsWith('Provided to YouTube by')) {
        // Parse description
        const split_description = description.split('\n')
        const release_match = description.match(/Released on: ([0-9]{4})-/);
        const d_track_artist_split = (split_description[2] || '').split('·').map(q => q.trim());
        const d_track = (d_track_artist_split[0] || '');
        // TODO: multiple artist
        //const d_artist = (d_track_artist_split.slice(1).join(';') || '');
        const d_artist = (d_track_artist_split[1] || '');
        const d_album = (split_description[4] || '').trim();
        const d_year = release_match != null ? release_match[1] : undefined;
        
        metadata.title = d_track || metadata.title;
        metadata.artist = d_artist || metadata.artist;
        metadata.album = d_album || metadata.album;
        metadata.year = d_year || metadata.year;
    }

    let filename = media_title;
    if (metadata.title && metadata.artist) {
        filename = `${metadata.artist} - ${metadata.title}`;
    }

    filename = filename.replace(/[\\/:*?"<>|]/g, '').replace(/[!.]$/g, '');
    
    ctx.info = info;
    ctx.metadata = metadata;
    ctx.filename = filename;
    return ctx;
}

async function getCover(ctx) {
    const searchQuery = `http://ws.audioscrobbler.com/2.0/`
        +`?method=track.search`
        +`&artist=${encodeURIComponent(ctx.metadata.artist)}`
        +`&track=${encodeURIComponent(ctx.metadata.title)}`
        +`&api_key=${config.LASTFM_API_KEY}&format=json`;

    const searchResult = await fetch(searchQuery).then(x => x.json());

    const tracks = ((searchResult.results || {}).trackmatches || {}).track || [];
    const mbid = (tracks.find(y => y.mbid) || {}).mbid;

    if (!mbid) {
        return ctx;
    }

    const trackQuery = `http://ws.audioscrobbler.com/2.0/`
        +`?method=track.getInfo`
        +`&mbid=${mbid}`
        +`&api_key=${config.LASTFM_API_KEY}&format=json`;

    const trackResult = await fetch(trackQuery).then(x => x.json());

    const images = (((trackResult.track || {}).album || {}).image || []);
    const image = (images.find(x => x['#text'].indexOf('300x300') >= 0) || {});
    const imageUrl = image['#text'];

    if (imageUrl) {
        const imageResult = await fetch(imageUrl);
        await imageResult.body.pipe(fs.createWriteStream(ctx.videoId + COVER_FILENAME));
        ctx.hasCover = true;
    }
    return ctx;
}

function downloadAndConvert(ctx) {

    return new Promise((resolve, reject) => {
        let command = ffmpegCommand()
            .input(ytdl.downloadFromInfo(ctx.info, { format: '140' }))
            .outputOptions('-id3v2_version', '3') // metaadatok
            .outputOptions('-metadata', 'title=' + ctx.metadata.title)
            .outputOptions('-metadata', 'artist=' + ctx.metadata.artist)
            .outputOptions('-metadata', 'album=' + ctx.metadata.album)
            .outputOptions('-metadata', 'date=' + ctx.metadata.year)
            // TODO: trim silence (start, end)
            // .outputOptions('-af', 'silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-90dB')
            .audioBitrate(128)
            .audioCodec('libmp3lame')
            .outputFormat('mp3')

        if (ctx.hasCover) {
            command = command
                .input(ctx.videoId + COVER_FILENAME)
                // konvertálás nélkül
                .outputOptions('-c:v', 'copy')
                // -map nélkül csak az audio (eq: -map 0:a)
                // -map 0 -> audio + 'video' -> mp3 + cover
                .outputOptions('-map', '0:a', '-map', '1')
        }
        
        command
            .on('start', function(commandLine) {
                // console.info('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('progress', (progress) => {
                // console.info(`[ffmpeg] ${JSON.stringify(progress)}`);
            })
            .on('error', (err) => {
                // console.info(`[ffmpeg] error: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                // console.info('[ffmpeg] finished');
                resolve(ctx);
            })
            .save('./music/' + ctx.filename + '.mp3');
    });
}

function finalize(videoId) {
    return function() {
        if (fs.existsSync(videoId + COVER_FILENAME))
            fs.unlinkSync(videoId + COVER_FILENAME);
    }
}

function throwErrorAnd(fun) {
    return function(err) {
        fun();
        throw err;
    }
}

function callEvent(event) {
    return function(ctx) {
        if (event) event(ctx);
        return ctx;
    }
}

function download(videoId, events = {}) {

    return Promise.resolve({ videoId })
            .then(callEvent(events.start))
        .then(getMetadata)
            .then(callEvent(events.metadata))
        .then(getCover)
            .then(callEvent(events.cover))
            .then(callEvent(events.downloadStart))
        .then(downloadAndConvert)
            .then(callEvent(events.downloadEnd))
        .then(finalize(videoId))
            .then(callEvent(events.end))
        .catch(throwErrorAnd(finalize(videoId)));

}

module.exports = { download };