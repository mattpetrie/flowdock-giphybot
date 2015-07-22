var request = require('request');
var http = require('http');
var Session = require('flowdock').Session;

var session = new Session(process.env.FLOWDOCK_API_KEY);

// This is is just to keep Heroku from shutting down the app for not binding to a port
var keepAliveServer = new http.Server();
keepAliveServer.listen(process.env.PORT || 5000);

var PREFIX = '!giphy';
var GIPHY_REQ_STRING =
  'http://api.giphy.com/v1/gifs/random?api_key=' +
    process.env.GIPHY_API_KEY + '&tag=';

session.flows(function(err, flows) {
  var stream, flowIds, flowNames;

  if (err) console.error(err);

  flowIds = flows.map(function(flow) {
    return flow.id;
  });

  flowNames = flows.map(function(flow) {
    return flow.name;
  });

  stream = session.stream(flowIds);

  console.log('Giphybot initialize! Establishing connection to flows:', flowNames);

  return stream.on('message', function(message) {
    if (message.event === 'message') {
      processMessage(session, message);
    }
  });
});

function processMessage(session, message) {
  var content, query;
  content = message.content.split(' ');

  if (content[0] === PREFIX) {
    query = content.slice(1).join('+');
    request(GIPHY_REQ_STRING + query, respondWithGif(session, message));
  }
}

function respondWithGif(session, message) {
  return function(err, response, body) {
    if (err) {
      console.error(err);
      session.comment(message.flow, message.id, 'Oh noes! Something went wrong!');
    }

    var gif;
    if (!err & response.statusCode === 200) {
      gif = JSON.parse(body).data.image_original_url;

      if (!gif) {
        session.comment(message.flow, message.id, 'Sorry, no GIF has been found!');
      } else {
        session.comment(message.flow, message.id, gif);
      }
    }
  };
}
