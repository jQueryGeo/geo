(function ($, undefined) {
  $.geo._serviceTypes.shingled = (function () {
    return {
      create: function (map, servicesContainer, service, index) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState") || {};

        if (!shingledServicesState[service.id]) {
          shingledServicesState[service.id] = {
            loadCount: 0
          };

          var scHtml = '<div data-geo-service="shingled" id="' + service.id + '" style="position:absolute; left:0; top:0; width:16px; height:16px; margin:0; padding:0; display:' + (service.visibility === undefined || service.visibility === "visible" ? "block" : "none") + ';"></div>';
          servicesContainer.append(scHtml);

          shingledServicesState[service.id].serviceContainer = servicesContainer.children(":last");
          servicesContainer.data("geoShingledServicesState", shingledServicesState);
        }

        return shingledServicesState[service.id].serviceContainer;
      },

      destroy: function (map, servicesContainer, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        shingledServicesState[service.id].serviceContainer.remove();
        delete shingledServicesState[service.id];
      },

      interactivePan: function (map, service, dx, dy) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        if (!(shingledServicesState && shingledServicesState[service.id])) {
          return;
        }

        this._cancelUnloaded(map, service);

        var serviceState = shingledServicesState[service.id],
            serviceContainer = serviceState.serviceContainer,
            pixelSize = map.pixelSize(),
            scaleContainer = serviceContainer.children("[data-pixelSize='" + pixelSize + "']"),
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
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        if (!(shingledServicesState && shingledServicesState[service.id])) {
          return;
        }

        this._cancelUnloaded(map, service);

        var serviceState = shingledServicesState[service.id],
            serviceContainer = serviceState.serviceContainer,

            contentBounds = map._getContentBounds(),
            mapWidth = contentBounds["width"],
            mapHeight = contentBounds["height"],

            halfWidth = mapWidth / 2,
            halfHeight = mapHeight / 2,

            bbox = [center[0] - halfWidth, center[1] - halfHeight, center[0] + halfWidth, center[1] + halfHeight];

        serviceContainer.children().each(function (i) {
          var $scaleContainer = $(this),
              scalePixelSize = $scaleContainer.attr("data-pixelSize"),
              ratio = scalePixelSize / pixelSize;

          $scaleContainer.css({ width: mapWidth * ratio, height: mapHeight * ratio }).children("img").each(function (i) {
            var $img = $(this),
                imgCenter = $img.data("center"),
                x = (Math.round((imgCenter[0] - center[0]) / scalePixelSize) - halfWidth) * ratio,
                y = (Math.round((center[1] - imgCenter[1]) / scalePixelSize) - halfHeight) * ratio;

            $img.css({ left: x + "px", top: y + "px" });
          });
        });
      },

      refresh: function (map, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        if (service && shingledServicesState[service.id] && (service.visibility === undefined || service.visibility === "visible")) {
          this._cancelUnloaded(map, service);

          var bbox = map._getBbox(),
              pixelSize = map.pixelSize(),

              serviceState = shingledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

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
            var $thisimg = $(this),
                imgCenter = $thisimg.data("center"),
                center = map._getCenter(),
                x = Math.round((imgCenter[0] - center[0]) / pixelSize) - halfWidth,
                y = Math.round((center[1] - imgCenter[1]) / pixelSize) - halfHeight;

            $thisimg.css({ left: x + "px", top: y + "px" });
          });

          if (opacity < 1) {
            serviceContainer.find("img").attr("data-keepAlive", "0");
          }

          var imageUrl = service.getUrl({
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
          $img = scaleContainer.children(":last").data("center", map._getCenter());
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
                  var $thisimg = $(this),
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

      resize: function (map, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        if (service && shingledServicesState[service.id] && (service.visibility === undefined || service.visibility === "visible")) {
          this._cancelUnloaded(map, service);

          var serviceState = shingledServicesState[service.id],
              serviceContainer = serviceState.serviceContainer,

              contentBounds = map._getContentBounds(),
              mapWidth = contentBounds["width"],
              mapHeight = contentBounds["height"],

              halfWidth = mapWidth / 2,
              halfHeight = mapHeight / 2,

              scaleContainer = serviceContainer.children();

          scaleContainer.attr("data-pixelSize", "0");
          scaleContainer.css({
            left: halfWidth + 'px',
            top: halfHeight + 'px'
          });
        }
      },

      opacity: function (map, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        // service.opacity has changed, update any existing images
        var serviceState = shingledServicesState[service.id];
        serviceState.serviceContainer.find("img").stop(true).fadeTo("fast", service.opacity);
      },

      toggle: function (map, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        // service.visible has changed, update our service container
        var serviceState = shingledServicesState[service.id];
        serviceState.serviceContainer.css("display", service.visibility === "visible" ? "block" : "none");
      },

      _cancelUnloaded: function (map, service) {
        var shingledServicesState = map._getServicesContainer().data("geoShingledServicesState");
        var serviceState = shingledServicesState[service.id];

        if (serviceState && serviceState.loadCount > 0) {
          serviceState.serviceContainer.find("img:hidden").remove();
          while (serviceState.loadCount > 0) {
            serviceState.loadCount--;
          }
        }
      }
    }
  })();
})(jQuery);
