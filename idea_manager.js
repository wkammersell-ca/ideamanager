var bodyParser = require('body-parser');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var _ = require('underscore');

var BRIGHTIDEA_ACCESS_TOKEN;
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

// vars for archiving old ideas with low chips
var CHIPS_CUTOFF = 7;
var COMMENT_TEXT = "I'm archiving this as it has " + CHIPS_CUTOFF + " or less chips in a year. Please resubmit if you still want this.";

// vars for creating review lists
var MAX_IDEAS = 10;
var REVIEWERS = [ 'Andrea', 'Marianne', 'Mia', 'William' ];
var REVIEW_LIST_FILTE_PATH = 'review_list.tsv';

console.log("Let's get started!");
console.log("First, let's read " + TOKEN_FILE_PATH + " for login info");

// Initialize Ignore List
fs.readFile( IGNORE_FILE_PATH, 'utf8', (err, data) => {
	if (err) { throw err; }
	
	// Assumes ignore list is the format of one ID per line
	IGNORE_LIST = data.split('\n');
	
	readTokenFile();
});

function readTokenFile(){
	fs.readFile( TOKEN_FILE_PATH, 'utf8', (err, data) => {
		if (err) { throw err; }
		data = JSON.parse(data);
		var code = data.code;
	
		if( data.type == 'authorization' ) {
			console.log("Let's convert an authorization code to a token");	
			getBrightIdeaTokenFromAutentication( code );
		} else {
			getBrightIdeaTokenFromRefresh( code );
		}
	});
};

function getBrightIdeaTokenFromAutentication( code ){
	console.log("Converting authorization code to a token");
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
			
			if( data.error ) {
				console.log( 'ERROR - ' + data.error_description );
			} else {
				BRIGHTIDEA_ACCESS_TOKEN = data.access_token;
				writeRefreshTokenToFile( data.refresh_token );
			}
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
			
			if( data.error ) {
				console.log( 'ERROR - ' + data.error_description );
			} else {
				BRIGHTIDEA_ACCESS_TOKEN = data.access_token;
				writeRefreshTokenToFile( data.refresh_token );
			}
		});
	});

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.write( querystring.stringify( payload ) );
	req.end();
};

function writeRefreshTokenToFile( refresh_token ) {
	var output = {};
	output.type = 'refresh';
	output.code = refresh_token;

	fs.writeFile(TOKEN_FILE_PATH, JSON.stringify( output ), 'utf8', (err) => {
		if (err) throw err;
		if ( _.contains( process.argv, ARCHIVE_IDEAS_ARG  ) ) {
			archiveIdeas();
		} else if ( _.contains( process.argv, CREATE_REVIEW_LIST_ARG  ) ) {
			createReviewList();
		} else if ( _.contains( process.argv, VIEW_IDEA_ARG ) ) {
			// TODO: Be smarter here rather than assume the idea_id is always the second argument
			viewIdea( process.argv[3].split('=')[1] );
		} else {
			console.log( 'Error: no script given. Options are ' + ARCHIVE_IDEAS_ARG + ' or ' + CREATE_REVIEW_LIST_ARG + ' or ' + VIEW_IDEA_ARG );
		}
	});
};

function viewIdea( idea_id ) {
	console.log("Let's get the details for idea " + idea_id );
	
	var options = {
		hostname: BRIGHTIDEA_HOST,
		path: '/api3/idea?idea_code=' + idea_id,
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
			console.log( data );
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.end();
};

function archiveIdeas() {
	var archivals = [];
	archivals = [
		{
			'statusLog': 'Submitted ideas',
			'statusId': SUBMITTED_STATUS_ID,
			'order': 'date_created ASC'
		},
		{
			'statusLog': 'Not Planned ideas',
			'statusId': NOT_PLANNED_STATUS_ID,
			'order': 'date_created ASC'
		}
	];
	
	processArchivals( archivals, 0, 1, [] );
};

function processArchivals( archivals, archival_index, page_index, idea_ids ){
	var archival = archivals[ archival_index ];
	console.log("Let's get the list of " + archival.statusLog + " (page "+ page_index + ")...");
	
	var date_cutoff = new Date();
	date_cutoff.setFullYear( date_cutoff.getFullYear() - 1);
	
	var options = {
		hostname: BRIGHTIDEA_HOST,
		path: '/api3/idea?visible=1&status_id=' + archival.statusId +
			'&order=' + encodeURIComponent( archival.order ) +
			'&page_size=50&page=' + page_index,
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
				if ( new Date( idea.date_created ) <= date_cutoff ) {
					fetch_other_page = true;
					
					if( idea.chips <= CHIPS_CUTOFF ) {
						idea_ids.push( idea.id );
						console.log( "Found " + idea.idea_code + " submitted on " + idea.date_created + " with " + idea.chips + " chips.");
					}
					
				} else {
					fetch_other_page = false;
				}
			},this);
			
			if( fetch_other_page ) {
				processArchivals( archivals, archival_index, page_index + 1, idea_ids );
			} else {
				console.log( 'Found ' + idea_ids.length + ' ideas.' );
				
				if ( archival_index >= archivals.length - 1 ) {
					if ( _.contains( process.argv, SAFE_MODE_ARG  ) ) {
						console.log( 'Done [SAFE MODE]' );
					} else {
						commentIdea( 0, idea_ids );
					}
				} else {
					processArchivals( archivals, archival_index + 1, 1, idea_ids );
				}
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
			"hostname": BRIGHTIDEA_HOST,
			"path": "/api3/comment?idea_id=" + encodeURIComponent( idea_ids[ index ] ) +
				"&comment=" + encodeURIComponent( COMMENT_TEXT ),
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
	
	var options = {
		"method": "PUT",
		"hostname": BRIGHTIDEA_HOST,
		"path": "/api3/idea/" + encodeURIComponent( idea_ids[ index ] ) +
			"?status_id=" + encodeURIComponent( ARCHIVED_STATUS_ID ),
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

function createReviewList() {
	var checks = [];
	checks = [
		{
			'statusLog': 'Submitted ideas from this year',
			'statusId': SUBMITTED_STATUS_ID,
			'order': 'date_created DESC',
			'dateCheck': THIS_YEAR
		},
		{
			'statusLog': 'Submitted ideas from over a year',
			'statusId': SUBMITTED_STATUS_ID,
			'order': 'chips DESC',
			'dateCheck': YEAR_OLD
		},
		{
			'statusLog': 'Under Review ideas from over a year',
			'statusId': UNDER_REVIEW_STATUS_ID,
			'order': 'chips DESC',
			'dateCheck': YEAR_OLD
		},
		{
			'statusLog': 'Need Input ideas from over a year',
			'statusId': NEED_INPUT_STATUS_ID,
			'order': 'chips DESC',
			'dateCheck': YEAR_OLD
		},
		{
			'statusLog': 'Planned ideas from over a year',
			'statusId': PLANNED_STATUS_ID,
			'order': 'chips DESC',
			'dateCheck': YEAR_OLD
		},
		{
			'statusLog': 'Not Planned ideas from over a year',
			'statusId': NOT_PLANNED_STATUS_ID,
			'order': 'chips DESC',
			'dateCheck': YEAR_OLD
		}
	];

	processCheck( checks, 0, 1, [] );
};

function processCheck( checks, check_index, page_index, ideas ){
	var check = checks[ check_index ];
	console.log("Let's get the list of " + check.statusLog + " (page "+ page_index + ")...");
	
	var date_cutoff = new Date();
	date_cutoff.setFullYear( date_cutoff.getFullYear() - 1);
	
	var options = {
		hostname: BRIGHTIDEA_HOST,
		path: '/api3/idea?visible=1&status_id=' + check.statusId +
			'&order=' + encodeURIComponent( check.order ) +
			'&page_size=50&page=' + page_index,
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

			if( data.error ) {
				console.log('ERROR - ' + data.error_description );
			} else if ( data.errorCode ) {
				console.log('ERROR - ' + data.message );
			} else {			
				_.each(data.idea_list, function( idea ){
					if( IGNORE_LIST.indexOf( idea.idea_code ) == -1 ) {
						fetch_other_page = true;
						IGNORE_LIST.push( idea.idea_code );
					
						var date_check;
						var idea_date = new Date( idea.date_modified );
				
						if ( check.dateCheck == THIS_YEAR ) {
							date_check = idea_date >= date_cutoff;
						} else if ( check.dateCheck == YEAR_OLD ) {
							date_check = idea_date < date_cutoff;
						} else {
							date_check = true;
						}
			
						if ( date_check && ( CATEGORY_IGNORE_LIST.indexOf( idea.category.name ) == -1 ) ) {
							ideas.push( idea );
							console.log( "Found " + idea.idea_code +
								" submitted on " + idea.date_created +
								" modified on " + idea.date_modified +
								" with " + idea.chips + " chips.");
						}
					}
				},this);
			}
			
			if( fetch_other_page ) {
				processCheck( checks, check_index, page_index + 1, ideas );
			} else {
				console.log( 'Found ' + ideas.length + ' ideas.' );
				if ( check_index >= checks.length - 1 ) {
					// There's no need to run this check right now as BrightIdea doesn't show admin comments to non-Site Admins
					// checkComments( ideas, 0 );
					divvyIdeas( ideas, {} ); // Remove this line when we reinstate comment checking
				} else {
					processCheck( checks, check_index + 1, 1, ideas );
				}
			}
		});
	} );

	req.on( 'error' , function (e) {
		console.log( 'problem with request: ' + e.message );
	} );

	req.end();
};

function checkComments( ideas, idea_index ) {
	if( ( idea_index >= ideas.length ) || ( idea_index >= ( REVIEWERS * MAX_IDEAS ) ) ){
		divvyIdeas( ideas, {} );
	} else {
	
		var idea = ideas[idea_index];
		console.log("Checking comments for " + idea.idea_code + "...");
		
		var date_cutoff = new Date();
		date_cutoff.setFullYear( date_cutoff.getFullYear() - 1);
	
		var options = {
			hostname: BRIGHTIDEA_HOST,
			path: '/api3/comment?idea_id=' + idea.id +
				'&order=' + encodeURIComponent( 'date_created' ) +
				'&page_size=10&page=1',
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
				var admin_comment_found = false;
				
				if( data.error ) {
					console.log('ERROR - ' + data.error_description );
				} else if ( data.errorCode ) {
					console.log('ERROR - ' + data.message );
				} else {
					_.each(data.comment_list, function( comment ){
						var comment_date = new Date( comment.date_created );
						if ( !admin_comment_found &&
							 ( comment_date < date_cutoff ) &&
							 ( comment.admin == 1 ) ) {
							console.log( "Found recent admin comment.");
							ideas.splice( idea_index, 1 );
							admin_comment_found = true;
						}
					},this);
				}
			
				if( admin_comment_found ) {
					checkComments( ideas, idea_index );
				} else {
					checkComments( ideas, idea_index + 1 );
				}
			});
		} );

		req.on( 'error' , function (e) {
			console.log( 'problem with request: ' + e.message );
		} );
		
		
		req.end();
	}
};

function divvyIdeas( ideas, ideas_by_reviewer ){
	if( Object.keys( ideas_by_reviewer).length == 0 ) {
		_.each( REVIEWERS, function( reviewer ){
			ideas_by_reviewer[ reviewer ] = [];
		}, this);
	}
	
	var index = 0;
	_.each( ideas, function( idea ) {
		var reviwer_ideas = ideas_by_reviewer[ REVIEWERS[ index % REVIEWERS.length ] ];
		if( reviwer_ideas.length < MAX_IDEAS ) {
			reviwer_ideas.push( idea );
		}
		index++;
	}, this );
	
	outputReviewList( ideas_by_reviewer );
};

function outputReviewList( ideas_by_reviewer ) {
	var write_buffer = [
		'Reviewer',
		'Idea Code',
		'Category',
		'Date Created',
		'Date Modified',
		'Submitter',
		'Title',
		'Description',
		'Status',
		'New Status',
		'Chips',
		'Comments',
		'URL'
	].join( '	');
	
	_.each( REVIEWERS, function( reviewer ){
		_.each( ideas_by_reviewer[ reviewer ], function ( idea ) {
			write_buffer += String.fromCharCode(13); //new line
			write_buffer += [
				reviewer,
				idea.idea_code,
				idea.category.name,
				idea.date_created,
				idea.date_modified,
				idea.member.screen_name,
				idea.title,
				idea.description.replace(/[\n\t]/g, ''), //Avoid having description line breaks and tabs messing up the TSV
				idea.status.name,
				'TBD',
				idea.chips,
				idea.comment_count,
				idea.url.replace( BRIGHTIDEA_HOST, BRIGHTIDEA_RENAMED_HOST )
			].join('	');
		}, this );	
	}, this );
	
	
	fs.writeFile(REVIEW_LIST_FILTE_PATH, write_buffer, 'utf8', (err) => {
		if (err) throw err;
		console.log('Review List written to: ' + REVIEW_LIST_FILTE_PATH );
	});
};