var questions = require('./questions');
var utils = require('./utils');

function User(socket, email) {
  this.socket = socket;
  this.email = email;
  this.school = utils.getSchool(email);
  this.revealed = false;
  this.partner = null;
  this.buttonClicked = false;
  this.name = null;
  this.fbLink = null;
  var user = this;

  this.socket.on('disconnect', function() {
    if (!user.partner) return;

    user.partner.socket.emit('finished');
    user.partner.socket.disconnect();
  });

  this.socket.on('chat message', function(data) {
    if (!user.partner) return;

    var userName = user.revealed ? user.name : 'Anonymous Ivy';

    user.socket.emit('chat message', {
      name: 'You',
      message: data.message
    });
    user.partner.socket.emit('chat message', {
      name: userName,
      message: data.message
    });
  });

  this.socket.on('identity', function(data) {
    if (!user.partner) return;

    user.name = data.name;
    user.fbLink = data.link;
    user.buttonClicked = true;

    if (user.partner.buttonClicked) {
      user.socket.emit('reveal', {
        name: user.partner.name,
        link: user.partner.fbLink,
        email: user.partner.email
      });
      user.partner.socket.emit('reveal', {
        name: user.name,
        link: user.fbLink,
        email: user.email
      });
      user.revealed = true;
    }
  });

  this.socket.on('typing', function() {
    if (!user.partner) return;
    user.partner.socket.emit('typing');
  });

  this.socket.on('not typing', function() {
    if (!user.partner) return;
    user.partner.socket.emit('not typing');
  });
}

var queue = new Array();
exports.connectChatter = function(socket, email) {

  var user = new User(socket, email);
  user.socket.emit('entrance', {
    email: user.email
  });
  user.socket.emit('waiting');

  if (queue.length === 0) {
    queue.push(user);

    // TODO: remove listener instead of checking index
    user.socket.on('disconnect', function() {
      var index = queue.indexOf(user);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });

  } else {
    var partner = queue.shift();
    user.partner = partner;
    partner.partner = user;

    question = questions.getRandomQuestion();
    user.socket.emit('matched', {
      question: question,
      partnerSchool: user.partner.school
    });
    partner.socket.emit('matched', {
      question: question,
      partnerSchool: user.partner.school
    });
  }
};
