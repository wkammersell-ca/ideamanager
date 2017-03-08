var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var _ = require('underscore');

var TOKEN_FILE_PATH = 'token.json';
var BRIGHTIDEA_HOST = 'rallydev.brightidea.com';
var BRIGHTIDEA_RENAMED_HOST = 'ideas.rallydev.com';

var DONE_STATUSES = [ 'Archived', 'Already Available', 'Released' ];

var createBrightIdeaAPIToken = function( req, res, next ) {
	console.log("Checking token file - " + TOKEN_FILE_PATH + "...");
	fs.readFile( TOKEN_FILE_PATH, 'utf8', (err, data) => {
		if (err) { throw err; }
		
		var hour = 1000*60*60;
		var now = new Date();
		
		data = JSON.parse(data);
		var code = data.code;
		var last_refresh = data.last_refresh;
		
		if( data.type == 'authorization' ||
			last_refresh === null ||
			( now.getTime() - Date.parse( last_refresh ) > hour ) ) {
			getBrightIdeaTokenFromCode( data, req, res, next );
		} else {
			console.log("API Token should still be valid.");
			req.access_token = data.access_token;
			next();
		}
	});
};

function getBrightIdeaTokenFromCode( data, req, res, next ){
	console.log("Converting " + data.type + " code to a token");
	var options = {
		hostname: 'auth.brightidea.com' ,
		path: '/_oauth2/token',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};

	var payload = {
		'client_id': 'd33d3d7b9ab44ec09acfc0ab0f028834',
		'client_secret': '635a649e8e79434485be8fbb4d9ee8d9',
		'redirect_uri': 'http%3A%2F%2Fwww.ca.com'
	};

	var grant_type;
	if ( data.type == 'authorization' ) {
		payload.grant_type = 'authorization_code';
		payload.code = data.code;
	} else {
		payload.grant_type = 'refresh_token';
		payload.refresh_token = data.code;
	}
	
	var myReq = https.request( options , resDetails => {
		resDetails.setEncoding( 'utf8' );
		resDetails.on('data', (d) => {
			var data = JSON.parse(d);
			
			if( data.error ) {
				console.log( 'ERROR - ' + data.error_description );
			} else {
				writeTokenToFile( data.refresh_token, data.access_token,
					req, res, next);
			}
		});
	} );

	myReq.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	myReq.write( querystring.stringify( payload ) );
	myReq.end();
};

function writeTokenToFile( refresh_token, access_token, req, res, next ) {
	console.log("Writing refresh code to file...");
	var output = {};
	output.type = 'refresh';
	output.code = refresh_token;
	output.last_refresh = new Date();
	output.access_token = access_token;

	fs.writeFile(TOKEN_FILE_PATH, JSON.stringify( output ), 'utf8', (err) => {
		if (err) throw err;
		
		req.access_token = access_token;
		next();
	});
};

function search( req, res, next ) {
	var searchString = req.body.searchString;
	if ( req.search_results === undefined ) {
		console.log( 'Initializing Search variables' );
		req.search_results = [];
		req.search_page = 1;
	}
	console.log( "Let's search for: " + searchString + " (page " + req.search_page + ")" );
	
	var options = {
		hostname: BRIGHTIDEA_HOST,
		path: '/api3/search?query=' + searchString +
			'&type=idea&format=json&page=' + req.search_page,
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + req.access_token
		}
	};
	
	var myReq = https.request( options , resDetails => {
		resDetails.setEncoding( 'utf8' );
				
		var data = '';
		
		resDetails.on('data', (d) => {
			data = data + d;
		});
		
		resDetails.on('end', () => {
			data = JSON.parse(data);
			_.each(data.search, function( searchResult ){
				searchResult.full_url = "https://" + BRIGHTIDEA_RENAMED_HOST + searchResult.url;
				if( DONE_STATUSES.indexOf( searchResult.status ) == -1 ||
					req.body.showDone ) {
					req.search_results.push( searchResult );
				}
			},this);
			
			if ( req.search_page < data.stats.page_count ) {
				req.search_page = req.search_page + 1;
				search( req, res, next );
			} else {
				next();
			}
		});
	} );

	myReq.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	myReq.end();
};

router.get('/', createBrightIdeaAPIToken, function(req, res) {
	res.render('index', {} );
});

router.post('/', createBrightIdeaAPIToken, function(req, res, next) {
	search( req, res, next );
}, function( req, res) {
	console.log( req.search_results );
	res.render('index', { searchResults: req.search_results });
});

module.exports = router;