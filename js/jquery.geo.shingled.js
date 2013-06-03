(function ($, window, undefined) {
  $.geo._serviceTypes.shingled = (function () {
    var rTmplString = new RegExp( "<.*>|{{.*}}" );

    return {
      _serviceId: 0,
      _tmplGeoSrcId: "",

      create: function ( map, serviceContainer, service /* , index */ ) {
        this._serviceId = map._serviceIdSeed++;
        this._tmplGeoSrcId = "geoSrc" + this._serviceId;

        var serviceState = $.data(service, "geoServiceState");

        if ( !serviceState ) {
          serviceState = {
            loadCount: 0
          };

          var scHtml = '<div data-geo-service="shingled" style="-webkit-transform:translateZ(0);position:absolute; left:0; top:0; width:16px; height:16px; margin:0; padding:0;"></div>';

          serviceContainer.append( window.toStaticHTML( scHtml ) );

          serviceState.serviceContainer = serviceContainer.children(":last");
          $.data(service, "geoServiceState", serviceState);
        }

        return serviceState.serviceContainer;
      },

      destroy: function (map, serviceContainer, service) {
        var serviceState = $.data(service, "geoServiceState");

        serviceState.serviceContainer.remove();

        $.removeData(service, "geoServiceState");
      },

      interactiveTransform: function ( map, service, center, pixelSize ) {
        var serviceState = $.data( service, "geoServiceState" ),

            contentBounds = map._getContentBounds(),
            mapWidth = contentBounds[ "width" ],
            mapHeight = contentBounds[ "height" ];

        if ( serviceState ) {
          this._cancelUnloaded( map, service );

          serviceState.serviceContainer.children( ).each( function ( ) {
            var $scaleContainer = $(this),
                scalePixelSize = $scaleContainer.data( "pixelSize" ),
                scaleRatio = scalePixelSize / pixelSize;
                
            if ( scalePixelSize > 0 ) {
              scaleRatio = Math.round(scaleRatio * 1000) / 1000;

              var oldMapOrigin = $scaleContainer.data( "origin" ),
                  newPixelPoint = map._toPixel( oldMapOrigin, center, pixelSize );

              $scaleContainer.css( {
                left: Math.round( newPixelPoint[ 0 ] ),
                top: Math.round( newPixelPoint[ 1 ] ),
                width: mapWidth * scaleRatio,
                height: mapHeight * scaleRatio
              } );
            }
          });
        }
      },

      refresh: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        this._cancelUnloaded(map, service);

        if ( serviceState && service && service.style.visibility === "visible" && !( serviceState.serviceContainer.is( ":hidden" ) ) ) {

          var bbox = map._getBbox(),
              pixelSize = map._pixelSize,

              serviceObj = this,
              serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              scaleContainer = serviceContainer.children('[data-pixel-size="' + pixelSize + '"]'),

              opacity = service.style.opacity,

              $img;

          if (opacity < 1) {
            serviceContainer.find("img").attr("data-keep-alive", "0");
          }

          if ( !scaleContainer.size() ) {
            serviceContainer.append( window.toStaticHTML( '<div style="-webkit-transform:translateZ(0);position:absolute; left:0px; top: 0px; width:' + mapWidth + 'px; height:' + mapHeight + 'px; margin:0; padding:0;" data-pixel-size="' + pixelSize + '" data-origin="[' + map._toMap( [ 0, 0 ] ) + ']"></div>' ) );
            scaleContainer = serviceContainer.children(":last");
          }

          var urlProp = ( service.hasOwnProperty("src") ? "src" : "getUrl" ),
              urlArgs = {
                bbox: bbox,
                width: mapWidth,
                height: mapHeight,
                zoom: map._getZoom(),
                tile: null,
                index: 0
              },
              isFunc = $.isFunction( service[ urlProp ] ),
              imageUrl,
              imagePos = scaleContainer.position( );

          imagePos.left = - ( imagePos.left );
          imagePos.top = - ( imagePos.top );

          if ( isFunc ) {
            imageUrl = service[ urlProp ]( urlArgs );
          } else {
            if ( rTmplString.test( service[ urlProp ] ) ) {
              $.templates( this._tmplGeoSrcId, service[ urlProp ] );
              imageUrl = $.render[ this._tmplGeoSrcId ]( urlArgs );
            } else {
              imageUrl = service[ urlProp ];
            }
          }

          serviceState.loadCount++;
          map._requestQueued();

          scaleContainer.append( window.toStaticHTML( '<img style="-webkit-transform:translateZ(0);position:absolute; left:' + ( imagePos.left / scaleContainer.width( ) * 100 ) + '%; top:' + ( imagePos.top / scaleContainer.height( ) * 100 ) + '%; width:100%; height:100%; margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;" unselectable="on" />' ) );
          $img = scaleContainer.children(":last").data("center", map._center);

          if ( typeof imageUrl === "string" ) {
            serviceObj._loadImage( $img, imageUrl, pixelSize, map, serviceState, opacity );
          } else {
            // assume Deferred
            imageUrl.done( function( url ) {
              serviceObj._loadImage( $img, url, pixelSize, map, serviceState, opacity );
            } ).fail( function( ) {
              $img.remove( );
              serviceState.loadCount--;
              map._requestComplete();
            } );
          }

        }
      },

      resize: function ( map, service /* , dx, dy */ ) {
        var serviceState = $.data(service, "geoServiceState");

        if ( serviceState && service && service.style.visibility === "visible" ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              scaleContainers = serviceContainer.children();

          scaleContainers.attr("data-pixel-size", "0");

          scaleContainers.each( function ( ) {
            var $scaleContainer = $(this),
                position = $scaleContainer.position( );

            $scaleContainer.css( {
              left: position.left + ( mapWidth - $scaleContainer.width( ) ) / 2,
              top: position.top + ( mapHeight - $scaleContainer.height( ) ) / 2
            } );

          } );
        }
      },

      opacity: function ( map, service ) {
        var serviceState = $.data( service, "geoServiceState" );
        serviceState.serviceContainer.find( "img" ).stop( true ).fadeTo( "fast", service.style.opacity );
      },

      toggle: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");
        serviceState.serviceContainer.css("display", service.style.visibility === "visible" ? "block" : "none");
      },

      _cancelUnloaded: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        if (serviceState && serviceState.loadCount > 0) {
          serviceState.serviceContainer.find("img:hidden").remove();
          while (serviceState.loadCount > 0) {
            serviceState.loadCount--;
            map._requestComplete();
          }
        }
      },

      _loadImage: function ( $img, url, pixelSize, map, serviceState, opacity ) {
        var serviceContainer = serviceState.serviceContainer;

        $img.load(function (e) {
          if ( !$.contains(document.body, e.target.jquery ? e.target[0] : e.target) ) {
            // this image has been canceled and removed from the DOM
            return;
          }

          if (opacity < 1) {
            $(e.target).fadeTo(0, opacity);
          } else {
            $(e.target).show();
          }

          serviceState.loadCount--;
          map._requestComplete();

          if (serviceState.loadCount <= 0) {
            // #newpanzoom
            serviceContainer.children(':not([data-pixel-size="' + pixelSize + '"])').remove();

            serviceContainer.find( "img[data-keep-alive]" ).remove( );

            serviceState.loadCount = 0;
          }
        }).error(function (e) {
          if ( !$.contains(document.body, e.target.jquery ? e.target[0] : e.target) ) {
            // this image has been canceled and removed from the DOM
            return;
          }

          $(e.target).remove();
          serviceState.loadCount--;
          map._requestComplete();

          if (serviceState.loadCount <= 0) {
            serviceContainer.children(":not([data-pixel-size='" + pixelSize + "'])").remove();
            serviceState.loadCount = 0;
          }
        }).attr("src", url);
      }
    };
  }());
}(jQuery, window));
