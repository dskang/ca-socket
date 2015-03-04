var utils = require('./utils');
var redis = require('./redis');

function User(socket, email) {
  this.socket = socket;
  this.email = email;
  this.school = utils.getSchool(email);
  this.partner = null;
  this.partnerEmail = null;
  this.buttonClicked = false;
  this.name = null;
  this.fbLink = null;

  this.setPartner = function(partner) {
    this.partner = partner;
    this.partnerEmail = partner.email;
    redis.hset(this.email, 'partnerEmail', partner.email);
  }

  this.restore = function(savedUser) {
    for (var attr in savedUser) {
      this[attr] = savedUser[attr];
    }
  }

  var user = this;
  this.socket.on('disconnect', function() {
    redis.del(user.email);

    if (!user.partner) return;
    user.partner.socket.emit('finished');
    user.partner.socket.disconnect();
  });

  this.socket.on('chat message', function(data) {
    if (!user.partner) return;

    user.socket.emit('chat message', {
      self: true,
      message: data.message
    });
    user.partner.socket.emit('chat message', {
      self: false,
      message: data.message
    });
  });

  this.socket.on('identity', function(data) {
    if (!user.partner) return;

    user.name = data.name;
    user.fbLink = data.link;
    user.buttonClicked = true;
    redis.hmset(user.email,
      'name', user.name,
      'fbLink', user.fbLink,
      'buttonClicked', user.buttonClicked
    );

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

module.exports = User;
