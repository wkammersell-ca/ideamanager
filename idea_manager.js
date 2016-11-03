var bodyParser = require('body-parser');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');

var BRIGHTIDEA_ACCESS_TOKEN;
var TOKEN_FILE_PATH = 'token.txt';

console.log("Let's get started!");
console.log("First, let's read token.txt for login info");

fs.readFile( TOKEN_FILE_PATH, 'utf8', (err, data) => {
	if (err) {
		throw err;
	}
	
	// Assumes token.txt is the format type.code
	var code = data.split(':')[1];
	
	if( data.startsWith('authorization') ) {
		console.log("Let's convert an authorization code to a token");	
		getBrightIdeaTokenFromAutentication( code );
	} else {
		getBrightIdeaTokenFromRefresh( code );
	}
})

function getBrightIdeaTokenFromAutentication( code ){
	console.log("Conversting code (" + code + ") to a token");
	var options = {
		hostname: 'auth.brightidea.com' ,
		path: '/_oauth2/token',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};

	var payload = {
		'grant_type': 'authorization_code',
		'client_id': 'd33d3d7b9ab44ec09acfc0ab0f028834',
		'client_secret': '635a649e8e79434485be8fbb4d9ee8d9',
		'code': code,
		'redirect_uri': 'http%3A%2F%2Fwww.ca.com'
	};


	var req = https.request( options , resDetails => {
		resDetails.setEncoding( 'utf8' );
		resDetails.on('data', (d) => {
			var data = JSON.parse(d);
			console.log( data );
			BRIGHTIDEA_ACCESS_TOKEN = data.access_token;
			writeRefreshTokenToFile( data.refresh_token );
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.write( querystring.stringify( payload ) );
	req.end();
};

function getBrightIdeaTokenFromRefresh( refresh_token ) {
	console.log("Let's get an API token from Refresh Token");

	var options = {
		hostname: 'auth.brightidea.com' ,
		path: '/_oauth2/token',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};

	var payload = {
		'grant_type': 'refresh_token',
		'client_id': 'd33d3d7b9ab44ec09acfc0ab0f028834',
		'client_secret': '635a649e8e79434485be8fbb4d9ee8d9',
		'refresh_token': refresh_token,
		'redirect_uri': 'http%3A%2F%2Fwww.ca.com'
	};


	var req = https.request( options , resDetails => {
		resDetails.setEncoding( 'utf8' );
		resDetails.on('data', (d) => {
			var data = JSON.parse(d);
			console.log( data );
			BRIGHTIDEA_ACCESS_TOKEN = data.access_token;
			writeRefreshTokenToFile( data.refresh_token );
		});
	});

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.write( querystring.stringify( payload ) );
	req.end();
};

function writeRefreshTokenToFile( refresh_token ) {
	fs.writeFile(TOKEN_FILE_PATH, 'refresh:' + refresh_token, 'utf8', (err) => {
		if (err) throw err;
		getOldLowVoteIdeas();
	});
};

function getOldLowVoteIdeas(){
	console.log("Let's get the list of ideas over a year old...");
	
	var date = new Date();
	date.setFullYear( date.getFullYear() - 1);
	var date_string = (date.getMonth() + 1) + '/' + date.getDate() + '/' +  date.getFullYear();

	var options = {
		hostname: 'ideas.rallydev.com' ,
		path: '/api3/idea',
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + BRIGHTIDEA_ACCESS_TOKEN,
			//'q': 'date_created <= ' + date_string
			'q': "date_created = '10/16/2016'",
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};
	
	var req = https.request( options , resDetails => {
		resDetails.setEncoding( 'utf8' );
		var data = '';
		
		resDetails.on('data', (d) => {
			data = data + d;
		});
		
		resDetails.on('end', () => {
			data = JSON.parse(data);
			console.log( data );
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.end();
};

