//  Copyright (c) 2011 Daniel Ennis <aikar@aikar.co>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function () {
  var Bison = require('bison');
  // Define exports
  module.exports = function (client, callback) {
    client.origwrite = client.write;
    client.write = function (data) {
      //return client.origwrite(JSON.stringify(data)+"\n");
      var s = Bison.encode(data)+"-=!=-";
      return client.origwrite(s);
    };
    if (typeof callback == 'function') {
      var buffer = '', idx;
      client.on('data', function (data) {        
        buffer += data.toString();
        
        var start = 0;
        try {
          //while ( (idx = buffer.indexOf("\n", start)) != -1) {
          while ( (idx = buffer.indexOf("-=!=-", start)) != -1) {
            var json = buffer.substr(start, idx - start);;
            //var obj = JSON.parse(json);
            var obj = Bison.decode(json);
            
            callback(null, obj);
            start = idx+5; //1
          }
        } catch (e) {
          start = idx+5; //1
          callback(e);
        }
        
        buffer = buffer.substr(start);
      });
    }
  };
})();
