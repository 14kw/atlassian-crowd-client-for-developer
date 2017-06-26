# Atlassian Crowd Client for developer

## About

システム管理者でなくてもCrowdからユーザーやグループの管理ができるように、  
操作できる権限を制限したCrowd Web Clientです。

## Example

```
docker-compose build
docker-compose up
```

1. Go to localhost:8095
1. Atlassian Crowd Setup
1. Change Directory setting
    * name
        * crowd-internal
1. Create Applicatoin for Crowd Client
    * name
        * crowd-internal
    * password
        * crowdpass
    * remote-address
        * web
1. Create users
    * admin001, dev001, view001
1. Create default tool groups
    * jira-users, jira-developers, jira-administrators
    * confiluense-users, confluence-developers, confluence-administrators
    * stash-users, stash-developers, stash-administrators
1. Go to localhost:3000
1. dev001 user login

## To Do

* Access Control by login user
* ES6
* ESlint
* test