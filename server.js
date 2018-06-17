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
    if (req.query.group) {
        if (req.query.group2 == "" && req.query.group3 == "") {
            db.collection('cmdb').aggregate([
                {$project:{_id:1,group:"$"+req.query.group}},
                {$unwind:"$group"},
                {$sortByCount:"$group"},
                {$project:{group:"$_id", count:1}}
            ]).toArray((err, result) => {
                if (err) return console.log(err);
                res.render('count.ejs', {cms: result, query:req.query});
            });
        }
        else if (req.query.group2 == "" || req.query.group3 == "") {
            let group2 = req.query.group2 + req.query.group3;
            db.collection('cmdb').aggregate([
                {$project:{_id:1,group2:"$person."+group2,group:"$"+req.query.group}},
                {$unwind:"$group2"},
                {$unwind:"$group2"},
                {$unwind:"$group"},
                {$sortByCount:{$mergeObjects:{"group2":"$group2","group":"$group"}}},
                {$sort:{"_id.group2":1, count:-1}},
                {$project:{group2:"$_id.group2",group:"$_id.group",count:1}}
            ]).toArray((err, result) => {
                if (err) return console.log(err);
                res.render('count.ejs', {cms: result, query:req.query});
            });
        }
        else {
            db.collection('cmdb').aggregate([
                {$unwind:"$person"},
                {$project: {
                    _id:"$person.name",
                    group:"$"+req.query.group,
                    group2:"$person."+req.query.group2,
                    group3:"$person."+req.query.group3
                }},
                {$unwind:"$group"},
                {$unwind:"$group2"},
                {$unwind:"$group3"},
                {$sortByCount: {
                    $mergeObjects:{
                        group:"$group",
                        group2:"$group2",
                        group3:"$group3"
                }}},
                {$sort:{"_id.group2":1, "count":-1}},
                {$project:{group:"$_id.group",group2:"$_id.group2",group3:"$_id.group3",count:1}}
            ]).toArray((err, result) => {
                if (err) return console.log(err);
                res.render('count.ejs', {cms: result, query:req.query});
            });
        }
    }
    else {
        db.collection('cmdb').aggregate([
            {$unwind:"$person"},
            {$project: {
                _id:"$person.name", 
                gender:"$person.gender",
                age:"$person.age"
            }},
            {$unwind:"$gender"},
            {$unwind:"$age"},
            {$sortByCount: {$mergeObjects:{gender:"$gender", age:"$age"}}},
            {$sort:{"_id.gender":1, "count":-1}},
            {$project:{group2:"$_id.gender",group:"$_id.age",count:1}}
        ]).toArray((err, result) => {
            if (err) return console.log(err);
            res.render('count.ejs', {cms: result, query:req.query});
        });
    }
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