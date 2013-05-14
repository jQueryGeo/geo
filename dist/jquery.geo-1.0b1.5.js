/*! jQuery Geo - v1.0b1.5 - 2013-01-17
 * http://jquerygeo.com
 * Copyright (c) 2013 Ryan Westphal/Applied Geographics, Inc.; Licensed MIT, GPL */

// Copyright 2006 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


// Known Issues:
//
// * Patterns only support repeat.
// * Radial gradient are not implemented. The VML version of these look very
//   different from the canvas one.
// * Clipping paths are not implemented.
// * Coordsize. The width and height attribute have higher priority than the
//   width and height style values which isn't correct.
// * Painting mode isn't implemented.
// * Canvas width/height should is using content-box by default. IE in
//   Quirks mode will draw the canvas using border-box. Either change your
//   doctype to HTML5
//   (http://www.whatwg.org/specs/web-apps/current-work/#the-doctype)
//   or use Box Sizing Behavior from WebFX
//   (http://webfx.eae.net/dhtml/boxsizing/boxsizing.html)
// * Non uniform scaling does not correctly scale strokes.
// * Optimize. There is always room for speed improvements.

// Only add this code if we do not already have a canvas implementation
if (!document.createElement('canvas').getContext) {

  (function () {

    // alias some functions to make (compiled) code shorter
    var m = Math;
    var mr = m.round;
    var ms = m.sin;
    var mc = m.cos;
    var abs = m.abs;
    var sqrt = m.sqrt;

    // this is used for sub pixel precision
    var Z = 10;
    var Z2 = Z / 2;

    var IE_VERSION = +navigator.userAgent.match(/MSIE ([\d.]+)?/)[1];

    /**
    * This funtion is assigned to the <canvas> elements as element.getContext().
    * @this {HTMLElement}
    * @return {CanvasRenderingContext2D_}
    */
    function getContext() {
      return this.context_ ||
        (this.context_ = new CanvasRenderingContext2D_(this));
    }

    var slice = Array.prototype.slice;

    /**
    * Binds a function to an object. The returned function will always use the
    * passed in {@code obj} as {@code this}.
    *
    * Example:
    *
    *   g = bind(f, obj, a, b)
    *   g(c, d) // will do f.call(obj, a, b, c, d)
    *
    * @param {Function} f The function to bind the object to
    * @param {Object} obj The object that should act as this when the function
    *     is called
    * @param {*} var_args Rest arguments that will be used as the initial
    *     arguments when the function is called
    * @return {Function} A new function that has bound this
    */
    function bind(f, obj, var_args) {
      var a = slice.call(arguments, 2);
      return function () {
        return f.apply(obj, a.concat(slice.call(arguments)));
      };
    }

    function encodeHtmlAttribute(s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function addNamespace(doc, prefix, urn) {
      if (!doc.namespaces[prefix]) {
        doc.namespaces.add(prefix, urn, '#default#VML');
      }
    }

    function addNamespacesAndStylesheet(doc) {
      addNamespace(doc, 'g_vml_', 'urn:schemas-microsoft-com:vml');
      addNamespace(doc, 'g_o_', 'urn:schemas-microsoft-com:office:office');

      // Setup default CSS.  Only add one style sheet per document
      if (!doc.styleSheets['ex_canvas_']) {
        var ss = doc.createStyleSheet();
        ss.owningElement.id = 'ex_canvas_';
        ss.cssText = 'canvas{display:inline-block;overflow:hidden;' +
        // default size is 300x150 in Gecko and Opera
          'text-align:left;width:300px;height:150px}';
      }
    }

    // Add namespaces and stylesheet at startup.
    addNamespacesAndStylesheet(document);

    var G_vmlCanvasManager_ = {
      init: function (opt_doc) {
        var doc = opt_doc || document;
        // Create a dummy element so that IE will allow canvas elements to be
        // recognized.
        doc.createElement('canvas');
        doc.attachEvent('onreadystatechange', bind(this.init_, this, doc));
      },

      init_: function (doc) {
        // find all canvas elements
        var els = doc.getElementsByTagName('canvas');
        for (var i = 0; i < els.length; i++) {
          this.initElement(els[i]);
        }
      },

      /**
      * Public initializes a canvas element so that it can be used as canvas
      * element from now on. This is called automatically before the page is
      * loaded but if you are creating elements using createElement you need to
      * make sure this is called on the element.
      * @param {HTMLElement} el The canvas element to initialize.
      * @return {HTMLElement} the element that was created.
      */
      initElement: function (el) {
        if (!el.getContext) {
          el.getContext = getContext;

          // Add namespaces and stylesheet to document of the element.
          addNamespacesAndStylesheet(el.ownerDocument);

          // Remove fallback content. There is no way to hide text nodes so we
          // just remove all childNodes. We could hide all elements and remove
          // text nodes but who really cares about the fallback content.
          el.innerHTML = '';

          // do not use inline function because that will leak memory
          el.attachEvent('onpropertychange', onPropertyChange);
          el.attachEvent('onresize', onResize);

          var attrs = el.attributes;
          if (attrs.width && attrs.width.specified) {
            // TODO: use runtimeStyle and coordsize
            // el.getContext().setWidth_(attrs.width.nodeValue);
            el.style.width = attrs.width.nodeValue + 'px';
          } else {
            el.width = el.clientWidth;
          }
          if (attrs.height && attrs.height.specified) {
            // TODO: use runtimeStyle and coordsize
            // el.getContext().setHeight_(attrs.height.nodeValue);
            el.style.height = attrs.height.nodeValue + 'px';
          } else {
            el.height = el.clientHeight;
          }
          //el.getContext().setCoordsize_()
        }
        return el;
      }
    };

    function onPropertyChange(e) {
      var el = e.srcElement;

      switch (e.propertyName) {
        case 'width':
          el.getContext().clearRect();
          el.style.width = el.attributes.width.nodeValue + 'px';
          // In IE8 this does not trigger onresize.
          el.firstChild.style.width = el.clientWidth + 'px';
          break;
        case 'height':
          el.getContext().clearRect();
          el.style.height = el.attributes.height.nodeValue + 'px';
          el.firstChild.style.height = el.clientHeight + 'px';
          break;
      }
    }

    function onResize(e) {
      var el = e.srcElement;
      if (el.firstChild) {
        el.firstChild.style.width = el.clientWidth + 'px';
        el.firstChild.style.height = el.clientHeight + 'px';
      }
    }

    G_vmlCanvasManager_.init();

    // precompute "00" to "FF"
    var decToHex = [];
    for (var i = 0; i < 16; i++) {
      for (var j = 0; j < 16; j++) {
        decToHex[i * 16 + j] = i.toString(16) + j.toString(16);
      }
    }

    function createMatrixIdentity() {
      return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    }

    function matrixMultiply(m1, m2) {
      var result = createMatrixIdentity();

      for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 3; y++) {
          var sum = 0;

          for (var z = 0; z < 3; z++) {
            sum += m1[x][z] * m2[z][y];
          }

          result[x][y] = sum;
        }
      }
      return result;
    }

    function copyState(o1, o2) {
      o2.fillStyle     = o1.fillStyle;
      o2.lineCap       = o1.lineCap;
      o2.lineJoin      = o1.lineJoin;
      o2.lineWidth     = o1.lineWidth;
      o2.miterLimit    = o1.miterLimit;
      o2.shadowBlur    = o1.shadowBlur;
      o2.shadowColor   = o1.shadowColor;
      o2.shadowOffsetX = o1.shadowOffsetX;
      o2.shadowOffsetY = o1.shadowOffsetY;
      o2.strokeStyle   = o1.strokeStyle;
      o2.globalAlpha   = o1.globalAlpha;
      o2.font          = o1.font;
      o2.textAlign     = o1.textAlign;
      o2.textBaseline  = o1.textBaseline;
      o2.arcScaleX_    = o1.arcScaleX_;
      o2.arcScaleY_    = o1.arcScaleY_;
      o2.lineScale_    = o1.lineScale_;
    }

    //  var colorData = {
    //    aliceblue: '#F0F8FF',
    //    antiquewhite: '#FAEBD7',
    //    aquamarine: '#7FFFD4',
    //    azure: '#F0FFFF',
    //    beige: '#F5F5DC',
    //    bisque: '#FFE4C4',
    //    black: '#000000',
    //    blanchedalmond: '#FFEBCD',
    //    blueviolet: '#8A2BE2',
    //    brown: '#A52A2A',
    //    burlywood: '#DEB887',
    //    cadetblue: '#5F9EA0',
    //    chartreuse: '#7FFF00',
    //    chocolate: '#D2691E',
    //    coral: '#FF7F50',
    //    cornflowerblue: '#6495ED',
    //    cornsilk: '#FFF8DC',
    //    crimson: '#DC143C',
    //    cyan: '#00FFFF',
    //    darkblue: '#00008B',
    //    darkcyan: '#008B8B',
    //    darkgoldenrod: '#B8860B',
    //    darkgray: '#A9A9A9',
    //    darkgreen: '#006400',
    //    darkgrey: '#A9A9A9',
    //    darkkhaki: '#BDB76B',
    //    darkmagenta: '#8B008B',
    //    darkolivegreen: '#556B2F',
    //    darkorange: '#FF8C00',
    //    darkorchid: '#9932CC',
    //    darkred: '#8B0000',
    //    darksalmon: '#E9967A',
    //    darkseagreen: '#8FBC8F',
    //    darkslateblue: '#483D8B',
    //    darkslategray: '#2F4F4F',
    //    darkslategrey: '#2F4F4F',
    //    darkturquoise: '#00CED1',
    //    darkviolet: '#9400D3',
    //    deeppink: '#FF1493',
    //    deepskyblue: '#00BFFF',
    //    dimgray: '#696969',
    //    dimgrey: '#696969',
    //    dodgerblue: '#1E90FF',
    //    firebrick: '#B22222',
    //    floralwhite: '#FFFAF0',
    //    forestgreen: '#228B22',
    //    gainsboro: '#DCDCDC',
    //    ghostwhite: '#F8F8FF',
    //    gold: '#FFD700',
    //    goldenrod: '#DAA520',
    //    grey: '#808080',
    //    greenyellow: '#ADFF2F',
    //    honeydew: '#F0FFF0',
    //    hotpink: '#FF69B4',
    //    indianred: '#CD5C5C',
    //    indigo: '#4B0082',
    //    ivory: '#FFFFF0',
    //    khaki: '#F0E68C',
    //    lavender: '#E6E6FA',
    //    lavenderblush: '#FFF0F5',
    //    lawngreen: '#7CFC00',
    //    lemonchiffon: '#FFFACD',
    //    lightblue: '#ADD8E6',
    //    lightcoral: '#F08080',
    //    lightcyan: '#E0FFFF',
    //    lightgoldenrodyellow: '#FAFAD2',
    //    lightgreen: '#90EE90',
    //    lightgrey: '#D3D3D3',
    //    lightpink: '#FFB6C1',
    //    lightsalmon: '#FFA07A',
    //    lightseagreen: '#20B2AA',
    //    lightskyblue: '#87CEFA',
    //    lightslategray: '#778899',
    //    lightslategrey: '#778899',
    //    lightsteelblue: '#B0C4DE',
    //    lightyellow: '#FFFFE0',
    //    limegreen: '#32CD32',
    //    linen: '#FAF0E6',
    //    magenta: '#FF00FF',
    //    mediumaquamarine: '#66CDAA',
    //    mediumblue: '#0000CD',
    //    mediumorchid: '#BA55D3',
    //    mediumpurple: '#9370DB',
    //    mediumseagreen: '#3CB371',
    //    mediumslateblue: '#7B68EE',
    //    mediumspringgreen: '#00FA9A',
    //    mediumturquoise: '#48D1CC',
    //    mediumvioletred: '#C71585',
    //    midnightblue: '#191970',
    //    mintcream: '#F5FFFA',
    //    mistyrose: '#FFE4E1',
    //    moccasin: '#FFE4B5',
    //    navajowhite: '#FFDEAD',
    //    oldlace: '#FDF5E6',
    //    olivedrab: '#6B8E23',
    //    orange: '#FFA500',
    //    orangered: '#FF4500',
    //    orchid: '#DA70D6',
    //    palegoldenrod: '#EEE8AA',
    //    palegreen: '#98FB98',
    //    paleturquoise: '#AFEEEE',
    //    palevioletred: '#DB7093',
    //    papayawhip: '#FFEFD5',
    //    peachpuff: '#FFDAB9',
    //    peru: '#CD853F',
    //    pink: '#FFC0CB',
    //    plum: '#DDA0DD',
    //    powderblue: '#B0E0E6',
    //    rosybrown: '#BC8F8F',
    //    royalblue: '#4169E1',
    //    saddlebrown: '#8B4513',
    //    salmon: '#FA8072',
    //    sandybrown: '#F4A460',
    //    seagreen: '#2E8B57',
    //    seashell: '#FFF5EE',
    //    sienna: '#A0522D',
    //    skyblue: '#87CEEB',
    //    slateblue: '#6A5ACD',
    //    slategray: '#708090',
    //    slategrey: '#708090',
    //    snow: '#FFFAFA',
    //    springgreen: '#00FF7F',
    //    steelblue: '#4682B4',
    //    tan: '#D2B48C',
    //    thistle: '#D8BFD8',
    //    tomato: '#FF6347',
    //    turquoise: '#40E0D0',
    //    violet: '#EE82EE',
    //    wheat: '#F5DEB3',
    //    whitesmoke: '#F5F5F5',
    //    yellowgreen: '#9ACD32'
    //  };


    function getRgbHslContent(styleString) {
      var start = styleString.indexOf('(', 3);
      var end = styleString.indexOf(')', start + 1);
      var parts = styleString.substring(start + 1, end).split(',');
      // add alpha if needed
      if (parts.length != 4 || styleString.charAt(3) != 'a') {
        parts[3] = 1;
      }
      return parts;
    }

    function percent(s) {
      return parseFloat(s) / 100;
    }

    function clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    }

    function hslToRgb(parts) {
      var r, g, b, h, s, l;
      h = parseFloat(parts[0]) / 360 % 360;
      if (h < 0)
        h++;
      s = clamp(percent(parts[1]), 0, 1);
      l = clamp(percent(parts[2]), 0, 1);
      if (s == 0) {
        r = g = b = l; // achromatic
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
      }

      return '#' + decToHex[Math.floor(r * 255)] +
        decToHex[Math.floor(g * 255)] +
        decToHex[Math.floor(b * 255)];
    }

    function hueToRgb(m1, m2, h) {
      if (h < 0)
        h++;
      if (h > 1)
        h--;

      if (6 * h < 1)
        return m1 + (m2 - m1) * 6 * h;
      else if (2 * h < 1)
        return m2;
      else if (3 * h < 2)
        return m1 + (m2 - m1) * (2 / 3 - h) * 6;
      else
        return m1;
    }

    var processStyleCache = {};

    function processStyle(styleString) {
      if (styleString in processStyleCache) {
        return processStyleCache[styleString];
      }

      var str, alpha = 1;

      styleString = String(styleString);
      if (styleString.charAt(0) == '#') {
        str = styleString;
      } else if (/^rgb/.test(styleString)) {
        var parts = getRgbHslContent(styleString);
        var str = '#', n;
        for (var i = 0; i < 3; i++) {
          if (parts[i].indexOf('%') != -1) {
            n = Math.floor(percent(parts[i]) * 255);
          } else {
            n = +parts[i];
          }
          str += decToHex[clamp(n, 0, 255)];
        }
        alpha = +parts[3];
      } else if (/^hsl/.test(styleString)) {
        var parts = getRgbHslContent(styleString);
        str = hslToRgb(parts);
        alpha = parts[3];
      } else {
        str = /*colorData[styleString] ||*/styleString;
      }
      return processStyleCache[styleString] = { color: str, alpha: alpha };
    }

    var DEFAULT_STYLE = {
      style: 'normal',
      variant: 'normal',
      weight: 'normal',
      size: 10,
      family: 'sans-serif'
    };

    // Internal text style cache
    //  var fontStyleCache = {};

    //  function processFontStyle(styleString) {
    //    if (fontStyleCache[styleString]) {
    //      return fontStyleCache[styleString];
    //    }

    //    var el = document.createElement('div');
    //    var style = el.style;
    //    try {
    //      style.font = styleString;
    //    } catch (ex) {
    //      // Ignore failures to set to invalid font.
    //    }

    //    return fontStyleCache[styleString] = {
    //      style: style.fontStyle || DEFAULT_STYLE.style,
    //      variant: style.fontVariant || DEFAULT_STYLE.variant,
    //      weight: style.fontWeight || DEFAULT_STYLE.weight,
    //      size: style.fontSize || DEFAULT_STYLE.size,
    //      family: style.fontFamily || DEFAULT_STYLE.family
    //    };
    //  }

    //  function getComputedStyle(style, element) {
    //    var computedStyle = {};

    //    for (var p in style) {
    //      computedStyle[p] = style[p];
    //    }

    //    // Compute the size
    //    var canvasFontSize = parseFloat(element.currentStyle.fontSize),
    //        fontSize = parseFloat(style.size);

    //    if (typeof style.size == 'number') {
    //      computedStyle.size = style.size;
    //    } else if (style.size.indexOf('px') != -1) {
    //      computedStyle.size = fontSize;
    //    } else if (style.size.indexOf('em') != -1) {
    //      computedStyle.size = canvasFontSize * fontSize;
    //    } else if(style.size.indexOf('%') != -1) {
    //      computedStyle.size = (canvasFontSize / 100) * fontSize;
    //    } else if (style.size.indexOf('pt') != -1) {
    //      computedStyle.size = fontSize / .75;
    //    } else {
    //      computedStyle.size = canvasFontSize;
    //    }

    //    // Different scaling between normal text and VML text. This was found using
    //    // trial and error to get the same size as non VML text.
    //    computedStyle.size *= 0.981;

    //    return computedStyle;
    //  }

    //  function buildStyle(style) {
    //    return style.style + ' ' + style.variant + ' ' + style.weight + ' ' +
    //        style.size + 'px ' + style.family;
    //  }

    var lineCapMap = {
      'butt': 'flat',
      'round': 'round'
    };

    function processLineCap(lineCap) {
      return lineCapMap[lineCap] || 'square';
    }

    /**
    * This class implements CanvasRenderingContext2D interface as described by
    * the WHATWG.
    * @param {HTMLElement} canvasElement The element that the 2D context should
    * be associated with
    */
    function CanvasRenderingContext2D_(canvasElement) {
      this.m_ = createMatrixIdentity();

      this.mStack_ = [];
      this.aStack_ = [];
      this.currentPath_ = [];

      // Canvas context properties
      this.strokeStyle = '#000';
      this.fillStyle = '#000';

      this.lineWidth = 1;
      this.lineJoin = 'miter';
      this.lineCap = 'butt';
      this.miterLimit = Z * 1;
      this.globalAlpha = 1;
      //this.font = '10px sans-serif';
      //this.textAlign = 'left';
      //this.textBaseline = 'alphabetic';
      this.canvas = canvasElement;

      var cssText = 'width:' + canvasElement.clientWidth + 'px;height:' +
        canvasElement.clientHeight + 'px;overflow:hidden;position:absolute';
      var el = canvasElement.ownerDocument.createElement('div');
      el.style.cssText = cssText;
      canvasElement.appendChild(el);

      var overlayEl = el.cloneNode(false);
      // Use a non transparent background.
      overlayEl.style.backgroundColor = 'red';
      overlayEl.style.filter = 'alpha(opacity=0)';
      canvasElement.appendChild(overlayEl);

      this.element_ = el;
      this.arcScaleX_ = 1;
      this.arcScaleY_ = 1;
      this.lineScale_ = 1;
    }

    var contextPrototype = CanvasRenderingContext2D_.prototype;
    contextPrototype.clearRect = function () {
      if (this.textMeasureEl_) {
        this.textMeasureEl_.removeNode(true);
        this.textMeasureEl_ = null;
      }
      this.element_.innerHTML = '';
    };

    contextPrototype.beginPath = function () {
      // TODO: Branch current matrix so that save/restore has no effect
      //       as per safari docs.
      this.currentPath_ = [];
    };

    contextPrototype.moveTo = function (aX, aY) {
      var p = getCoords(this, aX, aY);
      this.currentPath_.push({ type: 'moveTo', x: p.x, y: p.y });
      this.currentX_ = p.x;
      this.currentY_ = p.y;
    };

    contextPrototype.lineTo = function (aX, aY) {
      var p = getCoords(this, aX, aY);
      this.currentPath_.push({ type: 'lineTo', x: p.x, y: p.y });

      this.currentX_ = p.x;
      this.currentY_ = p.y;
    };

    contextPrototype.bezierCurveTo = function(aCP1x, aCP1y,
                                              aCP2x, aCP2y,
                                              aX, aY) {
      var p = getCoords(this, aX, aY);
      var cp1 = getCoords(this, aCP1x, aCP1y);
      var cp2 = getCoords(this, aCP2x, aCP2y);
      bezierCurveTo(this, cp1, cp2, p);
    };

    // Helper function that takes the already fixed cordinates.
    function bezierCurveTo(self, cp1, cp2, p) {
      self.currentPath_.push({
        type: 'bezierCurveTo',
        cp1x: cp1.x,
        cp1y: cp1.y,
        cp2x: cp2.x,
        cp2y: cp2.y,
        x: p.x,
        y: p.y
      });
      self.currentX_ = p.x;
      self.currentY_ = p.y;
    }

    contextPrototype.quadraticCurveTo = function(aCPx, aCPy, aX, aY) {
      // the following is lifted almost directly from
      // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

      var cp = getCoords(this, aCPx, aCPy);
      var p = getCoords(this, aX, aY);

      var cp1 = {
        x: this.currentX_ + 2.0 / 3.0 * (cp.x - this.currentX_),
        y: this.currentY_ + 2.0 / 3.0 * (cp.y - this.currentY_)
      };
      var cp2 = {
        x: cp1.x + (p.x - this.currentX_) / 3.0,
        y: cp1.y + (p.y - this.currentY_) / 3.0
      };

      bezierCurveTo(this, cp1, cp2, p);
    };

    contextPrototype.arc = function (aX, aY, aRadius,
                                  aStartAngle, aEndAngle, aClockwise) {
      aRadius *= Z;
      var arcType = aClockwise ? 'at' : 'wa';

      var xStart = aX + mc(aStartAngle) * aRadius - Z2;
      var yStart = aY + ms(aStartAngle) * aRadius - Z2;

      var xEnd = aX + mc(aEndAngle) * aRadius - Z2;
      var yEnd = aY + ms(aEndAngle) * aRadius - Z2;

      // IE won't render arches drawn counter clockwise if xStart == xEnd.
      if (xStart == xEnd && !aClockwise) {
        xStart += 0.125; // Offset xStart by 1/80 of a pixel. Use something
        // that can be represented in binary
      }

      var p = getCoords(this, aX, aY);
      var pStart = getCoords(this, xStart, yStart);
      var pEnd = getCoords(this, xEnd, yEnd);

      this.currentPath_.push({ type: arcType,
        x: p.x,
        y: p.y,
        radius: aRadius,
        xStart: pStart.x,
        yStart: pStart.y,
        xEnd: pEnd.x,
        yEnd: pEnd.y
      });

    };

    //  contextPrototype.rect = function(aX, aY, aWidth, aHeight) {
    //    this.moveTo(aX, aY);
    //    this.lineTo(aX + aWidth, aY);
    //    this.lineTo(aX + aWidth, aY + aHeight);
    //    this.lineTo(aX, aY + aHeight);
    //    this.closePath();
    //  };

    //  contextPrototype.strokeRect = function(aX, aY, aWidth, aHeight) {
    //    var oldPath = this.currentPath_;
    //    this.beginPath();

    //    this.moveTo(aX, aY);
    //    this.lineTo(aX + aWidth, aY);
    //    this.lineTo(aX + aWidth, aY + aHeight);
    //    this.lineTo(aX, aY + aHeight);
    //    this.closePath();
    //    this.stroke();

    //    this.currentPath_ = oldPath;
    //  };

    //  contextPrototype.fillRect = function(aX, aY, aWidth, aHeight) {
    //    var oldPath = this.currentPath_;
    //    this.beginPath();

    //    this.moveTo(aX, aY);
    //    this.lineTo(aX + aWidth, aY);
    //    this.lineTo(aX + aWidth, aY + aHeight);
    //    this.lineTo(aX, aY + aHeight);
    //    this.closePath();
    //    this.fill();

    //    this.currentPath_ = oldPath;
    //  };

    //  contextPrototype.createLinearGradient = function(aX0, aY0, aX1, aY1) {
    //    var gradient = new CanvasGradient_('gradient');
    //    gradient.x0_ = aX0;
    //    gradient.y0_ = aY0;
    //    gradient.x1_ = aX1;
    //    gradient.y1_ = aY1;
    //    return gradient;
    //  };

    //  contextPrototype.createRadialGradient = function(aX0, aY0, aR0,
    //                                                   aX1, aY1, aR1) {
    //    var gradient = new CanvasGradient_('gradientradial');
    //    gradient.x0_ = aX0;
    //    gradient.y0_ = aY0;
    //    gradient.r0_ = aR0;
    //    gradient.x1_ = aX1;
    //    gradient.y1_ = aY1;
    //    gradient.r1_ = aR1;
    //    return gradient;
    //  };

    //  contextPrototype.drawImage = function(image, var_args) {
    //    var dx, dy, dw, dh, sx, sy, sw, sh;

    //    // to find the original width we overide the width and height
    //    var oldRuntimeWidth = image.runtimeStyle.width;
    //    var oldRuntimeHeight = image.runtimeStyle.height;
    //    image.runtimeStyle.width = 'auto';
    //    image.runtimeStyle.height = 'auto';

    //    // get the original size
    //    var w = image.width;
    //    var h = image.height;

    //    // and remove overides
    //    image.runtimeStyle.width = oldRuntimeWidth;
    //    image.runtimeStyle.height = oldRuntimeHeight;

    //    if (arguments.length == 3) {
    //      dx = arguments[1];
    //      dy = arguments[2];
    //      sx = sy = 0;
    //      sw = dw = w;
    //      sh = dh = h;
    //    } else if (arguments.length == 5) {
    //      dx = arguments[1];
    //      dy = arguments[2];
    //      dw = arguments[3];
    //      dh = arguments[4];
    //      sx = sy = 0;
    //      sw = w;
    //      sh = h;
    //    } else if (arguments.length == 9) {
    //      sx = arguments[1];
    //      sy = arguments[2];
    //      sw = arguments[3];
    //      sh = arguments[4];
    //      dx = arguments[5];
    //      dy = arguments[6];
    //      dw = arguments[7];
    //      dh = arguments[8];
    //    } else {
    //      throw Error('Invalid number of arguments');
    //    }

    //    var d = getCoords(this, dx, dy);

    //    var w2 = sw / 2;
    //    var h2 = sh / 2;

    //    var vmlStr = [];

    //    var W = 10;
    //    var H = 10;

    //    // For some reason that I've now forgotten, using divs didn't work
    //    vmlStr.push(' <g_vml_:group',
    //                ' coordsize="', Z * W, ',', Z * H, '"',
    //                ' coordorigin="0,0"' ,
    //                ' style="width:', W, 'px;height:', H, 'px;position:absolute;');

    //    // If filters are necessary (rotation exists), create them
    //    // filters are bog-slow, so only create them if abbsolutely necessary
    //    // The following check doesn't account for skews (which don't exist
    //    // in the canvas spec (yet) anyway.

    //    if (this.m_[0][0] != 1 || this.m_[0][1] ||
    //        this.m_[1][1] != 1 || this.m_[1][0]) {
    //      var filter = [];

    //      // Note the 12/21 reversal
    //      filter.push('M11=', this.m_[0][0], ',',
    //                  'M12=', this.m_[1][0], ',',
    //                  'M21=', this.m_[0][1], ',',
    //                  'M22=', this.m_[1][1], ',',
    //                  'Dx=', mr(d.x / Z), ',',
    //                  'Dy=', mr(d.y / Z), '');

    //      // Bounding box calculation (need to minimize displayed area so that
    //      // filters don't waste time on unused pixels.
    //      var max = d;
    //      var c2 = getCoords(this, dx + dw, dy);
    //      var c3 = getCoords(this, dx, dy + dh);
    //      var c4 = getCoords(this, dx + dw, dy + dh);

    //      max.x = m.max(max.x, c2.x, c3.x, c4.x);
    //      max.y = m.max(max.y, c2.y, c3.y, c4.y);

    //      vmlStr.push('padding:0 ', mr(max.x / Z), 'px ', mr(max.y / Z),
    //                  'px 0;filter:progid:DXImageTransform.Microsoft.Matrix(',
    //                  filter.join(''), ", sizingmethod='clip');");

    //    } else {
    //      vmlStr.push('top:', mr(d.y / Z), 'px;left:', mr(d.x / Z), 'px;');
    //    }

    //    vmlStr.push(' ">' ,
    //                '<g_vml_:image src="', image.src, '"',
    //                ' style="width:', Z * dw, 'px;',
    //                ' height:', Z * dh, 'px"',
    //                ' cropleft="', sx / w, '"',
    //                ' croptop="', sy / h, '"',
    //                ' cropright="', (w - sx - sw) / w, '"',
    //                ' cropbottom="', (h - sy - sh) / h, '"',
    //                ' />',
    //                '</g_vml_:group>');

    //    this.element_.insertAdjacentHTML('BeforeEnd', vmlStr.join(''));
    //  };

    contextPrototype.stroke = function (aFill) {
      var lineStr = [];
      var lineOpen = false;

      var W = 10;
      var H = 10;

      lineStr.push('<g_vml_:shape',
                 ' filled="', !!aFill, '"',
                 ' style="position:absolute;width:', W, 'px;height:', H, 'px;"',
                 ' coordorigin="0,0"',
                 ' coordsize="', Z * W, ',', Z * H, '"',
                 ' stroked="', !aFill, '"',
                 ' path="');

      var newSeq = false;
      var min = { x: null, y: null };
      var max = { x: null, y: null };

      for (var i = 0; i < this.currentPath_.length; i++) {
        var p = this.currentPath_[i];
        var c;

        switch (p.type) {
          case 'moveTo':
            c = p;
            lineStr.push(' m ', mr(p.x), ',', mr(p.y));
            break;
          case 'lineTo':
            lineStr.push(' l ', mr(p.x), ',', mr(p.y));
            break;
          case 'close':
            lineStr.push(' x ');
            p = null;
            break;
          case 'bezierCurveTo':
            lineStr.push(' c ',
                       mr(p.cp1x), ',', mr(p.cp1y), ',',
                       mr(p.cp2x), ',', mr(p.cp2y), ',',
                       mr(p.x), ',', mr(p.y));
            break;
          case 'at':
          case 'wa':
            lineStr.push(' ', p.type, ' ',
                       mr(p.x - this.arcScaleX_ * p.radius), ',',
                       mr(p.y - this.arcScaleY_ * p.radius), ' ',
                       mr(p.x + this.arcScaleX_ * p.radius), ',',
                       mr(p.y + this.arcScaleY_ * p.radius), ' ',
                       mr(p.xStart), ',', mr(p.yStart), ' ',
                       mr(p.xEnd), ',', mr(p.yEnd));
            break;
        }


        // TODO: Following is broken for curves due to
        //       move to proper paths.

        // Figure out dimensions so we can do gradient fills
        // properly
        if (p) {
          if (min.x == null || p.x < min.x) {
            min.x = p.x;
          }
          if (max.x == null || p.x > max.x) {
            max.x = p.x;
          }
          if (min.y == null || p.y < min.y) {
            min.y = p.y;
          }
          if (max.y == null || p.y > max.y) {
            max.y = p.y;
          }
        }
      }
      lineStr.push(' ">');

      if (!aFill) {
        appendStroke(this, lineStr);
      } else {
        appendFill(this, lineStr, min, max);
      }

      lineStr.push('</g_vml_:shape>');

      this.element_.insertAdjacentHTML('beforeEnd', lineStr.join(''));
    };

    function appendStroke(ctx, lineStr) {
      var a = processStyle(ctx.strokeStyle);
      var color = a.color;
      var opacity = a.alpha * ctx.globalAlpha;
      var lineWidth = ctx.lineScale_ * ctx.lineWidth;

      // VML cannot correctly render a line if the width is less than 1px.
      // In that case, we dilute the color to make the line look thinner.
      if (lineWidth < 1) {
        opacity *= lineWidth;
      }

      lineStr.push(
      '<g_vml_:stroke',
      ' opacity="', opacity, '"',
      ' joinstyle="', ctx.lineJoin, '"',
      ' miterlimit="', ctx.miterLimit, '"',
      ' endcap="', processLineCap(ctx.lineCap), '"',
      ' weight="', lineWidth, 'px"',
      ' color="', color, '" />'
    );
    }

    function appendFill(ctx, lineStr, min, max) {
      var fillStyle = ctx.fillStyle;
      var arcScaleX = ctx.arcScaleX_;
      var arcScaleY = ctx.arcScaleY_;
      var width = max.x - min.x;
      var height = max.y - min.y;
      //    if (fillStyle instanceof CanvasGradient_) {
      //      // TODO: Gradients transformed with the transformation matrix.
      //      var angle = 0;
      //      var focus = {x: 0, y: 0};

      //      // additional offset
      //      var shift = 0;
      //      // scale factor for offset
      //      var expansion = 1;

      //      if (fillStyle.type_ == 'gradient') {
      //        var x0 = fillStyle.x0_ / arcScaleX;
      //        var y0 = fillStyle.y0_ / arcScaleY;
      //        var x1 = fillStyle.x1_ / arcScaleX;
      //        var y1 = fillStyle.y1_ / arcScaleY;
      //        var p0 = getCoords(ctx, x0, y0);
      //        var p1 = getCoords(ctx, x1, y1);
      //        var dx = p1.x - p0.x;
      //        var dy = p1.y - p0.y;
      //        angle = Math.atan2(dx, dy) * 180 / Math.PI;

      //        // The angle should be a non-negative number.
      //        if (angle < 0) {
      //          angle += 360;
      //        }

      //        // Very small angles produce an unexpected result because they are
      //        // converted to a scientific notation string.
      //        if (angle < 1e-6) {
      //          angle = 0;
      //        }
      //      } else {
      //        var p0 = getCoords(ctx, fillStyle.x0_, fillStyle.y0_);
      //        focus = {
      //          x: (p0.x - min.x) / width,
      //          y: (p0.y - min.y) / height
      //        };

      //        width  /= arcScaleX * Z;
      //        height /= arcScaleY * Z;
      //        var dimension = m.max(width, height);
      //        shift = 2 * fillStyle.r0_ / dimension;
      //        expansion = 2 * fillStyle.r1_ / dimension - shift;
      //      }

      //      // We need to sort the color stops in ascending order by offset,
      //      // otherwise IE won't interpret it correctly.
      //      var stops = fillStyle.colors_;
      //      stops.sort(function(cs1, cs2) {
      //        return cs1.offset - cs2.offset;
      //      });

      //      var length = stops.length;
      //      var color1 = stops[0].color;
      //      var color2 = stops[length - 1].color;
      //      var opacity1 = stops[0].alpha * ctx.globalAlpha;
      //      var opacity2 = stops[length - 1].alpha * ctx.globalAlpha;

      //      var colors = [];
      //      for (var i = 0; i < length; i++) {
      //        var stop = stops[i];
      //        colors.push(stop.offset * expansion + shift + ' ' + stop.color);
      //      }

      //      // When colors attribute is used, the meanings of opacity and o:opacity2
      //      // are reversed.
      //      lineStr.push('<g_vml_:fill type="', fillStyle.type_, '"',
      //                   ' method="none" focus="100%"',
      //                   ' color="', color1, '"',
      //                   ' color2="', color2, '"',
      //                   ' colors="', colors.join(','), '"',
      //                   ' opacity="', opacity2, '"',
      //                   ' g_o_:opacity2="', opacity1, '"',
      //                   ' angle="', angle, '"',
      //                   ' focusposition="', focus.x, ',', focus.y, '" />');
      //    } else if (fillStyle instanceof CanvasPattern_) {
      //      if (width && height) {
      //        var deltaLeft = -min.x;
      //        var deltaTop = -min.y;
      //        lineStr.push('<g_vml_:fill',
      //                     ' position="',
      //                     deltaLeft / width * arcScaleX * arcScaleX, ',',
      //                     deltaTop / height * arcScaleY * arcScaleY, '"',
      //                     ' type="tile"',
      //                     // TODO: Figure out the correct size to fit the scale.
      //                     //' size="', w, 'px ', h, 'px"',
      //                     ' src="', fillStyle.src_, '" />');
      //       }
      //    } else {
      var a = processStyle(ctx.fillStyle);
      var color = a.color;
      var opacity = a.alpha * ctx.globalAlpha;
      lineStr.push('<g_vml_:fill color="', color, '" opacity="', opacity,
                   '" />');
      //     }
    }

    contextPrototype.fill = function () {
      this.stroke(true);
    };

    contextPrototype.closePath = function () {
      this.currentPath_.push({ type: 'close' });
    };

    function getCoords(ctx, aX, aY) {
      var m = ctx.m_;
      return {
        x: Z * (aX * m[0][0] + aY * m[1][0] + m[2][0]) - Z2,
        y: Z * (aX * m[0][1] + aY * m[1][1] + m[2][1]) - Z2
      };
    };

    contextPrototype.save = function () {
      var o = {};
      copyState(this, o);
      this.aStack_.push(o);
      this.mStack_.push(this.m_);
      this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
    };

    contextPrototype.restore = function () {
      if (this.aStack_.length) {
        copyState(this.aStack_.pop(), this);
        this.m_ = this.mStack_.pop();
      }
    };

    function matrixIsFinite(m) {
      return isFinite(m[0][0]) && isFinite(m[0][1]) &&
        isFinite(m[1][0]) && isFinite(m[1][1]) &&
        isFinite(m[2][0]) && isFinite(m[2][1]);
    }

    function setM(ctx, m, updateLineScale) {
      if (!matrixIsFinite(m)) {
        return;
      }
      ctx.m_ = m;

      if (updateLineScale) {
        // Get the line scale.
        // Determinant of this.m_ means how much the area is enlarged by the
        // transformation. So its square root can be used as a scale factor
        // for width.
        var det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
        ctx.lineScale_ = sqrt(abs(det));
      }
    }

    contextPrototype.translate = function (aX, aY) {
      var m1 = [
      [1, 0, 0],
      [0, 1, 0],
      [aX, aY, 1]
    ];

      setM(this, matrixMultiply(m1, this.m_), false);
    };

    //  contextPrototype.rotate = function(aRot) {
    //    var c = mc(aRot);
    //    var s = ms(aRot);

    //    var m1 = [
    //      [c,  s, 0],
    //      [-s, c, 0],
    //      [0,  0, 1]
    //    ];

    //    setM(this, matrixMultiply(m1, this.m_), false);
    //  };

    contextPrototype.scale = function (aX, aY) {
      this.arcScaleX_ *= aX;
      this.arcScaleY_ *= aY;
      var m1 = [
      [aX, 0, 0],
      [0, aY, 0],
      [0, 0, 1]
    ];

      setM(this, matrixMultiply(m1, this.m_), true);
    };

    //  contextPrototype.transform = function(m11, m12, m21, m22, dx, dy) {
    //    var m1 = [
    //      [m11, m12, 0],
    //      [m21, m22, 0],
    //      [dx,  dy,  1]
    //    ];

    //    setM(this, matrixMultiply(m1, this.m_), true);
    //  };

    //  contextPrototype.setTransform = function(m11, m12, m21, m22, dx, dy) {
    //    var m = [
    //      [m11, m12, 0],
    //      [m21, m22, 0],
    //      [dx,  dy,  1]
    //    ];

    //    setM(this, m, true);
    //  };

    /**
    * The text drawing function.
    * The maxWidth argument isn't taken in account, since no browser supports
    * it yet.
    */
    //  contextPrototype.drawText_ = function(text, x, y, maxWidth, stroke) {
    //    var m = this.m_,
    //        delta = 1000,
    //        left = 0,
    //        right = delta,
    //        offset = {x: 0, y: 0},
    //        lineStr = [];

    //    var fontStyle = getComputedStyle(processFontStyle(this.font),
    //                                     this.element_);

    //    var fontStyleString = buildStyle(fontStyle);

    //    var elementStyle = this.element_.currentStyle;
    //    var textAlign = this.textAlign.toLowerCase();
    //    switch (textAlign) {
    //      case 'left':
    //      case 'center':
    //      case 'right':
    //        break;
    //      case 'end':
    //        textAlign = elementStyle.direction == 'ltr' ? 'right' : 'left';
    //        break;
    //      case 'start':
    //        textAlign = elementStyle.direction == 'rtl' ? 'right' : 'left';
    //        break;
    //      default:
    //        textAlign = 'left';
    //    }

    //    // 1.75 is an arbitrary number, as there is no info about the text baseline
    //    switch (this.textBaseline) {
    //      case 'hanging':
    //      case 'top':
    //        offset.y = fontStyle.size / 1.75;
    //        break;
    //      case 'middle':
    //        break;
    //      default:
    //      case null:
    //      case 'alphabetic':
    //      case 'ideographic':
    //      case 'bottom':
    //        offset.y = -fontStyle.size / 2.25;
    //        break;
    //    }

    //    switch(textAlign) {
    //      case 'right':
    //        left = delta;
    //        right = 0.05;
    //        break;
    //      case 'center':
    //        left = right = delta / 2;
    //        break;
    //    }

    //    var d = getCoords(this, x + offset.x, y + offset.y);

    //    lineStr.push('<g_vml_:line from="', -left ,' 0" to="', right ,' 0.05" ',
    //                 ' coordsize="100 100" coordorigin="0 0"',
    //                 ' filled="', !stroke, '" stroked="', !!stroke,
    //                 '" style="position:absolute;width:1px;height:1px;">');

    //    if (stroke) {
    //      appendStroke(this, lineStr);
    //    } else {
    //      // TODO: Fix the min and max params.
    //      appendFill(this, lineStr, {x: -left, y: 0},
    //                 {x: right, y: fontStyle.size});
    //    }

    //    var skewM = m[0][0].toFixed(3) + ',' + m[1][0].toFixed(3) + ',' +
    //                m[0][1].toFixed(3) + ',' + m[1][1].toFixed(3) + ',0,0';

    //    var skewOffset = mr(d.x / Z) + ',' + mr(d.y / Z);

    //    lineStr.push('<g_vml_:skew on="t" matrix="', skewM ,'" ',
    //                 ' offset="', skewOffset, '" origin="', left ,' 0" />',
    //                 '<g_vml_:path textpathok="true" />',
    //                 '<g_vml_:textpath on="true" string="',
    //                 encodeHtmlAttribute(text),
    //                 '" style="v-text-align:', textAlign,
    //                 ';font:', encodeHtmlAttribute(fontStyleString),
    //                 '" /></g_vml_:line>');

    //    this.element_.insertAdjacentHTML('beforeEnd', lineStr.join(''));
    //  };

    //  contextPrototype.fillText = function(text, x, y, maxWidth) {
    //    this.drawText_(text, x, y, maxWidth, false);
    //  };

    //  contextPrototype.strokeText = function(text, x, y, maxWidth) {
    //    this.drawText_(text, x, y, maxWidth, true);
    //  };

    //  contextPrototype.measureText = function(text) {
    //    if (!this.textMeasureEl_) {
    //      var s = '<span style="position:absolute;' +
    //          'top:-20000px;left:0;padding:0;margin:0;border:none;' +
    //          'white-space:pre;"></span>';
    //      this.element_.insertAdjacentHTML('beforeEnd', s);
    //      this.textMeasureEl_ = this.element_.lastChild;
    //    }
    //    var doc = this.element_.ownerDocument;
    //    this.textMeasureEl_.innerHTML = '';
    //    this.textMeasureEl_.style.font = this.font;
    //    // Don't use innerHTML or innerText because they allow markup/whitespace.
    //    this.textMeasureEl_.appendChild(doc.createTextNode(text));
    //    return {width: this.textMeasureEl_.offsetWidth};
    //  };

    /******** STUBS ********/
    //  contextPrototype.clip = function() {
    //    // TODO: Implement
    //  };

    //  contextPrototype.arcTo = function() {
    //    // TODO: Implement
    //  };

    //  contextPrototype.createPattern = function(image, repetition) {
    //    return new CanvasPattern_(image, repetition);
    //  };

    //  // Gradient / Pattern Stubs
    //  function CanvasGradient_(aType) {
    //    this.type_ = aType;
    //    this.x0_ = 0;
    //    this.y0_ = 0;
    //    this.r0_ = 0;
    //    this.x1_ = 0;
    //    this.y1_ = 0;
    //    this.r1_ = 0;
    //    this.colors_ = [];
    //  }

    //  CanvasGradient_.prototype.addColorStop = function(aOffset, aColor) {
    //    aColor = processStyle(aColor);
    //    this.colors_.push({offset: aOffset,
    //                       color: aColor.color,
    //                       alpha: aColor.alpha});
    //  };

    //  function CanvasPattern_(image, repetition) {
    //    assertImageIsValid(image);
    //    switch (repetition) {
    //      case 'repeat':
    //      case null:
    //      case '':
    //        this.repetition_ = 'repeat';
    //        break
    //      case 'repeat-x':
    //      case 'repeat-y':
    //      case 'no-repeat':
    //        this.repetition_ = repetition;
    //        break;
    //      default:
    //        throwException('SYNTAX_ERR');
    //    }

    //    this.src_ = image.src;
    //    this.width_ = image.width;
    //    this.height_ = image.height;
    //  }

    function throwException(s) {
      throw new DOMException_(s);
    }

    //  function assertImageIsValid(img) {
    //    if (!img || img.nodeType != 1 || img.tagName != 'IMG') {
    //      throwException('TYPE_MISMATCH_ERR');
    //    }
    //    if (img.readyState != 'complete') {
    //      throwException('INVALID_STATE_ERR');
    //    }
    //  }

    function DOMException_(s) {
      this.code = this[s];
      this.message = s + ': DOM Exception ' + this.code;
    }
    var p = DOMException_.prototype = new Error;
    p.INDEX_SIZE_ERR = 1;
    p.DOMSTRING_SIZE_ERR = 2;
    p.HIERARCHY_REQUEST_ERR = 3;
    p.WRONG_DOCUMENT_ERR = 4;
    p.INVALID_CHARACTER_ERR = 5;
    p.NO_DATA_ALLOWED_ERR = 6;
    p.NO_MODIFICATION_ALLOWED_ERR = 7;
    p.NOT_FOUND_ERR = 8;
    p.NOT_SUPPORTED_ERR = 9;
    p.INUSE_ATTRIBUTE_ERR = 10;
    p.INVALID_STATE_ERR = 11;
    p.SYNTAX_ERR = 12;
    p.INVALID_MODIFICATION_ERR = 13;
    p.NAMESPACE_ERR = 14;
    p.INVALID_ACCESS_ERR = 15;
    p.VALIDATION_ERR = 16;
    p.TYPE_MISMATCH_ERR = 17;

    // set up externs
    G_vmlCanvasManager = G_vmlCanvasManager_;
    CanvasRenderingContext2D = CanvasRenderingContext2D_;
    //CanvasGradient = CanvasGradient_;
    //CanvasPattern = CanvasPattern_;
    DOMException = DOMException_;
  })();

} // if

/*! JsRender v1.0pre: http://github.com/BorisMoore/jsrender */
/*
 * Optimized version of jQuery Templates, for rendering to string.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://github.com/BorisMoore/jsviews)
 * Copyright 2012, Boris Moore
 * Released under the MIT License.
 */
// informal pre beta commit counter: 3

this.jsviews || this.jQuery && jQuery.views || (function( window, undefined ) {

//========================== Top-level vars ==========================

var versionNumber = "v1.0pre",

	$, rTag, rTmplString, extend,
	sub = {},
	FALSE = false, TRUE = true,
	jQuery = window.jQuery,

	rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
	//                                 nil    object   helper    view  viewProperty pathTokens   leafToken     string

	rParams = /(\()(?=|\s*\()|(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
	//          lftPrn        lftPrn2                path    operator err                                                eq         path2       prn    comma   lftPrn2   apos quot        rtPrn   prn2   space
	// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space

    rNewLine = /\r?\n/g,
	rUnescapeQuotes = /\\(['"])/g,
	rEscapeQuotes = /\\?(['"])/g,
	rBuildHash = /\x08(~)?([^\x08]+)\x08/g,

	autoViewKey = 0,
	autoTmplName = 0,
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	tmplAttr = "data-jsv-tmpl",
	fnDeclStr = "var j=j||" + (jQuery ? "jQuery." : "js") + "views,",
	htmlSpecialChar = /[\x00"&'<>]/g,
	slice = Array.prototype.slice,

	render = {},

	// jsviews object ($.views if jQuery is loaded)
	jsv = {
		jsviews: versionNumber,
		sub: sub, // subscription, e.g. JsViews integration
		debugMode: TRUE,
		err: function( e ) {
			return jsv.debugMode ? ("<br/><b>Error:</b> <em> " + (e.message || e) + ". </em>") : '""';
		},
		tmplFn: tmplFn,
		render: render,
		templates: templates,
		tags: tags,
		helpers: helpers,
		converters: converters,
		View: View,
		convert: convert,
		delimiters: setDelimiters,
		tag: renderTag
	};

//========================== Top-level functions ==========================

//===================
// jsviews.delimiters
//===================

function setDelimiters( openChars, closeChars ) {
	// Set the tag opening and closing delimiters. Default is "{{" and "}}"
	// openChar, closeChars: opening and closing strings, each with two characters
	var firstOpenChar = "\\" + openChars.charAt( 0 ), // Escape the characters - since they could be regex special characters
		secondOpenChar = "\\" + openChars.charAt( 1 ),
		firstCloseChar = "\\" + closeChars.charAt( 0 ),
		secondCloseChar = "\\" + closeChars.charAt( 1 );
	// Build regex with new delimiters
	jsv.rTag = rTag // make rTag available to JsViews (or other components) for parsing binding expressions
		= secondOpenChar
			//          tag    (followed by / space or })   or  colon     or  html or code
		+ "(?:(?:(\\w+(?=[\\/\\s" + firstCloseChar + "]))|(?:(\\w+)?(:)|(>)|(\\*)))"
		//     params
		+ "\\s*((?:[^" + firstCloseChar + "]|" + firstCloseChar + "(?!" + secondCloseChar + "))*?)"
		//  slash or closeBlock
		+ "(\\/)?|(?:\\/(\\w+)))"
	//  }}
	+ firstCloseChar;

	// Default rTag:    tag          converter colon  html  code     params         slash   closeBlock
	//	    /{{(?:(?:(\w+(?=[\/\s\}]))|(?:(\w+)?(:)|(>)|(\*)))\s*((?:[^}]|}(?!\}))*?)(\/)?|(?:\/(\w+)))}}

	//      /{{(?:(?:(\w+(?=[\/!\s\}!]))|(?:(\w+)?(:)|(>)|(\*)))((?:[^\}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}/g;
	rTag = new RegExp( firstOpenChar + rTag + secondCloseChar, "g" );
	rTmplString = new RegExp( "<.*>|" + openChars + ".*" + closeChars );
	return this;
}

//=================
// View.hlp
//=================

function getHelper( helper ) {
	// Helper method called as view.hlp() from compiled template, for helper functions or template parameters ~foo
	var view = this,
	tmplHelpers = view.tmpl.helpers || {};
	helper = (view.ctx[ helper ] !== undefined ? view.ctx : tmplHelpers[ helper ] !== undefined ? tmplHelpers : helpers[ helper ] !== undefined ? helpers : {})[ helper ];
	return typeof helper !== "function" ? helper : function() {
		return helper.apply(view, arguments);
	};
}

//=================
// jsviews.convert
//=================

function convert( converter, view, text ) {
	var tmplConverters = view.tmpl.converters;
	converter = tmplConverters && tmplConverters[ converter ] || converters[ converter ];
	return converter ? converter.call( view, text ) : text;
}

//=================
// jsviews.tag
//=================

function renderTag( tag, parentView, converter, content, tagObject ) {
	// Called from within compiled template function, to render a nested tag
	// Returns the rendered tag
	tagObject.props = tagObject.props || {};
	var ret,
		tmpl = tagObject.props.tmpl,
		tmplTags = parentView.tmpl.tags,
		nestedTemplates = parentView.tmpl.templates,
		args = arguments,
		tagFn = tmplTags && tmplTags[ tag ] || tags[ tag ];

	if ( !tagFn ) {
		return "";
	}
	// Set the tmpl property to the content of the block tag, unless set as an override property on the tag
	content = content && parentView.tmpl.tmpls[ content - 1 ];
	tmpl = tmpl || content || undefined;
	tagObject.tmpl =
		"" + tmpl === tmpl // if a string
			? nestedTemplates && nestedTemplates[ tmpl ] || templates[ tmpl ] || templates( tmpl )
			: tmpl;

	tagObject.isTag = TRUE;
	tagObject.converter = converter;
	tagObject.view = parentView;
	tagObject.renderContent = renderContent;
	if ( parentView.ctx ) {
		extend( tagObject.ctx, parentView.ctx);
	}

	ret = tagFn.apply( tagObject, args.length > 5 ? slice.call( args, 5 ) : [] );
	return ret || ( ret == undefined ? "" : ret.toString()); // (If ret is the value 0 or false, will render to string)
}

//=================
// View constructor
//=================

function View( context, path, parentView, data, template, index ) {
	// Constructor for view object in view hierarchy. (Augmented by JsViews if JsViews is loaded)
	var views = parentView.views,
//	TODO: add this, as part of smart re-linking on existing content ($.link method), or remove completely
//			self = parentView.views[ index ];
//			if ( !self ) { ... }
		self = {
			tmpl: template,
			path: path,
			parent: parentView,
			data: data,
			ctx: context,
			views: $.isArray( data ) ? [] : {},
			hlp: getHelper
		};

	if ( $.isArray( views ))  {
		views.splice(
			self.index = index !== undefined
				? index
				: views.length, 0, self
		);
	} else {
		views[ self.index = "_" + autoViewKey++ ] = self;
	}
	return self;
}

//=================
// Registration
//=================

function addToStore( self, store, name, item, process ) {
	// Add item to named store such as templates, helpers, converters...
	var key, onStore;
	if ( name && typeof name === "object" && !name.nodeType ) {
		// If name is a map, iterate over map and call store for key
		for ( key in name ) {
			store( key, name[ key ]);
		}
		return self;
	}
	if ( !name || item === undefined ) {
		if ( process ) {
			item = process( undefined, item || name );
		}
	} else if ( "" + name === name ) { // name must be a string
		if ( item === null ) {
			// If item is null, delete this entry
			delete store[name];
		} else if ( item = process ? process( name, item ) : item ) {
			store[ name ] = item;
		}
	}
	if ( onStore = sub.onStoreItem ) {
		// e.g. JsViews integration
		onStore( store, name, item, process );
	}
	return item;
}

function templates( name, tmpl ) {
	// Register templates
	// Setter: Use $.view.tags( name, tagFn ) or $.view.tags({ name: tagFn, ... }) to add additional tags to the registered tags collection.
	// Getter: Use var tagFn = $.views.tags( name ) or $.views.tags[name] or $.views.tags.name to return the function for the registered tag.
	// Remove: Use $.view.tags( name, null ) to remove a registered tag from $.view.tags.

	// When registering for {{foo a b c==d e=f}}, tagFn should be a function with the signature:
	// function(a,b). The 'this' pointer will be a hash with properties c and e.
	return addToStore( this, templates, name, tmpl, compile );
}

function tags( name, tagFn ) {
	// Register template tags
	// Setter: Use $.view.tags( name, tagFn ) or $.view.tags({ name: tagFn, ... }) to add additional tags to the registered tags collection.
	// Getter: Use var tagFn = $.views.tags( name ) or $.views.tags[name] or $.views.tags.name to return the function for the registered tag.
	// Remove: Use $.view.tags( name, null ) to remove a registered tag from $.view.tags.

	// When registering for {{foo a b c==d e=f}}, tagFn should be a function with the signature:
	// function(a,b). The 'this' pointer will be a hash with properties c and e.
	return addToStore( this, tags, name, tagFn );
}

function helpers( name, helperFn ) {
	// Register helper functions for use in templates (or in data-link expressions if JsViews is loaded)
	// Setter: Use $.view.helpers( name, helperFn ) or $.view.helpers({ name: helperFn, ... }) to add additional helpers to the registered helpers collection.
	// Getter: Use var helperFn = $.views.helpers( name ) or $.views.helpers[name] or $.views.helpers.name to return the function.
	// Remove: Use $.view.helpers( name, null ) to remove a registered helper function from $.view.helpers.
	// Within a template, access the helper using the syntax: {{... ~myHelper(...) ...}}.
	return addToStore( this, helpers, name, helperFn );
}

function converters( name, converterFn ) {
	// Register converter functions for use in templates (or in data-link expressions if JsViews is loaded)
	// Setter: Use $.view.converters( name, converterFn ) or $.view.converters({ name: converterFn, ... }) to add additional converters to the registered converters collection.
	// Getter: Use var converterFn = $.views.converters( name ) or $.views.converters[name] or $.views.converters.name to return the converter function.
	// Remove: Use $.view.converters( name, null ) to remove a registered converter from $.view.converters.
	// Within a template, access the converter using the syntax: {{myConverter:...}}.
	return addToStore( this, converters, name, converterFn );
}

//=================
// renderContent
//=================

function renderContent( data, context, parentView, path, index ) {
	// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
	// tagName parameter for internal use only. Used for rendering templates registered as tags (which may have associated presenter objects)
	var i, l, dataItem, newView, itemWrap, itemsWrap, itemResult, parentContext, tmpl, layout,
		props = {},
		swapContent = index === TRUE,
		self = this,
		result = "";

	if ( self.isTag ) {
		// This is a call from renderTag
		tmpl = self.tmpl;
		context = context || self.ctx;
		parentView = parentView || self.view;
		path = path || self.path;
		index = index || self.index;
		props = self.props;
	} else {
		tmpl = self.jquery && self[0] // This is a call $.fn.render
			|| self; // This is a call from tmpl.render
	}
	parentView = parentView || jsv.topView;
	parentContext = parentView.ctx;
	layout = tmpl.layout;
	if ( data === parentView ) {
		// Inherit the data from the parent view.
		// This may be the contents of an {{if}} block
		data = parentView.data;
		layout = TRUE;
	}

	// Set additional context on views created here, (as modified context inherited from the parent, and be inherited by child views)
	// Note: If no jQuery, extend does not support chained copies - so limit extend() to two parameters
	context = (context && context === parentContext)
		? parentContext
		: (parentContext
			// if parentContext, make copy
			? ((parentContext = extend( {}, parentContext ), context)
				// If context, merge context with copied parentContext
				? extend( parentContext, context )
				: parentContext)
			// if no parentContext, use context, or default to {}
			: context || {});

	if ( props.link === FALSE ) {
		// Override inherited value of link by an explicit setting in props: link=false
		// The child views of an unlinked view are also unlinked. So setting child back to true will not have any effect.
		context.link = FALSE;
	}
	if ( !tmpl.fn ) {
		tmpl = templates[ tmpl ] || templates( tmpl );
	}
	itemWrap = context.link && sub.onRenderItem;
	itemsWrap = context.link && sub.onRenderItems;

	if ( tmpl ) {
		if ( $.isArray( data ) && !layout ) {
			// Create a view for the array, whose child views correspond to each data item.
			// (Note: if index and parentView are passed in along with parent view, treat as
			// insert -e.g. from view.addViews - so parentView is already the view item for array)
			newView = swapContent ? parentView : (index !== undefined && parentView) || View( context, path, parentView, data, tmpl, index );

			for ( i = 0, l = data.length; i < l; i++ ) {
				// Create a view for each data item.
				dataItem = data[ i ];
				itemResult = tmpl.fn( dataItem, View( context, path, newView, dataItem, tmpl, (index||0) + i ), jsv );
				result += itemWrap ? itemWrap( itemResult, props ) : itemResult;
			}
		} else {
			// Create a view for singleton data object.
			newView = swapContent ? parentView : View( context, path, parentView, data, tmpl, index );
			result += (data || layout) ? tmpl.fn( data, newView, jsv ) : "";
		}
		parentView.topKey = newView.index;
		return itemsWrap ? itemsWrap( result, path, newView.index, tmpl, props ) : result;
	}
	return ""; // No tmpl. Could throw...
}

//===========================
// Build and compile template
//===========================

// Generate a reusable function that will serve to render a template against data
// (Compile AST then build template function)

function syntaxError() {
	throw "Syntax error";
}

function tmplFn( markup, tmpl, bind ) {
	// Compile markup to AST (abtract syntax tree) then build the template function code from the AST nodes
	// Used for compiling templates, and also by JsViews to build functions for data link expressions
	var newNode, node, i, l, code, hasTag, hasEncoder, getsValue, hasConverter, hasViewPath, tag, converter, params, hash, nestedTmpl, allowCode,
		tmplOptions = tmpl ? {
			allowCode: allowCode = tmpl.allowCode,
			debug: tmpl.debug
		} : {},
		nested = tmpl && tmpl.tmpls,
		astTop = [],
		loc = 0,
		stack = [],
		content = astTop,
		current = [,,,astTop],
		nestedIndex = 0;

	//==== nested functions ====
	function pushPreceedingContent( shift ) {
		shift -= loc;
		if ( shift ) {
			content.push( markup.substr( loc, shift ).replace( rNewLine, "\\n" ));
		}
	}

	function parseTag( all, tagName, converter, colon, html, code, params, slash, closeBlock, index ) {
		//                  tag           converter colon  html  code     params         slash   closeBlock
		//      /{{(?:(?:(\w+(?=[\/!\s\}!]))|(?:(\w+)?(:)|(?:(>)|(\*)))((?:[^\}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}/g;
		// Build abstract syntax tree (AST): [ tagName, converter, params, content, hash, contentMarkup ]
		if ( html ) {
			colon = ":";
			converter = "html";
		}
		var hash = "",
			passedCtx = "",
			block = !slash && !colon; // Block tag if not self-closing and not {{:}} or {{>}} (special case)

		//==== nested helper function ====

		tagName = tagName || colon;
		pushPreceedingContent( index );
		loc = index + all.length; // location marker - parsed up to here
		if ( code ) {
			if ( allowCode ) {
				content.push([ "*", params.replace( rUnescapeQuotes, "$1" ) ]);
			}
		} else if ( tagName ) {
			if ( tagName === "else" ) {
				current[ 5 ] = markup.substring( current[ 5 ], index ); // contentMarkup for block tag
				current = stack.pop();
				content = current[ 3 ];
				block = TRUE;
			}
			params = (params
				? parseParams( params, bind )
					.replace( rBuildHash, function( all, isCtx, keyValue ) {
						if ( isCtx ) {
							passedCtx += keyValue + ",";
						} else {
							hash += keyValue + ",";
						}
						return "";
					})
				: "");
			hash = hash.slice( 0, -1 );
			params = params.slice( 0, -1 );
			newNode = [
				tagName,
				converter || "",
				params,
				block && [],
				"{" + (hash ? ("props:{" + hash + "},"): "") + "path:'" + params + "'" + (passedCtx ? ",ctx:{" + passedCtx.slice( 0, -1 ) + "}" : "") + "}"
			];
			if ( block ) {
				stack.push( current );
				current = newNode;
				current[ 5 ] = loc; // Store current location of open tag, to be able to add contentMarkup when we reach closing tag
			}
			content.push( newNode );
		} else if ( closeBlock ) {
			//if ( closeBlock !== current[ 0 ]) {
			//	throw "unmatched close tag: /" + closeBlock + ". Expected /" + current[ 0 ];
			//}
			current[ 5 ] = markup.substring( current[ 5 ], index ); // contentMarkup for block tag
			current = stack.pop();
		}
		if ( !current ) {
			throw "Expected block tag";
		}
		content = current[ 3 ];
	}
	//==== /end of nested functions ====

	markup = markup.replace( rEscapeQuotes, "\\$1" );

	// Build the AST (abstract syntax tree) under astTop
	markup.replace( rTag, parseTag );

	pushPreceedingContent( markup.length );

	// Use the AST (astTop) to build the template function
	l = astTop.length;
	code = (l ? "" : '"";');

	for ( i = 0; i < l; i++ ) {
		// AST nodes: [ tagName, converter, params, content, hash, contentMarkup ]
		node = astTop[ i ];
		if ( node[ 0 ] === "*" ) {
			code = code.slice( 0, i ? -1 : -3 ) + ";" + node[ 1 ] + (i + 1 < l ? "ret+=" : "");
		} else if ( "" + node === node ) { // type string
			code += '"' + node + '"+';
		} else {
			tag = node[ 0 ];
			converter = node[ 1 ];
			params = node[ 2 ];
			content = node[ 3 ];
			hash = node[ 4 ];
			markup = node[ 5 ];
			if ( content ) {
				// Create template object for nested template
				nestedTmpl = TmplObject( markup, tmplOptions, tmpl, nestedIndex++ );
				// Compile to AST and then to compiled function
				tmplFn( markup, nestedTmpl);
				nested.push( nestedTmpl );
			}
			hasViewPath = hasViewPath || hash.indexOf( "view" ) > -1;
			code += (tag === ":"
				? (converter === "html"
					? (hasEncoder = TRUE, "e(" + params)
					: converter
						? (hasConverter = TRUE, 'c("' + converter + '",view,' + params)
						: (getsValue = TRUE, "((v=" + params + ')!=u?v:""')
				)
				: (hasTag = TRUE, 't("' + tag + '",view,"' + (converter || "") + '",'
					+ (content ? nested.length : '""') // For block tags, pass in the key (nested.length) to the nested content template
					+ "," + hash + (params ? "," : "") + params))
					+ ")+";
		}
	}
	code =  new Function( "data, view, j, b, u", fnDeclStr
		+ (getsValue ? "v," : "")
		+ (hasTag ? "t=j.tag," : "")
		+ (hasConverter ? "c=j.convert," : "")
		+ (hasEncoder ? "e=j.converters.html," : "")
		+ "ret; try{\n\n"
		+ (tmplOptions.debug ? "debugger;" : "")
		+ (allowCode ? 'ret=' : 'return ')
		+ code.slice( 0, -1 ) + ";\n\n"
		+ (allowCode ? "return ret;" : "")
		+ "}catch(e){return j.err(e);}"
	);

	// Include only the var references that are needed in the code
	if ( tmpl ) {
		tmpl.fn = code;
		tmpl.useVw = hasConverter || hasViewPath || hasTag;
	}
	return code;
}

function parseParams( params, bind ) {
	var named,
		fnCall = {},
		parenDepth = 0,
		quoted = FALSE, // boolean for string content in double quotes
		aposed = FALSE; // or in single quotes

	function parseTokens( all, lftPrn0, lftPrn, path, operator, err, eq, path2, prn, comma, lftPrn2, apos, quot, rtPrn, prn2, space ) {
		// rParams = /(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
		//            lftPrn                  path    operator err                                                eq         path2       prn    comma   lftPrn3   apos quot        rtPrn   prn2   space
		// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space
		operator = operator || "";
		lftPrn = lftPrn || lftPrn0 || lftPrn2;
		path = path || path2;
		prn = prn || prn2 || "";
		operator = operator || "";

		function parsePath( all, object, helper, view, viewProperty, pathTokens, leafToken ) {
		// rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
		//                                        object   helper    view  viewProperty pathTokens   leafToken     string
			if ( object ) {
				var ret = (helper
					? 'view.hlp("' + helper + '")'
					: view
						? "view"
						: "data")
				+ (leafToken
					? (viewProperty
						? "." + viewProperty
						: helper
							? ""
							: (view ? "" : "." + object)
						) + (pathTokens || "")
					: (leafToken = helper ? "" : view ? viewProperty || "" : object, ""));

				if ( bind && prn !== "(" ) {
					ret = "b(" + ret + ',"' + leafToken + '")';
				}
				return ret + (leafToken ? "." + leafToken : "");
			}
			return all;
		}

		if ( err ) {
			syntaxError();
		} else {
			return (aposed
				// within single-quoted string
				? (aposed = !apos, (aposed ? all : '"'))
				: quoted
					// within double-quoted string
					? (quoted = !quot, (quoted ? all : '"'))
					:
				(
					(lftPrn
							? (parenDepth++, lftPrn)
							: "")
					+ (space
						? (parenDepth
							? ""
							: named
								? (named = FALSE, "\b")
								: ","
						)
						: eq
							// named param
							? (parenDepth && syntaxError(), named = TRUE, '\b' + path + ':')
							: path
								// path
								? (path.replace( rPath, parsePath )
									+ (prn
										? (fnCall[ ++parenDepth ] = TRUE, prn)
										: operator)
								)
								: operator
									? all
									: rtPrn
										// function
										? ((fnCall[ parenDepth-- ] = FALSE, rtPrn)
											+ (prn
												? (fnCall[ ++parenDepth ] = TRUE, prn)
												: "")
										)
										: comma
											? (fnCall[ parenDepth ] || syntaxError(), ",") // We don't allow top-level literal arrays or objects
											: lftPrn0
												? ""
												: (aposed = apos, quoted = quot, '"')
				))
			);
		}
	}
	params = (params + " " ).replace( rParams, parseTokens );
	return params;
}

function compile( name, tmpl, parent, options ) {
	// tmpl is either a template object, a selector for a template script block, the name of a compiled template, or a template object
	// options is the set of template properties, c
	var tmplOrMarkup, elem, key, nested, nestedItem;

	//==== nested functions ====
	function tmplOrMarkupFromStr( value ) {
		// If value is of type string - treat as selector, or name of compiled template
		// Return the template object, if already compiled, or the markup string

		if ( ("" + value === value) || value.nodeType > 0 ) {
			// If selector is valid and returns at least one element, get first element
			elem = value.nodeType > 0 ? value : !rTmplString.test( value ) && jQuery && jQuery( value )[0];
			if ( elem && elem.type ) {
				// It is a script element
				// Create a name for data linking if none provided
				value = templates[ elem.getAttribute( tmplAttr )];
				if ( !value ) {
					// Not already compiled and cached, so compile and cache the name
					name = name || "_" + autoTmplName++;
					elem.setAttribute( tmplAttr, name );
					value = compile( name, elem.innerHTML, parent, options ); // Use tmpl as options
					templates[ name ] = value;
				}
			}
			return value;
		}
		// If value is not a string or dom element, return undefined
	}

	//==== Compile the template ====
	tmplOrMarkup = tmplOrMarkupFromStr( tmpl );

	// If tmpl is a template object, use it for options
	options = options || (tmpl.markup ? tmpl : {});
	options.name = name;
	nested = options.templates;

	// If tmpl is not a markup string or a selector string, then it must be a template object
	// In that case, get it from the markup property of the object
	if ( !tmplOrMarkup && tmpl.markup && (tmplOrMarkup = tmplOrMarkupFromStr( tmpl.markup ))) {
		if ( tmplOrMarkup.fn && (tmplOrMarkup.debug !== tmpl.debug || tmplOrMarkup.allowCode !== tmpl.allowCode )) {
			// if the string references a compiled template object, but the debug or allowCode props are different, need to recompile
			tmplOrMarkup = tmplOrMarkup.markup;
		}
	}
	if ( tmplOrMarkup !== undefined ) {
		if ( name && !parent ) {
			render[ name ] = function() {
				return tmpl.render.apply( tmpl, arguments );
			};
		}
		if ( tmplOrMarkup.fn || tmpl.fn ) {
			// tmpl is already compiled, so use it, or if different name is provided, clone it
			if ( tmplOrMarkup.fn ) {
				if ( name && name !== tmplOrMarkup.name ) {
					tmpl = extend( extend( {}, tmplOrMarkup ), options);
				} else {
					tmpl = tmplOrMarkup;
				}
			}
		} else {
			// tmplOrMarkup is a markup string, not a compiled template
			// Create template object
			tmpl = TmplObject( tmplOrMarkup, options, parent, 0 );
			// Compile to AST and then to compiled function
			tmplFn( tmplOrMarkup, tmpl );
		}
		for ( key in nested ) {
			// compile nested template declarations
			nestedItem = nested[ key ];
			if ( nestedItem.name !== key ) {
				nested[ key ] = compile( key, nestedItem, tmpl );
			}
		}
		return tmpl;
	}
}
//==== /end of function compile ====

function TmplObject( markup, options, parent, index ) {
	// Template object constructor

	// nested helper function
	function extendStore( storeName ) {
		if ( parent[ storeName ]) {
			// Include parent items except if overridden by item of same name in options
			tmpl[ storeName ] = extend( extend( {}, parent[ storeName ] ), options[ storeName ] );
		}
	}

	options = options || {};
	var tmpl = {
			markup: markup,
			tmpls: [],
			links: [],
			render: renderContent
		};
	if ( parent ) {
		if ( parent.templates ) {
			tmpl.templates = extend( extend( {}, parent.templates ), options.templates );
		}
		tmpl.parent = parent;
		tmpl.name = parent.name + "[" + index + "]";
		tmpl.index = index;
	}

	extend( tmpl, options );
	if ( parent ) {
		extendStore( "templates" );
		extendStore( "tags" );
		extendStore( "helpers" );
		extendStore( "converters" );
	}
	return tmpl;
}

//========================== Initialize ==========================

if ( jQuery ) {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is loaded, so make $ the jQuery object
	$ = jQuery;
	$.templates = templates;
	$.render = render;
	$.views = jsv;
	$.fn.render = renderContent;

} else {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is not loaded.

	$ = window.jsviews = jsv;
	$.extend = function( target, source ) {
		var name;
		target =  target || {};
		for ( name in source ) {
			target[ name ] = source[ name ];
		}
		return target;
	};

	$.isArray = Array && Array.isArray || function( obj ) {
		return Object.prototype.toString.call( obj ) === "[object Array]";
	};
}

extend = $.extend;

jsv.topView = { views: {}, tmpl: {}, hlp: getHelper, ctx: jsv.helpers };

function replacerForHtml( ch ) {
	// Original code from Mike Samuel <msamuel@google.com>
	return escapeMapForHtml[ ch ]
		// Intentional assignment that caches the result of encoding ch.
		|| (escapeMapForHtml[ ch ] = "&#" + ch.charCodeAt( 0 ) + ";");
}

//========================== Register tags ==========================

tags({
	"if": function() {
		var ifTag = this,
			view = ifTag.view;

		view.onElse = function( tagObject, args ) {
			var i = 0,
				l = args.length;

			while ( l && !args[ i++ ]) {
				// Only render content if args.length === 0 (i.e. this is an else with no condition) or if a condition argument is truey
				if ( i === l ) {
					return "";
				}
			}
			view.onElse = undefined; // If condition satisfied, so won't run 'else'.
			tagObject.path = "";
			return tagObject.renderContent( view );
			// Test is satisfied, so render content, while remaining in current data context
			// By passing the view, we inherit data context from the parent view, and the content is treated as a layout template
			// (so if the data is an array, it will not iterate over the data
		};
		return view.onElse( this, arguments );
	},
	"else": function() {
		var view = this.view;
		return view.onElse ? view.onElse( this, arguments ) : "";
	},
	"for": function() {
		var i,
			self = this,
			result = "",
			args = arguments,
			l = args.length;
		if ( self.props.layout ) {
			self.tmpl.layout = TRUE;
		}
		for ( i = 0; i < l; i++ ) {
			result += self.renderContent( args[ i ]);
		}
		return result;
	},
	"=": function( value ) {
		return value;
	},
	"*": function( value ) {
		return value;
	}
});

//========================== Register global helpers ==========================

//	helpers({ // Global helper functions
//		// TODO add any useful built-in helper functions
//	});

//========================== Register converters ==========================

converters({
	html: function( text ) {
		// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
		// inspired by Mike Samuel <msamuel@google.com>
		return text != undefined ? String( text ).replace( htmlSpecialChar, replacerForHtml ) : "";
	}
});

//========================== Define default delimiters ==========================
setDelimiters( "{{", "}}" );

})( this );

/*! Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 * 
 * Requires: 1.2.2+
 */

(function($) {

var types = ['DOMMouseScroll', 'mousewheel'];

if ($.event.fixHooks) {
    for ( var i=types.length; i; ) {
        $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
    }
}

$.event.special.mousewheel = {
    setup: function() {
        if ( this.addEventListener ) {
            for ( var i=types.length; i; ) {
                this.addEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = handler;
        }
    },
    
    teardown: function() {
        if ( this.removeEventListener ) {
            for ( var i=types.length; i; ) {
                this.removeEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = null;
        }
    }
};

$.fn.extend({
    mousewheel: function(fn) {
        return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
    },
    
    unmousewheel: function(fn) {
        return this.unbind("mousewheel", fn);
    }
});


function handler(event) {
    var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, returnValue = true, deltaX = 0, deltaY = 0;
    event = $.event.fix(orgEvent);
    event.type = "mousewheel";
    
    // Old school scrollwheel delta
    if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
    if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }
    
    // New school multidimensional scroll (touchpads) deltas
    deltaY = delta;
    
    // Gecko
    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
        deltaY = 0;
        deltaX = -1*delta;
    }
    
    // Webkit
    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
    
    // Add event and delta to the front of the arguments
    args.unshift(event, delta, deltaX, deltaY);
    
    return ($.event.dispatch || $.event.handle).apply(this, args);
}

})(jQuery);

/*!
 * jQuery UI Widget 1.8.18
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Widget
 */

if ( ! $.widget ) {

(function( $, undefined ) {

// jQuery 1.4+
if ( $.cleanData ) {
	var _cleanData = $.cleanData;
	$.cleanData = function( elems ) {
		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			try {
				$( elem ).triggerHandler( "remove" );
			// http://bugs.jquery.com/ticket/8235
			} catch( e ) {}
		}
		_cleanData( elems );
	};
} else {
	var _remove = $.fn.remove;
	$.fn.remove = function( selector, keepData ) {
		return this.each(function() {
			if ( !keepData ) {
				if ( !selector || $.filter( selector, [ this ] ).length ) {
					$( "*", this ).add( [ this ] ).each(function() {
						try {
							$( this ).triggerHandler( "remove" );
						// http://bugs.jquery.com/ticket/8235
						} catch( e ) {}
					});
				}
			}
			return _remove.call( $(this), selector, keepData );
		});
	};
}

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
	$[ namespace ][ name ] = function( options, element ) {
		// allow instantiation without initializing for simple inheritance
		if ( arguments.length ) {
			this._createWidget( options, element );
		}
	};

	var basePrototype = new base();
	// we need to make the options hash a property directly on the new instance
	// otherwise we'll modify the options hash on the prototype that we're
	// inheriting from
//	$.each( basePrototype, function( key, val ) {
//		if ( $.isPlainObject(val) ) {
//			basePrototype[ key ] = $.extend( {}, val );
//		}
//	});
	basePrototype.options = $.extend( true, {}, basePrototype.options );
	$[ namespace ][ name ].prototype = $.extend( true, basePrototype, {
		namespace: namespace,
		widgetName: name,
		widgetEventPrefix: $[ namespace ][ name ].prototype.widgetEventPrefix || name,
		widgetBaseClass: fullName
	}, prototype );

	$.widget.bridge( name, $[ namespace ][ name ] );
};

$.widget.bridge = function( name, object ) {
	$.fn[ name ] = function( options ) {
		var isMethodCall = typeof options === "string",
			args = Array.prototype.slice.call( arguments, 1 ),
			returnValue = this;

		// allow multiple hashes to be passed on init
		options = !isMethodCall && args.length ?
			$.extend.apply( null, [ true, options ].concat(args) ) :
			options;

		// prevent calls to internal methods
		if ( isMethodCall && options.charAt( 0 ) === "_" ) {
			return returnValue;
		}

		if ( isMethodCall ) {
			this.each(function() {
				var instance = $.data( this, name ),
					methodValue = instance && $.isFunction( instance[options] ) ?
						instance[ options ].apply( instance, args ) :
						instance;
				// TODO: add this back in 1.9 and use $.error() (see #5972)
//				if ( !instance ) {
//					throw "cannot call methods on " + name + " prior to initialization; " +
//						"attempted to call method '" + options + "'";
//				}
//				if ( !$.isFunction( instance[options] ) ) {
//					throw "no such method '" + options + "' for " + name + " widget instance";
//				}
//				var methodValue = instance[ options ].apply( instance, args );
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
					$.data( this, name, new object( options, this ) );
				}
			});
		}

		return returnValue;
	};
};

$.Widget = function( options, element ) {
	// allow instantiation without initializing for simple inheritance
	if ( arguments.length ) {
		this._createWidget( options, element );
	}
};

$.Widget.prototype = {
	widgetName: "widget",
	widgetEventPrefix: "",
	options: {
		disabled: false
	},
	_createWidget: function( options, element ) {
		// $.widget.bridge stores the plugin instance, but we do it anyway
		// so that it's stored even before the _create function runs
		$.data( element, this.widgetName, this );
		this.element = $( element );
		this.options = $.extend( true, {},
			this.options,
			this._getCreateOptions(),
			options );

		var self = this;
		this.element.bind( "remove." + this.widgetName, function() {
			self.destroy();
		});

		this._create();
		this._trigger( "create" );
		this._init();
	},
	_getCreateOptions: function() {
		return $.metadata && $.metadata.get( this.element[0] )[ this.widgetName ];
	},
	_create: function() {},
	_init: function() {},

	destroy: function() {
		this.element
			.unbind( "." + this.widgetName )
			.removeData( this.widgetName );
		this.widget()
			.unbind( "." + this.widgetName )
			.removeAttr( "aria-disabled" )
			.removeClass(
				this.widgetBaseClass + "-disabled " +
				"ui-state-disabled" );
	},

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
				[ value ? "addClass" : "removeClass"](
					this.widgetBaseClass + "-disabled" + " " +
					"ui-state-disabled" )
				.attr( "aria-disabled", value );
		}

		return this;
	},

	enable: function() {
		return this._setOption( "disabled", false );
	},
	disable: function() {
		return this._setOption( "disabled", true );
	},

	_trigger: function( type, event, data ) {
		var prop, orig,
			callback = this.options[ type ];

		data = data || {};
		event = $.Event( event );
		event.type = ( type === this.widgetEventPrefix ?
			type :
			this.widgetEventPrefix + type ).toLowerCase();
		// the original event may come from any element
		// so we need to reset the target on the new event
		event.target = this.element[ 0 ];

		// copy original event properties over to the new event
		orig = event.originalEvent;
		if ( orig ) {
			for ( prop in orig ) {
				if ( !( prop in event ) ) {
					event[ prop ] = orig[ prop ];
				}
			}
		}

		this.element.trigger( event, data );

		return !( $.isFunction(callback) &&
			callback.call( this.element[0], event, data ) === false ||
			event.isDefaultPrevented() );
	}
};

})( jQuery );

};


(function ($, window, undefined) {
  var pos_oo = Number.POSITIVE_INFINITY,
      neg_oo = Number.NEGATIVE_INFINITY;

  $.geo = {
    //
    // utility functions
    //

    _allCoordinates: function (geom) {
      // return array of all positions in all geometries of geom
      // not in JTS
      var geometries = this._flatten(geom),
          curGeom = 0,
          result = [];

      for (; curGeom < geometries.length; curGeom++) {
        var coordinates = geometries[curGeom].coordinates,
            isArray = coordinates && $.isArray(coordinates[0]),
            isDblArray = isArray && $.isArray(coordinates[0][0]),
            isTriArray = isDblArray && $.isArray(coordinates[0][0][0]),
            i, j, k;

        if (!isTriArray) {
          if (!isDblArray) {
            if (!isArray) {
              coordinates = [coordinates];
            }
            coordinates = [coordinates];
          }
          coordinates = [coordinates];
        }

        for (i = 0; i < coordinates.length; i++) {
          for (j = 0; j < coordinates[i].length; j++) {
            for (k = 0; k < coordinates[i][j].length; k++) {
              result.push(coordinates[i][j][k]);
            }
          }
        }
      }
      return result;
    },

    _isGeodetic: function( coords ) {
      // returns true if the first coordinate it can find is geodetic

      while ( $.isArray( coords ) ) {
        if ( coords.length > 1 && ! $.isArray( coords[ 0 ] ) ) {
          return ( coords[ 0 ] >= -180 && coords[ 0 ] <= 180 && coords[ 1 ] >= -85 && coords[ 1 ] <= 85 );
        } else {
          coords = coords[ 0 ];
        }
      }

      return false;
    },

    //
    // bbox functions
    //

    center: function (bbox, _ignoreGeo /* Internal Use Only */) {
      // Envelope.centre in JTS
      // bbox only, use centroid for geom
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        wasGeodetic = true;
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      var center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
      return wasGeodetic ? $.geo.proj.toGeodetic(center) : center;
    },

    expandBy: function (bbox, dx, dy, _ignoreGeo /* Internal Use Only */) {
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        wasGeodetic = true;
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      bbox = [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
      return wasGeodetic ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    height: function (bbox, _ignoreGeo /* Internal Use Only */ ) {
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      return bbox[3] - bbox[1];
    },

    _in: function(bbox1, bbox2) {
      return bbox1[0] <= bbox2[0] &&
             bbox1[1] <= bbox2[1] &&
             bbox1[2] >= bbox2[2] &&
             bbox1[3] >= bbox2[3];
    },

    _bboxDisjoint: function( bbox1, bbox2 ) {
      return bbox2[ 0 ] > bbox1[ 2 ] || 
             bbox2[ 2 ] < bbox1[ 0 ] || 
             bbox2[ 1 ] > bbox1[ 3 ] ||
             bbox2[ 3 ] < bbox1[ 1 ];
    },

    include: function( bbox, value, _ignoreGeo /* Internal Use Only */ ) {
      // similar to Envelope.expandToInclude in JTS
      if ( !value || !$.isArray( value ) ) {
        return bbox;
      }

      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox || value ) ) {
        wasGeodetic = true;
      }

      if ( !bbox ) {
        bbox = [ pos_oo, pos_oo, neg_oo, neg_oo ];
      } else if ( wasGeodetic ) {
        bbox = $.geo.proj.fromGeodetic( bbox );
      }

      if ( value.length === 2 ) {
        value = [ value[ 0 ], value[ 1 ], value[ 0 ], value[ 1 ] ];
      }

      value = $.geo.proj.fromGeodetic( value );

      bbox[0] = Math.min( value[ 0 ], bbox[ 0 ] );
      bbox[1] = Math.min( value[ 1 ], bbox[ 1 ] );
      bbox[2] = Math.max( value[ 2 ], bbox[ 2 ] );
      bbox[3] = Math.max( value[ 3 ], bbox[ 3 ] );

      return wasGeodetic ? $.geo.proj.toGeodetic( bbox ) : bbox;
    },

    polygonize: function( bbox, _ignoreGeo /* Internal Use Only */ ) {
      // adaptation of Polygonizer class in JTS for use with bboxes
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        wasGeodetic = true;
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      var polygon = {
        type: "Polygon",
        coordinates: [ [
          [ bbox[ 0 ], bbox[ 1 ] ],
          [ bbox[ 0 ], bbox[ 3 ] ],
          [ bbox[ 2 ], bbox[ 3 ] ],
          [ bbox[ 2 ], bbox[ 1 ] ],
          [ bbox[ 0 ], bbox[ 1 ] ]
        ] ]
      };

      if ( wasGeodetic ) {
        polygon.coordinates = $.geo.proj.toGeodetic( polygon.coordinates );
      }

      return polygon;
    },

    reaspect: function (bbox, ratio, _ignoreGeo /* Internal Use Only */ ) {
      // not in JTS
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        wasGeodetic = true;
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      var width = this.width(bbox, true),
          height = this.height(bbox, true),
          center = this.center(bbox, true),
          dx, dy;

      if (width !== 0 && height !== 0 && ratio > 0) {
        if (width / height > ratio) {
          dx = width / 2;
          dy = dx / ratio;
        } else {
          dy = height / 2;
          dx = dy * ratio;
        }

        bbox = [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
      }

      return wasGeodetic ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    recenter: function( bbox, center, _ignoreGeo /* Internal Use Only */ ) {
      // not in JTS
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj ) {
        if ( this._isGeodetic( bbox ) ) {
          wasGeodetic = true;
          bbox = $.geo.proj.fromGeodetic(bbox);
        }

        if ( this._isGeodetic( center ) ) {
          center = $.geo.proj.fromGeodetic(center);
        }
      }

      var halfWidth = ( bbox[ 2 ] - bbox[ 0 ] ) / 2,
          halfHeight = ( bbox[ 3 ] - bbox[ 1 ] ) / 2;

      bbox = [
        center[ 0 ] - halfWidth,
        center[ 1 ] - halfHeight,
        center[ 0 ] + halfWidth,
        center[ 1 ] + halfHeight
      ];

      return wasGeodetic ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    scaleBy: function ( bbox, scale, _ignoreGeo /* Internal Use Only */ ) {
      // not in JTS
      var wasGeodetic = false;
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        wasGeodetic = true;
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      var c = this.center(bbox, true),
          dx = (bbox[2] - bbox[0]) * scale / 2,
          dy = (bbox[3] - bbox[1]) * scale / 2;

      bbox = [c[0] - dx, c[1] - dy, c[0] + dx, c[1] + dy];

      return wasGeodetic ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    width: function (bbox, _ignoreGeo /* Internal Use Only */ ) {
      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( bbox ) ) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }

      return bbox[2] - bbox[0];
    },

    //
    // geometry functions
    //

    // bbox (Geometry.getEnvelope in JTS)

    bbox: function ( geom, _ignoreGeo /* Internal Use Only */ ) {
      var result, wasGeodetic = false;
      if ( !geom ) {
        return undefined;
      } else if ( geom.bbox ) {
        result = ( !_ignoreGeo && $.geo.proj && this._isGeodetic( geom.bbox ) ) ? $.geo.proj.fromGeodetic( geom.bbox ) : geom.bbox;
      } else {
        result = [ pos_oo, pos_oo, neg_oo, neg_oo ];

        var coordinates = this._allCoordinates( geom ),
            curCoord = 0;

        if ( coordinates.length === 0 ) {
          return undefined;
        }

        if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( coordinates ) ) {
          wasGeodetic = true;
          coordinates = $.geo.proj.fromGeodetic( coordinates );
        }

        for ( ; curCoord < coordinates.length; curCoord++ ) {
          result[0] = Math.min(coordinates[curCoord][0], result[0]);
          result[1] = Math.min(coordinates[curCoord][1], result[1]);
          result[2] = Math.max(coordinates[curCoord][0], result[2]);
          result[3] = Math.max(coordinates[curCoord][1], result[3]);
        }
      }

      return wasGeodetic ? $.geo.proj.toGeodetic(result) : result;
    },

    // centroid
    
    centroid: function( geom, _ignoreGeo /* Internal Use Only */ ) {
      switch (geom.type) {
        case "Point":
          return $.extend({}, geom);

        case "LineString":
        case "Polygon":
          var a = 0,
              c = [0, 0],
              coords = $.merge( [ ], geom.type == "Polygon" ? geom.coordinates[0] : geom.coordinates ),
              i = 1, j, n,
              bbox = [ pos_oo, pos_oo, neg_oo, neg_oo ];

          var wasGeodetic = false;
          if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( coords ) ) {
            wasGeodetic = true;
            coords = $.geo.proj.fromGeodetic(coords);
          }

          //if (coords[0][0] != coords[coords.length - 1][0] || coords[0][1] != coords[coords.length - 1][1]) {
          //  coords.push(coords[0]);
          //}

          for (; i <= coords.length; i++) {
            j = i % coords.length;

            bbox[0] = Math.min(coords[j][0], bbox[0]);
            bbox[1] = Math.min(coords[j][1], bbox[1]);
            bbox[2] = Math.max(coords[j][0], bbox[2]);
            bbox[3] = Math.max(coords[j][1], bbox[3]);

            n = (coords[i - 1][0] * coords[j][1]) - (coords[j][0] * coords[i - 1][1]);
            a += n;
            c[0] += (coords[i - 1][0] + coords[j][0]) * n;
            c[1] += (coords[i - 1][1] + coords[j][1]) * n;
          }

          if (a === 0) {
            if (coords.length > 0) {
              c[0] = Math.min( Math.max( coords[0][0], bbox[ 0 ] ), bbox[ 2 ] );
              c[1] = Math.min( Math.max( coords[0][1], bbox[ 1 ] ), bbox[ 3 ] );
              return { type: "Point", coordinates: wasGeodetic ? $.geo.proj.toGeodetic(c) : c };
            } else {
              return undefined;
            }
          }

          a *= 3;
          //c[0] /= a;
          //c[1] /= a;

          c[0] = Math.min( Math.max( c[0] / a, bbox[ 0 ] ), bbox[ 2 ] );
          c[1] = Math.min( Math.max( c[1] / a, bbox[ 1 ] ), bbox[ 3 ] );

          return { type: "Point", coordinates: wasGeodetic ? $.geo.proj.toGeodetic(c) : c };
      }
      return undefined;
    },

    // contains

    contains: function (geom1, geom2) {
      if (geom1.type != "Polygon") {
        return false;
      }

      switch (geom2.type) {
        case "Point":
          return this._containsPolygonPoint(geom1.coordinates, geom2.coordinates);

        case "LineString":
          return this._containsPolygonLineString(geom1.coordinates, geom2.coordinates);

        case "Polygon":
          return this._containsPolygonLineString(geom1.coordinates, geom2.coordinates[0]);

        default:
          return false;
      }
    },

    _containsPolygonPoint: function (polygonCoordinates, pointCoordinate) {
      if (polygonCoordinates.length === 0 || polygonCoordinates[0].length < 4) {
        return false;
      }

      var rayCross = 0,
          a = polygonCoordinates[0][0],
          i = 1,
          b,
          x;

      for (; i < polygonCoordinates[0].length; i++) {
        b = polygonCoordinates[0][i];

        if ((a[1] <= pointCoordinate[1] && pointCoordinate[1] < b[1]) || (b[1] <= pointCoordinate[1] && pointCoordinate[1] < a[1]) && (pointCoordinate[0] < a[0] || pointCoordinate[0] < b[0])) {
          x = a[0] + (b[0] - a[0]) * (pointCoordinate[1] - a[1]) / (b[1] - a[1]);

          if (x > pointCoordinate[0]) {
            rayCross++;
          }
        }

        a = b;
      }

      return rayCross % 2 == 1;
    },

    _containsPolygonLineString: function (polygonCoordinates, lineStringCoordinates) {
      for (var i = 0; i < lineStringCoordinates.length; i++) {
        if (!this._containsPolygonPoint(polygonCoordinates, lineStringCoordinates[i])) {
          return false;
        }
      }
      return true;
    },

    // distance

    distance: function ( geom1, geom2, _ignoreGeo /* Internal Use Only */ ) {
      var geom1CoordinatesProjected = ( !_ignoreGeo && $.geo.proj && this._isGeodetic( geom1.coordinates ) ) ? $.geo.proj.fromGeodetic(geom1.coordinates) : geom1.coordinates,
          geom2CoordinatesProjected = ( !_ignoreGeo && $.geo.proj && this._isGeodetic( geom2.coordinates ) ) ? $.geo.proj.fromGeodetic(geom2.coordinates) : geom2.coordinates;

      switch (geom1.type) {
        case "Point":
          switch (geom2.type) {
            case "Point":
              return this._distancePointPoint(geom2CoordinatesProjected, geom1CoordinatesProjected);
            case "LineString":
              return this._distanceLineStringPoint(geom2CoordinatesProjected, geom1CoordinatesProjected);
            case "Polygon":
              return this._containsPolygonPoint(geom2CoordinatesProjected, geom1CoordinatesProjected) ? 0 : this._distanceLineStringPoint(geom2CoordinatesProjected[0], geom1CoordinatesProjected);
            default:
              return undefined;
          }
          break;

        case "LineString":
          switch (geom2.type) {
            case "Point":
              return this._distanceLineStringPoint(geom1CoordinatesProjected, geom2CoordinatesProjected);
            case "LineString":
              return this._distanceLineStringLineString(geom1CoordinatesProjected, geom2CoordinatesProjected);
            case "Polygon":
              return this._containsPolygonLineString(geom2CoordinatesProjected, geom1CoordinatesProjected) ? 0 : this._distanceLineStringLineString(geom2CoordinatesProjected[0], geom1CoordinatesProjected);
            default:
              return undefined;
          }
          break;

        case "Polygon":
          switch (geom2.type) {
            case "Point":
              return this._containsPolygonPoint(geom1CoordinatesProjected, geom2CoordinatesProjected) ? 0 : this._distanceLineStringPoint(geom1CoordinatesProjected[0], geom2CoordinatesProjected);
            case "LineString":
              return this._containsPolygonLineString(geom1CoordinatesProjected, geom2CoordinatesProjected) ? 0 : this._distanceLineStringLineString(geom1CoordinatesProjected[0], geom2CoordinatesProjected);
            case "Polygon":
              return this._containsPolygonLineString(geom1CoordinatesProjected, geom2CoordinatesProjected[0]) ? 0 : this._distanceLineStringLineString(geom1CoordinatesProjected[0], geom2CoordinatesProjected[0]);
            default:
              return undefined;
          }
          break;
      }
    },

    _distancePointPoint: function (coordinate1, coordinate2) {
      var dx = coordinate2[0] - coordinate1[0],
          dy = coordinate2[1] - coordinate1[1];
      return Math.sqrt((dx * dx) + (dy * dy));
    },

    _distanceLineStringPoint: function (lineStringCoordinates, pointCoordinate) {
      var minDist = pos_oo;

      if (lineStringCoordinates.length > 0) {
        var a = lineStringCoordinates[0],

            apx = pointCoordinate[0] - a[0],
            apy = pointCoordinate[1] - a[1];

        if (lineStringCoordinates.length == 1) {
          return Math.sqrt(apx * apx + apy * apy);
        } else {
          for (var i = 1; i < lineStringCoordinates.length; i++) {
            var b = lineStringCoordinates[i],

                abx = b[0] - a[0],
                aby = b[1] - a[1],
                bpx = pointCoordinate[0] - b[0],
                bpy = pointCoordinate[1] - b[1],

                d = this._distanceSegmentPoint(abx, aby, apx, apy, bpx, bpy);

            if (d === 0) {
              return 0;
            }

            if (d < minDist) {
              minDist = d;
            }

            a = b;
            apx = bpx;
            apy = bpy;
          }
        }
      }

      return Math.sqrt(minDist);
    },

    _distanceSegmentPoint: function (abx, aby, apx, apy, bpx, bpy) {
      var dot1 = abx * apx + aby * apy;

      if (dot1 <= 0) {
        return apx * apx + apy * apy;
      }

      var dot2 = abx * abx + aby * aby;

      if (dot1 >= dot2) {
        return bpx * bpx + bpy * bpy;
      }

      return apx * apx + apy * apy - dot1 * dot1 / dot2;
    },

    _distanceLineStringLineString: function (lineStringCoordinates1, lineStringCoordinates2) {
      var minDist = pos_oo;
      for (var i = 0; i < lineStringCoordinates2.length; i++) {
        minDist = Math.min(minDist, this._distanceLineStringPoint(lineStringCoordinates1, lineStringCoordinates2[i]));
      }
      return minDist;
    },

    // buffer

    _buffer: function( geom, distance, _ignoreGeo /* Internal Use Only */ ) {
      var wasGeodetic = false,
          coords = geom.coordinates;

      if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( geom.coordinates ) ) {
        wasGeodetic = true;
        coords = $.geo.proj.fromGeodetic( geom.coordinates );
      }

      if ( geom.type === "Point" ) {
        var resultCoords = [],
            slices = 180,
            i = 0,
            a;

        for ( ; i <= slices; i++ ) {
          a = ( i * 360 / slices ) * ( Math.PI / 180 );
          resultCoords.push( [
            coords[ 0 ] + Math.cos( a ) * distance,
            coords[ 1 ] + Math.sin( a ) * distance
          ] );
        }

        return {
          type: "Polygon",
          coordinates: [ ( wasGeodetic ? $.geo.proj.toGeodetic( resultCoords ) : resultCoords ) ]
        };
      } else {
        return undefined;
      }
    },

    
    //
    // feature
    //

    _flatten: function (geom) {
      // return an array of all basic geometries
      // not in JTS
      var geometries = [],
          curGeom = 0;
      switch (geom.type) {
        case "Feature":
          $.merge(geometries, this._flatten(geom.geometry));
          break;

        case "FeatureCollection":
          for (; curGeom < geom.features.length; curGeom++) {
            $.merge(geometries, this._flatten(geom.features[curGeom].geometry));
          }
          break;

        case "GeometryCollection":
          for (; curGeom < geom.geometries.length; curGeom++) {
            $.merge(geometries, this._flatten(geom.geometries[curGeom]));
          }
          break;

        default:
          geometries[0] = geom;
          break;
      }
      return geometries;
    },

    length: function( geom, _ignoreGeo /* Internal Use Only */ ) {
      var sum = 0,
          lineStringCoordinates,
          i = 1, dx, dy;

      switch ( geom.type ) {
        case "Point":
          return 0;

        case "LineString":
          lineStringCoordinates = geom.coordinates;
          break;

        case "Polygon":
          lineStringCoordinates = geom.coordinates[ 0 ];
          break;
      }

      if ( lineStringCoordinates ) {
        if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( lineStringCoordinates ) ) {
          lineStringCoordinates = $.geo.proj.fromGeodetic( lineStringCoordinates );
        }

        for ( ; i < lineStringCoordinates.length; i++ ) {
          dx = lineStringCoordinates[ i ][0] - lineStringCoordinates[ i - 1 ][0];
          dy = lineStringCoordinates[ i ][1] - lineStringCoordinates[ i - 1 ][1];
          sum += Math.sqrt((dx * dx) + (dy * dy));
        }

        return sum;
      }

      // return undefined;
    },

    area: function( geom, _ignoreGeo /* Internal Use Only */ ) {
      var sum = 0,
          polygonCoordinates,
          i = 1, j;

      switch ( geom.type ) {
        case "Point":
        case "LineString":
          return 0;

        case "Polygon":
          polygonCoordinates = geom.coordinates[ 0 ];
          break;
      }

      if ( polygonCoordinates ) {
        if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( polygonCoordinates ) ) {
          polygonCoordinates = $.geo.proj.fromGeodetic( polygonCoordinates );
        }

        for ( ; i <= polygonCoordinates.length; i++) {
          j = i %  polygonCoordinates.length;
          sum += ( polygonCoordinates[ i - 1 ][ 0 ] - polygonCoordinates[ j ][ 0 ] ) * ( polygonCoordinates[ i - 1 ][ 1 ] + polygonCoordinates[ j ][ 1 ] ) / 2;
        }

        return Math.abs( sum );
      }
    },

    pointAlong: function( geom, percentage, _ignoreGeo /* Internal Use Only */ ) {
      var totalLength = 0,
          previousPercentageSum = 0,
          percentageSum = 0,
          remainderPercentageSum,
          len,
          lineStringCoordinates,
          segmentLengths = [],
          i = 1, dx, dy,
          c, c0, c1,
          wasGeodetic = false;

      switch ( geom.type ) {
        case "Point":
          return $.extend( { }, geom );

        case "LineString":
          lineStringCoordinates = geom.coordinates;
          break;

        case "Polygon":
          lineStringCoordinates = geom.coordinates[ 0 ];
          break;
      }

      if ( lineStringCoordinates ) {
        if ( percentage === 0 ) {
          return {
            type: "Point",
            coordinates: [ lineStringCoordinates[ 0 ][ 0 ], lineStringCoordinates[ 0 ][ 1 ] ]
          };
        } else if ( percentage === 1 ) {
          i = lineStringCoordinates.length - 1;
          return {
            type: "Point",
            coordinates: [ lineStringCoordinates[ i ][ 0 ], lineStringCoordinates[ i ][ 1 ] ]
          };
        } else {
          if ( !_ignoreGeo && $.geo.proj && this._isGeodetic( lineStringCoordinates ) ) {
            wasGeodetic = true;
            lineStringCoordinates = $.geo.proj.fromGeodetic( lineStringCoordinates );
          }

          for ( ; i < lineStringCoordinates.length; i++ ) {
            dx = lineStringCoordinates[ i ][ 0 ] - lineStringCoordinates[ i - 1 ][ 0 ];
            dy = lineStringCoordinates[ i ][ 1 ] - lineStringCoordinates[ i - 1 ][ 1 ];
            len = Math.sqrt((dx * dx) + (dy * dy));
            segmentLengths.push( len );
            totalLength += len;
          }

          for ( i = 0; i < segmentLengths.length && percentageSum < percentage; i++ ) {
            previousPercentageSum = percentageSum;
            percentageSum += ( segmentLengths[ i ] / totalLength );
          }

          remainderPercentageSum = percentage - previousPercentageSum;

          c0 = lineStringCoordinates[ i - 1 ];
          c1 = lineStringCoordinates[ i ];

          c = [
            c0[ 0 ] + ( remainderPercentageSum * ( c1[ 0 ] - c0[ 0 ] ) ),
            c0[ 1 ] + ( remainderPercentageSum * ( c1[ 1 ] - c0[ 1 ] ) )
          ];

          return {
            type: "Point",
            coordinates: wasGeodetic ? $.geo.proj.toGeodetic(c) : c
          };
        }
      }
    },

    //
    // WKT functions
    //

    _WKT: (function () {
      function pointToString(value) {
        return "POINT " + pointToUntaggedString(value.coordinates);
      }

      function pointToUntaggedString(coordinates) {
        if (!(coordinates && coordinates.length)) {
          return "EMPTY";
        } else {
          return "(" + coordinates.join(" ") + ")";
        }
      }

      function lineStringToString(value) {
        return "LINESTRING " + lineStringToUntaggedString(value.coordinates);
      }

      function lineStringToUntaggedString(coordinates) {
        if (!(coordinates && coordinates.length)) {
          return "EMPTY";
        } else {
          var points = [];

          for (var i = 0; i < coordinates.length; i++) {
            points.push(coordinates[i].join(" "));
          }

          return "(" + points + ")";
        }
      }

      function polygonToString(value) {
        return "POLYGON " + polygonToUntaggedString(value.coordinates);
      }

      function polygonToUntaggedString(coordinates) {
        if (!(coordinates && coordinates.length)) {
          return "EMTPY";
        } else {
          var lineStrings = [];

          for (var i = 0; i < coordinates.length; i++) {
            lineStrings.push(lineStringToUntaggedString(coordinates[i]));
          }

          return "(" + lineStrings + ")";
        }
      }

      function multiPointToString(value) {
        return "MULTIPOINT " + lineStringToUntaggedString(value.coordinates);
      }

      function multiLineStringToString(value) {
        return "MULTILINSTRING " + polygonToUntaggedString(value.coordinates);
      }

      function multiPolygonToString(value) {
        return "MULTIPOLYGON " + multiPolygonToUntaggedString(value.coordinates);
      }

      function multiPolygonToUntaggedString(coordinates) {
        if (!(coordinates && coordinates.length)) {
          return "EMPTY";
        } else {
          var polygons = [];
          for (var i = 0; i < coordinates.length; i++) {
            polygons.push(polygonToUntaggedString(coordinates[i]));
          }
          return "(" + polygons + ")";
        }
      }

      function geometryCollectionToString(value) {
        return "GEOMETRYCOLLECTION " + geometryCollectionToUntaggedString(value.geometries);
      }

      function geometryCollectionToUntaggedString(geometries) {
        if (!(geometries && geometries.length)) {
          return "EMPTY";
        } else {
          var geometryText = [];
          for (var i = 0; i < geometries.length; i++) {
            geometryText.push(stringify(geometries[i]));
          }
          return "(" + geometries + ")";
        }
      }

      function stringify(value) {
        if (!(value && value.type)) {
          return "";
        } else {
          switch (value.type) {
            case "Point":
              return pointToString(value);

            case "LineString":
              return lineStringToString(value);

            case "Polygon":
              return polygonToString(value);

            case "MultiPoint":
              return multiPointToString(value);

            case "MultiLineString":
              return multiLineStringToString(value);

            case "MultiPolygon":
              return multiPolygonToString(value);

            case "GeometryCollection":
              return geometryCollectionToString(value);

            default:
              return "";
          }
        }
      }

      function pointParseUntagged(wkt) {
        var pointString = wkt.match( /\(\s*([\d\.\-]+)\s+([\d\.\-]+)\s*\)/ );
        return pointString && pointString.length > 2 ? {
          type: "Point",
          coordinates: [
            parseFloat(pointString[1]),
            parseFloat(pointString[2])
          ]
        } : null;
      }

      function lineStringParseUntagged(wkt) {
        var lineString = wkt.match( /\s*\((.*)\)/ ),
            coords = [],
            pointStrings,
            pointParts,
            i = 0;

        if ( lineString && lineString.length > 1 ) {
          pointStrings = lineString[ 1 ].match( /[\d\.\-]+\s+[\d\.\-]+/g );

          for ( ; i < pointStrings.length; i++ ) {
            pointParts = pointStrings[ i ].match( /\s*([\d\.\-]+)\s+([\d\.\-]+)\s*/ );
            coords[ i ] = [ parseFloat( pointParts[ 1 ] ), parseFloat( pointParts[ 2 ] ) ];
          }

          return {
            type: "LineString",
            coordinates: coords
          };
        } else {
          return null;
        }
      }

      function polygonParseUntagged(wkt) {
        var polygon = wkt.match( /\s*\(\s*\((.*)\)\s*\)/ ),
            coords = [],
            pointStrings,
            pointParts,
            i = 0;

        if ( polygon && polygon.length > 1 ) {
          pointStrings = polygon[ 1 ].match( /[\d\.\-]+\s+[\d\.\-]+/g );

          for ( ; i < pointStrings.length; i++ ) {
            pointParts = pointStrings[ i ].match( /\s*([\d\.\-]+)\s+([\d\.\-]+)\s*/ );
            coords[ i ] = [ parseFloat( pointParts[ 1 ] ), parseFloat( pointParts[ 2 ] ) ];
          }

          return {
            type: "Polygon",
            coordinates: [ coords ]
          };
        } else {
          return null;
        }
      }

      function multiPointParseUntagged(wkt) {
        var multiSomething;

        if ( wkt.indexOf( "((" ) === -1 ) {
          multiSomething = lineStringParseUntagged( wkt );
        } else {
          multiSomething = multiLineStringParseUntagged( wkt );
          multiSomething.coordinates = $.geo._allCoordinates( multiSomething );
        }

        multiSomething.type = "MultiPoint";

        return multiSomething;
      }

      function multiLineStringParseUntagged(wkt) {
        var lineStringsWkt = wkt.substr( 1, wkt.length - 2 ),
            lineStrings = lineStringsWkt.split( ")),((" ),
            i = 0,
            multiLineString = {
              type: "MultiLineString",
              coordinates: [ ]
            };

        for ( ; i < lineStrings.length; i++ ) {
          multiLineString.coordinates.push( lineStringParseUntagged( lineStrings[ i ] ).coordinates );
        }

        return multiLineString;
      }

      function multiPolygonParseUntagged(wkt) {
        var polygonsWkt = wkt.substr( 1, wkt.length - 2 ),
            polygons = polygonsWkt.split( ")),((" ),
            i = 0,
            multiPolygon = {
              type: "MultiPolygon",
              coordinates: [ ]
            };

        for ( ; i < polygons.length; i++ ) {
          multiPolygon.coordinates.push( polygonParseUntagged( polygons[ i ] ).coordinates );
        }

        return multiPolygon;
      }

      function geometryCollectionParseUntagged( wkt ) {
        var geometriesWkt = wkt.substr( 1, wkt.length - 2 ),
            geometries = geometriesWkt.match( /\),[a-zA-Z]/g ),
            geometryCollection = {
              type: "GeometryCollection",
              geometries: [ ]
            },
            curGeom,
            i = 0, curStart = 0, curLen;

        if ( geometries && geometries.length > 0 ) {
          for ( ; i < geometries.length; i++ ) {
            curLen = geometriesWkt.indexOf( geometries[ i ], curStart ) - curStart + 1;
            curGeom = parse( geometriesWkt.substr( curStart, curLen ) );
            if ( curGeom ) {
              geometryCollection.geometries.push( curGeom );
            }
            curStart += curLen + 1;
          }

          // one more
          curGeom = parse( geometriesWkt.substr( curStart ) );
          if ( curGeom ) {
            geometryCollection.geometries.push( curGeom );
          }

          return geometryCollection;
        } else {
          return null;
        }
      }

      function parse(wkt) {
        wkt = $.trim(wkt);

        var typeIndex = wkt.indexOf( "(" ),
            untagged = wkt.substr( typeIndex  );

        switch ($.trim(wkt.substr(0, typeIndex)).toUpperCase()) {
          case "POINT":
            return pointParseUntagged( untagged );

          case "LINESTRING":
            return lineStringParseUntagged( untagged );

          case "POLYGON":
            return polygonParseUntagged( untagged );

          case "MULTIPOINT":
            return multiPointParseUntagged( untagged );

          case "MULTILINESTRING":
            return multiLineStringParseUntagged( untagged );

          case "MULTIPOLYGON":
            return multiPolygonParseUntagged( untagged );

          case "GEOMETRYCOLLECTION":
            return geometryCollectionParseUntagged( untagged );

          default:
            return null;
        }
      }

      return {
        stringify: stringify,

        parse: parse
      };
    }()),

    //
    // projection functions
    //

    proj: (function () {
      var halfPi = 1.5707963267948966192,
          quarterPi = 0.7853981633974483096,
          radiansPerDegree = 0.0174532925199432958,
          degreesPerRadian = 57.295779513082320877,
          semiMajorAxis = 6378137;

      return {
        fromGeodeticPos: function (coordinate) {
          return [
            semiMajorAxis * coordinate[ 0 ] * radiansPerDegree,
            semiMajorAxis * Math.log(Math.tan(quarterPi + coordinate[ 1 ] * radiansPerDegree / 2))
          ];
        },

        fromGeodetic: function ( coordinates ) {
          if ( ! $.geo._isGeodetic( coordinates ) ) {
            return coordinates;
          }

          var isMultiPointOrLineString = $.isArray(coordinates[ 0 ]),
              fromGeodeticPos = this.fromGeodeticPos;

          if (!isMultiPointOrLineString && coordinates.length == 4) {
            // bbox
            var min = fromGeodeticPos([ coordinates[ 0 ], coordinates[ 1 ] ]),
                max = fromGeodeticPos([ coordinates[ 2 ], coordinates[ 3 ] ]);
            return [ min[ 0 ], min[ 1 ], max[ 0 ], max[ 1 ] ];
          } else {
            // geometry
            var isMultiLineStringOrPolygon = isMultiPointOrLineString && $.isArray(coordinates[ 0 ][ 0 ]),
                isMultiPolygon = isMultiLineStringOrPolygon && $.isArray(coordinates[ 0 ][ 0 ][ 0 ]),
                result = [ ],
                i, j, k;

            if (!isMultiPolygon) {
              if (!isMultiLineStringOrPolygon) {
                if (!isMultiPointOrLineString) {
                  coordinates = [ coordinates ];
                }
                coordinates = [ coordinates ];
              }
              coordinates = [ coordinates ];
            }

            for ( i = 0; i < coordinates.length; i++ ) {
              result[ i ] = [ ];
              for ( j = 0; j < coordinates[ i ].length; j++ ) {
                result[ i ][ j ] = [ ];
                for ( k = 0; k < coordinates[ i ][ j ].length; k++ ) {
                  result[ i ][ j ][ k ] = fromGeodeticPos(coordinates[ i ][ j ][ k ]);
                }
              }
            }

            return isMultiPolygon ? result : isMultiLineStringOrPolygon ? result[ 0 ] : isMultiPointOrLineString ? result[ 0 ][ 0 ] : result[ 0 ][ 0 ][ 0 ];
          }
        },

        toGeodeticPos: function (coordinate) {
          return [
            (coordinate[ 0 ] / semiMajorAxis) * degreesPerRadian,
            (halfPi - 2 * Math.atan(1 / Math.exp(coordinate[ 1 ] / semiMajorAxis))) * degreesPerRadian
          ];
        },

        toGeodetic: function (coordinates) {
          if ( $.geo._isGeodetic( coordinates ) ) {
            return coordinates;
          }

          var isMultiPointOrLineString = $.isArray(coordinates[ 0 ]),
              toGeodeticPos = this.toGeodeticPos;

          if (!isMultiPointOrLineString && coordinates.length == 4) {
            // bbox
            var min = toGeodeticPos([ coordinates[ 0 ], coordinates[ 1 ] ]),
                max = toGeodeticPos([ coordinates[ 2 ], coordinates[ 3 ] ]);
            return [ min[ 0 ], min[ 1 ], max[ 0 ], max[ 1 ] ];
          } else {
            // geometry
            var isMultiLineStringOrPolygon = isMultiPointOrLineString && $.isArray(coordinates[ 0 ][ 0 ]),
                isMultiPolygon = isMultiLineStringOrPolygon && $.isArray(coordinates[ 0 ][ 0 ][ 0 ]),
                result = [ ],
                i, j, k;

            if (!isMultiPolygon) {
              if (!isMultiLineStringOrPolygon) {
                if (!isMultiPointOrLineString) {
                  coordinates = [ coordinates ];
                }
                coordinates = [ coordinates ];
              }
              coordinates = [ coordinates ];
            }

            for ( i = 0; i < coordinates.length; i++ ) {
              result[ i ] = [ ];
              for ( j = 0; j < coordinates[ i ].length; j++ ) {
                result[ i ][ j ] = [ ];
                for ( k = 0; k < coordinates[ i ][ j ].length; k++ ) {
                  result[ i ][ j ][ k ] = toGeodeticPos(coordinates[ i ][ j ][ k ]);
                }
              }
            }

            return isMultiPolygon ? result : isMultiLineStringOrPolygon ? result[ 0 ] : isMultiPointOrLineString ? result[ 0 ][ 0 ] : result[ 0 ][ 0 ][ 0 ];
          }
        }
      };
    }()),

    //
    // service types (defined in other files)
    //

    _serviceTypes: {}
  };
}(jQuery, this));

(function ($, undefined) {
  var _ieVersion = ( function () {
    var v = 5, div = document.createElement("div"), a = div.all || [];
    do {
      div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->";
    } while ( a[0] );
    return v > 6 ? v : !v;
  }() );

  $.widget("geo.geographics", {
    _$elem: undefined,
    _options: {},
    _trueCanvas: true,
    _trueDoubleBuffer: true,

    _width: 0,
    _height: 0,

    _$canvas: undefined,
    _context: undefined,

    _$canvasSceneFront: undefined, //< if _trueCanvas, where canvas images get written (front buffer)
    _$canvasSceneBack: undefined, //< if _trueCanvas, where canvas images get written (back buffer)
    _timeoutEnd:  null,
    _requireFlip: false,

    _blitcanvas: undefined,
    _blitcontext: undefined,

    _$labelsContainerFront: undefined,
    _$labelsContainerBack: undefined,
    _labelsHtml: "",

    options: {
      style: {
        borderRadius: "8px",
        color: "#7f0000",
        //fill: undefined,
        fillOpacity: 0.2,
        height: "8px",
        opacity: 1,
        //stroke: undefined,
        strokeOpacity: 1,
        strokeWidth: "2px",
        visibility: "visible",
        width: "8px"
      },

      doubleBuffer: true
    },

    _create: function () {
      this._$elem = this.element;
      this._options = this.options;

      this._$elem.css( {
        webkitTransform: "translateZ(0)",
        display: "inline-block",
        overflow: "hidden",
        textAlign: "left"
      } );

      if (this._$elem.css("position") == "static") {
        this._$elem.css("position", "relative");
      }

      this._$elem.addClass( "geo-graphics" );

      this._width = this._$elem.width();
      this._height = this._$elem.height();

      if (!(this._width && this._height)) {
        this._width = parseInt(this._$elem.css("width"), 10);
        this._height = parseInt(this._$elem.css("height"), 10);
      }

      var posCss = 'position:absolute;left:0;top:0;margin:0;padding:0;',
          sizeCss = 'width:' + this._width + 'px;height:' + this._height + 'px;',
          sizeAttr = 'width="' + this._width + '" height="' + this._height + '"';

      this._blitcanvas = document.createElement( "canvas" );

      if ( this._blitcanvas.getContext ) {
        //this._$elem.append('<canvas ' + sizeAttr + ' style="-webkit-transform:translateZ(0);' + posCss + '"></canvas>');
        //this._$canvas = this._$elem.children(':last');
        this._$canvas = $('<canvas ' + sizeAttr + ' style="-webkit-transform:translateZ(0);' + posCss + '"></canvas>');

        // test _trueDoubleBuffer
        this._blitcanvas.width = 1;
        this._blitcanvas.height = 1;
        this._trueDoubleBuffer = this._blitcanvas.toDataURL().length > 6;

        if ( !(this._options.doubleBuffer && this._trueDoubleBuffer) ) {
          this._$elem.append( this._$canvas );
        }

        this._context = this._$canvas[0].getContext("2d");

        //this._blitcanvas = document.createElement( "canvas" );
        this._blitcanvas.width = this._width;
        this._blitcanvas.height = this._height;
        this._blitcontext = this._blitcanvas.getContext("2d");

        // create our front & back buffers
        this._$canvasSceneFront = $('<img id="scene0" style="-webkit-transform:translateZ(0);' + posCss + sizeCss + '" />');
        this._$canvasSceneBack = $('<img id="scene1" style="-webkit-transform:translateZ(0);' + posCss + sizeCss + '" />');

      } else if (_ieVersion <= 8) {
        this._trueCanvas = false;
        this._$elem.append( '<div ' + sizeAttr + ' style="' + posCss + sizeCss + '"></div>');
        this._$canvas = this._$elem.children(':last');

        G_vmlCanvasManager.initElement(this._$canvas[0]);
        this._context = this._$canvas[0].getContext("2d");
        this._$canvas.children().css({ backgroundColor: "transparent", width: this._width, height: this._height });
      }

      // create our front & back label containers
      this._$labelsContainerFront = $('<div class="geo-labels-container" style="-webkit-transform:translateZ(0);' + posCss + sizeCss + '"></div>');
      this._$labelsContainerBack = $('<div class="geo-labels-container" style="-webkit-transform:translateZ(0);' + posCss + sizeCss + '"></div>');
    },

    _setOption: function (key, value) {
      if (key == "style") {
        value = $.extend({}, this._options.style, value);
      }
      $.Widget.prototype._setOption.apply(this, arguments);
    },

    destroy: function () {
      $.Widget.prototype.destroy.apply(this, arguments);
      this._$elem.html("");
      this._$elem.removeClass( "geo-graphics" );
    },

    clear: function () {
      this._context.clearRect(0, 0, this._width, this._height);
      this._labelsHtml = "";

          //if ( this._options.doubleBuffer ) console.log("clear:_end " + $.now());
      this._end( );
    },

    drawArc: function (coordinates, startAngle, sweepAngle, style) {
      style = this._getGraphicStyle(style);

      if (style.visibility != "hidden" && style.opacity > 0 && style.widthValue > 0 && style.heightValue > 0) {
        var r = Math.min(style.widthValue, style.heightValue) / 2;

        startAngle = (startAngle * Math.PI / 180);
        sweepAngle = (sweepAngle * Math.PI / 180);

        this._context.save();
        this._context.translate(coordinates[0], coordinates[1]);
        if (style.widthValue > style.heightValue) {
          this._context.scale(style.widthValue / style.heightValue, 1);
        } else {
          this._context.scale(1, style.heightValue / style.widthValue);
        }

        this._context.beginPath();
        this._context.arc(0, 0, r, startAngle, sweepAngle, false);

        if (this._trueCanvas) {
          this._context.restore();
        }

        if (style.doFill) {
          this._context.fillStyle = style.fill;
          this._context.globalAlpha = style.opacity * style.fillOpacity;
          this._context.fill();
        }

        if (style.doStroke) {
          this._context.lineJoin = "round";
          this._context.lineWidth = style.strokeWidthValue;
          this._context.strokeStyle = style.stroke;

          this._context.globalAlpha = style.opacity * style.strokeOpacity;
          this._context.stroke();
        }

        if (!this._trueCanvas) {
          this._context.restore();
        }
      }

          //if ( this._options.doubleBuffer ) console.log("drawArc:_end " + $.now());
      this._end( );
    },

    drawPoint: function (coordinates, style) {
      style = this._getGraphicStyle(style);
      if (style.widthValue == style.heightValue && style.heightValue == style.borderRadiusValue) {
        this.drawArc(coordinates, 0, 360, style);
      } else if (style.visibility != "hidden" && style.opacity > 0) {
        style.borderRadiusValue = Math.min(Math.min(style.widthValue, style.heightValue) / 2, style.borderRadiusValue);
        coordinates[0] -= style.widthValue / 2;
        coordinates[1] -= style.heightValue / 2;
        this._context.beginPath();
        this._context.moveTo(coordinates[0] + style.borderRadiusValue, coordinates[1]);
        this._context.lineTo(coordinates[0] + style.widthValue - style.borderRadiusValue, coordinates[1]);
        this._context.quadraticCurveTo(coordinates[0] + style.widthValue, coordinates[1], coordinates[0] + style.widthValue, coordinates[1] + style.borderRadiusValue);
        this._context.lineTo(coordinates[0] + style.widthValue, coordinates[1] + style.heightValue - style.borderRadiusValue);
        this._context.quadraticCurveTo(coordinates[0] + style.widthValue, coordinates[1] + style.heightValue, coordinates[0] + style.widthValue - style.borderRadiusValue, coordinates[1] + style.heightValue);
        this._context.lineTo(coordinates[0] + style.borderRadiusValue, coordinates[1] + style.heightValue);
        this._context.quadraticCurveTo(coordinates[0], coordinates[1] + style.heightValue, coordinates[0], coordinates[1] + style.heightValue - style.borderRadiusValue);
        this._context.lineTo(coordinates[0], coordinates[1] + style.borderRadiusValue);
        this._context.quadraticCurveTo(coordinates[0], coordinates[1], coordinates[0] + style.borderRadiusValue, coordinates[1]);
        this._context.closePath();

        if (style.doFill) {
          this._context.fillStyle = style.fill;
          this._context.globalAlpha = style.opacity * style.fillOpacity;
          this._context.fill();
        }

        if (style.doStroke) {
          this._context.lineJoin = "round";
          this._context.lineWidth = style.strokeWidthValue;
          this._context.strokeStyle = style.stroke;

          this._context.globalAlpha = style.opacity * style.strokeOpacity;

          this._context.stroke();
        }

          //if ( this._options.doubleBuffer ) console.log("drawPoint:_end " + $.now());
        this._end( );
      }
    },

    drawLineString: function (coordinates, style) {
      this._drawLines([coordinates], false, style);
    },

    drawPolygon: function (coordinates, style) {
      if ( !this._trueCanvas || coordinates.length == 1 ) {
        // either we don't have fancy rendering or there's no need for it (no holes)
        this._drawLines( coordinates, true, style );
      } else {
        if ( !coordinates || !coordinates.length || coordinates[ 0 ].length < 3 ) {
          // this is not a Polygon or it doesn't have a proper outer ring
          return;
        }

        style = this._getGraphicStyle(style);

        var pixelBbox, i, j;

        if ( style.visibility != "hidden" && style.opacity > 0 ) {
          this._blitcontext.clearRect(0, 0, this._width, this._height);

          if ( style.doFill ) {
            if ( coordinates.length > 1 ) {
              // stencil inner rings
              this._blitcontext.globalCompositeOperation = "source-out";
              this._blitcontext.globalAlpha = 1;

              for ( i = 1; i < coordinates.length; i++ ) {
                this._blitcontext.beginPath();
                this._blitcontext.moveTo( coordinates[ i ][ 0 ][ 0 ], coordinates[ i ][ 0 ][ 1 ] );
                for ( j = 1; j < coordinates[ i ].length; j++ ) {
                  this._blitcontext.lineTo( coordinates[ i ][ j ][ 0 ], coordinates[ i ][ j ][ 1 ] );
                }
                this._blitcontext.closePath();

                this._blitcontext.fill( );
              }
            }
          }

          // path outer ring
          this._blitcontext.beginPath();
          this._blitcontext.moveTo( coordinates[ 0 ][ 0 ][ 0 ], coordinates[ 0 ][ 0 ][ 1 ] );

          pixelBbox = [ coordinates[ 0 ][ 0 ][ 0 ] - style.strokeWidthValue, coordinates[ 0 ][ 0 ][ 1 ] - style.strokeWidthValue, coordinates[ 0 ][ 0 ][ 0 ] + style.strokeWidthValue, coordinates[ 0 ][ 0 ][ 1 ] + style.strokeWidthValue ];

          for ( i = 1; i < coordinates[ 0 ].length - 1; i++ ) {
            this._blitcontext.lineTo( coordinates[ 0 ][ i ][ 0 ], coordinates[ 0 ][ i ][ 1 ] );

            pixelBbox[ 0 ] = Math.min( coordinates[ 0 ][ i ][ 0 ] - style.strokeWidthValue, pixelBbox[ 0 ] );
            pixelBbox[ 1 ] = Math.min( coordinates[ 0 ][ i ][ 1 ] - style.strokeWidthValue, pixelBbox[ 1 ] );
            pixelBbox[ 2 ] = Math.max( coordinates[ 0 ][ i ][ 0 ] + style.strokeWidthValue, pixelBbox[ 2 ] );
            pixelBbox[ 3 ] = Math.max( coordinates[ 0 ][ i ][ 1 ] + style.strokeWidthValue, pixelBbox[ 3 ] );
          }

          this._blitcontext.closePath();

          this._blitcontext.globalCompositeOperation = "source-out";
          if ( style.doFill ) {
            // fill outer ring
            this._blitcontext.fillStyle = style.fill;
            this._blitcontext.globalAlpha = style.opacity * style.fillOpacity;
            this._blitcontext.fill( );
          }

          this._blitcontext.globalCompositeOperation = "source-over";
          if ( style.doStroke ) {
            // stroke outer ring
            this._blitcontext.lineCap = this._blitcontext.lineJoin = "round";
            this._blitcontext.lineWidth = style.strokeWidthValue;
            this._blitcontext.strokeStyle = style.stroke;

            this._blitcontext.globalAlpha = style.opacity * style.strokeOpacity;
            this._blitcontext.stroke( );

            if ( coordinates.length > 1 ) {
              // stroke inner rings
              for ( i = 1; i < coordinates.length; i++ ) {
                this._blitcontext.beginPath();
                this._blitcontext.moveTo( coordinates[ i ][ 0 ][ 0 ], coordinates[ i ][ 0 ][ 1 ] );
                for ( j = 1; j < coordinates[ i ].length; j++ ) {
                  this._blitcontext.lineTo( coordinates[ i ][ j ][ 0 ], coordinates[ i ][ j ][ 1 ] );
                }
                this._blitcontext.closePath();

                this._blitcontext.stroke( );
              }
            }
          }

          // blit
          pixelBbox[ 0 ] = Math.min( Math.max( pixelBbox[ 0 ], 0), this._width );
          pixelBbox[ 1 ] = Math.min( Math.max( pixelBbox[ 1 ], 0), this._height );
          pixelBbox[ 2 ] = Math.min( Math.max( pixelBbox[ 2 ], 0), this._width );
          pixelBbox[ 3 ] = Math.min( Math.max( pixelBbox[ 3 ], 0), this._height );

          if ( pixelBbox[ 0 ] !== pixelBbox[ 2 ] && pixelBbox[ 1 ] !== pixelBbox[ 3 ] ) {
            this._context.drawImage(this._blitcanvas, pixelBbox[ 0 ], pixelBbox[ 1 ], pixelBbox[ 2 ] - pixelBbox[ 0 ], pixelBbox[ 3 ] - pixelBbox[ 1 ], pixelBbox[ 0 ], pixelBbox[ 1 ], pixelBbox[ 2 ] - pixelBbox[ 0 ], pixelBbox[ 3 ] - pixelBbox[ 1 ] );

          //if ( this._options.doubleBuffer ) console.log("drawPolygon:_end " + $.now());
            this._end( );
          }
        }
      }
    },

    drawBbox: function (bbox, style) {
      this._drawLines([[
        [bbox[0], bbox[1]],
        [bbox[0], bbox[3]],
        [bbox[2], bbox[3]],
        [bbox[2], bbox[1]],
        [bbox[0], bbox[1]]
      ]], true, style);
    },

    drawLabel: function( coordinates, label ) {
      this._labelsHtml += '<div class="geo-label" style="-webkit-transform:translateZ(0);position:absolute; left:' + ( coordinates[ 0 ] / this._width * 100 ) + '%; top:' + ( coordinates[ 1 ] / this._height * 100 ) + '%;">' + label + '</div>';
    },

    resize: function( ) {
      this._width = this._$elem.width();
      this._height = this._$elem.height();

      if (!(this._width && this._height)) {
        this._width = parseInt(this._$elem.css("width"), 10);
        this._height = parseInt(this._$elem.css("height"), 10);
      }

      if ( this._trueCanvas ) {
        this._$canvas[0].width = this._width;
        this._$canvas[0].height = this._height;

        this._$canvasSceneFront.css( {
          width: this._width,
          height: this._height
        } );

        this._$canvasSceneBack.css( {
          width: this._width,
          height: this._height
        } );
      } else {
        this._$canvas.css( {
          width: this._width,
          height: this._height
        } );
      }

      this._$labelsContainerFront.css( {
        width: this._width,
        height: this._height
      } );

      this._$labelsContainerBack.css( {
        width: this._width,
        height: this._height
      } );
    },

    interactiveTransform: function( origin, scale ) {
      if ( this._timeoutEnd ) {
        clearTimeout( this._timeoutEnd );
        this._timeoutEnd = null;
      }

      // hide labels for now until they are on the interactive div 
      //this._$labelsContainerFront.html("");

      if ( this._trueCanvas ) {
        if ( this._options.doubleBuffer && this._trueDoubleBuffer ) {


          if ( this._requireFlip ) {
            var geographics = this;

            var oldCanvasScene = geographics._$canvasSceneFront;

            geographics._$canvasSceneFront = geographics._$canvasSceneBack.css( {
              left: 0,
              top: 0,
              width: geographics._width,
              height: geographics._height
            } ).prop( "src", geographics._$canvas[ 0 ].toDataURL( ) ).prependTo( geographics._$elem );

            geographics._$canvasSceneBack = oldCanvasScene.detach();

            geographics._requireFlip = false;
          }


          //console.log("geographics:interactiveTransform " + this._$canvasSceneFront.prop( "id" ) + ": origin: " + origin.toString() + ", scale: " + scale);
          // transform a finished scene, can assume no drawing during these calls
          this._$canvasSceneFront.css( {
            left: Math.round( origin[ 0 ] ),
            top: Math.round( origin[ 1 ] ),
            width: this._width * scale,
            height: this._height * scale
          } );
        } else {
          this._context.clearRect(0, 0, this._width, this._height);
        }
      } else {
        this._context.clearRect(0, 0, this._width, this._height);
      }

      // transform labels
      this._$labelsContainerFront.css( {
        left: Math.round( origin[ 0 ] ),
        top: Math.round( origin[ 1 ] ),
        width: this._width * scale,
        height: this._height * scale
      } );
    },

    _end: function( ) {
      // end/finalize a scene
      if ( this._timeoutEnd ) {
        clearTimeout( this._timeoutEnd );
        this._timeoutEnd = null;
      }

      this._requireFlip = true;

      var geographics = this;

      function endCallback( ) {
        if ( !geographics._timeoutEnd ) {
          // something has canceled the draw
          return;
        }

        if ( geographics._trueCanvas && geographics._options.doubleBuffer && geographics._trueDoubleBuffer ) {
          //console.log("    endCallback...");

          //geographics._$canvasSceneFront = 
          geographics._$canvasSceneBack.prop( "src", "" ).one( "load", function( e ) {
            //console.log("    ...flip: show " + geographics._$canvasSceneBack.prop( "id" ) + ", hide " + geographics._$canvasSceneFront.prop("id"));
            geographics._requireFlip = false;
            var oldCanvasScene = geographics._$canvasSceneFront;

            geographics._$canvasSceneFront = geographics._$canvasSceneBack.css( {
              left: 0,
              top: 0,
              width: geographics._width,
              height: geographics._height
            } ).prependTo( geographics._$elem );

            geographics._$canvasSceneBack = oldCanvasScene.detach();
          } ).prop( "src", geographics._$canvas[ 0 ].toDataURL( ) );
        }


        geographics._$labelsContainerBack.html( geographics._labelsHtml ).find("a").css({
          position: "relative",
          zIndex: 100,
          display: "inline-block",
          webkitTransform: "translateZ(0)"
        });

        var oldLabelsContainer = geographics._$labelsContainerFront;

        geographics._$labelsContainerFront = geographics._$labelsContainerBack.css( {
          left: 0,
          top: 0,
          width: geographics._width,
          height: geographics._height
        } ).prependTo( geographics._$elem );

        geographics._$labelsContainerBack = oldLabelsContainer.detach();


        geographics._timeoutEnd = null;
      }

      //if ( this._options.doubleBuffer ) {
        this._timeoutEnd = setTimeout( endCallback, 20 );
      //} else {
        //geographics._$labelsContainerFront.html( geographics._labelsHtml );
      //}
    },

    _getGraphicStyle: function (style) {
      function safeParse(value) {
        value = parseInt(value, 10);
        return (+value + '') === value ? +value : value;
      }

      style = $.extend({}, this._options.style, style);
      style.borderRadiusValue = safeParse(style.borderRadius);
      style.fill = style.fill || style.color;
      style.doFill = style.fill && style.fillOpacity > 0;
      style.stroke = style.stroke || style.color;
      style.strokeWidthValue = safeParse(style.strokeWidth);
      style.doStroke = style.stroke && style.strokeOpacity > 0 && style.strokeWidthValue > 0;
      style.widthValue = safeParse(style.width);
      style.heightValue = safeParse(style.height);
      return style;
    },

    _drawLines: function (coordinates, close, style) {
      if (!coordinates || !coordinates.length || coordinates[0].length < 2) {
        return;
      }

      var i, j;
      style = this._getGraphicStyle(style);

      if (style.visibility != "hidden" && style.opacity > 0) {
        this._context.beginPath();

        for (i = 0; i < coordinates.length; i++) {
          this._context.moveTo(coordinates[i][0][0], coordinates[i][0][1]);
          for (j = 1; j < coordinates[i].length; j++) {
            this._context.lineTo(coordinates[i][j][0], coordinates[i][j][1]);
          }
        }

        if (close) {
          this._context.closePath();
        }

        if (close && style.doFill) {
          this._context.fillStyle = style.fill;
          this._context.globalAlpha = style.opacity * style.fillOpacity;
          this._context.fill();
        }

        if (style.doStroke) {
          this._context.lineCap = this._context.lineJoin = "round";
          this._context.lineWidth = style.strokeWidthValue;
          this._context.strokeStyle = style.stroke;

          this._context.globalAlpha = style.opacity * style.strokeOpacity;
          this._context.stroke();
        }

          //if ( this._options.doubleBuffer ) console.log("_drawLines:_end " + $.now());
        this._end( );
      }
    }
  });
}(jQuery));


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

      this._$contentFrame.append( '<ul style="position: absolute; bottom: 8px; left: 8px; list-style-type: none; max-width: 50%; padding: 0; margin: 0;"></ul>' );
      this._$attrList = this._$contentFrame.children( ":last" );

      this._$contentFrame.append('<div class="geo-draw-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$drawContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="geo-measure-container" style="' + contentPosCss + contentSizeCss + '"><span class="geo-measure-label" style="' + contentPosCss + '; display: none;"></span></div>');
      this._$measureContainer = this._$contentFrame.children(':last');
      this._$measureLabel = this._$measureContainer.children();

      this._$contentFrame.append('<div class="geo-shapes-container" style="' + contentPosCss + contentSizeCss + '"></div>');
      this._$shapesContainer = this._$contentFrame.children(':last');

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
      if (typeof(document.elementFromPoint) !== "undefined" && document.elementFromPoint(e.pageX, e.pageY).nodeName === "A") {
        return;
      }

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

          var scHtml = '<div data-geo-service="tiled" style="-webkit-transform:translateZ(0); position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0;"></div>';

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

      interactiveTransform: function ( map, service, center, pixelSize ) {
        //console.log( "tiled.interactiveTransform( " + center.join( ", " ) + ", " + pixelSize + ")" );
        var serviceState = $.data( service, "geoServiceState" ),
            tilingScheme = map.options[ "tilingScheme" ];

        if ( serviceState ) {
          this._cancelUnloaded( map, service );

          serviceState.serviceContainer.children( ).each( function ( i ) {
            var $scaleContainer = $(this),
                scalePixelSize = $scaleContainer.data("pixelSize"),
                scaleRatio = scalePixelSize / pixelSize;

            if ( scalePixelSize > 0 ) {
              scaleRatio = Math.round(scaleRatio * 1000) / 1000;

              var oldMapCoord = $scaleContainer.data("scaleOrigin"),
                  newPixelPoint = map._toPixel(oldMapCoord, center, pixelSize);

              $scaleContainer.css( {
                left: Math.round(newPixelPoint[0]) + "px",
                top: Math.round(newPixelPoint[1]) + "px",
                width: tilingScheme.tileWidth * scaleRatio,
                height: tilingScheme.tileHeight * scaleRatio
              } );

              /*
              if ( $("body")[0].filters !== undefined ) {
                $scaleContainer.children().each( function ( i ) {
                  $( this ).css( "filter", "progid:DXImageTransform.Microsoft.Matrix(FilterType=bilinear,M11=" + scaleRatio + ",M22=" + scaleRatio + ",sizingmethod='auto expand')" );
                } );
              }
              */
            }
          });
        }
      },

      refresh: function (map, service, force) {
        //console.log( "tiled.refresh( " + map._center.join( ", " ) + ", " + map._pixelSize + ")" );
        var serviceState = $.data( service, "geoServiceState" );

        this._cancelUnloaded(map, service);

        if ( serviceState && force ) {
          // if hidden atm, we want to make sure we reload this service after it becomes visible
          serviceState.reloadTiles = true;
        }

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
              scaleContainer = scaleContainers.filter("[data-pixel-size='" + pixelSize + "']").appendTo($serviceContainer),

              opacity = service.style.opacity,

              x, y,

              loadImageDeferredDone = function( url ) {
                // when a Deferred call is done, add the image to the map
                // a reference to the correct img element is on the Deferred object itself
                serviceObj._loadImage( $.data( this, "img" ), url, pixelSize, map, serviceState, opacity );
              },

              loadImageDeferredFail = function( ) {
                $.data( this, "img" ).remove( );
                serviceState.loadCount--;
                map._requestComplete();
              };

          if (serviceState.reloadTiles) {
            scaleContainers.find("img").attr("data-dirty", "true");
          }

          if (!scaleContainer.size()) {
            $serviceContainer.append("<div style='-webkit-transform:translateZ(0);position:absolute; left:" + serviceLeft % tileWidth + "px; top:" + serviceTop % tileHeight + "px; width:" + tileWidth + "px; height:" + tileHeight + "px; margin:0; padding:0;' data-pixel-size='" + pixelSize + "'></div>");
            scaleContainer = $serviceContainer.children(":last").data("scaleOrigin", map._toMap( [ (serviceLeft % tileWidth), (serviceTop % tileHeight) ] ) );
          } else {
            scaleContainer.css({
              left: (serviceLeft % tileWidth) + "px",
              top: (serviceTop % tileHeight) + "px"
            }).data("scaleOrigin", map._toMap( [ (serviceLeft % tileWidth), (serviceTop % tileHeight) ] ) );

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
                map._requestQueued();

                if (serviceState.reloadTiles && $img.size() > 0) {
                  $img.attr("src", imageUrl);
                } else {
                  var imgMarkup = "<img style='-webkit-transform:translateZ(0);position:absolute; " +
                    "left:" + (((x - fullXAtScale) * 100) + (serviceLeft - (serviceLeft % tileWidth)) / tileWidth * 100) + "%; " +
                    "top:" + (((y - fullYAtScale) * 100) + (serviceTop - (serviceTop % tileHeight)) / tileHeight * 100) + "%; ";

                  imgMarkup += "width: 100%; height: 100%;";

                  // #newpanzoom
                  /*
                  if ($("body")[0].filters === undefined) {
                    imgMarkup += "width: 100%; height: 100%;";
                  }
                  */

                  imgMarkup += "margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;' unselectable='on' data-tile='" + tileStr + "' />";

                  scaleContainer.append(imgMarkup);
                  $img = scaleContainer.children(":last");
                }

                if ( typeof imageUrl === "string" ) {
                  serviceObj._loadImage( $img, imageUrl, pixelSize, map, serviceState, opacity );
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
            map._requestComplete();
          }
        }
      },

      _loadImage: function ( $img, url, pixelSize, map, serviceState, opacity ) {
        var serviceContainer = serviceState.serviceContainer;

        $img.load(function (e) {
          if (opacity < 1) {
            $(e.target).fadeTo(0, opacity);
          } else {
            $(e.target).show();
          }

          serviceState.loadCount--;
          map._requestComplete();

          if (serviceState.loadCount <= 0) {
            serviceContainer.children(":not([data-pixel-size='" + pixelSize + "'])").remove();
            serviceState.loadCount = 0;
          }
        }).error(function (e) {
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
}(jQuery));

(function ($, undefined) {
  $.geo._serviceTypes.shingled = (function () {
    return {
      create: function (map, serviceContainer, service, index) {
        var serviceState = $.data(service, "geoServiceState");

        if ( !serviceState ) {
          serviceState = {
            loadCount: 0
          };

          var scHtml = '<div data-geo-service="shingled" style="-webkit-transform:translateZ(0);position:absolute; left:0; top:0; width:16px; height:16px; margin:0; padding:0;"></div>';

          serviceContainer.append(scHtml);

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
            mapHeight = contentBounds[ "height" ],

            halfWidth = mapWidth / 2,
            halfHeight = mapHeight / 2,

            bbox = [ center[ 0 ] - halfWidth, center[ 1 ] - halfHeight, center[ 0 ] + halfWidth, center[ 1 ] + halfHeight ];

        if ( serviceState ) {
          this._cancelUnloaded( map, service );

          serviceState.serviceContainer.children( ).each( function ( i ) {
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
            serviceContainer.append('<div style="-webkit-transform:translateZ(0);position:absolute; left:0px; top: 0px; width:' + mapWidth + 'px; height:' + mapHeight + 'px; margin:0; padding:0;" data-pixel-size="' + pixelSize + '" data-origin="[' + map._toMap( [ 0, 0 ] ) + ']"></div>');
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
            $.templates( "geoSrc", service[ urlProp ] );
            imageUrl = $.render[ "geoSrc" ]( urlArgs );
          }

          serviceState.loadCount++;
          map._requestQueued();

          scaleContainer.append('<img style="-webkit-transform:translateZ(0);position:absolute; left:' + ( imagePos.left / scaleContainer.width( ) * 100 ) + '%; top:' + ( imagePos.top / scaleContainer.height( ) * 100 ) + '%; width:100%; height:100%; margin:0; padding:0; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none; display:none;" unselectable="on" />');
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

      resize: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        if ( serviceState && service && service.style.visibility === "visible" ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              scaleContainers = serviceContainer.children();

          scaleContainers.attr("data-pixel-size", "0");

          scaleContainers.each( function ( i ) {
            var $scaleContainer = $(this),
                position = $scaleContainer.position( );

            var oldMapOrigin = $scaleContainer.data( "origin" ),
                newPixelPoint = map._toPixel( oldMapOrigin );

            $scaleContainer.css( {
              left: position.left + ( mapWidth - $scaleContainer.width( ) ) / 2,
              top: position.top + ( mapHeight - $scaleContainer.height( ) ) / 2
            } );

          } );
            

          /*
          scaleContainer.css({
            left: halfWidth + 'px',
            top: halfHeight + 'px'
          });
          */
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
}(jQuery));
