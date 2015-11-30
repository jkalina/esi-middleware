'use strict';

var log = require('winston');
    log.level = 'debug';

var url = require('url');
var http = require('q-io/http');
var reader = require('q-io/reader');

var Q = require('q');

var options;

var Esi = function (opts) {
  options = opts !== null ? opts : {
    esi: true,
    host: 'http://localhost/',
    log: 'debug'
  };

};

Esi.prototype = {

  process: function (req, res, next) {

    var endCalled = false,
        endWait = false;

    if (Esi.prototype._checkIfShouldHandleEsi(req)) {

      var write = res.write;
      res.write = function (chunk, encoding) {

          res.write = write;

          var contentType = Esi.prototype._getResContentType(res._headers),
              strchunk;

          if (res.statusCode === 200
            && Esi.prototype._isResText(contentType)
          ) {

            endWait = true;
            strchunk = Esi.prototype._stringifyChunk(chunk, encoding);

            //check if there is ESI tag to handle
            var esiTags = Esi.prototype._searchEsi(strchunk);

            if (esiTags.length === 0) {
                res.write(chunk, encoding);
                endWait = false;
            } else {
              Esi.prototype._processEsi(req.headers, strchunk, esiTags)
                .then(
                  function(result) {

                    res.removeHeader('Content-Length');
                    res.write(result, encoding);

                    endWait = false;

                    if (endCalled) {
                      res.end();
                    }

                  },
                  function(e) {
                    log.error('Error', e);
                  }
                );
            }
          } else {
            res.write(chunk, encoding);
          }

          if (endCalled) {
            res.end();
          }
      };

      var end = res.end;
      res.end = function (data, encoding) {

        endCalled = true;

        if (data != null) {
          res.write(data, encoding);
        } else if (endWait === false) {
          res.end = end;
          res.end();
        }
      }

    }

    next();
  },

  _processEsi: function (headers, data, tags) {

    return Q.Promise(function (resolve, reject) {

      var awaitingPromises = [],
          substitutions = {};

      for (var tag in tags) {
        if (tags.hasOwnProperty(tag)) {

          var src = tags[tag];
          var currentPromise = http.request(src);

          awaitingPromises.push(currentPromise);

          currentPromise.then(function(data) {
            var body = reader.read(data.body, 'UTF-8');
            substitutions[src] = body;
          });

        }
      }

      var allPromises = Q.all(awaitingPromises);

      allPromises.then(
        function() {
          var substitutedData = Esi.prototype._substitute(data, substitutions);
          resolve(substitutedData);
        },
        function(e) {
          reject(e);
        }
      );

    });

  },

  _substitute: function (data, substitutions) {

    var escape = function(text) {
      return text.replace(/[-[\]{}()*+?.,\/\\^$|#\s]/g, "\\$&");
    }

    for (var value in substitutions) {
      if (substitutions.hasOwnProperty(value)) {
        var regexp = new RegExp('<esi[^>]* src=("' + escape(value) + '"|\'' + escape(value) + '\')[^>]*>(</esi[^>]*>)?', 'gi');
        data = data.replace(regexp, substitutions[value]);
      }
    }

    return data;

  },

  _searchEsi: function (data) {

    var regexp = new RegExp('<esi[^>]* src=("[^>"]+"|\'[^>\']+\')[^>]*>(</esi[^>]*>)?', 'gi');

    var matchedTags = data.match(regexp);
    var resultTags = [];

    for (var tag in matchedTags) {

      var regexp = new RegExp(' src=("(.*?)"|\'(.*?)\')');
      var match = matchedTags[tag].match(regexp);
      var src;

      var currentTag = (src = match[2]) != null ? src : match[3];

      if (resultTags.indexOf(currentTag) === -1) {
        resultTags[tag] = currentTag;
      }
    }

    return resultTags;

  },

  _checkIfShouldHandleEsi: function (req) {

    var shouldHandleEsi = true;

    if (options.esi === 'auto') {
      shouldHandleEsi = Esi.prototype._isReqEsiCapable(req.headers);
    } else if (options.esi === 'false' || options.esi == false) {
      shouldHandleEsi = false;
    } else {
      shouldHandleEsi = true;
    }

    //url parameter has priority over
    return /esi=false/.test(req.url) ? false : shouldHandleEsi;

  },

  _isReqEsiCapable: function (headers) {
    return (String(headers['surrogate-capability']).indexOf('ESI/1.0') !== -1)
        || (String(headers['surrogate-capabilities']).indexOf('ESI/1.0') !== -1)
        || (String(headers['accept-esi']) !== 'undefined');
  },

  _getResContentType: function (headers) {
    if ((headers != null) && (headers['content-type'] != null)) {
      return headers['content-type'];
    } else {
      return 'text/plain';
    }
  },

  _isResText: function (contentType) {
    return /text|xml|octet-stream/i.test(contentType);
  },

  // _prepareUri: function (path, headers) {
  //
  //   var uri = url.parse(path);
  //   var _host, _port, _path, _search, _hash;
  //
  //   var getFromHeaders = function () {
  //     var path = headers.host.split(/:(.+)?/);
  //     return {
  //       host: path[0],
  //       port: path[1] != null ? parseInt(path[1], 10) : 80
  //     }
  //   }
  //
  //   return {
  //     host: (_host = uri.hostname) != null ? _host : getFromHeaders().host,
  //     port: (_port = uri.port) != null ? _port : (uri.protocol != null ? 80 : getFromHeaders().port),
  //     path: ((_path = uri.pathname) != null ? _path : '/')
  //         + ((_search = uri.search) != null ? _search : '')
  //         + ((_hash = uri.hash) != null ? _hash : ''),
  //     src: path
  //   };
  //
  // },

  _stringifyChunk: function (chunk, encoding) {
    return typeof chunk === 'string' ? chunk : chunk.toString(encoding != null ? encoding : 'utf8');
  }

}

exports.Esi = Esi;
