
var Mapper = function (options) {

  options = $.extend({}, options);

  this.markers = {};


  this.$el = $(options.el);


  this.map = L.map(this.$el.get(0));

  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(this.map);


  return this;
};

Mapper.prototype.setView = function (center, zoom, options) {
  // var center = Mapper.toLatLng(position.coords);
  this.map.setView(center, zoom, options);
};

Mapper.prototype.addOrUpdateMarker = function (options) {

  var position = options.position;
  var coords = position.coords;

  var id = options.id;
  var popup = options.popup;

  var latLng = Mapper.toLatLng(coords);

  var markerOptions = options.markerOptions || {};

  var existing = this.markers[id];
  var marker;

  if (existing) {
    marker = existing;
    marker.setLatLng(latLng);
  }
  else {
    marker = L.marker(latLng, markerOptions);

    if (popup) {
      console.log('bind popup', popup);
      marker.bindPopup(popup);
    }

    this.markers[id] = marker;
  }

  if (! existing) {
    marker.addTo(this.map);
  }

};


Mapper.prototype.removeMarker = function (id) {
  var marker = this.markers[id];

  if (marker) {
    this.map.removeLayer(marker);
    delete this.markers[id];
  }
};


Mapper.prototype.fit = function (pad) {
  pad = pad || 0.1;
  var markers = _.values(this.markers);
  if (markers.length) {
    var group = new L.featureGroup(markers);
    var bounds = group.getBounds();
    if (bounds) {
      bounds = bounds.pad(pad);
      this.map.fitBounds(bounds);
    }
  }
  else {
    console.error('no markers to fit');
  }
};


Mapper.prototype.showMarkerPopup = function (id) {
  var marker = this.markers[id];

  if (marker) {
    marker.openPopup();
  }
};

Mapper.prototype.closeMarkerPopup = function (id) {
  var marker = this.markers[id];

  if (marker) {
    marker.closePopup();
  }
};


Mapper.toLatLng = function (position) {
  if (position.lat && position.lng) {
    return position;
  }
  return {
    lat: position.latitude,
    lng: position.longitude
  };
};


Mapper.positionNear = function (position) {
  return {
    coords: {
      latitude: position.coords.latitude + (Math.random() > 0.5 ? 0.01 * Math.random() : -0.01 * Math.random()),
      longitude: position.coords.longitude + (Math.random() > 0.5 ? 0.01 * Math.random() : -0.01 * Math.random())
    }
  };
};

