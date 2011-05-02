//Redis connection stuff

var redisNode = require('redis'),
		//redis = redisNode.createClient(),
    	parseUrl = require('url').parse;

var db_uri = parseUrl(process.env['DUOSTACK_DB_REDIS']),
    db_pwd = db_uri.auth.split(':')[1],
    redis = redisNode.createClient(db_uri.port, db_uri.hostname);

redis.auth(db_pwd, function () {
  console.log('Redis authenticated');
});


redis.on('error', function(err){
	console.log('Error on data layer ' + err);
});


//Data Model
//user 															== the user's password
//user:numPages 										== num Pages User Has
//user:page:#num										== retrieve Page Defined By #Num
//user:page:#num:processed:html			== only the html (dom) elements of the page
//user:page:#num:processed:css			== only the css styles associated with the page
//user:page:#num:dirty							== set if page was externally fetched

//Saves a page to redis. If no page number is given, a new page will be saved and the
//number of pages incremented. Otherwise the page with the specified number will be
//overwritten.
exports.savePage = function(user, pageData, pageNum, dirty){
	//Overwriting a page, or save a new page?
	if (pageNum){
		redis.set(user + ":page:" + pageNum, pageData);
	} else {
		redis.get(user + ":numPages", function(err, reply){
			if (err || (reply === null)){
				console.log('ERROR: while saving page');
				return;
			}
			var pageIndex = parseInt(reply.toString());
			redis.set(user + ":page:" + pageIndex, pageData);
			redis.incr(user + ":numPages");
			
			//Set dirty bit for externally fetched pages
			if (dirty){
				redis.set(user + ":page:" + pageIndex + ":dirty", "true");
			}
		});
	}
};

//Returns a previously saved page
exports.getPage = function(user, pageNum, callback){
	redis.get(user + ":page:" + pageNum, function(err, reply){
		if (err || !reply) {
			return callback(new Error("Could not retrieve page"));
		}
		
		callback(null, reply.toString());
	});
};

exports.addUser = function(username, password){
	redis.set(username, password);
	redis.set(username + ":numPages", 0)
	return makeUser(username, password);
};

exports.getUser = function(userid, callback){
	redis.get(userid, function(err, reply){
		if (err || !reply) return callback(undefined);
		
		var user = makeUser(userid, reply.toString());
		callback(user);
	});
};

exports.getPageList = function(user, callback){
	redis.get(user.username + ":numPages", function(err, reply){
		if (err) return callback(err);
		
		var numPages = parseInt(reply.toString());
		var pages = makePages(user, numPages);
		callback(null, pages);
	})
};

exports.saveProcessedPage = function(user, pageHTML, pageCSS, pageNum){
	if (pageNum){
		redis.set(user + ":page:" + pageNum + ":processed:html", pageHTML);
		redis.set(user + ":page:" + pageNum + ":processed:css", pageCSS);
	} else{
		redis.get(user + ":numPages", function(err, reply){
			if (err || (reply === null)){
				console.log('ERROR: while saving processed page');
				return;
			}
			var pageIndex = parseInt(reply.toString());
			redis.set(user + ":page:" + pageIndex + ":processed:html", pageHTML);
			redis.set(user + ":page:" + pageIndex + ":processed:css", pageCSS);
		});
	}
};

exports.getProcessedPage = function(user, page, callback){
	redis.get(user + ":page:" + page + ":processed:html", function(err, reply){
		if (err || !reply) return callback(err);
		
		var html = reply.toString();
		
		redis.get(user + ":page:" + page + ":processed:css", function(err2, reply2){
			if (err || !reply) return callback(err);
			
			var css = reply2.toString();
			
			var processed = {canvas: html, style: css};
			callback(null, processed);
		});
	});
};

exports.getDirtyBit = function(user, page, callback){
	redis.get(user + ":page:" + page + ":dirty", function(err, reply){
		if (err || !reply) return callback(false);
		
		callback(true);
	});
};

//Convenience methods
function makeUser(username, password){
	var user = {'username' : username, 'password' : password};
	return user;
};

function makePages(user, numPages){
	var pages = [];
	for (var i = 0; i<numPages; i++){
		var pageUrl = '<a target="_blank" href="/user/' + user.username + '/' + i + '.html">Page' + i + '</a>';
		var editUrl = '<a href="/client/?user=' + user.username + '&page=' + i + '"><i>edit</i></a>';
		pages.push({url : pageUrl, edit: editUrl});
	}
	return pages;
};