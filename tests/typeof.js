function callable0(obj) {
	return typeof obj === 'function';
}
function callable1(obj) {
	return typeof obj === 'function' && !obj.ignoreCase;
}
function callable2(obj) {
	return !!(obj && obj.constructor && obj.call && obj.apply);
}

function run(fn) {
	var n = 10000000;
	var t1 = Date.now();
	for (var i = 0; i < n; ++i) {
		var x = fn(console.log);
	}
	var t2 = Date.now();
	console.log('DONE', 1000*n/(t2-t1));
}

run(callable0); run(callable1); run(callable2);
// 6, 5, 1
