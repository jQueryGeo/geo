$.ajaxTransport( function( options, originalOptions, jqXHR ) {
  var xdr;

  return {
    send: function( _, completeCallback ) {
      xdr = new XDomainRequest();

      xdr.onload = function() {
        var responses = {
          text: xdr.responseText
        };

        // force status code to 200, XDomainRequest rejects all other successful status codes
        if (xdr.contentType.match(/\/xml/)){
          // there is no responseXML in XDomainRequest, so we have to create it manually
          var dom = new ActiveXObject('Microsoft.XMLDOM');
          dom.async = false;
          dom.loadXML(xdr.responseText);
          responses.xml = dom;

          if($(dom).children('error').length != 0) {
            var $error = $(dom).find('error');
            completeCallback(parseInt($error.attr('response_code')), $error.attr('message_key'), responses);
          } else {
            completeCallback(200, 'success', responses);
          }
        } else if (xdr.contentType.match(/\/json/)) {
          options.dataTypes.push("json");
          completeCallback(200, 'success', responses);
        } else {
          completeCallback(200, 'success', responses); 
          // see bug https://connect.microsoft.com/IE/feedback/ViewFeedback.aspx?FeedbackID=334804
        }
      };

      xdr.onprogress = function() { };

      xdr.onerror = xdr.ontimeout = function() {
        var responses = {
          text: xdr.responseText
        };
        completeCallback(400, 'failed', responses);
      };

      xdr.open(options.type, options.url);
      xdr.send(options.data);
    },
    abort: function() {
      if(xdr) {
        xdr.abort();
      }
    }
  };
});

