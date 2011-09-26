(function ($, undefined) {
  var _ieVersion = (function () {
    var v = 5, div = document.createElement("div"), a = div.all || [];
    while (div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->", a[0]) { }
    return v > 6 ? v : !v;
  } ()),

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
        zoom: 0
      };

  $.widget("geo.geomap", {
    // private widget members
    _$elem: undefined,

    _contentBounds: {},

    _$contentFrame: undefined,
    _$servicesContainer: undefined,
    _$shapesContainer: undefined,
    _$textContainer: undefined,
    _$textContent: undefined,
    _$eventTarget: undefined,

    _dpi: 96,

    _currentServices: [], //< internal copy

    _center: undefined,
    _pixelSize: undefined,
    _centerMax: undefined,
    _pixelSizeMax: undefined,

    _wheelZoomFactor: 1.18920711500273,
    _wheelTimer: null,
    _wheelLevel: 0,

    _zoomFactor: 2,

    _mouseDown: undefined,
    _inOp: undefined,
    _toolPan: undefined,
    _shiftZoom: undefined,
    _anchor: undefined,
    _current: undefined,
    _downDate: undefined,
    _moveDate: undefined,
    _clickDate: undefined,
    _lastMove: undefined,
    _lastDrag: undefined,

    _timeoutResize: null,

    _panning: undefined,
    _velocity: undefined,
    _friction: undefined,

    _supportTouch: undefined,
    _softDblClick: undefined,
    _isTap: undefined,
    _isDbltap: undefined,

    _graphicShapes: [], //< an array of objects containing style object refs & GeoJSON object refs

    _initOptions: {},

    _options: {},

    options: $.extend({}, _defaultOptions),

    _createWidget: function (options, element) {
      this._$elem = $(element);

      if (this._$elem.is("[data-geo-service]")) {
        $.Widget.prototype._createWidget.apply(this, arguments);
        return;
      }

      this._$elem.attr("data-geo-map", "data-geo-map");

      this._initOptions = options;

      this._forcePosition(this._$elem);

      this._$elem.css("text-align", "left");

      var size = this._findMapSize();
      this._contentBounds = {
        x: parseInt(this._$elem.css("padding-left")),
        y: parseInt(this._$elem.css("padding-top")),
        width: size["width"],
        height: size["height"]
      };

      this._createChildren();

      this._center = this._centerMax = [0, 0];

      this._pixelSize = this._pixelSizeMax = 156543.03392799936;

      this._mouseDown =
          this._inOp =
          this._toolPan =
          this._shiftZoom =
          this._panning =
          this._isTap =
          this._isDbltap = false;

      this._anchor =
          this._current =
          this._lastMove =
          this._lastDrag =
          this._velocity = [0, 0];

      this._friction = [.8, .8];

      this._downDate =
          this._moveDate =
          this._clickDate = 0;

      $.Widget.prototype._createWidget.apply(this, arguments);
    },

    _create: function () {
      if (this._$elem.is("[data-geo-service]")) {
        return;
      }

      this._options = this.options;

      this._supportTouch = "ontouchend" in document;
      this._softDblClick = this._supportTouch || _ieVersion == 7;

      var touchStartEvent = this._supportTouch ? "touchstart" : "mousedown",
            touchStopEvent = this._supportTouch ? "touchend touchcancel" : "mouseup",
            touchMoveEvent = this._supportTouch ? "touchmove" : "mousemove";

      this._$eventTarget.dblclick($.proxy(this._eventTarget_dblclick, this));
      this._$eventTarget.bind(touchStartEvent, $.proxy(this._eventTarget_touchstart, this));

      var dragTarget = (this._$eventTarget[0].setCapture) ? this._$eventTarget : $(document);
      dragTarget.bind(touchMoveEvent, $.proxy(this._dragTarget_touchmove, this));
      dragTarget.bind(touchStopEvent, $.proxy(this._dragTarget_touchstop, this));

      this._$eventTarget.mousewheel($.proxy(this._eventTarget_mousewheel, this));

      var geomap = this;
      $(window).resize(function () {
        if (geomap._timeoutResize) {
          clearTimeout(geomap._timeoutResize);
        }
        this._timeoutResize = setTimeout(function () {
          geomap._$elem.geomap("resize");
        }, 500);
      });

      this._$shapesContainer.geographics();

      if (this._initOptions) {
        if (this._initOptions.bbox) {
          this._setOption("bbox", this._initOptions.bbox, false);
        }
        if (this._initOptions.center) {
          this._setOption("center", this._initOptions.center, false);
        }
        if (this._initOptions.zoom) {
          this._setZoom(this._initOptions.zoom, false, false);
        }
      }

      this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);

      this._createServices();

      this._refresh();
    },

    _setOption: function (key, value, refresh) {
      if (this._$elem.is("[data-geo-service]")) {
        return;
      }

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
          this._setCenterAndSize($.geo.proj ? $.geo.proj.fromGeodetic([[value[0], value[1]]])[0] : value, this._pixelSize, false, refresh);
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
      if (this._$elem.is("[data-geo-map]")) {
        this._$elem.html("");
        this._$elem.removeAttr("data-geo-map");
      }
      $.Widget.prototype.destroy.apply(this, arguments);
    },

    getPixelSize: function () {
      return this._pixelSize;
    },

    toMap: function (p) {
      p = this._toMap(p);
      return $.geo.proj ? $.geo.proj.toGeodetic(p) : p;
    },

    toPixel: function (p) {
      p = $.geo.proj ? $.geo.proj.fromGeodetic(p) : p;
      return this._toPixel(p);
    },

    opacity: function (value, _serviceContainer) {
      if (this._$elem.is("[data-geo-service]")) {
        this._$elem.closest("[data-geo-map]").geomap("opacity", value, this._$elem);
      } else {
        if (value >= 0 || value <= 1) {
          for (var i = 0; i < this._currentServices.length; i++) {
            var service = this._currentServices[i];
            if (!_serviceContainer || service.serviceContainer[0] == _serviceContainer[0]) {
              this._options["services"][i].opacity = service.opacity = value;
              $.geo["_serviceTypes"][service.type].opacity(this, service);
            }
          }
        }
      }
    },

    toggle: function (value, _serviceContainer) {
      if (this._$elem.is("[data-geo-service]")) {
        this._$elem.closest("[data-geo-map]").geomap("toggle", value, this._$elem);
      } else {
        for (var i = 0; i < this._currentServices.length; i++) {
          var service = this._currentServices[i];
          if (!_serviceContainer || service.serviceContainer[0] == _serviceContainer[0]) {
            if (value === undefined) {
              value = (service.visible === undefined ? false : !service.visible);
            }

            this._options["services"][i].visible = service.visible = value;
            $.geo["_serviceTypes"][service.type].toggle(this, service);
          }
        }
      }
    },

    refresh: function () {
      this._refresh();
    },

    resize: function () {
      var size = this._findMapSize();
      this._contentBounds = {
        x: parseInt(this._$elem.css("padding-left")),
        y: parseInt(this._$elem.css("padding-top")),
        width: size["width"],
        height: size["height"]
      };

      this._$contentFrame.css({
        width: size["width"],
        height: size["height"]
      });

      this._$servicesContainer.css({
        width: size["width"],
        height: size["height"]
      });

      this._$eventTarget.css({
        width: size["width"],
        height: size["height"]
      });

      this._$shapesContainer.geographics("destroy");
      this._$shapesContainer.css({
        width: size.width,
        height: size.height
      });
      this._$shapesContainer.geographics();

      this._setCenterAndSize(this._center, this._pixelSize, false, true);
    },

    shapeStyle: function (style) {
      if (style) {
        this._$shapesContainer.geographics("option", "style", style);
        this._refresh();
      } else {
        return this._$shapesContainer.geographics("option", "style");
      }
    },

    append: function (shape, style, refresh /* internal */) {
      refresh = (refresh === undefined || refresh);

      if (shape) {
        var shapes, geomap = this;
        if (shape.type == "FeatureCollection") {
          shapes = shape.features;
        } else {
          shapes = $.isArray(shape) ? shape : [shape];
        }

        $.each(shapes, function () {
          geomap._graphicShapes[geomap._graphicShapes.length] = {
            shape: this,
            style: style
          };
        });

        if (refresh) {
          this._refresh();
        }
      }
    },

    empty: function () {
      this._graphicShapes = [];
      this._refresh();
    },

    find: function (point, pixelTolerance) {
      var searchPixel = this.toPixel(point.coordinates),
            mapTol = this._pixelSize * pixelTolerance,
            result = [],
            curGeom;

      $.each(this._graphicShapes, function (i) {
        if (this.shape.type == "Point") {
          if ($.geo._distance(this.shape, point) <= mapTol) {
            result.push(this.shape);
          }
        } else {
          var bbox = $.geo._bbox(this.shape),
                bboxPolygon = {
                  type: "Polygon",
                  coordinates: [[
                    [bbox[0], bbox[1]],
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[3]],
                    [bbox[2], bbox[1]],
                    [bbox[0], bbox[1]]
                  ]]
                };

          if ($.geo._distance(bboxPolygon, point) <= mapTol) {
            var geometries = $.geo._flatten(this.shape);
            for (curGeom = 0; curGeom < geometries.length; curGeom++) {
              if ($.geo._distance(geometries[curGeom], point) <= mapTol) {
                result.push(this.shape);
                break;
              }
            }
          }
        }
      });

      return result;
    },

    remove: function (shape) {
      var geomap = this;
      $.each(this._graphicShapes, function (i) {
        if (this.shape == shape) {
          var rest = geomap._graphicShapes.slice(i + 1 || geomap._graphicShapes.length);
          geomap._graphicShapes.length = i < 0 ? geomap._graphicShapes.length + i : i;
          geomap._graphicShapes.push.apply(geomap._graphicShapes, rest);
          return false;
        }
      });
      this._refresh();
    },

    _getBbox: function () {
      // calculate the internal bbox
      var halfWidth = this._contentBounds["width"] / 2 * this._pixelSize,
        halfHeight = this._contentBounds["height"] / 2 * this._pixelSize;
      return [this._center[0] - halfWidth, this._center[1] - halfHeight, this._center[0] + halfWidth, this._center[1] + halfHeight];
    },

    _setBbox: function (value, trigger, refresh) {
      var center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2],
          pixelSize = Math.max($.geo._width(value) / this._contentBounds.width, $.geo._height(value) / this._contentBounds.height);

      if (this._options["tilingScheme"]) {
        var zoom = this._getTiledZoom(pixelSize);
        pixelSize = this._getTiledPixelSize(zoom);
      }
      this._setCenterAndSize(center, pixelSize, trigger, refresh);
    },

    _getBboxMax: function () {
      // calculate the internal bboxMax
      var halfWidth = this._contentBounds["width"] / 2 * this._pixelSizeMax,
        halfHeight = this._contentBounds["height"] / 2 * this._pixelSizeMax;
      return [this._centerMax[0] - halfWidth, this._centerMax[1] - halfHeight, this._centerMax[0] + halfWidth, this._centerMax[1] + halfHeight];
    },

    _getCenter: function () {
      return this._center;
    },

    _getContentBounds: function () {
      return this._contentBounds;
    },

    _getZoom: function () {
      // calculate the internal zoom level, vs. public zoom property
      if (this._options["tilingScheme"]) {
        return this._getTiledZoom(this._pixelSize);
      } else {
        var ratio = this._contentBounds["width"] / this._contentBounds["height"],
          bbox = $.geo._reaspect(this._getBbox(), ratio),
          bboxMax = $.geo._reaspect(this._getBboxMax(), ratio);

        return Math.log($.geo._width(bboxMax) / $.geo._width(bbox)) / Math.log(this._zoomFactor);
      }
    },

    _setZoom: function (value, trigger, refresh) {
      value = Math.max(value, 0);

      if (this._options["tilingScheme"]) {
        this._setCenterAndSize(this._center, this._getTiledPixelSize(value), trigger, refresh);
      } else {
        var 
          bbox = $.geo._scaleBy(this._getBbox(), 1 / Math.pow(this._zoomFactor, value)),
          pixelSize = Math.max($.geo._width(bbox) / this._contentBounds.width, $.geo._height(bbox) / this._contentBounds.height);
        this._setCenterAndSize(this._center, pixelSize, trigger, refresh);
      }
    },

    _createChildren: function () {
      var existingChildren = this._$elem.children().detach();

      this._forcePosition(existingChildren);

      existingChildren.css("-moz-user-select", "none");

      this._$elem.prepend("<div style='position:absolute; left:" + this._contentBounds.x + "px; top:" + this._contentBounds.y + "px; width:" + this._contentBounds["width"] + "px; height:" + this._contentBounds["height"] + "px; margin:0; padding:0; overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;' unselectable='on'></div>");
      this._$eventTarget = this._$contentFrame = this._$elem.children(':first');

      this._$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + this._contentBounds["width"] + 'px; height:' + this._contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
      this._$servicesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + this._contentBounds["width"] + 'px; height:' + this._contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
      this._$shapesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="ui-widget ui-widget-content ui-corner-all" style="position:absolute; left:0; top:0px; max-width:128px; display:none;"><div style="margin:.2em;"></div></div>');
      this._$textContainer = this._$contentFrame.children(':last');
      this._$textContent = this._$textContainer.children();

      this._$contentFrame.append(existingChildren);
    },

    _createServices: function () {
      var i;

      for (i = 0; i < this._currentServices.length; i++) {
        this._currentServices[i].serviceContainer.geomap("destroy");
        $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
      }

      this._currentServices = [];
      for (i = 0; i < this._options["services"].length; i++) {
        this._currentServices[i] = $.extend({}, this._options["services"][i]);
        this._currentServices[i].serviceContainer = $.geo["_serviceTypes"][this._currentServices[i].type].create(this, this._$servicesContainer, this._currentServices[i], i).geomap();
      }
    },

    _drawGraphics: function (geographics, shapes, styles) {
      var i,
            mgi,
            shape,
            style,
            pixelPositions,
            geomap = this;

      for (i = 0; i < shapes.length; i++) {
        shape = shapes[i].shape || shapes[i];
        shape = shape.geometry || shape;
        style = $.isArray(styles) ? styles[i].style : styles;

        switch (shape.type) {
          case "Point":
            this._$shapesContainer.geographics("drawPoint", this.toPixel(shape.coordinates), style);
            break;
          case "LineString":
            this._$shapesContainer.geographics("drawLineString", this.toPixel(shape.coordinates), style);
            break;
          case "Polygon":
            pixelPositions = [];
            $.each(shape.coordinates, function (i) {
              pixelPositions[i] = geomap.toPixel(this);
            });
            this._$shapesContainer.geographics("drawPolygon", pixelPositions, style);
            break;
          case "MultiPoint":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              this._$shapesContainer.geographics("drawPoint", this.toPixel(shape.coordinates[mgi]), style);
            }
            break;
          case "MultiLineString":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              this._$shapesContainer.geographics("drawLineString", this.toPixel(shape.coordinates[mgi]), style);
            }
            break;
          case "MultiPolygon":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              pixelPositions = [];
              $.each(shape.coordinates[mgi], function (i) {
                pixelPositions[i] = geomap.toPixel(this);
              });
              this._$shapesContainer.geographics("drawPolygon", pixelPositions, style);
            }
            break;

          case "GeometryCollection":
            geomap._drawGraphics(geographics, shape.geometries, style);
            break;
        }
      }
    },

    _findMapSize: function () {
      // really, really attempt to find a size for this thing
      // even if it's hidden (look at parents)
      var size = { width: 0, height: 0 },
        sizeContainer = this._$elem;

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
      var tilingScheme = this._options["tilingScheme"];
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
      var tilingScheme = this._options["tilingScheme"];
      if (tilingScheme.pixelSizes != null) {
        var roundedPixelSize = Math.floor(pixelSize * 1000),
          levels = tilingScheme.pixelSizes != null ? tilingScheme.pixelSizes.length : tilingScheme.levels;
        for (var i = levels - 1; i >= 0; i--) {
          if (Math.floor(tilingScheme.pixelSizes[i] * 1000) >= roundedPixelSize) {
            return i;
          }
        }
        return 0;
      } else {
        return Math.max(Math.round(Math.log(tilingScheme.basePixelSize / pixelSize) / Math.log(2)), 0);
      }
    },

    _getZoomCenterAndSize: function (anchor, zoomDelta, zoomFactor) {
      var pixelSize, zoomLevel, scale;
      if (this._options["tilingScheme"]) {
        zoomLevel = this._getTiledZoom(this._pixelSize) + zoomDelta;
        pixelSize = this._getTiledPixelSize(zoomLevel);
      } else {
        scale = Math.pow(zoomFactor, -zoomDelta);
        pixelSize = this._pixelSize * scale;
      }

      var 
        ratio = pixelSize / this._pixelSize,
        anchorMapCoord = this._toMap(anchor),
        centerDelta = [(this._center[0] - anchorMapCoord[0]) * ratio, (this._center[1] - anchorMapCoord[1]) * ratio],
        scaleCenter = [anchorMapCoord[0] + centerDelta[0], anchorMapCoord[1] + centerDelta[1]];

      return { pixelSize: pixelSize, center: scaleCenter };
    },

    _mouseWheelFinish: function () {
      this._wheelTimer = null;

      if (this._wheelLevel != 0) {
        var wheelCenterAndSize = this._getZoomCenterAndSize(this._anchor, this._wheelLevel, this._wheelZoomFactor);

        this._wheelLevel = 0;

        this._setCenterAndSize(wheelCenterAndSize.center, wheelCenterAndSize.pixelSize, true, true);
      } else {
        this._refresh();
      }
    },

    _panEnd: function () {
      this._velocity = [
        (this._velocity[0] > 0 ? Math.floor(this._velocity[0] * this._friction[0]) : Math.ceil(this._velocity[0] * this._friction[0])),
        (this._velocity[1] > 0 ? Math.floor(this._velocity[1] * this._friction[1]) : Math.ceil(this._velocity[1] * this._friction[1]))
      ];

      if (Math.abs(this._velocity[0]) < 4 && Math.abs(this._velocity[1]) < 4) {
        this._panFinalize();
      } else {
        this._current = [
          this._current[0] + this._velocity[0],
          this._current[1] + this._velocity[1]
        ];

        this._panMove();
        setTimeout($.proxy(this._panEnd, this), 30);
      }
    },

    _panFinalize: function () {
      if (this._panning) {
        this._velocity = [0, 0];

        var 
          dx = this._current[0] - this._anchor[0],
          dy = this._current[1] - this._anchor[1],
          dxMap = -dx * this._pixelSize,
          dyMap = dy * this._pixelSize;

        this._$shapesContainer.css({ left: 0, top: 0 });

        this._setCenterAndSize([this._center[0] + dxMap, this._center[1] + dyMap], this._pixelSize, true, true);

        this._inOp = false;
        this._anchor = this._current;
        this._toolPan = this._panning = false;

        this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);
      }
    },

    _panMove: function () {
      var 
        dx = this._current[0] - this._lastDrag[0],
        dy = this._current[1] - this._lastDrag[1];

      if (this._toolPan || dx > 3 || dx < -3 || dy > 3 || dy < -3) {
        if (!this._toolPan) {
          this._toolPan = true;
          this._$eventTarget.css("cursor", this._options["cursors"]["pan"]);
        }

        if (this._mouseDown) {
          this._velocity = [dx, dy];
        }

        if (dx != 0 || dy != 0) {
          this._panning = true;
          this._lastDrag = this._current;

          for (i = 0; i < this._options["services"].length; i++) {
            var service = this._options["services"][i];
            $.geo["_serviceTypes"][service.type].interactivePan(this, service, dx, dy);
          }

          this._$shapesContainer.css({
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
      for (var i = 0; i < this._options["services"].length; i++) {
        var service = this._options["services"][i];
        if (!this._mouseDown && $.geo["_serviceTypes"][service.type] != null) {
          $.geo["_serviceTypes"][service.type].refresh(this, service);
        }
      }

      if (this._$shapesContainer) {
        this._$shapesContainer.geographics("clear");
        if (this._graphicShapes.length > 0) {
          this._drawGraphics(this._$shapesContainer, this._graphicShapes, this._graphicShapes);
        }
      }
    },

    _setCenterAndSize: function (center, pixelSize, trigger, refresh) {
      // the final call during any extent change
      if (this._pixelSize != pixelSize) {
        this._$shapesContainer.geographics("clear");
        for (var i = 0; i < this._options["services"].length; i++) {
          var service = this._options["services"][i];
          $.geo["_serviceTypes"][service.type].interactiveScale(this, service, center, pixelSize);
        }
      }

      this._center = center;
      this._pixelSize = pixelSize;

      if ($.geo.proj) {
        var bbox = this._getBbox();
        bbox = $.geo.proj.toGeodetic([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
        bbox = [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]];
        this._options["bbox"] = bbox;

        this._options["center"] = $.geo.proj.toGeodetic([[this._center[0], this._center[1]]])[0];
      } else {
        this._options["bbox"] = this._getBbox();

        this._options["center"] = this._center;
      }

      this._options["zoom"] = this._getZoom();

      if (trigger) {
        this._trigger("bboxchange", window.event, { bbox: this._options["bbox"] });
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

      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var 
        width = this._contentBounds["width"],
        height = this._contentBounds["height"],
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

      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var 
        width = this._contentBounds["width"],
        height = this._contentBounds["height"],
        halfWidth = width / 2 * pixelSize,
        halfHeight = height / 2 * pixelSize,
        bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
        bboxWidth = $.geo._width(bbox),
        bboxHeight = $.geo._height(bbox),
        result = [];

      $.each(p, function (i) {
        result[i] = [
            Math.round((this[0] - bbox[0]) * width / bboxWidth),
            Math.round((bbox[3] - this[1]) * height / bboxHeight)
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
          bboxMax = $.geo._scaleBy(this._getBboxMax(), 1 / Math.pow(this._zoomFactor, zoom)),
          pixelSize = Math.max($.geo._width(bboxMax) / this._contentBounds["width"], $.geo._height(bboxMax) / this._contentBounds["height"]);

        this._setCenterAndSize(coord, pixelSize, trigger, refresh);
      }
    },

    _eventTarget_dblclick: function (e) {
      this._panFinalize();

      var offset = $(e.currentTarget).offset();

      switch (this._options["mode"]) {
        case "pan":
          this._trigger("dblclick", e, { type: "Point", coordinates: this.toMap(this._current) });
          if (!e.isDefaultPrevented()) {
            var centerAndSize = this._getZoomCenterAndSize(this._current, 1, this._zoomFactor);
            this._setCenterAndSize(centerAndSize.center, centerAndSize.pixelSize, true, true);
            //this._zoomTo(this._toMap(this._current), this._getZoom() + 1, true, true);
          }
          break;
      }

      this._inOp = false;
    },

    _eventTarget_touchstart: function (e) {
      if (!this._supportTouch && e.which != 1) {
        return;
      }

      var offset = $(e.currentTarget).offset();

      if (this._supportTouch) {
        this._current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
      } else {
        this._current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      if (this._softDblClick) {
        var downDate = $.now();
        if (downDate - this._downDate < 750) {
          if (this._isTap) {
            var dx = this._current[0] - this._anchor[0],
                  dy = this._current[1] - this._anchor[1],
                  distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance > 10) {
              this._isTap = false;
            }
          }

          if (this._isDbltap) {
            this._isDbltap = false;
          } else {
            this._isDbltap = this._isTap;
          }
        } else {
          this._isDbltap = false;
        }
        this._isTap = true;
        this._downDate = downDate;
      }

      e.preventDefault();

      this._panFinalize();
      this._mouseWheelFinish();

      this._mouseDown = true;
      this._anchor = this._current;

      if (!this._inOp && e.shiftKey) {
        this._shiftZoom = true;
        this._$eventTarget.css("cursor", this._options["cursors"]["zoom"]);
      } else {
        this._inOp = true;
        switch (this._options["mode"]) {
          case "pan":
            this._lastDrag = this._current;

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
        offset = this._$eventTarget.offset(),
        current, i, dx, dy;

      if (this._supportTouch) {
        current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
      } else {
        current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      if (current[0] == this._lastMove[0] && current[1] == this._lastMove[1]) {
        return;
      }

      if (this._softDblClick) {
        this._isDbltap = this._isTap = false;
      }

      if (this._mouseDown) {
        this._current = current;
        this._moveDate = $.now();
      }

      var mode = this._shiftZoom ? "zoom" : this._options["mode"];

      switch (mode) {
        case "pan":
          if (this._mouseDown || this._toolPan) {
            this._panMove();
          } else {
            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;
      }

      this._lastMove = current;
    },

    _dragTarget_touchstop: function (e) {
      if (!this._mouseDown && _ieVersion == 7) {
        // ie7 doesn't appear to trigger dblclick on this._$eventTarget,
        // we fake regular click here to cause soft dblclick
        this._eventTarget_touchstart(e);
      }

      var 
        mouseWasDown = this._mouseDown,
        wasToolPan = this._toolPan,
        offset = this._$eventTarget.offset(),
        current, i;

      if (this._supportTouch) {
        current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
      } else {
        current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      var mode = this._shiftZoom ? "zoom" : this._options["mode"];

      this._$eventTarget.css("cursor", this._options["cursors"][mode]);

      this._shiftZoom =
        this._mouseDown =
        this._toolPan = false;

      if (document.releaseCapture) {
        document.releaseCapture();
      }

      if (mouseWasDown) {
        var 
          clickDate = $.now(),
          dx, dy;

        this._current = current;

        switch (mode) {
          case "pan":
            if (wasToolPan) {
              this._panEnd();
            } else {
              if (clickDate - this._clickDate > 100) {
                this._trigger("click", e, { type: "Point", coordinates: this.toMap(current) });
                this._inOp = false;
              }
            }
            break;
        }

        this._clickDate = clickDate;

        if (this._softDblClick && this._isDbltap) {
          this._isDbltap = this._isTap = false;
          this._$eventTarget.trigger("dblclick", e);
        }
      }
    },

    _eventTarget_mousewheel: function (e, delta) {
      e.preventDefault();

      this._panFinalize();

      if (this._mouseDown) {
        return;
      }

      if (delta != 0) {
        if (this._wheelTimer) {
          window.clearTimeout(this._wheelTimer);
          this._wheelTimer = null;
        } else {
          var offset = $(e.currentTarget).offset();
          this._anchor = [e.pageX - offset.left, e.pageY - offset.top];
        }

        this._wheelLevel += delta;

        var wheelCenterAndSize = this._getZoomCenterAndSize(this._anchor, this._wheelLevel, this._wheelZoomFactor);

        this._$shapesContainer.geographics("clear");

        for (i = 0; i < this._options["services"].length; i++) {
          var service = this._options["services"][i];
          $.geo["_serviceTypes"][service.type].interactiveScale(this, service, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
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
        this._wheelTimer = window.setTimeout(function () {
          that._mouseWheelFinish();
        }, 1000);
      }
      return false;
    }
  }
  );
})(jQuery);

