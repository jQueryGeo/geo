(function ($, undefined) {

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
    _$labelsContainer: undefined,

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

      this._$elem.addClass( "geo-graphics" );

      this._width = this._$elem.width();
      this._height = this._$elem.height();

      if (!(this._width && this._height)) {
        this._width = parseInt(this._$elem.css("width"));
        this._height = parseInt(this._$elem.css("height"));
      }

      var posCss = 'position:absolute;left:0;top:0;margin:0;padding:0;',
          sizeCss = 'width:' + this._width + 'px;height:' + this._height + 'px;',
          sizeAttr = 'width="' + this._width + '" height="' + this._height + '"';

      if (document.createElement('canvas').getContext) {
        this._$elem.append('<canvas ' + sizeAttr + ' style="' + posCss + '"></canvas>');
        this._$canvas = this._$elem.children(':last');
        this._context = this._$canvas[0].getContext("2d");
      } else if (_ieVersion <= 8) {
        this._trueCanvas = false;
        this._$elem.append( '<div ' + sizeAttr + ' style="' + posCss + sizeCss + '"></div>');
        this._$canvas = this._$elem.children(':last');

        G_vmlCanvasManager.initElement(this._$canvas[0]);
        this._context = this._$canvas[0].getContext("2d");
        this._$canvas.children().css({ backgroundColor: "transparent", width: this._width, height: this._height });
      }

      this._$elem.append('<div class="geo-labels-container" style="' + posCss + sizeCss + '"></div>');
      this._$labelsContainer = this._$elem.children(':last');
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
      this._$labelsContainer.html("");
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

    drawLabel: function( coordinates, label ) {
      this._$labelsContainer.append( '<div class="geo-label" style="position:absolute; left:' + coordinates[ 0 ] + 'px; top:' + coordinates[ 1 ] + 'px;">' + label + '</div>');
    },

    resize: function( ) {
      this._width = this._$elem.width();
      this._height = this._$elem.height();

      if (!(this._width && this._height)) {
        this._width = parseInt(this._$elem.css("width"));
        this._height = parseInt(this._$elem.css("height"));
      }

      if ( this._trueCanvas ) {
        this._$canvas[0].width = this._width;
        this._$canvas[0].height = this._height;
      } else {
      }

      this._$labelsContainer.css( {
        width: this._width,
        height: this._height
      } );
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

