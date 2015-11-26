'use strict';

var log = require('winston');
    log.level = 'debug';

var url = require('url');
// var http = require('http');
var qhttp = require("q-io/http");
var reader = require("q-io/reader");

var Q = require('q');

var options;

var Esi = function (opts) {
  options = opts !== null ? opts : {
    esi: true
  };
};

Esi.prototype = {

  process: function (req, res, next) {

    var endCalled = false;
    var endWait;

    if (Esi.prototype._checkIfShouldHandleEsi(req)) {

      var write = res.write;

      res.write = function (chunk, encoding) {

          res.write = write;

          var contentType = Esi.prototype._getResContentType(res._headers);
          var strchunk;

          if (res.statusCode === 200
            && Esi.prototype._isResText(contentType)
          ) {

            endWait = true;

            strchunk = Esi.prototype._stringifyChunk(chunk, encoding);
            Esi.prototype._processEsi(req.headers, strchunk, function(data) {

              endWait = false;

              log.debug('New content-length: %d', data.length);

              res.setHeader('content-length', data.length);
              res.setHeader('content-type', contentType);
              res.write(data, encoding);

              if (endCalled) {
                return res.end();
              }

            });

          }

      }

      var end = res.end;
      res.end = function(data, encoding) {

        endCalled = true;
        var contentType = Esi.prototype._getResContentType(res._headers);

        if (res.statusCode === 200 && Esi.prototype._isResText(contentType)) {
          log.debug("res.end | data: " + (data != null) + " | req.url: " + req.url);
        }
        if (data != null) {
          return res.write(data, encoding);
        } else if (endWait === false) {
          res.end = end;
          return res.end();
        }
      };

      return next();
    }
  },

  _processEsi: function (headers, data, callback) {

    var esiTags = Esi.prototype._searchEsi(data);

    var awaitingPromises = [];

    for (var tag in esiTags) {
      if (esiTags.hasOwnProperty(tag)) {

        var src = esiTags[tag];
        var path = Esi.prototype._prepareUri(src, headers);

        var currentPromise = Esi.prototype._fetchEsi(path);
        awaitingPromises.push(currentPromise);

        currentPromise.then(function(data) {
          // log.info(data.body)
          log.info('currentPromise', data.status);
          var body = reader.read(data.body, 'UTF-8');
          log.info(body);

        });

          // log.debug('Status code = %d for src = %s', statusCode, receivedSrc);
          //
          // if (statusCode === 200) {
          //   data = Esi.prototype._substitute(data, receivedSrc, body)
          // }
          //
          // log.debug(data, remaining);
          //
          // //TODO: it could be done better
          // if (remaining <= 0) {
          //   log.debug('aaa', data, remaining);
          //   callback(data);
          // }



      }
    }

    var allPromises = Q.all(awaitingPromises);

    allPromises.then(function(data) {
      log.info('done');
    }, function(e) {
      log.error('error', e);
    });

  },

  _substitute: function (data, tag, replacement) {

    var escape = function(text) {
      return text.replace(/[-[\]{}()*+?.,\/\\^$|#\s]/g, "\\$&");
    }

    var regexp = new RegExp('<esi[^>]* src=("' + escape(tag) + '"|\'' + escape(tag) + '\')[^>]*>(</esi[^>]*>)?', 'gi');
    data = data.replace(regexp, replacement);
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

  _fetchEsi: function (options) {

      // log.info(options);

      return qhttp.request(options.src);

      // var deferred = Q.defer();
      // log.debug('Staring _fetchEsi');

      // http.get(options, function (res) {
      //
      //   var body = '';
      //
      //   res.on('data', function (chunk) {
      //     body += chunk.toString();
      //   });
      //
      //   res.on('end', function (chunk) {
      //     log.info('should resolve');
      //     log.info(deferred); //  (body);
      //
      //     deferred.resolve('dupa');
      //
      //     log.info('resolved');
      //   });
      //
      //   res.on('error', function (e) {
      //     deferred.reject(e);
      //   });
      //
      // });

      // return deferred.promise;

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

  _prepareUri: function (path, headers) {

    var uri = url.parse(path);
    var _host, _port, _path, _search, _hash;

    //protocol=null, slashes=null, auth=null, host=null, port=null, hostname=null, hash=null, search=?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss, query=_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss, pathname=/fnd/_fragment, path=/fnd/_fragment?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss, href=/fnd/_fragment?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss

    var getFromHeaders = function () {
      var path = headers.host.split(/:(.+)?/);
      return {
        host: path[0],
        port: path[1] != null ? parseInt(path[1], 10) : 80
      }
    }

    return {
      host: (_host = uri.hostname) != null ? _host : getFromHeaders().host,
      port: (_port = uri.port) != null ? _port : (uri.protocol != null ? 80 : getFromHeaders().port),
      path: ((_path = uri.pathname) != null ? _path : '/')
          + ((_search = uri.search) != null ? _search : '')
          + ((_hash = uri.hash) != null ? _hash : ''),
      src: path
    };

  },

  _stringifyChunk: function (chunk, encoding) {
    return typeof chunk === 'string' ? chunk : chunk.toString(encoding != null ? encoding : 'utf8');
  }

}

exports.Esi = Esi;
