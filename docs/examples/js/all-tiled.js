$(function () {
  // Firefox likes to cache form values during refresh
  $( "form" )[ 0 ].reset( );

  $( "form" ).submit( function( ) {
    // also, we don't want the form to actually submit
    return false;
  } );

  // define two tiled services
  var services = [
    // a free basemap tile set from MapQuest
    {
      id: "mapquest-open",
      type: "tiled",
      src: function( view ) {
        return "http://otile" + ((view.index % 4) + 1) + ".mqcdn.com/tiles/1.0.0/osm/" + view.zoom + "/" + view.tile.column + "/" + view.tile.row + ".png";
      },
      attr: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">'
    },

    // define a second service as a layer on top of the basemap
    // we use this service as the target when "target" is set to service in this demo
    {
      id: "broadband-speedtest",
      type: "tiled",
      src: "http://www.broadbandmap.gov/StamenTiles/speedtest/speedtest/download/{{=zoom}}/{{=tile.column}}/{{=tile.row}}.png",
      attr: "Speed Test data maintained by the NTIA, in collaboration with the FCC"
    }
  ];

  // create a map with a tilingScheme & with the two tiled services
  var map = $( "#map" ).geomap( {
    // add a cursor for our custom mode: remove
    cursors: { remove: "crosshair" },

    // use the services array defined above
    services: services,

    // these tiled services are in jQuery Geo's default tilingScheme, web mercator
    // we don't need to change it but will write it here in comments, for this demo
    /*
    tilingScheme: {
      tileWidth: 256,
      tileHeight: 256,
      levels: 18,
      basePixelSize: 156543.03392799936,
      pixelSizes: null,
      origin: [ -20037508.342787, 20037508.342787 ]
    },
    */

    // center & zoom values that default to showing the contenental United States of America
    center: [ -89.34, 38.84 ],
    zoom: 5,

    bboxchange: function( e, geo ) {
      // when the bbox changes, update the info section with new option values
      updateInfo( );
    },

    shape: function( e, geo ) {
      // when the user draws a shape, show it on the map
      // the shape event triggers when the user finishes drawing a shape
      // the geo argument is a GeoJSON object representing the shape

      // for this example, we'll append it to the map forcing an
      // individual style that matches the current drawStyle

      // make a copy of the current drawStyle
      var drawStyle = $.extend( { }, map.geomap( "option", "drawStyle" ) );

      // grab the label (if any) from the input
      var label = $( "#shapeLabels input" ).val( );

      // append the shape using that style
      // however, depending on which target is checked, we will append the shape to either the map widget itself or a specific map service
      if ( $( "#clickTargetWidget" ).is( ":checked" ) ) {
        // if the map is our target, just append the shape to the map
        // if there's a label entered, used it
        map.geomap( "append", geo, drawStyle, label );
      } else {
        // otherwise, grab a reference to a service
        // ( by id in this case ) and append the shape to that
        // the value of the remaining radio buttons matches the id of a service
        // if there's a label entered, used it
        var serviceToAppend = $( "#" + $( "input[name='clickTarget']:checked" ).val( ) );

        $( serviceToAppend ).geomap( "append", geo, drawStyle, label );

        // also note, that the label is controlled seperately from the shape, by CSS, rather than by jQuery Geo shapeStyle objects
        // if you look at the CSS, you will notice:
        //
        // #broadband-speedtest { color: purple; font-weight: bold; }
        //
        // which makes all labels on the speedtest service blue text
      }
    },

    click: function( e, geo ) {
      // when the user clicks the map while in our custom mode, remove,
      // we will search for shapes on either the map widget itself
      // ( and, by design, all map services) or a single, specific map service

      // we'll use a nice, fat 5px radius for the searches here, that's what the (, 5) is below

      // however, in this demo, we remove any shapes found from either the map or service

      // if the map is our target, grab the map reference
      // otherwise, grab a reference to a service, in this case, by id
      var target = $( "#clickTargetWidget" ).is( ":checked" ) ? map : $( "#" + $( "input[name='clickTarget']:checked" ).val( ) );

      // by design, calling find on the map itself returns all shapes at that location
      // even if they have been appended to a service
      // when target is the service, find is limited to shapes that have been appended there
      var shapes = target.geomap( "find", geo, 3 );

      // even though we potentially found service-level shapes with the find method,
      // calling remove on the map does not remove from all services
      $.each( shapes, function( ) {
        target.geomap( "remove", this );
      } );
    }
  } );

  // jQuery UI for pretty buttons
  $( "button, #togglePannable" ).button( );
  $( ".modes, .scrollOptions, .clickTargets, .toggleTargets" ).buttonset( );

  $( "#toggle-info" ).click( function( ) {
    // show or hide some map info such as bbox, center and zoom
    $( "#mapInfo" ).toggle( );
  } );

  $( "#togglePannable" ).click( function( ) {
    // change the pannable option to allow users to pan or not pan your map
    map.geomap( "option", "pannable", $( this ).is( ":checked" ) );
  } );

  $( ".scrollOptions input" ).click( function( ) {
    // set the map's scroll option based on value of the input clicked
    // currently, default and scroll are the same; the only other option is off
    var scrollValue = $( this ).val( );
    map.geomap( "option", "scroll", scrollValue );

  } );

  $( "#change-mode").click( function( ) {
    // show or hide the mode options
    $( "#modeOptions" ).toggle( );
  } );

  $( ".modes input" ).click( function () {
    // set the map's mode option based on value of the input clicked
    var modeValue = $( this ).val( );
    map.geomap( "option", "mode", modeValue );

    // if mode is one of the draw modes (or remove), show the target section, otherwise hide it
    $( "#clickTarget" ).toggle( modeValue.substr( 0, 4 ) === "draw" || modeValue === "remove" );

    // if mode is one of the draw modes,
    // show the label inputs & shape style as well
    $( "#shapeLabels, #drawStyle" ).toggle( modeValue.substr( 0, 4 ) === "draw" );

    // also display the current mode on the button
    $( "#change-mode .ui-button-text" ).text( modeValue );

    // hide the mode options
    $( "#modeOptions" ).hide( );
  } );

    $( "#drawStyle input" ).change( function( ) {
      // when an input of the drawStyle area changes,
      // immediately set the property of geomap's drawStyle option

      // keep in mind that the three point-only styles (width, height & borderRadius)
      // cannot be seen because with drawPoint, the shape event triggers immediately
      // without drawing a shape
      // this example, however, does use them when appending the shape after a click

      // first, we can grab a jQuery reference to the input that changed
      var $this = $( this );

      // next, we can create an object that represents this change
      // this example doesn't, but you can set more than one property
      // on geomap's drawStyle option at a time
      var styleOption = { };
      styleOption[ $this.attr( "name" ) ] = $this.val();

      map.geomap( "option", "drawStyle", styleOption );
    } );


  $( ".toggleTargets input" ).click( function( ) {
    // when a service is toggled, we tell the geomap widget to toggle it
    // the value of each checkbox input equals the id of a service
    var checkboxClicked = $( this );
    var serviceToToggle = $( "#" + checkboxClicked.val( ) );

    // toggle the service, shapes on the service will also be toggled
    serviceToToggle.geomap( "toggle" );
  } );

  $( "#zoomOut" ).button( "option", {
    // just icons for the zoom buttons
    icons: { primary: "ui-icon-minus" },
    text: false
  } ).click( function( ) {
    // use the zoom method to zoom out
    map.geomap( "zoom", -1 );
  } );

  $( "#zoomIn" ).button( "option", {
    // just icons for the zoom buttons
    icons: { primary: "ui-icon-plus" },
    text: false
  } ).click( function( ) {
    // also use the zoom method to zoom in
    map.geomap( "zoom", +1 );
  } );

  // update the info section with initial option values
  updateInfo( );

  function updateInfo( ) {
    // update the info section with option values
    $( "#mapInfo td" ).each( function( ) {
      // a reference to the current option td element
      var optionCell = $( this );

      // since each td has a data-option attribute,
      // jQuery can extract the option value via the data function
      var optionValue = map.geomap( "option", optionCell.data( "option" ) );

      if ( $.isArray( optionValue ) ) {
        // display array values a little nicer
        $.each( optionValue, function( i ) {
          optionValue[ i ] = this.toFixed( 2 );
        } );
        optionCell.text( "[ " + optionValue.join( ", " ) + " ]" );
      } else {
        optionCell.text( optionValue );
      }
    } );
  }
});  

