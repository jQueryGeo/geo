(function ($, undefined) {

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

