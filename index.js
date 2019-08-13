const Alexa = require('ask-sdk-core');
const ytdl = require('ytdl-core');
const testVideoID = '9bZkp7q19f0';

//For testing locally with node index.js
if (require.main === module) {
	getURLAndTitle(testVideoID,(url,title) => {
		console.log(title);
		console.log(url);
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
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest'
            || (handlerInput.requestEnvelope.request.type === 'IntentRequest'
                && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent');
    },
    handle(handlerInput) {
        const speechText = 'Hi there. What is your name?';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const SearchIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'SearchIntent';
    },
    handle(handlerInput) {
        return new Promise((resolve) => {
            getURLAndTitle(testVideoID,(url, title) => {
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
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
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

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SearchIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler)
    .addErrorHandlers(
        ErrorHandler)
    .lambda();

