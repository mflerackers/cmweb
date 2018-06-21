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
        if (req.query.group4) {
            if (req.query.group2 == "" && req.query.group3 == "") {
                var map = function() {
                    for (var i in this.person) {
                        if (!this.person[i].emotion)
                            continue;
                        let emotion = this.person[i].emotion;
                        if (Array.isArray(emotion)) {
                            emotion.forEach(function(v){
                                emit(v, 1);
                            });
                        }
                        else {
                            emit(emotion, 1);
                        }
                    }
                    for (var j in this.scene) {
                        for (var k in this.scene[j].person) {
                            if (!this.scene[j].person[k].emotion)
                                continue;
                            let emotion = this.scene[j].person[k].emotion;
                            if (Array.isArray(emotion)) {
                                emotion.forEach(function(v){
                                    emit(v, 1);
                                });
                            }
                            else {
                                emit(emotion, 1);
                            }
                        }
                    }
                }
                
                var reduce = function(key, values) {
                    return Array.sum(values);
                }
                
                db.collection('cmdb').mapReduce(map, reduce, {out:{ inline: 1 }},
                    function (err, result) {
                        if (err) return console.log(err);
                    let projection = [];
                    projection = result.map(v => ({group4:v._id, count:v.value}));
                    projection.sort((v1,v2)=>v2.count-v1.count);
                    res.render('count.ejs', {cms: projection, query:req.query});
                });
            }
            else if (req.query.group2 == "" || req.query.group3 == "" || req.query.group2 == req.query.group3) {
                let groupName = req.query.group2 == req.query.group3 ? 
                    req.query.group2 : 
                    req.query.group2 + req.query.group3;
                var map = function() {
                    let forEach = function(v, f) {
                        if (Array.isArray(v))
                            v.forEach(v=>f(v));
                        else
                            f(v);
                    }
                    let groupMap = {};
                    for (var i in this.person) {
                        let group = this.person[i][groupName];
                        groupMap[this.person[i].name] = group;
                        if (!this.person[i].emotion)
                            continue;
                        let emotion = this.person[i].emotion;
                        forEach(emotion, function(emotion){
                            forEach(group, function(group){
                                emit({group:group, emotion:emotion}, 1);
                            });
                        });
                    }
                    for (var j in this.scene) {
                        for (var k in this.scene[j].person) {
                            if (!this.scene[j].person[k].emotion)
                                continue;
                            let group = groupMap[this.scene[j].person[k].name];
                            let emotion = this.scene[j].person[k].emotion;
                            forEach(emotion, function(emotion){
                                forEach(group, function(group){
                                    emit({group:group, emotion:emotion}, 1);
                                });
                            });
                        }
                    }
                }
                
                var reduce = function(key, values) {
                    return Array.sum(values);
                }
                
                db.collection('cmdb').mapReduce(map, reduce, {out:{inline: 1}, scope:{groupName:groupName}},
                    function (err, result) {
                        if (err) return console.log(err);
                    let projection = [];
                    projection = result.map(v => ({group4:v._id.emotion, group2:v._id.group, count:v.value}));
                    projection.sort((v1,v2)=>v2.count-v1.count);
                    res.render('count.ejs', {cms: projection, query:req.query});
                });
            }
            else {
                var map = function() {
                    let forEach = function(v, f) {
                        if (Array.isArray(v))
                            v.forEach(v=>f(v));
                        else
                            f(v);
                    }
                    let group2Map = {};
                    let group3Map = {};
                    for (var i in this.person) {
                        let group2 = this.person[i][group2Name];
                        let group3 = this.person[i][group3Name];
                        group2Map[this.person[i].name] = group2;
                        group3Map[this.person[i].name] = group3;
                        if (!this.person[i].emotion)
                            continue;
                        let emotion = this.person[i].emotion;
                        forEach(emotion, function(emotion){
                            forEach(group2, function(group2){
                                forEach(group3, function(group3){
                                    emit({group2:group2, group3:group3, emotion:emotion}, 1);
                                });
                            });
                        });
                    }
                    for (var j in this.scene) {
                        for (var k in this.scene[j].person) {
                            if (!this.scene[j].person[k].emotion)
                                continue;
                            let group2 = group2Map[this.scene[j].person[k].name];
                            let group3 = group3Map[this.scene[j].person[k].name];
                            let emotion = this.scene[j].person[k].emotion;
                            forEach(emotion, function(emotion){
                                forEach(group2, function(group2){
                                    forEach(group3, function(group3){
                                        emit({group2:group2, group3:group3, emotion:emotion}, 1);
                                    });
                                });
                            });
                        }
                    }
                }
                
                var reduce = function(key, values) {
                    return Array.sum(values);
                }
                
                db.collection('cmdb').mapReduce(map, reduce, {out:{inline: 1}, scope:{group2Name:req.query.group2,group3Name:req.query.group3}},
                    function (err, result) {
                        if (err) return console.log(err);
                    let projection = [];
                    projection = result.map(v => ({group4:v._id.emotion, group2:v._id.group2, group3:v._id.group3, count:v.value}));
                    projection.sort((v1,v2)=>v2.count-v1.count);
                    res.render('count.ejs', {cms: projection, query:req.query});
                });
            }
        }
        else if (req.query.group2 == "" || req.query.group3 == "" || req.query.group2 == req.query.group3) {
            let group = req.query.group2 == req.query.group3 ? 
                req.query.group2 :
                req.query.group2 + req.query.group3;
            db.collection('cmdb').aggregate([
                {$unwind:"$person"},
                {$project: {
                    _id:"$person.name", 
                    group:"$person."+group
                }},
                {$unwind:"$group"},
                {$sortByCount: "$group"},
                {$sort:{"count":-1}},
                {$project:{group:"$_id",count:1}}
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
                    group2:"$person."+req.query.group2,
                    group3:"$person."+req.query.group3
                }},
                {$unwind:"$group2"},
                {$unwind:"$group3"},
                {$sortByCount: {$mergeObjects:{group2:"$group2", group3:"$group3"}}},
                {$sort:{"_id.group2":1, "count":-1}},
                {$project:{group2:"$_id.group2",group:"$_id.group3",count:1}}
            ]).toArray((err, result) => {
                if (err) return console.log(err);
                res.render('count.ejs', {cms: result, query:req.query});
            });
        }
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