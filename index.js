var express = require('express');
var connect = require('connect');

var app = express();

app.use(connect.static('public'));

/**
 * Clients will request that a space be refreshed.
 */
app.get('/poll/spaces/:id', function (req, res, next) {

  var spaceId = req.params.id;

  poll.space(spaceId, function (err, deleteIds) {
    res.json({
      ok: true,
      deleted: deleteIds
    });
  });

});


var port = process.env.PORT || 7070;
app.listen(port);


var poll = require('./service/poll');
poll.start();

