'use strict';

var log = require('winston');
    log.level = 'debug';

var url = require('url');
var http = require('http');

var options;

var Esi = function (opts) {
  options = opts !== null ? opts : {
    esi: true
  };
};

Esi.prototype = {

  process: function (req, res, next) {

    if (Esi.prototype._checkIfShouldHandleEsi(req)) {

      var write = res.write;

      res.write = function (chunk, encoding) {

          //TODO: how does it work?
          res.write = write;

          var contentType = Esi.prototype._getResContentType(res._headers);
          var strchunk;

          if (res.statusCode === 200
            && Esi.prototype._isResText(contentType)
          ) {

            //TODO: end wait
            strchunk = Esi.prototype._stringifyChunk(chunk, encoding);
            Esi.prototype._processEsi(req.headers, strchunk, function() {
              log.info('TODO: CALLBACK')
            });

          }

      }

      return next();
    }
  },

  _processEsi: function (headers, data, callback) {

    var esiTags = Esi.prototype._searchEsi(data);
    var fetchedTags = [];

    for (var tag in esiTags) {
      if (esiTags.hasOwnProperty(tag)) {

        var src = esiTags[tag];
        var path = Esi.prototype._prepareUri(src, headers);

        Esi.prototype._fetchEsi(path, function (receivedSrc, statusCode, body) {

          log.debug('Status code = %d for src = %s', statusCode, receivedSrc);

          if (statusCode === 200) {
            fetchedTags[receivedSrc] = body;
            log.debug('Added to fetchedTags array key = %s, value = %s', receivedSrc, body);
          }

        });

      }
    }

    //esi subsitution
    Esi.prototype._substitute(data, fetchedTags);

    callback();

  },

  _substitute: function (data, tags) {

    var escape = function(text) {
      return text.replace(/[-[\]{}()*+?.,\/\\^$|#\s]/g, "\\$&");
    }

    for (var tag in tags) {
      if (tags.hasOwnProperty(tag)) {

        // var regexp = new RegExp'<esi[^>]* src=("' + escape(tag) + '"|\'' + escape(tag) + '\')[^>]*>(<\\/esi[^>]*>)?';

        var regexp = new RegExp('<esi[^>]* src=("' + escape(tag) + '"|\'' + escape(tag) + '\')[^>]*>(</esi[^>]*>)?', 'gi');
        data = data.replace(regexp, tags[tag]);

        // log.info(data);
        // data = data.replace(esi_vars[i], esi_var_result);

      }
    }

    return data;

    // var idx, re;
    // re = new RegExp('<esi[^>]* src=("' + RegExp.escape(src) + '"|\'' + RegExp.escape(src) + '\')[^>]*>(</esi[^>]*>)?', 'gi');
    // this.data = this.data.replace(re, body.replace(/\$/g, '$$$'));
    // idx = this.esi_tags.indexOf(src);
    // if (idx !== -1) {
    //   this.esi_tags.splice(idx, 1);
    // }
    // return this.esi_tags.length;

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

  _fetchEsi: function (options, callback) {

      http.get(options, function (res) {

        var body = '';

        res.on('data', function (chunk) {
          body += chunk.toString();
        });

        res.on('end', function (chunk) {
          callback(options.src, res.statusCode, body);
        });

        res.on('error', function (e) {

          //TODO: throw an error
          callback(options.src, 500, e.message);
        });

      });

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
