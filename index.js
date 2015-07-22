var request = require('request');
var http = require('http');
var Session = require('flowdock').Session;
var _ = require('lodash');

var session = new Session(process.env.FLOWDOCK_API_KEY);

// This is is just to keep Heroku from shutting down the app for not binding to a port
var keepAliveServer = new http.Server();
keepAliveServer.listen(process.env.PORT || 5000);

var PREFIX = '!giphy';
var GIPHY_REQ_STRING =
  'http://api.giphy.com/v1/gifs/random?api_key=' +
    process.env.GIPHY_API_KEY + '&tag=';

session.flows(function(err, flows) {
  var stream;
  var flowIds = [];
  var flowNames = [];

  if (err) console.error(err);

  _.forEach(flows, function(flow) {
    flowIds.push(flow.id);
    flowNames.push(flow.name);
  });

  stream = session.stream(flowIds);

  console.log('Giphybot initialize! Establishing connection to flows:', flowNames);

  return stream.on('message', function(message) {
    if (message.event === 'message') {
      processMessage(session, message, flows);
    }
  });
});

function processMessage(session, message, flows) {
  var content, currentFlow, query;

  currentFlow = findCurrentFlow(message, flows);

  content = message.content.split(' ');

  if (content[0] === PREFIX) {
    query = content.slice(1).join('+');
    request(GIPHY_REQ_STRING + query, respondWithGif(session, message, currentFlow));
  }
}

function respondWithGif(session, message, currentFlow) {
  return function(err, response, body) {
    if (err) {
      console.error(err);
      postComment(session, message, currentFlow, 'Oh noes! Something went wrong');
    }

    var gif;
    if (!err & response.statusCode === 200) {
      gif = JSON.parse(body).data.image_original_url;

      if (!gif) {
        postComment(session, message, currentFlow, 'Sorry, no GIF has been found!');
      } else {
        postComment(session, message, currentFlow, gif);
      }
    }
  };
}

function postComment(session, message, currentFlow, commentBody) {
  var path = '/flows/' + currentFlow.organization.parameterized_name +
    '/' + currentFlow.parameterized_name + '/messages/' + message.id +
    '/comments';

  var flowAPIToken = currentFlow.api_token;

  var comment = {
    flow_token: flowAPIToken,
    event: 'comment',
    content: commentBody,
    tags: ['giphybot'],
    external_user_name: 'giphybot'
  };

  session.post(path, comment, function(err) {
      if (err) console.error(err);
    }
  );
}

function findCurrentFlow(message, flows) {
  return _.find(flows, function(flow) {
    return flow.id === message.flow;
  });
}
