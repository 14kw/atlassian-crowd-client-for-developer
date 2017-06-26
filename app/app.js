var express = require("express"),
  path = require("path"),
  logger = require("./modules/logger"),
  cookieParser = require("cookie-parser"),
  bodyParser = require("body-parser"),
  ensureAuthenticated = require("./modules/auth");
var index = require("./routes/index");
var auth = require("./routes/auth");
var users = require("./routes/users");
var groups = require("./routes/groups");
var perms = require("./routes/perms");

var app = express();

// configure Express
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/static", express.static(path.join(__dirname, "public")));

app.use("/auth", auth);
app.use("/", ensureAuthenticated, index);
app.use("/users", ensureAuthenticated, users);
app.use("/groups", ensureAuthenticated, groups);
app.use("/perms", ensureAuthenticated, perms);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});
// error handlers

/*
app.listen(3000, function() {
  console.log("listening start.");
});
*/

module.exports = app;
