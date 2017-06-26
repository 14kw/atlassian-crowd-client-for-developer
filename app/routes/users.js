var express = require("express"),
  cookieParser = require("cookie-parser"),
  bodyParser = require("body-parser"),
  logger = require("../modules/logger"),
  usedLicenses = require("../modules/license"),
  config = require("config");
var router = express.Router();

var CrowdClient = require("atlassian-crowd-client");
var crowd = new CrowdClient(config.crowdDirectory);
var User = require("atlassian-crowd-client/lib/models/user");

var reg_admin = new RegExp("^admin[0-9]{3}$");
var reg_developer = new RegExp("^dev[0-9]{3}$");
var reg_viewonly = new RegExp("^view[0-9]{3}$");
var reg_permission_group = new RegExp(
  "^(crowd-users|crowd-administrators|jira-users|jira-developers|confluence-users|confluence-developers|confluence-administrators|stash-users|stash-developers|stash-administrators|dev-group|view-group)$"
);

// User Action
// ユーザー検索画面
router.get("/search", function(req, res, next) {
  res.render("users/search");
});

// ユーザー検索アクション
router.post("/search", function(req, res, next) {
  var query = "";
  if (req.body.active == "all") {
    query = "(name=*" + req.body.query + "* or email=*" + req.body.query + "*)";
  } else {
    query =
      "(name=*" +
      req.body.query +
      "* or email=*" +
      req.body.query +
      "*) and active=" +
      req.body.active;
  }
  var users = crowd.search.user(query, false, 0, 100);
  users
    .then(function(value) {
      res.render("users/search", {
        query: req.body.query,
        users: value
      });
    })
    .catch(function(error) {
      logger.error("error:" + error);
    });
});

// ユーザー詳細画面
router.get("/view/:username", usedLicenses, function(req, res, next) {
  var editperm,
    enable = true;
  if (req.params.username.match(reg_admin)) {
    editperm = false;
  }
  if (req.usedLicenses.crowd >= config.license.crowd) {
    enable = false;
  }
  var user = crowd.user.get(req.params.username);
  var grouplist = crowd.user.groups.list(req.params.username);
  var tasks = [user, grouplist];
  Promise.all(tasks)
    .then(function(value) {
      res.render("users/view", {
        user: value[0],
        grouplist: value[1],
        editperm: editperm,
        enable: enable
      });
    })
    .catch(function(error) {
      logger.error("error:" + error);
    });
});

// ユーザー追加画面
router.get("/add", usedLicenses, function(req, res, next) {
  if (req.query.error) {
    if (req.query.error == "samename") {
      errtext = "すでに同じusernameのユーザーがいます";
    } else if (req.query.error == "usernamevalidate") {
      errtext = "usernameのフォーマットが間違っています";
    } else if (req.query.error == "usercreate") {
      errtext = "ユーザーの作成に失敗しました";
    } else if (req.query.error == "crowdadd") {
      errtext = "初期権限の付与に失敗しました";
    } else {
      errtext = "";
    }
  } else {
    errtext = "";
  }

  if (req.usedLicenses.crowd >= config.license.crowd) {
    res.render("users/add", { limit: true });
  } else {
    res.render("users/add", {
      error: errtext,
      rest: config.license.crowd - req.usedLicenses.crowd
    });
  }
});

// ユーザー追加アクション
router.post("/create", usedLicenses, function(req, res, next) {
  // パスワードは入力させずに再発行フローより設定させる
  var lastname = req.body.lastname,
    firstname = req.body.firstname,
    email = req.body.email,
    username = req.body.username,
    password = "default-password";

  if (req.usedLicenses.crowd >= config.license.crowd) {
    res.redirect("add?error=limit");
  } else if (
    (username.match(reg_developer) || username.match(reg_viewonly)) &&
    !username.match(reg_admin)
  ) {
    var user = crowd.user.get(username);
    user.then(
      function(value) {
        res.redirect("add?error=samename");
      },
      function(reason) {
        var usercreate = crowd.user.create(
          new User(
            firstname,
            lastname,
            firstname + " " + lastname,
            email,
            username,
            password
          )
        );
        usercreate.then(
          function(value) {
            var tasks = [];
            if (username.match(reg_developer)) {
              tasks.push(crowd.group.users.add("developer-group", username));
            } else if (username.match(reg_viewonly)) {
              tasks.push(crowd.group.users.add("viewonly-group", username));
            }
            tasks.push(crowd.group.users.add("crowd-users", username));
            Promise.all(tasks).then(
              function(value) {
                res.redirect("view/" + username);
              },
              function(reason) {
                res.redirect("view/" + username + "?error=crowdadd");
              }
            );
          },
          function(reason) {
            res.redirect("add?error=usercreate");
          }
        );
      }
    );
  } else {
    res.redirect("add?error=usernamevalidate");
  }
});

// ユーザー情報更新画面
router.get("/edit/:username", function(req, res, next) {
  if (req.query.error) {
    errtext = "error: .";
  } else {
    errtext = "";
  }
  var user = crowd.user.get(req.params.username);
  user
    .then(function(value) {
      res.render("users/edit", { user: value });
    })
    .catch(function(error) {
      logger.error("error:" + error);
      res.redirect("../view/" + req.params.username);
    });
});

// ユーザー情報更新アクション
router.post("/update/:username", function(req, res, next) {
  var lastname = req.body.lastname,
    firstname = req.body.firstname,
    email = req.body.email,
    username = req.params.username,
    password = "default-password",
    active = req.body.active;

  if (username.match(reg_developer) || username.match(reg_viewonly)) {
    var userupdate = crowd.user.update(
      username,
      new User(
        firstname,
        lastname,
        firstname + " " + lastname,
        email,
        username,
        password,
        active
      )
    );
    userupdate.then(
      function(value) {
        res.redirect("../view/" + username);
      },
      function(reason) {
        logger.error(reason);
        res.redirect("../view/" + username + "?error=userupdate");
      }
    );
  } else {
    res.redirect("../view/" + username + "?error=usernamevalidate");
  }
});

// ユーザー無効化有効化ボタン
router.post("/active/:username", usedLicenses, function(req, res, next) {
  var username = req.params.username,
    active = req.body.active;
  if (req.usedLicenses.crowd >= config.license.crowd && active == true) {
    res.redirect("../view/" + username + "?error=limit");
  } else if (username.match(reg_viewonly)) {
    res.redirect("../view/" + username + "?error=notpermission");
  } else {
    var user = crowd.user.get(username);
    user.then(
      function(value) {
        // passwordの中身はundefinedだけど、そのまま送っても更新はされないので気にしない
        var userdisable = crowd.user.update(
          username,
          new User(
            value["firstname"],
            value["lastname"],
            value["displayname"],
            value["email"],
            value["username"],
            value["password"],
            active
          )
        );
        userdisable.then(
          function(value) {
            if (active == true) {
              res.redirect("../view/" + username);
            } else {
              var grouplist = crowd.user.groups.list(username);
              grouplist.then(
                function(value) {
                  var tasks = [];
                  value.forEach(function(groupname) {
                    if (groupname.match(/^(jira|confluence|stash)/)) {
                      tasks.push(crowd.user.groups.remove(username, groupname));
                    }
                  });
                  Promise.all(tasks).then(
                    function(value) {
                      res.redirect("../view/" + username);
                    },
                    function(reason) {
                      res.redirect(
                        "../view/" + username + "?error=usergroupremove"
                      );
                    }
                  );
                },
                function(reason) {
                  res.redirect("../view/" + username + "?error=usergrouplist");
                }
              );
            }
          },
          function(reason) {
            logger.error(reason);
            res.redirect("../view/" + username + "?error=userdisable");
          }
        );
      },
      function(reason) {
        logger.error(reason);
        res.redirect("../view/" + username + "?error=userget");
      }
    );
  }
});

module.exports = router;
