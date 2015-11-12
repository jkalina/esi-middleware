'use strict';

var log = require('winston');
var url = require('url');
var http = require('http');

var options;

var Esi = function (opts) {
  options = opts || {};
};

Esi.prototype = {

  processEsi: function (req, res, next) {

    res.write = function(chunk, encoding) {
      
    }

  },

  _fetchEsi: function (src, callback) {

      var uri = url.parse(src);

      //TODO: name it in proper way
      var _ref, _ref2, _ref3, _ref4, _ref5;
      var options = {
        host: (_ref = uri.hostname) != null ? _ref : this.request.url.hostname,
        port: (_ref2 = uri.port) != null ? _ref2 : (uri.protocol != null ? 80 : this.request.url.port),
        path: ((_ref3 = uri.pathname) != null ? _ref3 : '/') + ((_ref4 = uri.search) != null ? _ref4 : '') + ((_ref5 = uri.hash) != null ? _ref5 : '')
      };

      http.get(options, function (res) {

        var body = '';

        res.on('data', function (chunk) {
          body += chunk.toString();
        });

        res.on('end', function (chunk) {
          callback(src, res.statusCode, body);
        });

        res.on('error', function (e) {

          //TODO: throw an error
          callback(src, 500, e.message);
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
  }

}

exports.Esi = Esi;
