var express = require('express');
var connect = require('connect');

var app = express();

app.use(connect.static('public'));

require('./service/poll');

var port = process.env.PORT || 7070;
app.listen(port);
