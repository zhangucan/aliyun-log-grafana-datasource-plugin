"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GenericDatasource = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _sls = require("./sls.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GenericDatasource = exports.GenericDatasource = function () {
    function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
        _classCallCheck(this, GenericDatasource);

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.projectName = instanceSettings.jsonData.project;
        this.logstore = instanceSettings.jsonData.logstore;
        //this.endpoint = instanceSettings.jsonData.endpoint;
        this.user = instanceSettings.jsonData.user;
        this.password = instanceSettings.jsonData.password;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.headers = { 'Content-Type': 'application/json' };
        if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
        }
        this.defaultConfig = {

            //requires
            accessId: this.user, //accessId
            accessKey: this.password, //accessKey
            //endpoint: this.endpoint,            //sls service endpoint

            //optional
            timeout: 20000, //请求timeout时间, 默认: 20s


            signature_method: 'hmac-sha1', //签名计算方式，目前只支持'hmac-sha1', 默认: 'hmac-sha1'
            api_version: '0.6.0', //数据相关api version 默认 0.3.0

            logger: false //打印请求的详细信息, log4js 实例
        };
    }

    _createClass(GenericDatasource, [{
        key: "query",
        value: function query(options) {
            var _this = this;

            console.log("hello", options);
            var requests = [];
            var slsclient = new _sls.SLS(this.defaultConfig, this.backendSrv, this.url);
            var promise = Promise.resolve();
            (0, _lodash2.default)(options.targets).forEach(function (target) {
                if (target.hide) {
                    return;
                }
                var query = _this.templateSrv.replace(target.query, options.scopedVars, function (value, variable, formatValue) {
                    console.log(typeof value === "undefined" ? "undefined" : _typeof(value));
                    if (typeof value === 'string') {
                        return value;
                    }
                    if ((typeof value === "undefined" ? "undefined" : _typeof(value)) == "object" && (variable.multi || variable.includeAll)) {
                        var a = [];
                        value.forEach(function (v) {
                            if (variable.name == variable.label) a.push('"' + variable.name + '":"' + v + '"');else a.push('"' + v + '"');
                        });
                        return a.join(" OR ");
                    }
                    if (typeof value == "array" || _lodash2.default.isArray(value)) {
                        return value.join(' OR ');
                    }
                });
                var re = /\$([0-9]+)([dmhs])/g;
                var reArray = query.match(re);
                (0, _lodash2.default)(reArray).forEach(function (col) {
                    var old = col;
                    col = col.replace("$", '');
                    var sec = 1;
                    if (col.indexOf("s") != -1) sec = 1;else if (col.indexOf("m") != -1) sec = 60;else if (col.indexOf("h") != -1) sec = 3600;else if (col.indexOf("d") != -1) sec = 3600 * 24;
                    col = col.replace(/[smhd]/g, '');
                    var v = parseInt(col);
                    v = v * sec;
                    console.log(old, v, col, sec, query);
                    query = query.replace(old, v);
                });
                if (query.indexOf("#time_end") != -1) {
                    query = query.replace("#time_end", parseInt(options.range.to._d.getTime() / 1000));
                }
                if (query.indexOf("#time_begin") != -1) {
                    query = query.replace("#time_begin", parseInt(options.range.from._d.getTime() / 1000));
                }

                _this.doRequest({
                    url: "http://slstrack.cn-hangzhou.log.aliyuncs.com/logstores/grafana/track_ua.gif?APIVersion=0.6.0&&query=" + query + "&project=" + _this.projectName + "&logstore=" + _this.logstore,
                    method: 'GET'
                }).then(function (r) {
                    return r;
                });

                var request = slsclient.GetData(_this.projectName, _this.logstore, {
                    "topic": "",
                    "from": parseInt(options.range.from._d.getTime() / 1000),
                    "to": parseInt(options.range.to._d.getTime() / 1000),
                    "query": query,
                    "reverse": "false",
                    "lines": "1000",
                    "offset": "0"
                }).then(function (result) {
                    if (!result.data) {
                        return Promise.reject(new Error("this promise is rejected"));
                    }

                    result.time_col = target.xcol;
                    result.ycol = _lodash2.default.reduce(target.ycol.split(","), function (result, data) {
                        data = data.split(' ').join('');
                        if (data) {
                            result.push(data);
                        }
                        return result;
                    }, []);
                    if (result.ycol.length == 1 && result.ycol[0].lastIndexOf("#:#") != -1) {
                        //group by  this col
                        var gbColArr = result.ycol[0].split("#:#");

                        var gbRes = [];
                        var mySet = new Set();
                        var lastX = "";
                        (0, _lodash2.default)(result.data).forEach(function (data) {
                            var row = data;
                            if (lastX == row[result.time_col]) {
                                gbRes[gbRes.length - 1][data[gbColArr[0]]] = data[gbColArr[1]];
                            } else {
                                row[data[gbColArr[0]]] = data[gbColArr[1]];
                                gbRes.push(row);
                            }
                            lastX = row[result.time_col];
                            mySet.add(row[gbColArr[0]]);
                        });
                        result.data = gbRes;
                        result.ycol = Array.from(mySet);
                        console.log("rewrite data", result.ycol, result.data);
                    }
                    return result;
                }).then(function (result) {
                    console.log("test", result);
                    if (result.time_col == "map") {
                        return result.data;
                    }
                    var resResult = [];
                    (0, _lodash2.default)(result.ycol).forEach(function (col) {
                        var datapoints = [];
                        if (result.time_col != null && result.time_col != "" && result.time_col != "pie" && result.time_col != 'bar') {
                            _lodash2.default.sortBy(result.data, [result.time_col]).forEach(function (data) {
                                var _time = data[result.time_col];
                                var time = parseInt(_time) * 1000;
                                if (data.hasOwnProperty(col)) {
                                    var value = parseFloat(data[col]);
                                    if (isNaN(data[col])) value = data[col];
                                    datapoints.push([value, time]);
                                }
                            });
                        } else if (result.time_col != null && result.time_col == "single") {
                            var count = 0;
                            (0, _lodash2.default)(result.data).forEach(function (data) {
                                var value = parseFloat(data[col]);
                                datapoints.push([value, 1000 * (parseInt(data["__time__"]) - count)]);
                                count = count - 1;
                            });
                        } else {
                            var _count = 0;
                            (0, _lodash2.default)(result.data).forEach(function (data) {
                                var value = data[col];
                                datapoints.push([value, 1000 * (parseInt(data["__time__"]) - _count)]);
                                _count = _count - 1;
                            });
                        }
                        resResult.push({
                            "target": col,
                            "datapoints": datapoints
                        });
                    });
                    if (result.time_col == "pie" || result.time_col == 'bar') {
                        var newtarget = [];
                        var datapoints = [];
                        var pieRes = [];
                        for (var i = 0; i < resResult[0].datapoints.length; ++i) {
                            for (var j = 0; j < resResult[1].datapoints[i].length; ++j) {
                                resResult[1].datapoints[i][j] = parseFloat(resResult[1].datapoints[i][j]);
                            }

                            pieRes.push({
                                "target": resResult[0].datapoints[i][0],
                                "datapoints": [resResult[1].datapoints[i]]
                            });
                        }
                        return pieRes;
                    }
                    console.log(resResult);
                    return resResult;
                });
                requests.push(request);
            });

            return Promise.all(requests.map(function (p) {
                return p.catch(function (e) {
                    return e;
                });
            })).then(function (requests) {
                console.log("1:", requests, requests[0]);

                if (requests && requests[0] && requests[0].data && requests[0].data.errorCode && requests[0].data.errorMessage) {
                    return { "data": { status: "error", message: requests[0].data.errorMessage, title: "Error1", data: "" } };
                }
                var _t = _lodash2.default.reduce(requests, function (result, data) {
                    (0, _lodash2.default)(data).forEach(function (t) {
                        return result.push(t);
                    });
                    return result;
                }, []);
                console.log("1:", _t);
                return {
                    data: _t
                };
            }) // 1,Error: 2,3
            .catch(function (err) {
                if (err.data && err.data.message) {
                    return { status: "error", message: err.data.message, title: "Error" };
                } else {
                    return { status: "error", message: err.status, title: "Error" };
                }
            });
        }
    }, {
        key: "testDatasource",
        value: function testDatasource() {
            var slsclient = new _sls.SLS(this.defaultConfig, this.backendSrv, this.url);
            return slsclient.GetData(this.projectName, this.logstore, {
                "topic": "",
                "from": parseInt(new Date().getTime() / 1000 - 900),
                "to": parseInt(new Date().getTime() / 1000),
                "query": "",
                "reverse": "false",
                "line": "10",
                "offset": "0"
            }).then(function (result) {

                return { status: "success", message: "LogService Connection OK", title: "Success" };
            }, function (err) {
                console.log("testDataSource err", err);
                if (err.data && err.data.message) {
                    return { status: "error", message: err.data.message, title: "Error" };
                } else {
                    return { status: "error", message: err.status, title: "Error" };
                }
            });
        }
    }, {
        key: "annotationQuery",
        value: function annotationQuery(options) {
            var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
            var annotationQuery = {
                range: options.range,
                annotation: {
                    name: options.annotation.name,
                    datasource: options.annotation.datasource,
                    enable: options.annotation.enable,
                    iconColor: options.annotation.iconColor,
                    query: query
                },
                rangeRaw: options.rangeRaw
            };

            return this.doRequest({
                url: this.url + '/annotations',
                method: 'POST',
                data: annotationQuery
            }).then(function (result) {
                return result.data;
            });
        }
    }, {
        key: "metricFindQuery",
        value: function metricFindQuery(options) {
            console.log(options);
            var requests = [];
            var slsclient = new _sls.SLS(this.defaultConfig, this.backendSrv, this.url);
            var promise = Promise.resolve();
            var query = this.templateSrv.replace(options, {}, 'glob');

            var end = parseInt(new Date().getTime() / 1000);
            var request = slsclient.GetData(this.projectName, this.logstore, {
                "topic": "",
                "from": end - 86400,
                "to": end,
                "query": query,
                "reverse": "false",
                "lines": "1000",
                "offset": "0"
            }).then(this.mapToTextValue);
            return request;
            //result => {
            //                if (!(result.data)) {
            //                    return Promise.reject(new Error("this promise is rejected"));
            //                }
            //                var res = [];
            //                _(result.data).forEach(row => {
            //                    _.map(row, (k,v) => {
            //                        console.log(k,v);
            //                        if(v != "__time__" && v != "__source__")
            //                            res.push(k);
            //                    });
            //                });
            //                console.log(res);
            //                return res;
            //            }
        }
    }, {
        key: "mapToTextValue",
        value: function mapToTextValue(result) {
            return _lodash2.default.map(result.data, function (d, i) {
                var x = "";
                _lodash2.default.map(d, function (k, v) {
                    if (v != "__time__" && v != "__source__") x = k;
                });
                console.log(d, x, i);
                return { text: x, value: x };
            });
        }
    }, {
        key: "doRequest",
        value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;

            return this.backendSrv.datasourceRequest(options);
        }
    }, {
        key: "buildQueryParameters",
        value: function buildQueryParameters(options) {
            var _this2 = this;

            //remove placeholder targets
            options.targets = _lodash2.default.filter(options.targets, function (target) {
                return target.target !== 'select metric';
            });
            var targets = _lodash2.default.map(options.targets, function (target) {
                return {
                    target: _this2.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                    refId: target.refId,
                    hide: target.hide,
                    type: target.type || 'timeserie'
                };
            });

            options.targets = targets;

            return options;
        }
    }]);

    return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
