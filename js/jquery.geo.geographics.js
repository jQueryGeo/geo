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


        geographics._$labelsContainerBack.html( geographics._labelsHtml );

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

