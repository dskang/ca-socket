var questions = require('./questions');
var redis = require('./redis');

var queue = new Array();
var newSession = function(user) {
  user.socket.emit('entrance', {
    email: user.email
  });
  user.socket.emit('waiting');

  var removeFromQueue = function() {
    var index = queue.indexOf(user);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  if (queue.length === 0) {
    queue.push(user);
    // TODO: Remove listener when user is connected to partner
    user.socket.on('disconnect', removeFromQueue);
  } else {
    var partner = queue.shift();
    user.setPartner(partner);
    partner.setPartner(user);

    question = questions.getRandomQuestion();
    user.socket.emit('matched', {
      question: question,
      partnerSchool: partner.school
    });
    partner.socket.emit('matched', {
      question: question,
      partnerSchool: user.school
    });
  }
};

var reconnectedUsers = {};
var resumeSession = function(user) {
  redis.exists(user.email, function(err, res) {
    if (res === 1) {
      redis.hgetall(user.email, function(err, savedUser) {
        user.restore(savedUser);
        if (user.partnerEmail in reconnectedUsers) {
          var partner = reconnectedUsers[user.partnerEmail];
          delete reconnectedUsers[user.partnerEmail];
          user.setPartner(partner);
          partner.setPartner(user);
          clearTimeout(partner.timeoutID);
        } else {
          reconnectedUsers[user.email] = user;
          // Disconnect user if their partner doesn't appear
          user.timeoutID = setTimeout(function() {
            user.socket.emit('finished');
            user.socket.disconnect();
          }, 5000);
        }
      });
    } else {
      newSession(user);
    }
  });
};

module.exports = {
  newSession: newSession,
  resumeSession: resumeSession
};
