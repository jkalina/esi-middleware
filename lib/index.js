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

    if (Esi.prototype._checkIfShouldHandleEsi(req)
        && Esi.prototype._isResText(res)
    ) {

      var write = res.write;
      res.write = function (chunk, encoding) {

          res.write = write;
          log.debug('check status');
          if (res.statusCode === 200) {

            endWait = true;
            var strchunk = Esi.prototype._stringifyChunk(chunk, encoding);
            var tags = Esi.prototype._searchForTags(strchunk);

            log.debug('status ok');

            if (tags.length === 0) {
                res.write(chunk, encoding);
                endWait = false;
            } else {

              log.debug(tags);

              Esi.prototype._processEsi(req.headers, encoding, strchunk, tags)
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

  _processEsi: function (headers, encoding, data, tags) {

    return Q.Promise(function (resolve, reject) {

      var awaitingPromises = [],
          substitutions = {};

      for (var tag in tags) {
        if (tags.hasOwnProperty(tag)) {

          var src = tags[tag];

          log.debug(src);
          var currentPromise = Esi.prototype._httpRequest(src);
          awaitingPromises.push(currentPromise);

          currentPromise.then(function(response) {

            log.debug('im here!', response.src);

            try {
              var body = reader.read(response.data.body, encoding).toString(encoding);
            } catch (e) {
              log.debug(e);
            }


            log.debug('READ', body);


            log.debug('adding', response.src, body);
            substitutions[response.src] = body;
          }, function(e) {
            log.debug(e);
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

  _httpRequest: function (src) {

    return Q.Promise(function (resolve, reject) {

      http.request(src).then(function(data) {

        log.debug('_httpRequest');

        resolve({
          src: src,
          data: data
        })

      });

    });

  },

  _substitute: function (data, substitutions) {

    var escape = function(text) {
      return text.replace(/[-[\]{}()*+?.,\/\\^$|#\s]/g, "\\$&");
    }

    for (var value in substitutions) {
      if (substitutions.hasOwnProperty(value)) {

        log.debug('doing substitute', value, substitutions[value]);
        var regexp = new RegExp('<esi[^>]* src=("' + escape(value) + '"|\'' + escape(value) + '\')[^>]*>(</esi[^>]*>)?', 'gi');
        data = data.replace(regexp, substitutions[value]);

        // log.debug('data', data);
      }
    }

    return data;

  },

  _searchForTags: function (data) {

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

    var isReqEsiCapable = function (headers) {
      return (String(headers['surrogate-capability']).indexOf('ESI/1.0') !== -1)
          || (String(headers['surrogate-capabilities']).indexOf('ESI/1.0') !== -1)
          || (String(headers['accept-esi']) !== 'undefined');
    };

    if (options.esi === 'auto') {
      shouldHandleEsi = isReqEsiCapable(req.headers);
    } else if (options.esi === 'false' || options.esi == false) {
      shouldHandleEsi = false;
    } else {
      shouldHandleEsi = true;
    }

    return /esi=false/.test(req.url) ? false : shouldHandleEsi;

  },

  _isResText: function (res) {

    var getResContentType = function(headers) {
      if ((headers != null) && (headers['content-type'] != null)) {
        return headers['content-type'];
      } else {
        return 'text/plain';
      }
    }

    var contentType = getResContentType(res._headers);
    return /text|xml|octet-stream/i.test(contentType);
  },

  _stringifyChunk: function (chunk, encoding) {
    return typeof chunk === 'string' ? chunk : chunk.toString(encoding != null ? encoding : 'utf8');
  }

}

exports.Esi = Esi;
