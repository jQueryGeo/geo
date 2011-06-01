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

(function() {

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
    return function() {
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
    init: function(opt_doc) {
      var doc = opt_doc || document;
      // Create a dummy element so that IE will allow canvas elements to be
      // recognized.
      doc.createElement('canvas');
      doc.attachEvent('onreadystatechange', bind(this.init_, this, doc));
    },

    init_: function(doc) {
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
    initElement: function(el) {
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
        el.firstChild.style.width =  el.clientWidth + 'px';
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
      el.firstChild.style.width =  el.clientWidth + 'px';
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

//  function copyState(o1, o2) {
//    o2.fillStyle     = o1.fillStyle;
//    o2.lineCap       = o1.lineCap;
//    o2.lineJoin      = o1.lineJoin;
//    o2.lineWidth     = o1.lineWidth;
//    o2.miterLimit    = o1.miterLimit;
//    o2.shadowBlur    = o1.shadowBlur;
//    o2.shadowColor   = o1.shadowColor;
//    o2.shadowOffsetX = o1.shadowOffsetX;
//    o2.shadowOffsetY = o1.shadowOffsetY;
//    o2.strokeStyle   = o1.strokeStyle;
//    o2.globalAlpha   = o1.globalAlpha;
//    o2.font          = o1.font;
//    o2.textAlign     = o1.textAlign;
//    o2.textBaseline  = o1.textBaseline;
//    o2.arcScaleX_    = o1.arcScaleX_;
//    o2.arcScaleY_    = o1.arcScaleY_;
//    o2.lineScale_    = o1.lineScale_;
//  }

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

  function hslToRgb(parts){
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
      str = /*colorData[styleString] ||*/ styleString;
    }
    return processStyleCache[styleString] = {color: str, alpha: alpha};
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
  contextPrototype.clearRect = function() {
    if (this.textMeasureEl_) {
      this.textMeasureEl_.removeNode(true);
      this.textMeasureEl_ = null;
    }
    this.element_.innerHTML = '';
  };

  contextPrototype.beginPath = function() {
    // TODO: Branch current matrix so that save/restore has no effect
    //       as per safari docs.
    this.currentPath_ = [];
  };

  contextPrototype.moveTo = function(aX, aY) {
    var p = getCoords(this, aX, aY);
    this.currentPath_.push({type: 'moveTo', x: p.x, y: p.y});
    this.currentX_ = p.x;
    this.currentY_ = p.y;
  };

  contextPrototype.lineTo = function(aX, aY) {
    var p = getCoords(this, aX, aY);
    this.currentPath_.push({type: 'lineTo', x: p.x, y: p.y});

    this.currentX_ = p.x;
    this.currentY_ = p.y;
  };

//  contextPrototype.bezierCurveTo = function(aCP1x, aCP1y,
//                                            aCP2x, aCP2y,
//                                            aX, aY) {
//    var p = getCoords(this, aX, aY);
//    var cp1 = getCoords(this, aCP1x, aCP1y);
//    var cp2 = getCoords(this, aCP2x, aCP2y);
//    bezierCurveTo(this, cp1, cp2, p);
//  };

//  // Helper function that takes the already fixed cordinates.
//  function bezierCurveTo(self, cp1, cp2, p) {
//    self.currentPath_.push({
//      type: 'bezierCurveTo',
//      cp1x: cp1.x,
//      cp1y: cp1.y,
//      cp2x: cp2.x,
//      cp2y: cp2.y,
//      x: p.x,
//      y: p.y
//    });
//    self.currentX_ = p.x;
//    self.currentY_ = p.y;
//  }

//  contextPrototype.quadraticCurveTo = function(aCPx, aCPy, aX, aY) {
//    // the following is lifted almost directly from
//    // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

//    var cp = getCoords(this, aCPx, aCPy);
//    var p = getCoords(this, aX, aY);

//    var cp1 = {
//      x: this.currentX_ + 2.0 / 3.0 * (cp.x - this.currentX_),
//      y: this.currentY_ + 2.0 / 3.0 * (cp.y - this.currentY_)
//    };
//    var cp2 = {
//      x: cp1.x + (p.x - this.currentX_) / 3.0,
//      y: cp1.y + (p.y - this.currentY_) / 3.0
//    };

//    bezierCurveTo(this, cp1, cp2, p);
//  };

  contextPrototype.arc = function(aX, aY, aRadius,
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

    this.currentPath_.push({type: arcType,
                           x: p.x,
                           y: p.y,
                           radius: aRadius,
                           xStart: pStart.x,
                           yStart: pStart.y,
                           xEnd: pEnd.x,
                           yEnd: pEnd.y});

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

  contextPrototype.stroke = function(aFill) {
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
    var min = {x: null, y: null};
    var max = {x: null, y: null};

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

  contextPrototype.fill = function() {
    this.stroke(true);
  };

  contextPrototype.closePath = function() {
    this.currentPath_.push({type: 'close'});
  };

  function getCoords(ctx, aX, aY) {
    var m = ctx.m_;
    return {
      x: Z * (aX * m[0][0] + aY * m[1][0] + m[2][0]) - Z2,
      y: Z * (aX * m[0][1] + aY * m[1][1] + m[2][1]) - Z2
    };
  };

//  contextPrototype.save = function() {
//    var o = {};
//    copyState(this, o);
//    this.aStack_.push(o);
//    this.mStack_.push(this.m_);
//    this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
//  };

//  contextPrototype.restore = function() {
//    if (this.aStack_.length) {
//      copyState(this.aStack_.pop(), this);
//      this.m_ = this.mStack_.pop();
//    }
//  };

//  function matrixIsFinite(m) {
//    return isFinite(m[0][0]) && isFinite(m[0][1]) &&
//        isFinite(m[1][0]) && isFinite(m[1][1]) &&
//        isFinite(m[2][0]) && isFinite(m[2][1]);
//  }

//  function setM(ctx, m, updateLineScale) {
//    if (!matrixIsFinite(m)) {
//      return;
//    }
//    ctx.m_ = m;

//    if (updateLineScale) {
//      // Get the line scale.
//      // Determinant of this.m_ means how much the area is enlarged by the
//      // transformation. So its square root can be used as a scale factor
//      // for width.
//      var det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
//      ctx.lineScale_ = sqrt(abs(det));
//    }
//  }

//  contextPrototype.translate = function(aX, aY) {
//    var m1 = [
//      [1,  0,  0],
//      [0,  1,  0],
//      [aX, aY, 1]
//    ];

//    setM(this, matrixMultiply(m1, this.m_), false);
//  };

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

//  contextPrototype.scale = function(aX, aY) {
//    this.arcScaleX_ *= aX;
//    this.arcScaleY_ *= aY;
//    var m1 = [
//      [aX, 0,  0],
//      [0,  aY, 0],
//      [0,  0,  1]
//    ];

//    setM(this, matrixMultiply(m1, this.m_), true);
//  };

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
    this.message = s +': DOM Exception ' + this.code;
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

      return [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
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
          var isArray = $.isArray(positions[0]), result = [], i = 0, cur;
          if (!isArray) {
            positions = [positions];
          }
          for (; i < positions.length; i++) {
            cur = webMercator.toProjected({ x: positions[i][0], y: positions[i][1] });
            result[i] = [cur.x, cur.y];
          }
          return isArray ? result : result[0];
        },

        toGeodetic: function (positions) {
          var isArray = $.isArray(positions[0]), result = [], i = 0, cur;
          if (!isArray) {
            positions = [positions];
          }
          for (; i < positions.length; i++) {
            cur = webMercator.toGeodetic({ x: positions[i][0], y: positions[i][1] });
            result[i] = [cur.x, cur.y];
          }
          return isArray ? result : result[0];
        }
      }
    })()
  }
})(jQuery, this);
﻿(function ($, undefined) {

  var 
  _$elem,
  _options,

  _width,
  _height,

  _$canvas,
  _context,

  _ieVersion = (function () {
    var v = 5, div = document.createElement("div"), a = div.all || [];
    while (div.innerHTML = "<!--[if gt IE " + (++v) + "]><br><![endif]-->", a[0]) { }
    return v > 6 ? v : !v;
  } ());

  $.widget("geo.geographics", {
    options: {
      style: {
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
      _$elem = this.element;
      _options = this.options;

      _$elem.css({ display: "inline-block", overflow: "hidden", textAlign: "left" });

      if (_$elem.css("position") == "static") {
        _$elem.css("position", "relative");
      }

      _width = _$elem.width();
      _height = _$elem.height();

      if (!(_width && _height)) {
        _width = parseInt(_$elem.css("width"));
        _height = parseInt(_$elem.css("height"));
      }

      if (document.createElement('canvas').getContext) {
        _$elem.append('<canvas width="' + _width + '" height="' + _height + '" style="position:absolute; left:0; top:0; width:' + _width + 'px; height:' + _height + 'px;"></canvas>');
        _$canvas = _$elem.children(':last');
        _context = _$canvas[0].getContext("2d");
      } else if (_ieVersion <= 8) {
        _$elem.append('<div width="' + _width + '" height="' + _height + '" style="position:absolute; left:0; top:0; width:' + _width + 'px; height:' + _height + 'px; margin:0; padding:0;"></div>');
        _$canvas = _$elem.children(':last');

        G_vmlCanvasManager.initElement(_$canvas[0]);
        _context = _$canvas[0].getContext("2d");
        _$canvas.children().css({ backgroundColor: "transparent", width: _width, height: _height });
      }
    },

    _setOption: function (key, value) {
      $.Widget.prototype._setOption.apply(this, arguments);
    },

    destroy: function () {
      $.Widget.prototype.destroy.apply(this, arguments);
      _$elem.html("");
    },

    clear: function () {
      _context.clearRect(0, 0, _width, _height);
    },

    drawArc: function (coordinates, startAngle, sweepAngle, style) {
      style = this._getGraphicStyle(style);

      if (style.widthValue > 0 && style.heightValue > 0) {

        startAngle = (startAngle * Math.PI / 180);
        sweepAngle = (sweepAngle * Math.PI / 180);

        var r = Math.round(Math.min(style.widthValue, style.heightValue) / 2);

        _context.beginPath();
        _context.arc(coordinates[0], coordinates[1], r, startAngle, sweepAngle, false);

        if (style.doFill) {
          _context.fillStyle = style.fill;
          _context.globalAlpha = style.opacity * style.fillOpacity;
          _context.fill();
        }

        if (style.doStroke) {
          _context.lineJoin = "round";
          _context.lineWidth = style.strokeWidthValue;
          _context.strokeStyle = style.stroke;

          _context.globalAlpha = style.opacity * style.strokeOpacity;
          _context.stroke();
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

      style = $.extend({}, _options.style, style);
      style.fill = style.fill || style.color;
      style.fillOpacity = style.fillOpacity || style.opacity;
      style.doFill = style.fill && style.fillOpacity > 0;
      style.stroke = style.stroke || style.color;
      style.strokeOpacity = style.strokeOpacity || style.opacity;
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

      var 
      style = this._getGraphicStyle(style),
      i, j;

      if (style.doFill) {
        _context.fillStyle = style.fill;
        _context.globalAlpha = style.opacity * style.fillOpacity;
        _context.beginPath();
        _context.moveTo(coordinates[0][0][0], coordinates[0][0][1]);

        var lastPoint = coordinates[0][coordinates[0].length - 1];

        for (i = 0; i < coordinates.length; i++) {
          for (j = 0; j < coordinates[i].length; j++) {
            _context.lineTo(coordinates[i][j][0], coordinates[i][j][1]);
          }

          if (i > 0) {
            _context.lineTo(lastPoint[0], lastPoint[1]);
          }
        }

        _context.closePath();

        _context.globalAlpha = style.opacity * style.fillOpacity;
        _context.fill();
      }

      if (style.doStroke) {
        _context.lineJoin = "round";
        _context.lineWidth = style.strokeWidthValue;
        _context.strokeStyle = style.stroke;

        _context.globalAlpha = style.opacity * style.strokeOpacity;

        for (i = 0; i < coordinates.length; i++) {
          _context.beginPath();
          _context.moveTo(coordinates[i][0][0], coordinates[i][0][1]);

          for (j = 0; j < coordinates[i].length; j++) {
            _context.lineTo(coordinates[i][j][0], coordinates[i][j][1]);
          }

          if (close) {
            _context.lineTo(coordinates[i][0][0], coordinates[i][0][1]);
          }

          _context.stroke();
        }
      }
    }
  });


})(jQuery);

﻿(function ($, undefined) {

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

