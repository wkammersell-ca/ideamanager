var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var _ = require('underscore');

var IGNORE_LIST = [];
var TOKEN_FILE_PATH = 'token.json';
var IGNORE_FILE_PATH = 'ignore.txt';
var BRIGHTIDEA_HOST = 'rallydev.brightidea.com';
var BRIGHTIDEA_RENAMED_HOST = 'ideas.rallydev.com';

var SAFE_MODE_ARG = '--safe';
var ARCHIVE_IDEAS_ARG = '--archive_ideas';
var CREATE_REVIEW_LIST_ARG = '--create_review_list';
var VIEW_IDEA_ARG = '--view_idea';
var IDEA_ID_ARG = '--idea_id=';

var CATEGORY_IGNORE_LIST = [ 'Test Management' ];

var SUBMITTED_STATUS_ID = '7CA6F64B-54A6-4FD4-BAD1-00D331A30961';
var UNDER_REVIEW_STATUS_ID = '3CE7A5D7-45F3-4852-A83F-0E9CECDEA3FF';
var NEED_INPUT_STATUS_ID = '141A6B8E-78B6-48B0-98EE-DF80F4DEEF65';
var UNDER_REVIEW_STATUS_ID = '3CE7A5D7-45F3-4852-A83F-0E9CECDEA3FF';
var PLANNED_STATUS_ID = '44396918-8AB2-4B08-889C-F70B90CE16F4';
var COMING_SOON_STATUS_ID = 'B26D8DCB-DF7F-46F1-BA3D-E3F34CE019A4';
var RELEASED_STATUS_ID = '53EDDE29-DE5A-4847-BBB0-4D0C3033301D';
var NOT_PLANNED_STATUS_ID = 'A5C1C89E-46CB-4234-B348-A6B44E80E0BD';
var ARCHIVED_STATUS_ID = '9AE7A1DB-F3DE-4997-BA82-0BE7987A9ECB';

var THIS_YEAR = 'this_year';
var YEAR_OLD = 'year_old';

/*
// Initialize Ignore List
fs.readFile( IGNORE_FILE_PATH, 'utf8', (err, data) => {
	if (err) { throw err; }
	
	// Assumes ignore list is the format of one ID per line
	IGNORE_LIST = data.split('\n');
	
	readTokenFile();
}); */

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

function viewIdea( idea_id, req, res, next ) {
	console.log("Let's get the details for idea " + idea_id );
	
	var options = {
		hostname: BRIGHTIDEA_HOST,
		path: '/api3/idea?idea_code=' + idea_id,
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
			req.idea_data = data.idea_list[0].title;
			next();
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
	viewIdea( req.body.searchString, req, res, next );
}, function( req, res) {
	res.render('index', { title: req.idea_data });
});

module.exports = router;