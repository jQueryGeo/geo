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
              isArray = $.isArray(coordinates[0]),
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

    _center: function (bbox) {
      // Envelope.centre in JTS
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
    // geometry functions
    //

    // bbox (Geometry.getEnvelope in JTS)

    _bbox: function (geom) {
      var result = $(geom).data("bbox");
      if (!result) {
        if (geom.bbox) {
          $(geom).data("bbox", (result = geom.bbox));
        } else {
          result = [pos_oo, pos_oo, neg_oo, neg_oo];

          var coordinates = this._allCoordinates(geom),
              curCoord = 0;

          for (; curCoord < coordinates.length; curCoord++) {
            result[0] = Math.min(coordinates[curCoord][0], result[0]);
            result[1] = Math.min(coordinates[curCoord][1], result[1]);
            result[2] = Math.max(coordinates[curCoord][0], result[2]);
            result[3] = Math.max(coordinates[curCoord][1], result[3]);
          }

          $(geom).data("bbox", result);
        }
      }
      return result;
    },

    // contains

    _contains: function (geom1, geom2) {
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

    _distance: function (geom1, geom2) {
      var geom1Coordinates = $.isArray(geom1) ? geom1 : geom1.coordinates,
          geom2Coordinates = $.isArray(geom2) ? geom2 : geom2.coordinates,
          geom1CoordinatesProjected = $.geo.proj ? $.geo.proj.fromGeodetic(geom1Coordinates) : geom1Coordinates,
          geom2CoordinatesProjected = $.geo.proj ? $.geo.proj.fromGeodetic(geom2Coordinates) : geom2Coordinates;

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
              throw new Error("not implemented");
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
              throw new Error("not implemented");
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
              throw new Error("not implemented");
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
      for (var i = 0; i < lineStringCoordinates2; i++) {
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
      var geometries = [];
      switch (geom.type) {
        case "Feature":
          $.merge(geometries, this._flatten(geom.geometry));
          break;

        case "GeometryCollection":
          for (curGeom = 0; curGeom < geom.geometries.length; curGeom++) {
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
    // projection functions
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
        fromGeodeticPos: function (coordinate) {
          var cur = webMercator.toProjected({ x: coordinate[0], y: coordinate[1] });
          return [cur.x, cur.y];
        },

        fromGeodetic: function (coordinates) {
          var 
          isArray = $.isArray(coordinates[0]),
          isDblArray = isArray && $.isArray(coordinates[0][0]),
          isTriArray = isDblArray && $.isArray(coordinates[0][0][0]),
          result = [[[]]],
          fromGeodeticPos = this.fromGeodeticPos;

          if (!isTriArray) {
            if (!isDblArray) {
              if (!isArray) {
                coordinates = [coordinates];
              }
              coordinates = [coordinates];
            }
            coordinates = [coordinates];
          }

          $.each(coordinates, function (i) {
            $.each(this, function (j) {
              $.each(this, function (k) {
                result[i][j][k] = fromGeodeticPos(this);
              });
            });
          });

          return isTriArray ? result : isDblArray ? result[0] : isArray ? result[0][0] : result[0][0][0];
        },

        toGeodeticPos: function (coordinate) {
          var cur = webMercator.toGeodetic({ x: coordinate[0], y: coordinate[1] });
          return [cur.x, cur.y];
        },

        toGeodetic: function (coordinates) {
          var 
          isArray = $.isArray(coordinates[0]),
          isDblArray = isArray && $.isArray(coordinates[0][0]),
          isTriArray = isDblArray && $.isArray(coordinates[0][0][0]),
          result = [[[]]],
          toGeodeticPos = this.toGeodeticPos;

          if (!isTriArray) {
            if (!isDblArray) {
              if (!isArray) {
                coordinates = [coordinates];
              }
              coordinates = [coordinates];
            }
            coordinates = [coordinates];
          }

          $.each(coordinates, function (i) {
            $.each(this, function (j) {
              $.each(this, function (k) {
                result[i][j][k] = toGeodeticPos(this);
              });
            });
          });

          return isTriArray ? result : isDblArray ? result[0] : isArray ? result[0][0] : result[0][0][0];
        }
      }
    })()
  }
})(jQuery, this);
