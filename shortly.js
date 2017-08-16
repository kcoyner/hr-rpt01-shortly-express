var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


//PASSPORT Authentication Modules
var GitHubStrategy = require('passport-github2').Strategy;
var passport = require('passport');

// Client ID
// Client Secret




var GITHUB_CLIENT_ID = '4445f89238074eb889f6';
var GITHUB_CLIENT_SECRET = 'abf6f60e83283871e80f4ab1a503bf2425245528';

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://lvh.me:4567/callback"
  },

  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function() {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));



var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'keyboard cat',
  cookie: {
    maxAge: 500000
  },
  resave: false,
  saveUninitialized: false
}));

// analagous to checkUser function as mentioned in Learn
function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/',
  function(req, res) {
    res.render('index');
  });

app.get('/create', ensureAuthenticated,
  function(req, res) {
    res.render('index', {
      user: req.user
    });
  });

app.get('/links',
  function(req, res) {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  });

app.post('/links',
  function(req, res) {
    var uri = req.body.url;
    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.sendStatus(404);
    }

    new Link({
      url: uri
    }).fetch().then(function(found) {
      if (found) {
        res.status(200).send(found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.sendStatus(404);
          }

          Links.create({
            url: uri,
            title: title,
            baseUrl: req.headers.origin
          })
            .then(function(newLink) {
              res.status(200).send(newLink);
            });
        });
      }
    });
  });

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

  var user = new User({
    username: username,
    password: hash,
    salt: salt
  });

  user.save().then(function() {
    // return res.redirect('/');
    if (!user) {
      console.log('User save did not complete');
      res.redirect('/login');
    } else {
      req.session.regenerate(function() {
        req.session.user = username;
        res.redirect('/');
      });
    }
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

// app.post('/login', function(req, res) {
//   var username = req.body.username;
//   var password = req.body.password;

//   var salt = bcrypt.genSaltSync(10);
//   var hash = bcrypt.hashSync(password, salt);

//   var usr = new User({
//     username: username
//   }).fetch().then(function(user) {
//     if (!user) {
//       console.log('Not Valid Username and/or password');
//       res.redirect('/login');
//     } else {
//       req.session.regenerate(function() {
//         req.session.user = username;
//         res.redirect('/');
//       });
//     }
//   });
// });

app.get('/auth/github',
  passport.authenticate('github', {
    scope: ['user:username']
  }),
  function(req, res) {
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

app.get('/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect('/index');
  });

// app.get('/logout', ensureAuthenticated, function(req, res) {
//   req.session.destroy(function(err) {
//     if (err) {
//       console.log('Error while destroying cookie: ', err);
//     }
//     res.render('logout');
//   });
// });


app.get('/logout', function(req, res) {
  // TODO:  checkout this logout function.  Does it really logout?
  req.logout();
  res.redirect('/login');
});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({
    code: req.params[0]
  }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/index');
}

module.exports = app;
