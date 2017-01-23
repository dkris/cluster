var cluster = {};

function Server(serverId) {
  this.serverId = serverId;
}

function App(appId, appName) {
  this.appId = appId;
  this.appName = appName;
}

(function() {
  let serverId = 0;
  let appId = 0;
  let servers = [];
  let SERVER_STATUS = new Map();
  const IS_IN_NEW_SERVER_QUEUE = 'IS_IN_NEW_SERVER_QUEUE';
  const IS_IN_AVAIL_SERVER_QUEUE = 'IS_IN_AVAIL_SERVER_QUEUE';
  const IS_IN_LOCKED_SERVER_QUEUE = 'IS_IN_LOCKED_SERVER_QUEUE';

  //* Queue to hold servers that are newly created.
  //* Will contain any new apps that are created
  let NEW_SERVERS = new CustomQueue();
  // * CustomQueue to hold servers that have 1 app running.
  // * When all the servers contain 1 app each, servers in this CustomQueue are used
  let AVAIL_SERVERS = new CustomQueue();
  // * CustomQueue to hold servers that contain 2 apps.
  // * No more apps can be 
  let LOCKED_SERVERS = new CustomQueue();

  //app specific queues
  let Hadoop_Stack = [];
  let Rails_Stack = [];
  let Chronos_Stack = [];
  let Storm_Stack = [];
  let Spark_Stack = [];

  var purgeServer = (serverId, serverLocation) => {
    var serverRow = document.getElementById('server-row');
    var serverToPurge = document.getElementById(serverId);
    serverRow.removeChild(serverToPurge);
    SERVER_STATUS.delete(serverId);
    switch (serverLocation) {
      case 'IS_IN_NEW_SERVER_QUEUE':
        NEW_SERVERS.removeOutOfTurn(serverId);
        break;
      case 'IS_IN_AVAIL_SERVER_QUEUE':
        AVAIL_SERVERS.removeOutOfTurn(serverId);
        break;
      case 'IS_IN_LOCKED_SERVER_QUEUE':
        LOCKED_SERVERS.removeOutOfTurn(serverId);
        break;
    }
  }

  function strMapToObj(strMap) {
    let obj = {};
    let servers = {}
    servers['servers'] = [];
    strMap.forEach((value, key, map) => {
      let serverInfo = {
        'servername': key,
        'apps': value
      };
      servers['servers'].push(serverInfo);
    });
    return servers;
  }

  function addAppToStack(app) {
    switch (app.appName) {
      case 'Hadoop':
        Hadoop_Stack.push(app);
        break;
      case 'Rails':
        Rails_Stack.push(app);
        break;
      case 'Chronos':
        Chronos_Stack.push(app);
        break;
      case 'Spark':
        Spark_Stack.push(app);
        break;
      case 'Storm':
        Storm_Stack.push(app);
        break;
    }
  }

  function removeAppFromAppStack(appName) {
    let app;
    switch (appName) {
      case 'Hadoop':
        app = Hadoop_Stack.pop();
        break;
      case 'Rails':
        app = Rails_Stack.pop();
        break;
      case 'Chronos':
        app = Chronos_Stack.pop();
        break;
      case 'Spark':
        app = Spark_Stack.pop();
        break;
      case 'Storm':
        app = Storm_Stack.pop();
        break;
    }
    if (app) {
      return app;
    }
  }

  this.nextServerId = function() {
    return 'server' + serverId++;
  };
  this.nextAppId = function() {
    return 'app' + appId++;
  };

  this.initCluster = function() {
    for (let i = 0; i < 4; i++) {
      let serverId = this.nextServerId();
      let server = new Server(serverId);
      SERVER_STATUS.set(serverId, []);
      NEW_SERVERS.enqueue(serverId);
    }
    var servers = strMapToObj(SERVER_STATUS);
    var serverInfoTemplate = document.getElementById('server-info-template').innerHTML;
    var compiledTemplate = Handlebars.compile(serverInfoTemplate);
    var serverData = compiledTemplate(servers);
    document.getElementById('server-row').innerHTML = serverData;
  }
  this.addServer = function() {
    let serverId = this.nextServerId();
    let server = new Server(serverId);
    SERVER_STATUS.set(serverId, []);
    NEW_SERVERS.enqueue(serverId);
    var servers = {
      'servername': serverId,
      'apps': []
    };
    var serverInfoTemplate = document.getElementById('new-server-added').innerHTML;
    var compiledTemplate = Handlebars.compile(serverInfoTemplate);
    var serverData = compiledTemplate(servers);
    document.getElementById('server-row').innerHTML += serverData;
    document.querySelector('#' + serverId + ' .delete-server').addEventListener('click', () => {
      return this.removeServer(serverId)
    }, false);
  };

  /*
    Adds apps into servers
    1. Look if there are any newly created servers
    2. Push the app into the server created first.
    3. Move the server onto the queue holding 1 app.
    4. Repeat process.
    5. If all the servers are in the queue for servers with 2 apps, then let do not allow creation of the app.
    6. If no servers available on the cluster, discard the app.
  */
  this.addApp = function(appName, sid) {
    let appId = this.nextAppId();
    let name = appName;
    let app = new App(appId, name);
    if (!NEW_SERVERS.isEmpty()) {
      let newestServerId = NEW_SERVERS.dequeue();
      SERVER_STATUS.forEach(function(apps, serverId, serverMap) {
        if (serverId === newestServerId) {
          SERVER_STATUS.get(serverId).push(app);
          $('#' + serverId + ' .thumbnail').addClass(name.toLowerCase());
          $('#' + serverId + ' .progress .progress-bar').css('width', function() {
            return $(this).attr('aria-valuenow') + '%';
          }).css('visibility', 'visible');
          $('.progress .progress-bar').on('transitionend', function(e) {
            $('#' + serverId + ' .progress .progress-bar').css('visibility', 'hidden');
            $('#' + serverId + ' .progress .progress-bar').css('width', '0%');
          });
          document.getElementById(serverId + '-app-info').innerHTML = name + ' recently added';
        }
      });
      addAppToStack({
        'appId': appId,
        'serverlocation': AVAIL_SERVERS,
        'serverid': newestServerId,
        'appName': name
      });
      AVAIL_SERVERS.enqueue(newestServerId);
      return true;
    }
    if (!AVAIL_SERVERS.isEmpty()) {
      let newestServerId = AVAIL_SERVERS.dequeue();
      SERVER_STATUS.forEach(function(apps, serverId, serverMap) {
        if (serverId === newestServerId) {
          SERVER_STATUS.get(serverId).push(app);
          $('#' + serverId + ' .thumbnail').toggleClass(name.toLowerCase() + '-shared');
          $('#' + serverId + ' .progress .progress-bar').css('width', function() {
            return $(this).attr('aria-valuenow') + '%';
          }).css('visibility', 'visible');
          $('.progress .progress-bar').on('transitionend', function(e) {
            $('#' + serverId + ' .progress .progress-bar').css('visibility', 'hidden');
            $('#' + serverId + ' .progress .progress-bar').css('width', '0%');
          });
          document.getElementById(serverId + '-app-info').innerHTML = name + ' recently added';
        }
      });
      addAppToStack({
        'appId': appId,
        'serverlocation': LOCKED_SERVERS,
        'serverid': newestServerId,
        'appName': name
      });
      LOCKED_SERVERS.enqueue(newestServerId);
      return true;
    }
    if (AVAIL_SERVERS.getLength() === 0 && NEW_SERVERS.getLength() === 0 && LOCKED_SERVERS.getLength() !== 0) {
      console.error('Cant add any more apps. Cluster Capacity reached');
    } else {
      console.error('No servers avaiable. Discarding app');
    }
    return false;
  }

  /*
    Removes latest instance of the app from the cluster.
    1. Identify the most recently added app.
    2. Identify the server that holds the app.
    3. Remove app from that server as well.
    4. Identify and move the server to the relevant queue based on number of apps.
  */
  this.removeApp = function(appName) {
    var app = removeAppFromAppStack(appName);
    if (app !== undefined) {
      let deletedApp, availApp;
      if (SERVER_STATUS.get(app.serverid).length === 1) {
        SERVER_STATUS.get(app.serverid).splice(0, 1);
        NEW_SERVERS.enqueue(AVAIL_SERVERS.findAndPop(app.serverid));
        deletedApp = app.appName;
      } else {
        let deQuededServer = LOCKED_SERVERS.findAndPop(app.serverid);
        AVAIL_SERVERS.enqueue(deQuededServer);
        SERVER_STATUS.get(app.serverid).forEach((val, index, array) => {
          if (val.appId === app.appId) {
            deletedApp = val.appName;
            SERVER_STATUS.get(app.serverid).splice(index, 1);
            availApp = SERVER_STATUS.get(app.serverid)[0].appName;
          }
        });
      }
      if ($('#' + app.serverid + ' .thumbnail').hasClass(deletedApp.toLowerCase() + '-shared')) {
        $('#' + app.serverid + ' .thumbnail').removeClass(deletedApp.toLowerCase() + '-shared');
        $('#' + app.serverid + ' .thumbnail').addClass(availApp.toLowerCase());
      } else {
        $('#' + app.serverid + ' .thumbnail').removeClass(deletedApp.toLowerCase());
        if (availApp) {
          $('#' + app.serverid + ' .thumbnail').addClass(availApp.toLowerCase());
        }
      }
      if (availApp) {
        document.querySelector('#' + app.serverid + '-app-info').innerHTML = availApp + ' present on server';
      } else {
        document.querySelector('#' + app.serverid + '-app-info').innerHTML = 'No apps loaded on server';
      }
    }
  }

  /* 
   Removes server from the cluster
   * If server_status length is 1, remove the server and exit
   1. Look up for the serverid in the server_status map
   2. Pull out the apps from the server
   3. If app array length is 0, do nothing and exit
   4. If app array length is 1, do not iterate
   5. Iterate through the app array
   6. Call addApp
  */
  this.removeServer = function(serverId) {
    var serverId = serverId;
    console.info('Initiating server delete');
    let sid = serverId;
    if (SERVER_STATUS.size === 0) {
      console.info('No servers present in the cluster')
    } else if (SERVER_STATUS.size === 1) {
      SERVER_STATUS.clear();
      console.info('Server deleted and no servers present on cluster to move servers')
    } else {
      SERVER_STATUS.forEach((apps, id, servers) => {
        if (sid === id) {
          var apps = SERVER_STATUS.get(sid);
          if (apps.length === 0) {
            purgeServer(sid, IS_IN_NEW_SERVER_QUEUE);
          } else if (apps.length === 1) {
            purgeServer(sid, IS_IN_AVAIL_SERVER_QUEUE);
            if (this.addApp(apps[0].appName)) {
              console.info('App migrated successfully');
            } else {
              removeAppFromAppStack(apps[0].appName);
              console.error('App not migrated');
            }
          } else {
            purgeServer(sid, IS_IN_LOCKED_SERVER_QUEUE);
            apps.forEach((app) => {
              if (this.addApp(app.appName)) {
                console.info('App migrated successfully');
              } else {
                removeAppFromAppStack(app.appName);
                console.error('App not migrated');
              }
            });
          }
        }
      });

    }
  }


}).apply(cluster);