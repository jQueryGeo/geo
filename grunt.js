/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? " * " + pkg.homepage + "\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>/<%= pkg.author.company %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    concat: {
      dist: {
        src: [
          '<banner>',
          'js/excanvas.js',
          'js/jsrender.js',
          'js/jquery.mousewheel.js',
          'js/jquery.ui.widget.js',
          'js/jquery.geo.core.js',
          'js/jquery.geo.geographics.js',
          'js/jquery.geo.geomap.js',
          'js/jquery.geo.tiled.js',
          'js/jquery.geo.shingled.js'
        ],
        dest: 'docs/<%= pkg.name %>-<%= pkg.version %>.js'
      }
    },
    min: {
      excanvas: {
        src: ['js/excanvas.js'],
        dest: 'js/excanvas.min.js'
      },
      jsrender: {
        src: ['js/jsrender.js'],
        dest: 'js/jsrender.min.js'
      },
      widget: {
        src: ['js/jquery.ui.widget.js'],
        dest: 'js/jquery.ui.widget.min.js'
      },
      dist: {
        src: ['<banner>', '<config:concat.dist.dest>'],
        dest: 'docs/<%= pkg.name %>-<%= pkg.version %>.min.js'
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    lint: {
      files: ['js/jquery.geo.core.js', 'js/jquery.geo.geographics.js', 'js/jquery.geo.geomap.js', 'js/jquery.geo.shingled.js', 'js/jquery.geo.tiled.js']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: false,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: false,
        boss: true,
        eqnull: false,
        browser: true
      },
      globals: {
        jQuery: true
      }
    },
    uglify: {}
  });

  grunt.registerTask('default', 'lint concat:dist min:dist');
};
