var crypto = require('crypto');

// constant-time comparison algorithm to prevent timing attacks
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

function InvalidSignatureException() {
  this.toString = function() {
    return 'cookie has invalid signature';
  };
};

module.exports = function(secretKeyBase, options) {
  // set up options
  options = (typeof options === 'undefined') ? {} : options;

  defaults = {
    salt: 'encrypted cookie',
    signed_salt: 'signed encrypted cookie',
    iterations: 1000,
    key_size: 64,
    cipher: 'aes-256-cbc'
  };

  for (var prop in defaults) {
    if (!options.hasOwnProperty(prop)) {
      options[prop] = defaults[prop];
    }
  }

  // generate keys
  var secret = crypto.pbkdf2Sync(secretKeyBase, options.salt, options.iterations, options.key_size / 2); // aes-256-cbc requires a 256 bit (32 byte) key
  var signSecret = crypto.pbkdf2Sync(secretKeyBase, options.signed_salt, options.iterations, options.key_size);

  var verify = function(message, expectedDigest) {
    var hmac = crypto.createHmac('sha1', signSecret);
    hmac.update(message);
    var actualDigest = hmac.digest('hex');

    if (!secureCompare(expectedDigest, actualDigest)) {
      throw new InvalidSignatureException();
    }
  };

  var decrypt = function(encryptedMessage) {
    var message = new Buffer(encryptedMessage, 'base64').toString();
    var parts = message.split('--').map(function(part) {
      return new Buffer(part, 'base64');
    });
    var encryptedData = parts[0];
    var iv = parts[1];

    var cipher = crypto.createDecipheriv(options.cipher, secret, iv);
    var decryptedData = cipher.update(encryptedData, null, 'utf-8') + cipher.final('utf-8');

    return JSON.parse(decryptedData);
  };

  return function(cookie) {
    var parts = cookie.split('--');
    var message = parts[0];
    var digest = parts[1];

    verify(message, digest);
    return decrypt(message);
  }
};
