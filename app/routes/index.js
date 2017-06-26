var express = require("express"),
  cookie = require("cookie");
var router = express.Router();

router.get("/", function(req, res, next) {
  res.redirect("home");
});

router.get("/home", function(req, res, next) {
  res.render("home");
});

module.exports = router;
