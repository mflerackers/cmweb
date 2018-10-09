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
            let labels = [];
            let categories = [];
            result.some(r => {
                label = r._id[groups[0]];
                if (labels.findIndex(l => l == label) == -1)
                    labels.push(label);
                return labels.length >= 10;
            });
            result.forEach(r => {
                label = r._id[groups[1]];
                if (categories.findIndex(l => l == label) == -1)
                    categories.push(label);
            });
            let datasets = categories.map(_ => [...labels.map(_ => 0)]);
            let group0, group1, index0, index1;
            result.forEach(r => {
                group0 = r._id[groups[0]];
                group1 = r._id[groups[1]];
                index0 = labels.findIndex(l => l == group0);
                index1 = categories.findIndex(l => l == group1);
                if (index0 > -1 && index1 > -1) {
                    datasets[index1][index0] = r.count;
                }
            });
            console.log(datasets)
            res.render('countv2.ejs', {
                cms: result,
                groups:groups,
                statistics:statistics,
                labels:labels,
                datasets:datasets.slice(0, 4),
                categories:categories.slice(0, 4),
                title:"Commercials"
            });
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
            let labels = [];
            let categories = [];
            result.some(r => {
                label = r._id[groups[0]];
                if (labels.findIndex(l => l == label) == -1)
                    labels.push(label);
                return labels.length >= 10;
            });
            result.forEach(r => {
                label = r._id[groups[1]];
                if (categories.findIndex(l => l == label) == -1)
                    categories.push(label);
            });
            let datasets = categories.map(_ => [...labels.map(_ => 0)]);
            let group0, group1, index0, index1;
            result.forEach(r => {
                group0 = r._id[groups[0]];
                group1 = r._id[groups[1]];
                index0 = labels.findIndex(l => l == group0);
                index1 = categories.findIndex(l => l == group1);
                if (index0 > -1 && index1 > -1) {
                    datasets[index1][index0] = r.count;
                }
            });
            console.log(datasets)
            res.render('countv2.ejs', {
                cms: result, 
                groups:groups, 
                statistics:statistics,
                labels:labels,
                datasets:datasets.slice(0, 4),
                categories:categories.slice(0, 4),
                title:"People"
            });
        });
    }
    else if (complexity == 3) {
        var map = function() {

            const forEach = function(v, f) {
                if (Array.isArray(v))
                    v.forEach(v=>f(v));
                else if(v)
                    f(v);
            }

            const clone = function(object) {
                let clone = {};
                Object.keys(object).forEach(k => {
                    clone[k] = object[k];
                });
                return clone;
            }

            const unwind = function(objects, field) {
                let array = [];
                objects.forEach(o => {
                    forEach(o[field], value => {
                        let no = clone(o);
                        no[field] = value;
                        array.push(no);
                    });
                });
                return array;
            }

            const isArray = function(v) {
                return Object.prototype.toString.call(v) === '[object Array]';
            }
            
            const concat = function(v1, v2) {
                if (isArray(v1)) {
                    if (isArray(v2)) {
                        return [...v1, ...v2];
                    }
                    else {
                        return [...v1, v2]; 
                    }
                }
                else if (isArray(v2)) {
                    return [v1, ...v2]; 
                }
                else {
                    return [v1, v2]; 
                }
            }
            
            const merge = function(obj1, obj2, fields) {
                let merged = {};
                fields.forEach(k => {
                    if (obj1[k]) {
                        if (obj2[k]) {
                            merged[k] = concat(obj1[k], obj2[k]);
                        }
                        else {
                            merged[k] = obj1[k];
                        }
                    }
                    else if (obj2[k]) {
                        merged[k] = obj2[k];
                    }
                });
                return merged;
            }

            let row = {};

            fields.forEach(f => {
                if (complexities[f] == 1)
                    row[f] = this[f];
            });

            let people = {};

            for (var i in this.person) {
                let person = this.person[i];
                let personRow = merge(row, person, fields);
                people[person.name] = personRow;
            }
            for (var j in this.scene) {
                for (var k in this.scene[j].person) {
                    let personRow = people[this.scene[j].person[k].name];
                    if (personRow) {
                        people[this.scene[j].person[k].name] = merge(personRow, this.scene[j].person[k], fields);
                    }
                    else {
                        people[this.scene[j].person[k].name] = merge(this.scene[j].person[k], {}, fields);
                    }
                }
            }

            for (var p in people) {
                p = people[p];
                if (!fields.every(k => p[k] != undefined))
                    continue;
                let rows = [p];
                fields.forEach(field => rows = unwind(rows, field));
                rows.forEach(row => emit(row, 1));
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
            projection = result.map(v => ({_id:v._id, count:v.value}));
            projection.sort((v1,v2)=>v2.count-v1.count);
            console.log(projection);
            let statistics = getStatistics(projection, req.query);
            if (req.query.display == "percentage") {
                let total = result.map(c => c.count).reduce((a,c) => a+c, 0)
                projection.forEach(v => v.count = v.count * 100 / total);
            }
            res.render('countv2.ejs', {
                cms: projection, 
                groups:groups, 
                statistics:statistics,
                labels:[],
                datasets:[],
                categories:[],
                title:"People"
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