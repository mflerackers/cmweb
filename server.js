const express = require('express');
const bodyParser= require('body-parser')
const mongodb = require('mongodb');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

var db

mongodb.connect('mongodb://localhost:27017', (err, client) => {
  if (err) return console.log(err)
  db = client.db('cmdb') // whatever your database name is
  app.listen(3000, () => {
    console.log('listening on 3000')
  })
})

app.get('/', function(req, res) {
    db.collection('cmdb').find().toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {cms: result, query:{year:"", year_to:""}});
    });
})

app.get('/cm/:name', function(req, res) {
    db.collection('cmdb').findOne({name: req.params.name}, (err, result) => {
        if (err) return console.log(err);
        res.send(result);
    });
})

app.get('/count', function(req, res) {
    db.collection('cmdb').aggregate([{$unwind:"$"+req.query.group},{$sortByCount:"$"+req.query.group}]).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('count.ejs', {cms: result, query:req.query});
    });
})

app.post('/', (req, res) => {
    console.log(req.body);
    let query = {};
    if (req.body.year) {
        if (req.body.year_to)
            query.year = {$gte: Number(req.body.year), $lte: Number(req.body.year_to)};
        else
            query.year = Number(req.body.year);
    }
    console.log(query);
    db.collection('cmdb').find(query).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {cms: result, query:req.body});
    });
  })