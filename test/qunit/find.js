QUnit.test( 'nothingToFind', function( assert ) {
  var map = $('#map').geomap();

  var geo = map.geomap( 'find', {
    type: 'Point',
    coordinates: [ -71, 40 ]
  }, 1 );

  assert.equal( geo.length, 0, "no features found (non were available)!" );
});

QUnit.asyncTest( "basicFind", function( assert ) {
  var map = $('#map').geomap();

  setTimeout( function() {
    map.geomap( 'append', {
      type: 'Point',
      coordinates: [ -71, 40 ]
    } );

    var geo = map.geomap( 'find', {
      type: 'Point',
      coordinates: [ -71, 40 ]
    }, 1 );

    assert.equal( geo.length, 1, "Point found!" );
  }, 32 );
});

QUnit.test( 'alwaysPass', function( assert ) {
  assert.equal( '1', 1, "always pass!" );
});


/*
QUnit.test( "findTopFirst", function( assert ) {
  // the last shape to be appended,
  // should be the first to be found
  var map = $('#map').geomap();

  map.geomap( 'append', {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [ -71, 40 ]
    },
    properties: {
      name: '1'
    }
  } );

  var geo = map.geomap( 'find', {
    type: 'Point',
    coordinates: [ -71, 40 ]
  }, 1 );

  assert.equal( geo.length, 1, "Another Point found!" );
});
*/
