/* Author: Ryan Westphal

*/

$(function () {
  $("a[data-href]").live("click", function (e) {
    $("#" + $(this).data("href"))[0].scrollIntoView();
  });

  $(".ui-page").live("pageshow", function () {
    $(this).find(".geomap-indoc").geomap({ zoom: 2, scroll: "off" });
  });

  $(".ui-page").live("pagebeforehide", function () {
    $(this).find(".geomap-indoc").geomap("destroy");
  });
});





















