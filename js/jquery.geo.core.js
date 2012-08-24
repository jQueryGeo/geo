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
