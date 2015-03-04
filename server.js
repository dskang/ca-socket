var app = require('express')();
var http = require('http').Server(app);
var auth = require('basic-auth');
var io = require('socket.io')(http, {
  transports: ['websocket']
});

var User = require('./server/user');
var chat = require('./server/chat');
var config = require('./config');

// Set up session decoder
var sessionDecoder = require('./server/cookies-rails');
var secretKeyBase = config.secretKeyBase[app.settings.env];
var decoder = sessionDecoder(secretKeyBase)

var port = process.env.PORT || 5000;
http.listen(port);

var connectedUsers = {};

app.get('/count', function(req, res) {
  var user = auth(req);
  if (!user || user.name !== 'admin' || user.pass !== 'originblack') {
    res.set('WWW-Authenticate', 'Basic realm="Campus Anonymous"');
    res.status(401).end();
  } else {
    var count = Object.keys(connectedUsers).length;
    res.send(count.toString());
  }
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
    next(new Error('signInError'));
    return;
  }
  // Check if already connected to server
  if (email in connectedUsers) {
    next(new Error('multipleSessionsError'));
    return;
  }
  next();
});

function getRandomEmail() {
  var randomString = Math.random().toString(36).substr(2, 5);
  return randomString + '@example.edu';
}

function getUserEmail(cookie) {
  if (app.settings.env === 'staging') {
    return getRandomEmail();
  }
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

  var user = new User(socket, email);
  socket.on('new session', function() {
    chat.newSession(user);
  });
  socket.on('resume session', function() {
    chat.resumeSession(user);
  });
});
