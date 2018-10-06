# Contributing to jQuery Geo

## Important notes

Please do not edit files in the `dist` subdirectory as they are generated via Grunt. You will find source code in the `js` subdirectory.

## Code style

Regarding code style like indentation and whitespace, **follow the conventions you see used in the source already.**

Please follow jQuery Foundation [JavaScript Style Guide](http://contribute.jquery.org/style-guide/js/) and/or [idomatic.js](https://github.com/rwldrn/idiomatic.js/).

## Working with the source code

The source code is in the `js` subdirectory. There is an empty HTML page in the test subdirectory which is pulling in the individual files from the `js` subdirectory in the correct order.

To quickly get up an running and view the test page in a web browser, you can use the [local-web-server](https://www.npmjs.com/package/local-web-server) package.

```
npm install -g local-web-server
```

Then change to the geo directory and run `ws`. You should now be able to view the test page by going to: http://localhost:8000/test/test.html

## Submitting pull requests

1. Create a new branch, please do not work in your `master` branch directly.
1. Fix stuff.
1. Run `grunt` to verify that your code is lint-free. Repeat steps 2-3 until done.
1. Update the documentation to reflect any changes.
1. Push to your fork and submit a pull request.

## Building with grunt

* install node.js v8+
* install grunt-cli ([info](http://gruntjs.com/getting-started#installing-the-cli)):

```
npm install -g grunt-cli
```

* uninstall versions of grunt < 0.4
* install grunt 0.4.5 locally into your project folder ([info](http://gruntjs.com/getting-started#working-with-an-existing-grunt-project)):

```
cd path/to/geo
npm install grunt
```

* install required grunt build tasks locally

```
npm install grunt-contrib-clean
npm install grunt-contrib-concat
npm install grunt-contrib-uglify
npm install grunt-contrib-jshint
```

* run grunt:

```
grunt
```

Grunt will build the current version of jQuery Geo in the dist folder, e.g., dist/jquery.geo-1.0.0.min.js

