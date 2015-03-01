exports.getSchool = function(email) {
  var emailRegex = /[\w+\-.]+@(?:.+\.)*(.+)\.edu/i;
  var match = emailRegex.exec(email);
  if (match) {
    return match[1];
  } else {
    return null;
  }
};
