
// Expose modules in ./support for demo purposes
require.paths.unshift(__dirname + '/../../support');

/**
 * Module dependencies.
 */
var express = require('express')
	, crypto = require('crypto')
	, ejs = require('ejs')
	, data = require(__dirname + '/data');

var app = module.exports = express.createServer();

// Optional since express defaults to CWD/views
app.set('views', __dirname + '/views');
// Set our default template engine to "ejs"
app.set('view engine', 'html');
app.register('.html', require('ejs'));
//Public directory
var pub = __dirname + '/public';
app.use(express.static(pub));

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: 'secret salt yay!'}));

app.dynamicHelpers({
	message: function(req){
		var err = req.session.error
			,	msg = req.session.success;
			delete req.session.error;
			delete req.session.success;
			if (err) return err;
			if (msg) return msg;
	}
});

app.get('/', function(req, res){
  res.redirect('/login');
});

app.get('/login', function(req, res){
	if (req.session.user) {
		req.session.success = 'Authenticated as ' + 
													'<a href=/user/' + req.session.user.userid + 
													'>' + req.session.user.name + '</a>';
	} else {
		req.session.success = 'Please login:';
	}
	res.render('login');
});

app.post('/login', function(req,res){
	console.log('username:' + req.body.username + ' password:' + req.body.password);
	authenticate(req.body.username, req.body.password, function(err, user){
		if (user){
			req.session.regenerate(function(){
				req.session.user = user;
				//res.render('user', {user: user});
				res.redirect('/user/' + req.body.username)
			});
		} else {
			req.session.error = err.message;
			res.redirect('back');
		}
	});
});

app.get('/user/:username', function(req, res){
	if (req.session.user){
		if (req.session.user.userid == req.params.username){
			res.render('user', {user: req.session.user});
		} else {
			res.redirect('/logout');
		}
	}
});

app.get('/logout', function(req,res){
	//destroy the session
	req.session.destroy(function(){
		res.redirect('/login');
	});
});

app.get('/newpage', function(req,res){
	if (req.session.user){
		res.render('client')
	} else {
		res.redirect('/logout');
	}
});

app.post('/savepage', function(req,res){
	if (req.session.user){
		console.log('got post request for save page');
		savePage(req.session.user.userid, req.body);
	} else {
		res.redirect('/logout');
	}
});

app.listen(3000);
console.log('Express app started on port 3000');

//Helper functions bellow
function authenticate(username, pass, fn){
	var user = data.getUser(username);
	//query db for user existance
	if (!user) return fn(new Error('Invalid username and/or password'));
	//Check the password
	var userPass = data.getPassword(user);
	if (userPass == pass) return fn(null, user);
	//otherwise throw error, password is invalid
	fn(new Error('Invalid username and/or password'));
};