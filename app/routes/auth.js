var express = require("express");
var logger = require("../modules/logger");
var config = require("config"),
  cookie = require("cookie"),
  session = require("cookie-session");
var router = express.Router();

var CrowdClient = require("atlassian-crowd-client");
var crowd = new CrowdClient(config.crowdDirectory);

var reg_developer = new RegExp("^dev[0-9]{3}$");
var reg_viewonly = new RegExp("^view[0-9]{3}$");

router.get("/login", function(req, res, next) {
  res.render("login");
});

router.post("/login", function(req, res, next) {
  var username = req.body.username,
    password = req.body.password;

  if (username.match(reg_developer)) {
    var login = crowd.authentication.authenticate(username, password);
    login
      .then(function(value) {
        var session = crowd.session.create(username, password);
        session
          .then(function(value) {
            logger.info(username + " login.");
            res.cookie("crowd-session", value.token, {
              httpOnly: true,
              maxAge: new Date(value.expiresAt) - new Date(value.createdAt)
            });
            res.redirect("../home");
          })
          .catch(function(error) {
            logger.error("error:" + error);
            res.render("login", { error: error });
          });
      })
      .catch(function(error) {
        logger.error("error:" + error);
        res.render("login", { error: error });
      });
  } else {
    res.render("login", { error: "dev user login only" });
  }
});

module.exports = router;
