const {
    SkillBuilders,
    getRequestType,
    getIntentName,
    getSlotValue,
    getDialogState,
} = require('ask-sdk-core');
const ytdl = require('ytdl-core');
const request = require('request');
const i18n = require('i18next'); 
const sprintf = require('i18next-sprintf-postprocessor'); 
const ytSearch = require( 'yt-search' );

const languageStrings = {
    'en' : require('./i18n/en'),
    'fr' : require('./i18n/fr')
}

// inside the index.js
const LocalizationInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: handlerInput.requestEnvelope.request.locale,
            fallbackLng: 'en', // fallback to EN if locale doesn't exist
            resources: languageStrings
        });

        localizationClient.localize = function () {
            const args = arguments;
            let values = [];

            for (var i = 1; i < args.length; i++) {
                values.push(args[i]);
            }
            const value = i18n.t(args[0], {
                returnObjects: true,
                postProcess: 'sprintf',
                sprintf: values
            });

            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)];
            } else {
                return value;
            }
        }

        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function (...args) { // pass on arguments to the localizationClient
            return localizationClient.localize(...args);
        };
    },
};

const testVideoID = '9bZkp7q19f0';
const testQuery = 'gangnam style'

//For testing locally with node index.js
if (require.main === module) {
    //get_url_and_title(testVideoID,(url,title) => {
    //    console.log(title);
    //});
    youtubeSearch(testQuery, (id) => {
        console.log(id)
    });
}

async function youtubeSearch(query, callback) {
    ytSearch( query, function ( err, r ) {
        if ( err ) throw err
        const videos = r.videos
        const playlists = r.playlists
        const accounts = r.accounts
        const firstResult = videos[0].videoId
        let playlist={'p':0};
        console.log('length: '+videos.length)
        for (let i=0; i<10; i++) {
            playlist['v'+i]=videos[i].videoId
        }
        console.log(playlist);
        callback(firstResult, playlist);
    });
}

function convert_object_to_token(object) {
    let token;
    for (const [key, val] of Object.entries(object)) {
        let pair = [key,val].join('=')
        token = [token, pair].filter(Boolean).join('&')
    }
    return token;
}

function convert_token_to_dict(token) {
    let pi=token.split('&')
    let playlist={}
    for (let i=0; i<pi.length; i++) {
        let key=pi[i].split('=')[0]
        let val=pi[i].split('=')[1]
        playlist[key]=val
    }
    return playlist
}

async function get_next_url_and_token(current_token, skip, callback) {
    let playlist = convert_token_to_dict(current_token)
    let next_playing = playlist['p']
    let next_token;
    next_playing += skip
    playlist['p'] = next_playing
    let next_key = 'v'+next_playing
    let next_id = playlist[next_key]
    await get_url_and_title(next_id, (url,title) => {
        console.log(url);
        if (url) {
            next_token = convert_object_to_token(playlist)
            return callback(url, next_token, title)
        }
    })
}

async function get_url_and_title(videoID, callback) {
    let info = await ytdl.getInfo(videoID, (err, info) => {
        if (err) {
            console.log(err)
            return callback('https://google.com','error getting info')
        }
        let title = info.title
        let format = ytdl.chooseFormat(info.formats, { quality: '140' });
        if (format) {
            let url = format.url;
            callback(url, title);
        }
    });
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest'
            || (getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
                && getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent');
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechText = requestAttributes.t('WELCOME');
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const SearchIntentHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && getIntentName(handlerInput.requestEnvelope) === 'SearchIntent';
    },
    handle(handlerInput) {
        const query = getSlotValue(handlerInput.requestEnvelope, 'query');
        console.log(query);
        return new Promise((resolve) => {
            youtubeSearch(query, (id, playlist) => {
                console.log(id);
                get_url_and_title(id,(url, title) => {
                    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
                    const speechText = requestAttributes.t('PLAYING', title);
                    const playBehavior = 'REPLACE_ALL';
                    const offset = 0;
                    const token = convert_object_to_token(playlist);
                    resolve(handlerInput.responseBuilder
                        .speak(speechText)
                        .addAudioPlayerPlayDirective(playBehavior,url,token,offset)
                        .getResponse()
                    );
                });
            });
        });
    }
};
const ResumeHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && getIntentName(handlerInput.requestEnvelope) === 'AMAZON.ResumeIntent';
    },
    handle(handlerInput) {
        let next_url;
        let next_token;
        let title;
        const token = handlerInput.requestEnvelope.context.AudioPlayer.token;
        if (!token) { return LaunchRequestHandler.handle(handlerInput) }
        const speechText = 'Resuming'
        const playBehavior = 'REPLACE_ALL';
        const offsetInMilliseconds = handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds
        return new Promise((resolve) => {
            get_next_url_and_token(token, 0, (next_url, next_token, title) => {
                resolve(handlerInput.responseBuilder
                .speak(speechText)
                .addAudioPlayerPlayDirective(playBehavior,next_url,next_token,offsetInMilliseconds)
                .getResponse())
            })
        })
    }
}
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent'
                || getIntentName(handlerInput.requestEnvelope) === 'AMAZON.PauseIntent');
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechText = requestAttributes.t('GOODBYE');
        return handlerInput.responseBuilder
            .speak(speechText)
            .addAudioPlayerStopDirective()
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        console.log(`~~~~ Error handled: ${error.message}`);
        const speechText = requestAttributes.t('DONT_UNDERSTAND');
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

exports.handler = SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SearchIntentHandler,
        CancelAndStopIntentHandler,
        ResumeHandler,
        SessionEndedRequestHandler)
	.addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(
        ErrorHandler)
    .lambda();

