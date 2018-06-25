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

function getTotal(result, statistics={}) {
    if (statistics.total)
        return;
    statistics.total = result.map(c => c.count).reduce((a,c) => a+c, 0);
}

function getAverage(result, statistics={}) {
    if (statistics.average)
        return;
    getTotal(result, statistics);
    statistics.average = statistics.total / result.length;
}

function getVariance(result, statistics={}) {
    if (statistics.variance)
        return;
    getAverage(result, statistics);
    let average = statistics.average;
    statistics.variance = result.map(c => (c.count-average)**2).reduce((a,c) => a+c, 0) / (result.length-1);
}

function getStdev(result, statistics={}) {
    if (statistics.stdev)
        return;
    getVariance(result, statistics);
    statistics.stdev = Math.sqrt(statistics.variance);
}

function getStatistics(result, query) {
    let statistics = {};
    if (query.total) {
        getTotal(result, statistics);
    }
    if (query.average) {
        getAverage(result, statistics);
    }
    if (query.variance) {
        getVariance(result, statistics);
    }
    if (query.stdev) {
        getStdev(result, statistics); 
    }
    return statistics;
}

app.get('/countv2', function(req, res) {
    let filters = req.query.filter ? req.query.filter.split(" ").filter(filter =>filter.indexOf(":") != -1) : [];
    let groups = req.query.group ? req.query.group.split(" ").filter(group => group.length > 0) : [];

    let fields = [...filters.map(f => f.split(":")[0]), ...groups];

    if (groups.length <= 0) {
        res.render('countv2.ejs', {cms: [], groups:[], statistics:{}});
        return;
    }

    const complexities = {
        "category": 1,
        "place" : 1,
        "product" : 1,
        "product company": 1,
        "gender": 2,
        "age": 2,
        "emotion" : 3
    };

    let complexity = groups.map(group => complexities[group]).reduce((a, c) => Math.max(c, a), 0);

    if (complexity == 1) {
        let projection = {};
        groups.forEach(group => projection[group] = "$"+group);
        let ops = [{$project:projection}];
        if (filters.length > 0) {
            let filter = filters.reduce((a,f) => {
                [name, value] = f.split(":");
                a[name] = value;
                return a;
            }, {});
            ops.unshift({$match:filter});
            fields.forEach(f => ops.unshift({$unwind:"$"+f}));
        }
        else
            groups.forEach(group => ops.push({$unwind:"$"+group}));
        ops.push({$sortByCount:{$mergeObjects:projection}});
        db.collection('cmdb').aggregate(ops).toArray((err, result) => {
            if (err) return console.log(err);
            let statistics = getStatistics(result, req.query); // TODO: statistics contain unwanted data
            if (req.query.display == "percentage") {
                let total = result.map(c => c.count).reduce((a,c) => a+c)
                result.forEach(v => v.count = v.count * 100 / total);
            }
            res.render('countv2.ejs', {cms: result, groups:groups, statistics:statistics});
        });
    }
    else if (complexity == 2) {
        let projection = {};
        fields.forEach(field => {
            if (complexities[field] == 1)
                projection[field] = "$"+field;
            else
                projection[field] = "$person."+field;
        });
        let ops = [{$unwind:"$person"}]
        ops.push({$project:projection});
        fields.forEach(field => ops.push({$unwind:"$"+field}));
        if (filters.length > 0) {
            let filter = filters.reduce((a,f) => {
                [name, value] = f.split(":");
                a[name] = value;
                return a;
            }, {});
            ops.push({$match:filter});
        }
        let sortGroup = {};
        groups.forEach(group => sortGroup[group] = "$"+group);
        ops.push({$sortByCount:{$mergeObjects:sortGroup}});
        db.collection('cmdb').aggregate(ops).toArray((err, result) => {
            if (err) return console.log(err);
            let statistics = getStatistics(result, req.query);
            if (req.query.display == "percentage") {
                let total = result.map(c => c.count).reduce((a,c) => a+c, 0)
                result.forEach(v => v.count = v.count * 100 / total);
            }
            res.render('countv2.ejs', {cms: result, groups:groups, statistics:statistics});
        });
    }
    else if (complexity == 3) {
        var map = function() {
            let forEach = function(v, f) {
                if (Array.isArray(v))
                    v.forEach(v=>f(v));
                else if(v)
                    f(v);
            }
            let concat = function(to, from) {
                if (Array.isArray(from))
                    return to.concat(from);
                else if (from)
                    return to.concat([from]);
                else
                    return to;
            }
            let merge = function(to, from, fields) {
                fields.forEach(f => {
                    to[f] = concat(from[f], to[f]);
                });
            }

            let row = {};

            fields.forEach(f => {
                if (complexities[f] == 1)
                    row[f] = this[f];
            });

            let people = {};

            for (var i in this.person) {
                let person = this.person[i];
                let personRow = Object.assign(row, {});
                merge(personRow, person, fields);
                people[person.name] = personRow;
            }
            for (var j in this.scene) {
                for (var k in this.scene[j].person) {
                    if (!this.scene[j].person[k].emotion)
                        continue;
                    forEach(this.scene[j].person[k].emotion, function(v) {
                        emit(v, 1);
                    });
                }
            }
        }
        
        var reduce = function(key, values) {
            return Array.sum(values);
        }
        
        db.collection('cmdb').mapReduce(map, reduce, 
            {
                out:{ inline: 1 }, 
                scope:{
                    filters:filters, 
                    groups:groups, 
                    fields:fields,
                    complexities:complexities
                }
            },
            function (err, result) {
                if (err) return console.log(err);
            let projection = [];
            projection = result.map(v => ({_id:{emotion:v._id}, count:v.value}));
            projection.sort((v1,v2)=>v2.count-v1.count);
            let statistics = getStatistics(projection, req.query);
            if (req.query.display == "percentage") {
                let total = result.map(c => c.count).reduce((a,c) => a+c, 0)
                projection.forEach(v => v.count = v.count * 100 / total);
            }
            res.render('countv2.ejs', {
                cms: projection, 
                groups:groups, 
                statistics:statistics
            });
        });
    }
    else
        res.render('countv2.ejs', {cms: [], groups:[], statistics:{}});
});

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