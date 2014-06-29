
var ngUtil = {};


ngUtil.watchDiff = function (newNames, oldNames) {
  var added = _.pick(newNames, function (v, k) { return ! oldNames[k]; });
  var removed = _.pick(oldNames, function (v, k) { return ! newNames[k]; });

  var diff = {
    added: added,
    removed: removed
  };

  return diff;
};

