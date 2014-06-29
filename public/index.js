

var MapSpace = function () {

  this.intervals = [];

};

MapSpace.makeCoordsNear = function (coords) {
  return {
    latitude: coords.latitude + (Math.random() > 0.5 ? 0.001 : -0.001),
    longitude: coords.longitude + (Math.random() > 0.5 ? 0.001 : -0.001)
  };
};


MapSpace.getLatLngFromPoint = function (point) {
  return [point.coords.latitude, point.coords.longitude];
};


MapSpace.prototype.$scope = null;

MapSpace.prototype.points = {
/*
  '_id': {
    data: {},
    marker: {}
  }
*/
};


MapSpace.prototype.updateFromScope = function () {
  var _this = this;

  if (this.destroyed) return false;

  var $scope = this.$scope;

  var map = $scope.map;

  _.each($scope.points, function (pointData, id) {
    var uiPoint = _this.points[id] = _this.points[id] || {};
    uiPoint.data = pointData;
  });

  _.each(this.points, function (uiPoint, id) {
    if ( ! $scope.points[id] ) {
      map.removeLayer(uiPoint.marker);
      delete _this.points[id];
    }
  });

};


MapSpace.prototype.addMarkerForPoint = function (id, options) {
  options = $.extend({}, {
    riseOnHover: true
  }, options);

  var $scope = this.$scope;

  var map = $scope.map;
  var point = this.points[id];
  var data = point.data;

  if (point.marker) return;

  console.log('creating marker for point', id, point);

  if (id === $scope.myPointId) {
    var redIcon = L.AwesomeMarkers.icon({
      icon: 'user',
      markerColor: 'red',
      prefix: 'fa'
    });

    options = $.extend({
        icon: redIcon,
        addTo: map
    }, options);
  }

  point.marker = L.marker(MapSpace.getLatLngFromPoint(data), options);

  point.marker.bindPopup( 'id: ' + id + '<br />created: ' + point.created );

  if (options.addTo) {
    console.log('add to', options.addTo)
    point.marker.addTo(options.addTo);
  }

  return point.marker;
};


MapSpace.prototype.onMove = function (point) {
  if (! point.marker) return;
  // console.log('on move', point);
  point.marker.setLatLng(MapSpace.getLatLngFromPoint(point.data));
};


MapSpace.prototype.fitPoints = function () {

  var $scope = this.$scope;
  var points = this.points || [];
  var map = $scope.map;

  var markers = _.map(points, function (point) { return point.marker; });

  markers = _.compact(markers);
  var group = new L.featureGroup(markers);
  var bounds = group.getBounds();
  bounds = bounds.pad(0.5);
  map.fitBounds(bounds);

};


MapSpace.prototype.mockMotion = function (options) {
  var _this = this;

  options = $.extend({}, options);

  this.intervals.push(setInterval(function () {

    var $scope = _this.$scope;

    // console.log('mockMotion $scope.spaceId', $scope.spaceId);

    var pointsRef = $scope.pointsRef;

    _.each(pointsRef.$getIndex(), function (id) {

      var point = pointsRef[id];
      var pointRef = pointsRef.$child(id);

      // do not mock move real points, including my point
      if (point.real) {
        return;
      }

      point.coords.latitude += Math.random() > 0.5 ? 0.00001 : -0.00001;
      point.coords.longitude += Math.random() > 0.5 ? 0.00001 : -0.00001;

      // update remote copy
      pointRef.$update(point);

      // // update local copy
      // $scope.points[id] = $scope.points[id] || {};
      // _.merge($scope.points[id], point);
      // _this.updateFromScope();

    });

  }, 1000));

};


MapSpace.prototype.renderLoop = function () {

  var _this = this;

  this.intervals.push(setInterval(function () {

    var $scope = _this.$scope;

    var points = _this.points || [];
    var map = $scope.map;

    // console.log('renderLoop $scope.spaceId', $scope.spaceId, 'map.spaceId', map.spaceId);

    _.each(points, function (point, id) {

      if (! point.marker) {
        _this.addMarkerForPoint(
          id,
          {
            addTo: map
          });
      }

      _this.onMove(point);
    });

    if (! $scope.positioning.manual) {
      _this.fitPoints();
      // if (point.follow) {
      //   map.panTo(MapSpace.getLatLngFromPoint(point.data))
      // }
    }

  }, 1000));

};


MapSpace.prototype.myPointLoop = function () {
  
  var _this = this;

  this.intervals.push(setInterval(function () {

    var $scope = _this.$scope;
    var mapspaceService = _this.mapspaceService;

    console.log('updating my point...');

    var spaceId = $scope.spaceId;
    var myPointId = $scope.myPointId;

    mapspaceService.getMyPoint().then(function (myPoint) {

      $scope.myPoint = myPoint;

      mapspaceService.updatePoint(spaceId, myPointId, myPoint).then(function (ref) {
        console.log('...updated my point');
      });

    });

  }, 5000));

};


MapSpace.prototype.destroy = function () {

  this.destroyed = true;

  _.each(this.intervals, function (intervalId) {
    clearInterval(intervalId);
  });

};


var mapspaceApp = angular.module('mapspaceApp', ['ui.router', 'firebase']);


mapspaceApp.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

  $urlRouterProvider.otherwise('/');

  $stateProvider
    .state('/', {
        url: '/',
        templateUrl: 'templates/home.html',
        controller: 'HomeController'
    })
    .state('spaces', {
        url: '/spaces',
        templateUrl: 'templates/spaces.html',
        controller: 'SpacesController'
    })
    .state('space', {
        url: '/spaces/:id',
        templateUrl: 'templates/space.html',
        controller: 'SpaceController'
    })
  ;

}]);


var mapspaceService = mapspaceApp.service('mapspaceService', ['$q', '$firebase', function ($q, $firebase) {

  var out = {};

  out.center = {latitude: 0, longitude: 0};

  out.getFirebaseRef = function (uri) {
    var ref = new Firebase('https://mapspace-beta.firebaseio.com' + uri);
    return ref;
  };

  out.getSpaces = function () {
    var ref = this.getFirebaseRef('/spaces');
    return $firebase(ref);
  };

  out.getSpace = function (spaceId) {
    if (! spaceId) throw new Error('spaceId required');
    var spacesRef = this.getSpaces();
    var spaceRef = spacesRef.$child(spaceId);
    return spaceRef;
  };

  out.getPoints = function (spaceId) {
    if (! spaceId) throw new Error('spaceId required');
    var spaceRef = this.getSpace(spaceId);
    var pointsRef = spaceRef.$child('points');
    return pointsRef;
  };

  out.getPoint = function (spaceId, pointId) {
    if (! spaceId) throw new Error('spaceId required');
    if (! pointId) throw new Error('pointId required');
    var pointsRef = this.getPoints(spaceId);
    var pointRef = pointsRef.$child(pointId);
    return pointRef;
  };

  out.removePoint = function (spaceId, pointId) {
    var pointsRef = this.getPoints(spaceId);
    var promise = pointsRef.$remove(pointId);
    return promise;
  };

  out.createPoint = function (spaceId, myPoint) {
    console.log('creating point', point);
    myPoint.created = new Date();
    var pointsRef = this.getPoints(spaceId);
    var promise = pointsRef.$add(myPoint);
    return promise;
  };

  out.updatePoint = function (spaceId, pointId, myPoint) {
    console.log('updating...');
    var pointRef = this.getPoint(spaceId, pointId);
    var promise = pointRef.$set(myPoint);
    return promise;
  };

  out.getMockPoints = function (options) {
    options = options || {};
    var points = [];

    _.times(options.count, function () {
      var point = {
        coords: MapSpace.makeCoordsNear(options.near),
        created: new Date()
      };
      points.push(point);
    });

    return points;
  };

  out.addMockPoints = function (options) {
    var mockPoints = mapspaceService.getMockPoints(options);

    _.each(mockPoints, function (point) {
      console.log('adding mock point', point);
      var ref = pointsRef.$add(point);
      // console.log('... ref', ref);
    });
  };

  out.getMyPoint = function (options) {
    options = options || {};

    var deferred = $q.defer();

    var onLocation = function (position) {
      var coords = position.coords;
      var latitude = coords.latitude;
      var longitude = coords.longitude;

      var point = {
        real: true,
        coords: {
          latitude: latitude,
          longitude: longitude
        }
      };

      deferred.resolve(point);
    };

    var onError = function (err) {
      deferred.reject(err);
    };

    navigator.geolocation.getCurrentPosition(onLocation, onError);

    return deferred.promise;
  };

  return out;

}]);


mapspaceApp.controller('HomeController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

}]);


mapspaceApp.controller('SpacesController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

    $scope.spaces = {};

    var spacesRef = mapspaceService.getSpaces();

    spacesRef.$on('value', function (result) {
      var spaces = result.snapshot.value;
      _.merge($scope.spaces, spaces);
    });

}]);


mapspaceApp.controller('SpaceController', [
  '$scope', '$rootScope', '$stateParams', 'mapspaceService',
  function ($scope, $rootScope, $stateParams, mapspaceService) {

    // console.log('$stateParams', $stateParams);

    var spaceId = $stateParams.id;

    var mapspace = $scope.mapspace = new MapSpace();

    mapspace.$scope = $scope;
    mapspace.spaceId = spaceId;
    mapspace.mapspaceService = mapspaceService;


    /**
     * We need to stop the rendering loop for the MapSpace once the route changes.
     * TODO: We should not let this run on sub-states.
     */
    $rootScope.$on("$stateChangeStart", function (event, toState, toParams, fromState, fromParams) {
      if (mapspace) {
        mapspace.destroy();
        delete mapspace;
      }
    });


    $scope.spaceId = spaceId;

    $scope.points = {};


    $scope.positioning = {
      manual: true
    };


    var spaceRef = mapspaceService.getSpace(spaceId);
    var pointsRef = spaceRef.$child('points');

    $scope.spaceRef = spaceRef;
    $scope.pointsRef = pointsRef;


    // TODO: does this cover 'child_added', 'child_changed', etc.?
    pointsRef.$on('value', function(result) {
      var points = result.snapshot.value;
      _.merge($scope.points, points);
      mapspace.updateFromScope();
    });


    pointsRef.$on('child_removed', function(result) {
      var id = result.snapshot.name;
      data = result.snapshot.value;
      console.log('remove point', id, data);
      delete $scope.points[id];
      mapspace.updateFromScope();
    });


    var $mapContainer = $('.map-container');

    var $map = $('<div class="map"></div>');
    $map.attr('data-mapspace-space-id', spaceId);

    $mapContainer.html($map);

    var mapEl = $map.get(0);

    var map = $scope.map = L.map(mapEl);
    map.spaceId = spaceId;

    $map.data('mapspace.data', {
      map: map,
      spaceId: spaceId
    });


    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);



    var afterCreatedOrUpdated = function () {

      mapspace.renderLoop();
      mapspace.myPointLoop();

    };


    mapspaceService.getMyPoint().then(function (myPoint) {

      $scope.myPointId = null;
      $scope.myPoint = myPoint;


      var mockAdd = false;
      if (mockAdd) {
        mapspaceService.addMockPoints({
            count: 4,
            near: myPoint.coords
        });
      }


      var pointIdCookieName = 'mapspace_s' + spaceId + '_pointId';


      var myPointId = $.cookie(pointIdCookieName);

      $scope.myPointId = myPointId;

      var afterCreate = function (ref) {
        myPointId = ref.name();

        $.cookie(pointIdCookieName, myPointId, {
          path: '/'
        });

        $scope.myPointId = myPointId;

        afterCreatedOrUpdated();
      };


      if (! myPointId) {
        mapspaceService.createPoint(myPoint).then(afterCreate);
      }
      else {
        console.log('your point id:', myPointId);

        var myPointRef = pointsRef.$child(myPointId);
        // console.log(myPointRef);

        console.log('verifying exits remotely...');

        myPointRef.$getRef().once('value', function(snapshot) {

          var point = snapshot.val();

          if (! point) {
            console.log('...did not exist');
            mapspaceService.createPoint(spaceId, myPoint).then(afterCreate);
            return;
          }
          else {
            console.log('...existed');
            // console.log('myPointRef value', point);

            mapspaceService.updatePoint(spaceId, myPointId, myPoint).then(function (ref) {
              console.log('...updated');

              afterCreatedOrUpdated();
            });
          }

        });

      }


      var center = MapSpace.getLatLngFromPoint(myPoint);
      var zoom = 18;

      map.setView(center, zoom);

    });


    $scope.toMe = function ($event) {
      map.panTo(MapSpace.getLatLngFromPoint(myPoint));
      $event.preventDefault();
    };

    $scope.fit = function ($event) {
      mapspace.fitPoints();
      $event.preventDefault();
    };

    $scope.onUsersListItemMouseEnter = function ($event, id, point) {
      var marker = _.deepGet(mapspace, 'points.' + id + '.marker');
      if (marker) {
        marker.openPopup();
      }
    };

    $scope.onUsersListItemMouseLeave = function ($event, id, point) {
      var marker = _.deepGet(mapspace, 'points.' + id + '.marker');
      if (marker) {
        marker.closePopup();
      }
    };

  }
]);

