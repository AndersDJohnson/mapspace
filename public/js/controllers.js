

mapspaceApp.controller('HomeController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

}]);


mapspaceApp.controller('SpacesController', [
  '$scope', '$stateParams', 'mapspaceService',
  function ($scope, $stateParams, mapspaceService) {

    $scope.spaces = {};

    mapspaceService.watchValueAddRemove('/spaces', $scope, 'spaces');

}]);


mapspaceApp.controller('SpaceController', [
  '$scope', '$rootScope', '$stateParams', '$compile', 'mapspaceService', 'mapspaceMock',
  function ($scope, $rootScope, $stateParams, $compile, mapspaceService, mapspaceMock) {

    var spaceId = $scope.spaceId = null;
    spaceId = $scope.spaceId = $stateParams.id;


    var locationCookieName = 'mapspace_locationId';
    var joinCookieName = 'mapspace_s' + spaceId + '_joinId';


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


    setJoinId($.cookie(joinCookieName));
    setLocationId($.cookie(locationCookieName));


    $scope.joins = {};
    $scope.locations = {};

    $scope.leavingSpace = false;
    $scope.joiningSpace = false;

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


    var makePopup = function (_locationId, _location) {
      var timestamp = _location.position.timestamp;
      var formattedTimestamp = moment(timestamp).format();
      var you = '';
      if (_locationId === locationId) {
        you = '(you) '
      }
      var $popup = $('<div></div>');
      $popup.html([
        '<b>lid:</b> {{ locationId }}<br />',
        '<b>jid:</b> {{ joinId }}<br />',
        '<b>When:</b> <span am-time-ago="location.position.timestamp" ',
          'title="{{ location.position.timestamp | amDateFormat }}"></span>',
      ].join(''));
      var popup = $popup.get(0);

      // bind to the scope
      var fn = $compile(popup)($scope);

      return popup;
    };



    var positionReady = function (spaceId, joinId, locationId, callback) {

      if ($scope.joiningSpace) {
        console.log('cannot join space when already joining')
        return;
      }

      $scope.joiningSpace = true;

      mapspaceService.addOrSet('/spaces/' + spaceId + '/joins', joinId, {
        locationId: locationId
      })
        .then(function (result) {
          $scope.joiningSpace = false;
          if (result.name) {
            setJoinId(result.name);
          }
          joinReady(spaceId, joinId, locationId, callback);
        });
    };

    var joinReady = function (spaceId, joinId, locationId, callback) {
      $scope.joiningSpace = false;
      console.log('joined!');
      if (callback) callback();
    };



    var onLocationUpdate = function (iJoinId, _locationId, _location) {

      if (! $scope.joins[iJoinId]) {
        return;
      }

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

      mapper.fit({
        animate: true
      });
    };


    watching.joinsCancellers = {};

    var onJoinAdded = function (iJoinId, iJoin) {
      // console.log('onJoidAdded', iJoinId, iJoin);

      if (iJoinId === joinId) {
        $scope.leavingSpace = false;
      }

      if (watching.joins[iJoinId]) return;

      console.log('onJoidAdded', iJoinId, iJoin);
      // console.log('... not cancelled');

      watching.joins[iJoinId] = true;

      var uri = '/locations/' + iJoin.locationId;
      watching.joinsCancellers[joinId] = mapspaceService.watchValue(uri, function (result) {

        var locationId = result.snapshot.name;
        var location = result.snapshot.value;

        console.log('location watch value triggered', locationId, location);

        // remove empty location entries
        if (! location) {
          var deadJoins = {};
          _.each($scope.joins, function (join, joinId) {
            if (join.locationId === locationId) {
              deadJoins[joinId] = join;
            }
          });
          _.each(deadJoins, function (join, joinId) {
            mapspaceService.remove('/spaces/' + spaceId + '/joins/' + joinId).then(function (result) {
              console.log('removed dead join', joinId);
            });
          });
        }
        else {
          onLocationUpdate(iJoinId, locationId, location);
        }

      });
    };


    var onJoinRemoved = function (iJoinId, iJoin) {
      console.log('join removed', iJoinId, iJoin);
      if (iJoinId === joinId) {
        $scope.leavingSpace = true;
      }
      mapper.removeMarker(iJoin.locationId);
      if (watching.joins[iJoinId]) {
        delete watching.joins[iJoinId];
      }
      if (watching.joinsCancellers[iJoinId]) {
        watching.joinsCancellers[iJoinId]();
      }
    };


    $scope.$watchCollection('joins', function (newNames, oldNames) {
      var diff = ngUtil.watchDiff(newNames, oldNames);
      console.info('JOINS DIFF', 'added', diff.added, 'removed', diff.removed);
      _.each(diff.added, function (iJoin, iJoinId) {
        onJoinAdded(iJoinId, iJoin);
      });
      _.each(diff.removed, function (iJoin, iJoinId) {
        onJoinRemoved(iJoinId, iJoin);
      });
    });


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

      if ($scope.joiningSpace) {
        console.log('joining? no');
        return false;
      }

      mapspaceService.getCurrentPosition().then(function (position) {
        pushLocation(position, function () {
          console.log('location pushed');
          positionReady(spaceId, joinId, locationId, callback);
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




    var removeUser = function (iJoinId, iLocationId) {
      var isMe = iLocationId === locationId;

      if (isMe) {
        if ($scope.leavingSpace) {
          return;
        }
        $scope.leavingSpace = true;
      };

      mapspaceService.remove('/spaces/' + spaceId + '/joins/' + iJoinId).then(function () {

        if (isMe) {
          // joinId = $scope.joinId = null;
          // join = $scope.join = null;
        }

        mapper.fit({
          animate: true
        });
      });
    };


    var locationLoop = function () {
      mapspaceService.getCurrentPosition().then(function (position) {
        if (! $scope.leavingSpace) {
          pushLocation(position, function () {
              setTimeout(locationLoop, 5000);
          });
        }
      });
    };

    locationLoop();

    // mapspaceMock.mockLoop();


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
        return;
      }
      $scope.leavingSpace = false;

      joinSpace(function () {
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

      removeUser(joinId, locationId);
    };

    $scope.removeUser = function ($event, iJoinId, iLocationId) {
      $event.preventDefault();
      $event.stopPropagation();

      removeUser(iJoinId, iLocationId);
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

