/* Author: Ryan Westphal

*/

if ($("html").hasClass("ie9") || $("html").hasClass("ie8")) {
  $(".ui-page").live("pageshow", function (e) {
    window.focus();
  });
}

$(function () {

  $(document).bind("mobileinit", function () {
    $.mobile.gradeA = function () { return $.support.mediaquery || $("html").hasClass("ie8") };
  });

  $("a[data-href]").live("click", function(e) {
    $("#" + $(this).data("href"))[0].scrollIntoView();
  });
});





















