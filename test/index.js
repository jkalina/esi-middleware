'use strict';

var assert = require('assert');
var dataDriven = require('data-driven');
var nock = require('nock');

nock('http://esi.com:80')
      .get('/test')
      .reply(200, 'Hello');

nock('http://esi.com:80')
      .get('/error')
      .reply(403);

var Esi = require('../lib').Esi;

describe('esi-middleware', function () {
  // context('#process()', function (){
  //   it('should not process tags if response content type is not text based', function () {
  //
  //     //given:
  //     var esi = new Esi({
  //       esi: true
  //     });
  //
  //     //when:
  //     esi.process(req, res, next)
  //
  //   });
  // });

  // context('#_isReqEsiCapable()', function (){
  //   dataDriven(
  //     [
  //       {
  //         headers: {
  //           'surrogate-capability': 'ESI/1.0'
  //         }
  //       },
  //       {
  //         headers: {
  //           'surrogate-capabilities': 'ESI/1.0'
  //         }
  //       },
  //       {
  //         headers: {
  //           'accept-esi': true
  //         }
  //       }
  //     ],
  //     function () {
  //       it('should return true when the header contains proper entry', function (ctx) {
  //
  //         //given:
  //         var esi = new Esi();
  //
  //         //when:
  //         var result = esi._isReqEsiCapable(ctx.headers);
  //
  //         //then:
  //         assert.equal(result, true);
  //
  //       });
  //     }
  //   );
  //
  //   it('should return false when the header doesn\'t contain proper entry', function () {
  //
  //     //given:
  //     var esi = new Esi();
  //
  //     //when:
  //     var result = esi._isReqEsiCapable({});
  //
  //     //then:
  //     assert.equal(result, false);
  //
  //   });
  // });

  context('#_isResText()', function () {
    dataDriven(
      [
        {
          res: {
            _headers: {
                'content-type': 'text'
            }
          }
        },
        {
          res: {
            _headers: {
              'content-type': 'xml'
            }
          }
        },
        {
          res: {
            _headers: {
              'content-type': 'octet-stream'
            }
          }
        }
      ],
      function () {
        it('should return true when the content type is text based', function (ctx) {

          //given:
          var esi = new Esi();

          //when:
          var result = esi._isResText(ctx.res);

          //then:
          assert.equal(result, true);

        });
      }
    );

    it('should return false if content type is not supported', function () {

      //given:
      var esi = new Esi();

      //when:
      var result = esi._isResText({
        _headers: {
          'content-type': 'image/png'
        }
      });

      //then:
      assert.equal(result, false);

    });

  });

  // context('#_getResContentType()', function () {
  //
  //   it('should return content type value if found in headers object', function () {
  //
  //     //given:
  //     var esi = new Esi();
  //     var headers = {
  //       'content-type' : 'image/jpeg'
  //     }
  //
  //     //when:
  //     var result = esi._getResContentType(headers);
  //
  //     //then:
  //     assert.equal(result, 'image/jpeg');
  //
  //   });
  //
  //   it('should return text/plain as a default content type value if not found in headers object', function () {
  //
  //     //given:
  //     var esi = new Esi();
  //     var headers = {}
  //
  //     //when:
  //     var result = esi._getResContentType(headers);
  //
  //     //then:
  //     assert.equal(result, 'text/plain');
  //
  //   });
  //
  // });

  // context('#_fetchEsi()', function () {
  //
  //   it('should fetch http content from a path given in options', function (done) {
  //
  //     //given:
  //     var esi = new Esi();
  //     var options = {
  //       host: 'esi.com',
  //       port: 80,
  //       path: '/test',
  //       src: 'http://esi.com/test'
  //     };
  //
  //     //when:
  //     esi._fetchEsi(options, function (opts, status, body) {
  //
  //         //then:
  //         assert.equal(status, 200);
  //         assert.equal(body, 'Hello');
  //         done();
  //     });
  //
  //   });
  //
  // });

  context('#_checkIfShouldHandleEsi()', function () {

    it('should return true if esi processing is set to auto and request is esi capable', function () {

      //given:
      var esi = new Esi(
        {
          esi: 'auto'
        }
      );

      var req = {
        headers: {
          'accept-esi': true
        }
      };

      //when:
      var result = esi._checkIfShouldHandleEsi(req);

      //then:
      assert.equal(result, true);

    });

    it('should return true if esi processing is set to true', function () {

      //given:
      var esi = new Esi(
        {
          esi: true
        }
      );

      var req = {};

      //when:
      var result = esi._checkIfShouldHandleEsi(req);

      //then:
      assert.equal(result, true);

    });

    it('should return false if esi processing is set to auto and request is not esi capable', function () {

      //given:
      var esi = new Esi(
        {
          esi: 'auto'
        }
      );

      var req = {
        headers: {}
      };

      //when:
      var result = esi._checkIfShouldHandleEsi(req);

      //then:
      assert.equal(result, false);

    });

    dataDriven(
      [
        {
          options: {
            esi: false
          }
        },
        {
          options: {
            esi: 'false'
          }
        },
        {
          options: {
            esi: 0
          }
        }
      ],
      function () {
        it('should return false if esi processing is set to false', function (ctx) {

          //given:
          var esi = new Esi(
            ctx.options
          );

          var req = {};

          //when:
          var result = esi._checkIfShouldHandleEsi(req);

          //then:
          assert.equal(result, false);

        });

      });

      it('should return false if request has esi=false url parameter', function () {

        //given:
        var esi = new Esi(
          {
            esi: true,
          }
        );

        var req = {
          url: 'esi=false'
        };

        //when:
        var result = esi._checkIfShouldHandleEsi(req);

        //then:
        assert.equal(result, false);

      });

  });

  context('#_stringifyChunk()', function () {

    it('should return string value of chunk', function () {

      //given:
      var esi = new Esi();
      var chunk = [ 'a', 'b', 'c' ]

      //when:
      var result = esi._stringifyChunk(chunk);

      //then:
      assert.equal(typeof result, 'string');

    });
  });

  context('#_searchForTags()', function () {

    it('should match esi tags in given source and return an array containing unique values', function () {

      //given:
      var esi = new Esi();
      var contentWithEsiTags =
        '<esi:include src="/fnd/_fragment?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss" />'
      + '<esi:include src="/fnd/_fragment?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss" />';

      //when:
      var result = esi._searchForTags(contentWithEsiTags);

      //then:
      assert.equal(result.length, 1);
      assert.equal(result[0], '/fnd/_fragment?_path=_controller%3DAllegroVelaLayoutBundle%253ADefault%253Acss');

    });

  });

  context('#_substitute()', function () {

    it('should substitute all esi tags according to the given subsitution array', function () {

      //given:
      var esi = new Esi();
      var contentWithTwoEsiTags =
        '<html><body><esi:include src="http://first.address" /><esi:include src="http://second.address" /><esi:include src="http://second.address" /></body></html>';

      var subsitutionArray = [];
          subsitutionArray['http://first.address'] = '<h1>hello test</h1>';
          subsitutionArray['http://second.address'] = '<h2>esi ftw!</h2>';

      //when:
      var result = esi._substitute(contentWithTwoEsiTags, subsitutionArray);

      //then:
      var expectedResult = '<html><body><h1>hello test</h1><h2>esi ftw!</h2><h2>esi ftw!</h2></body></html>';

      assert.equal(result, expectedResult);

    });

    it('should substitute only known esi tags according to the given subsitution array', function () {

      //given:
      var esi = new Esi();
      var contentWithTwoEsiTags =
        '<html><body><esi:include src="http://first.address" /><esi:include src="http://second.address" /></body></html>';

      var subsitutionArray = [];
          subsitutionArray['http://first.address'] = '<h1>hello test</h1>';

      //when:
      var result = esi._substitute(contentWithTwoEsiTags, subsitutionArray);

      //then:
      var expectedResult = '<html><body><h1>hello test</h1><esi:include src="http://second.address" /></body></html>';

      assert.equal(result, expectedResult);

    });
  });

});
