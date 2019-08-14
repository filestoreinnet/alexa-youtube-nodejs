const {
    SkillBuilders,
    getRequestType,
    getIntentName,
    getSlotValue,
    getDialogState,
} = require('ask-sdk-core');
const ytdl = require('ytdl-core');
const request = require('request');


// Insert Google dev key here, or in a file called DEVELOPER_KEY.js
let DEVELOPER_KEY = '';
try {
    DEVELOPER_KEY = require('./DEVELOPER_KEY.js');
} catch(e) {
    // Ignore if file not there
}

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
        const speechText = 'Welcome to YouTube. What video would you like to play?';
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
                    const speechText='Playing '+title;
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
        const speechText = 'Goodbye!';
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
        console.log(`~~~~ Error handled: ${error.message}`);
        const speechText = `Sorry, I couldn't understand what you said. Please try again.`;
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
    .addErrorHandlers(
        ErrorHandler)
    .lambda();

