'use strict'; 

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('geo.jquery.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
    // Task configuration.
    clean: {
      files: ['dist/jquery.<%= pkg.name %>-<%= pkg.version %>.js', 'dist/jquery.<%= pkg.name %>-<%= pkg.version %>.min.js']
    },
    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true
      },
      dist: {
        src: [
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
        dest: 'dist/jquery.<%= pkg.name %>-<%= pkg.version %>.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: '<%= concat.dist.dest %>',
        dest: 'dist/jquery.<%= pkg.name %>-<%= pkg.version %>.min.js'
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    jshint: {
      gruntfile: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: 'Gruntfile.js'
      },
      src: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: ['js/jquery.geo.core.js', 'js/jquery.geo.geographics.js', 'js/jquery.geo.geomap.js', 'js/jquery.geo.shingled.js', 'js/jquery.geo.tiled.js']
      }
//      test: {
//        options: {
//          jshintrc: '.jshintrc'
//        },
//        src: ['test/**/*.js']
//      },
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task.
  grunt.registerTask('default', ['jshint', /* 'qunit', */ 'clean', 'concat', 'uglify']);

};
