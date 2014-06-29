

mapspaceApp.controller('HomeController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

}]);


mapspaceApp.controller('SpacesController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

    $scope.spaces = {};

    var spacesRef = mapspaceService.getSpacesRef();

    spacesRef.$on('value', function (result) {
      var spaces = result.snapshot.value;
      _.merge($scope.spaces, spaces);
    });

}]);


mapspaceApp.controller('SpaceController', [
  '$scope', '$rootScope', '$stateParams', 'mapspaceService', 'mapspaceMock',
  function ($scope, $rootScope, $stateParams, mapspaceService, mapspaceMock) {

    var locationCookieName = 'mapspace_locationId';
    var joinCookieName = 'mapspace_s' + spaceId + '_joinId';

    var spaceId = $scope.spaceId = null;
    var locationId = $scope.userId = null;
    var joinId = $scope.joinId = null;
    var location = $scope.location = null;

    var setLocation = function (value) {
      location = $scope.location = value;
    };
    var setPosition = function (value) {
      setLocation({});
      $scope.location.position = value;
    };
    var setLocationId = function (value) {
      locationId = $scope.locationId = value;
      $.cookie(locationCookieName, locationId);
    };
    var setJoinId = function (value) {
      joinId = $scope.joinId = value;
      $.cookie(joinCookieName, joinId);
    };

    spaceId = $scope.spaceId = $stateParams.id;

    setJoinId($.cookie(joinCookieName));
    setLocationId($.cookie(locationCookieName));


    $scope.joins = {};
    $scope.locations = {};


    $scope.positioning = {
      manual: false
    };


    var watching = {
      joins: []
    };


    var $mapContainer = $('.map-container');
    var $map = $('<div class="map"></div>');
    $map.attr('data-mapspace-space-id', spaceId);
    $mapContainer.html($map);

    var mapper = new Mapper({
      el: $map
    });


    var locationReady = function (spaceId, joinId, locationId) {
      mapspaceService.addOrSet('/spaces/' + spaceId + '/joins', joinId, {
        locationId: locationId
      })
        .then(function (result) {
          if (result.name) {
            setJoinId(result.name);
          }
          joinReady(spaceId, joinId, locationId);
        });
    };

    var joinReady = function (spaceId, joinId, locationId) {
      console.log('joined!');
    };

    var onLocationUpdate = function (_locationId, _location) {
      $scope.locations[_locationId] = _location;

      var markerOptions = {};
      if (_locationId === locationId) {
        var redIcon = L.AwesomeMarkers.icon({
          icon: 'user',
          markerColor: 'red',
          prefix: 'fa'
        });
        markerOptions = {
          icon: redIcon
        };
      }

      if (_location) {
        mapper.addOrUpdateMarker({
          id: _locationId,
          position: _location.position,
          markerOptions: markerOptions
        });
      }

      mapper.fit();
    };


    watching.joinsCancellers = {};

    var onJoinAdded = function (joinId, join) {
      console.log('onJoidAdded', joinId, join);

      if (watching.joins[joinId]) return;

      console.log('... not cancelled');

      var uri = '/locations/' + join.locationId;
      watching.joinsCancellers[joinId] = mapspaceService.watchValue(uri, function (result) {
        var locationId = result.snapshot.name;
        var location = result.snapshot.value;
        // console.log('location update', locationId, location);
        console.log('onJoidAdded watch value', locationId, location);
        onLocationUpdate(locationId, location);
      });
      // console.log('now watching', uri);
      watching.joins[joinId] = true;
    };


    $scope.$watchCollection('joins', function (newNames, oldNames) {
      var diff = ngUtil.watchDiff(newNames, oldNames);
      console.log('joins diff', 'added', diff.added, 'removed', diff.removed);
      _.each(diff.added, function (join, joinId) {
        onJoinAdded(joinId, join);
      });
      _.each(diff.removed, function (join, joinId) {
        console.log('need to remove watches for join', joinId, join, 'and its location markers');
        mapper.removeMarker(join.locationId);
        var uri = '/locations/' + join.locationId;
        watching.joinsCancellers[joinId]();
      });
    });


    // $scope.$watch('locations', function (newNames, oldNames) {
    //   var diff = ngUtil.watchDiff(newNames, oldNames);

    //   _.each(diff.added, function (location, locationId) {
    //     onLocationAdded(locationId, location);
    //   });
    //   _.each(diff.removed, function (location, locationId) {
    //     console.log('need to remove markers for location', joinId, join);
    //   });
    // });

    // var joinsRef = mapspaceService.getFirebaseRef('/spaces/' + spaceId + '/joins');
    // joinsRef.on('value').then(result)

    // mapspaceService.watchValueExtend('/spaces/' + spaceId + '/joins', $scope, 'joins');
    mapspaceService.watchValueAddRemove('/spaces/' + spaceId + '/joins', $scope, 'joins');


    var pushLocation = function (position, callback) {
      setPosition(position);
      mapspaceService.addOrSet('/locations', locationId, location).then(function (result) {
        if (result.name) {
          setLocationId(result.name);
        }
        if (callback) callback();
      });
    };


    var joinSpace = function (callback) {
      mapspaceService.getCurrentPosition().then(function (position) {
        pushLocation(position, function () {
          locationReady(spaceId, joinId, locationId);
          if (callback) callback();
        });
      });
    };

    joinSpace(function () {
      var zoom = 18;
      mapper.setView(location.position, zoom);
    });


    var locationLoop = function () {
      mapspaceService.getCurrentPosition().then(function (position) {
        pushLocation(position, function () {
          setTimeout(locationLoop, 5000);
        });
      });
    };

    locationLoop();

    mapspaceMock.mockLoop();


    $scope.toMe = function ($event) {
      $event.preventDefault();
      mapper.map.panTo(MapSpace.getLatLngFromUser(user));
    };

    $scope.fit = function ($event) {
      $event.preventDefault();
      mapspace.fitPoints();
    };

    $scope.joinSpace = function ($event) {
      $event.preventDefault();

      if (! $scope.leavingSpace) {
        // alert('already joined!');
        return;
      }
      // alert('joining...');

      joinSpace(function () {
        $scope.leavingSpace = false;
      });
    };

    $scope.leaveSpace = function ($event) {
      $event.preventDefault();

      if ($scope.leavingSpace) {
        // alert('already gone!');
        return;
      }
      // alert('ok, goodbye!');

      mapspaceService.remove('/spaces/' + spaceId + '/joins/' + joinId).then(function () {
        $scope.leavingSpace = true;
      });
    };

    $scope.removeUser = function ($event, joinId, userId) {
      $event.preventDefault();

      if (userId === locationId) {
        $scope.leavingSpace = true;
      };

      mapspaceService.remove('/spaces/' + spaceId + '/joins/' + joinId).then(function () {

      });
    };

    $scope.addMockUser = function ($event) {
      console.log('addMockUser');
      mapspaceMock.addMockUsers({
        spaceId: spaceId,
        count: 1,
        nearPosition: $scope.location.position
      });
    }

    $scope.onUsersListItemMouseEnter = function ($event, id, point) {
      // mapper.showMarkerPopup(id);
    };

    $scope.onUsersListItemMouseLeave = function ($event, id, point) {
      // mapper.closeMarkerPopup(id);
    };

  }
]);

