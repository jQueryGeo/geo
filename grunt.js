config.init( {
  lint: {
    files: [ "js/jquery.geo.core.js" ]
  }
} );

task.registerTask( "default", "lint" );
