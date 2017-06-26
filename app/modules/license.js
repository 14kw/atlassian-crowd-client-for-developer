var config = require("config"),
  CrowdClient = require("atlassian-crowd-client");
var crowd = new CrowdClient(config.crowdDirectory);

// Userd license count
// Do not use jira/confluence/stash internal Directory
// Used crowd directory only
module.exports = function(req, res, next) {
  var tasks = [];
  tasks.push(crowd.search.user("active=true", false, 0, 10000));
  tasks.push(crowd.group.users.list("jira-users"));
  tasks.push(crowd.group.users.list("confluence-users"));
  tasks.push(crowd.group.users.list("stash-users"));

  Promise.all(tasks)
    .then(function([crowd_users, jira_users, conf_users, stash_users]) {
      if (typeof jira_users == "undefined") jira_users = [];
      if (typeof confluence_users == "undefined") confluence_users = [];
      if (typeof stash_users == "undefined") stash_users = [];
      used_license_crowd = crowd_users.length;
      used_license_jira = 0;
      used_license_conf = 0;
      used_license_stash = 0;
      crowd_users.forEach(function(name) {
        if (jira_users.indexOf(name) !== -1) {
          used_license_jira++;
        }
        if (conf_users.indexOf(name) !== -1) {
          used_license_conf++;
        }
        if (stash_users.indexOf(name) !== -1) {
          used_license_stash++;
        }
      });
      req.usedLicenses = {
        crowd: used_license_crowd,
        jira: used_license_jira,
        confluence: used_license_conf,
        stash: used_license_stash
      };
      next();
    })
    .catch(function(error) {
      console.log("error:" + error);
      next();
    });
};
