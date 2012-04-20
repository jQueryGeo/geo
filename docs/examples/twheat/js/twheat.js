$(function () {
  var map = null,
      checkedIds = [], //< list of tweet ids we've checked
      appendedCount = 0, //< number of tweets we successfully appended
      searchTerm = "", //< last search term
      searching = false,
      currentXhr = null, //< an ajax request reference if we need to cancel
      
      twitterButtonHtml = '<a href="https://twitter.com/share" class="twitter-share-button" data-count="vertical" data-via="ryanttb">Tweet</a><script src="//platform.twitter.com/widgets.js">\x3C/script>';

  function initMap(center, zoom) {
    // create a map using an optional center and zoom
    map = $("#map").geomap({
      center: center || [-71.0597732, 42.3584308],
      zoom: zoom || 10,

      // set the shapeStyle to a largish solid but translucent circle
      // to give the tweets a heat map effect
      shapeStyle: {
        strokeOpacity: 0,
        fillOpacity: .2,
        width: "16px",
        height: "16px",
        borderRadius: "16px",
        color: "#e44"
      },

      move: function (e, geo) {
        // when the user moves, search for appended tweets
        // and show a popup

        // clear the popup
        $("#popup").hide().html("");

        if (searchTerm) {
          // spatial query, geo has the cursor location as a map point
          // this will find appended tweets within 3 pixels
          var features = map.geomap("find", geo, 3),
              popupHtml = "",
              i = 0;

          // for each tweet found, add some html to the popup
          for (; i < features.length; i++) {
            popupHtml += "<p>" + features[i].properties.tweet + "</p>";
          }

          if (popupHtml) {
            // if any tweets found, show the popup
            var $popup = $("#popup").append(popupHtml).css({
              left: e.pageX,
              top: e.pageY
            });
            
            var widthOver = $(window).width() - ( $popup.width() + e.pageX ),
                heightOver = ($(window).height() - 32) - ( $popup.height() + e.pageY ),
                left = e.pageX,
                top = e.pageY;

            if ( widthOver < 0 ) {
              left += widthOver;
            }

            if ( heightOver < 0 ) {
              top += heightOver;
            }

            $popup.css({
              left: left,
              top: top
            }).show();
          }
        }
      }
    });

    if ( searchTerm && !searching ) {
      autoSearch();
    }
  }

  $("#loc").submit(function (e) {
    e.preventDefault();

    // when the user clicks the location search button,
    // send a request to nominatim for an OpenStreatMap data search
    $.ajax({
      url: "http://open.mapquestapi.com/nominatim/v1/search",
      data: {
        format: "json",
        q: $("#loc input").val()
      },
      dataType: "jsonp",
      jsonp: "json_callback",
      success: function (results) {            
        if (results && results.length > 0) {
          // if we get a result, relaunch the app to the new location with the old search
          // this will allow users to tweet their map
          window.location.search = 
            "q=" + encodeURIComponent($("#twit input").val()) +
            "&l=" + encodeURIComponent($("#loc input").val()) +
            "&center=" + results[0].lon + "," + results[0].lat +
            "&zoom=" + map.geomap("option", "zoom");
        }
      }
    });
    return false;
  });

  $("#twit").submit(function (e) {
    e.preventDefault();

    // when the user clicks the tweet search button,
    // send a request to twitter

    if (currentXhr) {
      // if there's a search pending, cancel it
      currentXhr.abort();
      currentXhr = null;
    }

    $("#popup").hide().html("");

    // save our search term
    searchTerm = $("#twit input").val();

    if ( searchTerm ) {
      // if we have a new search term, relaunch the app to the same location with the new search
      // this will allow users to tweet their map
      window.location.search = 
        "q=" + encodeURIComponent(searchTerm) +
        "&l=" + encodeURIComponent($("#loc input").val()) +
        "&center=" + map.geomap("option", "center").toString() +
        "&zoom=" + map.geomap("option", "zoom");
    }

    return false;
  });

  // jQueryUI for pretty buttons
  $( "button" ).button();

  function search() {
    // called by autoSearch, this function actually searches Twitter for geo-enabled tweets

    if ( map !== null ) {
      var center = map.geomap("option", "center"), //< the center of the map in lon, lat
          // the geocode argument to Twitter search,
          // it's an array with [ lat, lon, radius in km ]
          // geomap's center is lon, lat so we have to switch
          // for radius we'll use document width * pixelSize converted to km (from meters)
          // Twitter search has a max of 2500km
          geocode = [ 
            center[1],
            center[0],
            Math.min(2500, map.geomap("option", "pixelSize") * $(document).width() / 2 / 1000) + "km"
          ],
          lastSearchTerm = searchTerm;

      // actually send the request to Twitter
      currentXhr = $.ajax({
        url: "http://search.twitter.com/search.json",
        data: {
          rpp: 100,
          q: lastSearchTerm,
          geocode: geocode.join(",")
        },
        dataType: "jsonp",
        complete: function () {
          currentXhr = null;
        },
        success: function (tweets) {
          if (searchTerm == lastSearchTerm && tweets.results) {
            // if we have results, search each of them for the geo or location property
            $.each(tweets.results, function () {
              appendTweet( this );

            });

            $("#appendedCount").text(appendedCount + " tweets mapped!");
          }
        }
      });
    }
  }

  function appendTweet( tweet ) {
    // attempt to append a tweet if we haven't already
    if ( $.inArray( tweet.id_str, checkedIds ) >= 0 ) {
      return;
    }

    // we don't want to attempt more than once for a given tweet
    checkedIds.push( tweet.id_str );

    // store some tweet html as a property on the feature
    var feature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [ 0, 0 ]
      },
      properties: {
        tweet: "<b>" + tweet.from_user + "</b>: " + tweet.text
      }
    };

    if (tweet.geo) {
      // if we have a geo property, flip the coordinates because Twitter search isn't
      // in proper GeoJSON spec order
      // Twitter uses [lat, lon] instead of [lon, lat]
      feature.geometry.coordinates = [
        tweet.geo.coordinates[1],
        tweet.geo.coordinates[0]
      ];

      map.geomap("append", feature);
      appendedCount++;
    } else if ( tweet.location ) {
      // otherwise, attempt to geocode the location property
      $.ajax({
        url: "http://open.mapquestapi.com/nominatim/v1/search",
        data: {
          format: "json",
          q: tweet.location
        },
        dataType: "jsonp",
        jsonp: "json_callback",
        success: function (results) {            
          if (results && results.length > 0) {
            // if found, grab the location's lon & lat
            if (results[0].lon && results[0].lat) {
              feature.geometry.coordinates = [
                results[0].lon,
                results[0].lat
              ];

              // finally append the tweet
              map.geomap( "append", feature );
              appendedCount++;
              $("#appendedCount").text(appendedCount + " tweets mapped!");
            }
          }
        }
      });
    }
  }

  function autoSearch() {
    searching = true;
    if ( searchTerm ) {
      search();
      setTimeout(autoSearch, 5000);
    }
  }

  // for fun, we support sending center, zoom and a tweet query in the query string
  var queryString = window.location.search.substring(1),
      params = queryString.split("&"),
      options = {};

  $.each(params, function() {
    var idx = this.indexOf("=");
    if (idx > 0) {
      options[this.substring(0, idx)] = this.substring(idx + 1);
    }
  });

  if (options.center) {
    if (options.zoom) {          
      initMap($.parseJSON("[" + options.center + "]"), parseInt(options.zoom));
    } else {
      initMap($.parseJSON("[" + options.center + "]"));
    }
  } else {
    // if there's no center in the query string, try to use geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (p) {
        initMap([p.coords.longitude, p.coords.latitude]);
      }, function (error) {
        initMap();
      });
    } else {
      // if all else fails, use defaults
      initMap();
    }
  }

  var title = "Twheat !";

  if (options.q) {
    searchTerm = decodeURIComponent(options.q);
    $("#twit input").val(searchTerm);
    title += " " + searchTerm;

    if ( map !== null && !searching ) {
      autoSearch();
    }
  }

  if (options.l) {
    var loc = decodeURIComponent(options.l);
    $("#loc input").val(loc);
    title += " " + loc;
  }

  $("title").html(title);
  $("#tweetButton").append(twitterButtonHtml);
});  

