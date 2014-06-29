

var mapspaceService = mapspaceApp.service('mapspaceService', ['$q', '$firebase', function ($q, $firebase) {

  var out = {};

  out.center = {latitude: 0, longitude: 0};

  out.getFirebaseRef = function (uri) {
    var ref = new Firebase('https://mapspace-beta.firebaseio.com' + uri);
    return $firebase(ref);
  };

  out.add = function (uri, data) {
    var ref = this.getFirebaseRef(uri);
    return ref.$add(data);
  };

  out.set = function (uri, data) {
    var ref = this.getFirebaseRef(uri);
    return ref.$set(data);
  };

  out.remove = function (uri, data) {
    var ref = this.getFirebaseRef(uri);
    return ref.$remove(data);
  };

  out.addOrSet = function (uri, name, data) {
    var deferred = $q.defer();
    if (name) {
      this.set(uri + '/' + name, data).then(function (snapshot) {
        deferred.resolve({
          snapshot: snapshot
        });
      });
    }
    else {
      this.add(uri, data).then(function (snapshot) {
        name = snapshot.name();

        deferred.resolve({
          snapshot: snapshot,
          name: name
        });
      })
    }
    return deferred.promise;
  };

  out.watchValue = function (uri, callback) {
    var ref = this.getFirebaseRef(uri);
    var listener = function (result) {
      callback(result);
    };
    ref.$on('value', listener);
    // return for cancelling
    return function () {
      ref.$off('value', listener);
    }
  };

  out.watchValueExtend = function (uri, object, key) {
    return this.watchValue(uri, function (result) {
      $.extend(object[key], result.snapshot.value);
    })
  };

  out.watchValueAddRemove = function (uri, object, objectKey) {
    return this.watchValue(uri, function (result) {
      var items = result.snapshot.value;

      // console.log('watchValueAddRemove', items, object[objectKey]);

      if (items) {
        // add
        _.each(items, function (value, key) {
          if (! object[objectKey][key]) {
            object[objectKey][key] = value;
          }
        });
        // remove
        _.each(object[objectKey], function (value, key) {
          if (! items[key] && object[objectKey][key]) {
            delete object[objectKey][key];
          }
        });
      }
      else {
        object[objectKey] = {};
      }
    })
  };

  out.getMockUsers = function (options) {
    options = options || {};
    var users = [];

    _.times(options.count, function () {
      var point = {
        location: {
          coords: MapSpace.makeCoordsNear(options.near)
        },
        created: new Date()
      };
      users.push(point);
    });

    return users;
  };

  out.addMockUsers = function (options) {
    var _this = this;
    var mockUsers = this.getMockUsers(options);
    var spaceId = options.spaceId;

    _.each(mockUsers, function (user) {
      console.log('adding mock user', user);
      var ref = _this.addUser(user).then(function (result) {
        var userId = result.name();
        _this.addSpaceUser(spaceId, userId).then(function (result) {
          console.log('added mock space user');
          // var joinId = result.name();
          // $scope.joins[joinId] = userId;
        });

      });
    });
  };

  out.getCurrentPosition = function (options) {
    options = options || {};

    var deferred = $q.defer();

    var onLocation = function (position) {
      deferred.resolve(position);
    };

    var onError = function (err) {
      deferred.reject(err);
    };

    var geolocationOptions = {
      enableHighAccuracy: true
    };

    navigator.geolocation.getCurrentPosition(onLocation, onError, geolocationOptions);

    return deferred.promise;
  };

  return out;

}]);
