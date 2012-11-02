(function ($, undefined) {
  var _widgetIdSeed = 0,
      _ieVersion = ( function () {
        var v = 5, div = document.createElement("div"), a = div.all || [];
        do {
          div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->";
        } while ( a[0] );
        return v > 6 ? v : !v;
      }() ),

      _defaultOptions = {
        bbox: [-180, -85, 180, 85],
        bboxMax: [-180, -85, 180, 85],
        center: [0, 0],
        cursors: {
          "static": "default",
          pan: "url(data:image/vnd.microsoft.icon;base64,AAACAAEAICACAAgACAAwAQAAFgAAACgAAAAgAAAAQAAAAAEAAQAAAAAAAAEAAAAAAAAAAAAAAgAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAA/AAAAfwAAAP+AAAH/gAAB/8AAA//AAAd/wAAGf+AAAH9gAADbYAAA2yAAAZsAAAGbAAAAGAAAAAAAAA//////////////////////////////////////////////////////////////////////////////////////gH///4B///8Af//+AD///AA///wAH//4AB//8AAf//AAD//5AA///gAP//4AD//8AF///AB///5A////5///8=), move",
          zoom: "crosshair",
          dragBox: "crosshair",
          dragCircle: "crosshair",
          drawPoint: "crosshair",
          drawLineString: "crosshair",
          drawPolygon: "crosshair",
          measureLength: "crosshair",
          measureArea: "crosshair"
        },
        measureLabels: {
          length: "{{:length.toFixed( 2 )}} m",
          area: "{{:area.toFixed( 2 )}} sq m"
        },
        drawStyle: {},
        shapeStyle: {},
        mode: "pan",
        pannable: true,
        scroll: "default",
        shift: "default",
        services: [
            {
              "class": "osm",
              type: "tiled",
              src: function (view) {
                return "http://otile" + ((view.index % 4) + 1) + ".mqcdn.com/tiles/1.0.0/osm/" + view.zoom + "/" + view.tile.column + "/" + view.tile.row + ".png";
              },
              attr: "Tiles Courtesy of <a href='http://www.mapquest.com/' target='_blank'>MapQuest</a> <img src='http://developer.mapquest.com/content/osm/mq_logo.png'>"
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
        zoomMin: 0,
        zoomMax: Number.POSITIVE_INFINITY,
        pixelSize: 0
      };

  $.widget("geo.geomap", {
    // private widget members
    _$elem: undefined, //< map div for maps, service div for services
    _map: undefined, //< only defined in services
    _created: false,
    _createdGraphics: false,
    _widgetId: 0,
    _tmplLengthId: "",
    _tmplAreaId: "",

    _contentBounds: {},

    _$resizeContainer: undefined, //< all elements that should match _contentBounds' size

    _$eventTarget: undefined,
    _$contentFrame: undefined,
    _$existingChildren: undefined,
    _$attrList: undefined,
    _$servicesContainer: undefined,
    _$shapesContainers: undefined, //< all shapesContainer divs (map only)

    _$panContainer: undefined, //< all non-service elements that move while panning
    _$shapesContainer: undefined, //< just "our" shapesContainer div (map & service)
    _$drawContainer: undefined,
    _$measureContainer: undefined,
    _$measureLabel: undefined,

    _dpi: 96,

    _currentServices: [], //< internal copy

    _center: undefined,
    _pixelSize: undefined,
    _centerMax: undefined,
    _pixelSizeMax: undefined,

    _userGeodetic: true,

    _centerInteractive: undefined,
    _pixelSizeInteractive: undefined,
    _timeoutInteractive: null,
    _triggerInteractive: false,

    _timeoutRefreshShapes: null,

    _loadCount: 0,

    _wheelTimeout: null,
    _wheelLevel: 0,

    _zoomFactor: 2, //< determines what a zoom level means

    _fullZoomFactor: 2, //< interactiveScale factor needed to zoom a whole level
    _partialZoomFactor: 1.18920711500273, //< interactiveScale factor needed to zoom a fraction of a level (the fourth root of 2)

    _mouseDown: undefined,
    _inOp: undefined,
    _toolPan: undefined,
    _shiftDown: undefined,
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
    _multiTouchAnchor: [], //< TouchList
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
        this._graphicShapes = [];
        $.Widget.prototype._createWidget.apply(this, arguments);
        return;
      }

      this._widgetId = _widgetIdSeed++;
      this._tmplLengthId = "geoMeasureLength" + this._widgetId;
      this._tmplAreaId = "geoMeasureArea" + this._widgetId;

      this._$elem.addClass("geo-map").css( {
        webkitTransform: "translateZ(0)"
      } );
        

      this._initOptions = options || {};

      this._forcePosition(this._$elem);

      this._$elem.css("text-align", "left");

      var size = this._findMapSize();
      this._contentBounds = {
        x: parseInt(this._$elem.css("padding-left"), 10),
        y: parseInt(this._$elem.css("padding-top"), 10),
        width: size["width"],
        height: size["height"]
      };

      this._createChildren();

      this._center = [ 0, 0 ];
      this._centerMax = [ 0, 0 ];
      this._centerInteractive = [ 0, 0 ];

      this.options["pixelSize"] = this._pixelSize = this._pixelSizeMax = 156543.03392799936;

      this._mouseDown =
          this._inOp =
          this._toolPan =
          this._shiftDown =
          this._panning =
          this._isTap =
          this._isDbltap = false;

      this._anchor = [ 0, 0 ];
      this._current = [ 0, 0 ];
      this._lastMove = [ 0, 0 ];
      this._lastDrag = [ 0, 0 ];
      this._velocity = [ 0, 0 ];

      this._friction = [0.8, 0.8];

      this._downDate =
          this._moveDate =
          this._clickDate = 0;

      this._drawPixels = [];
      this._drawCoords =  [];
      this._graphicShapes = [];


      $.Widget.prototype._createWidget.apply(this, arguments);
    },

    _create: function () {
      this._options = this.options;

      if (this._$elem.is(".geo-service")) {
        this._map = this._$elem.data( "geoMap" );
        this._$elem.data( "geoService", this );
        return;
      }

      this._map = this;

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
            geomap._$elem.geomap( "resize", true );
          }
        }, 500);
      };

      $(window).resize(this._windowHandler);

      this._$drawContainer.geographics({ style: this._initOptions.drawStyle || {}, doubleBuffer: false });
      this._options["drawStyle"] = this._$drawContainer.geographics("option", "style");

      this._$shapesContainer.geographics( { style: this._initOptions.shapeStyle || { } } );
      this._createdGraphics = true;

      this._options["shapeStyle"] = this._$shapesContainer.geographics("option", "style");

      if (this._initOptions) {
        // always init tilingScheme right away, even if it's null
        if ( this._initOptions.tilingScheme !== undefined ) {
          this._setOption("tilingScheme", this._initOptions.tilingScheme || null, false);
        }

        if ( this._initOptions.services ) {
          // jQuery UI Widget Factory merges user services with our default, we want to clobber the default
          this._options[ "services" ] = $.merge( [ ], this._initOptions.services );
        }
        if (this._initOptions.bboxMax) {
          this._setOption("bboxMax", this._initOptions.bboxMax, false);
          this._setOption("bbox", this._initOptions.bboxMax, false);
        }
        if (this._initOptions.zoomMin !== undefined) {
          this._setOption("zoomMin", this._initOptions.zoomMin, false);
        }
        if (this._initOptions.zoomMax !== undefined) {
          this._setOption("zoomMax", this._initOptions.zoomMax, false);
        }
        if (this._initOptions.bbox) {
          this._setOption("bbox", this._initOptions.bbox, false);
        }
        if (this._initOptions.center) {
          this._setOption("center", this._initOptions.center, false);
        }
        if (this._initOptions.zoom !== undefined) {
          this._setOption("zoom", this._initOptions.zoom, false);
        }
      }

      $.templates( this._tmplLengthId, this._options[ "measureLabels" ].length );
      $.templates( this._tmplAreaId, this._options[ "measureLabels" ].area );

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

      var center, pixelSize, bbox, zoom;

      switch (key) {
        case "bbox":
          if ( this._created ) {
            this._clearInteractiveTimeout( );
          }

          this._userGeodetic = $.geo.proj && $.geo._isGeodetic( value );
          if ( this._userGeodetic ) {
            value = $.geo.proj.fromGeodetic( value );
          }

          center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2];
          pixelSize = Math.max($.geo.width(value, true) / this._contentBounds.width, $.geo.height(value, true) / this._contentBounds.height);

          // clamp to zoom
          zoom = this._getZoom( center, pixelSize );

          if ( this._options[ "tilingScheme" ] ) {
            pixelSize = this._getPixelSize( Math.min( Math.max( zoom, this._options[ "zoomMin" ] ), this._options[ "zoomMax" ] ) );
          } else {
            if ( zoom < this._options[ "zoomMin" ] ) {
              pixelSize = this._getPixelSize( this._options[ "zoomMin" ] );
            } else if ( zoom > this._options[ "zoomMax" ] ) {
              pixelSize = this._getPixelSize( this._options[ "zoomMax" ] );
            }
          }

          if ( this._created ) {
            this._setInteractiveCenterAndSize( center, pixelSize );
            this._setInteractiveTimeout( false );
          } else {
            this._setCenterAndSize( center, pixelSize, false, refresh );
          }

          value = this._getBbox( center, pixelSize );
          break;

        case "bboxMax":
          this._userGeodetic = $.geo.proj && $.geo._isGeodetic( value );
          break;

        case "center":
          if ( this._created ) {
            this._clearInteractiveTimeout( );
          }

          this._userGeodetic = $.geo.proj && $.geo._isGeodetic( value );
          if ( this._userGeodetic ) {
            value = $.geo.proj.fromGeodetic( value );
          }

          if ( this._created ) {
            this._setInteractiveCenterAndSize( value, this._pixelSizeInteractive );
            this._interactiveTransform( );
            this._setInteractiveTimeout( false );
          } else {
            this._setCenterAndSize( value, this._pixelSize, false, refresh );
          }
          break;

        case "measureLabels":
          value = $.extend( this._options[ "measureLabels" ], value );


          $.templates( this._tmplLengthId, this._options[ "measureLabels" ].length );
          $.templates( this._tmplAreaId, this._options[ "measureLabels" ].area );

          break;

        case "drawStyle":
          if (this._$drawContainer) {
            this._$drawContainer.geographics("option", "style", value);
            value = this._$drawContainer.geographics("option", "style");
          }
          break;

        case "shapeStyle":
          if ( this._$elem.is( ".geo-service" ) && !this._createdGraphics ) {
            this._createServiceGraphics( );
          }

          if ( this._createdGraphics ) {
            this._$shapesContainer.geographics("option", "style", value);
            value = this._$shapesContainer.geographics("option", "style");
          }
          break;

        case "mode":
          this._resetDrawing( );
          this._$eventTarget.css("cursor", this._options["cursors"][value]);
          break;

        case "zoom":
          if ( this._created ) {
            this._setZoom(value, false, refresh);
          } else {
            value = Math.max( value, 0 );
            this._setCenterAndSize( this._center, this._getPixelSize( value ), false, refresh );
          }
          break;
      }

      $.Widget.prototype._setOption.apply(this, arguments);

      switch ( key ) {
        case "bbox":
        case "center":
          if ( this._userGeodetic ) {
            this._options[ "bbox" ] = $.geo.proj.toGeodetic( this._options[ "bbox" ] );
            this._options[ "center" ] = $.geo.proj.toGeodetic( this._center );
          }
          break;

        case "tilingScheme":
          if ( value !== null ) {
            this._pixelSizeMax = this._getPixelSize( 0 );
            this._centerMax = [
              value.origin[ 0 ] + this._pixelSizeMax * value.tileWidth / 2,
              value.origin[ 1 ] + this._pixelSizeMax * value.tileHeight / 2
            ];
          }
          break;

        case "bboxMax":
          if ( $.geo.proj && $.geo._isGeodetic( value ) ) {
            bbox = $.geo.proj.fromGeodetic( value );
          } else {
            bbox = value;
          }

          this._centerMax = $.geo.center( bbox );
          this._pixelSizeMax = Math.max( $.geo.width( bbox, true ) / this._contentBounds.width, $.geo.height( bbox, true ) / this._contentBounds.height );
          break;

        case "services":
          this._createServices();
          if (refresh) {
            this._refresh();
            this._refreshAllShapes();
          }
          break;

        case "shapeStyle":
          if ( refresh && this._createdGraphics ) {
            this._$shapesContainer.geographics("clear");
            this._refreshShapes( this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes );
          }
          break;
      }
    },

    destroy: function () {
      if ( this._$elem.is(".geo-service") ) {
        if ( this._createdGraphics ) {
          this._$shapesContainer.geographics("destroy");
          this._$shapesContainer = undefined;
          this._createdGraphics = false;
        }
      } else {
        clearTimeout( this._timeoutInteractive );
        this._timeoutInteractive = null;

        this._created = false;

        $(window).unbind("resize", this._windowHandler);

        for ( var i = 0; i < this._currentServices.length; i++ ) {
          this._currentServices[ i ].serviceContainer.geomap("destroy");
          $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
        }

        this._$shapesContainer.geographics("destroy");
        this._$shapesContainer = undefined;
        this._createdGraphics = false;

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
      return this._userGeodetic ? $.geo.proj.toGeodetic(p) : p;
    },

    toPixel: function ( p, _center /* Internal Use Only */, _pixelSize /* Internal Use Only */ ) {
      return this._toPixel( $.geo.proj ? $.geo.proj.fromGeodetic( p ) : p, _center, _pixelSize );
    },

    opacity: function ( value, _serviceContainer ) {
      if ( this._$elem.is( ".geo-service" ) ) {
        this._$elem.closest( ".geo-map" ).geomap( "opacity", value, this._$elem );
      } else {
        if ( value >= 0 || value <= 1 ) {
          for ( var i = 0; i < this._currentServices.length; i++ ) {
            var service = this._currentServices[ i ];
            if ( !_serviceContainer || service.serviceContainer[ 0 ] == _serviceContainer[ 0 ] ) {
              service.style.opacity = value;

              // update the original service object's style property
              service.serviceObject.style = $.extend( { }, service.serviceObject.style, service.style );

              $.geo[ "_serviceTypes" ][ service.type ].opacity( this, service );
            }
          }
        }
      }
    },

    toggle: function ( value, _serviceContainer ) {
      if ( this._$elem.is( ".geo-service" ) ) {
        this._$elem.closest( ".geo-map" ).geomap( "toggle", value, this._$elem );
      } else {

        for ( var i = 0; i < this._currentServices.length; i++ ) {
          var service = this._currentServices[ i ];

          if ( !_serviceContainer || service.serviceContainer[ 0 ] == _serviceContainer[ 0 ] ) {
            if ( value === undefined ) {
              // toggle visibility
              value = ( service.style.visibility !== "visible" );
            }

            service.style.visibility = ( value ? "visible" : "hidden" );

            // update the original service object's style property
            service.serviceObject.style = $.extend( { }, service.serviceObject.style, service.style );

            service.serviceContainer.toggle( value );

            if ( value ) {
              $.geo[ "_serviceTypes" ][ service.type ].refresh( this, service );
            }
          }
        }
      }
    },

    zoom: function (numberOfLevels) {
      if (numberOfLevels !== null) {
        this._setZoom(this._options["zoom"] + numberOfLevels, false, true);
      }
    },

    refresh: function ( force, _serviceContainer ) {
      if ( this._$elem.is( ".geo-service" ) ) {
        this._$elem.closest( ".geo-map" ).geomap( "refresh", force, this._$elem );
      } else {
        this._refresh( force, _serviceContainer );
        this._refreshAllShapes( );
      }
    },

    resize: function ( _trigger /* Internal Use Only */ ) {
      var size = this._findMapSize(),
          dx = size["width"]/2 - this._contentBounds.width/2,
          dy = size["height"]/2 - this._contentBounds.height/2,
          i;

      this._contentBounds = {
        x: parseInt(this._$elem.css("padding-left"), 10),
        y: parseInt(this._$elem.css("padding-top"), 10),
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

      this._setCenterAndSize(this._center, this._pixelSize, _trigger, true);
    },

    append: function ( shape, style, label, refresh ) {
      if ( shape && ( $.isPlainObject( shape ) || ( $.isArray( shape ) && shape.length > 0 ) ) ) {
        if ( !this._createdGraphics ) {
          this._createServiceGraphics( );
        }

        var shapes, arg, i, realStyle, realLabel, realRefresh;

        if ( $.isArray( shape ) ) {
          shapes = shape;
        } else if ( shape.type == "FeatureCollection" ) {
          shapes = shape.features;
        } else {
          shapes = [ shape ];
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
            if ( $.geo.proj && $.geo._isGeodetic( bbox ) ) {
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
          if ( this._$elem.is( ".geo-service" ) ) {
            this._refresh( false, this._$elem );
          } else {
            this._refresh( );
          }
          this._refreshAllShapes( );
        }
      }
    },

    empty: function ( refresh ) {
      for ( var i = 0; i < this._graphicShapes.length; i++ ) {
        $.removeData( this._graphicShapes[ i ].shape, "geoBbox" );
      }

      this._graphicShapes = [];

      if ( refresh === undefined || refresh ) {
        if ( this._$elem.is( ".geo-service" ) ) {
          this._refresh( false, this._$elem );
        } else {
          this._refresh( );
        }
        this._refreshAllShapes( );
      }
    },

    find: function ( selector, pixelTolerance ) {
      var isPoint = $.isPlainObject( selector ),
          searchPixel = isPoint ? this._map.toPixel( selector.coordinates ) : undefined,
          mapTol = this._map._pixelSize * pixelTolerance,
          result = [],
          graphicShape,
          geometries,
          curGeom,
          i = 0;

      for ( ; i < this._graphicShapes.length; i++ ) {
        graphicShape = this._graphicShapes[ i ];

        if ( isPoint ) {
          if ( graphicShape.shape.type == "Point" ) {
            if ( $.geo.distance( graphicShape.shape, selector ) <= mapTol ) {
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
                  coordinates: $.geo.proj && $.geo._isGeodetic( selector.coordinates ) ? $.geo.proj.fromGeodetic( selector.coordinates ) : selector.coordinates
                };

            if ( $.geo.distance( bboxPolygon, projectedPoint, true ) <= mapTol ) {
              geometries = $.geo._flatten( graphicShape.shape );
              for ( curGeom = 0; curGeom < geometries.length; curGeom++ ) {
                if ( $.geo.distance( geometries[ curGeom ], selector ) <= mapTol ) {
                  result.push( graphicShape.shape );
                  break;
                }
              }
            }
          }
        } else {
          result.push( graphicShape.shape );
        }
      }

      if ( this._$elem.is( ".geo-map" ) ) {
        this._$elem.find( ".geo-service" ).each( function( ) {
          result = $.merge( result, $( this ).geomap( "find", selector, pixelTolerance ) );
        } );
      }

      return result;
    },

    remove: function ( shape, refresh ) {
      if ( shape && ( $.isPlainObject( shape ) || ( $.isArray( shape ) && shape.length > 0 ) ) ) {
        var shapes = $.isArray( shape ) ? shape : [ shape ],
            rest;

        for ( var i = 0; i < this._graphicShapes.length; i++ ) {
          if ( $.inArray( this._graphicShapes[ i ].shape, shapes ) >= 0 ) {
            $.removeData( shape, "geoBbox" );
            rest = this._graphicShapes.slice( i + 1 );
            this._graphicShapes.length = i;
            this._graphicShapes.push.apply( this._graphicShapes, rest );
            i--;
          }
        }

        if ( refresh === undefined || refresh ) {
          if ( this._$elem.is( ".geo-service" ) ) {
            this._refresh( false, this._$elem );
          } else {
            this._refresh( );
          }
          this._refreshAllShapes( );
        }
      }
    },

    _getBbox: function (center, pixelSize) {
      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      // calculate the internal bbox
      var halfWidth = this._contentBounds[ "width" ] / 2 * pixelSize,
          halfHeight = this._contentBounds[ "height" ] / 2 * pixelSize;
      return [ center[ 0 ] - halfWidth, center[ 1 ] - halfHeight, center[ 0 ] + halfWidth, center[ 1 ] + halfHeight ];
    },

    _setBbox: function (value, trigger, refresh) {
      var center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2],
          pixelSize = Math.max($.geo.width(value, true) / this._contentBounds.width, $.geo.height(value, true) / this._contentBounds.height),
          zoom = this._getZoom( center, pixelSize );

      // clamp to zoom
      if ( this._options[ "tilingScheme" ] ) {
        pixelSize = this._getPixelSize( Math.min( Math.max( zoom, this._options[ "zoomMin" ] ), this._options[ "zoomMax" ] ) );
      } else {
        if ( zoom < this._options[ "zoomMin" ] ) {
          pixelSize = this._getPixelSize( this._options[ "zoomMin" ] );
        } else if ( zoom > this._options[ "zoomMax" ] ) {
          pixelSize = this._getPixelSize( this._options[ "zoomMax" ] );
        }
      }

      this._setInteractiveCenterAndSize( center, pixelSize );
      this._interactiveTransform( );
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

    _getZoom: function ( center, pixelSize ) {
      // calculate the internal zoom level, vs. public zoom property
      // this does not take zoomMin or zoomMax into account
      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var tilingScheme = this._options["tilingScheme"];
      if ( tilingScheme ) {
        if ( tilingScheme.pixelSizes ) {
          var roundedPixelSize = Math.floor(pixelSize * 1000),
              levels = tilingScheme.pixelSizes.length,
              i = levels - 1;

          for ( ; i >= 0; i-- ) {
            if ( Math.floor( tilingScheme.pixelSizes[ i ] * 1000 ) >= roundedPixelSize ) {
              return i;
            }
          }

          return 0;
        } else {
          return Math.round( Math.log( tilingScheme.basePixelSize / pixelSize) / Math.log( 2 ) );
        }
      } else {
        var ratio = this._contentBounds["width"] / this._contentBounds["height"],
            bbox = $.geo.reaspect( this._getBbox( center, pixelSize ), ratio, true ),
            bboxMax = $.geo.reaspect(this._getBboxMax(), ratio, true);

        return Math.round( Math.log($.geo.width(bboxMax, true) / $.geo.width(bbox, true)) / Math.log(this._zoomFactor) );
      }
    },

    _setZoom: function ( value, trigger, refresh ) {
      // set the map widget's zoom, taking zoomMin and zoomMax into account
      this._clearInteractiveTimeout( );

      value = Math.min( Math.max( value, this._options[ "zoomMin" ] ), this._options[ "zoomMax" ] );

      this._setInteractiveCenterAndSize( this._centerInteractive, this._getPixelSize( value ) );
      this._interactiveTransform( );
      this._setInteractiveTimeout( trigger );
    },

    _createChildren: function () {
      this._$existingChildren = this._$elem.children();

      this._forcePosition(this._$existingChildren);

      this._$existingChildren.detach().css( {
        mozUserSelect: "none"
      } );


      var contentSizeCss = "width:" + this._contentBounds["width"] + "px; height:" + this._contentBounds["height"] + "px; margin:0; padding:0;",
          contentPosCss = "position:absolute; left:0; top:0;";

      this._$elem.prepend('<div class="geo-event-target geo-content-frame" style="position:absolute; left:' + this._contentBounds.x + 'px; top:' + this._contentBounds.y + 'px;' + contentSizeCss + 'overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;" unselectable="on"></div>');
      this._$eventTarget = this._$contentFrame = this._$elem.children(':first');

      this._$contentFrame.append('<div class="geo-services-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$servicesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-shapes-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$shapesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append( '<ul style="position: absolute; bottom: 8px; left: 8px; list-style-type: none; max-width: 50%; padding: 0; margin: 0;"></ul>' );
      this._$attrList = this._$contentFrame.children( ":last" );

      this._$contentFrame.append('<div class="geo-draw-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$drawContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-measure-container" style="' + contentPosCss + contentSizeCss + '"><span class="geo-measure-label" style="' + contentPosCss + '; display: none;"></span></div>');
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
      var service, i;

      for ( i = 0; i < this._currentServices.length; i++ ) {
        this._currentServices[ i ].serviceContainer.geomap( "destroy" );
        $.geo[ "_serviceTypes" ][ this._currentServices[ i ].type ].destroy( this, this._$servicesContainer, this._currentServices[ i ] );
      }

      this._currentServices = [ ];
      this._$servicesContainer.html( "" );
      this._$attrList.html( "" );

      for ( i = 0; i < this._options[ "services" ].length; i++ ) {
        service = this._currentServices[ i ] = $.extend( { }, this._options[ "services" ][ i ] );

        // keep a reference to the original
        service.serviceObject = this._options[ "services" ][ i ];

        // default the service style property on our copy
        service.style = $.extend( {
                          visibility: "visible",
                          opacity: 1
                        }, service.style );

        var idString = service.id ? ' id="' + service.id + '"' : "",
            classString = 'class="geo-service ' + ( service["class"] ? service["class"] : '' ) + '"',
            scHtml = '<div ' + idString + classString + ' style="-webkit-transform:translateZ(0);position:absolute; left:0; top:0; width:32px; height:32px; margin:0; padding:0; display:' + ( service.style.visibility === "visible" ? "block" : "none" ) + ';"></div>',
            servicesContainer;

        this._$servicesContainer.append( scHtml );
        serviceContainer = this._$servicesContainer.children( ":last" );
        service.serviceContainer = serviceContainer;
        
        $.geo[ "_serviceTypes" ][ service.type ].create( this, serviceContainer, service, i );

        serviceContainer.data( "geoMap", this ).geomap();

        if ( service.attr ) {
          this._$attrList.append( '<li>' + service.attr + '</li>' );
        }
      }

      // start with our map-level shapesContainer
      this._$shapesContainers = this._$shapesContainer;

      this._$attrList.find( "a" ).css( {
        position: "relative",
        zIndex: 100
      } );
    },

    _createServiceGraphics: function( ) { 
      // only called in the context of a service-level geomap
      var $contentFrame = this._$elem.closest( ".geo-content-frame" );
      this._$elem.append('<div class="geo-shapes-container" style="position:absolute; left:0; top:0; width:' + $contentFrame.css( "width" ) + '; height:' + $contentFrame.css( "height" ) + '; margin:0; padding:0;"></div>');
      this._$shapesContainer = this._$elem.children(':last');

      this._map._$shapesContainers = this._map._$shapesContainers.add( this._$shapesContainer );

      this._$shapesContainer.geographics( );
      this._createdGraphics = true;

      this._options["shapeStyle"] = this._$shapesContainer.geographics("option", "style");
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
            label = $.render[ this._tmplLengthId ]( { length: $.geo.length( labelShape, true ) } );
            labelPixel = $.merge( [], pixels[ pixels.length - 1 ] );
            break;

          case "measureArea":
            mode = "drawPolygon";

            labelShape = {
              type: "Polygon",
              coordinates: [ $.merge( [ ], coords ) ]
            };
            labelShape.coordinates[ 0 ].push( coords[ 0 ] );

            label = $.render[ this._tmplAreaId ]( { area: $.geo.area( labelShape, true ) } );
            labelPixel = this._toPixel( $.geo.centroid( labelShape ).coordinates );
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
            left: Math.max( labelPixel[ 0 ], 0 ),
            top: Math.max( labelPixel[ 1 ], 0 )
          } ).show();
        }
      }
    },

    _resetDrawing: function () {
      this._drawPixels = [];
      this._drawCoords = [];
      this._$drawContainer.geographics("clear");
      this._$measureLabel.hide();
    },

    _refreshAllShapes: function ( ) {
      this._timeoutRefreshShapes = null;

      var service,
          geoService,
          i = 0;

      for ( ; i < this._currentServices.length; i++ ) {
        service = this._currentServices[ i ];
        geoService = service.serviceContainer.data( "geoService" );

        if ( geoService._createdGraphics ) {
          geoService._$shapesContainer.geographics( "clear" );
          if ( geoService._graphicShapes.length > 0 ) {
            geoService._refreshShapes( geoService._$shapesContainer, geoService._graphicShapes, geoService._graphicShapes, geoService._graphicShapes );
          }
        }
      }

      if ( this._createdGraphics ) {
        this._$shapesContainer.geographics( "clear" );
        if ( this._graphicShapes.length > 0 ) {
          this._refreshShapes( this._$shapesContainer, this._graphicShapes, this._graphicShapes, this._graphicShapes );
        }
      }
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

      /*
      if ( shapes.length > 0 ) {
        console.log( "_refreshShapes " + $.now() );
      }
      */
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
              labelPixel = this._map.toPixel( $.geo.pointAlong( shape, 0.5 ).coordinates, center, pixelSize );
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
          size = { width: parseInt(sizeContainer.css("width"), 10), height: parseInt(sizeContainer.css("height"), 10) };
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

    _getPixelSize: function ( zoom ) {
      var tilingScheme = this._options["tilingScheme"];
      if (tilingScheme !== null) {
        if (zoom === 0) {
          return tilingScheme.pixelSizes ? tilingScheme.pixelSizes[0] : tilingScheme.basePixelSize;
        }

        zoom = Math.round(zoom);
        zoom = Math.max(zoom, 0);
        var levels = tilingScheme.pixelSizes ? tilingScheme.pixelSizes.length : tilingScheme.levels;
        zoom = Math.min(zoom, levels - 1);

        if ( tilingScheme.pixelSizes ) {
          return tilingScheme.pixelSizes[zoom];
        } else {
          return tilingScheme.basePixelSize / Math.pow(2, zoom);
        }
      } else {
        var bbox = $.geo.scaleBy( this._getBboxMax(), 1 / Math.pow( this._zoomFactor, zoom ), true );
        return Math.max( $.geo.width( bbox, true ) / this._contentBounds.width, $.geo.height( bbox, true ) / this._contentBounds.height );
      }
    },

    _getZoomCenterAndSize: function ( anchor, zoomDelta, full ) {
      var zoomFactor = ( full ? this._fullZoomFactor : this._partialZoomFactor ),
          scale = Math.pow( zoomFactor, -zoomDelta ),
          pixelSize = this._pixelSizeInteractive * scale,
          zoom = this._getZoom(this._centerInteractive, pixelSize);

      // clamp to zoom
      if ( full && this._options[ "tilingScheme" ] ) {
        pixelSize = this._getPixelSize( Math.min( Math.max( zoom, this._options[ "zoomMin" ] ), this._options[ "zoomMax" ] ) );
      } else {
        if ( zoomDelta < 0 && zoom < this._options[ "zoomMin" ] ) {
          pixelSize = this._pixelSizeInteractive;
        } else if ( zoomDelta > 0 && zoom > this._options[ "zoomMax" ] ) {
          pixelSize = this._pixelSizeInteractive;
        }
      }

      var ratio = pixelSize / this._pixelSizeInteractive,
          anchorMapCoord = this._toMap( anchor, this._centerInteractive, this._pixelSizeInteractive ),
          centerDelta = [(this._centerInteractive[0] - anchorMapCoord[0]) * ratio, (this._centerInteractive[1] - anchorMapCoord[1]) * ratio],
          scaleCenter = [anchorMapCoord[0] + centerDelta[0], anchorMapCoord[1] + centerDelta[1]];

      return { pixelSize: pixelSize, center: scaleCenter };
    },

    _mouseWheelFinish: function ( refresh ) {
      this._wheelTimeout = null;

      if (this._wheelLevel !== 0) {
        var wheelCenterAndSize = this._getZoomCenterAndSize( this._anchor, this._wheelLevel, this._options[ "tilingScheme" ] !== null );

        this._wheelLevel = 0;
      } else if ( refresh ) {
        this._refresh();
        this._refreshAllShapes( );
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

        if (dx !== 0 || dy !== 0) {
          this._panning = true;
          this._lastDrag = this._current;

          this._centerInteractive[ 0 ] -= ( dx * this._pixelSizeInteractive );
          this._centerInteractive[ 1 ] += ( ( this._options[ "axisLayout" ] === "image" ? -1 : 1 ) * dy * this._pixelSizeInteractive );
          this._setInteractiveCenterAndSize( this._centerInteractive, this._pixelSizeInteractive );
          this._interactiveTransform( );
        }
      }
    },

    _clearInteractiveTimeout: function() {
      if ( this._timeoutRefreshShapes ) {
        clearTimeout( this._timeoutRefreshShapes );
        this._timeoutRefreshShapes = null;
      }

      if ( this._timeoutInteractive ) {
        clearTimeout( this._timeoutInteractive );
        this._timeoutInteractive = null;
        return true;
      } else {
        this._centerInteractive[ 0 ] = this._center[ 0 ];
        this._centerInteractive[ 1 ] = this._center[ 1 ];
        this._pixelSizeInteractive = this._pixelSize;
        return false;
      }
    },

    _interactiveTransform: function( ) {
      var mapWidth = this._contentBounds[ "width" ],
          mapHeight = this._contentBounds[ "height" ],

          halfWidth = mapWidth / 2,
          halfHeight = mapHeight / 2,

          bbox = [ this._centerInteractive[ 0 ] - halfWidth, this._centerInteractive[ 1 ] - halfHeight, this._centerInteractive[ 0 ] + halfWidth, this._centerInteractive[ 1 ] + halfHeight ];

      var scalePixelSize = this._pixelSize,
          scaleRatio = scalePixelSize / this._pixelSizeInteractive;
          
      if ( scalePixelSize > 0 ) {
        scaleRatio = Math.round(scaleRatio * 1000) / 1000;

        var oldMapOrigin = this._toMap( [ 0, 0 ] ),
            newPixelPoint = this._toPixel( oldMapOrigin, this._centerInteractive, this._pixelSizeInteractive );


        this._$shapesContainers.geographics("interactiveTransform", newPixelPoint, scaleRatio);

        /*
        $scaleContainer.css( {
          left: Math.round( newPixelPoint[ 0 ] ),
          top: Math.round( newPixelPoint[ 1 ] ),
          width: mapWidth * scaleRatio,
          height: mapHeight * scaleRatio
        } );
        */
        
      }




















      for ( var i = 0; i < this._currentServices.length; i++ ) {
        service = this._currentServices[ i ];
        $.geo[ "_serviceTypes" ][ service.type ].interactiveTransform( this, service, this._centerInteractive, this._pixelSizeInteractive );
      }

      if (this._drawCoords.length > 0) {
        this._drawPixels = this._toPixel( this._drawCoords, this._centerInteractive, this._pixelSizeInteractive );
        this._refreshDrawing();
      }
    },

    _interactiveTimeout: function( ) {
      if ( this._isMultiTouch ) {
        this._timeoutInteractive = setTimeout( $.proxy( interactiveTimeout, this ), 128 );
      } else if ( this._created && this._timeoutInteractive ) {
        this._setCenterAndSize( this._centerInteractive, this._pixelSizeInteractive, this._triggerInteractive, true );
        this._timeoutInteractive = null;
        this._triggerInteractive = false;

        this._timeoutRefreshShapes = setTimeout( $.proxy( this._refreshAllShapes, this ), 128 );
      }
    },

    _setInteractiveTimeout: function( trigger ) {
      this._timeoutInteractive = setTimeout( $.proxy( this._interactiveTimeout, this ), 128 );
      this._triggerInteractive |= trigger;
    },

    _refresh: function ( force, _serviceContainer ) {
      var service,
          i = 0;

      for ( ; i < this._currentServices.length; i++ ) {
        service = this._currentServices[ i ];
        if ( !_serviceContainer || service.serviceContainer[ 0 ] == _serviceContainer[ 0 ] ) {
          $.geo[ "_serviceTypes" ][ service.type ].refresh( this, service, force );
        }
      }
    },

    _setInteractiveCenterAndSize: function ( center, pixelSize ) {
      // set the temporary (interactive) center & size
      // also, update the public-facing options
      // this does not take zoomMin or zoomMax into account
      this._centerInteractive[ 0 ] = center[ 0 ];
      this._centerInteractive[ 1 ] = center[ 1 ];
      this._pixelSizeInteractive = pixelSize;

      if ( this._userGeodetic ) {
        this._options["bbox"] = $.geo.proj.toGeodetic( this._getBbox( center, pixelSize ) );
        this._options["center"] = $.geo.proj.toGeodetic( center );
      } else {
        this._options["bbox"] = this._getBbox( center, pixelSize );
        this._options["center"][ 0 ] = center[ 0 ];
        this._options["center"][ 1 ] = center[ 1 ];
      }

      this._options["pixelSize"] = pixelSize;
      this._options["zoom"] = this._getZoom( center, pixelSize );
    },

    _setCenterAndSize: function (center, pixelSize, trigger, refresh) {
      if ( ! $.isArray( center ) || center.length != 2 || typeof center[ 0 ] !== "number" || typeof center[ 1 ] !== "number" ) {
        return;
      }

      // the final call during any extent change
      // only called by timeoutInteractive & resize
      // clamp to zoom
      var zoom = this._getZoom( center, pixelSize );

      if ( this._options[ "tilingScheme" ] ) {
        this._pixelSizeInteractive = pixelSize = this._getPixelSize( Math.min( Math.max( zoom, this._options[ "zoomMin" ] ), this._options[ "zoomMax" ] ) );
      } else {
        if ( zoom < this._options[ "zoomMin" ] ) {
          this._pixelSizeInteractive = pixelSize = this._getPixelSize( this._options[ "zoomMin" ] );
        } else if ( zoom > this._options[ "zoomMax" ] ) {
          this._pixelSizeInteractive = pixelSize = this._getPixelSize( this._options[ "zoomMax" ] );
        }
      }

      this._center[ 0 ] = center[ 0 ];
      this._center[ 1 ] = center[ 1 ];
      this._options["pixelSize"] = this._pixelSize = pixelSize;

      if ( this._userGeodetic ) {
        this._options["bbox"] = $.geo.proj.toGeodetic( this._getBbox() );
        this._options["center"] = $.geo.proj.toGeodetic( this._center );
      } else {
        this._options["bbox"] = this._getBbox();
        this._options["center"] = $.merge( [ ], center );
      }

      this._options["zoom"] = zoom;

      if (trigger) {
        this._trigger("bboxchange", window.event, { bbox: $.merge( [ ], this._options["bbox"] ) });
      }

      if (refresh) {
        this._refresh();
        this._refreshAllShapes( );
        this._refreshDrawing();
      }
    },

    _requestQueued: function ( ) {
      if ( this._loadCount === 0 ) {
        this._trigger( "loadstart", window.event );
      }
      this._loadCount++;
    },

    _requestComplete: function ( ) {
      this._loadCount--;
      if ( this._loadCount <= 0 ) {
        this._loadCount = 0;
        this._trigger( "loadend", window.event );
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
      var doInteractiveTimeout = this._clearInteractiveTimeout( );

      this._trigger("dblclick", e, { type: "Point", coordinates: this._toMap(this._current, this._centerInteractive, this._pixelSizeInteractive ) });

      if (!e.isDefaultPrevented()) {
        var centerAndSize = this._getZoomCenterAndSize(this._current, 1, true );

        this._setInteractiveCenterAndSize( centerAndSize.center, centerAndSize.pixelSize );
        this._interactiveTransform( );

        doInteractiveTimeout = true;
      }

      if ( doInteractiveTimeout ) {
        this._setInteractiveTimeout( true );
      }
    },

    _eventTarget_dblclick: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      if (this._drawTimeout) {
        window.clearTimeout(this._drawTimeout);
        this._drawTimeout = null;
      }

      var offset = $(e.currentTarget).offset();

      switch (this._options["mode"]) {
        case "drawLineString":
        case "measureLength":
          if ( this._drawCoords.length > 1 && ! ( this._drawCoords[0][0] == this._drawCoords[1][0] &&
                                                  this._drawCoords[0][1] == this._drawCoords[1][1] ) ) {
              this._drawCoords.length--;
              this._trigger( "shape", e, {
                type: "LineString",
                coordinates: this._userGeodetic ? $.geo.proj.toGeodetic(this._drawCoords) : this._drawCoords
              } );
          } else {
            this._eventTarget_dblclick_zoom(e);
          }
          this._resetDrawing();
          break;

        case "drawPolygon":
        case "measureArea":
          if ( this._drawCoords.length > 1 && ! ( this._drawCoords[0][0] == this._drawCoords[1][0] &&
                                                  this._drawCoords[0][1] == this._drawCoords[1][1] ) ) {
            var endIndex = this._drawCoords.length - 1;
            if (endIndex > 2) {
              this._drawCoords[endIndex] = $.merge( [], this._drawCoords[0] );
              this._trigger( "shape", e, {
                type: "Polygon",
                coordinates: [ this._userGeodetic ? $.geo.proj.toGeodetic(this._drawCoords) : this._drawCoords ]
              } );
            }
          } else {
            this._eventTarget_dblclick_zoom(e);
          }
          this._resetDrawing();
          break;

        default:
          this._eventTarget_dblclick_zoom(e);
          break;
      }

      this._inOp = false;
    },

    _eventTarget_touchstart: function (e) {
      var mode = this._options[ "mode" ],
          shift = this._options[ "shift" ],
          defaultShift = ( mode === "dragBox" ? "dragBox" : "zoom" );

      if ( mode === "static" ) {
        return;
      }

      if ( !this._supportTouch && e.which != 1 ) {
        return;
      }

      var doInteractiveTimeout = this._clearInteractiveTimeout( );

      var offset = $(e.currentTarget).offset(),
          touches = e.originalEvent.changedTouches;

      if ( this._supportTouch ) {
        this._multiTouchAnchor = $.merge( [ ], touches );

        this._isMultiTouch = this._multiTouchAnchor.length > 1;

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
          this._multiTouchCurrentBbox = [
            touches[0].pageX - offset.left,
            touches[0].pageY - offset.top,
            NaN,
            NaN
          ];

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
            if (distance > 8) {
              this._isTap = false;
            } else {
              this._current = $.merge( [ ], this._anchor );
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
      this._anchor = $.merge( [ ], this._current );

      if (!this._inOp && e.shiftKey && shift !== "off") {
        this._shiftDown = true;
        this._$eventTarget.css( "cursor", this._options[ "cursors" ][ shift === "default" ? defaultShift : shift ] );
      } else if ( !this._isMultiTouch && ( this._options[ "pannable" ] || mode === "dragBox" || mode === "dragCircle" ) ) {
        this._inOp = true;

        if ( mode !== "zoom" && mode !== "dragBox" && mode !== "dragCircle" ) {
          this._lastDrag = this._current;

          if (e.currentTarget.setCapture) {
            e.currentTarget.setCapture();
          }
        }
      }

      e.preventDefault();

      if ( doInteractiveTimeout ) {
        this._setInteractiveTimeout( true );
      }

      return false;
    },

    _dragTarget_touchmove: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      var doInteractiveTimeout = false;
      if ( this._mouseDown ) {
        doInteractiveTimeout = this._clearInteractiveTimeout( );
      }

      var offset = this._$eventTarget.offset(),
          drawCoordsLen = this._drawCoords.length,
          touches = e.originalEvent.changedTouches,
          current,
          service,
          i = 0;

      if ( this._supportTouch ) {
        if ( !this._isMultiTouch && this._mouseDown && this._multiTouchAnchor.length > 0 && touches[ 0 ].identifier !== this._multiTouchAnchor[ 0 ].identifier ) {
          // switch to multitouch
          this._mouseDown = false;
          this._isMultiTouch = true;
          this._wheelLevel = 0;

          this._multiTouchAnchor.push( touches[ 0 ] );




          this._multiTouchCurrentBbox = [
            this._multiTouchCurrentBbox[ 0 ],
            this._multiTouchCurrentBbox[ 1 ],
            this._multiTouchAnchor[1].pageX - offset.left,
            this._multiTouchAnchor[1].pageY - offset.top
          ];

          this._multiTouchAnchorBbox = $.merge( [ ], this._multiTouchCurrentBbox );

          this._mouseDown = true;
          this._anchor = this._current = $.geo.center( this._multiTouchCurrentBbox, true );


          if ( doInteractiveTimeout ) {
            this._setInteractiveTimeout( true );
          }
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

          var anchorDistance = $.geo._distancePointPoint( [ this._multiTouchAnchorBbox[ 0 ], this._multiTouchAnchorBbox[ 1 ] ], [ this._multiTouchAnchorBbox[ 2 ], this._multiTouchAnchorBbox[ 3 ] ] ),
              currentDistance = $.geo._distancePointPoint( [ this._multiTouchCurrentBbox[ 0 ], this._multiTouchCurrentBbox[ 1 ] ], [ this._multiTouchCurrentBbox[ 2 ], this._multiTouchCurrentBbox[ 3 ] ] );

          current = $.geo.center( this._multiTouchCurrentBbox, true );

          var wheelLevel = ( ( currentDistance - anchorDistance ) / anchorDistance );

          if ( wheelLevel > 0 ) {
            wheelLevel *= 5;
          } else {
            wheelLevel *= 10;
          }

          var delta = wheelLevel - this._wheelLevel;

          this._wheelLevel = wheelLevel;

          var pinchCenterAndSize = this._getZoomCenterAndSize( this._anchor, delta, false );

          this._setInteractiveCenterAndSize( pinchCenterAndSize.center, pinchCenterAndSize.pixelSize );
          this._interactiveTransform( );

          doInteractiveTimeout = true;

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
          if ( doInteractiveTimeout ) {
            this._setInteractiveTimeout( true );
          }
          return false;
        }
      }

      if ( _ieVersion == 7 ) {
        this._isDbltap = this._isTap = false;
      }

      if (this._mouseDown) {
        this._current = current;
        this._moveDate = $.now();
      }

      if ( this._isMultiTouch ) {
        e.preventDefault( );
        this._isDbltap = this._isTap = false;
        if ( doInteractiveTimeout ) {
          this._setInteractiveTimeout( true );
        }
        return false;
      }

      var mode = this._options["mode"],
          shift = this._options[ "shift" ],
          defaultShift = ( mode === "dragBox" ? "dragBox" : "zoom" ),
          dx, dy, circleSize;

      if ( this._shiftDown ) {
        mode = ( shift === "default" ? defaultShift : shift );
      }

      switch (mode) {
        case "zoom":
        case "dragBox":
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

        case "dragCircle":
          if ( this._mouseDown ) {
            dx = current[ 0 ] - this._anchor[ 0 ];
            dy = current[ 1 ] - this._anchor[ 1 ];
            circleSize = Math.sqrt( ( dx * dx) + ( dy * dy ) ) * 2;
            //circleSize = Math.max( Math.abs( current[ 0 ] - this._anchor[ 0 ] ), Math.abs( current[ 1 ] - this._anchor[ 1 ] ) ) * 2;

            // not part of _refreshDrawing
            this._$drawContainer.geographics( "clear" );
            this._$drawContainer.geographics( "drawArc", this._anchor, 0, 360, {
              width: circleSize,
              height: circleSize
            } );
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
            doInteractiveTimeout = true;
          } else {
            if (drawCoordsLen > 0) {
              this._drawCoords[drawCoordsLen - 1] = this._toMap( current, this._centerInteractive, this._pixelSizeInteractive );
              this._drawPixels[drawCoordsLen - 1] = current;

              this._refreshDrawing();
            }

            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;

        default:
          if (this._mouseDown || this._toolPan) {
            this._panMove();
            doInteractiveTimeout = true;
          } else {
            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;
      }

      this._lastMove = current;

      if ( doInteractiveTimeout ) {
        this._setInteractiveTimeout( true );
      }

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _dragTarget_touchstop: function (e) {
      if ( this._options[ "mode" ] === "static" ) {
        return;
      }

      if ( !this._mouseDown ) {
        if ( _ieVersion == 7 ) {
          // ie7 doesn't appear to trigger dblclick on this._$eventTarget,
          // we fake regular click here to cause soft dblclick
          this._eventTarget_touchstart(e);
        } else {
          // Chrome & Firefox trigger a rogue mouseup event when doing a dblclick maximize in Windows(/Linux?)
          // ignore it
          return;
        }
      }

      var doInteractiveTimeout = this._clearInteractiveTimeout( );

      var mouseWasDown = this._mouseDown,
          wasToolPan = this._toolPan,
          offset = this._$eventTarget.offset(),
          mode = this._options[ "mode" ],
          shift = this._options[ "shift" ],
          defaultShift = ( mode === "dragBox" ? "dragBox" : "zoom" ),
          current, i, clickDate,
          dx, dy,
          coordBuffer,
          triggerShape;

      if ( this._shiftDown ) {
        mode = ( shift === "default" ? defaultShift : shift );
      }

      if (this._supportTouch) {
        current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        this._multiTouchAnchor = [];
        this._inOp = false;
      } else {
        current = [e.pageX - offset.left, e.pageY - offset.top];
      }

      if (this._softDblClick) {
        if (this._isTap) {
          dx = current[0] - this._anchor[0];
          dy = current[1] - this._anchor[1];
          if (Math.sqrt((dx * dx) + (dy * dy)) <= 8) {
            current = $.merge( [ ], this._anchor );
          }
        }
      }

      dx = current[0] - this._anchor[0];
      dy = current[1] - this._anchor[1];

      this._$eventTarget.css("cursor", this._options["cursors"][this._options["mode"]]);

      this._shiftDown = this._mouseDown = this._toolPan = false;

      if ( this._isMultiTouch ) {
        e.preventDefault( );
        this._isMultiTouch = false;

        this._wheelLevel = 0;

        if ( doInteractiveTimeout ) {
          this._setInteractiveTimeout( true );
        }
        return;
      }

      if (document.releaseCapture) {
        document.releaseCapture();
      }

      if (mouseWasDown) {
        clickDate = $.now();
        this._current = current;

        switch ( mode ) {
          case "zoom":
          case "dragBox":
            if ( dx !== 0 || dy !== 0 ) {
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

              if ( mode === "zoom" ) {
                if ( ( bbox[2] - bbox[0] ) < minSize && ( bbox[3] - bbox[1] ) < minSize ) {
                  bbox = $.geo.scaleBy( this._getBbox( $.geo.center( bbox, true ) ), 0.5, true );
                }

                this._setBbox(bbox, true, true);
                doInteractiveTimeout = true;
              } else {
                triggerShape = $.geo.polygonize( bbox, true );
                triggerShape.bbox = bbox;

                if ( this._userGeodetic ) {
                  triggerShape.coordinates = $.geo.proj.toGeodetic( triggerShape.coordinates );
                  triggerShape.bbox = $.geo.proj.toGeodetic( triggerShape.bbox );
                }
                this._trigger( "shape", e, triggerShape );
              }
            } else {
              if ( mode === "dragBox" ) {
                coordBuffer = this._toMap( current );

                triggerShape = {
                  type: "Point",
                  coordinates: [ coordBuffer[ 0 ], coordBuffer[ 1 ] ],
                  bbox: [ coordBuffer[ 0 ], coordBuffer[ 1 ], coordBuffer[ 0 ], coordBuffer[ 1 ] ]
                };

                if ( this._userGeodetic ) {
                  triggerShape.coordinates = $.geo.proj.toGeodetic( triggerShape.coordinates );
                  triggerShape.bbox = $.geo.proj.toGeodetic( triggerShape.bbox );
                }

                this._trigger( "shape", e, triggerShape );
              }
            }

            this._resetDrawing();
            break;

          case "dragCircle":
            if ( dx !== 0 || dy !== 0 ) {
              var image = this._options[ "axisLayout" ] === "image",
                  d = Math.sqrt( ( dx * dx) + ( dy * dy ) ),
                  n = 180,
                  a;

              this._drawPixels.length = n + 1;

              for ( i = 0; i < n; i++ ) {
                a = ( i * 360 / n ) * ( Math.PI / 180 );
                this._drawPixels[ i ] = [
                  this._anchor[ 0 ] + Math.cos( a ) * d,
                  this._anchor[ 1 ] + Math.sin( a ) * d
                ];
              }

              this._drawPixels[ n ] = [
                this._drawPixels[ 0 ][ 0 ],
                this._drawPixels[ 0 ][ 1 ]
              ];

              // using coordBuffer for bbox coords
              coordBuffer = this._toMap( [
                [ this._anchor[ 0 ] - d, this._anchor[ 1 ] + ( image ? -d : d ) ],
                [ this._anchor[ 0 ] + d, this._anchor[ 1 ] + ( image ? d : -d ) ]
              ] );

              triggerShape = {
                type: "Polygon",
                coordinates: [ this._toMap( this._drawPixels ) ],
                bbox: [ coordBuffer[ 0 ][ 0 ], coordBuffer[ 0 ][ 1 ], coordBuffer[ 1 ][ 0 ], coordBuffer[ 1 ][ 1 ] ]
              };

              if ( this._userGeodetic ) {
                triggerShape.coordinates = $.geo.proj.toGeodetic( triggerShape.coordinates );
                triggerShape.bbox = $.geo.proj.toGeodetic( triggerShape.bbox );
              }

              this._trigger( "shape", e, triggerShape );

              this._resetDrawing();
            } else {
              coordBuffer = this._toMap( current );

              triggerShape = {
                type: "Point",
                coordinates: [ coordBuffer[ 0 ], coordBuffer[ 1 ] ],
                bbox: [ coordBuffer[ 0 ], coordBuffer[ 1 ], coordBuffer[ 0 ], coordBuffer[ 1 ] ]
              };

              if ( this._userGeodetic ) {
                triggerShape.coordinates = $.geo.proj.toGeodetic( triggerShape.coordinates );
                triggerShape.bbox = $.geo.proj.toGeodetic( triggerShape.bbox );
              }

              this._trigger( "shape", e, triggerShape );
            }
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
              i = (this._drawCoords.length === 0 ? 0 : this._drawCoords.length - 1);

              this._drawCoords[i] = this._toMap(current);
              this._drawPixels[i] = current;

              if (i < 2 || !(this._drawCoords[i][0] == this._drawCoords[i-1][0] &&
                             this._drawCoords[i][1] == this._drawCoords[i-1][1])) {
                this._drawCoords[i + 1] = this._toMap( current, this._centerInteractive, this._pixelSizeInteractive );
                this._drawPixels[i + 1] = current;
              }

              this._refreshDrawing();
            }
            break;

          default:
            if (wasToolPan) {
              this._panFinalize();
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
          if ( doInteractiveTimeout ) {
            this._setInteractiveTimeout( true );
          }
          this._$eventTarget.trigger("dblclick", e);
          return false;
        }
      }

      if ( doInteractiveTimeout ) {
        this._setInteractiveTimeout( true );
      }

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _eventTarget_mousewheel: function (e, delta) {
      if ( this._options[ "mode" ] === "static" || this._options[ "scroll" ] === "off" ) {
        return;
      }

      e.preventDefault();

      if ( this._mouseDown ) {
        return false;
      }

      if (delta !== 0) {
        this._clearInteractiveTimeout( );

        if ( delta > 0 ) {
          delta = Math.ceil( delta );
        } else { 
          delta = Math.floor( delta );
        }

        var offset = $(e.currentTarget).offset();
        this._anchor = [e.pageX - offset.left, e.pageY - offset.top];

        var wheelCenterAndSize = this._getZoomCenterAndSize( this._anchor, delta, this._options[ "tilingScheme" ] !== null ),
            service,
            i = 0;

        this._setInteractiveCenterAndSize( wheelCenterAndSize.center, wheelCenterAndSize.pixelSize );
        this._interactiveTransform( );

        this._setInteractiveTimeout( true );
      }

      return false;
    }
  }
  );
}(jQuery));

