var app = require('express')();
var http = require('http').Server(app);
// TODO: Consider forcing websocket as transport
var io = require('socket.io')(http);

var mongoose = require('mongoose');
var princeton = require('./server/princeton');
var conversation = require('./server/conversation');
var chatter = require('./server/chatter');
var config = require('./config');

// Set up session decoder
var sessionDecoder = require('./server/cookies-rails');
var secretKeyBase = config.secretKeyBase[app.settings.env];
var decoder = sessionDecoder(secretKeyBase)

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
io.use(function(socket, next) {
  var email;
  try {
    email = getUserEmail(socket.request.headers.cookie);
  } catch (e) {
    next(e);
    return;
  }

  // Check that user is logged in
  if (!email) {
    next(new Error('Please sign in.'));
    return;
  }
  // Check if already connected to server
  if (email in connectedUsers) {
    next(new Error('You can chat with only one person at a time.'));
    return;
  }
  next();
});

function getUserEmail(cookie) {
  var session = getValueFromCookie(config.sessionKey, cookie);
  var userData = decoder(session);
  return userData['email'];
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
  var email = getUserEmail(socket.handshake.headers.cookie);
  connectedUsers[email] = true;
  socket.on('disconnect', function() {
    delete connectedUsers[email];
  });
  chatter.connectChatter(socket, email);
});
