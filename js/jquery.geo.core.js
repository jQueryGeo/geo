(function ($, window, undefined) {
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
