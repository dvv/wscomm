var assert = require('assert');

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function extend(dst, src) {
if (!src) return dst;
for (var prop in src) if (has(src, prop)) {
var v = src[prop];
var d = dst[prop];
// value is not ordinal?
if (Object(v) === v) {
// value is array?
if (Array.isArray(v)) {
// put its copy, not reference
dst[prop] = v.slice();
continue;
// value is object?
} else {
// destination has no such property? create one
if (!has(dst, prop)) dst[prop] = {};
// destination has such property and it's not ordinal?
if (Object(d) === d) {
// recurse to merge
extend(d, v);
continue;
}
}
}
// value is ordinal? assign new value
{
// report changes in properties.
// if `change` function returns something then inhibit
// the property assignment
// TODO: should be separate
/*
if (_.isFunction(socket.context.change) &&
socket.context.change(prop, v, d) !== undefined)
continue;
*/
// new value is undefined or null?
if (v == null) {
// remove the property
//console.log('RESET', dst, prop);
delete dst[prop];
} else {
dst[prop] = v;
}
}
}
return dst;
}

var arr = [1,2,3];

var dst = {
};
extend(dst, {Foo:{a:1}});
extend(dst, {Foo:{b:2,c:arr}});
extend(dst, {Foo:{b:3,c:[4,null,5]}});
extend(dst, {Foo:{a:{a:'deep'}}});
extend(dst, {Foo:{a:{b:9}}});
extend(dst, {Foo:{}});
assert.deepEqual(dst, {Foo:{a:{a:'deep',b:9},b:3,c:[4,null,5]}})
extend(dst, {Foo:{b:undefined}});
assert.deepEqual(dst, {Foo:{a:{a:'deep',b:9},c:[4,null,5]}})
var x = dst.Foo.a;
x.a = null;
extend(dst, {Foo: {a:x}});
assert.deepEqual(dst, {Foo:{a:{b:9},c:[4,null,5]}})
console.log(dst);
