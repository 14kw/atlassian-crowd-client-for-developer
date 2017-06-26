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

var reg_developer = new RegExp("^dev[0-9]{3}$");
var reg_viewonly = new RegExp("^view[0-9]{3}$");
var reg_permission_group = new RegExp(
  "^(crowd-users|crowd-administrators|jira-users|jira-developers|confluence-users|confluence-developers|confluence-administrators|stash-users|stash-developers|stash-administrators|dev-group|view-group)$"
);

// 各ツールの権限状況を確認するページ
router.get("/view", function(req, res, next) {
  var tasks = [];
  tasks.push(crowd.search.user("active=true", false, 0, 10000));
  tasks.push(crowd.group.users.list("jira-users"));
  tasks.push(crowd.group.users.list("confluence-users"));
  tasks.push(crowd.group.users.list("stash-users"));
  tasks.push(crowd.search.user("", true, 0, 10000));

  Promise.all(tasks)
    .then(function(
      [crowd_users, jira_users, confluence_users, stash_users, all_users]
    ) {
      if (typeof jira_users == "undefined") jira_users = [];
      if (typeof confluence_users == "undefined") confluence_users = [];
      if (typeof stash_users == "undefined") stash_users = [];
      res.setHeader("Cache-Control", "no-cache");
      res.render("perms/view", {
        crowd: crowd_users,
        jira: jira_users,
        confluence: confluence_users,
        stash: stash_users,
        all: all_users
      });
    })
    .catch(function(error) {
      logger.error("error:" + error);
    });
});

// 各ツールの利用権限を追加する画面
router.get("/edit", usedLicenses, function(req, res, next) {
  if (req.query.error) {
    errtext = "error: " + req.query.error;
  } else {
    errtext = "";
  }

  res.render("perms/edit", {
    error: errtext,
    limit: req.query.limit,
    jira_rest: config.license.jira - req.usedLicenses.jira,
    conf_rest: config.license.confluence - req.usedLicenses.confluence,
    stash_rest: config.license.stash - req.usedLicenses.stash
  });
});

// 利用権限を追加するアクション
router.post("/add", function(req, res, next) {
  var jira = req.body.jiraadd ? true : false,
    confluence = req.body.confluenceadd ? true : false,
    stash = req.body.stashadd ? true : false,
    addlist = req.body.addlist.replace(/\s+/g, "").toLowerCase().split(",");

  // 権限追加ユーザー分でLicense上限に達しないかチェック
  // 無効化されているユーザーに権限を付けたら自動的に有効化する
  var acount = 0,
    jcount = 0,
    ccount = 0,
    scount = 0;
  var tasks = [];
  tasks.push(crowd.search.user("active=true", false, 0, 10000));
  tasks.push(crowd.group.users.list("jira-users"));
  tasks.push(crowd.group.users.list("confluence-users"));
  tasks.push(crowd.group.users.list("stash-users"));

  Promise.all(tasks)
    .then(function([crowd_users, jira_users, confluence_users, stash_users]) {
      // 権限追加ユーザーの中で権限を本当に持っていない数をカウント
      if (typeof jira_users == "undefined") jira_users = [];
      if (typeof confluence_users == "undefined") confluence_users = [];
      if (typeof stash_users == "undefined") stash_users = [];
      addlist.forEach(function(name) {
        if (
          typeof crowd_users == "undefined" ||
          crowd_users[0].indexOf(name) == -1
        )
          acount++;
        if (jira && jira_users.indexOf(name) == -1) jcount++;
        if (confluence && confluence_users.indexOf(name) == -1) ccount++;
        if (stash && stash_users.indexOf(name) == -1) scount++;
      });
      var errorlog = [];
      if (crowd_users[0].length + acount > config.license.crowd) {
        errorlog.push("crowd");
      } else if (jira_users.length + jcount > config.license.jira) {
        errorlog.push("jira");
      } else if (confluence_users.length + ccount > config.license.confluence) {
        errorlog.push("confluence");
      } else if (stash_users.length + scount > config.license.stash) {
        errorlog.push("stash");
      }
      if (errorlog.length > 0) {
        res.redirect("view?limit=" + errorlog.join("+"));
      } else {
        // License上限チェックに引っかからなかったら追加処理
        var errorlog2 = [];
        addlist.forEach(function(username) {
          crowd.user
            .get(username)
            .then(function(value) {
              var tasks = [];
              if (jira) {
                tasks.push(crowd.group.users.add("jira-users", username));
                tasks.push(crowd.group.users.add("jira-developers", username));
              }
              if (confluence) {
                tasks.push(crowd.group.users.add("confluence-users", username));
                tasks.push(
                  crowd.group.users.add("confluence-developers", username)
                );
              }
              if (stash) {
                tasks.push(crowd.group.users.add("stash-users", username));
                tasks.push(crowd.group.users.add("stash-developers", username));
              }
              if (tasks.length > 0) {
                tasks.push(
                  crowd.user.update(
                    username,
                    new User(
                      value["firstname"],
                      value["lastname"],
                      value["displayname"],
                      value["email"],
                      value["username"],
                      value["password"],
                      true
                    )
                  )
                );
                Promise.all(tasks).then(
                  function(value) {
                    console.log(
                      "post /perms/add jira(" +
                        jira +
                        ") conf(" +
                        confluence +
                        ") stash(" +
                        stash +
                        ") " +
                        username
                    );
                  },
                  function(reason) {
                    errorlog.push(username);
                  }
                );
              }
            })
            .catch(function(error) {
              console.log("user not exist");
              errorlog.push(username);
            });
        });
        if (errorlog.length > 0) {
          var errparam = "?error=permadd_" + errorlog.join("+");
          res.redirect("edit" + errparam);
        } else {
          res.redirect("view?success=permadd");
        }
      }
    })
    .catch(function(error) {
      logger.error("error:" + error);
    });
});

// 利用権限を削除するアクション
router.post("/del", function(req, res, next) {
  // Subversionはactiveになっていれば使えるのでpermは設けない
  var jira = req.body.jiradel ? true : false,
    confluence = req.body.confluencedel ? true : false,
    stash = req.body.stashdel ? true : false,
    dellist = req.body.dellist.replace(/\s+/g, "").toLowerCase().split(",");
  var errorlog = [];

  dellist.forEach(function(username) {
    var user = crowd.user.get(username);
    user
      .then(function(value) {
        var tasks = [];
        if (jira) {
          console.log("jira-u&d");
          tasks.push(crowd.group.users.remove("jira-users", username));
          tasks.push(crowd.group.users.remove("jira-developers", username));
        }
        if (confluence) {
          console.log("conf-u&d");
          tasks.push(crowd.group.users.remove("confluence-users", username));
          tasks.push(
            crowd.group.users.remove("confluence-developers", username)
          );
        }
        if (stash) {
          console.log("stash-u&g");
          tasks.push(crowd.group.users.remove("stash-users", username));
          tasks.push(crowd.group.users.remove("stash-developers", username));
        }
        if (tasks.length > 0) {
          Promise.all(tasks).then(function(value) {
            if (value) {
              console.log(
                "post /perms/del jira(" +
                  jira +
                  ") conf(" +
                  confluence +
                  ") stash(" +
                  stash +
                  ") " +
                  username
              );
            } else {
              errorlog.push(username);
            }
          });
        }
      })
      .catch(function(error) {
        console.log("user not exist");
        errorlog.push(username);
      });
  });
  if (errorlog.length > 0) {
    var errparam = "?error=permdel_" + errorlog.join("+");
    res.redirect("edit" + errparam);
  } else {
    res.redirect("view?success=permdel");
  }
});

module.exports = router;
