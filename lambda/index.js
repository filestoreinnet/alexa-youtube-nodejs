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

// THINGS TO CONFIGURE FOR THE SKILL TO WORK
// Google Dev Key
let DEVELOPER_KEY = '';
try {
    DEVELOPER_KEY = require('./DEVELOPER_KEY.js');
} catch(e) {
    // Ignore if file not there
}

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
    //console.log(DEVELOPER_KEY);
    //getURLAndTitle(testVideoID,(url,title) => {
    //    console.log(title);
    //});
    youtubeSearch(testQuery, (id) => {
        console.log(id)
    });
}

async function youtubeSearch(query, callback) {
    const url='https://www.googleapis.com/youtube/v3/search?part=id&type=video&q='+query+'&key='+DEVELOPER_KEY;
    let id = await request(url, { json: true },  (err, res, body) => {
        if (err) {console.log(err)}
        callback(res.body.items[0].id.videoId);
    });
}

async function getURLAndTitle(videoID, callback) {
    let info = await ytdl.getInfo(videoID);
    let title = info.title
    let format = ytdl.chooseFormat(info.formats, { quality: '140' });
    if (format) {
        let url = format.url;
        callback(url, title);
    }
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
            youtubeSearch(query, (id) => {
                console.log(id);
                getURLAndTitle(id,(url, title) => {
                    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
                    const speechText= requestAttributes.t('PLAYING', title);
                    const playBehavior='REPLACE_ALL';
                    const token='a';
                    const offset=0;
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
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
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
        SessionEndedRequestHandler)
	.addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(
        ErrorHandler)
    .lambda();

