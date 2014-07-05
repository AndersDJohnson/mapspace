var _ = require('lodash');
var async = require('async');
var Firebase = require('firebase');

var poll = module.exports = {};


poll.start = function () {

  poll.baseUrl = 'https://mapspace-beta.firebaseio.com';

  poll.locationsInterval = 5000;

  poll.rootRef = new Firebase( poll.baseUrl + '/' );
  poll.locationsRef = new Firebase( poll.baseUrl + '/locations' );
  poll.spacesRef = new Firebase( poll.baseUrl + '/spaces' );

  poll.each();
};


poll.each = function () {

  console.log('each');

  // one minute
  poll.locationsMaxAge = 1000 * 60 * 2;

  poll.locations();

};


poll.shouldRemoveLocation = function (location, params) {
  params = params || {};
  var oldest = params.oldest;

  if (! location) return false;

  var position = location.position;

  // TODO: Make sure location cannot be not missing position field just after created by client.
  if (! position) {
    return 'locations without position are invalid';
  }

  // TODO: Is this supported in all Geolocation API browsers?
  var timestamp = position.timestamp;
  if (! timestamp) {
    return 'positions without timestamp are invalid';
  }

  // if oldest is provided, then...
  if ( oldest && oldest !== 0 ) {
    // ...and this is older, then invalid
    if ( timestamp < oldest ) {
      return 'older than oldest allowed ( ' + timestamp + ' < ' + oldest + ' )';
    }
  }

  return false;
};


/**
 * This will clean up any locations that have seemingly been abandoned.
 * To be run automatically on a schedule, no need for on-demnd.
 */
poll.locations = function () {

  poll.locationsRef.once('value', function (result) {
    var locations = result.val();

    var keepIds = [];
    var deleteIds = [];

    var now = Date.now();
    var oldest = now - poll.locationsMaxAge;

    _.each(locations, function (location, id) {

      poll.checkMockLocation(id, location);

      var remove = poll.shouldRemoveLocation(location, {
        oldest: oldest
      });

      if (remove) {
        console.log('removing', id, ': ', remove);
        deleteIds.push(id);
      }
      else {
        keepIds.push(id);
      }

    });

    console.log('deleteIds', deleteIds.length);
    console.log('keepIds', keepIds.length);

    _.each(deleteIds, function (deleteId) {
      poll.locationsRef.child(deleteId).remove(function () {
        console.log('deleted', deleteId);
      });
    });

    setTimeout(function () {
      poll.locations();
    }, poll.locationsInterval);

  });

};


poll.checkMockLocation = function (id, location) {
  if (location.mock) {
    console.log('mock location', location);
    var position = location.position;
    if (position) {
      var coords = position.coords;
      if (coords) {
        location.position = {
          coords: {
            accuracy: Math.random() * 80,
            latitude: coords.latitude + (0.001 * (0.5 - Math.random())),
            longitude: coords.longitude + (0.001 * (0.5 - Math.random()))
          },
          timestamp: Date.now()
        };
        console.log('updated position');
        var locationRef = poll.locationsRef.child(id);
        locationRef.set(location, function () {
          console.log('ok done');
        });
      }
    }
  }
};


/**
 * This will remove joins from a space if they no longer correspond to a valid location.
 */
poll.space = function (spaceId, callback) {

  var spaceRef = poll.spacesRef.child(spaceId);

  console.log('spaceId', spaceId);

  var deleteIds = [];

  var joinsRef = spaceRef.child('joins');

  spaceRef.once('value', function (result) {

    var space = result.val();

    if (! space) {
      console.error('no space found');
      callback();
      return;
    }

    var joins = space.joins;

    if (joins) {
      async.eachSeries(
        _.keys(joins),
        function (joinId, callback) {
          var join = joins[joinId];

          if (! join) {
            console.log('removing', id, ': ', 'no join');
            deleteIds.push(joinId);
            callback();
            return;
          }

          var locationId = join.locationId;

          if (! locationId) {
            console.log('removing', id, ': ', 'no locationId');
            deleteIds.push(joinId);
            callback();
            return;
          }

          var locationRef = poll.locationsRef.child(locationId);

          locationRef.once('value', function (result) {
            var location = result.val();
            var remove = poll.shouldRemoveLocation(location);
            if (remove) {
              console.log('removing', id, ': ', remove);
              deleteIds.push(joinId);
              callback();
            }
            else {
              callback();
            }
          });
        },
        function () {
          if (deleteIds.length) {
            async.eachSeries(
              deleteIds,
              function (deleteId, callback) {
                var joinRef = joinsRef.child(deleteId);

                joinRef.remove(function (err) {
                  callback(err);
                });
              },
              function (err) {
                callback(err, deleteIds);
              }
            );
          }
          else {
            callback(null, deleteIds);
          }
        }
      );
    }
    else {
      callback(null, deleteIds);
    }

  });

};

