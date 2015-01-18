var app = require('express')();
var http = require('http').Server(app);
// TODO: Consider forcing websocket as transport
var io = require('socket.io')(http);

var mongoose = require('mongoose');
var princeton = require('./server/princeton');
var conversation = require('./server/conversation');
var chatter = require('./server/chatter');

var port = process.env.PORT || 5000;
http.listen(port);

var mongoUrl;
if (app.settings.env == 'development') {
  mongoUrl = 'mongodb://localhost/test';
} else if (app.settings.env == 'production') {
  mongoUrl = process.env.MONGOHQ_URL;
}
mongoose.connect(mongoUrl);

var connectedUsers = {};

app.get('/count', function(req, res) {
  var count = Object.keys(connectedUsers).length;
  res.send(count.toString());
});

// Authorization
if (app.settings.env == 'production') {
  io.use(function(socket, next) {
    var handshakeData = socket.request;
    // TODO: Check that user is logged in
    // Check if already connected to server
    // TODO: Check for email rather than IP
    if (ipAddr in connectedUsers) {
      next(new Error('Sorry, you can only chat with one person at a time!'));
      return;
    }
    next();
  });
};

// Needed to get the client's IP on Heroku for socket.io
function getClientIP(handshakeData) {
  var forwardedIps = handshakeData.headers['x-forwarded-for'];
  if (forwardedIps) {
    return forwardedIps.split(', ')[0];
  } else {
    return handshakeData.address.address;
  }
}

function getValueFromCookie(name, cookie) {
  if (cookie) {
    var pairs = cookie.split('; ');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      if (pair[0] === name) {
        return pair[1];
      }
    }
  }
}

io.on('connection', function(socket) {
  // var userID = getValueFromCookie('userID', socket.handshake.headers.cookie);
  var userID = 1;
  if (userID) {
    // Add user to list of connected users
    var ipAddr = getClientIP(socket.handshake);
    connectedUsers[ipAddr] = true;
    socket.on('disconnect', function() {
      delete connectedUsers[ipAddr];
    });

    chatter.connectChatter(socket, userID);
  } else {
    socket.disconnect();
  }
});
