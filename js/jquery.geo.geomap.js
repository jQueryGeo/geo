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
          "static": "default",
          pan: "move",
          zoom: "crosshair",
          drawPoint: "crosshair",
          drawLineString: "crosshair",
          drawPolygon: "crosshair",
          measureLength: "crosshair",
          measureArea: "crosshair"
        },
        measureLabels: {
          length: "{{=length.toFixed( 2 )}} m",
          area: "{{=area.toFixed( 2 )}} sq m"
        },
        drawStyle: {},
        shapeStyle: {},
        mode: "pan",
        pannable: true,
        scroll: "default",
        services: [
            {
              "class": "osm",
              type: "tiled",
              src: function (view) {
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
        axisLayout: "map",
        zoom: 0,
        pixelSize: 0
      };

  $.widget("geo.geomap", {
    // private widget members
    _$elem: undefined, //< map div for maps, service div for services
    _map: undefined, //< only defined in services
    _created: false,

    _contentBounds: {},

    _$resizeContainer: undefined, //< all elements that should match _contentBounds' size

    _$eventTarget: undefined,
    _$contentFrame: undefined,
    _$existingChildren: undefined,
    _$servicesContainer: undefined,

    _$panContainer: undefined, //< all non-service elements that move while panning
    _$shapesContainer: undefined,
    //_$labelsContainer: undefined,
    _$drawContainer: undefined,
    _$measureContainer: undefined,
    _$measureLabel: undefined,

    _dpi: 96,

    _currentServices: [], //< internal copy

    _center: undefined,
    _pixelSize: undefined,
    _centerMax: undefined,
    _pixelSizeMax: undefined,

    _wheelZoomFactor: 1.18920711500273,
    _wheelTimeout: null,
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

    _windowHandler: null,
    _resizeTimeout: null,

    _panning: undefined,
    _velocity: undefined,
    _friction: undefined,

    _supportTouch: undefined,
    _softDblClick: undefined,
    _isTap: undefined,
    _isDbltap: undefined,

    _isMultiTouch: undefined,
    _multiTouchAnchor: undefined, //< TouchList
    _multiTouchAnchorBbox: undefined, //< bbox
    _multiTouchCurrentBbox: undefined, //< bbox

    _drawTimeout: null, //< used in drawPoint mode so we don't send two shape events on dbltap
    _drawPixels: [], //< an array of coordinate arrays for drawing lines & polygons, in pixel coordinates
    _drawCoords: [],

    _graphicShapes: [], //< an array of objects containing style object refs & GeoJSON object refs

    _initOptions: {},

    _options: {},

    options: $.extend({}, _defaultOptions),

    _createWidget: function (options, element) {
      this._$elem = $(element);

      if (this._$elem.is(".geo-service")) {
        var $contentFrame = this._$elem.closest( ".geo-content-frame" );
        this._$elem.append('<div class="geo-shapes-container" style="position:absolute; left:0; top:0; width:' + $contentFrame.css( "width" ) + '; height:' + $contentFrame.css( "height" ) + '; margin:0; padding:0;"></div>');
        this._$shapesContainer = this._$elem.children(':last');
        $.Widget.prototype._createWidget.apply(this, arguments);
        return;
      }

      this._$elem.addClass("geo-map");

      this._initOptions = options || {};

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

      this.options["pixelSize"] = this._pixelSize = this._pixelSizeMax = 156543.03392799936;

      this._mouseDown =
          this._inOp =
          this._toolPan =
          this._shiftZoom =
          this._panning =
          this._isTap =
          this._isDbltap = false;

      this._anchor = [ 0, 0 ];
      this._current = [ 0, 0 ];
      this._lastMove = [ 0, 0 ];
      this._lastDrag = [ 0, 0 ];
      this._velocity = [ 0, 0 ];

      this._friction = [.8, .8];

      this._downDate =
          this._moveDate =
          this._clickDate = 0;

      this._drawPixels = [];
      this._drawCoords =  [];
      this._graphicShapes = [];


      $.Widget.prototype._createWidget.apply(this, arguments);
    },

    _create: function () {
      if (this._$elem.is(".geo-service")) {
        this._map = this._$elem.data( "geoMap" );
        this._$shapesContainer.geographics( );
        this._options["shapeStyle"] = this._$shapesContainer.geographics("option", "style");
        return;
      }

      this._map = this;

      this._options = this.options;

      this._supportTouch = "ontouchend" in document;
      this._softDblClick = this._supportTouch || _ieVersion == 7;

      var geomap = this,
          touchStartEvent = this._supportTouch ? "touchstart" : "mousedown",
          touchStopEvent = this._supportTouch ? "touchend touchcancel" : "mouseup",
          touchMoveEvent = this._supportTouch ? "touchmove" : "mousemove";

      $(document).keydown($.proxy(this._document_keydown, this));

      this._$eventTarget.dblclick($.proxy(this._eventTarget_dblclick, this));

      this._$eventTarget.bind(touchStartEvent, $.proxy(this._eventTarget_touchstart, this));

      var dragTarget = (this._$eventTarget[0].setCapture) ? this._$eventTarget : $(document);
      dragTarget.bind(touchMoveEvent, $.proxy(this._dragTarget_touchmove, this));
      dragTarget.bind(touchStopEvent, $.proxy(this._dragTarget_touchstop, this));

      this._$eventTarget.mousewheel($.proxy(this._eventTarget_mousewheel, this));

      this._windowHandler = function () {
        if (geomap._resizeTimeout) {
          clearTimeout(geomap._resizeTimeout);
        }
        geomap._resizeTimeout = setTimeout(function () {
          if (geomap._created) {
            geomap._$elem.geomap("resize");
          }
        }, 500);
      };

      $(window).resize(this._windowHandler);

      this._$drawContainer.geographics({ style: this._initOptions.drawStyle || {} });
      this._options["drawStyle"] = this._$drawContainer.geographics("option", "style");

      this._$shapesContainer.geographics( { style: this._initOptions.shapeStyle || { } } );
      this._options["shapeStyle"] = this._$shapesContainer.geographics("option", "style");

      if (this._initOptions) {
        if (this._initOptions.tilingScheme) {
          this._setOption("tilingScheme", this._initOptions.tilingScheme, false);
        }
        if ( this._initOptions.services ) {
          // jQuery UI Widget Factory merges user services with our default, we want to clobber the default
          this._options[ "services" ] = $.merge( [ ], this._initOptions.services );
        }
        if (this._initOptions.bbox) {
          this._setOption("bbox", this._initOptions.bbox, false);
        }
        if (this._initOptions.center) {
          this._setOption("center", this._initOptions.center, false);
        }
        if (this._initOptions.zoom !== undefined) {
          this._setZoom(this._initOptions.zoom, false, false);
        }
      }

      $.template( "geoMeasureLength", this._options[ "measureLabels" ].length );
      $.template( "geoMeasureArea", this._options[ "measureLabels" ].area );

      this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);

      this._createServices();
      this._refresh();

      this._created = true;
    },

    _setOption: function (key, value, refresh) {
      if ( key == "pixelSize" ) {
        return;
      }

      refresh = (refresh === undefined || refresh);

      if ( this._$elem.is( ".geo-map" ) ) {
        this._panFinalize();
      }

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

        case "measureLabels":
          value = $.extend( this._options[ "measureLabels" ], value );
          $.template( "geoMeasureLength", value.length );
          $.template( "geoMeasureArea", value.area );
          break;

        case "drawStyle":
          if (this._$drawContainer) {
            this._$drawContainer.geographics("option", "style", value);
            value = this._$drawContainer.geographics("option", "style");
          }
          break;

        case "shapeStyle":
          if (this._$shapesContainer) {
            this._$shapesContainer.geographics("option", "style", value);
            value = this._$shapesContainer.geographics("option", "style");
          }
          break;

        case "mode":
          this._$drawContainer.geographics("clear");
          this._$eventTarget.css("cursor", this._options["cursors"][value]);
          break;

        case "zoom":
          this._setZoom(value, false, refresh);
          break;
      }

      $.Widget.prototype._setOption.apply(this, arguments);

      switch (key) {
        case "tilingScheme":
          if ( value != null ) {
            this._pixelSizeMax = this._getTiledPixelSize(0);
            this._centerMax = [
              value.origin[ 0 ] + this._pixelSizeMax * value.tileWidth / 2,
              value.origin[ 1 ] + this._pixelSizeMax * value.tileHeight / 2
            ];
          }
          break;

        case "services":
          this._createServices();
          if (refresh) {
            this._refresh();
          }
          break;

        case "shapeStyle":
          if ( refresh ) {
            this._$shapesContainer.geographics("clear");
            this._refreshShapes( this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes );
          }
          break;
      }
    },

    destroy: function () {
      if ( this._$elem.is(".geo-service") ) {
        this._$shapesContainer.geographics("destroy");
        this._$shapesContainer = undefined;
      } else {
        this._created = false;

        $(window).unbind("resize", this._windowHandler);

        for ( var i = 0; i < this._currentServices.length; i++ ) {
          this._currentServices[ i ].serviceContainer.geomap("destroy");
          $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
        }

        this._$shapesContainer.geographics("destroy");
        this._$shapesContainer = undefined;
        this._$drawContainer.geographics("destroy");
        this._$drawContainer = undefined;

        this._$existingChildren.detach();
        this._$elem.html("");
        this._$elem.append(this._$existingChildren);
        this._$elem.removeClass("geo-map");
      }

      $.Widget.prototype.destroy.apply(this, arguments);
    },

    toMap: function (p) {
      p = this._toMap(p);
      return $.geo.proj ? $.geo.proj.toGeodetic(p) : p;
    },

    toPixel: function ( p, _center /* Internal Use Only */, _pixelSize /* Internal Use Only */ ) {
      p = $.geo.proj ? $.geo.proj.fromGeodetic(p) : p;
      return this._toPixel(p, _center, _pixelSize);
    },

    opacity: function (value, _serviceContainer) {
      if (this._$elem.is(".geo-service")) {
        this._$elem.closest(".geo-map").geomap("opacity", value, this._$elem);
      } else {
        if (value >= 0 || value <= 1) {
          for ( var i = 0; i < this._currentServices.length; i++ ) {
            var service = this._currentServices[i];
            if ( !_serviceContainer || service.serviceContainer[0] == _serviceContainer[0] ) {
              this._options["services"][i].opacity = service.opacity = value;
              $.geo["_serviceTypes"][service.type].opacity(this, service);
            }
          }
        }
      }
    },

    toggle: function (value, _serviceContainer) {
      if (this._$elem.is(".geo-service")) {
        this._$elem.closest(".geo-map").geomap("toggle", value, this._$elem);
      } else {
        for (var i = 0; i < this._currentServices.length; i++) {
          var service = this._currentServices[i];
          if (!_serviceContainer || service.serviceContainer[0] == _serviceContainer[0]) {
            if (value === undefined) {
              value = (service.visibility === undefined || service.visibility === "visible" ? false : true);
            }

            this._options["services"][i].visibility = service.visibility = ( value ? "visible" : "hidden" );
            service.serviceContainer.toggle(value);

            if (value) {
              $.geo["_serviceTypes"][service.type].refresh(this, service);
            }
          }
        }
      }
    },

    zoom: function (numberOfLevels) {
      if (numberOfLevels != null) {
        this._setZoom(this._options["zoom"] + numberOfLevels, false, true);
      }
    },

    refresh: function () {
      this._refresh();
    },

    resize: function () {
      var size = this._findMapSize(),
          dx = size["width"]/2 - this._contentBounds.width/2,
          dy = size["height"]/2 - this._contentBounds.height/2,
          i;

      this._contentBounds = {
        x: parseInt(this._$elem.css("padding-left")),
        y: parseInt(this._$elem.css("padding-top")),
        width: size["width"],
        height: size["height"]
      };

      this._$resizeContainer.css( {
        width: size["width"],
        height: size["height"]
      } );

      for (i = 0; i < this._currentServices.length; i++) {
        $.geo["_serviceTypes"][this._currentServices[i].type].resize(this, this._currentServices[i]);
      }

      this._$elem.find( ".geo-graphics" ).css( {
        width: size["width"],
        height: size["height"]
      }).geographics( "resize" );

      for (i = 0; i < this._drawPixels.length; i++) {
        this._drawPixels[i][0] += dx;
        this._drawPixels[i][1] += dy;
      }

      this._setCenterAndSize(this._center, this._pixelSize, false, true);
    },

    append: function ( shape, style, label, refresh ) {
      if ( shape && $.isPlainObject( shape ) ) {
        var shapes, arg, i, realStyle, realLabel, realRefresh;

        if ( shape.type == "FeatureCollection" ) {
          shapes = shape.features;
        } else {
          shapes = $.isArray( shape ) ? shape : [ shape ];
        }

        for ( i = 1; i < arguments.length; i++ ) {
          arg = arguments[ i ];

          if ( typeof arg === "object" ) {
            realStyle = arg;
          } else if ( typeof arg === "number" || typeof arg === "string" ) {
            realLabel = arg;
          } else if ( typeof arg === "boolean" ) {
            realRefresh = arg;
          }
        }

        for ( i = 0; i < shapes.length; i++ ) {
          if ( shapes[ i ].type != "Point" ) {
            var bbox = $.geo.bbox( shapes[ i ] );
            if ( $.geo.proj ) {
              bbox = $.geo.proj.fromGeodetic( bbox );
            }
            $.data( shapes[ i ], "geoBbox", bbox );
          }

          this._graphicShapes.push( {
            shape: shapes[ i ],
            style: realStyle,
            label: realLabel
          } );
        }

        if ( realRefresh === undefined || realRefresh ) {
          this._refresh( );
        }
      }
    },

    empty: function ( refresh ) {
      for ( var i = 0; i < this._graphicShapes.length; i++ ) {
        $.removeData( this._graphicShapes[ i ].shape, "geoBbox" );
      }

      this._graphicShapes = [];

      if ( refresh === undefined || refresh ) {
        this._refresh();
      }
    },

    find: function (point, pixelTolerance) {
      var searchPixel = this._map.toPixel( point.coordinates ),
          mapTol = this._map._pixelSize * pixelTolerance,
          result = [],
          graphicShape,
          geometries,
          curGeom,
          i = 0;

      for ( ; i < this._graphicShapes.length; i++ ) {
        graphicShape = this._graphicShapes[ i ];

        if ( graphicShape.shape.type == "Point" ) {
          if ( $.geo.distance( graphicShape.shape, point ) <= mapTol ) {
            result.push( graphicShape.shape );
          }
        } else {
          var bbox = $.data( graphicShape.shape, "geoBbox" ),
              bboxPolygon = {
                type: "Polygon",
                coordinates: [ [
                  [bbox[0], bbox[1]],
                  [bbox[0], bbox[3]],
                  [bbox[2], bbox[3]],
                  [bbox[2], bbox[1]],
                  [bbox[0], bbox[1]]
                ] ]
              },
              projectedPoint = {
                type: "Point",
                coordinates: $.geo.proj ? $.geo.proj.fromGeodetic( point.coordinates ) : point.coordinates
              };

          if ( $.geo.distance( bboxPolygon, projectedPoint, true ) <= mapTol ) {
            geometries = $.geo._flatten( graphicShape.shape );
            for ( curGeom = 0; curGeom < geometries.length; curGeom++ ) {
              if ( $.geo.distance( geometries[ curGeom ], point ) <= mapTol ) {
                result.push( graphicShape.shape );
                break;
              }
            }
          }
        }
      }

      if ( this._$elem.is( ".geo-map" ) ) {
        this._$elem.find( ".geo-service" ).each( function( ) {
          result = $.merge( result, $( this ).geomap( "find", point, pixelTolerance ) );
        } );
      }

      return result;
    },

    remove: function ( shape, refresh ) {
      for ( var i = 0; i < this._graphicShapes.length; i++ ) {
        if ( this._graphicShapes[ i ].shape == shape ) {
          $.removeData( shape, "geoBbox" );
          var rest = this._graphicShapes.slice( i + 1 );
          this._graphicShapes.length = i;
          this._graphicShapes.push.apply( this._graphicShapes, rest );
          break;
        }
      }

      if ( refresh === undefined || refresh ) {
        this._refresh();
      }
    },

    _getBbox: function (center, pixelSize) {
      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;
      // calculate the internal bbox
      var halfWidth = this._contentBounds["width"] / 2 * pixelSize,
          halfHeight = this._contentBounds["height"] / 2 * pixelSize;
      return [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight];
    },

    _setBbox: function (value, trigger, refresh) {
      var center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2],
          pixelSize = Math.max($.geo.width(value, true) / this._contentBounds.width, $.geo.height(value, true) / this._contentBounds.height);

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

    _getServicesContainer: function () {
      return this._$servicesContainer;
    },

    _getZoom: function () {
      // calculate the internal zoom level, vs. public zoom property
      if (this._options["tilingScheme"]) {
        return this._getTiledZoom(this._pixelSize);
      } else {
        var ratio = this._contentBounds["width"] / this._contentBounds["height"],
            bbox = $.geo.reaspect(this._getBbox(), ratio, true),
            bboxMax = $.geo.reaspect(this._getBboxMax(), ratio, true);

        return Math.log($.geo.width(bboxMax, true) / $.geo.width(bbox, true)) / Math.log(this._zoomFactor);
      }
    },

    _setZoom: function (value, trigger, refresh) {
      value = Math.max(value, 0);

      if (this._options["tilingScheme"]) {
        this._setCenterAndSize(this._center, this._getTiledPixelSize(value), trigger, refresh);
      } else {
        var bbox = $.geo.scaleBy(this._getBboxMax(), 1 / Math.pow(this._zoomFactor, value), true),
            pixelSize = Math.max($.geo.width(bbox, true) / this._contentBounds.width, $.geo.height(bbox, true) / this._contentBounds.height);
        this._setCenterAndSize(this._center, pixelSize, trigger, refresh);
      }
    },

    _createChildren: function () {
      this._$existingChildren = this._$elem.children().detach();

      this._forcePosition(this._$existingChildren);

      this._$existingChildren.css("-moz-user-select", "none");

      var contentSizeCss = "width:" + this._contentBounds["width"] + "px; height:" + this._contentBounds["height"] + "px; margin:0; padding:0;",
          contentPosCss = "position:absolute; left:0; top:0;";

      this._$elem.prepend('<div class="geo-event-target geo-content-frame" style="position:absolute; left:' + this._contentBounds.x + 'px; top:' + this._contentBounds.y + 'px;' + contentSizeCss + 'overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;" unselectable="on"></div>');
      this._$eventTarget = this._$contentFrame = this._$elem.children(':first');

      this._$contentFrame.append('<div class="geo-services-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$servicesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-shapes-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$shapesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-draw-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$drawContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-measure-container" style="' + contentPosCss + contentSizeCss + '"><div class="geo-measure-label" style="' + contentPosCss + '; display: none;"></div></div>');
      this._$measureContainer = this._$contentFrame.children(':last');
      this._$measureLabel = this._$measureContainer.children();

      this._$panContainer = $( [ this._$shapesContainer[ 0 ], this._$drawContainer[ 0 ], this._$measureContainer[ 0 ] ] );

      this._$resizeContainer = $( [ this._$contentFrame[ 0 ], this._$servicesContainer[ 0 ], this._$eventTarget[ 0 ], this._$measureContainer[ 0 ] ] ); 

      this._$contentFrame.append(this._$existingChildren);

      if ( ! $("#geo-measure-style").length ) {
        $("head").prepend( '<style type="text/css" id="geo-measure-style">.geo-measure-label { margin: 4px 0 0 6px; font-family: sans-serif;' + ( _ieVersion ? 'letter-spacing: 2px; color: #444; filter:progid:DXImageTransform.Microsoft.DropShadow(Color=white, OffX=1, OffY=2, Positive=true);' : 'color: #000; text-shadow: #fff 1px 2px; font-weight: bold;' ) + ' }</style>' );
      }
    },

    _createServices: function () {
      var i, serviceContainer, service;

      for (i = 0; i < this._currentServices.length; i++) {
        // TODO: destroy service-level geographics
        this._currentServices[i].serviceContainer.geomap("destroy");
        $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
      }

      this._currentServices = [];
      this._$servicesContainer.html( "" );

      for (i = 0; i < this._options["services"].length; i++) {
        service = this._options["services"][i];
        this._currentServices[i] = service;

        var idString = service.id ? ' id="' + service.id + '"' : "",
            classString = 'class="geo-service ' + ( service["class"] ? service["class"] : '' ) + '"',
            scHtml = '<div ' + idString + classString + ' style="position:absolute; left:0; top:0; width:32px; height:32px; margin:0; padding:0; display:' + (service.visibility === undefined || service.visibility === "visible" ? "block" : "none") + ';"></div>';

        this._$servicesContainer.append( scHtml );
        serviceContainer = this._$servicesContainer.children( ":last" );
        this._currentServices[i].serviceContainer = serviceContainer;
        
        $.geo["_serviceTypes"][this._currentServices[i].type].create(this, serviceContainer, this._currentServices[i], i);

        serviceContainer.data( "geoMap", this ).geomap();
      }
    },

    _refreshDrawing: function ( ) {
      this._$drawContainer.geographics("clear");

      if ( this._drawPixels.length > 0 ) {
        var mode = this._options[ "mode" ],
            pixels = this._drawPixels,
            coords = this._drawCoords,
            label,
            labelShape,
            labelPixel,
            widthOver,
            heightOver;

        switch ( mode ) {
          case "measureLength":
            mode = "drawLineString";
            labelShape = {
              type: "LineString",
              coordinates: coords
            };
            label = $.render( { length: $.geo.length( labelShape, true ) }, "geoMeasureLength" );
            labelPixel = $.merge( [], pixels[ pixels.length - 1 ] );
            break;

          case "measureArea":
            mode = "drawPolygon";

            labelShape = {
              type: "Polygon",
              coordinates: [ $.merge( [ ], coords ) ]
            };
            labelShape.coordinates[ 0 ].push( coords[ 0 ] );

            label = $.render( { area: $.geo.area( labelShape, true ) }, "geoMeasureArea" );
            labelPixel = $.merge( [], pixels[ pixels.length - 1 ] );
            pixels = [ pixels ];
            break;

          case "drawPolygon":
            pixels = [ pixels ];
            break;
        }

        this._$drawContainer.geographics( mode, pixels );
        
        if ( label ) {
          this._$measureLabel.html( label );

          widthOver = this._contentBounds.width - ( this._$measureLabel.outerWidth( true ) + labelPixel[ 0 ] );
          heightOver = this._contentBounds.height - ( this._$measureLabel.outerHeight( true ) + labelPixel[ 1 ] );

          if ( widthOver < 0 ) {
            labelPixel[ 0 ] += widthOver;
          }

          if ( heightOver < 0 ) {
            labelPixel[ 1 ] += heightOver;
          }

          this._$measureLabel.css( {
            left: labelPixel[ 0 ],
            top: labelPixel[ 1 ]
          } ).show();
        }
      }
    },

    _resetDrawing: function () {
      //this._$textContainer.hide();
      this._drawPixels = [];
      this._drawCoords = [];
      this._$drawContainer.geographics("clear");
      this._$measureLabel.hide();
    },

    _refreshShapes: function (geographics, shapes, styles, labels, center, pixelSize) {
      var i, mgi,
          shape,
          shapeBbox,
          style,
          label,
          hasLabel,
          labelPixel,
          bbox = this._map._getBbox(center, pixelSize);

      for (i = 0; i < shapes.length; i++) {
        shape = shapes[i].shape || shapes[i];
        shape = shape.geometry || shape;
        shapeBbox = $.data(shape, "geoBbox");

        if ( shapeBbox && $.geo._bboxDisjoint( bbox, shapeBbox ) ) {
          continue;
        }

        style = $.isArray(styles) ? styles[i].style : styles;
        label = $.isArray(labels) ? labels[i].label : labels;
        hasLabel = ( label !== undefined );
        labelPixel = undefined;

        switch (shape.type) {
          case "Point":
            labelPixel = this._map.toPixel( shape.coordinates, center, pixelSize );
            this._$shapesContainer.geographics("drawPoint", labelPixel, style);
            break;
          case "LineString":
            this._$shapesContainer.geographics("drawLineString", this._map.toPixel(shape.coordinates, center, pixelSize), style);
            if ( hasLabel ) {
              labelPixel = this._map.toPixel( $.geo.pointAlong( shape, .5 ).coordinates, center, pixelSize );
            }
            break;
          case "Polygon":
            this._$shapesContainer.geographics("drawPolygon", this._map.toPixel(shape.coordinates, center, pixelSize), style);
            if ( hasLabel ) {
              labelPixel = this._map.toPixel( $.geo.centroid( shape ).coordinates, center, pixelSize );
            }
            break;
          case "MultiPoint":
            for (mgi = 0; mgi < shape.coordinates.length; mgi++) {
              this._$shapesContainer.geographics("drawPoint", this._map.toPixel(shape.coordinates[mgi], center, pixelSize), style);
            }
            if ( hasLabel ) {
              labelPixel = this._map.toPixel( $.geo.centroid( shape ).coordinates, center, pixelSize );
            }
            break;
          case "MultiLineString":
            for (mgi = 0; mgi < shape.coordinates.length; mgi++) {
              this._$shapesContainer.geographics("drawLineString", this._map.toPixel(shape.coordinates[mgi], center, pixelSize), style);
            }
            if ( hasLabel ) {
              labelPixel = this._map.toPixel( $.geo.centroid( shape ).coordinates, center, pixelSize );
            }
            break;
          case "MultiPolygon":
            for (mgi = 0; mgi < shape.coordinates.length; mgi++) {
              this._$shapesContainer.geographics("drawPolygon", this._map.toPixel(shape.coordinates[mgi], center, pixelSize), style);
            }
            if ( hasLabel ) {
              labelPixel = this._map.toPixel( $.geo.centroid( shape ).coordinates, center, pixelSize );
            }
            break;

          case "GeometryCollection":
            this._refreshShapes(geographics, shape.geometries, style, label, center, pixelSize);
            break;
        }

        if ( hasLabel && labelPixel ) {
          this._$shapesContainer.geographics( "drawLabel", labelPixel, label );
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
          levels = tilingScheme.pixelSizes.length;
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
      this._wheelTimeout = null;

      if (this._wheelLevel != 0) {
        var wheelCenterAndSize = this._getZoomCenterAndSize(this._anchor, this._wheelLevel, this._wheelZoomFactor);

        this._setCenterAndSize(wheelCenterAndSize.center, wheelCenterAndSize.pixelSize, true, true);

        this._wheelLevel = 0;
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

        var dx = this._current[0] - this._anchor[0],
            dy = this._current[1] - this._anchor[1],
            image = this._options[ "axisLayout" ] === "image",
            dxMap = -dx * this._pixelSize,
            dyMap = ( image ? -1 : 1 ) * dy * this._pixelSize;

        this._$panContainer.css({ left: 0, top: 0 });

        this._$servicesContainer.find( ".geo-shapes-container" ).css( { left: 0, top: 0 } );

        this._setCenterAndSize([this._center[0] + dxMap, this._center[1] + dyMap], this._pixelSize, true, true);

        this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);

        this._inOp = false;
        this._anchor = this._current;
        this._mouseDown = this._toolPan = this._panning = false;
      }
    },

    _panMove: function () {
      if ( ! this._options[ "pannable" ] ) {
        return;
      }

      var dx = this._current[0] - this._lastDrag[0],
          dy = this._current[1] - this._lastDrag[1],
          i = 0,
          service,
          translateObj;

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

          translateObj = {
            left: function (index, value) {
              return parseInt(value) + dx;
            },
            top: function (index, value) {
              return parseInt(value) + dy;
            }
          };

          for ( i = 0; i < this._currentServices.length; i++ ) {
            service = this._currentServices[ i ];
            $.geo[ "_serviceTypes" ][ service.type ].interactivePan( this, service, dx, dy );
            
            service.serviceContainer.find( ".geo-shapes-container" ).css( translateObj );
          }

          this._$panContainer.css( translateObj );

          //this._refreshDrawing();
        }
      }
    },

    _refresh: function () {
      var service,
          i = 0;

      if ( this._$elem.not( ".geo-service" ).length > 0 ) {
        for ( ; i < this._currentServices.length; i++ ) {
          service = this._currentServices[ i ];

          if ( !this._mouseDown && $.geo[ "_serviceTypes" ][ service.type ] !== null ) {
            $.geo[ "_serviceTypes" ][ service.type ].refresh( this, service );
            service.serviceContainer.geomap( "refresh" );
          }
        }
      }

      if ( this._$shapesContainer ) {
        this._$shapesContainer.geographics( "clear" );
        if ( this._graphicShapes.length > 0 ) {
          this._refreshShapes( this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes );
        }
      }
    },

    _setCenterAndSize: function (center, pixelSize, trigger, refresh) {
      // the final call during any extent change
      if (this._pixelSize != pixelSize) {
        this._$elem.find( ".geo-shapes-container" ).geographics("clear");
        for (var i = 0; i < this._options["services"].length; i++) {
          var service = this._options["services"][i];
          $.geo["_serviceTypes"][service.type].interactiveScale(this, service, center, pixelSize);
        }
      }

      this._center = center;
      this.options["pixelSize"] = this._pixelSize = pixelSize;

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

      if (this._drawCoords.length > 0) {
        this._drawPixels = this._toPixel(this._drawCoords);
      }

      if (trigger) {
        this._trigger("bboxchange", window.event, { bbox: this._options["bbox"] });
      }

      if (refresh) {
        this._refresh();
        this._refreshDrawing();
      }
    },

    _toMap: function (p, center, pixelSize) {
      // ignores $.geo.proj

      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var isMultiPointOrLineString = $.isArray( p[ 0 ] ),
          isMultiLineStringOrPolygon = isMultiPointOrLineString && $.isArray( p[ 0 ][ 0 ] ),
          isMultiPolygon = isMultiLineStringOrPolygon && $.isArray( p[ 0 ][ 0 ][ 0 ] ),
          width = this._contentBounds["width"],
          height = this._contentBounds["height"],
          halfWidth = width / 2 * pixelSize,
          halfHeight = height / 2 * pixelSize,
          bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
          xRatio = $.geo.width(bbox, true) / width,
          yRatio = $.geo.height(bbox, true) / height,
          yOffset,
          image = this._options[ "axisLayout" ] === "image",
          result = [],
          i, j, k;

      if ( !isMultiPolygon ) {
        if ( !isMultiLineStringOrPolygon ) {
          if ( !isMultiPointOrLineString ) {
            p = [ p ];
          }
          p = [ p ];
        }
        p = [ p ];
      }

      for ( i = 0; i < p.length; i++ ) {
        result[ i ] = [ ];
        for ( j = 0; j < p[ i ].length; j++ ) {
          result[ i ][ j ] = [ ];
          for ( k = 0; k < p[ i ][ j ].length; k++ ) {
            yOffset = (p[ i ][ j ][ k ][1] * yRatio);
            result[ i ][ j ][ k ] = [
              bbox[ 0 ] + ( p[ i ][ j ][ k ][ 0 ] * xRatio ),
              image ? bbox[ 1 ] + yOffset : bbox[ 3 ] - yOffset
            ];
          }
        }
      }

      return isMultiPolygon ? result : isMultiLineStringOrPolygon ? result[ 0 ] : isMultiPointOrLineString ? result[ 0 ][ 0 ] : result[ 0 ][ 0 ][ 0 ];
    },

    _toPixel: function (p, center, pixelSize) {
      // ignores $.geo.proj

      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var isMultiPointOrLineString = $.isArray( p[ 0 ] ),
          isMultiLineStringOrPolygon = isMultiPointOrLineString && $.isArray( p[ 0 ][ 0 ] ),
          isMultiPolygon = isMultiLineStringOrPolygon && $.isArray( p[ 0 ][ 0 ][ 0 ] ),
          width = this._contentBounds["width"],
          height = this._contentBounds["height"],
          halfWidth = width / 2 * pixelSize,
          halfHeight = height / 2 * pixelSize,
          bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
          bboxWidth = $.geo.width(bbox, true),
          bboxHeight = $.geo.height(bbox, true),
          image = this._options[ "axisLayout" ] === "image",
          xRatio = width / bboxWidth,
          yRatio = height / bboxHeight,
          result = [ ],
          i, j, k;

      if ( !isMultiPolygon ) {
        if ( !isMultiLineStringOrPolygon ) {
          if ( !isMultiPointOrLineString ) {
            p = [ p ];
          }
          p = [ p ];
        }
        p = [ p ];
      }

      for ( i = 0; i < p.length; i++ ) {
        result[ i ] = [ ];
        for ( j = 0; j < p[ i ].length; j++ ) {
          result[ i ][ j ] = [ ];
          for ( k = 0; k < p[ i ][ j ].length; k++ ) {
            result[ i ][ j ][ k ] = [
              Math.round( ( p[ i ][ j ][ k ][ 0 ] - bbox[ 0 ] ) * xRatio ),
              Math.round( ( image ? p[ i ][ j ][ k ][ 1 ] - bbox[ 1 ] : bbox[ 3 ] - p[ i ][ j ][ k ][ 1 ] ) * yRatio )
            ];
          }
        }
      }

      return isMultiPolygon ? result : isMultiLineStringOrPolygon ? result[ 0 ] : isMultiPointOrLineString ? result[ 0 ][ 0 ] : result[ 0 ][ 0 ][ 0 ];
    },

    _zoomTo: function (coord, zoom, trigger, refresh) {
      zoom = zoom < 0 ? 0 : zoom;

      var tiledPixelSize = this._getTiledPixelSize(zoom);

      if (!isNaN(tiledPixelSize)) {
        this._setCenterAndSize(coord, tiledPixelSize, trigger, refresh);
      } else {
        var bboxMax = $.geo._scaleBy(this._getBboxMax(), 1 / Math.pow(this._zoomFactor, zoom), true),
            pixelSize = Math.max($.geo.width(bboxMax, true) / this._contentBounds["width"], $.geo.height(bboxMax, true) / this._contentBounds["height"]);

        this._setCenterAndSize(coord, pixelSize, trigger, refresh);
      }
    },

    _document_keydown: function (e) {
      var len = this._drawCoords.length;
      if (len > 0 && e.which == 27) {
        if (len <= 2) {
          this._resetDrawing();
          this._inOp = false;
        } else {
          this._drawCoords[len - 2] = $.merge( [], this._drawCoords[ len - 1 ] );
          this._drawPixels[len - 2] = $.merge( [], this._drawPixels[ len - 1 ] );

          this._drawCoords.length--;
          this._drawPixels.length--;

          this._refreshDrawing();
        }
      }
    },

    _eventTarget_dblclick_zoom: function(e) {
      this._trigger("dblclick", e, { type: "Point", coordinates: this.toMap(this._current) });
      if (!e.isDefaultPrevented()) {
        var centerAndSize = this._getZoomCenterAndSize(this._current, 1, this._zoomFactor);
        this._setCenterAndSize(centerAndSize.center, centerAndSize.pixelSize, true, true);
      }
    },

    _eventTarget_dblclick: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      this._panFinalize();

      if (this._drawTimeout) {
        window.clearTimeout(this._drawTimeout);
        this._drawTimeout = null;
      }

      var offset = $(e.currentTarget).offset();

      switch (this._options["mode"]) {
        case "drawLineString":
          if ( this._drawCoords.length > 1 && ! ( this._drawCoords[0][0] == this._drawCoords[1][0] &&
                                                  this._drawCoords[0][1] == this._drawCoords[1][1] ) ) {
              this._drawCoords.length--;
              this._trigger( "shape", e, {
                type: "LineString",
                coordinates: $.geo.proj ? $.geo.proj.toGeodetic(this._drawCoords) : this._drawCoords
              } );
          } else {
            this._eventTarget_dblclick_zoom(e);
          }
          this._resetDrawing();
          break;

        case "drawPolygon":
          if ( this._drawCoords.length > 1 && ! ( this._drawCoords[0][0] == this._drawCoords[1][0] &&
                                                  this._drawCoords[0][1] == this._drawCoords[1][1] ) ) {
            var endIndex = this._drawCoords.length - 1;
            if (endIndex > 2) {
              this._drawCoords[endIndex] = $.merge( [], this._drawCoords[0] );
              this._trigger( "shape", e, {
                type: "Polygon",
                coordinates: [ $.geo.proj ? $.geo.proj.toGeodetic(this._drawCoords) : this._drawCoords ]
              } );
            }
          } else {
            this._eventTarget_dblclick_zoom(e);
          }
          this._resetDrawing();
          break;

        case "measureLength":
        case "measureArea":
          this._resetDrawing();
          break;

        default:
          this._eventTarget_dblclick_zoom(e);
          break;
      }

      this._inOp = false;
    },

    _eventTarget_touchstart: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      if ( !this._supportTouch && e.which != 1 ) {
        return;
      }

      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      this._panFinalize();
      this._mouseWheelFinish();

      var offset = $(e.currentTarget).offset(),
          touches = e.originalEvent.changedTouches;

      if ( this._supportTouch ) {
        this._multiTouchAnchor = touches;

        this._isMultiTouch = touches.length > 1;

        if ( this._isMultiTouch ) {
          this._multiTouchCurrentBbox = [
            touches[0].pageX - offset.left,
            touches[0].pageY - offset.top,
            touches[1].pageX - offset.left,
            touches[1].pageY - offset.top
          ];

          this._multiTouchAnchorBbox = $.merge( [ ], this._multiTouchCurrentBbox );

          this._current = $.geo.center( this._multiTouchCurrentBbox, true );
        } else {
          this._current = [ touches[0].pageX - offset.left, touches[0].pageY - offset.top ];
        }
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
            } else {
              this._current = this._anchor;
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

      this._mouseDown = true;
      this._anchor = this._current;

      if (!this._inOp && e.shiftKey) {
        this._shiftZoom = true;
        this._$eventTarget.css("cursor", this._options["cursors"]["zoom"]);
      } else if ( !this._isMultiTouch && this._options[ "pannable" ] ) {
        this._inOp = true;

        switch (this._options["mode"]) {
          case "zoom":
            break;

          default:
            this._lastDrag = this._current;

            if (e.currentTarget.setCapture) {
              e.currentTarget.setCapture();
            }

            break;
        }
      }

      e.preventDefault();
      return false;
    },

    _dragTarget_touchmove: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      var offset = this._$eventTarget.offset(),
          drawCoordsLen = this._drawCoords.length,
          touches = e.originalEvent.changedTouches,
          current,
          service,
          i = 0;

      if ( this._supportTouch ) {
        if ( !this._isMultiTouch && touches[ 0 ].identifier !== this._multiTouchAnchor[ 0 ].identifier ) {
          // switch to multitouch
          this._mouseDown = false;
          this._dragTarget_touchstop( e );

          this._isMultiTouch = true;

          touches = [
            this._multiTouchAnchor[ 0 ],
            touches[ 0 ]
          ];

          this._multiTouchCurrentBbox = [
            touches[0].pageX - offset.left,
            touches[0].pageY - offset.top,
            touches[1].pageX - offset.left,
            touches[1].pageY - offset.top
          ];

          this._multiTouchAnchorBbox = $.merge( [ ], this._multiTouchCurrentBbox );

          this._anchor = this._current = $.geo.center( this._multiTouchCurrentBbox, true );

          return false;
        }

        if ( this._isMultiTouch ) {
          for ( ; i < touches.length; i++ ) {
            if ( touches[ i ].identifier === this._multiTouchAnchor[ 0 ].identifier ) {
              this._multiTouchCurrentBbox[ 0 ] = touches[ i ].pageX - offset.left;
              this._multiTouchCurrentBbox[ 1 ] = touches[ i ].pageY - offset.top;
            } else if ( touches[ i ].identifier === this._multiTouchAnchor[ 1 ].identifier ) {
              this._multiTouchCurrentBbox[ 2 ] = touches[ i ].pageX - offset.left;
              this._multiTouchCurrentBbox[ 3 ] = touches[ i ].pageY - offset.top;
            }
          }

          current = $.geo.center( this._multiTouchCurrentBbox, true );

          var currentWidth = this._multiTouchCurrentBbox[ 2 ] - this._multiTouchCurrentBbox[ 0 ],
              anchorWidth = this._multiTouchAnchorBbox[ 2 ] - this._multiTouchAnchorBbox[ 0 ],
              ratioWidth = currentWidth / anchorWidth;

          if ( Math.abs( currentWidth ) < Math.abs( anchorWidth ) ) {
            this._wheelLevel = - Math.abs( Math.floor( ( 1 - ratioWidth ) * 10 ) );
          } else {
            this._wheelLevel = Math.abs( Math.floor( ( 1 - ratioWidth ) * 10 / 2 ) );
          }

          var pinchCenterAndSize = this._getZoomCenterAndSize( this._anchor, this._wheelLevel, this._wheelZoomFactor );

          this._$elem.find( ".geo-shapes-container" ).geographics("clear");

          for ( i = 0; i < this._currentServices.length; i++ ) {
            service = this._currentServices[ i ];
            $.geo[ "_serviceTypes" ][ service.type ].interactiveScale( this, service, pinchCenterAndSize.center, pinchCenterAndSize.pixelSize );
          }

          if (this._graphicShapes.length > 0 && this._graphicShapes.length < 256) {
            this._refreshShapes(this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes, pinchCenterAndSize.center, pinchCenterAndSize.pixelSize);
          }


          if (this._drawCoords.length > 0) {
            this._drawPixels = this._toPixel(this._drawCoords, pinchCenterAndSize.center, pinchCenterAndSize.pixelSize);
            this._refreshDrawing();
          }

          current = $.geo.center( this._multiTouchCurrentBbox, true );
        } else {
          current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        }
      } else {
        current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      if (current[0] === this._lastMove[0] && current[1] === this._lastMove[1]) {
        if ( this._inOp ) {
          e.preventDefault();
          return false;
        }
      }

      if (this._softDblClick) {
        this._isDbltap = this._isTap = false;
      }

      if (this._mouseDown) {
        this._current = current;
        this._moveDate = $.now();
      }

      if ( this._isMultiTouch ) {
        e.preventDefault( );
        return false;
      }

      var mode = this._shiftZoom ? "zoom" : this._options["mode"];

      switch (mode) {
        case "zoom":
          if ( this._mouseDown ) {
            this._$drawContainer.geographics( "clear" );
            this._$drawContainer.geographics( "drawBbox", [
              this._anchor[ 0 ],
              this._anchor[ 1 ],
              current[ 0 ],
              current[ 1 ]
            ] );
          } else {
            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;

        case "drawLineString":
        case "drawPolygon":
        case "measureLength":
        case "measureArea":
          if (this._mouseDown || this._toolPan) {
            this._panMove();
          } else {
            if (drawCoordsLen > 0) {
              this._drawCoords[drawCoordsLen - 1] = this._toMap(current);
              this._drawPixels[drawCoordsLen - 1] = current;

              this._refreshDrawing();
            }

            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;

        default:
          if (this._mouseDown || this._toolPan) {
            this._panMove();
          } else {
            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;
      }

      this._lastMove = current;

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _dragTarget_touchstop: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      if (!this._mouseDown && _ieVersion == 7) {
        // ie7 doesn't appear to trigger dblclick on this._$eventTarget,
        // we fake regular click here to cause soft dblclick
        this._eventTarget_touchstart(e);
      }

      var mouseWasDown = this._mouseDown,
          wasToolPan = this._toolPan,
          offset = this._$eventTarget.offset(),
          mode = this._shiftZoom ? "zoom" : this._options["mode"],
          current, i, clickDate,
          dx, dy;

      if (this._supportTouch) {
        current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
      } else {
        current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      dx = current[0] - this._anchor[0];
      dy = current[1] - this._anchor[1];

      this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);

      this._shiftZoom = this._mouseDown = this._toolPan = false;

      if ( this._isMultiTouch ) {
        e.preventDefault( );
        this._isMultiTouch = false;

        var pinchCenterAndSize = this._getZoomCenterAndSize( this._anchor, this._wheelLevel, this._wheelZoomFactor );

        this._setCenterAndSize(pinchCenterAndSize.center, pinchCenterAndSize.pixelSize, true, true);

        this._wheelLevel = 0;

        return false;
      }

      if (document.releaseCapture) {
        document.releaseCapture();
      }

      if (mouseWasDown) {
        clickDate = $.now();
        this._current = current;

        switch (mode) {
          case "zoom":
            if ( dx > 0 || dy > 0 ) {
              var minSize = this._pixelSize * 6,
                  bboxCoords = this._toMap( [ [
                      Math.min( this._anchor[ 0 ], current[ 0 ] ),
                      Math.max( this._anchor[ 1 ], current[ 1 ] )
                    ], [
                      Math.max( this._anchor[ 0 ], current[ 0 ] ),
                      Math.min( this._anchor[ 1 ], current[ 1 ] )
                    ]
                  ] ),
                  bbox = [
                    bboxCoords[0][0],
                    bboxCoords[0][1],
                    bboxCoords[1][0],
                    bboxCoords[1][1]
                  ];

              if ( ( bbox[2] - bbox[0] ) < minSize && ( bbox[3] - bbox[1] ) < minSize ) {
                bbox = $.geo.scaleBy( this._getBbox( $.geo.center( bbox, true ) ), .5, true );
              }

              this._setBbox(bbox, true, true);
            }

            this._resetDrawing();
            break;

          case "drawPoint":
            if (this._drawTimeout) {
              window.clearTimeout(this._drawTimeout);
              this._drawTimeout = null;
            }

            if (wasToolPan) {
              this._panFinalize();
            } else {
              if (clickDate - this._clickDate > 100) {
                var geomap = this;
                this._drawTimeout = setTimeout(function () {
                  if (geomap._drawTimeout) {
                    geomap._trigger("shape", e, { type: "Point", coordinates: geomap.toMap(current) });
                    geomap._inOp = false;
                    geomap._drawTimeout = null;
                  }
                }, 250);
              }
            }
            break;

          case "drawLineString":
          case "drawPolygon":
          case "measureLength":
          case "measureArea":
            if (wasToolPan) {
              this._panFinalize();
            } else {
              i = (this._drawCoords.length == 0 ? 0 : this._drawCoords.length - 1);

              this._drawCoords[i] = this._toMap(current);
              this._drawPixels[i] = current;

              if (i < 2 || !(this._drawCoords[i][0] == this._drawCoords[i-1][0] &&
                             this._drawCoords[i][1] == this._drawCoords[i-1][1])) {
                this._drawCoords[i + 1] = this._toMap(current);
                this._drawPixels[i + 1] = current;
              }

              this._refreshDrawing();
            }
            break;

          default:
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

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _eventTarget_mousewheel: function (e, delta) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      e.preventDefault();

      this._panFinalize();

      if ( this._mouseDown || this._options[ "scroll" ] === "off" ) {
        return false;
      }

      if (delta != 0) {
        if (this._wheelTimeout) {
          window.clearTimeout(this._wheelTimeout);
          this._wheelTimeout = null;
        } else {
          var offset = $(e.currentTarget).offset();
          this._anchor = [e.pageX - offset.left, e.pageY - offset.top];
        }

        this._wheelLevel += delta;

        var wheelCenterAndSize = this._getZoomCenterAndSize(this._anchor, this._wheelLevel, this._wheelZoomFactor),
            service,
            i = 0;

        this._$elem.find( ".geo-shapes-container" ).geographics("clear");

        for ( ; i < this._currentServices.length; i++ ) {
          service = this._currentServices[ i ];
          $.geo["_serviceTypes"][service.type].interactiveScale(this, service, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
        }

        if (this._graphicShapes.length > 0 && this._graphicShapes.length < 256) {
          this._refreshShapes(this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
        }

        if (this._drawCoords.length > 0) {
          this._drawPixels = this._toPixel(this._drawCoords, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
          this._refreshDrawing();
        }

        var geomap = this;
        this._wheelTimeout = window.setTimeout(function () {
          geomap._mouseWheelFinish();
        }, 1000);
      }

      return false;
    }
  }
  );
})(jQuery);

