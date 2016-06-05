# jQuery Geo

After years of internal development, we are pleased to bring our JavaScript map widget and spatial analysis tools to the open-source world in the form of a jQuery plugin.

## Getting Started
Using jQuery Geo requires, at a minimum, adding one element, including one script (apart from jQuery itself, version 1.9 or higher), and calling one function.

You can also get the library through JSPM and NPM.

### Load via jspm

    $ npm install jspm --save-dev
    $ jspm init
    $ jspm install jquery
    $ jspm install npm:jquery.geo

```js
// lib/main.js
import $ from 'jquery';
import geomap from 'jquery.geo';

$( '#map' ).geomap( );
```

### Download via npm

    $ npm install jquery --save-dev
    $ npm install jquery.geo --save-dev

```html
<div id="map" style="height: 480px;"></div>
<script src="node_modules/jquery/dist/jquery.min.js"></script>
<script src="node_modules/jquery.geo/dist/jquery.geo-1.0.0-rc1.1.min.js"></script>
<script>
  $(function() {
    $( "#map" ).geomap( );
  });
</script>
```

### Load via CDN script

The following copy-and-paste snippet will help you get started.

```html
<div id="map" style="height: 480px;"></div>
<script src="http://code.jquery.com/jquery-2.2.4.min.js"></script>
<script src="http://code.jquerygeo.com/jquery.geo-1.0.0-rc1.1.min.js"></script>
<script>
  $(function() {
    $( "#map" ).geomap( );
  });
</script>
```

### Download direct

You can also download the latest release as a [minified JavaScript file][min] or a [full, uncompressed one][max].

[min]: http://code.jquerygeo.com/jquery.geo-1.0.0-rc1.1.min.js
[max]: http://code.jquerygeo.com/jquery.geo-1.0.0-rc1.1.js

## Documentation

The latest docs are hosted at: http://docs.jquerygeo.com

Release and other announcements via @geomappin on Twitter: https://twitter.com/geomappin

News, dev updates, & personal tweets via @ryanttb on Twitter: https://twitter.com/ryanttb

## Contributing

To contribute to the project, please read and follow the [CONTRIBUTING guide](CONTRIBUTING.md).

## License
Copyright (c) 2016 Ryan Morrison-Westphal
Licensed under the MIT license
