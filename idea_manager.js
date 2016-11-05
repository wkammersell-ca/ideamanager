var bodyParser = require('body-parser');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var _ = require('underscore');

var BRIGHTIDEA_ACCESS_TOKEN;
var TOKEN_FILE_PATH = 'token.txt';
var UNPLANNED_STATUS_ID = '7CA6F64B-54A6-4FD4-BAD1-00D331A30961';
var ARCHIVED_STATUS_ID = '9AE7A1DB-F3DE-4997-BA82-0BE7987A9ECB';
var CHIPS_CUTOFF = 5;
var COMMENT_TEXT = "Thanks for your idea. I'm archiving it as it has received less than " + CHIPS_CUTOFF + " chips in a year.";

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
	console.log("Converting code (" + code + ") to a token");
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
		// console.log( 'Access Token = ' + BRIGHTIDEA_ACCESS_TOKEN );
		getSubmittedIdeas( 1, [] );
	});
};

function getSubmittedIdeas( page_index, idea_ids ){
	console.log("Let's get the list of 'Submitted' ideas (page "+ page_index + ")...");
	
	var date_cutoff = new Date();
	date_cutoff.setFullYear( date_cutoff.getFullYear() - 1);
	
	var options = {
		hostname: 'ideas.rallydev.com' ,
		//path: '/api3/idea?visible=1&status_id=' + UNPLANNED_STATUS_ID +'&order=date_created&page_size=50&page=' + page_index,
		path: '/api3/idea?idea_code=D4186',
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + BRIGHTIDEA_ACCESS_TOKEN
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
			
			var fetch_other_page = false;
			
			_.each(data.idea_list, function( idea ){
			//	if ( new Date( idea.date_created ) <= date_cutoff ) {
					fetch_other_page = true;
					
					if( idea.chips <= CHIPS_CUTOFF ) {
						idea_ids.push( idea.id );
						console.log( "Found " + idea.idea_code + " submitted on " + idea.date_created + " with " + idea.chips + " chips.");
					}
					
			//	} else {
					fetch_other_page = false;
			//	}
			},this);
			
			if( fetch_other_page ) {
				getSubmittedIdeas( page_index + 1, idea_ids )
			} else {
				console.log( 'Found ' + idea_ids.length + ' ideas.' );
				commentIdea( 0, idea_ids );
			}
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.end();
};

function commentIdea( index, idea_ids ){
	if ( index >= idea_ids.length ) {
		console.log('All done!');
	} else {
		console.log('Commenting idea #' + ( index + 1 ) + ' (' + idea_ids[ index ] + ')');
		
		var options = {
			"method": "POST",
			"hostname": "ideas.rallydev.com",
			"path": "/api3/comment?idea_id=" + idea_ids[ index ] + "&comment=" + encodeURIComponent( COMMENT_TEXT ),
			"headers": {
				"authorization": "Bearer " + BRIGHTIDEA_ACCESS_TOKEN,
				"content-type": "application/x-www-form-urlencoded",
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
				archiveIdea( index, idea_ids );
			});
		} );

		req.on( 'error' , function (e) {
			console.log( 'problem with request: ' + e.message );
		} );

		req.end();
	}
};

function archiveIdea( index, idea_ids ){
	console.log('Archiving idea #' + ( index + 1 ) + ' (' + idea_ids[ index ] + ')');
	
	var comment_text = "Thanks for your idea. I'm archiving it as it has received less than 5 votes in a year.";
	
	var options = {
		"method": "PUT",
		"hostname": "ideas.rallydev.com",
		"path": "/api3/idea/" + idea_ids[ index ] + "?status_id=" + ARCHIVED_STATUS_ID,
		"headers": {
			"authorization": "Bearer " + BRIGHTIDEA_ACCESS_TOKEN,
			"content-type": "application/x-www-form-urlencoded",
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
			commentIdea( index + 1, idea_ids );
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.end();
};