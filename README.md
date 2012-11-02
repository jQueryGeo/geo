# jQuery Geo

After years of internal development, we are pleased to bring our JavaScript map widget and spatial analysis tools to the open-source world in the form of a jQuery plugin.

## Getting Started
Using jQuery Geo requires adding one element, including one script (apart from jQuery itself) and calling one function. The following copy-and-paste snippet will help you get started.

```html
<div id="map" style="height: 320px;"></div>
<script src="http://code.jquery.com/jquery-1.7.2.min.js"></script>
<script src="http://code.jquerygeo.com/jquery.geo-1.0b1.min.js"></script>
<script>
  $(function() {
    $( "#map" ).geomap( ); // you've got a map!
  });
</script>
```

You can also download the latest release as a [minified JavaScript file][min] or a [full, uncompressed one][max].

[min]: http://code.jquerygeo.com/jquery.geo-1.0b1.min.js
[max]: http://code.jquerygeo.com/jquery.geo-1.0b1.js


## Documentation
The latest docs are hosted at: http://docs.jquerygeo.com

Release and other announcements via @jQueryGeo on Twitter: https://twitter.com/jQueryGeo

News and smaller updates via @ryanttb on Twitter: https://twitter.com/ryanttb

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

## Release History

### 1.0b2
* examples - drawing markers
* geomap - ie8 - [bug] graphics do not resize with window
* examples - kml points
* docs - geomap - default action for shift option should be dragBox in dragBox mode
* geomap - default action for shift option should be dragBox in dragBox mode
* geomap - don't empty graphics on map interaction
* geographics - build labels in background, replace html once
* geomap - [bug] sometimes interaction with other elements doesn't work right on a page with a map
* geographics - don't empty labels on map interaction

### 1.0b1.1 (2012-08-24)
* geomap - [bug] shingled deferred services lose img elements when changing scales slowly
* geomap - [bug] shapes don't render on smaller windows when zoomed in
* geomap - [bug] changing the zoom & center options at the same time does not zoom to the correct location

### 1.0b1 (2012-07-30)
* geographics - use canvas compositing for Polygons with holes
* geographics - [bug] on polygons with holes, stroke draws a line from exterior ring to interior one
* docs - geomap - trigger a shape event when a user finishes measuring
* geomap - trigger a shape event when a user finishes measuring
* geomap - [bug] elements inside the map div lose their position setting
* geomap - trigger bboxchange when we update the map size after the window resizes
* geomap - [bug] multiple map widgets share the same compiled measureLabels template names and overwrite each other
* examples - inset map/multiple maps example
* geomap - [bug] in zoom mode, dragging from bottom-right to top-left draws box but doesn't zoom
* geomap - [bug] any mouse down triggers refresh, even without pan
* cdn - fix caching
** Cache-Control header max-age set to 5 years
** remove Expires header
* geomap - upgrade to jsrender 1.0pre
* deploy - build releases using grunt
* deploy - make a package for new jQuery plugin directory
** https://github.com/jquery/plugins.jquery.com/blob/master/docs/package.md
* deploy - lint JavaScript files
* docs - geomap - dragBbox mode
* docs - geo - polygonize function for bbox
* geo - polygonize function for bbox
* geomap - dragBbox mode
* docs - geomap - shift option (default, zoom, dragBbox, off)
* geomap - shift option (default, zoom, dragBbox, off)
* docs - geomap - loadstart, loadend events
* docs - geomap - allow append to take an array of shapes
* docs - geomap - allow remove to take an array of shapes
* docs - geomap - improve services option documentation
* geomap - clamp measure labels to [0, 0]
* geo - clamp centroid to bbox
* geomap - measure label for polygon should be in centroid
* geomap - merge interactive pan and zoom into one, faster system (pan/zoom rewrite)
* geomap - [bug] iOS - panning is visually jumpy but settles on the correct bbox in the end
* geomap - pinch-zoom doesn't follow user's fingers close enough when scaling
* geomap - [bug] pinch zoom on iPad 2 (iOS 5) doesn't refresh tiles when zooming out
* geomap - request new image in shingled service during interactive pan
* geomap - [bug] zoom in more than once with zoom method moves tiles to the wrong spot
* geomap - [bug] only services that have finished refreshing move when the user pans
* geomap - [bug] map panning is jumpy, appears to be related to shapes and/or drawing context
* geomap - [bug] pan sometimes lags on first drag
* geomap - tiled data-scaleOrigin should be stored as an array
* geomap - android - [bug] cannot always pan map after appending shapes
* geomap - android - browser stops pan/zoom after 7 logos on logo demo
* geomap - [bug] mouse wheel on bad or missing tile doesn't zoom out on first rotate
* geomap - increase mobile performance by 9000
* docs - geomap - add argument to refresh to force reload of images for dynamic data
* docs - geomap - allow service-level refresh
* docs - geomap - zoomMax option (tiled & shingled)
* docs - geo - include method for bbox
* geomap - bboxMax should reset center & pixelSize
* geomap - [bug] initializing center, zoom, & bbox doesn't set all properties
* geo - [bug] polygonize doesn't return valid polygon when using geodetic coordinates
* geomap - [bug] dragBbox doesn't include the bbox property in the shape
* geomap - dragBbox should send a Point (with bbox) for single clicks
* docs - geomap - dragCircle mode
* geo - include method for bbox
* geomap - dragCircle mode
* geomap - [regression] refresh & toggle methods no longer keep original service objects in sync
* geomap - [bug] when a singled image hasn't loaded after pan and you double click on empty space, the zoomed bbox seems wrong
* geomap - allow service-level refresh
* geographics - remove the blit canvas from the DOM, i.e., don't attach
* geomap - don't initialze service-level geographics until they're used
* geomap - add argument to refresh to force reload of images (in case of dynamic data)
* geomap - loadstart, loadend events
* geomap - allow append to take an array of shapes
* geomap - allow remove to take an array of shapes
* geomap - zoomMax option
* geomap - [bug] cannot interact with other elements on the page on iOS after panning the map (#71)
* geomap - iOS - [bug] after one finger is removed, stop processing as if multitouch is still on
* geomap - dumb high-precision mice down on tiled maps
** otherwise, the high precision rounds down to zero change in zoom
* geomap - use linear distance for pinch zoom calculation
* docs - geomap - zoomMin option
* geomap - zoomMin option
* docs - geomap - use MapQuest Open by default; can't deny that it looks much nicer
* geomap - use MapQuest Open by default; can't deny that it looks much nicer
* docs - geomap - rename dragBbox to dragBox
* geomap - rename dragBbox to dragBox
* geomap - [bug] error using tiled deferred services

### 1.0a4 (2012-02-19)
* geomap - [bug] changing the tilingScheme doesn't update pixelSize, maxPixelSize, center or centerMax
* geomap - [bug] shingled services throw exception during resize
* docs - geomap - axisLayout option
* geomap - axisLayout option
* docs - upgrade to jQuery Mobile rc3
* docs - allow page refreshing
* docs - geomap - more modes: measureDistance, measureArea, static
* docs - geomap - append label argument
* docs - geomap - toPixel/toMap should take all coordinate dimensions like the proj functions
* geomap - toPixel/toMap should take all coordinate dimensions like the proj functions
* geomap - move the drawing container instead of individual points during pan
* geomap - [bug] drawStyle resets after window resize
* geomap - append label argument
* docs - geomap - measureLabels option
* geomap - measureLabels option
* geomap - measureDistance mode
* geomap - measureArea mode
* docs - geomap - service-level shapeStyle
* docs - geomap - getUrl string option
* geomap - [bug] create doesn't clear drawing shapes
* docs - geomap - service-level shapes
* docs - geo - detect geodetic coordinates and call $.geo.proj automatically, don't require devs to set $.geo.proj to null
* docs - geomap - add projection section explaining how bbox & center affect map unit type
* docs - geomap - rename getUrl to src
* docs - geomap - scroll option
* docs - geomap - pannable option
* geomap - src string option
* examples - string service src
* geomap - [bug] map tracks mouse when not panning if click on other elements
* geomap - pannable option
* geomap - scroll option
* geomap - [bug] shapesContainer is being cleared twice during mouse wheel zoom
* geomap - support pinch zoom on iOS
* docs - geo - add recenter function for bbox
* geomap - static mode
* docs - geomap - allow Deferred or Promise as return value from src function
* geomap - [bug] widget factory merges first service with default sometimes causing exceptions with shingled services
* geomap - allow Deferred or Promise as return value from src function
* geomap - [bug] resize event triggered too many times during resize
* geomap - service-level shapes
* geomap - service-level find
* geographics - add a resize method, call from geomap.resize
* geo - add recenter function for bbox
* geomap - [bug] errors creating second un-tiled map after destroying a first on same element
* geomap - refresh shouldn't request new images if the map element is hidden
* geomap - [bug] delayed multitouch isn't nearly as smooth as true multitouch
* geomap - [bug] tiled pinch zoom isn't smooth
* geo - detect geodetic coordinates and call $.geo.proj automatically, don't require devs to set $.geo.proj to null
* geomap - [bug] mouse wheel doesn't work with jQuery 1.7
** upgrade to latest jquery.mousewheel plugin
* geomap - service object visibility and opacity options should be moved to a style property
* geomap - use currentServices in all functions unless we actually need to update the public options services object
* geomap - don't change user's service objects in opacity/toggle
* geomap - show attr text
* docs - geomap - selector argument to find method
* geomap - selector argument to find method
* geomap - pan mode should use a hand cursor by default
* geomap - [bug] only services that have finished refreshing move when the user pans
** for a4: hide unfinished services
* geomap - [bug] a user can mess with the center option, e.g., convert numbers to strings, and it can wreck havoc with map state
* geomap - [bug] zoom option doesn't return proper values for shingled services
* geomap - [bug] non-tiled maps can zoom out past zoom 0
* geomap - don't request tiles that are -y index
* geomap - [bug] initializing tiled map by non-geodetic bbox always causes zoom level 0
* docs - geomap - empty string needed for label element
* geomap - label divs should have class="geo-label" & style="position: absolute;"
* geomap - [bug] double tap to end shapes adds two points before ending the shape, in different places
* geomap - [bug] lifting fingers after pinch zoom in drawLineString or drawPolygon modes sometimes adds fake visual coordinate on touch point last lifted
* docs - upgrade to jQuery 1.7.2
* geomap - [bug] scroll=off doesn't zoom map but also doesn't allow document scroll
* geomap - [bug] changing mode does not reset measure drawing
* geomap - [bug] jQuery UI Widget Factory no longer passes pageX & pageY event properties during trigger when using jQuery 1.7
** upgrade to Widget Factory 1.8.17
* examples - all demo (shingled)
* docs - geomap - custom modes
* examples - all demo (tiled)

### 1.0a3 (2011-11-01)
* docs - geomap - more modes: zoom, drawPoint, drawLineString, drawPolygon
* geomap - [bug] tiles do not show when pixel sizes are near or lower than 1.0
* geo - cache bbox as geoBbox to match namespacing convention started by jQuery Mobile
* docs - geo - initial bbox operations: center, height/width, expandBy, scaleBy & reaspect functions
* docs - geo - initial geometry operations: bbox, distance, contains, centroid
* docs - geomap - shape event
* docs - geomap - refresh argument in append, remove & empty
* docs - geomap - document the resize method
* docs - launch jquerygeo.com
* docs - upgrade to jQuery Mobile b3
* docs - services - remove id property, explain the class property
* docs - rename getPixelSize to just pixelSize
* docs - services - change visible to visibility so it matches shapeStyle & CSS
* docs - geomap - allow child selector syntax to target service elements with toggle & opacity methods
* geomap - split servieTypes to different files
* geomap - add data-geo-service to all service container elements, set to type of service
* geomap - add data-geo-map to map divs initialized with geomap, remove on destroy
* geomap - allow child selector syntax to target service elements with toggle & opacity methods
* geomap - [bug] toggle does not refresh the map services being shown for the first time
* geomap - [bug] destroy keeps window resize handler
* geomap - [bug] destroy erases content originally inside map div
* geomap - serviceType objects' destroy method isn't being called
* geomap - [bug] destroyed geomaps remember appended shapes
* docs - geomap - zoom method
* geomap - zoom method
* geo - calculate bbox in projected coordinates
* docs - proj - mention that Geodetic methods can also do bbox
* geo - geometry - bbox function
* docs - geomap - destroy method
* geo - bbox - center function
* geo - bbox - height/width function
* geo - bbox - expandBy function
* geo - bbox - scaleBy function
* geo - bbox - reaspect function
* docs - geomap - drawStyle option
* geomap - [bug] shapeStyle not maintained after resize
* geomap - [bug] second drag while in inertial pan causes map to jump back
* geomap - drawPoint mode
* geomap - drawLineString mode
* geomap - refreshShapes should check bbox cache before drawing
* geomap - drawPolygon mode
* geomap - port zoom mode
* geomap - port shift-zoom mode for pan & draw modes
* geo - geometry - distance function
* examples - distance
* geomap - rename getPixelSize to just pixelSize
* geomap - [bug] zoom method doesn't work with shingled map
* geomap - store service state data as jQuery data on serviceContainer element
* geo - geometry - contains function
* geomap - rename service.visible to visibility having either "visible" or "hidden" values
* geo - geometry - centroid function
* geomap - make service id property optional, add HTML id to serviceContainer if present
* geomap - append should cache the shape's bbox (instead of the bbox function)
* geomap - remove should remove the shape's bbox cache
* geomap - empty should remove the bbox cache for all shapes
* geomap - make the refresh argument in append public, add one to remove & empty
* geomap - disable shape redraw during interactive zoom if more than 255 shapes
* geomap - [bug] shape bbox culling hides shapes that are partially on screen & should be drawn
* docs - geomap - make pixelSize a read-only option instead of a function
* geomap - make pixelSize a read-only option instead of a function
* docs - geomap - make shapeStyle an option
* geomap - make shapeStyle an option
* examples - rewrite shapeStyle example

### 1.0a2.5 (2011-08-03)
* geomap - find - [bug] does not handle GeoJSON features
* geomap - find - allow for 0 pixel tolerance
* geomap - find - check for bbox on non-Point geometries before getting too specific
* geo - bbox - cache shape bboxes
* docs - do not suggest that it's ok to change the geometry now that we're caching bbox
* geomap - jsperf test of bbox query vs. geom query on point data
* geographics - [bug] 0 opacity acts as full opacity
* geomap - add opacity to service type objects & call from geomap's opacity method
* geomap - add toggle to service type objects & call from geomap's toggle method
* geo.proj - update bundled web mercator projection code (removed 150 lines of code)
* geomap - auto-handle window resize events
* docs/geomap - scale map according to cursor location instead of re-centering during double-click zoom
* geomap - iOS - [bug] second tap can be anywhere & cause a zoom
* geomap - shingled - [bug] map doesn't resize correctly
* examples - geomap drawStyle option

### 1.0a2 (2011-06-29)
* geomap - Support dynamic map services
* geomap - [BUG] geomap causes a script error if jQuery UI is already included
* docs - Document shape methods
* geomap - [BUG] Port of soft double-click does not work
* geomap - [BUG] Cannot see dev-supplied inner content if not set to rel/abs position
* geomap - Add mobile test page
* geographics - Port graphic code from internal control
* geomap - Implement append method
* geographics - drawArc should use style's width and height and only take center as an argument
* geomap - Document and implement the public refresh method
* geomap - Implement shapeStyle method
* geographics - Draw points as rounded rectangles via width, height & borderRadius properties on shapeStyle, drop oval functionality
* geomap - Remove the pixels property from position events and add the type property to make the event argument a true GeoJSON Point
* proj - support up to four dimentional array to convert MultiPolygon coordinates in one shot
* proj - add functions to convert individual positions that developers can re-implement for their own projection
* geomap - implement remove method
* geomap - implement find method
* geomap - [bug] toPixel should round pixel values
* geomap - [bug] GeometryCollection shapes do not draw with their parent shape's style
* geomap - implement empty method

### 1.0a1 (2011-05-09)
* docs - Document a new interface to our internal map control
* geomap - Port interactive map widget base to jQuery UI widget factory
* geomap - Support tiled map services

## License
Copyright (c) 2012 Applied Geographics, Inc.
Project lead by Ryan Westphal
Licensed under the MIT, GPL licenses.
