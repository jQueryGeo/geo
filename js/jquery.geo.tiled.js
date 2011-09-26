(function ($, undefined) {
  $.geo._serviceTypes.tiled = (function () {
    var tiledServicesState = {};

    return {
      create: function (map, servicesContainer, service, index) {
        if (!tiledServicesState[service.id]) {
          tiledServicesState[service.id] = {
            loadCount: 0,
            reloadTiles: false,
            serviceContainer: null
          };

          var scHtml = '<div data-geo-service="tiled" id="' + service.id + '" style="position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0; display:' + (service.visible === undefined || service.visible ? "block" : "none") + ';"></div>';
          servicesContainer.append(scHtml);

          return (tiledServicesState[service.id].serviceContainer = servicesContainer.children(":last"));
        }
      },

      destroy: function (map, servicesContainer, service) {
        tiledServicesState[service.id].serviceContainer.remove();
        delete tiledServicesState[service.id];
      },

      interactivePan: function (map, service, dx, dy) {
        if (!tiledServicesState[service.id]) {
          return;
        }

        this._cancelUnloaded(map, service);
        tiledServicesState[service.id].serviceContainer.children().css({
          left: function (index, value) {
            return parseInt(value) + dx;
          },
          top: function (index, value) {
            return parseInt(value) + dy;
          }
        });

        if (service && tiledServicesState[service.id] != null && (service.visible === undefined || service.visible)) {

          var 
          pixelSize = map.getPixelSize(),

          serviceState = tiledServicesState[service.id],
          serviceContainer = serviceState.serviceContainer,
          scaleContainer = serviceContainer.children("[data-pixelSize='" + pixelSize + "']"),

          /* same as refresh 1 */
          contentBounds = map._getContentBounds(),
          mapWidth = contentBounds["width"],
          mapHeight = contentBounds["height"],

          tilingScheme = map.options["tilingScheme"],
          tileWidth = tilingScheme.tileWidth,
          tileHeight = tilingScheme.tileHeight,
          /* end same as refresh 1 */

          halfWidth = mapWidth / 2 * pixelSize,
          halfHeight = mapHeight / 2 * pixelSize,

          currentPosition = scaleContainer.position(),
          scaleOriginParts = scaleContainer.data("scaleOrigin").split(","),
          totalDx = parseInt(scaleOriginParts[0]) - currentPosition.left,
          totalDy = parseInt(scaleOriginParts[1]) - currentPosition.top,

          mapCenterOriginal = map._getCenter(),
          mapCenter = [mapCenterOriginal[0] + totalDx * pixelSize, mapCenterOriginal[1] - totalDy * pixelSize],

          /* same as refresh 2 */
          tileX = Math.floor(((mapCenter[0] - halfWidth) - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
          tileY = Math.floor((tilingScheme.origin[1] - (mapCenter[1] + halfHeight)) / (pixelSize * tileHeight)),
          tileX2 = Math.ceil(((mapCenter[0] + halfWidth) - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
          tileY2 = Math.ceil((tilingScheme.origin[1] - (mapCenter[1] - halfHeight)) / (pixelSize * tileHeight)),

          bboxMax = map._getBboxMax(),
          pixelSizeAtZero = map._getTiledPixelSize(0),
          ratio = pixelSizeAtZero / pixelSize,
          fullXAtScale = Math.floor((bboxMax[0] - tilingScheme.origin[0]) / (pixelSizeAtZero * tileWidth)) * ratio,
          fullYAtScale = Math.floor((tilingScheme.origin[1] - bboxMax[3]) / (pixelSizeAtZero * tileHeight)) * ratio,

          fullXMinX = tilingScheme.origin[0] + (fullXAtScale * tileWidth) * pixelSize,
          fullYMaxY = tilingScheme.origin[1] - (fullYAtScale * tileHeight) * pixelSize,
          /* end same as refresh 2 */

          serviceLeft = Math.round((fullXMinX - (mapCenterOriginal[0] - halfWidth)) / pixelSize),
          serviceTop = Math.round(((mapCenterOriginal[1] + halfHeight) - fullYMaxY) / pixelSize),

          opacity = (service.opacity === undefined ? 1 : service.opacity),

          x, y;

          for (x = tileX; x < tileX2; x++) {
            for (y = tileY; y < tileY2; y++) {
              var 
              tileStr = "" + x + "," + y,
              $img = scaleContainer.children("[data-tile='" + tileStr + "']").removeAttr("data-dirty");

              if ($img.size() === 0) {
                /* same as refresh 3 */
                var bottomLeft = [
                  tilingScheme.origin[0] + (x * tileWidth) * pixelSize,
                  tilingScheme.origin[1] - (y * tileHeight) * pixelSize
                ],

                topRight = [
                  tilingScheme.origin[0] + ((x + 1) * tileWidth - 1) * pixelSize,
                  tilingScheme.origin[1] - ((y + 1) * tileHeight - 1) * pixelSize
                ],

                tileBbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]],

                imageUrl = service.getUrl({
                  bbox: tileBbox,
                  width: tileWidth,
                  height: tileHeight,
                  zoom: map._getZoom(),
                  tile: {
                    row: y,
                    column: x
                  },
                  index: Math.abs(y + x)
                });
                /* end same as refresh 3 */

                serviceState.loadCount++;
                //this._map._requestQueued();

                if (serviceState.reloadTiles && $img.size() > 0) {
                  $img.attr("src", imageUrl);
                } else {
                  /* same as refresh 4 */
                  var imgMarkup = "<img style='position:absolute; " +
                    "left:" + (((x - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%; " +
                    "top:" + (((y - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%; ";

                  if ($("body")[0].filters === undefined) {
                    imgMarkup += "width: 100%; height: 100%;";
                  }

                  imgMarkup += "margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;' unselectable='on' data-tile='" + tileStr + "' />";

                  scaleContainer.append(imgMarkup);
                  $img = scaleContainer.children(":last");
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
                  }).attr("src", imageUrl);
                  /* end same as refresh 4 */
                }
              }
            }
          }
        }
      },

      interactiveScale: function (map, service, center, pixelSize) {
        if (!tiledServicesState[service.id]) {
          return;
        }

        this._cancelUnloaded(map, service);

        var 
        serviceContainer = tiledServicesState[service.id].serviceContainer,

        tilingScheme = map.options["tilingScheme"],
        tileWidth = tilingScheme.tileWidth,
        tileHeight = tilingScheme.tileHeight;


        serviceContainer.children().each(function (i) {
          var 
          $scaleContainer = $(this),
          scaleRatio = $scaleContainer.attr("data-pixelSize") / pixelSize;

          scaleRatio = Math.round(scaleRatio * 1000) / 1000;

          var 
          scaleOriginParts = $scaleContainer.data("scaleOrigin").split(","),
          oldMapCoord = map._toMap([scaleOriginParts[0], scaleOriginParts[1]]),
          newPixelPoint = map._toPixel(oldMapCoord, center, pixelSize);

          $scaleContainer.css({
            left: Math.round(newPixelPoint[0]) + "px",
            top: Math.round(newPixelPoint[1]) + "px",
            width: tileWidth * scaleRatio,
            height: tileHeight * scaleRatio
          });

          if ($("body")[0].filters !== undefined) {
            $scaleContainer.children().each(function (i) {
              $(this).css("filter", "progid:DXImageTransform.Microsoft.Matrix(FilterType=bilinear,M11=" + scaleRatio + ",M22=" + scaleRatio + ",sizingmethod='auto expand')");
            });
          }
        });
      },

      refresh: function (map, service) {
        if (service && tiledServicesState[service.id] && (service.visible === undefined || service.visible)) {
          this._cancelUnloaded(map, service);

          var bbox = map._getBbox(),
              pixelSize = map.getPixelSize(),

              serviceState = tiledServicesState[service.id],
              $serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              tilingScheme = map.options["tilingScheme"],
              tileWidth = tilingScheme.tileWidth,
              tileHeight = tilingScheme.tileHeight,

              tileX = Math.floor((bbox[0] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY = Math.floor((tilingScheme.origin[1] - bbox[3]) / (pixelSize * tileHeight)),
              tileX2 = Math.ceil((bbox[2] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY2 = Math.ceil((tilingScheme.origin[1] - bbox[1]) / (pixelSize * tileHeight)),

              bboxMax = map._getBboxMax(),
              pixelSizeAtZero = map._getTiledPixelSize(0),
              ratio = pixelSizeAtZero / pixelSize,
              fullXAtScale = Math.floor((bboxMax[0] - tilingScheme.origin[0]) / (pixelSizeAtZero * tileWidth)) * ratio,
              fullYAtScale = Math.floor((tilingScheme.origin[1] - bboxMax[3]) / (pixelSizeAtZero * tileHeight)) * ratio,

              fullXMinX = tilingScheme.origin[0] + (fullXAtScale * tileWidth) * pixelSize,
              fullYMaxY = tilingScheme.origin[1] - (fullYAtScale * tileHeight) * pixelSize,

              serviceLeft = Math.round((fullXMinX - bbox[0]) / pixelSize),
              serviceTop = Math.round((bbox[3] - fullYMaxY) / pixelSize),

              scaleContainers = $serviceContainer.children().show(),
              scaleContainer = scaleContainers.filter("[data-pixelSize='" + pixelSize + "']").appendTo($serviceContainer),

              opacity = (service.opacity === undefined ? 1 : service.opacity),

              x, y;

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
                left: Math.round(((parseInt(tile[0]) - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%",
                top: Math.round(((parseInt(tile[1]) - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%"
              });

              if (opacity < 1) {
                $img.fadeTo(0, opacity);
              }
            });
          }

          for (x = tileX; x < tileX2; x++) {
            for (y = tileY; y < tileY2; y++) {
              var 
              tileStr = "" + x + "," + y,
              $img = scaleContainer.children("[data-tile='" + tileStr + "']").removeAttr("data-dirty");

              if ($img.size() === 0 || serviceState.reloadTiles) {
                var bottomLeft = [
                  tilingScheme.origin[0] + (x * tileWidth) * pixelSize,
                  tilingScheme.origin[1] - (y * tileHeight) * pixelSize
                ],

                topRight = [
                  tilingScheme.origin[0] + ((x + 1) * tileWidth - 1) * pixelSize,
                  tilingScheme.origin[1] - ((y + 1) * tileHeight - 1) * pixelSize
                ],

                tileBbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]],

                imageUrl = service.getUrl({
                  bbox: tileBbox,
                  width: tileWidth,
                  height: tileHeight,
                  zoom: map._getZoom(),
                  tile: {
                    row: y,
                    column: x
                  },
                  index: Math.abs(y + x)
                });

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
                  $img.load(function (e) {
                    if (opacity < 1) {
                      $(e.target).fadeTo(0, opacity);
                    } else {
                      $(e.target).show();
                    }

                    serviceState.loadCount--;

                    if (serviceState.loadCount <= 0) {
                      $serviceContainer.children(":not([data-pixelSize='" + pixelSize + "'])").remove();
                      serviceState.loadCount = 0;
                    }
                  }).error(function (e) {
                    $(e.target).remove();
                    serviceState.loadCount--;

                    if (serviceState.loadCount <= 0) {
                      $serviceContainer.children(":not([data-pixelSize='" + pixelSize + "'])").remove();
                      serviceState.loadCount = 0;
                    }
                  }).attr("src", imageUrl);
                }
              }
            }
          }

          scaleContainers.find("[data-dirty]").remove();
          serviceState.reloadTiles = false;
        }
      },

      opacity: function (map, service) {
        // service.opacity has changed, update any existing images
        var serviceState = tiledServicesState[service.id];
        serviceState.serviceContainer.find("img").stop(true).fadeTo("fast", service.opacity);
      },

      toggle: function (map, service) {
        // service.visible has changed, update our service container
        var serviceState = tiledServicesState[service.id];
        serviceState.serviceContainer.css("display", service.visible ? "block" : "none");
      },

      _cancelUnloaded: function (map, service) {
        var serviceState = tiledServicesState[service.id];

        if (serviceState && serviceState.loadCount > 0) {
          serviceState.serviceContainer.find("img:hidden").remove();
          while (serviceState.loadCount > 0) {
            serviceState.loadCount--;
          }
        }
      }
    };
  })();
})(jQuery);
