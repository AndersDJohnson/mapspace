

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
      location = $scope.location;
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


    $scope.preventDefault = function ($event) {
      $event.preventDefault();
    };


    $scope.usersFocused = false;
    $scope.hideUsers = function ($event) {
      $('.mapspace-users').removeClass('mapspace-full-width');
      $scope.usersFocused = false;
    };
    $scope.showUsers = function ($event) {
      $scope.usersFocused = true;
      $('.mapspace-users').addClass('mapspace-full-width');
    };
    $scope.toggleUsers = function ($event) {
      $event.preventDefault();
      if ($scope.usersFocused) {
        $scope.hideUsers();
      }
      else {
        $scope.showUsers();
      }
    };

    $scope.toggleNavbarDropdown = function ($event) {
      $('#mapspace-navbar-collapse-1').collapse('toggle');
    };


    var $map = $('<div class="mapspace-map"></div>');
    $map.attr('data-mapspace-space-id', spaceId);

    var $mapContainer = $('.mapspace-map-container');
    $mapContainer.html($map);

    var mapper = new Mapper({
      el: $map
    });


    var locationReady = function (spaceId, joinId, locationId, callback) {
      mapspaceService.addOrSet('/spaces/' + spaceId + '/joins', joinId, {
        locationId: locationId
      })
        .then(function (result) {
          if (result.name) {
            setJoinId(result.name);
          }
          joinReady(spaceId, joinId, locationId, callback);
        });
    };

    var joinReady = function (spaceId, joinId, locationId, callback) {
      console.log('joined!');
      if (callback) callback();
    };


    var makePopup = function (_locationId, _location) {
      var timestamp = _location.position.timestamp;
      var formattedTimestamp = moment(timestamp).format();
      var you = '';
      if (_locationId === locationId) {
        you = '(you) '
      }
      return 'ID: ' + you + _locationId + '<br />at: ' + formattedTimestamp;
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
          markerOptions: markerOptions,
          popup: makePopup(_locationId, _location)
        });
      }

      // mapper.fit({
      //   animate: true
      // });
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
      // console.log('joins diff', 'added', diff.added, 'removed', diff.removed);
      _.each(diff.added, function (join, iJoinId) {
        onJoinAdded(iJoinId, join);
      });
      _.each(diff.removed, function (join, iJoinId) {
        // console.log('need to remove watches for join', iJoinId, join, 'and its location markers');
        if (joinId === iJoinId) {
          $scope.leavingSpace = true;
        }
        mapper.removeMarker(join.locationId);
        var uri = '/locations/' + join.locationId;
        watching.joinsCancellers[iJoinId]();
        delete watching.joins[joinId];
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
          locationReady(spaceId, joinId, locationId, callback);
        });
      });
    };

    joinSpace(function () {
      var zoom = 18;
      if (location && location.position) {
        var center = Mapper.toLatLng(location.position.coords);
        mapper.setView(center, zoom);
      }
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
      console.log('toMe', location);
      $event.preventDefault();

      if (joinId && location && location.position) {
        var zoom = 18;
        var latLng = Mapper.toLatLng(location.position.coords);
        mapper.setView(latLng, zoom, {
          animate: true
        });
      }
      else {
        console.error('no location', location);
      }
    };

    $scope.fit = function ($event) {
      $event.preventDefault();
      mapper.fit({
        animate: true
      });
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

        if (location && location.position) {
          var zoom = 18;
          var center = Mapper.toLatLng(location.position.coords);
          mapper.setView(center, zoom, {
            animate: true
          });
          mapper.showMarkerPopup(locationId);
        }
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

        locationId = $scope.locationId = null;
        location = $scope.location = null;
        joinId = $scope.joinId = null;
        join = $scope.join = null;

        mapper.fit({
          animate: true
        });
      });
    };

    $scope.removeUser = function ($event, joinId, userId) {
      $event.preventDefault();
      $event.stopPropagation();

      if (userId === locationId) {
        $scope.leavingSpace = true;
      };

      mapspaceService.remove('/spaces/' + spaceId + '/joins/' + joinId).then(function () {

      });
    };

    $scope.addMockUser = function ($event) {
      $event.preventDefault();

      mapspaceMock.addMockUsers({
        spaceId: spaceId,
        count: 1,
        nearPosition: $scope.location.position
      }, function () {
        console.log('add callback');
        mapper.fit({
          animate: true
        });
      });
    }

    $scope.onUsersListItemClick = function ($event, joinId, join) {
      var locationId = join.locationId;
      var location = $scope.locations[locationId];

      if (location && location.position) {

        $scope.hideUsers();

        var zoom = 18;
        var latLng = Mapper.toLatLng(location.position.coords);
        mapper.map.setView(latLng, zoom, {
          animate: true
        });
        mapper.showMarkerPopup(locationId);
      }
    };

    $scope.onUsersListItemMouseEnter = function ($event, joinId, join) {
      var locationId = join.locationId;
      // mapper.showMarkerPopup(locationId);
    };

    $scope.onUsersListItemMouseLeave = function ($event, joinId, join) {
      var locationId = join.locationId;
      // mapper.closeMarkerPopup(locationId);
    };

  }
]);

