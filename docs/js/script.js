/* Author: Ryan Westphal

*/

$(function() {
  $("a[data-href]").live("click", function(e) {
    $("#" + $(this).data("href"))[0].scrollIntoView();
  });
});





















