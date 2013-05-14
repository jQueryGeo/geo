# jQuery Geo

## Contributing

### Important notes
Please don't edit files in the `dist` subdirectory as they are generated via Grunt. You'll find source code in the `js` subdirectory.

### Code style
Regarding code style like indentation and whitespace, **follow the conventions you see used in the source already.**

Please follow jQuery Foundation's [JavaScript Style Guide](http://contribute.jquery.org/style-guide/js/) and/or [idomatic.js](https://github.com/rwldrn/idiomatic.js/).

### Submitting pull requests

1. Create a new branch, please don't work in your `master` branch directly.
1. Fix stuff.
1. Run `grunt` to verify that your code is lint-free. Repeat steps 2-3 until done.
1. Update the documentation to reflect any changes.
1. Push to your fork and submit a pull request.

### Building with grunt

* install node.js ~0.8
* install grunt-cli ([info](http://gruntjs.com/getting-started#installing-the-cli)):

```
npm install -g grunt-cli
```

* uninstall versions of grunt < 0.4.1
* install grunt 0.4.1 locally into your project folder ([info](http://gruntjs.com/getting-started#working-with-an-existing-grunt-project)):

```
cd path/to/geo
npm install grunt
```

* install required grunt build tasks locally

```
npm install grunt-contrib-clean
npm install grunt-contrib-concat
npm install grunt-contrib-uglify
npm install grunt-contrib-qunit
npm install grunt-contrib-jshint
```

* run grunt:

```
grunt
```

Unless you have downloaded a tagged release, grunt will create a test version of jQuery Geo: dist/jquery.geo-1.0.0-test.min.js


