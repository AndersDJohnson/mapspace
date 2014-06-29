var _ = require('lodash');
var async = require('async');
var Firebase = require('firebase');

var poll = module.exports = {};


poll.start = function () {

  poll.baseUrl = 'https://mapspace-beta.firebaseio.com';

  poll.locationsInterval = 30000;

  poll.rootRef = new Firebase( poll.baseUrl + '/' );
  poll.locationsRef = new Firebase( poll.baseUrl + '/locations' );
  poll.spacesRef = new Firebase( poll.baseUrl + '/spaces' );

  poll.each();
};


poll.each = function () {

  console.log('each');

  // one minute
  poll.locationsMaxAge = 1000 * 60;

  poll.locations();

};


poll.shouldKeepLocation = function (location, params) {
  params = params || {};

  if (! location) return false;

  var position = location.position;

  // locations without position are invalid
  // TODO: Make sure location cannot be not missing position field just after created by client.
  if (! position) {
    return false;
  }

  // positions without timestamp are invalid
  // TODO: Is this supported in all Geolocation API browsers?
  var timestamp = position.timestamp;
  if (! timestamp) {
    return false;
  }

  // if oldest is provided, then...
  if ( params.oldest && params.oldest !== 0 ) {
    // ...if older than oldest allowed, then invalid
    if ( timestamp < params.oldest ) {
      return false;
    }
  }

  return true;
}


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

      var keep = poll.shouldKeepLocation(location, {
        oldest: oldest
      });

      if (keep) {
        keepIds.push(id);
      }
      else {
        deleteIds.push(id);
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
      callback();
      return;
    }

    console.log('space', space);

    var joins = space.joins;

    if (joins) {
      async.eachSeries(
        _.keys(joins),
        function (joinId, callback) {
          var join = joins[joinId];

          if (! join) {
            deleteIds.push(joinId);
            callback();
            return;
          }

          var locationId = join.locationId;

          if (! locationId) {
            deleteIds.push(joinId);
            callback();
            return;
          }

          var locationRef = poll.locationsRef.child(locationId);

          locationRef.once('value', function (result) {
            var location = result.val();
            var keep = poll.shouldKeepLocation(location);
            if (! keep) {
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
                console.log('ok');
                callback(err, deleteIds);
              }
            );
          }
          else {
            callback(err, deleteIds);
          }
        }
      );
    }
    else {
      callback(null, deleteIds);
    }

  });

};

