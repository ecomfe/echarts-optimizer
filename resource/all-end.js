
var zrender = require('zrender');
zrender.tool = {
    color : require('zrender/tool/color'),
    math : require('zrender/tool/math'),
    util : require('zrender/tool/util'),
    vector : require('zrender/tool/vector'),
    area : require('zrender/tool/area'),
    event : require('zrender/tool/event')
}

zrender.animation = {
    Animation : require('zrender/animation/Animation'),
    Cip : require('zrender/animation/Clip'),
    easing : require('zrender/animation/easing')
}
var echarts = require('echarts');
echarts.config = require('echarts/config');
echarts.util = {
    mapData : {
        params : require('echarts/util/mapData/params')
    }
}

require("echarts/chart/gauge");
require("echarts/chart/funnel");
require("echarts/chart/scatter");
require("echarts/chart/k");
require("echarts/chart/radar");
require("echarts/chart/chord");
require("echarts/chart/force");
require("echarts/chart/line");
require("echarts/chart/bar");
require("echarts/chart/pie");
require("echarts/chart/eventRiver");
require("echarts/chart/map");
require("echarts/chart/island");

_global['echarts'] = echarts;
_global['zrender'] = zrender;

})(window);
