(function ($, undefined) {
  $.geo._serviceTypes.tiled = (function () {
    return {
      create: function (map, serviceContainer, service, index) {
        var serviceState = $.data(service, "geoServiceState");

        if ( !serviceState ) {
          serviceState = {
            loadCount: 0,
            reloadTiles: false
          };

          var scHtml = '<div data-geo-service="tiled" style="position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0;"></div>';

          serviceContainer.append(scHtml);

          serviceState.serviceContainer = serviceContainer.children( ":last" );

          $.data(service, "geoServiceState", serviceState);
        }

        return serviceState.serviceContainer;
      },

      destroy: function (map, serviceContainer, service) {
        var serviceState = $.data(service, "geoServiceState");

        serviceState.serviceContainer.remove();

        $.removeData(service, "geoServiceState");
      },

      interactivePan: function ( map, service, dx, dy ) {
        var serviceState = $.data( service, "geoServiceState" );

        if ( serviceState ) {
          this._cancelUnloaded( map, service );

          serviceState.serviceContainer.children( ).css( "-moz-transition", "").css( {
            webkitTransition: "",
            transition: "",
            left: function ( index, value ) {
              return parseInt( value, 10 ) + dx;
            },
            top: function ( index, value ) {
              return parseInt( value, 10 ) + dy;
            }
          });

          if ( service && service.style.visibility === "visible" ) {
            var pixelSize = map._pixelSize,

                serviceObj = this,
                serviceContainer = serviceState.serviceContainer,
                scaleContainer = serviceContainer.children("[data-pixelSize='" + pixelSize + "']"),

                /* same as refresh 1 */
                contentBounds = map._getContentBounds(),
                mapWidth = contentBounds["width"],
                mapHeight = contentBounds["height"],

                image = map.options[ "axisLayout" ] === "image",
                ySign = image ? +1 : -1,

                tilingScheme = map.options["tilingScheme"],
                tileWidth = tilingScheme.tileWidth,
                tileHeight = tilingScheme.tileHeight,
                /* end same as refresh 1 */

                halfWidth = mapWidth / 2 * pixelSize,
                halfHeight = mapHeight / 2 * pixelSize,

                currentPosition = scaleContainer.position(),
                scaleOriginParts = scaleContainer.data("scaleOrigin").split(","),
                totalDx = parseInt(scaleOriginParts[0], 10) - currentPosition.left,
                totalDy = parseInt(scaleOriginParts[1], 10) - currentPosition.top,

                mapCenterOriginal = map._getCenter(),
                mapCenter = [
                  mapCenterOriginal[0] + totalDx * pixelSize,
                  mapCenterOriginal[1] + ySign * totalDy * pixelSize
                ],

                /* same as refresh 2 */
                tileX = Math.floor(((mapCenter[0] - halfWidth) - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
                tileY = Math.max( Math.floor(( image ? (mapCenter[1] - halfHeight) - tilingScheme.origin[1] : tilingScheme.origin[1] - (mapCenter[1] + halfHeight)) / (pixelSize * tileHeight)), 0 ),
                tileX2 = Math.ceil(((mapCenter[0] + halfWidth) - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
                tileY2 = Math.ceil(( image ? (mapCenter[1] + halfHeight) - tilingScheme.origin[1] : tilingScheme.origin[1] - (mapCenter[1] - halfHeight)) / (pixelSize * tileHeight)),

                bboxMax = map._getBboxMax(),
                pixelSizeAtZero = map._getPixelSize(0),
                ratio = pixelSizeAtZero / pixelSize,
                fullXAtScale = Math.floor((bboxMax[0] - tilingScheme.origin[0]) / (pixelSizeAtZero * tileWidth)) * ratio,
                fullYAtScale = Math.floor((tilingScheme.origin[1] + ySign * bboxMax[3]) / (pixelSizeAtZero * tileHeight)) * ratio,

                fullXMinX = tilingScheme.origin[0] + (fullXAtScale * tileWidth) * pixelSize,
                fullYMinOrMaxY = tilingScheme.origin[1] + ySign * (fullYAtScale * tileHeight) * pixelSize,
                /* end same as refresh 2 */

                serviceLeft = Math.round((fullXMinX - (mapCenterOriginal[0] - halfWidth)) / pixelSize),
                serviceTop = Math.round(( image ? fullYMinOrMaxY - (mapCenterOriginal[1] - halfHeight) : (mapCenterOriginal[1] + halfHeight) - fullYMinOrMaxY  ) / pixelSize),

                opacity = service.style.opacity,

                x, y,

                loadImageDeferredDone = function( url ) {
                  // when a Deferred call is done, add the image to the map
                  // a reference to the correct img element is on the Deferred object itself
                  serviceObj._loadImage( $.data( this, "img" ), url, pixelSize, serviceState, serviceContainer, opacity );
                },

                loadImageDeferredFail = function( ) {
                  $.data( this, "img" ).remove( );
                  serviceState.loadCount--;
                };

            for ( x = tileX; x < tileX2; x++ ) {
              for ( y = tileY; y < tileY2; y++ ) {
                var tileStr = "" + x + "," + y,
                    $img = scaleContainer.children("[data-tile='" + tileStr + "']").removeAttr("data-dirty");

                if ( $img.size( ) === 0 ) {
                  /* same as refresh 3 */
                  var bottomLeft = [
                        tilingScheme.origin[0] + (x * tileWidth) * pixelSize,
                        tilingScheme.origin[1] + ySign * (y * tileHeight) * pixelSize
                      ],

                      topRight = [
                        tilingScheme.origin[0] + ((x + 1) * tileWidth - 1) * pixelSize,
                        tilingScheme.origin[1] + ySign * ((y + 1) * tileHeight - 1) * pixelSize
                      ],

                      tileBbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]],

                      urlProp = ( service.hasOwnProperty("src") ? "src" : "getUrl" ),
                      urlArgs = {
                        bbox: tileBbox,
                        width: tileWidth,
                        height: tileHeight,
                        zoom: map._getZoom(),
                        tile: {
                          row: y,
                          column: x
                        },
                        index: Math.abs(y + x)
                      },
                      isFunc = $.isFunction( service[ urlProp ] ),
                      imageUrl;

                  if ( isFunc ) {
                    imageUrl = service[ urlProp ]( urlArgs );
                  } else {
                    $.templates( "geoSrc", service[ urlProp ] );
                    imageUrl = $.render[ "geoSrc" ]( urlArgs );
                  }
                  /* end same as refresh 3 */

                  serviceState.loadCount++;
                  //this._map._requestQueued();

                  if ( serviceState.reloadTiles && $img.size() > 0 ) {
                    $img.attr( "src", imageUrl );
                  } else {
                    /* same as refresh 4 */
                    var imgMarkup = "<img style='position:absolute; " +
                          "left:" + (((x - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%; " +
                          "top:" + (((y - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%; ";

                    if ($("body")[0].filters === undefined) {
                      imgMarkup += "width: 100%; height: 100%;";
                    }

                    imgMarkup += "margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;' unselectable='on' data-tile='" + tileStr + "' />";

                    scaleContainer.append( imgMarkup );
                    $img = scaleContainer.children(":last");
                  }

                  if ( typeof imageUrl === "string" ) {
                    serviceObj._loadImage( $img, imageUrl, pixelSize, serviceState, serviceContainer, opacity );
                  } else if ( imageUrl ) {
                    // assume Deferred
                    $.data( imageUrl, "img", $img );
                    imageUrl.done( loadImageDeferredDone ).fail( loadImageDeferredFail );
                  } else {
                    $img.remove( );
                  }

                  /* end same as refresh 4 */
                }
              }
            }
          }
        }
      },

      interactiveScale: function (map, service, center, pixelSize) {
        var serviceState = $.data( service, "geoServiceState" );

        if ( serviceState && service && service.style.visibility === "visible" ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,

              tilingScheme = map.options["tilingScheme"],
              tileWidth = tilingScheme.tileWidth,
              tileHeight = tilingScheme.tileHeight;


          serviceContainer.children( ).each( function ( i ) {
            var $scaleContainer = $(this),
                scaleRatio = $scaleContainer.attr("data-pixelSize") / pixelSize,
                transitionCss = ""; //"width .25s ease-in, height .25s ease-in, left .25s ease-in, top .25s ease-in";

            scaleRatio = Math.round(scaleRatio * 1000) / 1000;


            var scaleOriginParts = $scaleContainer.data("scaleOrigin").split(","),
                oldMapCoord = map._toMap([scaleOriginParts[0], scaleOriginParts[1]]),
                newPixelPoint = map._toPixel(oldMapCoord, center, pixelSize);

            $scaleContainer.css( "-moz-transition", transitionCss ).css( {
              webkitTransition: transitionCss,
              transition: transitionCss,
              left: Math.round(newPixelPoint[0]) + "px",
              top: Math.round(newPixelPoint[1]) + "px",
              width: tileWidth * scaleRatio,
              height: tileHeight * scaleRatio
            } );

            if ( $("body")[0].filters !== undefined ) {
              $scaleContainer.children().each( function ( i ) {
                $( this ).css( "filter", "progid:DXImageTransform.Microsoft.Matrix(FilterType=bilinear,M11=" + scaleRatio + ",M22=" + scaleRatio + ",sizingmethod='auto expand')" );
              } );
            }
          });
        }
      },

      refresh: function (map, service) {
        var serviceState = $.data( service, "geoServiceState" );

        this._cancelUnloaded(map, service);

        if ( serviceState && service && service.style.visibility === "visible" && !( serviceState.serviceContainer.is( ":hidden" ) ) ) {

          var bbox = map._getBbox(),
              pixelSize = map._pixelSize,

              serviceObj = this,
              $serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              image = map.options[ "axisLayout" ] === "image",
              ySign = image ? +1 : -1,

              tilingScheme = map.options["tilingScheme"],
              tileWidth = tilingScheme.tileWidth,
              tileHeight = tilingScheme.tileHeight,

              tileX = Math.floor((bbox[0] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY = Math.max( Math.floor( ( image ? bbox[1] - tilingScheme.origin[1] : tilingScheme.origin[1] - bbox[ 3 ] ) / (pixelSize * tileHeight) ), 0 ),
              tileX2 = Math.ceil((bbox[2] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY2 = Math.ceil( ( image ? bbox[3] - tilingScheme.origin[1] : tilingScheme.origin[1] - bbox[ 1 ] ) / (pixelSize * tileHeight) ),

              bboxMax = map._getBboxMax(),
              pixelSizeAtZero = map._getPixelSize(0),
              ratio = pixelSizeAtZero / pixelSize,
              fullXAtScale = Math.floor((bboxMax[0] - tilingScheme.origin[0]) / (pixelSizeAtZero * tileWidth)) * ratio,
              fullYAtScale = Math.floor((tilingScheme.origin[1] + ySign * bboxMax[3]) / (pixelSizeAtZero * tileHeight)) * ratio,

              fullXMinX = tilingScheme.origin[0] + (fullXAtScale * tileWidth) * pixelSize,
              fullYMinOrMaxY = tilingScheme.origin[1] + ySign * (fullYAtScale * tileHeight) * pixelSize,

              serviceLeft = Math.round((fullXMinX - bbox[0]) / pixelSize),
              serviceTop = Math.round( ( image ? fullYMinOrMaxY - bbox[1] : bbox[3] - fullYMinOrMaxY ) / pixelSize),

              scaleContainers = $serviceContainer.children().show(),
              scaleContainer = scaleContainers.filter("[data-pixelSize='" + pixelSize + "']").appendTo($serviceContainer),

              opacity = service.style.opacity,

              x, y,

              loadImageDeferredDone = function( url ) {
                // when a Deferred call is done, add the image to the map
                // a reference to the correct img element is on the Deferred object itself
                serviceObj._loadImage( $.data( this, "img" ), url, pixelSize, serviceState, $serviceContainer, opacity );
              },

              loadImageDeferredFail = function( ) {
                $.data( this, "img" ).remove( );
                serviceState.loadCount--;
              };

          if (serviceState.reloadTiles) {
            scaleContainers.find("img").attr("data-dirty", "true");
          }

          if (!scaleContainer.size()) {
            $serviceContainer.append("<div style='position:absolute; left:" + serviceLeft % tileWidth + "px; top:" + serviceTop % tileHeight + "px; width:" + tileWidth + "px; height:" + tileHeight + "px; margin:0; padding:0;' data-pixelSize='" + pixelSize + "'></div>");
            scaleContainer = $serviceContainer.children(":last").data("scaleOrigin", (serviceLeft % tileWidth) + "," + (serviceTop % tileHeight));
          } else {
            scaleContainer.css({
              left: (serviceLeft % tileWidth) + "px",
              top: (serviceTop % tileHeight) + "px"
            }).data("scaleOrigin", (serviceLeft % tileWidth) + "," + (serviceTop % tileHeight));

            scaleContainer.children().each(function (i) {
              var 
              $img = $(this),
              tile = $img.attr("data-tile").split(",");

              $img.css({
                left: Math.round(((parseInt(tile[0], 10) - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%",
                top: Math.round(((parseInt(tile[1], 10) - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%"
              });

              if (opacity < 1) {
                $img.fadeTo(0, opacity);
              }
            });
          }

          for (x = tileX; x < tileX2; x++) {
            for (y = tileY; y < tileY2; y++) {
              var tileStr = "" + x + "," + y,
                  $img = scaleContainer.children("[data-tile='" + tileStr + "']").removeAttr("data-dirty");

              if ($img.size() === 0 || serviceState.reloadTiles) {
                var bottomLeft = [
                      tilingScheme.origin[0] + (x * tileWidth) * pixelSize,
                      tilingScheme.origin[1] + ySign * (y * tileHeight) * pixelSize
                    ],

                    topRight = [
                      tilingScheme.origin[0] + ((x + 1) * tileWidth - 1) * pixelSize,
                      tilingScheme.origin[1] + ySign * ((y + 1) * tileHeight - 1) * pixelSize
                    ],

                    tileBbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]],

                    urlProp = ( service.hasOwnProperty( "src" ) ? "src" : "getUrl" ),
                    urlArgs = {
                      bbox: tileBbox,
                      width: tileWidth,
                      height: tileHeight,
                      zoom: map._getZoom(),
                      tile: {
                        row: y,
                        column: x
                      },
                      index: Math.abs(y + x)
                    },
                    isFunc = $.isFunction( service[ urlProp ] ),
                    imageUrl;

                if ( isFunc ) {
                  imageUrl = service[ urlProp ]( urlArgs );
                } else {
                  $.templates( "geoSrc", service[ urlProp ] );
                  imageUrl = $.render[ "geoSrc" ]( urlArgs );
                }

                serviceState.loadCount++;
                //this._map._requestQueued();

                if (serviceState.reloadTiles && $img.size() > 0) {
                  $img.attr("src", imageUrl);
                } else {
                  var imgMarkup = "<img style='position:absolute; " +
                    "left:" + (((x - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%; " +
                    "top:" + (((y - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%; ";

                  if ($("body")[0].filters === undefined) {
                    imgMarkup += "width: 100%; height: 100%;";
                  }

                  imgMarkup += "margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;' unselectable='on' data-tile='" + tileStr + "' />";

                  scaleContainer.append(imgMarkup);
                  $img = scaleContainer.children(":last");
                }

                if ( typeof imageUrl === "string" ) {
                  serviceObj._loadImage( $img, imageUrl, pixelSize, serviceState, $serviceContainer, opacity );
                } else if ( imageUrl ) {
                  // assume Deferred
                  $.data( imageUrl, "img", $img );
                  imageUrl.done( loadImageDeferredDone ).fail( loadImageDeferredFail );
                } else {
                  $img.remove( );
                }
              }
            }
          }

          scaleContainers.find("[data-dirty]").remove();
          serviceState.reloadTiles = false;
        }
      },

      resize: function (map, service) {
      },

      opacity: function ( map, service ) {
        var serviceState = $.data( service, "geoServiceState" );
        serviceState.serviceContainer.find( "img" ).stop( true ).fadeTo( "fast", service.style.opacity );
      },

      toggle: function ( map, service ) {
        var serviceState = $.data( service, "geoServiceState" );
        serviceState.serviceContainer.css( "display", service.style.visibility === "visible" ? "block" : "none" );
      },

      _cancelUnloaded: function (map, service) {
        var serviceState = $.data( service, "geoServiceState" );

        if (serviceState && serviceState.loadCount > 0) {
          serviceState.serviceContainer.find("img:hidden").remove();
          while (serviceState.loadCount > 0) {
            serviceState.loadCount--;
          }
        }
      },

      _loadImage: function ( $img, url, pixelSize, serviceState, serviceContainer, opacity ) {
        $img.load(function (e) {
          if (opacity < 1) {
            $(e.target).fadeTo(0, opacity);
          } else {
            $(e.target).show();
          }

          serviceState.loadCount--;

          if (serviceState.loadCount <= 0) {
            serviceContainer.children(":not([data-pixelSize='" + pixelSize + "'])").remove();
            serviceState.loadCount = 0;
          }
        }).error(function (e) {
          $(e.target).remove();
          serviceState.loadCount--;

          if (serviceState.loadCount <= 0) {
            serviceContainer.children(":not([data-pixelSize='" + pixelSize + "'])").remove();
            serviceState.loadCount = 0;
          }
        }).attr("src", url);
      }
    };
  }());
}(jQuery));
