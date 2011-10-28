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

    bbox: function (geom) {
      var result = $.data(geom, "geoBbox");
      if (!result) {
        if (geom.bbox) {
          $.data(geom, "geoBbox", (result = geom.bbox));
        } else {
          result = [pos_oo, pos_oo, neg_oo, neg_oo];

          var coordinates = this._allCoordinates(geom),
              curCoord = 0;

          if (coordinates.length == 0) {
            return undefined;
          }

          if ($.geo.proj) {
            coordinates = $.geo.proj.fromGeodetic(coordinates);
          }

          for (; curCoord < coordinates.length; curCoord++) {
            result[0] = Math.min(coordinates[curCoord][0], result[0]);
            result[1] = Math.min(coordinates[curCoord][1], result[1]);
            result[2] = Math.max(coordinates[curCoord][0], result[2]);
            result[3] = Math.max(coordinates[curCoord][1], result[3]);
          }

          $.data(geom, "geoBbox", result);
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
          return [
            semiMajorAxis * coordinate[0] * radiansPerDegree,
            semiMajorAxis * Math.log(Math.tan(quarterPi + coordinate[1] * radiansPerDegree / 2))
          ];
        },

        fromGeodetic: function (coordinates) {
          var isArray = $.isArray(coordinates[0]),
              fromGeodeticPos = this.fromGeodeticPos;

          if (!isArray && coordinates.length == 4) {
            // bbox
            var min = fromGeodeticPos([coordinates[0], coordinates[1]]),
                max = fromGeodeticPos([coordinates[2], coordinates[3]]);
            return [min[0], min[1], max[0], max[1]];
          } else {
            // geometry
            var isDblArray = isArray && $.isArray(coordinates[0][0]),
                isTriArray = isDblArray && $.isArray(coordinates[0][0][0]),
                result = [[[]]];

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
          }
        },

        toGeodeticPos: function (coordinate) {
          return [
            (coordinate[0] / semiMajorAxis) * degreesPerRadian,
            (halfPi - 2 * Math.atan(1 / Math.exp(coordinate[1] / semiMajorAxis))) * degreesPerRadian
          ];
        },

        toGeodetic: function (coordinates) {
          var isArray = $.isArray(coordinates[0]),
              toGeodeticPos = this.toGeodeticPos;

          if (!isArray && coordinates.length == 4) {
            // bbox
            var min = toGeodeticPos([coordinates[0], coordinates[1]]),
                max = toGeodeticPos([coordinates[2], coordinates[3]]);
            return [min[0], min[1], max[0], max[1]];
          } else {
            // geometry
            var isDblArray = isArray && $.isArray(coordinates[0][0]),
                isTriArray = isDblArray && $.isArray(coordinates[0][0][0]),
                result = [[[]]];

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
      }
    })(),

    //
    // service types (defined in other files)
    //

    _serviceTypes: {}
  }
})(jQuery, this);
