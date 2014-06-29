
mapspaceApp.factory('mapspaceMock', [
  'mapspaceService',
  function(mapspaceService) {
    var out = {};

    out.addMockUsers = function (options, callback) {
      console.log('mapspaceServic addMockUserse', mapspaceService);

      var spaceId = options.spaceId;
      
      var items = [];

      _.times(options.count, function () {
        var location = {
          position: Mapper.positionNear(options.nearPosition),
          mock: true
        };
        items.push({
          location: location
        });
      });

      async.eachSeries( items, function (item, callback) {
        mapspaceService.addOrSet('/locations', item.locationId, item.location).then(function (result) {
          if (result.name) {
            item.locationId = result.name;
          }
          mapspaceService.addOrSet('/spaces/' + spaceId + '/joins', item.joinId, {
            locationId: item.locationId
          })
            .then(function (result) {
              if (result.name) {
                item.joinId = result.name;
              }
              callback();
            });
        });
      }, function () {
        if (callback) callback();
      });

    };

    out.mockLoop = function () {

      var data = {};
      data.locations = {};

      mapspaceService.watchValueExtend('/locations', data, 'locations');
      // mapspaceService.watchValueAddRemove('/locations', data, 'locations');

      var move = function () {
        async.eachSeries( _.keys(data.locations),
          function (locationId, callback) {
            var location = data.locations[locationId];

            if (! location.mock) {
              if (callback) callback();
              return;
            }

            location.position.coords.latitude += Math.random() > 0.5 ? 0.0001 * Math.random() : -0.0001 * Math.random();
            location.position.coords.longitude += Math.random() > 0.5 ? 0.0001 * Math.random() : -0.0001 * Math.random();

            mapspaceService.set('/locations/' + locationId, location).then(function (result) {
              if (callback) callback();
            });
          },
          function () {
            setTimeout(move, 1000);
          }
        );
      };

      move();
    }

    return out;
  }
]);
