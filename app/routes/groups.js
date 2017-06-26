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
var Group = require("atlassian-crowd-client/lib/models/group");

var reg_developer = new RegExp("^dev[0-9]{3}$");
var reg_viewonly = new RegExp("^view[0-9]{3}$");
var reg_permission_group = new RegExp(
  "^(crowd-users|crowd-administrators|jira-users|jira-developers|confluence-users|confluence-developers|confluence-administrators|stash-users|stash-developers|stash-administrators|dev-group|view-group)$"
);

// Group Actoin
// グループ検索画面
router.get("/search", function(req, res, next) {
  res.render("groups/search");
});

// グループ検索アクション
router.post("/search", function(req, res, next) {
  var query = "";
  if (req.body.active == "all") {
    query = "name=*" + req.body.query + "*";
  } else {
    query = "name=*" + req.body.query + "* and active=" + req.body.active;
  }
  var groups = crowd.search.group(query, false, 0, 100);
  groups
    .then(function(value) {
      res.render("groups/search", {
        query: req.body.query,
        active: req.body.active,
        groups: value
      });
    })
    .catch(function(error) {
      console.error("error:" + error);
    });
});

// グループ詳細画面
router.get("/view/:groupname", function(req, res, next) {
  var editperm = true;
  if (req.params.groupname.match(reg_permission_group)) {
    editperm = false;
  }
  var group = crowd.group.get(req.params.groupname);
  var userlist = crowd.group.users.list(req.params.groupname);
  var tasks = [group, userlist];
  Promise.all(tasks)
    .then(function(value) {
      res.render("groups/view", {
        group: value[0],
        userlist: value[1],
        editperm: editperm
      });
    })
    .catch(function(error) {
      logger.error("error:" + error);
    });
});

// グループ作成画面
router.get("/add", function(req, res, next) {
  if (req.query.error) {
    errtext = "error: same name exists.";
  } else {
    errtext = "";
  }
  res.render("groups/add", { error: errtext });
});

// グループ作成アクション
router.post("/create", function(req, res, next) {
  var groupname = "team-" + req.body.groupname.toLowerCase(),
    description = req.body.description;
  var group = crowd.group.get(groupname);

  group.then(
    function(value) {
      res.redirect("add?error=samename");
    },
    function(reason) {
      newgroup = crowd.group.create(new Group(groupname, description));
      newgroup.then(
        function(value2) {
          res.redirect("view/" + groupname);
        },
        function(reason2) {
          logger.log("group create error.");
          res.redirect("add?error=groupcreate");
        }
      );
    }
  );
});

// グループにユーザーを追加する画面
router.get("/useredit/:groupname", function(req, res, next) {
  var groupname = req.params.groupname;
  if (groupname.match(reg_permission_group)) {
    res.redirect("../view/" + groupname + "?error=notpermissoin");
  } else {
    var userlist = crowd.group.users.list(groupname);
    userlist
      .then(function(value) {
        res.render("groups/useredit", {
          groupname: groupname,
          userlist: value.toString().split(",")
        });
      })
      .catch(function(error) {
        logger.error("error:" + error);
        res.redirect("../view/" + groupname + "?error=notpermissoin");
      });
  }
});

// グループにユーザーを追加するアクション
router.post("/useradd/:groupname", function(req, res, next) {
  var groupname = req.params.groupname,
    addlist = req.body.addlist.replace(/\s+/g, "").toLowerCase().split(",");
  if (groupname.match(reg_permission_group)) {
    res.redirect("../view/" + groupname + "?error=notpermissoin");
  } else {
    var errorlog = [];

    addlist.forEach(function(username) {
      var useradd = crowd.group.users.add(groupname, username);
      useradd.then(function(value) {
        if (value) {
          errorlog.push(username);
        } else {
          console.log(value);
        }
      });
    });
    if (errorlog.length > 0) {
      var errparam = "?error=groupuseradd_" + errorlog.join("+");
      res.redirect("../useredit/" + groupname + errparam);
    }
    res.redirect("../view/" + groupname);
  }
});

// グループからユーザーを削除するアクション
router.post("/userdel/:groupname", function(req, res, next) {
  var groupname = req.params.groupname,
    dellist = req.body.dellist.replace(/\s+/g, "").toLowerCase().split(",");
  if (groupname.match(reg_permission_group)) {
    res.redirect("../view/" + groupname + "?error=notpermissoin");
  } else {
    var errorlog = [];

    dellist.forEach(function(username) {
      var userdel = crowd.group.users.remove(groupname, username);
      userdel.then(function(value) {
        if (userdel) {
          errorlog.push(username);
        } else {
          console.log(value);
        }
      });
    });
    if (errorlog.length > 0) {
      var errparam = "?error=groupuserdel_" + errorlog.join("+");
      res.redirect("../useredit/" + groupname + errparam);
    }
    res.redirect("../view/" + groupname);
  }
});

module.exports = router;
