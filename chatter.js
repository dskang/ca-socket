var mongoose = require('mongoose');
var Conversation = mongoose.model('Conversation');
var ucb = require('./ucb');
var mailer = require('./mailer');

function User(socket, userID) {
  this.socket = socket;
  this.id = userID;
  this.partner = null;
  this.conversation = null;
  this.buttonClicked = false;
  this.messagesSent = 0;
  this.name = null;
  this.fbLink = null;

  var user = this;
  this.socket.on('disconnect', function() {
    if (!user.conversation) return;

    if (!user.conversation.endTime) {
      user.conversation.endTime = new Date();
      user.conversation.save();
      user.partner.socket.emit('finished');
      user.partner.socket.disconnect();
    }
  });

  this.socket.on('chat message', function(data) {
    if (!user.conversation) return;

    user.conversation.chatLog.push({
      date: new Date(),
      user: user.pseudonym,
      text: data.message
    });

    user.messagesSent++;
    user.socket.emit('chat message', {
      name: 'You',
      message: data.message
    });

    var userName = user.conversation.revealed ? user.name : 'Anonymous Tiger';
    user.partner.socket.emit('chat message', {
      name: userName,
      message: data.message
    });
  });

  this.socket.on('dropdown displayed', function(data) {
    if (!user.conversation) return;

    user.conversation.buttonDisplayed = true;
  });

  this.socket.on('identity', function(data) {
    if (!user.conversation) return;

    user.conversation.chatLog.push({
      date: new Date(),
      user: '',
      text: '*** ' + user.pseudonym + ' accepted dropdown ***'
    });

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
      user.conversation.revealed = true;

      user.conversation.chatLog.push({
        date: new Date(),
        user: '',
        text: '*** Facebook identities revealed ***'
      });
    }
  });

  this.socket.on('typing', function() {
    if (!user.conversation) return;

    user.partner.socket.emit('typing');
  });

  this.socket.on('not typing', function() {
    if (!user.conversation) return;

    user.partner.socket.emit('not typing');
  });
}

function ConversationWrapper() {
    this.user1 = null;
    this.user2 = null;
    this.startTime = new Date();
    this.endTime = null;
    this.question = null;
    this.buttonDisplayed = false;
    this.revealed = false;
    this.chatLog = [];

    var self = this;
    this.save = function() {
      new Conversation({
        userID1: self.user1.id,
        userID2: self.user2.id,
        question: self.question,
        startTime: self.startTime,
        endTime: self.endTime,
        buttonDisplayed: self.buttonDisplayed,
        user1Clicked: self.user1.buttonClicked,
        user2Clicked: self.user2.buttonClicked,
        user1MessagesSent: self.user1.messagesSent,
        user2MessagesSent: self.user2.messagesSent
      }).save();

      if (process.env.NODE_ENV === 'production') {
        mailer.sendMail(this);
      }
    };
}

var queue = new Array();
exports.connectChatter = function(socket, userID) {
  var user = new User(socket, userID);

  socket.emit('entrance');

  var removeFromQueue = function() {
    queue.splice(queue.indexOf(user), 1);
  };

  if (queue.length === 0) {
    queue.push(user);
    user.socket.emit('waiting');

    user.socket.on('disconnect', removeFromQueue);
  } else {
    var conversation = new ConversationWrapper();
    conversation.user1 = user;
    user.conversation = conversation;
    user.pseudonym = 'Black';

    var partner = queue.shift();
    partner.socket.removeListener('disconnect', removeFromQueue);
    user.partner = partner;
    partner.partner = user;
    conversation.user2 = partner;
    partner.conversation = conversation;
    partner.pseudonym = 'Origin';

    ucb.getQuestion(Conversation, user, partner, function(question) {
      user.conversation.question = question;
      user.socket.emit('matched', {
        question: question
      });
      partner.socket.emit('matched', {
        question: question
      });

      conversation.chatLog.push({
        date: new Date(),
        user: '',
        text: question
      });
    });
  }
};
