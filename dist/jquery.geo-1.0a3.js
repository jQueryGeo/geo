// excanvas
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

/* 
 * AppGeo/geo 
 * (c) 2007-2011, Applied Geographics, Inc. All rights reserved. 
 * Dual licensed under the MIT or GPL Version 2 licenses. 
 * http://jquery.org/license 
 */ 
 

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
if (!$.widget) {
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
}﻿(function ($, window, undefined) {
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

    //
    // bbox functions
    //

    center: function (bbox, _ignoreGeo /* Internal Use Only */) {
      // Envelope.centre in JTS
      // bbox only, use centroid for geom
      if (!_ignoreGeo && $.geo.proj) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }
      var center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
      return !_ignoreGeo && $.geo.proj ? $.geo.proj.toGeodetic(center) : center;
    },

    expandBy: function (bbox, dx, dy) {
      if ($.geo.proj) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }
      bbox = [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
      return $.geo.proj ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    height: function (bbox, _ignoreGeo /* Internal Use Only */ ) {
      if (!_ignoreGeo && $.geo.proj) {
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

    reaspect: function (bbox, ratio, _ignoreGeo /* Internal Use Only */ ) {
      // not in JTS
      if (!_ignoreGeo && $.geo.proj) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }
      var width = this.width(bbox, true),
          height = this.height(bbox, true),
          center = this.center(bbox, true),
          dx, dy;

      if (width != 0 && height != 0 && ratio > 0) {
        if (width / height > ratio) {
          dx = width / 2;
          dy = dx / ratio;
        } else {
          dy = height / 2;
          dx = dy * ratio;
        }

        bbox = [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
      }
      return $.geo.proj ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    scaleBy: function ( bbox, scale, _ignoreGeo /* Internal Use Only */ ) {
      // not in JTS
      if (!_ignoreGeo && $.geo.proj) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }
      var c = this.center(bbox, true),
          dx = (bbox[2] - bbox[0]) * scale / 2,
          dy = (bbox[3] - bbox[1]) * scale / 2;
      bbox = [c[0] - dx, c[1] - dy, c[0] + dx, c[1] + dy];
      return !_ignoreGeo && $.geo.proj ? $.geo.proj.toGeodetic(bbox) : bbox;
    },

    width: function (bbox, _ignoreGeo /* Internal Use Only */ ) {
      if (!_ignoreGeo && $.geo.proj) {
        bbox = $.geo.proj.fromGeodetic(bbox);
      }
      return bbox[2] - bbox[0];
    },

    //
    // geometry functions
    //

    // bbox (Geometry.getEnvelope in JTS)

    bbox: function ( geom, _ignoreGeo /* Internal Use Only */ ) {
      if ( !geom ) {
        return undefined;
      } else if ( geom.bbox ) {
        result = !_ignoreGeo && $.geo.proj ? $.geo.proj.fromGeodetic( geom.bbox ) : geom.bbox;
      } else {
        result = [ pos_oo, pos_oo, neg_oo, neg_oo ];

        var coordinates = this._allCoordinates( geom ),
            curCoord = 0;

        if ( coordinates.length == 0 ) {
          return undefined;
        }

        if ( $.geo.proj ) {
          coordinates = $.geo.proj.fromGeodetic( coordinates );
        }

        for ( ; curCoord < coordinates.length; curCoord++ ) {
          result[0] = Math.min(coordinates[curCoord][0], result[0]);
          result[1] = Math.min(coordinates[curCoord][1], result[1]);
          result[2] = Math.max(coordinates[curCoord][0], result[2]);
          result[3] = Math.max(coordinates[curCoord][1], result[3]);
        }
      }

      return $.geo.proj ? $.geo.proj.toGeodetic(result) : result;
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
              i = 1, j, n;

          if ( !_ignoreGeo && $.geo.proj ) {
            coords = $.geo.proj.fromGeodetic(coords);
          }

          //if (coords[0][0] != coords[coords.length - 1][0] || coords[0][1] != coords[coords.length - 1][1]) {
          //  coords.push(coords[0]);
          //}

          for (; i <= coords.length; i++) {
            j = i % coords.length;
            n = (coords[i - 1][0] * coords[j][1]) - (coords[j][0] * coords[i - 1][1]);
            a += n;
            c[0] += (coords[i - 1][0] + coords[j][0]) * n;
            c[1] += (coords[i - 1][1] + coords[j][1]) * n;
          }

          if (a == 0) {
            if (coords.length > 0) {
              c[0] = coords[0][0];
              c[1] = coords[0][1];
              return { type: "Point", coordinates: !_ignoreGeo && $.geo.proj ? $.geo.proj.toGeodetic(c) : c };
            } else {
              return undefined;
            }
          }

          a *= 3;
          c[0] /= a;
          c[1] /= a;

          return { type: "Point", coordinates: !_ignoreGeo && $.geo.proj ? $.geo.proj.toGeodetic(c) : c };
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
      if (polygonCoordinates.length == 0 || polygonCoordinates[0].length < 4) {
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
      var geom1CoordinatesProjected = !_ignoreGeo && $.geo.proj ? $.geo.proj.fromGeodetic(geom1.coordinates) : geom1.coordinates,
          geom2CoordinatesProjected = !_ignoreGeo && $.geo.proj ? $.geo.proj.fromGeodetic(geom2.coordinates) : geom2.coordinates;

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

            if (d == 0) {
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
          var points = []

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
        var pointString = wkt.match(/\(\s*([\d\.-]+)\s+([\d\.-]+)\s*\)/);
        return pointString && pointString.length >= 2 ? {
          type: "Point",
          coordinates: [
            parseFloat(pointString[1]),
            parseFloat(pointString[2])
          ]
        } : null;
      }

      function parse(wkt) {
        wkt = $.trim(wkt);

        var typeIndex = wkt.indexOf(" ");

        switch (wkt.substr(0, typeIndex).toUpperCase()) {
          case "POINT":
            return pointParseUntagged(wkt.substr(typeIndex + 1));
        }
      }

      return {
        stringify: stringify,

        parse: parse
      };
    })(),

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
          if (!coordinate) {
            debugger;
          }
          return [
            semiMajorAxis * coordinate[ 0 ] * radiansPerDegree,
            semiMajorAxis * Math.log(Math.tan(quarterPi + coordinate[ 1 ] * radiansPerDegree / 2))
          ];
        },

        fromGeodetic: function (coordinates) {
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
                result = [ ];

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
      }
    })(),

    //
    // service types (defined in other files)
    //

    _serviceTypes: {}
  }
})(jQuery, this);
﻿(function ($, undefined) {

  var _ieVersion = (function () {
    var v = 5, div = document.createElement("div"), a = div.all || [];
    while (div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->", a[0]) { }
    return v > 6 ? v : !v;
  } ());

  $.widget("geo.geographics", {
    _$elem: undefined,
    _options: {},
    _trueCanvas: true,

    _width: 0,
    _height: 0,

    _$canvas: undefined,
    _context: undefined,

    options: {
      style: {
        borderRadius: "8px",
        color: "#7f0000",
        //fill: undefined,
        fillOpacity: .2,
        height: "8px",
        opacity: 1,
        //stroke: undefined,
        strokeOpacity: 1,
        strokeWidth: "2px",
        visibility: "visible",
        width: "8px"
      }
    },

    _create: function () {
      this._$elem = this.element;
      this._options = this.options;

      this._$elem.css({ display: "inline-block", overflow: "hidden", textAlign: "left" });

      if (this._$elem.css("position") == "static") {
        this._$elem.css("position", "relative");
      }

      this._width = this._$elem.width();
      this._height = this._$elem.height();

      if (!(this._width && this._height)) {
        this._width = parseInt(this._$elem.css("width"));
        this._height = parseInt(this._$elem.css("height"));
      }

      if (document.createElement('canvas').getContext) {
        this._$elem.append('<canvas width="' + this._width + '" height="' + this._height + '" style="position:absolute; left:0; top:0; width:' + this._width + 'px; height:' + this._height + 'px;"></canvas>');
        this._$canvas = this._$elem.children(':last');
        this._context = this._$canvas[0].getContext("2d");
      } else if (_ieVersion <= 8) {
        this._trueCanvas = false;
        this._$elem.append('<div width="' + this._width + '" height="' + this._height + '" style="position:absolute; left:0; top:0; width:' + this._width + 'px; height:' + this._height + 'px; margin:0; padding:0;"></div>');
        this._$canvas = this._$elem.children(':last');

        G_vmlCanvasManager.initElement(this._$canvas[0]);
        this._context = this._$canvas[0].getContext("2d");
        this._$canvas.children().css({ backgroundColor: "transparent", width: this._width, height: this._height });
      }
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
    },

    clear: function () {
      this._context.clearRect(0, 0, this._width, this._height);
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
    },

    drawPoint: function (coordinates, style) {
      var style = this._getGraphicStyle(style);
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
      }
    },

    drawLineString: function (coordinates, style) {
      this._drawLines([coordinates], false, style);
    },

    drawPolygon: function (coordinates, style) {
      this._drawLines(coordinates, true, style);
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

    _getGraphicStyle: function (style) {
      function safeParse(value) {
        value = parseInt(value);
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

      var style = this._getGraphicStyle(style),
          i, j;

      if (style.visibility != "hidden" && style.opacity > 0) {
        this._context.beginPath();
        this._context.moveTo(coordinates[0][0][0], coordinates[0][0][1]);

        for (i = 0; i < coordinates.length; i++) {
          for (j = 0; j < coordinates[i].length; j++) {
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
      }
    }
  });


})(jQuery);

﻿(function ($, undefined) {
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
          pan: "move",
          zoom: "crosshair",
          drawPoint: "crosshair",
          drawLineString: "crosshair",
          drawPolygon: "crosshair"
        },
        drawStyle: {},
        shapeStyle: {},
        mode: "pan",
        services: [
            {
              "class": "osm",
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
        pixelSize: 0
      };

  $.widget("geo.geomap", {
    // private widget members
    _$elem: undefined,
    _created: false,

    _contentBounds: {},

    _$contentFrame: undefined,
    _$existingChildren: undefined,
    _$servicesContainer: undefined,
    _$drawContainer: undefined,
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

    _drawTimeout: null, //< used in drawPoint mode so we don't send two shape events on dbltap
    _drawPixels: [], //< an array of coordinate arrays for drawing lines & polygons, in pixel coordinates
    _drawCoords: [],

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

      this._graphicShapes = [];

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

      $(document).keydown($.proxy(this._document_keydown, this));

      this._$eventTarget.dblclick($.proxy(this._eventTarget_dblclick, this));

      this._$eventTarget.bind(touchStartEvent, $.proxy(this._eventTarget_touchstart, this));

      var dragTarget = (this._$eventTarget[0].setCapture) ? this._$eventTarget : $(document);
      dragTarget.bind(touchMoveEvent, $.proxy(this._dragTarget_touchmove, this));
      dragTarget.bind(touchStopEvent, $.proxy(this._dragTarget_touchstop, this));

      this._$eventTarget.mousewheel($.proxy(this._eventTarget_mousewheel, this));

      var geomap = this;
      this._windowHandler = function () {
        if (geomap._resizeTimeout) {
          clearTimeout(geomap._resizeTimeout);
        }
        this._resizeTimeout = setTimeout(function () {
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

      this._created = true;
    },

    _setOption: function (key, value, refresh) {
      if ( this._$elem.is( "[data-geo-service]" ) || key == "pixelSize" ) {
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
        case "services":
          this._createServices();
          if (refresh) {
            this._refresh();
          }
          break;

        case "shapeStyle":
          if ( refresh ) {
            this._$shapesContainer.geographics("clear");
            this._refreshShapes( this._$shapesContainer, this._graphicShapes, this._graphicShapes );
          }
          break;
      }
    },

    destroy: function () {
      if (this._$elem.is("[data-geo-map]")) {
        this._created = false;

        $(window).unbind("resize", this._windowHandler);

        for ( var i = 0; i < this._currentServices.length; i++ ) {
          this._currentServices[i].serviceContainer.geomap("destroy");
          $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
        }

        this._$shapesContainer.geographics("destroy");
        this._$drawContainer.geographics("destroy");

        this._$existingChildren.detach();
        this._$elem.html("");
        this._$elem.append(this._$existingChildren);
        this._$elem.removeAttr("data-geo-map");
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
      if (this._$elem.is("[data-geo-service]")) {
        this._$elem.closest("[data-geo-map]").geomap("opacity", value, this._$elem);
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
      if (this._$elem.is("[data-geo-service]")) {
        this._$elem.closest("[data-geo-map]").geomap("toggle", value, this._$elem);
      } else {
        for (var i = 0; i < this._currentServices.length; i++) {
          var service = this._currentServices[i];
          if (!_serviceContainer || service.serviceContainer[0] == _serviceContainer[0]) {
            if (value === undefined) {
              value = (service.visibility === undefined || service.visibility === "visible" ? false : true);
            }

            this._options["services"][i].visibility = service.visibility = ( value ? "visible" : "hidden" );
            $.geo["_serviceTypes"][service.type].toggle(this, service);

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

      var shapeStyle = this._$shapesContainer.geographics("option", "style");

      this._$shapesContainer.geographics("destroy");
      this._$drawContainer.geographics("destroy");

      for (i = 0; i < this._currentServices.length; i++) {
        $.geo["_serviceTypes"][this._currentServices[i].type].resize(this, this._currentServices[i]);
      }


      this._$drawContainer.css({
        width: size.width,
        height: size.height
      });
      this._$drawContainer.geographics();

      this._$shapesContainer.css({
        width: size.width,
        height: size.height
      });
      this._$shapesContainer.geographics( { style: shapeStyle } );

      for (i = 0; i < this._drawPixels.length; i++) {
        this._drawPixels[i][0] += dx;
        this._drawPixels[i][1] += dy;
      }

      this._setCenterAndSize(this._center, this._pixelSize, false, true);
    },

    append: function ( shape, style, refresh ) {
      if ( shape ) {
        var shapes, i = 0;
        if ( shape.type == "FeatureCollection" ) {
          shapes = shape.features;
        } else {
          shapes = $.isArray( shape ) ? shape : [ shape ];
        }

        if ( typeof style === "boolean" ) {
          refresh = style;
          style = null;
        }

        for ( ; i < shapes.length; i++ ) {
          if ( shapes[ i ].type != "Point" ) {
            var bbox = $.geo.bbox( shapes[ i ] );
            if ( $.geo.proj ) {
              bbox = $.geo.proj.fromGeodetic( bbox );
            }
            $.data( shapes[ i ], "geoBbox", bbox );
          }

          this._graphicShapes.push( {
            shape: shapes[ i ],
            style: style
          } );
        }

        if ( refresh === undefined || refresh ) {
          this._refresh( );
        }
      }
    },

    empty: function ( refresh ) {
      $.each( this._graphicShapes, function( ) {
        $.removeData( this, "geoBbox" );
      } );
      this._graphicShapes = [];
      if ( refresh === undefined || refresh ) {
        this._refresh();
      }
    },

    find: function (point, pixelTolerance) {
      var searchPixel = this.toPixel( point.coordinates ),
          mapTol = this._pixelSize * pixelTolerance,
          result = [],
          curGeom;

      $.each( this._graphicShapes, function ( i ) {
        if ( this.shape.type == "Point" ) {
          if ( $.geo.distance(this.shape, point) <= mapTol ) {
            result.push( this.shape );
          }
        } else {
          var bbox = $.data( this.shape, "geoBbox" ),
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
            var geometries = $.geo._flatten( this.shape );
            for ( curGeom = 0; curGeom < geometries.length; curGeom++ ) {
              if ( $.geo.distance( geometries[curGeom], point ) <= mapTol ) {
                result.push( this.shape );
                break;
              }
            }
          }
        }
      });

      return result;
    },

    remove: function ( shape, refresh ) {
      var geomap = this;
      $.each( this._graphicShapes, function ( i ) {
        if ( this.shape == shape ) {
          $.removeData( shape, "geoBbox" );
          var rest = geomap._graphicShapes.slice( i + 1 );
          geomap._graphicShapes.length = i;
          geomap._graphicShapes.push.apply(geomap._graphicShapes, rest);
          return false;
        }
      });

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

      this._$elem.prepend("<div style='position:absolute; left:" + this._contentBounds.x + "px; top:" + this._contentBounds.y + "px; width:" + this._contentBounds["width"] + "px; height:" + this._contentBounds["height"] + "px; margin:0; padding:0; overflow:hidden; -khtml-user-select:none; -moz-user-select:none; -webkit-user-select:none; user-select:none;' unselectable='on'></div>");
      this._$eventTarget = this._$contentFrame = this._$elem.children(':first');

      this._$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + this._contentBounds["width"] + 'px; height:' + this._contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
      this._$servicesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + this._contentBounds["width"] + 'px; height:' + this._contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
      this._$shapesContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div style="position:absolute; left:0; top:0; width:' + this._contentBounds["width"] + 'px; height:' + this._contentBounds["height"] + 'px; margin:0; padding:0;"></div>');
      this._$drawContainer = this._$contentFrame.children(':last');

      this._$contentFrame.append('<div class="ui-widget ui-widget-content ui-corner-all" style="position:absolute; left:0; top:0px; max-width:128px; display:none;"><div style="margin:.2em;"></div></div>');
      this._$textContainer = this._$contentFrame.children(':last');
      this._$textContent = this._$textContainer.children();

      this._$contentFrame.append(this._$existingChildren);
    },

    _createServices: function () {
      var i;

      for (i = 0; i < this._currentServices.length; i++) {
        this._currentServices[i].serviceContainer.geomap("destroy");
        $.geo["_serviceTypes"][this._currentServices[i].type].destroy(this, this._$servicesContainer, this._currentServices[i]);
      }

      this._currentServices = [];
      for (i = 0; i < this._options["services"].length; i++) {
        this._currentServices[i] = this._options["services"][i];
        this._currentServices[i].serviceContainer = $.geo["_serviceTypes"][this._currentServices[i].type].create(this, this._$servicesContainer, this._currentServices[i], i).geomap();
      }
    },

    _refreshDrawing: function () {
      this._$drawContainer.geographics("clear");

      if ( this._drawPixels.length > 0 ) {
        var mode = this._options[ "mode" ],
            coords = this._drawPixels;

        if ( mode == "drawPolygon" ) {
          coords = [ coords ];
        }

        this._$drawContainer.geographics( mode, coords );
      }
    },

    _resetDrawing: function () {
      //this._$textContainer.hide();
      this._drawPixels = [];
      this._drawCoords = [];
      this._$drawContainer.geographics("clear");
    },

    _refreshShapes: function (geographics, shapes, styles, center, pixelSize) {
      var i,
          mgi,
          shape,
          shapeBbox,
          style,
          pixelPositions,
          bbox = this._getBbox(center, pixelSize),
          geomap = this;

      for (i = 0; i < shapes.length; i++) {
        shape = shapes[i].shape || shapes[i];
        shape = shape.geometry || shape;
        shapeBbox = $.data(shape, "geoBbox");

        if ( shapeBbox && $.geo._bboxDisjoint( bbox, shapeBbox ) ) {
          continue;
        }

        style = $.isArray(styles) ? styles[i].style : styles;

         switch (shape.type) {
          case "Point":
            this._$shapesContainer.geographics("drawPoint", this.toPixel(shape.coordinates, center, pixelSize), style);
            break;
          case "LineString":
            this._$shapesContainer.geographics("drawLineString", this.toPixel(shape.coordinates, center, pixelSize), style);
            break;
          case "Polygon":
            pixelPositions = [];
            $.each(shape.coordinates, function (i) {
              pixelPositions[i] = geomap.toPixel(this, center, pixelSize);
            });
            this._$shapesContainer.geographics("drawPolygon", pixelPositions, style);
            break;
          case "MultiPoint":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              this._$shapesContainer.geographics("drawPoint", this.toPixel(shape.coordinates[mgi], center, pixelSize), style);
            }
            break;
          case "MultiLineString":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              this._$shapesContainer.geographics("drawLineString", this.toPixel(shape.coordinates[mgi], center, pixelSize), style);
            }
            break;
          case "MultiPolygon":
            for (mgi = 0; mgi < shape.coordinates; mgi++) {
              pixelPositions = [];
              $.each(shape.coordinates[mgi], function (i) {
                pixelPositions[i] = geomap.toPixel(this, center, pixelSize);
              });
              this._$shapesContainer.geographics("drawPolygon", pixelPositions, style);
            }
            break;

          case "GeometryCollection":
            geomap._refreshShapes(geographics, shape.geometries, style, center, pixelSize);
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
      var dx = this._current[0] - this._lastDrag[0],
          dy = this._current[1] - this._lastDrag[1],
          i = 0,
          service;

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
            service = this._options["services"][i];
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

          for (i = 0; i < this._drawPixels.length; i++) {
            this._drawPixels[i][0] += dx;
            this._drawPixels[i][1] += dy;
          }

          this._refreshDrawing();
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
          this._refreshShapes(this._$shapesContainer, this._graphicShapes, this._graphicShapes);
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
      var isArray = $.isArray(p[0]);
      if (!isArray) {
        p = [p];
      }

      center = center || this._center;
      pixelSize = pixelSize || this._pixelSize;

      var width = this._contentBounds["width"],
          height = this._contentBounds["height"],
          halfWidth = width / 2 * pixelSize,
          halfHeight = height / 2 * pixelSize,
          bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight],
          xRatio = $.geo.width(bbox, true) / width,
          yRatio = $.geo.height(bbox, true) / height,
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
        bboxWidth = $.geo.width(bbox, true),
        bboxHeight = $.geo.height(bbox, true),
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
      this._panFinalize();

      if (this._drawTimeout) {
        window.clearTimeout(this._drawTimeout);
        this._drawTimeout = null;
      }

      var offset = $(e.currentTarget).offset();

      switch (this._options["mode"]) {
        case "pan":
        case "drawPoint":
          this._eventTarget_dblclick_zoom(e);
          break;

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
      }

      this._inOp = false;
    },

    _eventTarget_touchstart: function (e) {
      if (!this._supportTouch && e.which != 1) {
        return;
      }

      this._panFinalize();
      this._mouseWheelFinish();

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
      } else {
        this._inOp = true;

        switch (this._options["mode"]) {
          case "pan":
          case "drawPoint":
          case "drawLineString":
          case "drawPolygon":
            this._lastDrag = this._current;

            if (e.currentTarget.setCapture) {
              e.currentTarget.setCapture();
            }

            break;
        }
      }

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _dragTarget_touchmove: function (e) {
      var offset = this._$eventTarget.offset(),
          drawCoordsLen = this._drawCoords.length,
          current;

      if (this._supportTouch) {
        current = [e.originalEvent.changedTouches[0].pageX - offset.left, e.originalEvent.changedTouches[0].pageY - offset.top];
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

        case "pan":
        case "drawPoint":
          if (this._mouseDown || this._toolPan) {
            this._panMove();
          } else {
            this._trigger("move", e, { type: "Point", coordinates: this.toMap(current) });
          }
          break;

        case "drawLineString":
        case "drawPolygon":
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
      }

      this._lastMove = current;

      if ( this._inOp ) {
        e.preventDefault();
        return false;
      }
    },

    _dragTarget_touchstop: function (e) {
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
                    geomap._drawTimeout = false;
                  }
                }, 250);
              }
            }
            break;

          case "drawLineString":
          case "drawPolygon":
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
      e.preventDefault();

      this._panFinalize();

      if (this._mouseDown) {
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

        var wheelCenterAndSize = this._getZoomCenterAndSize(this._anchor, this._wheelLevel, this._wheelZoomFactor);

        this._$shapesContainer.geographics("clear");

        for (i = 0; i < this._options["services"].length; i++) {
          var service = this._options["services"][i];
          $.geo["_serviceTypes"][service.type].interactiveScale(this, service, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
        }

        this._$shapesContainer.geographics("clear");
        if (this._graphicShapes.length > 0 && this._graphicShapes.length < 256) {
          this._refreshShapes(this._$shapesContainer, this._graphicShapes, this._graphicShapes, wheelCenterAndSize.center, wheelCenterAndSize.pixelSize);
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

﻿(function ($, undefined) {
  $.geo._serviceTypes.tiled = (function () {
    return {
      create: function (map, servicesContainer, service, index) {
        var serviceState = $.data(service, "geoServiceState");

        if ( !serviceState ) {
          serviceState = {
            loadCount: 0,
            reloadTiles: false
          };

          var idString = service.id ? ' id="' + service.id + '"' : "",
              classString = service["class"] ? ' class="' + service["class"] + '"' : "",
              scHtml = '<div data-geo-service="tiled"' + idString + classString + ' style="position:absolute; left:0; top:0; width:8px; height:8px; margin:0; padding:0; display:' + (service.visibility === undefined || service.visibility === "visible" ? "block" : "none") + ';"></div>';

          servicesContainer.append(scHtml);

          serviceState.serviceContainer = servicesContainer.children(":last");
          $.data(service, "geoServiceState", serviceState);
        }

        return serviceState.serviceContainer;
      },

      destroy: function (map, servicesContainer, service) {
        var serviceState = $.data(service, "geoServiceState");

        serviceState.serviceContainer.remove();

        $.removeData(service, "geoServiceState");
      },

      interactivePan: function ( map, service, dx, dy ) {
        var serviceState = $.data( service, "geoServiceState" );

        if ( serviceState ) {
          this._cancelUnloaded( map, service );

          serviceState.serviceContainer.children( ).css( {
            left: function ( index, value ) {
              return parseInt( value ) + dx;
            },
            top: function ( index, value ) {
              return parseInt( value ) + dy;
            }
          });

          if ( service && ( service.visibility === undefined || service.visibility === "visible" ) ) {
            var pixelSize = map._pixelSize,

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

            for ( x = tileX; x < tileX2; x++ ) {
              for ( y = tileY; y < tileY2; y++ ) {
                var tileStr = "" + x + "," + y,
                    $img = scaleContainer.children("[data-tile='" + tileStr + "']").removeAttr("data-dirty");

                if ( $img.size( ) === 0 ) {
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

                      imageUrl = service.getUrl( {
                        bbox: tileBbox,
                        width: tileWidth,
                        height: tileHeight,
                        zoom: map._getZoom(),
                        tile: {
                          row: y,
                          column: x
                        },
                        index: Math.abs(y + x)
                      } );
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
        }
      },

      interactiveScale: function (map, service, center, pixelSize) {
        var serviceState = $.data( service, "geoServiceState" );

        if ( serviceState && service && ( service.visibility === undefined || service.visibility === "visible" ) ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,

              tilingScheme = map.options["tilingScheme"],
              tileWidth = tilingScheme.tileWidth,
              tileHeight = tilingScheme.tileHeight;


          serviceContainer.children( ).each( function ( i ) {
            var $scaleContainer = $(this),
                scaleRatio = $scaleContainer.attr("data-pixelSize") / pixelSize;

            scaleRatio = Math.round(scaleRatio * 1000) / 1000;

            var scaleOriginParts = $scaleContainer.data("scaleOrigin").split(","),
                oldMapCoord = map._toMap([scaleOriginParts[0], scaleOriginParts[1]]),
                newPixelPoint = map._toPixel(oldMapCoord, center, pixelSize);

            $scaleContainer.css( {
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

        if ( serviceState && service && ( service.visibility === undefined || service.visibility === "visible" ) ) {
          this._cancelUnloaded(map, service);

          var bbox = map._getBbox(),
              pixelSize = map._pixelSize,

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

      resize: function (map, service) {
      },

      opacity: function (map, service) {
        var serviceState = $.data( service, "geoServiceState" );
        serviceState.serviceContainer.find("img").stop(true).fadeTo("fast", service.opacity);
      },

      toggle: function (map, service) {
        var serviceState = $.data( service, "geoServiceState" );
        serviceState.serviceContainer.css("display", service.visibility === "visible" ? "block" : "none");
      },

      _cancelUnloaded: function (map, service) {
        var serviceState = $.data( service, "geoServiceState" );

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
﻿(function ($, undefined) {
  $.geo._serviceTypes.shingled = (function () {
    return {
      create: function (map, servicesContainer, service, index) {
        var serviceState = $.data(service, "geoServiceState");

        if ( !serviceState ) {
          serviceState = {
            loadCount: 0
          };

          var idString = service.id ? ' id="' + service.id + '"' : "",
              classString = service["class"] ? ' class="' + service["class"] + '"' : "",
              scHtml = '<div data-geo-service="shingled"' + idString + classString + ' style="position:absolute; left:0; top:0; width:16px; height:16px; margin:0; padding:0; display:' + (service.visibility === undefined || service.visibility === "visible" ? "block" : "none") + ';"></div>';

          servicesContainer.append(scHtml);

          serviceState.serviceContainer = servicesContainer.children(":last");
          $.data(service, "geoServiceState", serviceState);
        }

        return serviceState.serviceContainer;
      },

      destroy: function (map, servicesContainer, service) {
        var serviceState = $.data(service, "geoServiceState");

        serviceState.serviceContainer.remove();

        $.removeData(service, "geoServiceState");
      },

      interactivePan: function (map, service, dx, dy) {
        var serviceState = $.data(service, "geoServiceState");

        if ( serviceState ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,
              pixelSize = map._pixelSize,
              scaleContainer = serviceContainer.children("[data-pixelSize='" + pixelSize + "']"),
              panContainer = scaleContainer.children("div");

          if ( !panContainer.length ) {
            scaleContainer.children("img").wrap('<div style="position:absolute; left:0; top:0; width:100%; height:100%;"></div>');
            panContainer = scaleContainer.children("div");
          }

          panContainer.css( {
            left: function (index, value) {
              return parseInt(value) + dx;
            },
            top: function (index, value) {
              return parseInt(value) + dy;
            }
          } );
        }
      },

      interactiveScale: function (map, service, center, pixelSize) {
        var serviceState = $.data(service, "geoServiceState");

        if ( serviceState ) {
          this._cancelUnloaded(map, service);

          var serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              halfWidth = mapWidth / 2,
              halfHeight = mapHeight / 2,

              bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight];

          serviceContainer.children().each(function (i) {
            var $scaleContainer = $(this),
                scalePixelSize = $scaleContainer.attr("data-pixelSize"),
                ratio = scalePixelSize / pixelSize;

            $scaleContainer.css({ width: mapWidth * ratio, height: mapHeight * ratio }).children("img").each(function (i) {
              var $img = $(this),
                  imgCenter = $img.data("center"),
                  x = (Math.round((imgCenter[0] - center[0]) / scalePixelSize) - halfWidth) * ratio,
                  y = (Math.round((center[1] - imgCenter[1]) / scalePixelSize) - halfHeight) * ratio;

              $img.css({ left: x + "px", top: y + "px" });
            });
          });
        }
      },

      refresh: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        if (serviceState && service && (service.visibility === undefined || service.visibility === "visible")) {
          this._cancelUnloaded(map, service);

          var bbox = map._getBbox(),
              pixelSize = map._pixelSize,

              serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              halfWidth = mapWidth / 2,
              halfHeight = mapHeight / 2,

              scaleContainer = serviceContainer.children('[data-pixelSize="' + pixelSize + '"]'),

              opacity = (service.opacity === undefined ? 1 : service.opacity),

              $img;

          if ( !scaleContainer.size() ) {
            serviceContainer.append('<div style="position:absolute; left:' + halfWidth + 'px; top:' + halfHeight + 'px; width:' + mapWidth + 'px; height:' + mapHeight + 'px; margin:0; padding:0;" data-pixelSize="' + pixelSize + '"></div>');
            scaleContainer = serviceContainer.children(":last");
          }

          scaleContainer.children("img").each(function (i) {
            var $thisimg = $(this),
                imgCenter = $thisimg.data("center"),
                center = map._getCenter(),
                x = Math.round((imgCenter[0] - center[0]) / pixelSize) - halfWidth,
                y = Math.round((center[1] - imgCenter[1]) / pixelSize) - halfHeight;

            $thisimg.css({ left: x + "px", top: y + "px" });
          });

          if (opacity < 1) {
            serviceContainer.find("img").attr("data-keepAlive", "0");
          }

          var imageUrl = service.getUrl({
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
          $img = scaleContainer.children(":last").data("center", map._getCenter());
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
                  var $thisimg = $(this),
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

      resize: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        if ( serviceState && service && (service.visibility === undefined || service.visibility === "visible")) {
          this._cancelUnloaded(map, service);

          var serviceState = shingledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              halfWidth = mapWidth / 2,
              halfHeight = mapHeight / 2,

              scaleContainer = serviceContainer.children();

          scaleContainer.attr("data-pixelSize", "0");
          scaleContainer.css({
            left: halfWidth + 'px',
            top: halfHeight + 'px'
          });
        }
      },

      opacity: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");
        serviceState.serviceContainer.find("img").stop(true).fadeTo("fast", service.opacity);
      },

      toggle: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");
        serviceState.serviceContainer.css("display", service.visibility === "visible" ? "block" : "none");
      },

      _cancelUnloaded: function (map, service) {
        var serviceState = $.data(service, "geoServiceState");

        if (serviceState && serviceState.loadCount > 0) {
          serviceState.serviceContainer.find("img:hidden").remove();
          while (serviceState.loadCount > 0) {
            serviceState.loadCount--;
          }
        }
      }
    }
  })();
})(jQuery);
