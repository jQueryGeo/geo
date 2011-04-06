/* 
 * AppGeo/geo 
 * (c) 2007-2011, Applied Geographics, Inc. All rights reserved. 
 * Dual licensed under the MIT or GPL Version 2 licenses. 
 * http://jquery.org/license 
 */ 
 

/* Copyright (c) 2009 Brandon Aaron (http://brandonaaron.net)
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 *
 * Version: 3.0.2
 * 
 * Requires: 1.2.2+
 */
(function(c){var a=["DOMMouseScroll","mousewheel"];c.event.special.mousewheel={setup:function(){if(this.addEventListener){for(var d=a.length;d;){this.addEventListener(a[--d],b,false)}}else{this.onmousewheel=b}},teardown:function(){if(this.removeEventListener){for(var d=a.length;d;){this.removeEventListener(a[--d],b,false)}}else{this.onmousewheel=null}}};c.fn.extend({mousewheel:function(d){return d?this.bind("mousewheel",d):this.trigger("mousewheel")},unmousewheel:function(d){return this.unbind("mousewheel",d)}});function b(f){var d=[].slice.call(arguments,1),g=0,e=true;f=c.event.fix(f||window.event);f.type="mousewheel";if(f.wheelDelta){g=f.wheelDelta/120}if(f.detail){g=-f.detail/3}d.unshift(f,g);return c.event.handle.apply(this,d)}})(jQuery);

/*!
 * jQuery UI Widget @VERSION
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Widget
 */
(function( $, undefined ) {

var slice = Array.prototype.slice;

var _cleanData = $.cleanData;
$.cleanData = function( elems ) {
	for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
		$( elem ).triggerHandler( "remove" );
	}
	_cleanData( elems );
};

$.widget = function( name, base, prototype ) {
	var namespace = name.split( "." )[ 0 ],
		fullName;
	name = name.split( "." )[ 1 ];
	fullName = namespace + "-" + name;

	if ( !prototype ) {
		prototype = base;
		base = $.Widget;
	}

	// create selector for plugin
	$.expr[ ":" ][ fullName ] = function( elem ) {
		return !!$.data( elem, name );
	};

	$[ namespace ] = $[ namespace ] || {};
	// create the constructor using $.extend() so we can carry over any
	// static properties stored on the existing constructor (if there is one)
	$[ namespace ][ name ] = $.extend( function( options, element ) {
		// allow instantiation without "new" keyword
		if ( !this._createWidget ) {
			return new $[ namespace ][ name ]( options, element );
		}

		// allow instantiation without initializing for simple inheritance
		// must use "new" keyword (the code above always passes args)
		if ( arguments.length ) {
			this._createWidget( options, element );
		}
	}, $[ namespace ][ name ] );

	var basePrototype = new base();
	// we need to make the options hash a property directly on the new instance
	// otherwise we'll modify the options hash on the prototype that we're
	// inheriting from
	basePrototype.options = $.extend( true, {}, basePrototype.options );
	$.each( prototype, function( prop, value ) {
		if ( $.isFunction( value ) ) {
			prototype[ prop ] = (function() {
				var _super = function( method ) {
					return base.prototype[ method ].apply( this, slice.call( arguments, 1 ) );
				};
				var _superApply = function( method, args ) {
					return base.prototype[ method ].apply( this, args );
				};
				return function() {
					var __super = this._super,
						__superApply = this._superApply,
						returnValue;

					this._super = _super;
					this._superApply = _superApply;

					returnValue = value.apply( this, arguments );

					this._super = __super;
					this._superApply = __superApply;

					return returnValue;
				};
			}());
		}
	});
	$[ namespace ][ name ].prototype = $.extend( true, basePrototype, {
		namespace: namespace,
		widgetName: name,
		widgetEventPrefix: name,
		widgetBaseClass: fullName
	}, prototype );

	$.widget.bridge( name, $[ namespace ][ name ] );
};

$.widget.bridge = function( name, object ) {
	$.fn[ name ] = function( options ) {
		var isMethodCall = typeof options === "string",
			args = slice.call( arguments, 1 ),
			returnValue = this;

		// allow multiple hashes to be passed on init
		options = !isMethodCall && args.length ?
			$.extend.apply( null, [ true, options ].concat(args) ) :
			options;

		if ( isMethodCall ) {
			this.each(function() {
				var instance = $.data( this, name );
				if ( !instance ) {
					return $.error( "cannot call methods on " + name + " prior to initialization; " +
						"attempted to call method '" + options + "'" );
				}
				if ( !$.isFunction( instance[options] ) || options.charAt( 0 ) === "_" ) {
					return $.error( "no such method '" + options + "' for " + name + " widget instance" );
				}
				var methodValue = instance[ options ].apply( instance, args );
				if ( methodValue !== instance && methodValue !== undefined ) {
					returnValue = methodValue;
					return false;
				}
			});
		} else {
			this.each(function() {
				var instance = $.data( this, name );
				if ( instance ) {
					instance.option( options || {} )._init();
				} else {
					object( options, this );
				}
			});
		}

		return returnValue;
	};
};

$.Widget = function( options, element ) {
	// allow instantiation without "new" keyword
	if ( !this._createWidget ) {
		return new $[ namespace ][ name ]( options, element );
	}

	// allow instantiation without initializing for simple inheritance
	// must use "new" keyword (the code above always passes args)
	if ( arguments.length ) {
		this._createWidget( options, element );
	}
};

$.Widget.prototype = {
	widgetName: "widget",
	widgetEventPrefix: "",
	defaultElement: "<div>",
	options: {
		disabled: false
	},
	_createWidget: function( options, element ) {
		element = $( element || this.defaultElement || this )[ 0 ];
		this.element = $( element );
		this.options = $.extend( true, {},
			this.options,
			this._getCreateOptions(),
			options );

		this.bindings = $();
		this.hoverable = $();
		this.focusable = $();

		if ( element !== this ) {
			$.data( element, this.widgetName, this );
			this._bind({ remove: "destroy" });
		}

		this._create();
		this._trigger( "create" );
		this._init();
	},
	_getCreateOptions: function() {
		return $.metadata && $.metadata.get( this.element[0] )[ this.widgetName ];
	},
	_create: $.noop,
	_init: $.noop,

	destroy: function() {
		this._destroy();
		// we can probably remove the unbind calls in 2.0
		// all event bindings should go through this._bind()
		this.element
			.unbind( "." + this.widgetName )
			.removeData( this.widgetName );
		this.widget()
			.unbind( "." + this.widgetName )
			.removeAttr( "aria-disabled" )
			.removeClass(
				this.widgetBaseClass + "-disabled " +
				"ui-state-disabled" );

		// clean up events and states
		this.bindings.unbind( "." + this.widgetName );
		this.hoverable.removeClass( "ui-state-hover" );
		this.focusable.removeClass( "ui-state-focus" );
	},
	_destroy: $.noop,

	widget: function() {
		return this.element;
	},

	option: function( key, value ) {
		var options = key;

		if ( arguments.length === 0 ) {
			// don't return a reference to the internal hash
			return $.extend( {}, this.options );
		}

		if  (typeof key === "string" ) {
			if ( value === undefined ) {
				return this.options[ key ];
			}
			options = {};
			options[ key ] = value;
		}

		this._setOptions( options );

		return this;
	},
	_setOptions: function( options ) {
		var self = this;
		$.each( options, function( key, value ) {
			self._setOption( key, value );
		});

		return this;
	},
	_setOption: function( key, value ) {
		this.options[ key ] = value;

		if ( key === "disabled" ) {
			this.widget()
				.toggleClass( this.widgetBaseClass + "-disabled ui-state-disabled", !!value )
				.attr( "aria-disabled", value );
			this.hoverable.removeClass( "ui-state-hover" );
			this.focusable.removeClass( "ui-state-focus" );
		}

		return this;
	},

	enable: function() {
		return this._setOption( "disabled", false );
	},
	disable: function() {
		return this._setOption( "disabled", true );
	},

	_bind: function( element, handlers ) {
		// no element argument, shuffle and use this.element
		if ( !handlers ) {
			handlers = element;
			element = this.element;
		} else {
			// accept selectors, DOM elements
			element = $( element );
			this.bindings = this.bindings.add( element );
		}
		var instance = this;
		$.each( handlers, function( event, handler ) {
			element.bind( event + "." + instance.widgetName, function() {
				// allow widgets to customize the disabled handling
				// - disabled as an array instead of boolean
				// - disabled class as method for disabling individual parts
				if ( instance.options.disabled === true ||
						$( this ).hasClass( "ui-state-disabled" ) ) {
					return;
				}
				return ( typeof handler === "string" ? instance[ handler ] : handler )
					.apply( instance, arguments );
			});
		});
	},

	_hoverable: function( element ) {
		this.hoverable = this.hoverable.add( element );
		this._bind( element, {
			mouseenter: function( event ) {
				$( event.currentTarget ).addClass( "ui-state-hover" );
			},
			mouseleave: function( event ) {
				$( event.currentTarget ).removeClass( "ui-state-hover" );
			}
		});
	},

	_focusable: function( element ) {
		this.focusable = this.focusable.add( element );
		this._bind( element, {
			focusin: function( event ) {
				$( event.currentTarget ).addClass( "ui-state-focus" );
			},
			focusout: function( event ) {
				$( event.currentTarget ).removeClass( "ui-state-focus" );
			}
		});
	},

	_trigger: function( type, event, data ) {
		var callback = this.options[ type ],
			args;

		event = $.Event( event );
		event.type = ( type === this.widgetEventPrefix ?
			type :
			this.widgetEventPrefix + type ).toLowerCase();
		data = data || {};

		// copy original event properties over to the new event
		// this would happen if we could call $.event.fix instead of $.Event
		// but we don't have a way to force an event to be fixed multiple times
		if ( event.originalEvent ) {
			for ( var i = $.event.props.length, prop; i; ) {
				prop = $.event.props[ --i ];
				event[ prop ] = event.originalEvent[ prop ];
			}
		}

		this.element.trigger( event, data );

		args = $.isArray( data ) ?
			[ event ].concat( data ) :
			[ event, data ];

		return !( $.isFunction( callback ) &&
			callback.apply( this.element[0], args ) === false ||
			event.isDefaultPrevented() );
	}
};

})( jQuery );
﻿(function ($, window, undefined) {
  $.geo = {
    //
    // geometry functions
    //

    // bbox

    _center: function (bbox) {
      // bbox only, use centroid for geom
      return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    },

    _expandBy: function (bbox, dx, dy) {
      var c = this._center(bbox);
      return [c[0] - dx, c[1] - dy, c[0] + dx, c[1] + dy];
    },

    _height: function (bbox) {
      return bbox[3] - bbox[1];
    },

    _reaspect: function (bbox, ratio) {
      // not in JTS
      var width = this._width(bbox),
        height = this._height(bbox),
        center = this._center(bbox),
        dx, dy;

      if (width == 0 || height == 0 || ratio <= 0) {
        return bbox;
      }

      if (width / height > ratio) {
        dx = width / 2;
        dy = dx / ratio;
      } else {
        dy = height / 2;
        dx = dy * ratio;
      }

      return [c[0] - dx, c[1] - dy, c[0] + dx, c[1] + dy];
    },

    _scaleBy: function (bbox, scale) {
      // not in JTS
      return this._expandBy(bbox, this._width(bbox) * scale / 2, this._height(bbox) * scale / 2);
    },

    _width: function (bbox) {
      return bbox[2] - bbox[0];
    },

    //
    // projection
    //

    proj: (function () {
      // RW: This is a direct copy from our internal library and will be cleaned up later

      var tPi = 6.2831853071795864769;
      var hPi = 1.5707963267948966192;
      var qPi = 0.7853981633974483096;
      var radDeg = 0.0174532925199432958;
      var degRad = 57.295779513082320877;
      var fpm = 3.2808333333333333333;

      function normalizeLon(lon) {
        return lon > Math.PI ? lon -= tPi : lon < -Math.PI ? lon += tPi : lon;
      }

      this.CoordinateSystem = function (prj, fe, fn, upm) {
        if (arguments.length < 2) {
          fe = 0;
        }
        if (arguments.length < 3) {
          fn = 0;
        }
        if (arguments.length < 4) {
          upm = 1;
        }

        switch (upm) {
          case "meters": upm = 1; break;
          case "feet": upm = fpm; break;
        }

        this.toGeodetic = function (p) {
          return prj.toGeodetic({ x: (p.x - fe) / upm, y: (p.y - fn) / upm });
        };

        this.toProjected = function (p) {
          p = prj.toProjected(p);
          return { x: p.x * upm + fe, y: p.y * upm + fn };
        };
      };

      this.Mercator = function (cm, lts, sph) {
        cm *= radDeg;
        lts *= radDeg;

        var es = sph.e * sph.e;
        var sinLat = Math.sin(lts);
        var sf = 1.0 / (Math.sqrt(1.0 - es * sinLat * sinLat) / Math.cos(lts));

        var es2 = es * es;
        var es3 = es2 * es;
        var es4 = es3 * es;

        var ab = es / 2.0 + 5.0 * es2 / 24.0 + es3 / 12.0 + 13.0 * es4 / 360.0;
        var bb = 7.0 * es2 / 48.0 + 29.0 * es3 / 240.0 + 811.0 * es4 / 11520.0;
        var cb = 7.0 * es3 / 120.0 + 81.0 * es4 / 1120.0;
        var db = 4279.0 * es4 / 161280.0;

        this.toGeodetic = function (p) {
          var lon = normalizeLon(cm + p.x / (sf * sph.smaj));

          var xphi = hPi - 2.0 * Math.atan(1.0 / Math.exp(p.y / (sf * sph.smaj)));
          var lat = xphi + ab * Math.sin(2.0 * xphi) + bb * Math.sin(4.0 * xphi) + cb * Math.sin(6.0 * xphi) + db * Math.sin(8.0 * xphi);

          return { x: lon * degRad, y: lat * degRad };
        };

        this.toProjected = function (p) {
          var lat = p.y * radDeg;
          var eSinLat = sph.e * Math.sin(lat);
          var ctanz2 = Math.tan(Math.PI / 4.0 + lat / 2.0) * Math.pow(((1.0 - eSinLat) / (1.0 + eSinLat)), sph.e / 2.0);

          var lon = normalizeLon(p.x * radDeg - cm);

          return { x: sf * sph.smaj * lon, y: sf * sph.smaj * Math.log(ctanz2) };
        };
      };

      this.Spheroid = function () {
        switch (typeof (arguments[0])) {
          case "number": this.smaj = arguments[0]; this.e = arguments[1]; break;

          case "string":
            switch (arguments[0]) {
              case "WGS84Sphere": this.smaj = 6378137; this.e = 0.0; break;
            }
            break;
        }

        this.smin = this.smaj * Math.sqrt(1 - this.e * this.e);
        var fl = (this.smaj - this.smin) / this.smaj;

        this.distance = function (p0, p1, upm) {
          if (arguments.length < 3) {
            upm = 1;
          }

          switch (upm) {
            case "meters": upm = 1; break;
            case "feet": upm = fpm; break;
          }

          var lon1 = p0.x * radDeg;
          var lat1 = p0.y * radDeg;
          var lon2 = p1.x * radDeg;
          var lat2 = p1.y * radDeg;

          var f = (lat1 + lat2) * 0.5;
          var g = (lat1 - lat2) * 0.5;
          var l = (lon1 - lon2) * 0.5;

          var sf2 = Math.sin(f);
          sf2 *= sf2;
          var cf2 = Math.cos(f);
          cf2 *= cf2;
          var sg2 = Math.sin(g);
          sg2 *= sg2;
          var cg2 = Math.cos(g);
          cg2 *= cg2;
          var sl2 = Math.sin(l);
          sl2 *= sl2;
          var cl2 = Math.cos(l);
          cl2 *= cl2;

          var s = (sg2 * cl2) + (cf2 * sl2);
          var c = (cg2 * cl2) + (sf2 * sl2);

          var omega = Math.atan(Math.sqrt(s / c));
          var rho = Math.sqrt(s * c) / omega;

          var d = 2 * this.smaj * omega;
          var h1 = ((3 * rho) - 1) / (2 * c);
          var h2 = ((3 * rho) + 1) / (2 * s);

          return d * (1 + (fl * ((h1 * sf2 * cg2) - (h2 * cf2 * sg2)))) * upm;
        };
      };





      var webMercator = new Mercator(0, 0, new Spheroid("WGS84Sphere"));









      return {
        fromGeodetic: function (positions) {
          var result = [], i = 0, cur;
          for (; i < positions.length; i++) {
            cur = webMercator.toProjected({ x: positions[i][0], y: positions[i][1] });
            result[i] = [cur.x, cur.y];
          }
          return result;
        },

        toGeodetic: function (positions) {
          var result = [], i = 0, cur;
          for (; i < positions.length; i++) {
            cur = webMercator.toGeodetic({ x: positions[i][0], y: positions[i][1] });
            result[i] = [cur.x, cur.y];
          }
          return result;
        }
      }
    })()
  }
})(jQuery, this);
﻿(function ($, undefined) {

  var 
  // public property name strings
    _bbox = 'bbox',
    _bboxMax = 'bboxMax',
    _center = 'center',
    _cursors = 'cursors',
    _mode = 'mode',
    _pixelSize = 'pixelSize',
    _services = 'services',
    _tilingScheme = 'tilingScheme',
    _zoom = 'zoom',

  // private property name strings
    __serviceTypes = '_serviceTypes',

  // misc other strings (strings must be used more than once
  // before adding them to this list)
    _position = 'position',
    _relative = 'relative',
    _width = 'width',
    _height = 'height',

  // private widget members
    _elem,

    _contentBounds = {},

    _contentFrame,
    _servicesContainer,
    _graphicsContainer,
    _textContainer,
    _textContent,
    _eventTarget,

    _dpi = 96,

    _center,
    _pixelSize,
    _centerMax,
    _pixelSizeMax,

    _wheelZoomFactor = 1.18920711500273,
    _wheelTimer = null,
    _wheelLevel = 0,

    _zoomFactor = 2,

    __mouseDown = '_mouseDown',
    __inOp = '_inOp',
    __toolPan = '_toolPan',
    __shiftZoom = '_shiftZoom',
    __anchor = '_anchor',
    __current = '_current',
    __downDate = '_downDate',
    __moveDate = '_moveDate',
    __clickDate = '_clickDate',
    __lastMove = '_lastMove',
    __lastDrag = '_lastDrag',

    __panning = '_panning',
    __velocity = '_velocity',
    __friction = '_friction',

    _ieVersion = (function () {
      var v = 5, div = document.createElement('div'), a = div.all || [];
      while (div.innerHTML = '<!--[if gt IE ' + (++v) + ']><br><![endif]-->', a[0]) { }
      return v > 6 ? v : !v;
    } ()),

    __supportTouch = '_supportTouch',
    _softDblClick = this._supportTouch || this._ieVersion == 7,
    __isTap = '_isTap',
    __isDbltap = '_isDbltap',

    _initOptions = {},

    _options = {},

  _defaultOptions = {
    bbox: [-180, -90, 180, 90],
    bboxMax: [-180, -90, 180, 90],
    center: [0, 0],
    cursors: {
      pan: 'move'
    },
    mode: 'pan',
    pixelSize: 156543.03392799936,
    services: [
        {
          id: 'OSM',
          type: 'tiled',
          getUrl: function (view) {
            return 'http://tile.openstreetmap.org/' + view.zoom + '/' + view.tile.column + '/' + view.tile.row + '.png';
          },
          attr: '&copy; OpenStreetMap &amp; contributors, CC-BY-SA',
          visible: true
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
      tiled: {
        create: function (map, service, index) {
          if (this[service.id] == null) {
            this[service.id] = {
              loadCount: 0,
              reloadTiles: false,
              serviceContainer: null
            };

            var scHtml = '<div data-service="' + service.id + '" style="position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0; display:' + (service.visible ? 'block' : 'none') + ';"></div>';
            if (index != null) {
              $(_servicesContainer.children()[index]).before(scHtml);
            } else {
              _servicesContainer.append(scHtml);
            }

            this[service.id].serviceContainer = _servicesContainer.children('[data-service="' + service.id + '"]');
          }
        },

        destroy: function (map, service) {
          this[service.id].serviceContainer.remove();
          delete this[service.id];
        },

        interactivePan: function (map, service, dx, dy) {
          this._cancelUnloaded(map, service);
          this[service.id].serviceContainer.children().css({
            left: function (index, value) {
              return parseInt(value) + dx;
            },
            top: function (index, value) {
              return parseInt(value) + dy;
            }
          });
        },

        interactiveScale: function (map, service, center, pixelSize) {
        },

        refresh: function (map, service) {
          if (service != null && this[service.id] != null && service.visible) {
            this._cancelUnloaded(map, service);

            var serviceState = this[service.id],

              serviceContainer = serviceState.serviceContainer,

              pixelSize = _pixelSize,
              mapWidth = _contentBounds[_width],
              mapHeight = _contentBounds[_height],
              bbox = map._getBbox(),

              tilingScheme = map.options[_tilingScheme],
              tileWidth = tilingScheme.tileWidth,
              tileHeight = tilingScheme.tileHeight,

              tileX = Math.floor((bbox[0] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY = Math.floor((tilingScheme.origin[1] - bbox[3]) / (pixelSize * tileHeight)),
              tileX2 = Math.ceil((bbox[2] - tilingScheme.origin[0]) / (pixelSize * tileWidth)),
              tileY2 = Math.ceil((tilingScheme.origin[1] - bbox[1]) / (pixelSize * tileHeight)),

              bboxMax = map._getBboxMax(),
              pixelSizeAtZero = map._tiledPixelSize(0),
              ratio = pixelSizeAtZero / pixelSize,
              fullXAtScale = Math.floor((bboxMax[0] - tilingScheme.origin[0]) / (pixelSizeAtZero * tileWidth)) * ratio,
              fullYAtScale = Math.floor((tilingScheme.origin[1] - bboxMax[3]) / (pixelSizeAtZero * tileHeight)) * ratio,

              fullXMinX = tilingScheme.origin[0] + (fullXAtScale * tileWidth) * pixelSize,
              fullYMaxY = tilingScheme.origin[1] - (fullYAtScale * tileHeight) * pixelSize,

              serviceLeft = Math.round((fullXMinX - bbox[0]) / pixelSize),
              serviceTop = Math.round((bbox[3] - fullYMaxY) / pixelSize),

              scaleContainers = serviceContainer.children().show(),
              scaleContainer = scaleContainers.filter('[data-pixelSize="' + pixelSize + '"]').appendTo(serviceContainer),

              opacity = (service.opacity == null ? 1 : service.opacity);

            if (serviceState.reloadTiles) {
              scaleContainers.find('img').attr('data-dirty', 'true');
            }

            if (scaleContainer.size() === 0) {
              serviceContainer.append('<div style="position:absolute; left:' + serviceLeft % tileWidth + 'px; top:' + serviceTop % tileHeight + 'px; width:' + tileWidth + 'px; height:' + tileHeight + 'px; margin:0; padding:0;" data-pixelSize="' + pixelSize + '"></div>');
              scaleContainer = serviceContainer.children(':last').data('scaleOrigin', (serviceLeft % tileWidth) + ',' + (serviceTop % tileHeight));
            } else {
              scaleContainer.css({
                left: (serviceLeft % tileWidth) + 'px',
                top: (serviceTop % tileHeight) + 'px'
              }).data('scaleOrigin', (serviceLeft % tileWidth) + ',' + (serviceTop % tileHeight));

              scaleContainer.children().each(function (i) {
                var $img = $(this);
                var tile = $img.attr('data-tile').split(',');
                $img.css({
                  left: Math.round(((parseInt(tile[0]) - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + '%',
                  top: Math.round(((parseInt(tile[1]) - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + '%'
                });

                if (opacity < 1) {
                  $img.fadeTo(0, opacity);
                }
              });
            }

            for (var x = tileX; x < tileX2; x++) {
              for (var y = tileY; y < tileY2; y++) {
                var tileStr = '' + x + ',' + y,
                  $image = scaleContainer.children('[data-tile="' + tileStr + '"]');

                $image.removeAttr('data-dirty');

                if ($image.size() === 0 || serviceState.reloadTiles) {
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
                      }
                    });

                  serviceState.loadCount++;

                  if (serviceState.reloadTiles && $image.size() > 0) {
                    $image.attr('src', imageUrl);
                  } else {
                    var imgMarkup = '<img style="position:absolute; ' +
                      'left:' + (((x - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + '%; ' +
                      'top:' + (((y - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + '%; ';

                    if ($('body')[0].filters === undefined) {
                      imgMarkup += 'width: 100%; height: 100%;';
                    }

                    imgMarkup += 'margin:0; padding:0; -moz-user-select:none; display:none;" unselectable="on" data-tile="' + tileStr + '" />';

                    scaleContainer.append(imgMarkup);
                    $image = scaleContainer.children(':last');
                    $image.load(function (e) {
                      if (opacity < 1) {
                        $(e.target).fadeTo(0, opacity);
                      } else {
                        $(e.target).show();
                      }

                      serviceState.loadCount--;

                      if (serviceState.loadCount <= 0) {
                        serviceContainer.children(':not([data-pixelSize="' + pixelSize + '"])').remove();
                        serviceState.loadCount = 0;
                      }
                    }).error(function (e) {
                      $(e.target).remove();
                      serviceState.loadCount--;

                      if (serviceState.loadCount <= 0) {
                        serviceContainer.children(':not([data-pixelSize="' + pixelSize + '"])').remove();
                        serviceState.loadCount = 0;
                      }
                    }).attr('src', imageUrl);
                  }
                }
              }
            }

            scaleContainers.find('[data-dirty]').remove();
            serviceState.reloadTiles = false;
          }
        },

        _cancelUnloaded: function (map, service) {
          var serviceState = this[service.id],
            serviceContainer = serviceState.serviceContainer;

          if (serviceState.loadCount > 0) {
            serviceContainer.find("img:hidden").remove();
            while (serviceState.loadCount > 0) {
              serviceState.loadCount--;
            }
          }
        },

        _onOpacityChanged: function () {
        }
      }
    }
  };

  $.widget('geo.geomap', (function () {
    return {
      options: $.extend({}, _defaultOptions),

      _createWidget: function (options, element) {
        _initOptions = options;
        _elem = $(element);

        var cssPosition = _elem.css(_position),
          size;

        if (cssPosition != _relative && cssPosition != 'absolute' && cssPosition != 'fixed') {
          _elem.css(_position, _relative);
        }

        _elem.css('text-align', 'left');

        size = this._findMapSize();
        _contentBounds = {
          x: parseInt(_elem.css('padding-left')),
          y: parseInt(_elem.css('padding-top')),
          width: size[_width],
          height: size[_height]
        };

        this._createChildren();

        _center = _centerMax = [0, 0];

        _pixelSize = _pixelSizeMax = 156543.03392799936;

        this[__mouseDown] =
        this[__inOp] =
        this[__toolPan] =
        this[__shiftZoom] =
        this[__panning] =
        this[__isTap] =
        this[__isDbltap] = false;

        this[__anchor] =
        this[__current] =
        this[__lastMove] =
        this[__lastDrag] =
        this[__velocity] = [0, 0];

        this[__friction] = [.8, .8];

        this[__downDate] =
        this[__moveDate] =
        this[__clickDate] = 0;

        $.Widget.prototype._createWidget.apply(this, arguments);
      },

      _create: function () {
        _options = this.options;

        this[__supportTouch] = 'ontouchend' in document;

        var touchStartEvent = this[__supportTouch] ? 'touchstart' : 'mousedown',
    	  touchStopEvent = this[__supportTouch] ? 'touchend touchcancel' : 'mouseup',
    	  touchMoveEvent = this[__supportTouch] ? 'touchmove' : 'mousemove';

        _eventTarget.dblclick($.proxy(this._eventTarget_dblclick, this));
        _eventTarget.bind(touchStartEvent, $.proxy(this._eventTarget_touchstart, this));

        var dragTarget = (_eventTarget[0].setCapture) ? _eventTarget : $(document);
        dragTarget.bind(touchMoveEvent, $.proxy(this._dragTarget_touchmove, this));
        dragTarget.bind(touchStopEvent, $.proxy(this._dragTarget_touchstop, this));

        _eventTarget.mousewheel($.proxy(this._eventTarget_mousewheel, this));

        if (_initOptions.bbox) {
          this._setOption("bbox", _initOptions.bbox, false);
        }

        _eventTarget.css("cursor", _options[_cursors][_options[_mode]]);

        this._createServices();

        this._refresh();
      },

      _setOption: function (key, value, trigger, refresh) {
        switch (key) {
          case "bbox":
            this._setBbox(value, (trigger === undefined || trigger), (refresh === undefined || refresh));
            value = this._getBbox();
            if ($.geo.proj) {
              var valuePoints = $.geo.proj.toGeodetic([[value[0], value[1]], [value[2], value[3]]]);
              value = [valuePoints[0][0], valuePoints[0][1], valuePoints[1][0], valuePoints[1][1]];
            }
            break;
        }

        $.Widget.prototype._setOption.apply(this, arguments);

      },

      destroy: function () {
        $.Widget.prototype.destroy.apply(this, arguments);
        this.element.html('');
      },

      _getBbox: function () {
        // calculate the internal bbox
        var halfWidth = _contentBounds[_width] / 2 * _pixelSize,
        halfHeight = _contentBounds[_height] / 2 * _pixelSize;
        return [_center[0] - halfWidth, _center[1] - halfHeight, _center[0] + halfWidth, _center[1] + halfHeight];
      },

      _setBbox: function (value, trigger, refresh) {
        if ($.geo.proj) {
          var valuePoints = $.geo.proj.fromGeodetic([[value[0], value[1]], [value[2], value[3]]]);
          value = [valuePoints[0][0], valuePoints[0][1], valuePoints[1][0], valuePoints[1][1]];
        }

        var center = [value[0] + (value[2] - value[0]) / 2, value[1] + (value[3] - value[1]) / 2],
          pixelSize = Math.max($.geo._width(value) / _contentBounds.width, $.geo._height(value) / _contentBounds.height);

        if (_options[_tilingScheme]) {
          var zoom = this._tiledZoom(pixelSize);
          pixelSize = this._tiledPixelSize(zoom);
        }
        this._setCenterAndSize(center, pixelSize, trigger, refresh);
      },

      _getBboxMax: function () {
        // calculate the internal bboxMax
        var halfWidth = _contentBounds[_width] / 2 * _pixelSizeMax,
        halfHeight = _contentBounds[_height] / 2 * _pixelSizeMax;
        return [_centerMax[0] - halfWidth, _centerMax[1] - halfHeight, _centerMax[0] + halfWidth, _centerMax[1] + halfHeight];
      },

      _getZoom: function () {
        // calculate the internal zoom level, vs. public zoom property
        if (_options[_tilingScheme]) {
          return this._tiledZoom(_pixelSize);
        } else {
          var ratio = _contentBounds[_width] / _contentBounds[_height],
          bbox = $.geo._reaspect(this._getBbox(), ratio),
          bboxMax = $.geo._reaspect(this._getBboxMax(), ratio);

          return Math.log($.geo._width(bboxMax) / $.geo._width(bbox)) / Math.log(_zoomFactor);
        }
      },

      _createChildren: function () {
        var existingChildren = _elem.children().detach();

        existingChildren.css('-moz-user-select', 'none');

        _elem.prepend('<div style="position:absolute; left:' + _contentBounds.x + 'px; top:' + _contentBounds.y + 'px; width:' + _contentBounds[_width] + 'px; height:' + _contentBounds[_height] + 'px; margin:0; padding:0; overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;" unselectable="on"></div>');
        _eventTarget = _contentFrame = _elem.children(':first');

        _contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + _contentBounds[_width] + 'px; height:' + _contentBounds[_height] + 'px; margin: 0; padding: 0;"></div>');
        _servicesContainer = _contentFrame.children(':last');

        _contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + _contentBounds[_width] + 'px; height:' + _contentBounds[_height] + 'px; margin: 0; padding: 0;"></div>');
        _graphicsContainer = _contentFrame.children(':last');

        _contentFrame.append('<div class="ui-widget ui-widget-content ui-corner-all" style="position:absolute; left:0; top:0px; max-width:128px; display:none;"><div style="margin:.2em;"></div></div>');
        _textContainer = _contentFrame.children(':last');
        _textContent = _textContainer.children();

        _contentFrame.append(existingChildren);
      },

      _createServices: function () {
        for (var i = 0; i < _options[_services].length; i++) {
          _options[__serviceTypes][_options[_services][i].type].create(this, _options[_services][i]);
        }
      },

      _findMapSize: function () {
        // really, really attempt to find a size for this thing
        // even if it's hidden (look at parents)
        var size = { width: 0, height: 0 },
        sizeContainer = _elem;

        while (sizeContainer.size() && !(size[_width] > 0 && size[_height] > 0)) {
          size = { width: sizeContainer.width(), height: sizeContainer.height() };
          if (size[_width] <= 0 || size[_height] <= 0) {
            size = { width: parseInt(sizeContainer.css(_width)), height: parseInt(sizeContainer.css(_height)) };
          }
          sizeContainer = sizeContainer.parent();
        }
        return size;
      },

      _panEnd: function () {
        this[__velocity] = [
        (this[__velocity][0] > 0 ? Math.floor(this[__velocity][0] * this[__friction][0]) : Math.ceil(this[__velocity][0] * this[__friction][0])),
        (this[__velocity][1] > 0 ? Math.floor(this[__velocity][1] * this[__friction][1]) : Math.ceil(this[__velocity][1] * this[__friction][1]))
      ];

        if (Math.abs(this[__velocity][0]) < 4 && Math.abs(this[__velocity][1]) < 4) {
          this._panFinalize();
        } else {
          this[__current] = [
          this[__current][0] + this[__velocity][0],
          this[__current][1] + this[__velocity][1]
        ];

          this._panMove();
          setTimeout($.proxy(this._panEnd, this), 30);
        }
      },

      _panFinalize: function () {
        if (this[__panning]) {
          this[__velocity] = [0, 0];

          var
          dx = this[__current][0] - this[__anchor][0],
          dy = this[__current][1] - this[__anchor][1],
          dxMap = -dx * _pixelSize,
          dyMap = dy * _pixelSize;

          //console.log('panFinalize: ' + dx + ', ' + dy);

          this._setCenterAndSize([_center[0] + dxMap, _center[1] + dyMap], _pixelSize, true, true);
          // trigger("geomapbbox")

          this[__inOp] = false;
          this[__anchor] = this[__current];
          this[__toolPan] = this[__panning] = false;

          _eventTarget.css("cursor", _options[_cursors][_options[_mode]]);
        }
      },

      _panMove: function () {
        var
        dx = this[__current][0] - this[__lastDrag][0],
        dy = this[__current][1] - this[__lastDrag][1];

        if (this[__toolPan] || dx > 3 || dx < -3 || dy > 3 || dy < -3) {
          if (!this[__toolPan]) {
            this[__toolPan] = true;
            _eventTarget.css("cursor", _options[_cursors]["pan"]);
          }

          if (this[__mouseDown]) {
            this[__velocity] = [dx, dy];
          }

          if (dx != 0 || dy != 0) {
            this[__panning] = true;
            this[__lastDrag] = this[__current];

            for (i = 0; i < _options[_services].length; i++) {
              var service = _options[_services][i];
              _options[__serviceTypes][service.type].interactivePan(this, service, dx, dy);
            }
          }
        }
      },

      _refresh: function () {
        for (var i = 0; i < _options[_services].length; i++) {
          var service = _options[_services][i];
          if (!this[__mouseDown] && _options[__serviceTypes][service.type] != null) {
            _options[__serviceTypes][service.type].refresh(this, service);
          }
        }
      },

      _setCenterAndSize: function (center, pixelSize, trigger, refresh) {
        // the final call during any extent change
        if (_pixelSize != pixelSize) {
          for (var i = 0; i < _options[_services].length; i++) {
            var service = _options[_services][i];
            _options[__serviceTypes][service.type].interactiveScale(this, service, center, pixelSize);
          }
        }

        _center = center;
        _pixelSize = pixelSize;

        if (refresh) {
          this._refresh();
        }
      },

      _tiledPixelSize: function (zoom) {
        var tilingScheme = _options[_tilingScheme];
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

      _tiledZoom: function (pixelSize) {
        var tilingScheme = _options[_tilingScheme];
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

      _toMap: function (p, center, pixelSize) {
        // ignores $.geo.proj
        var isArray = $.isArray(p[0]);
        if (!isArray) {
          p = [p];
        }

        center = center || _center;
        pixelSize = pixelSize || _pixelSize;

        var width = _contentBounds[_width],
        height = _contentBounds[_height],
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

        if (isArray) {
          return result;
        } else {
          return result[0];
        }
      },

      _zoomTo: function (coord, zoom) {
        zoom = zoom < 0 ? 0 : zoom;

        var tiledPixelSize = this._tiledPixelSize(zoom);

        if (!isNaN(tiledPixelSize)) {
          this._setCenterAndSize(coord, tiledPixelSize, false, true);
        } else {
          var bboxMax = $.geo._scaleBy(this._getBboxMax(), 1 / Math.pow(_zoomFactor, zoom)),
          pixelSize = Math.max($.geo._width(bboxMax) / _contentBounds[_width], $.geo._height(bboxMax) / _contentBounds[_height]);
          this._setCenterAndSize(coord, pixelSize, false, true);
        }
      },

      _eventTarget_dblclick: function (e) {
        this._panFinalize();

        offset = $(e.currentTarget).offset();

        switch (_options[_mode]) {
          case "pan":
            this._zoomTo(this._toMap(this[__current]), this._getZoom() + 1);
            break;
        }

        this[__inOp] = false;
      },

      _eventTarget_touchstart: function (e) {
        if (!this[__supportTouch] && e.which != 1) {
          return;
        }

        if (_softDblClick) {
          var downDate = $.now();
          if (downDate - this[__downDate] < 750) {
            if (this[__isDbltap]) {
              this[__isDbltap] = false;
            } else {
              this[__isDbltap] = this[__isTap];
            }
          } else {
            this[__isDbltap] = false;
          }
          this[__isTap] = true;
          this[__downDate] = downDate;
        }

        e.preventDefault();

        this._panFinalize();
        //this._mouseWheelFinish();

        var offset = $(e.currentTarget).offset();

        if (this[__supportTouch]) {
          this[__current] = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          this[__current] = [e.pageX - offset.left, e.pageY - offset.top];
        }

        this[__mouseDown] = true;
        this[__anchor] = this[__current];

        if (!this[__inOp] && e.shiftKey) {
          this[__shiftZoom] = true;
          _eventTarget.css("cursor", _options[_cursors]["zoom"]);
        } else {
          this[__inOp] = true;
          switch (_options[_mode]) {
            case "pan":
              this[__lastDrag] = this[__current];

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
        offset = _eventTarget.offset(),
        current, i, dx, dy;

        if (this[__supportTouch]) {
          current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          current = [e.pageX - offset.left, e.pageY - offset.top];
        }

        if (current[0] == this[__lastMove][0] && current[1] == this[__lastMove][1]) {
          return;
        }

        if (_softDblClick) {
          this[__isDbltap] = this[__isTap] = false;
        }

        if (this[__mouseDown]) {
          this[__current] = current;
          this[__moveDate] = $.now();
        }

        var mode = this[__shiftZoom] ? "zoom" : _options[_mode];

        switch (mode) {
          case "pan":
            if (this[__mouseDown]) {
              this._panMove();
            } else {
              // trigger geomapmove
            }
            break;
        }

        this[__lastMove] = current;
      },

      _dragTarget_touchstop: function (e) {
        if (!this[__mouseDown] && _ieVersion == 7) {
          // ie7 doesn't appear to trigger dblclick on _eventTarget,
          // we fake regular click here to cause soft dblclick
          this._eventTarget_touchstart(e);
        }

        var
        mouseWasDown = this[__mouseDown],
        wasToolPan = this[__toolPan],
        offset = _eventTarget.offset(),
        current, i;

        if (this[__supportTouch]) {
          current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
        } else {
          current = [e.pageX - offset.left, e.pageY - offset.top];
        }

        var mode = this[__shiftZoom] ? "zoom" : _options[_mode];

        _eventTarget.css("cursor", _options[_cursors][mode]);

        this[__shiftZoom] =
        this[__mouseDown] =
        this[__toolPan] = false;

        if (document.releaseCapture) {
          document.releaseCapture();
        }

        if (mouseWasDown) {
          var 
          clickDate = $.now(),
          dx, dy;

          this[__current] = current;

          switch (mode) {
            case "pan":
              if (clickDate - this[__moveDate] > 500) {
                this._panFinalize();
              } else {
                this._panEnd();
              }
              break;
          }

          this[__clickDate] = clickDate;

          if (_softDblClick && this[__isDbltap]) {
            this[__isDbltap] = this[__isTap] = false;
            _eventTarget.trigger("dblclick", e);
          }
        }
      },

      _eventTarget_mousewheel: function (e, delta) {

      }
    };
  })()
  );


})(jQuery);

