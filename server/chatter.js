var mailer = require('./mailer');
var questions = require('./questions');

function User(socket) {
  this.socket = socket;
  this.revealed = null;
  this.partner = null;
  this.buttonClicked = false;
  this.messagesSent = 0;
  this.name = null;
  this.fbLink = null;
  var user = this;

  // When one chatter disconnects, notify the partner and disconnect them
  this.socket.on('disconnect', function() {
    if (!user.partner) return;

    user.partner.socket.emit('finished');
    user.partner.socket.disconnect();
  });

  // When a chat message is sent, display the chat message to both partners
  this.socket.on('chat message', function(data) {
    if (!user.partner) return;

    var userName = user.revealed ? user.name : 'Anonymous Tiger';

    user.socket.emit('chat message', {
      name: 'You',
      message: data.message
    });
    user.partner.socket.emit('chat message', {
      name: userName,
      message: data.message
    });
  });

  // When the chatter opts to de-anonymize, show names if both partners have clicked
  this.socket.on('identity', function(data) {
    if (!user.partner) return;

    user.name = data.name;
    user.fbLink = data.link;
    user.buttonClicked = true;

    if (user.partner.buttonClicked) {
      user.socket.emit('reveal', {
        name: user.partner.name,
        link: user.partner.fbLink
      });
      user.partner.socket.emit('reveal', {
        name: user.name,
        link: user.fbLink
      });
      user.revealed = true;
    }
  });

  // When the chatter is typing, notify the partner
  this.socket.on('typing', function() {
    if (!user.partner) return;
    user.partner.socket.emit('typing');
  });

  // When the chatter is not typing, notify the partner
  this.socket.on('not typing', function() {
    if (!user.partner) return;
    user.partner.socket.emit('not typing');
  });
}

var queue = new Array();
exports.connectChatter = function(socket) {

  // On connection, create a new user and notify them of entrance/waiting
  var user = new User(socket);
  user.socket.emit('entrance');
  user.socket.emit('waiting');

  // If there are no other waiting users, add the user to a queue
  if (queue.length === 0) {
    queue.push(user);

    // TODO: remove listener instead of checking index
    user.socket.on('disconnect', function() {
      var index = queue.indexOf(user);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });

  // If there is another user, pair the two users and display each of them a question
  } else {
    var partner = queue.shift();
    user.partner = partner;
    partner.partner = user;

    question = questions.getRandomQuestion()
    user.socket.emit('matched', {
      question: question
    });
    partner.socket.emit('matched', {
      question: question
    });
  }
};
