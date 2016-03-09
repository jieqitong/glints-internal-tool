'use strict';

const remote = require('electron').remote;
const fs = remote.require('fs');
const allowedRole = 'ADMIN';
const clientId = '';
const test = true;

let apiBase;
let timeoutID;
let token = null;

function firstLogin (country) {
  if (test) {
    apiBase = 'http://localhost:8080/';
  }
  else {
    if (country === 'SG') {
      apiBase = 'https://api.glints.com/';
    } else if (country === 'ID') {
      apiBase = 'http://api.glints.id/';
    }
  }
  login();
}

function session (functionName, needAlert) {
  window.clearTimeout(timeoutID);
  timeoutID = window.setTimeout(functionName, 300000);
  if (needAlert) {
    alert('You have 5 minutes before your session expired!');
  }
}

function logout () {
  token = null;
  document.body.innerHTML = fs.readFileSync(__dirname + '/views/relogin.html');
}

function login () {
  let params = [
    'grant_type=password',
    'client_id=' + clientId,
    'username=' + encodeURIComponent(document.getElementById('username').value),
    'password=' + encodeURIComponent(document.getElementById('password').value)
  ].join('&');

  let httpRequest = new XMLHttpRequest();
  httpRequest.responseType = 'json';
  httpRequest.open('POST', apiBase + 'oauth2/token', true);
  httpRequest.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  httpRequest.onload = function () {
    try {
      if (httpRequest.readyState === XMLHttpRequest.DONE) {
        if (httpRequest.status === 200) {
          token = httpRequest.response.token_type + ' ' + httpRequest.response.access_token;
          authorise();
        } else if (httpRequest.status === 401) {
          alert('Invalid username or password.');
        } else {
          alert('There was a problem with the login.');
        }
      }
    }
    catch( e ) {
      alert('Caught Exception: ' + e);
    }
  };
  httpRequest.send(params);
}

function authorise () {
  let httpRequest = new XMLHttpRequest();
  httpRequest.responseType = 'json';
  httpRequest.open('GET', apiBase + 'api/me?include=Roles', true);
  httpRequest.setRequestHeader('Authorization', token);
  httpRequest.onload = function () {
    try {
      if (httpRequest.readyState === XMLHttpRequest.DONE) {
        if (httpRequest.status === 200) {
          let roles = httpRequest.response.data.links.roles.map(x => x.name);
          if (roles.indexOf(allowedRole) === -1) {
            normalUser();
          } else {
            superUser();
          }
        } else {
          alert('There was a problem with the authorization.');
        }
      }
    }
    catch( e ) {
      alert('Caught Exception: ' + e);
    }
  };
  httpRequest.send();
}

function normalUser () {
  document.body.innerHTML = fs.readFileSync(__dirname + '/views/angry.html');
}

function superUser () {
  document.body.innerHTML = fs.readFileSync(__dirname + '/views/deleteSpamCompany.html');
  document.getElementById('deleteButton').setAttribute('onclick', 'deleteSpamCompany()');
  session(logout, true);
}

function deleteSpamCompany () {
  let question = 'Are you sure you want to delete?';
  document.getElementById('question').innerHTML = question;
  document.getElementById('companyId').setAttribute('disabled', 'disabled');
  document.getElementById('companyName').setAttribute('disabled', 'disabled');
  document.getElementById('deleteButton').innerHTML = 'Confirm';
  document.getElementById('deleteButton').setAttribute('onclick', 'validateCompany()');
  let cancelButton = document.createElement('BUTTON');
  let cancelText = document.createTextNode('No');
  cancelButton.setAttribute('class', 'buttonRed');
  cancelButton.setAttribute('type', 'button');
  cancelButton.setAttribute('onclick', 'superUser()');
  cancelButton.appendChild(cancelText);
  document.getElementById('form').appendChild(cancelButton);
}

function processing (msg) {
  document.getElementById('question').innerHTML = msg;
  let child = document.getElementById("form");
  if (child) {
    child.parentNode.removeChild(child);
  }
}

function validateCompany () {
  window.clearTimeout(timeoutID);
  let companyId = document.getElementById('companyId').value;
  let companyName = document.getElementById('companyName').value;

  processing('checking Company ID...');

  if (Number.isInteger(parseInt(companyId))) {
    checkCompany(companyId, companyName);
  } else {
    alert('Don\'t waste my time! Company ID must be number!');
    superUser();
  }
}

function checkCompany (id, name) {
  processing('matching Company ID and Name...');

  let includes = 'Jobs,Users';
  let httpRequest = new XMLHttpRequest();
  httpRequest.responseType = 'json';
  httpRequest.open('GET', apiBase + 'api/admin/companies/' + id + '?include=' + includes, true);
  httpRequest.setRequestHeader('Authorization', token);
  httpRequest.onload = function () {
    try {
      if (httpRequest.readyState === XMLHttpRequest.DONE) {
        if (httpRequest.status === 200) {
          if (httpRequest.response.data.name === name) {
            processCompanyDeletion(id, name, httpRequest.response.data.links);
          } else {
            alert('Company ID (' + id + ') and Name (' + name + ') does not match!');
            superUser();
          }
        } else if (httpRequest.status === 404) {
          alert('Company ' + id + ' does not exist!');
          superUser();
        } else {
          alert('There was a problem with the company verification.');
          superUser();
        }
      }
    }
    catch( e ) {
      alert('Caught Exception: ' + e);
    }
  };
  httpRequest.send();
}

function processCompanyDeletion (id, name, responses) {
  processing('checking company associations...');

  let jobs = responses.jobs.map(x => x.id);
  let users = responses.users.map(x => x.id);
  let where = encodeURIComponent(JSON.stringify({'CompanyId':id}));
  let httpRequest = new XMLHttpRequest();
  httpRequest.responseType = 'json';
  httpRequest.open('GET', apiBase + 'api/admin/jobDrafts?where=' + where, true);
  httpRequest.setRequestHeader('Authorization', token);
  httpRequest.onload = function () {
    try {
      if (httpRequest.readyState === XMLHttpRequest.DONE) {
        if (httpRequest.status === 200) {
          let jobDrafts = httpRequest.response.data.map(x => x.id);
          deleteCompany(id, name, jobDrafts, jobs, users);
        } else {
          alert('There was a problem with the company associations verification.');
          superUser();
        }
      }
    }
    catch( e ) {
      alert('Caught Exception: ' + e);
    }
  };
  httpRequest.send();
}

let request = function (url, options) {
  options = options || {};
  options.method = options.method || 'GET';

  return new Promise(function (resolve, reject) {
    let httpRequest = new XMLHttpRequest();
    httpRequest.responseType = 'json';
    httpRequest.open(options.method, url, true);
    httpRequest.setRequestHeader('Authorization', token);
    httpRequest.onload = function () {
      try {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
          resolve(httpRequest);
        }
      } catch (e) {
        reject(e);
      }
    };
    httpRequest.send();
  });
};

function deleteCompany (id, name, jobDrafts, jobs, users) {
  processing('deleting company and its associations...');

  let failedDeletion = [];
  let succeededDeletion = [];

  function check (all) {
    all.forEach(function (each) {
      if (each.status !== 204) {
        failedDeletion.push([
          each.status,
          each.statusText,
          each.responseURL,
          each.response.error.code,
          each.response.error.title
        ]);
      } else {
        let array = each.responseURL.split('/');
        let obj = array[array.length-2];
        let id = array[array.length-1];
        let string = obj + ': ' + id;
        succeededDeletion.push(string);
      }
    });
  }

  let deleteJobDrafts = jobDrafts.map(function (jobDraftId) {
    return request(apiBase + 'api/admin/jobDrafts/' + jobDraftId, {
      method: 'DELETE'
    });
  });

  Promise.all(deleteJobDrafts)
    .then(function (response) {
      check(response);

      let deleteJobs = jobs.map(function (jobId) {
        return request(apiBase + 'api/admin/jobs/' + jobId, {
          method: 'DELETE'
        });
      });
      return Promise.all(deleteJobs);
    })
    .then(function (response) {
      check(response);

      let deleteUsers = users.map(function (userId) {
        return request(apiBase + 'api/admin/users/' + userId, {
          method: 'DELETE'
        });
      });
      return Promise.all(deleteUsers);
    })
    .then(function (response) {
      check(response);

      let httpRequest = new XMLHttpRequest();
      httpRequest.responseType = 'json';
      httpRequest.open('DELETE', apiBase + 'api/admin/companies/' + id, true);
      httpRequest.setRequestHeader('Authorization', token);
      httpRequest.onload = function () {
        try {
          if (httpRequest.readyState === XMLHttpRequest.DONE) {
            if (httpRequest.status === 204) {
              succeededDeletion.push('companies: ' + name);
            } else {
              failedDeletion.push([
                httpRequest.status,
                httpRequest.statusText,
                httpRequest.responseURL,
                httpRequest.response.error.code,
                httpRequest.response.error.title
              ]);
            }
            clearBookmarks(succeededDeletion, failedDeletion);
          }
        }
        catch( e ) {
          alert('Caught Exception: ' + e);
        }
      };
      httpRequest.send();
    });
}

function clearBookmarks (success, fail) {
  processing('clearing bookmarks...');

  let where = encodeURIComponent(JSON.stringify({
    $or: {
      'UserId': null,
      $and: {
        'CompanyId': null,
        'JobId': null,
        'ResourceId': null
      }
    }
  }));
  let httpRequest = new XMLHttpRequest();
  httpRequest.responseType = 'json';
  httpRequest.open('GET', apiBase + 'api/admin/bookmarks?where=' + where, true);
  httpRequest.setRequestHeader('Authorization', token);
  httpRequest.onload = function () {
    try {
      if (httpRequest.readyState === XMLHttpRequest.DONE) {
        if (httpRequest.status === 200) {
          let deleteBookmarks = httpRequest.response.data.map(function (bookmark) {
            return request(apiBase + 'api/admin/bookmarks/' + bookmark.id, {
              method: 'DELETE'
            });
          });

          Promise.all(deleteBookmarks)
            .then(function (response) {
              response.forEach(function (each) {
                if (each.status !== 204) {
                  fail.push([
                    each.status,
                    each.statusText,
                    each.responseURL,
                    each.response.error.code,
                    each.response.error.title
                  ]);
                } else {
                  let array = each.responseURL.split('/');
                  let obj = array[array.length-2];
                  let id = array[array.length-1];
                  let string = obj + ': ' + id;
                  success.push(string);
                }
              });
              log(success, fail);
            });
        } else {
          fail.push([
            httpRequest.status,
            httpRequest.statusText,
            'GET ' + httpRequest.responseURL,
            httpRequest.response.error.code,
            httpRequest.response.error.title
          ]);
          log(success, fail);
        }
      }
    }
    catch( e ) {
      alert('Caught Exception: ' + e);
    }
  };
  httpRequest.send();
}

function log (success, fail) {
  document.getElementById('question').innerHTML = 'Successfully deleted:';
  let parentNode = document.getElementById('question').parentNode;
  success.forEach(function (each) {
    let element = document.createElement('h5');
    let text = document.createTextNode(each);
    element.appendChild(text);
    parentNode.appendChild(element);
  });

  if (fail.length !== 0) {
    let failedMsg = document.createElement('h1');
    let failedMsgText = document.createTextNode('(Please slack the product team the red text, Thanks.) Failed to delete the following: ');
    failedMsg.setAttribute('class', 'wordRed');
    failedMsg.appendChild(failedMsgText);
    parentNode.appendChild(failedMsg);

    fail.forEach(function (each) {
      let element = document.createElement('h5');
      let text = document.createTextNode(each.join(' ,'));
      element.setAttribute('class', 'wordRed');
      element.appendChild(text);
      parentNode.appendChild(element);
    });
  }

  let button = document.createElement('BUTTON');
  let buttonText = document.createTextNode('Back to Main Page');
  button.setAttribute('class', 'buttonRed');
  button.setAttribute('type', 'button');
  button.setAttribute('onclick', 'superUser()');
  button.appendChild(buttonText);
  parentNode.appendChild(button);
  session(function() {
    return button.setAttribute('onclick', 'logout()');
  }, false);
}