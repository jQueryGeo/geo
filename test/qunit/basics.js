QUnit.test( "create", function( assert ) {
  $('#map').geomap();

  assert.equal( $( '.geo-service' ).length, 1, "map created successfully!" );

});

QUnit.test( "destroy", function( assert ) {
  var map = $('#map').geomap();

  map.geomap( 'destroy' );

  assert.equal( $( '.geo-service' ).length, 0, "map gone!" );

  assert.equal( $( 'div', $( "#qunit-fixture" ) ).length, 1, 'everything gone!' );
});

