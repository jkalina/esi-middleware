'use strict';

var assert = require('assert');
var dataDriven = require('data-driven');
var nock = require('nock');

nock('http://esi.com')
      .get('/test')
      .reply(200, 'Hello');

nock('http://esi.com')
          .get('/error')
          .reply(403);

var Esi = require('../lib').Esi;

describe('esi-middleware', function () {
  context('#_isReqEsiCapable()', function (){
    dataDriven(
      [
        {
          headers: {
            'surrogate-capability': 'ESI/1.0'
          }
        },
        {
          headers: {
            'surrogate-capabilities': 'ESI/1.0'
          }
        },
        {
          headers: {
            'accept-esi': true
          }
        }
      ],
      function () {
        it('should return true when the header contains proper entry', function (ctx) {

          //given:
          var esi = new Esi();

          //when:
          var result = esi._isReqEsiCapable(ctx.headers);

          //then:
          assert.equal(true, result);

        });
      }
    );

    it('should return false when the header doesn\'t contain proper entry', function () {

      //given:
      var esi = new Esi();

      //when:
      var result = esi._isReqEsiCapable({});

      //then:
      assert.equal(false, result);

    });
  });

  context('#_isResText()', function () {
    dataDriven(
      [
        {
          contentType: 'text'
        },
        {
          contentType: 'xml'
        },
        {
          contentType: 'octet-stream'
        }
      ],
      function () {
        it('should return true when the content type is set to {contentType}', function (ctx) {

          //given:
          var esi = new Esi();

          //when:
          var result = esi._isResText(ctx.contentType);

          //then:
          assert.equal(true, result);

        });
      }
    );

    it('should return false if content type is not supported', function () {

      //given:
      var esi = new Esi();

      //when:
      var result = esi._isResText('image/png');

      //then:
      assert.equal(false, result);

    });

  });

  context('#_getResContentType()', function () {

    it('should return content type value if found in headers object', function () {

      //given:
      var esi = new Esi();
      var headers = {
        'content-type' : 'image/jpeg'
      }

      //when:
      var result = esi._getResContentType(headers);

      //then:
      assert.equal('image/jpeg', result);

    });

    it('should return text/plain as a default content type value if not found in headers object', function () {

      //given:
      var esi = new Esi();
      var headers = {}

      //when:
      var result = esi._getResContentType(headers);

      //then:
      assert.equal('text/plain', result);

    });

  });

  context('#_fetchEsi()', function () {

    it('should fetch http content from given uri', function (done) {

      //given:
      var esi = new Esi();

      //when:
      esi._fetchEsi('http://esi.com/test',

        function (src, status, body) {

          assert.equal('http://esi.com/test', src);
          assert.equal(200, status);
          assert.equal('Hello', body);
          done();

        }

      );

    });

    //FIXME
    it('should return error message on any http error', function (done) {

      //given:
      var esi = new Esi();

      //when:
      esi._fetchEsi('http://esi.com/error',

        function (src, status, body) {

          assert.equal('http://esi.com/error', src);
          assert.equal(500, status);
          assert.equal('Hello', body);
          done();

        }

      );

    });

  });

});
