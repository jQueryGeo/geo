@echo off
if "%1"=="" goto usage

echo Building jquery.geo-%1.js
echo Run this tool from the project root
echo jquery.geo-%1.js does not include jQuery itself but does include
echo the jQuery UI widget factory

type js\jquery.geo.head.js > docs\jquery.geo-%1.js
type js\excanvas.js >> docs\jquery.geo-%1.js
type js\jquery.ui.widget.js >> docs\jquery.geo-%1.js
type js\jsrender.js >> docs\jquery.geo-%1.js
type js\jquery.geo.core.js >> docs\jquery.geo-%1.js
type js\jquery.geo.geographics.js >> docs\jquery.geo-%1.js
type js\jquery.geo.geomap.js >> docs\jquery.geo-%1.js
type js\jquery.geo.tiled.js >> docs\jquery.geo-%1.js
type js\jquery.geo.shingled.js >> docs\jquery.geo-%1.js

echo Minifying build
java -jar build\google-compiler-20100917.jar --js docs\jquery.geo-%1.js --js_output_file docs\jquery.geo-%1.min.js

echo Adding dependencies
type js\jquery.mousewheel.js >> docs\jquery.geo-%1.js
type js\jquery.mousewheel.min.js >> docs\jquery.geo-%1.min.js

goto end

:usage
echo Usage: Makedos version

:end
