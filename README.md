# jQuery Geo

After years of internal development, we are pleased to bring our JavaScript map widget and spatial analysis tools to the open-source world in the form of a jQuery plugin.

## Getting Started
Using jQuery Geo requires, at a minimum, adding one element, including one script (apart from jQuery itself, version 1.9 or higher), and calling one function.

You can get the library through NPM and JSPM.

### Download via npm

    $ npm install jquery --save-dev
    $ npm install jquery.geo --save-dev

```html
<div id="map" style="height: 480px;"></div>
<script src="node_modules/jquery/dist/jquery.min.js"></script>
<script src="node_modules/jquery.geo/dist/jquery.geo.min.js"></script>
<script>
  $(function() {
    $( "#map" ).geomap( );
  });
</script>
```

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

## Documentation

The latest docs are hosted at: https://jquerygeo.github.io/docs/

## Contributing

To contribute to the project, please read and follow the [CONTRIBUTING guide](CONTRIBUTING.md).

## License
Copyright (c) 2025 Ryan Morrison-Westphal
Licensed under the MIT license
