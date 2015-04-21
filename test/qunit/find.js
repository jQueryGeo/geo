QUnit.test( "find", function( assert ) {
  $('#map').geomap();

  assert.equal( $( '.geo-service' ).length, 1, "map created successfully!" );

});

QUnit.test( "find2", function( assert ) {
  $('#map').geomap();

  assert.equal( $( '.geo-service' ).length, 1, "map created successfully!" );
});

