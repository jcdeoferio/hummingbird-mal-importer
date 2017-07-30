var http = require('http');
var https = require('https');
var js2xmlparser = require("js2xmlparser");
var querystring = require('querystring');
var jsonQuery = require('json-query');

var kitsuusername = 'username';
var maluserpass = 'username:password';

var statusmap = {
	"current":1, 
	"planned":6, 
	"completed":2, 
	"on_hold":3, 
	"dropped":4
};

https.get({
	hostname: 'kitsu.io',
	port: 443,
	path: '/api/edge/users?filter[name]='+kitsuusername
}, (res) => {
	//console.log('STATUS: ' + res.statusCode);
	//console.log('HEADERS: ' + JSON.stringify(res.headers));

	var body = '';
	res.setEncoding('utf8');
	res.on('data', function(chunk) {
		body += chunk;
	});

	res.on('end', function() {
		body = JSON.parse(body);
		processKitsuUser({
			hostname: 'kitsu.io',
			port: 443,
			path: '/api/edge/users/'+body.data[0].id+'/library-entries'
		});
	});
});



function processKitsuUser(url) {
	https.get(url, (res) => {

		//console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));

		var body = '';

		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
		});

		res.on('end', function() {
			body = JSON.parse(body);
			processLibrary(body.data);

			if(body.links.next) {
				processKitsuUser(body.links.next);
			}
		});
	});
}

function processLibrary(library) {
	for(var i = 0; i < library.length; i++) {
		processEntry(library[i]);
	}
}

function processEntry(entry) {
	https.get(entry.relationships.anime.links.related, (res) => {
		var animebody = '';
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			animebody += chunk;
		});

		res.on('end', function() {
			animebody = JSON.parse(animebody);

			if(animebody.data == null) {
				return; //not an anime
			}

			https.get(animebody.data.relationships.mappings.links.related,(res) => {
				var mappingsBody = '';

				res.setEncoding('utf8');
				res.on('data', function(chunk) {
					mappingsBody += chunk;
				});

				res.on('end', function() {
					mappingsBody = JSON.parse(mappingsBody);
					var parents = jsonQuery('data.attributes[externalId=myanimelist/anime]', {data:mappingsBody}).parents;
					for(var j=0; j < parents.length; j++) {
						if(parents[j].key == 'attributes') {
							if(!parents[j].value[0]) {
								continue;
							}
							addMalEntry(parents[j].value[0].externalId, entry, animebody, mappingsBody);
						}
					}
				});
			});
		});
	});
}

function addMalEntry(malid, entry, anime, mapping) {
	var malnode = {
		'status' : statusmap[entry.attributes.status],
		'episode' : entry.attributes.progress
	};

	var xmlbody = js2xmlparser('entry', malnode);
	//console.log(typeof xmlbody);
	//console.log(xmlbody);
	console.log(anime.data.attributes.titles.en_jp + " (" + malid + ")" + JSON.stringify(malnode));

	// needs a 2-pass if there are existing entries in mal, add first then update.
	// TODO: check user's mal library before adding or updating
	
	var path = '/api/animelist/add/' + malid + '.xml';
	// var path = '/api/animelist/update/' + malid + '.xml';
	console.log(path);

	var params = {'data':xmlbody};
	var postData = querystring.stringify(params);

	var req = https.request({
		hostname: 'myanimelist.net',
		port: 443,
		path: path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': postData.length
		},
		auth: maluserpass
	}, (res) => {
		if(res.statusCode != 200) {
			console.log(anime.data.attributes.titles.en_jp + " (" + malid + ")" + JSON.stringify(malnode));
			console.log(`STATUS: ${res.statusCode}`);
			console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			console.log(xmlbody);
		}
	});

	req.on('error', (e) => {
		console.log(`problem with request: ${e.message}`);
	});

	req.write(postData);
	req.end();
}