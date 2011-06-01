(function ($, undefined) {

  var 
  // private widget members
  _$elem,

  _contentBounds = {},

  _$contentFrame,
  _$servicesContainer,
  _$graphicsContainer,
  _$textContainer,
  _$textContent,
  _$eventTarget,

  _dpi = 96,

  _currentServices = [], //< internal copy

  _center,
  _pixelSize,
  _centerMax,
  _pixelSizeMax,

  _wheelZoomFactor = 1.18920711500273,
  _wheelTimer = null,
  _wheelLevel = 0,

  _zoomFactor = 2,

  _mouseDown,
  _inOp,
  _toolPan,
  _shiftZoom,
  _anchor,
  _current,
  _downDate,
  _moveDate,
  _clickDate,
  _lastMove,
  _lastDrag,

  _panning,
  _velocity,
  _friction,

  _ieVersion = (function () {
    var v = 5, div = document.createElement("div"), a = div.all || [];
    while (div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->", a[0]) { }
    return v > 6 ? v : !v;
  } ()),

  _supportTouch,
  _softDblClick,
  _isTap,
  _isDbltap,

  _graphicShapes = [], //< an array of objects containing style object refs & GeoJSON object refs

  _initOptions = {},

  _options = {},

  _defaultOptions = {
    bbox: [-180, -85, 180, 85],
    bboxMax: [-180, -85, 180, 85],
    center: [0, 0],
    cursors: {
      pan: "move"
    },
    mode: "pan",
    services: [
        {
          id: "OSM",
          type: "tiled",
          getUrl: function (view) {
            return "http://tile.openstreetmap.org/" + view.zoom + "/" + view.tile.column + "/" + view.tile.row + ".png";
          },
          attr: "&copy; OpenStreetMap &amp; contributors, CC-BY-SA"
        }
      ],
    tilingScheme: {
      tileWidth: 256,
      tileHeight: 256,
      levels: 18,
      basePixelSize: 156543.03392799936,
      origin: [-20037508.342787, 20037508.342787]
    },
    zoom: 0,

    _serviceTypes: {
      tiled: (function () {
        var tiledServicesState = {};

        return {
          create: function (map, service, index) {
            if (!tiledServicesState[service.id]) {
              tiledServicesState[service.id] = {
                loadCount: 0,
                reloadTiles: false,
                serviceContainer: null
              };

              var scHtml = "<div data-service='" + service.id + "' style='position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0; display:" + (service.visible === undefined || service.visible ? "block" : "none") + ";'></div>";
              _$servicesContainer.append(scHtml);

              tiledServicesState[service.id].serviceContainer = _$servicesContainer.children("[data-service='" + service.id + "']");
            }
          },

          destroy: function (map, service) {
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
              pixelSize = _pixelSize,

              serviceState = tiledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,
              scaleContainer = serviceContainer.children("[data-pixelSize='" + pixelSize + "']"),

              /* same as refresh 1 */
              mapWidth = _contentBounds["width"],
              mapHeight = _contentBounds["height"],

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

              mapCenterOriginal = _center,
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

              var 
              bbox = map._getBbox(),
              pixelSize = _pixelSize,

              serviceState = tiledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,

              mapWidth = _contentBounds["width"],
              mapHeight = _contentBounds["height"],

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

              scaleContainers = serviceContainer.children().show(),
              scaleContainer = scaleContainers.filter("[data-pixelSize='" + pixelSize + "']").appendTo(serviceContainer),

              opacity = (service.opacity === undefined ? 1 : service.opacity),

              x, y;

              if (serviceState.reloadTiles) {
                scaleContainers.find("img").attr("data-dirty", "true");
              }

              if (!scaleContainer.size()) {
                serviceContainer.append("<div style='position:absolute; left:" + serviceLeft % tileWidth + "px; top:" + serviceTop % tileHeight + "px; width:" + tileWidth + "px; height:" + tileHeight + "px; margin:0; padding:0;' data-pixelSize='" + pixelSize + "'></div>");
                scaleContainer = serviceContainer.children(":last").data("scaleOrigin", (serviceLeft % tileWidth) + "," + (serviceTop % tileHeight));
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
                    }
                  }
                }
              }

              scaleContainers.find("[data-dirty]").remove();
              serviceState.reloadTiles = false;
            }
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
      })(),

      shingled: (function () {
        var shingledServicesState = {};

        return {
          create: function (map, service, index) {
            if (!shingledServicesState[service.id]) {
              shingledServicesState[service.id] = {
                loadCount: 0
              };

              var scHtml = '<div data-service="' + service.id + '" style="position:absolute; left:0; top:0; width:16px; height:16px; margin:0; padding:0; display:' + (service.visible === undefined || service.visible ? "block" : "none") + ';"></div>';
              _$servicesContainer.append(scHtml);

              shingledServicesState[service.id].serviceContainer = _$servicesContainer.children('[data-service="' + service.id + '"]');
            }
          },

          destroy: function (map, service) {
            shingledServicesState[service.id].serviceContainer.remove();
            delete shingledServicesState[service.id];
          },

          interactivePan: function (map, service, dx, dy) {
            if (!shingledServicesState[service.id]) {
              return;
            }

            this._cancelUnloaded(map, service);

            var 
            serviceState = shingledServicesState[service.id],
            serviceContainer = serviceState.serviceContainer,
            scaleContainer = serviceContainer.children("[data-pixelSize='" + _pixelSize + "']"),
            panContainer = scaleContainer.children("div");

            if (!panContainer.length) {
              scaleContainer.children("img").wrap('<div style="position:absolute; left:0; top:0; width:100%; height:100%;"></div>');
              panContainer = scaleContainer.children("div");
            }

            panContainer.css({
              left: function (index, value) {
                return parseInt(value) + dx;
              },
              top: function (index, value) {
                return parseInt(value) + dy;
              }
            });
          },

          interactiveScale: function (map, service, center, pixelSize) {
            if (!shingledServicesState[service.id]) {
              return;
            }

            this._cancelUnloaded(map, service);

            var 
            serviceState = shingledServicesState[service.id],
            serviceContainer = serviceState.serviceContainer,

            mapWidth = _contentBounds["width"],
            mapHeight = _contentBounds["height"],

            halfWidth = mapWidth / 2,
            halfHeight = mapHeight / 2,

            bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight];

            serviceContainer.children().each(function (i) {
              var 
              $scaleContainer = $(this),
              scalePixelSize = $scaleContainer.attr("data-pixelSize"),
              ratio = scalePixelSize / pixelSize;

              $scaleContainer.css({ width: mapWidth * ratio, height: mapHeight * ratio }).children("img").each(function (i) {
                var 
                $img = $(this),
                imgCenter = $img.data("center"),
                x = (Math.round((imgCenter[0] - center[0]) / scalePixelSize) - halfWidth) * ratio,
                y = (Math.round((center[1] - imgCenter[1]) / scalePixelSize) - halfHeight) * ratio;

                $img.css({ left: x + "px", top: y + "px" });
              });
            });
          },

          refresh: function (map, service) {
            if (service && shingledServicesState[service.id] && (service.visible === undefined || service.visible)) {
              this._cancelUnloaded(map, service);

              var 
              bbox = map._getBbox(),
              pixelSize = _pixelSize,

              serviceState = shingledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,

              mapWidth = _contentBounds["width"],
              mapHeight = _contentBounds["height"],

              halfWidth = mapWidth / 2,
              halfHeight = mapHeight / 2,

              scaleContainer = serviceContainer.children('[data-pixelSize="' + pixelSize + '"]'),

              opacity = (service.opacity === undefined ? 1 : service.opacity),

              $img;

              if (!scaleContainer.size()) {
                serviceContainer.append('<div style="position:absolute; left:' + halfWidth + 'px; top:' + halfHeight + 'px; width:' + mapWidth + 'px; height:' + mapHeight + 'px; margin:0; padding:0;" data-pixelSize="' + pixelSize + '"></div>');
                scaleContainer = serviceContainer.children(":last");
              }

              scaleContainer.children("img").each(function (i) {
                var 
                $thisimg = $(this),
                imgCenter = $thisimg.data("center"),
                x = Math.round((imgCenter[0] - _center[0]) / pixelSize) - halfWidth,
                y = Math.round((_center[1] - imgCenter[1]) / pixelSize) - halfHeight;

                $thisimg.css({ left: x + "px", top: y + "px" });
              });

              if (opacity < 1) {
                serviceContainer.find("img").attr("data-keepAlive", "0");
              }

              var 
              imageUrl = service.getUrl({
                bbox: bbox,
                width: mapWidth,
                height: mapHeight,
                zoom: map._getZoom(),
                tile: null,
                index: 0
              });

              serviceState.loadCount++;
              //this._map._requestQueued();

              scaleContainer.append('<img style="position:absolute; left:-' + halfWidth + 'px; top:-' + halfHeight + 'px; width:100%; height:100%; margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;" unselectable="on" />');
              $img = scaleContainer.children(":last").data("center", _center);
              $img.load(function (e) {
                if (opacity < 1) {
                  $(e.target).fadeTo(0, opacity);
                } else {
                  $(e.target).show();
                }

                serviceState.loadCount--;

                if (serviceState.loadCount <= 0) {
                  serviceContainer.children(':not([data-pixelSize="' + pixelSize + '"])').remove();

                  var panContainer = serviceContainer.find('[data-pixelSize="' + pixelSize + '"]>div');
                  if (panContainer.size() > 0) {
                    var panContainerPos = panContainer.position();

                    panContainer.children("img").each(function (i) {
                      var 
                      $thisimg = $(this),
                      x = panContainerPos.left + parseInt($thisimg.css("left")),
                      y = panContainerPos.top + parseInt($thisimg.css("top"));

                      $thisimg.css({ left: x + "px", top: y + "px" });
                    }).unwrap();

                    panContainer.remove();
                  }

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
            }
          },

          _cancelUnloaded: function (map, service) {
            var serviceState = shingledServicesState[service.id];

            if (serviceState && serviceState.loadCount > 0) {
              serviceState.serviceContainer.find("img:hidden").remove();
              while (serviceState.loadCount > 0) {
                serviceState.loadCount--;
              }
            }
          }
        }
      })()
    }
  };

  $.widget("geo.geomap", (function () {
    return {
      options: $.extend({}, _defaultOptions),

      _createWidget: function (options, element) {
        _initOptions = options;
        _$elem = $(element);

        this._forcePosition(_$elem);

        _$elem.css("text-align", "left");

        var size = this._findMapSize();
        _contentBounds = {
          x: parseInt(_$elem.css("padding-left")),
          y: parseInt(_$elem.css("padding-top")),
          width: size["width"],
          height: size["height"]
        };

        this._createChildren();

        _center = _centerMax = [0, 0];

        _pixelSize = _pixelSizeMax = 156543.03392799936;

        _mouseDown =
        _inOp =
        _toolPan =
        _shiftZoom =
        _panning =
        _isTap =
        _isDbltap = false;

        _anchor =
        _current =
        _lastMove =
        _lastDrag =
        _velocity = [0, 0];

        _friction = [.8, .8];

        _downDate =
        _moveDate =
        _clickDate = 0;

        $.Widget.prototype._createWidget.apply(this, arguments);
      },

      _create: function () {
        _options = this.options;

        _supportTouch = "ontouchend" in document;
        _softDblClick = _supportTouch || _ieVersion == 7;

        var 
        touchStartEvent = _supportTouch ? "touchstart" : "mousedown",
    	  touchStopEvent = _supportTouch ? "touchend touchcancel" : "mouseup",
    	  touchMoveEvent = _supportTouch ? "touchmove" : "mousemove";

        _$eventTarget.dblclick($.proxy(this._eventTarget_dblclick, this));
        _$eventTarget.bind(touchStartEvent, $.proxy(this._eventTarget_touchstart, this));

        var dragTarget = (_$eventTarget[0].setCapture) ? _$eventTarget : $(document);
        dragTarget.bind(touchMoveEvent, $.proxy(this._dragTarget_touchmove, this));
        dragTarget.bind(touchStopEvent, $.proxy(this._dragTarget_touchstop, this));

        _$eventTarget.mousewheel($.proxy(this._eventTarget_mousewheel, this));

        _$graphicsContainer.geographics();

        if (_initOptions) {
          if (_initOptions.bbox) {
            this._setOption("bbox", _initOptions.bbox, false);
          }
          if (_initOptions.center) {
            this._setOption("center", _initOptions.center, false);
          }
          if (_initOptions.zoom) {
            this._setZoom(_initOptions.zoom, false, false);
          }
        }

        _$eventTarget.css("cursor", _options["cursors"][_options["mode"]]);

        this._createServices();

        this._refresh();
      },

      _setOption: function (key, value, refresh) {
        refresh = (refresh === undefined || refresh);

        switch (key) {
          case "bbox":
            if ($.geo.proj) {
              value = $.geo.proj.fromGeodetic([[value[0], value[1]], [value[2], value[3]]]);
              value = [value[0][0], value[0][1], value[1][0], value[1][1]];
            }

            this._setBbox(value, false, refresh);
            value = this._getBbox();

            if ($.geo.proj) {
              value = $.geo.proj.toGeodetic([[value[0], value[1]], [value[2], value[3]]]);
              value = [value[0][0], value[0][1], value[1][0], value[1][1]];
            }
            break;

          case "center":
            this._setCenterAndSize($.geo.proj ? $.geo.proj.fromGeodetic([[value[0], value[1]]])[0] : value, _pixelSize, false, refresh);
            break;

          case "zoom":
            this._setZoom(value, false, refresh);
            break;
        }

        $.Widget.prototype._setOption.apply(this, arguments);

        switch (key) {
          case "services":
            this._createServices();
            if (refresh) {
              this._refresh();
            }
            break;
        }
      },

      destroy: function () {
        $.Widget.prototype.destroy.apply(this, arguments);
        this.element.html("");
      },

      getPixelSize: function () {
        return _pixelSize;
      },

      toMap: function (p) {
        p = this._toMap(p);
        return $.geo.proj ? $.geo.proj.toGeodetic(p) : p;
      },

      toPixel: function (p) {
        p = $.geo.proj ? $.geo.proj.fromGeodetic(p) : p;
        return this._toPixel(p);
      },

      addShape: function (shape, style, refresh /* internal */) {
        refresh = (refresh === undefined || refresh);

        if (shape) {
          var shapes, map = this;
          if (shape.type == "FeatureCollection") {
            shapes = shape.features;
          } else {
            shapes = $.isArray(shape) ? shape : [shape];
          }

          $.each(shapes, function () {
            if (this.type == "GeometryCollection") {
              map.addShape(this.geometries, style, false);
            } else {
              _graphicShapes[_graphicShapes.length] = {
                shape: this,
                style: style
              };
            }
          });

          if (refresh) {
            this._refresh();
          }
        }
      },


      _getBbox: function () {
        // calculate the internal bbox
        var halfWidth = _contentBounds["width"] / 2 * _pixelSize,
        halfHeight = _contentBounds["height"] / 2 * _pixelSize;
        return [_center[0] - halfWidth, _center[1] - halfHeight, _center[0] + halfWidth, _center[1] + halfHeight];
      },

      _setBbox: function (value, trigger, refresh) {
        var center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2],
          pixelSize = Math.max($.geo._width(value) / _contentBounds.width, $.geo._height(value) / _contentBounds.height);

        if (_options["tilingScheme"]) {
          var zoom = this._getTiledZoom(pixelSize);
          pixelSize = this._getTiledPixelSize(zoom);
        }
        this._setCenterAndSize(center, pixelSize, trigger, refresh);
      },

      _getBboxMax: function () {
        // calculate the internal bboxMax
        var halfWidth = _contentBounds["width"] / 2 * _pixelSizeMax,
        halfHeight = _contentBounds["height"] / 2 * _pixelSizeMax;
        return [_centerMax[0] - halfWidth, _centerMax[1] - halfHeight, _centerMax[0] + halfWidth, _centerMax[1] + halfHeight];
      },

      _getZoom: function () {
        // calculate the internal zoom level, vs. public zoom property
        if (_options["tilingScheme"]) {
          return this._getTiledZoom(_pixelSize);
        } else {
          var ratio = _contentBounds["width"] / _contentBounds["height"],
          bbox = $.geo._reaspect(this._getBbox(), ratio),
          bboxMax = $.geo._reaspect(this._getBboxMax(), ratio);

          return Math.log($.geo._width(bboxMax) / $.geo._width(bbox)) / Math.log(_zoomFactor);
        }
      },

      _setZoom: function (value, trigger, refresh) {
        value = Math.max(value, 0);

        if (_options["tilingScheme"]) {
          this._setCenterAndSize(_center, this._getTiledPixelSize(value), trigger, refresh);
        } else {
          var 
          bbox = $.geo._scaleBy(this._getBbox(), 1 / Math.pow(_zoomFactor, value)),
          pixelSize = Math.max($.geo._width(bbox) / _contentBounds.width, $.geo._height(bbox) / _contentBounds.height);
          this._setCenterAndSize(_center, pixelSize, trigger, refresh);
        }
      },

      _createChildren: function () {
        var existingChildren = _$elem.children().detach();

        this._forcePosition(existingChildren);

        existingChildren.css("-moz-user-select", "none");

        _$elem.prepend("<div style='position:absolute; left:" + _contentBounds.x + "px; top:" + _contentBounds.y + "px; width:" + _contentBounds["width"] + "px; height:" + _contentBounds["height"] + "px; margin:0; padding:0; overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;' unselectable='on'></div>");
        _$eventTarget = _$contentFrame = _$elem.children(':first');

        _$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + _contentBounds["width"] + 'px; height:' + _contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
        _$servicesContainer = _$contentFrame.children(':last');

        _$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + _contentBounds["width"] + 'px; height:' + _contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
        _$graphicsContainer = _$contentFrame.children(':last');

        _$contentFrame.append('<div class="ui-widget ui-widget-content ui-corner-all" style="position:absolute; left:0; top:0px; max-width:128px; display:none;"><div style="margin:.2em;"></div></div>');
        _$textContainer = _$contentFrame.children(':last');
        _$textContent = _$textContainer.children();

        _$contentFrame.append(existingChildren);
      },

      _createServices: function () {
        var i;
        for (i = 0; i < _currentServices.length; i++) {
          _options["_serviceTypes"][_currentServices[i].type].destroy(this, _currentServices[i]);
        }

        for (i = 0; i < _options["services"].length; i++) {
          _options["_serviceTypes"][_options["services"][i].type].create(this, _options["services"][i], i);
        }

        _currentServices = _options["services"];
      },

      _drawGraphics: function (geographics, shapes) {
        var i, mgi, shape, style, pixelPositions, map = this;
        for (i = 0; i < shapes.length; i++) {
          // Either a GeoJSON Feature or a GeoJSON Geometry object are allowed
          shape = shapes[i].shape.geometry ? shapes[i].shape.geometry : shapes[i].shape;
          style = _graphicShapes[i].style;

          switch (shape.type) {
            case "Point":
              _$graphicsContainer.geographics("drawArc", this.toPixel(shape.coordinates), 0, 360, style);
              break;
            case "LineString":
              _$graphicsContainer.geographics("drawLineString", this.toPixel(shape.coordinates), style);
              break;
            case "Polygon":
              pixelPositions = [];
              $.each(shape.coordinates, function (i) {
                pixelPositions[i] = map.toPixel(this);
              });
              _$graphicsContainer.geographics("drawPolygon", pixelPositions, style);
              break;
            case "MultiPoint":
              for (mgi = 0; mgi < shape.coordinates; mgi++) {
                _$graphicsContainer.geographics("drawArc", this.toPixel(shape.coordinates[mgi]), 0, 360, style);
              }
              break;
            case "MultiLineString":
              for (mgi = 0; mgi < shape.coordinates; mgi++) {
                _$graphicsContainer.geographics("drawLineString", this.toPixel(shape.coordinates[mgi]), style);
              }
              break;
            case "MultiPolygon":
              for (mgi = 0; mgi < shape.coordinates; mgi++) {
                pixelPositions = [];
                $.each(shape.coordinates[mgi], function (i) {
                  pixelPositions[i] = map.toPixel(this);
                });
                _$graphicsContainer.geographics("drawPolygon", pixelPositions, style);
              }
              break;
          }
        }
      },

      _findMapSize: function () {
        // really, really attempt to find a size for this thing
        // even if it's hidden (look at parents)
        var size = { width: 0, height: 0 },
        sizeContainer = _$elem;

        while (sizeContainer.size() && !(size["width"] > 0 && size["height"] > 0)) {
          size = { width: sizeContainer.width(), height: sizeContainer.height() };
          if (size["width"] <= 0 || size["height"] <= 0) {
            size = { width: parseInt(sizeContainer.css("width")), height: parseInt(sizeContainer.css("height")) };
          }
          sizeContainer = sizeContainer.parent();
        }
        return size;
      },

      _forcePosition: function (elem) {
        var cssPosition = elem.css("position");
        if (cssPosition != "relative" && cssPosition != "absolute" && cssPosition != "fixed") {
          elem.css("position", "relative");
        }
      },

      _getTiledPixelSize: function (zoom) {
        var tilingScheme = _options["tilingScheme"];
        if (tilingScheme != null) {
          if (zoom === 0) {
            return tilingScheme.pixelSizes != null ? tilingScheme.pixelSizes[0] : tilingScheme.basePixelSize;
          }

          zoom = Math.round(zoom);
          zoom = Math.max(zoom, 0);
          var levels = tilingScheme.pixelSizes != null ? tilingScheme.pixelSizes.length : tilingScheme.levels;
          zoom = Math.min(zoom, levels - 1);

          if (tilingScheme.pixelSizes != null) {
            return tilingScheme.pixelSizes[zoom];
          } else {
            return tilingScheme.basePixelSize / Math.pow(2, zoom);
          }
        } else {
          return NaN;
        }
      },

      _getTiledZoom: function (pixelSize) {
        var tilingScheme = _options["tilingScheme"];
        if (tilingScheme.pixelSizes != null) {
          var roundedPixelSize = Math.round(pixelSize),
          levels = tilingScheme.pixelSizes != null ? tilingScheme.pixelSizes.length : tilingScheme.levels;
          for (var i = levels - 1; i >= 0; i--) {
            if (Math.round(tilingScheme.pixelSizes[i]) >= roundedPixelSize) {
              return i;
            }
          }
          return 0;
        } else {
          return Math.max(Math.round(Math.log(tilingScheme.basePixelSize / pixelSize) / Math.log(2)), 0);
        }
      },

      _getWheelCenterAndSize: function () {
        var pixelSize, zoomLevel, scale;
        if (_options["tilingScheme"]) {
          zoomLevel = this._getTiledZoom(_pixelSize) + _wheelLevel;
          pixelSize = this._getTiledPixelSize(zoomLevel);
        } else {
          scale = Math.pow(_wheelZoomFactor, -_wheelLevel);
          pixelSize = _pixelSize * scale;
        }

        var 
        ratio = pixelSize / _pixelSize,
        anchorMapCoord = this._toMap(_anchor),
        centerDelta = [(_center[0] - anchorMapCoord[0]) * ratio, (_center[1] - anchorMapCoord[1]) * ratio],
        scaleCenter = [anchorMapCoord[0] + centerDelta[0], anchorMapCoord[1] + centerDelta[1]];

        return { pixelSize: pixelSize, center: scaleCenter };
      },

      _mouseWheelFinish: function () {
        _wheelTimer = null;

        if (_wheelLevel != 0) {
          var wheelCenterAndSize = this._getWheelCenterAndSize();

          _wheelLevel = 0;

          this._setCenterAndSize(wheelCenterAndSize.center, wheelCenterAndSize.pixelSize, true, true);
        } else {
          this._refresh();
        }
      },

      _panEnd: function () {
        _velocity = [
        (_velocity[0] > 0 ? Math.floor(_velocity[0] * _friction[0]) : Math.ceil(_velocity[0] * _friction[0])),
        (_velocity[1] > 0 ? Math.floor(_velocity[1] * _friction[1]) : Math.ceil(_velocity[1] * _friction[1]))
      ];

        if (Math.abs(_velocity[0]) < 4 && Math.abs(_velocity[1]) < 4) {
          this._panFinalize();
        } else {
          _current = [
          _current[0] + _velocity[0],
          _current[1] + _velocity[1]
        ];

          this._panMove();
          setTimeout($.proxy(this._panEnd, this), 30);
        }
      },

      _panFinalize: function () {
        if (_panning) {
          _velocity = [0, 0];

          var 
          dx = _current[0] - _anchor[0],
          dy = _current[1] - _anchor[1],
          dxMap = -dx * _pixelSize,
          dyMap = dy * _pixelSize;

          _$graphicsContainer.css({ left: 0, top: 0 });

          this._setCenterAndSize([_center[0] + dxMap, _center[1] + dyMap], _pixelSize, true, true);

          _inOp = false;
          _anchor = _current;
          _toolPan = _panning = false;

          _$eventTarget.css("cursor", _options["cursors"][_options["mode"]]);
        }
      },

      _panMove: function () {
        var 
        dx = _current[0] - _lastDrag[0],
        dy = _current[1] - _lastDrag[1];

        if (_toolPan || dx > 3 || dx < -3 || dy > 3 || dy < -3) {
          if (!_toolPan) {
            _toolPan = true;
            _$eventTarget.css("cursor", _options["cursors"]["pan"]);
          }

          if (_mouseDown) {
            _velocity = [dx, dy];
          }

          if (dx != 0 || dy != 0) {
            _panning = true;
            _lastDrag = _current;

            for (i = 0; i < _options["services"].length; i++) {
              var service = _options["services"][i];
              _options["_serviceTypes"][service.type].interactivePan(this, service, dx, dy);
            }

            _$graphicsContainer.css({
              left: function (index, value) {
                return parseInt(value) + dx;
              },
              top: function (index, value) {
                return parseInt(value) + dy;
              }
            });
          }
        }
      },

      _refresh: function () {
        for (var i = 0; i < _options["services"].length; i++) {
          var service = _options["services"][i];
          if (!_mouseDown && _options["_serviceTypes"][service.type] != null) {
            _options["_serviceTypes"][service.type].refresh(this, service);
          }
        }

        if (_graphicShapes.length > 0) {
          _$graphicsContainer.geographics("clear");
          this._drawGraphics(_$graphicsContainer, _graphicShapes);
        }
      },

      _setCenterAndSize: function (center, pixelSize, trigger, refresh) {
        // the final call during any extent change
        if (_pixelSize != pixelSize) {
          _$graphicsContainer.geographics("clear");
          for (var i = 0; i < _options["services"].length; i++) {
            var service = _options["services"][i];
            _options["_serviceTypes"][service.type].interactiveScale(this, service, center, pixelSize);
          }
        }

        _center = center;
        _pixelSize = pixelSize;

        if ($.geo.proj) {
          var bbox = this._getBbox();
          bbox = $.geo.proj.toGeodetic([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
          bbox = [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]];
          _options["bbox"] = bbox;

          _options["center"] = $.geo.proj.toGeodetic([[_center[0], _center[1]]])[0];
        } else {
          _options["bbox"] = this._getBbox();

          _options["center"] = _center;
        }

        _options["zoom"] = this._getZoom();

        if (trigger) {
          this._trigger("bboxchange", window.event, { bbox: _options["bbox"] });
        }

        if (refresh) {
          this._refresh();
        }
      },

      _toMap: function (p, center, pixelSize) {
        // ignores $.geo.proj
        var isArray = $.isArray(p[0]);
        if (!isArray) {
          p = [p];
        }

        center = center || _center;
        pixelSize = pixelSize || _pixelSize;

        var 
        width = _contentBounds["width"],
        height = _contentBounds["height"],
        halfWidth = width / 2 * pixelSize,
        halfHeight = height / 2 * pixelSize,
        bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
        xRatio = $.geo._width(bbox) / width,
        yRatio = $.geo._height(bbox) / height,
        result = [];

        $.each(p, function (i) {
          var yOffset = (this[1] * yRatio);
          result[i] = [bbox[0] + (this[0] * xRatio), bbox[3] - yOffset];
        });

        return isArray ? result : result[0];
      },

      _toPixel: function (p, center, pixelSize) {
        // ignores $.geo.proj
        var isArray = $.isArray(p[0]);
        if (!isArray) {
          p = [p];
        }

        center = center || _center;
        pixelSize = pixelSize || _pixelSize;

        var 
        width = _contentBounds["width"],
        height = _contentBounds["height"],
        halfWidth = width / 2 * pixelSize,
        halfHeight = height / 2 * pixelSize,
        bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
        bboxWidth = $.geo._width(bbox),
        bboxHeight = $.geo._height(bbox),
        result = [];

        $.each(p, function (i) {
          result[i] = [
            (this[0] - bbox[0]) * width / bboxWidth,
            (bbox[3] - this[1]) * height / bboxHeight
          ];
        });

        return isArray ? result : result[0];
      },

      _zoomTo: function (coord, zoom, trigger, refresh) {
        zoom = zoom < 0 ? 0 : zoom;

        var tiledPixelSize = this._getTiledPixelSize(zoom);

        if (!isNaN(tiledPixelSize)) {
          this._setCenterAndSize(coord, tiledPixelSize, trigger, refresh);
        } else {
          var 
          bboxMax = $.geo._scaleBy(this._getBboxMax(), 1 / Math.pow(_zoomFactor, zoom)),
          pixelSize = Math.max($.geo._width(bboxMax) / _contentBounds["width"], $.geo._height(bboxMax) / _contentBounds["height"]);

          this._setCenterAndSize(coord, pixelSize, trigger, refresh);
        }
      },

      _eventTarget_dblclick: function (e) {
        this._panFinalize();

        var offset = $(e.currentTarget).offset();

        switch (_options["mode"]) {
          case "pan":
            this._trigger("dblclick", e, { pixels: _current, coordinates: this.toMap(_current) });
            if (!e.isDefaultPrevented()) {
              this._zoomTo(this._toMap(_current), this._getZoom() + 1, true, true);
            }
            break;
        }

        _inOp = false;
      },

      _eventTarget_touchstart: function (e) {
        if (!_supportTouch && e.which != 1) {
          return;
        }

        if (_softDblClick) {
          var downDate = $.now();
          if (downDate - _downDate < 750) {
            if (_isDbltap) {
              _isDbltap = false;
            } else {
              _isDbltap = _isTap;
            }
          } else {
            _isDbltap = false;
          }
          _isTap = true;
          _downDate = downDate;
        }

        e.preventDefault();

        this._panFinalize();
        this._mouseWheelFinish();

        var offset = $(e.currentTarget).offset();

        if (_supportTouch) {
          _current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          _current = [e.pageX - offset.left, e.pageY - offset.top];
        }

        _mouseDown = true;
        _anchor = _current;

        if (!_inOp && e.shiftKey) {
          _shiftZoom = true;
          _$eventTarget.css("cursor", _options["cursors"]["zoom"]);
        } else {
          _inOp = true;
          switch (_options["mode"]) {
            case "pan":
              _lastDrag = _current;

              if (e.currentTarget.setCapture) {
                e.currentTarget.setCapture();
              }
              break;
          }
        }

        return false;
      },

      _dragTarget_touchmove: function (e) {
        var 
        offset = _$eventTarget.offset(),
        current, i, dx, dy;

        if (_supportTouch) {
          current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          current = [e.pageX - offset.left, e.pageY - offset.top];
        }

        if (current[0] == _lastMove[0] && current[1] == _lastMove[1]) {
          return;
        }

        if (_softDblClick) {
          _isDbltap = _isTap = false;
        }

        if (_mouseDown) {
          _current = current;
          _moveDate = $.now();
        }

        var mode = _shiftZoom ? "zoom" : _options["mode"];

        switch (mode) {
          case "pan":
            if (_mouseDown || _toolPan) {
              this._panMove();
            } else {
              this._trigger("move", e, { pixels: current, coordinates: this.toMap(current) });
            }
            break;
        }

        _lastMove = current;
      },

      _dragTarget_touchstop: function (e) {
        if (!_mouseDown && _ieVersion == 7) {
          // ie7 doesn't appear to trigger dblclick on _$eventTarget,
          // we fake regular click here to cause soft dblclick
          this._eventTarget_touchstart(e);
        }

        var 
        mouseWasDown = _mouseDown,
        wasToolPan = _toolPan,
        offset = _$eventTarget.offset(),
        current, i;

        if (_supportTouch) {
          current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          current = [e.pageX - offset.left, e.pageY - offset.top];
        }

        var mode = _shiftZoom ? "zoom" : _options["mode"];

        _$eventTarget.css("cursor", _options["cursors"][mode]);

        _shiftZoom =
        _mouseDown =
        _toolPan = false;

        if (document.releaseCapture) {
          document.releaseCapture();
        }

        if (mouseWasDown) {
          var 
          clickDate = $.now(),
          dx, dy;

          _current = current;

          switch (mode) {
            case "pan":
              if (wasToolPan) {
                this._panEnd();
              } else {
                if (clickDate - _clickDate > 100) {
                  this._trigger("click", e, { pixels: current, coordinates: this.toMap(current) });
                  _inOp = false;
                }
              }
              break;
          }

          _clickDate = clickDate;

          if (_softDblClick && _isDbltap) {
            _isDbltap = _isTap = false;
            _$eventTarget.trigger("dblclick", e);
          }
        }
      },

      _eventTarget_mousewheel: function (e, delta) {
        e.preventDefault();

        this._panFinalize();

        if (_mouseDown) {
          return;
        }

        if (delta != 0) {
          if (_wheelTimer) {
            window.clearTimeout(_wheelTimer);
            _wheelTimer = null;
          } else {
            var offset = $(e.currentTarget).offset();
            _anchor = [e.pageX - offset.left, e.pageY - offset.top];
          }

          _wheelLevel += delta;

          var wheelCenterAndSize = this._getWheelCenterAndSize();

          _$graphicsContainer.geographics("clear");

          for (i = 0; i < _options["services"].length; i++) {
            var service = _options["services"][i];
            _options["_serviceTypes"][service.type].interactiveScale(this, service, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
          }

          //          if (this._imageShape != null && this._mapShape != null) {
          //            for (var i = 0; i < this._mapShapeCoords.length; i++) {
          //              this._imageShapeCoords[i] = this.toPixelPoint(this._mapShapeCoords[i], scaleCenter, pixelSize);
          //            }

          //            this._redrawShape();

          //            if (this._clickMode == Ag.UI.ClickMode.measureLength || this._clickMode == Ag.UI.ClickMode.measureArea) {
          //              this._labelShape();
          //            }
          //          }

          var that = this;
          _wheelTimer = window.setTimeout(function () {
            that._mouseWheelFinish();
          }, 1000);
        }
        return false;
      }
    };
  })()
  );


})(jQuery);

