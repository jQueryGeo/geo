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
      return [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
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
      var c = this._center(bbox),
          dx = (bbox[2] - bbox[0]) * scale / 2,
          dy = (bbox[3] - bbox[1]) * scale / 2;
      return [c[0] - dx, c[1] - dy, c[0] + dx, c[1] + dy];
    },

    _width: function (bbox) {
      return bbox[2] - bbox[0];
    },

    //
    // geometry functions
    //

    // bbox (Geometry.getEnvelope in JTS)

    _bbox: function (geom) {
      var result = $.data(geom, "geoBbox");
      if (!result) {
        if (geom.bbox) {
          $.data(geom, "geoBbox", (result = geom.bbox));
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

          $.data(geom, "geoBbox", result);
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
      var halfPi = 1.5707963267948966192,
          quarterPi = 0.7853981633974483096,
          radiansPerDegree = 0.0174532925199432958,
          degreesPerRadian = 57.295779513082320877,
          semiMajorAxis = 6378137;
      
      return {
        fromGeodeticPos: function (coordinate) {
          return [
            semiMajorAxis * coordinate[0] * radiansPerDegree,
            semiMajorAxis * Math.log(Math.tan(quarterPi + coordinate[1] * radiansPerDegree / 2))
          ];
        },

        fromGeodetic: function (coordinates) {
          var isArray = $.isArray(coordinates[0]),
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
          return [
            (coordinate[0] / semiMajorAxis) * degreesPerRadian,
            (halfPi - 2 * Math.atan(1 / Math.exp(coordinate[1] / semiMajorAxis))) * degreesPerRadian
          ];
        },

        toGeodetic: function (coordinates) {
          var isArray = $.isArray(coordinates[0]),
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
