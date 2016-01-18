var http = require('http');
var https = require('https');
var js2xmlparser = require("js2xmlparser");
var querystring = require('querystring');

var hummingbirdusername = 'username';
var maluserpass = 'username:password';

var statusmap = {
	"currently-watching":1, 
	"plan-to-watch":6, 
	"completed":2, 
	"on-hold":3, 
	"dropped":4
};

var keymap = {
	'episodes_watched' : 'episode'//,
	//'status' : 'status'
};

https.get({
	hostname: 'hummingbird.me',
	port: 443,
	path: '/api/v1/users/'+hummingbirdusername+'/library'
}, (res) => {

	console.log('STATUS: ' + res.statusCode);
	console.log('HEADERS: ' + JSON.stringify(res.headers));

	var body = '';

	res.setEncoding('utf8');
	res.on('data', function(chunk) {
		body += chunk;
	});

	res.on('end', function() {
		processLibrary(body);
	});
});

function processLibrary(library) {
	library = JSON.parse(library);
	for(var i = 0; i < library.length; i++) {
		var entry = library[i];
		var malid = entry.anime.mal_id;
		var malnode = {
			'status' : statusmap[entry['status']]
		};

		for(var key in keymap) {
			malnode[keymap[key]] = entry[key];
		}
		var xmlbody = js2xmlparser('entry', malnode);
		console.log(typeof xmlbody);
		console.log(xmlbody);
		console.log(entry.anime.title + " (" + malid + ")" + JSON.stringify(malnode));

		// needs a 2-pass if there are existing entries in mal, add first then update.
		// TODO: check user's mal library before adding or updating
		
		var path = '/api/animelist/add/' + malid + '.xml';
		// var path = '/api/animelist/update/' + malid + '.xml';
		console.log(path);

		var params = {'data':xmlbody};
		var postData = querystring.stringify(params);

		var req = http.request({
			hostname: 'myanimelist.net',
			port: 80,
			path: path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': postData.length
			},
			auth: maluserpass
		}, (res) => {
			console.log(`STATUS: ${res.statusCode}`);
			console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				console.log(`BODY: ${chunk}`);
			});
			res.on('end', () => {
				console.log('No more data in response.')
			})
		});

		req.on('error', (e) => {
			console.log(`problem with request: ${e.message}`);
		});

		req.write(postData);
		req.end();
	}
}