var config = require("config"),
  cookie = require("cookie"),
  CrowdClient = require("atlassian-crowd-client");
var crowd = new CrowdClient(config.crowdDirectory);

module.exports = function(req, res, next) {
  var token = cookie.parse(req.headers.cookie || "")["crowd-session"];
  if (typeof token !== "undefined") {
    var validate = crowd.session.validate(token);
    validate
      .then(function(value) {
        next();
      })
      .catch(function(error) {
        console.log("validate error : " + error);
        res.redirect("/auth/login");
      });
  } else {
    console.log("session undefined");
    res.redirect("/auth/login");
  }
};
