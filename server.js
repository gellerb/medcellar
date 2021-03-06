var express = require('express'),
    path = require('path'),
    http = require('http'),
    helmet = require('helmet'),
    lusca = require('lusca'),
    sanitizer = require('sanitizer'),
    passport = require('passport'),
    med = require('./routes/meds'),
    user = require('./routes/users'),
    https = require('https'),
    fs = require('fs'),
    compression = require('compression'),
    minify = require('express-minify'),
    expressHbs = require('express-handlebars'),
    config = require(process.env.MED_CONF);

var app = express();

var accessLogStream = fs.createWriteStream(config.accessLog, {
    flags: 'a'
});

app.configure(function() {
    app.set('port', process.env.PORT || 3000);
    app.use(express.logger({stream: accessLogStream}));
    app.use(compression());
    app.use(minify());
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.methodOverride());
    app.use(express.session({
        secret: 'penandteller',
        cookie: {
            maxAge: 3600000 // see below
        }
    }));
    // helmet.js Configuration
    if (config.helmet) {
        app.use(helmet.hidePoweredBy());
        app.use(helmet.noCache());
        app.use(helmet.noSniff());
        app.use(helmet.frameguard());
        app.use(helmet.xssFilter());
        /*
        app.use(helmet.hsts());
        app.use(helmet.hpkp());
        app.use(helmet.contentSecurityPolicy({
            cspStuff: ['cspValues']
        }));
        */
    }

    if (config.transportSecurity) {
        app.use(lusca({
            hsts: {maxAge: 31536000, includeSubDomains: true}
        }));
    }
    app.engine('hbs', expressHbs({extname:'hbs'}));
    app.set('view engine', 'hbs');
    if(config.csrf) {
        app.use(express.csrf());
    }
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/', function(req,res){
    if(config.csrf){
        res.render('index',{token: req.csrfToken()});
    }
    if(!config.csrf){
        res.render('index');
    }
});
app.get('/login', function(req,res){
    res.redirect('/#login');
});
app.get('/logout',function(req,res){
    req.logout();
    res.redirect('/');
});
app.post('/login', user.login);
app.post('/register', user.register);
app.get('/meds', user.ensureAuth, med.findAll);
app.get('/meds/:id', user.ensureAuth, med.findById);
app.post('/meds', user.ensureAuth, med.addMed);
app.put('/meds/:id', user.ensureAuth, med.updateMed);
app.delete('/meds/:id', user.ensureAuth, med.deleteMed);

if (config.transportSecurity) {
    // key: nodecellar
    var options = {
        key: fs.readFileSync('config/ssl/key.pem'),
        cert: fs.readFileSync('config/ssl/cert.pem')
    };
    https.createServer(options, app).listen(443);
}

if (!config.transportSecurity) {
    http.createServer(app).listen(
        app.get('port'),
        function() {
            console.log("Express server listening on port " + app.get('port'));
        });
}
