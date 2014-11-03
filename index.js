
var path = require('path');

var modules = {
    main: {name: 'echarts/echarts'},
    parts: [
        {name: 'echarts/chart/line', weight: 100},
        {name: 'echarts/chart/bar', weight: 100},
        {name: 'echarts/chart/scatter', weight: 90},
        {name: 'echarts/chart/k', weight: 30},
        {name: 'echarts/chart/pie', weight: 90},
        {name: 'echarts/chart/radar', weight: 30},
        {name: 'echarts/chart/chord', weight: 30},
        {name: 'echarts/chart/force', weight: 30},
        {
            name: 'echarts/chart/map',
            weight: 90,
            includeShallow: [
                'echarts/util/mapData/geoJson/an_hui_geo',
                'echarts/util/mapData/geoJson/ao_men_geo',
                'echarts/util/mapData/geoJson/bei_jing_geo',
                'echarts/util/mapData/geoJson/china_geo',
                'echarts/util/mapData/geoJson/chong_qing_geo',
                'echarts/util/mapData/geoJson/fu_jian_geo',
                'echarts/util/mapData/geoJson/gan_su_geo',
                'echarts/util/mapData/geoJson/guang_dong_geo',
                'echarts/util/mapData/geoJson/guang_xi_geo',
                'echarts/util/mapData/geoJson/gui_zhou_geo',
                'echarts/util/mapData/geoJson/hai_nan_geo',
                'echarts/util/mapData/geoJson/hei_long_jiang_geo',
                'echarts/util/mapData/geoJson/he_bei_geo',
                'echarts/util/mapData/geoJson/he_nan_geo',
                'echarts/util/mapData/geoJson/hu_bei_geo',
                'echarts/util/mapData/geoJson/hu_nan_geo',
                'echarts/util/mapData/geoJson/jiang_su_geo',
                'echarts/util/mapData/geoJson/jiang_xi_geo',
                'echarts/util/mapData/geoJson/ji_lin_geo',
                'echarts/util/mapData/geoJson/liao_ning_geo',
                'echarts/util/mapData/geoJson/nei_meng_gu_geo',
                'echarts/util/mapData/geoJson/ning_xia_geo',
                'echarts/util/mapData/geoJson/qing_hai_geo',
                'echarts/util/mapData/geoJson/shang_hai_geo',
                'echarts/util/mapData/geoJson/shan_dong_geo',
                'echarts/util/mapData/geoJson/shan_xi_1_geo',
                'echarts/util/mapData/geoJson/shan_xi_2_geo',
                'echarts/util/mapData/geoJson/si_chuan_geo',
                'echarts/util/mapData/geoJson/tai_wan_geo',
                'echarts/util/mapData/geoJson/tian_jin_geo',
                'echarts/util/mapData/geoJson/world_geo',
                'echarts/util/mapData/geoJson/xiang_gang_geo',
                'echarts/util/mapData/geoJson/xin_jiang_geo',
                'echarts/util/mapData/geoJson/xi_zang_geo',
                'echarts/util/mapData/geoJson/yun_nan_geo',
                'echarts/util/mapData/geoJson/zhe_jiang_geo'
            ]
        },
        {name: 'echarts/chart/gauge', weight: 30},
        {name: 'echarts/chart/funnel', weight: 30},
        {name: 'echarts/chart/eventRiver', weight: 10}
    ]
};

var HIGH_WEIGHT = 100;

var BUILTIN_MODULES = {require: 1, module: 1, exports: 1};

var packages = [
    {
        name: 'echarts',
        location: path.resolve(__dirname, '../echarts/src'),
        main: 'echarts'
    },
    {
        name: 'zrender',
        location: path.resolve(__dirname, '../zrender/src'),
        main: 'zrender'
    }
];

var amd = require('./lib/amd');
amd.config({
    baseUrl: process.cwd(),
    packages: packages
});
var analyse = require('./lib/analyse');

var outputDir = process.argv[2] || 'dist';
var fs = require('fs');
function writeFile(file, content) {
    if (outputDir) {
        var filePath = path.join(outputDir, file);
        require('mkdirp').sync(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'UTF-8');
    }
}

var main = modules.main;
main.dependencies = analyse(main.name, 1);
writeFile('analyses/echarts.dependencies', main.dependencies.join('\n'));
modules.parts.forEach(function (mod) {
    mod.dependencies = analyse(mod.name, 1);
    writeFile(
        'analyses/' + mod.name.split('/').join('.') + '.dependencies',
        mod.dependencies.join('\n')
    );
});

var extraMainDependencies;
modules.parts.forEach(function (mod) {
    if (mod.weight >= HIGH_WEIGHT) {
        if (!extraMainDependencies) {
            extraMainDependencies = mod.dependencies;
        }
        else {
            extraMainDependencies = intersect(extraMainDependencies, mod.dependencies);
        }
    }
});


main.expectDependencies = union(main.dependencies, extraMainDependencies);
writeFile('analyses/echarts.dependencies.expect', main.expectDependencies.join('\n'));
modules.parts.forEach(function (mod) {
    mod.expectDependencies = subtract(mod.dependencies, main.expectDependencies);

    if (mod.includeShallow) {
        Array.prototype.push.apply(mod.expectDependencies, mod.includeShallow);
    }
    writeFile(
        'analyses/' + mod.name.split('/').join('.') + '.dependencies.expect',
        mod.expectDependencies.join('\n')
    );
});

writeCompiledCode(
    'echarts.js', main.name, main.expectDependencies,
    fs.readFileSync(path.join(__dirname, 'asset/esl.js'), 'UTF-8')
);
modules.parts.forEach(function (mod) {
    writeCompiledCode(
        mod.name.slice(mod.name.indexOf('/') + 1) + '.js',
        mod.name,
        mod.expectDependencies
    );
});

function writeCompiledCode(file, moduleId, expectDependencies, beforeContent) {
    var result = beforeContent || '';
    result += analyse.getAnalysed(moduleId).bulitCode;

    expectDependencies.forEach(function (dep) {
        if (BUILTIN_MODULES[dep]) {
            return;
        }

        var depInfo = analyse.getAnalysed(dep);
        if (depInfo) {
            result += depInfo.bulitCode;
        }
    });

    writeFile(file, result);
}

/**
 * 并集
 *
 * @return {Array}
 */
function union(a, b) {
    var exists = {};
    var result = [];

    a.forEach(function (item) {
        if (!exists[item]) {
            exists[item] = 1;
            result.push(item);
        }
    });

    b.forEach(function (item) {
        if (!exists[item]) {
            exists[item] = 1;
            result.push(item);
        }
    });

    return result;
}

/**
 * 交集
 *
 * @return {Array}
 */
function intersect(a, b) {
    var index = {};
    var result = [];
    var exists = {};

    a.forEach(function (item) {
        index[item] = 1;
    });

    b.forEach(function (item) {
        if (index[item] && !exists[item]) {
            result.push(item);
            exists[item] = 1;
        }
    });

    return result;
}

/**
 * 差集
 *
 * @return {Array}
 */
function subtract(a, b) {
    var index = {};
    b.forEach(function (item) {
        index[item] = 1;
    });

    var result = [];
    var exists = {};
    a.forEach(function (item) {
        if (!index[item] && !exists[item]) {
            result.push(item);
            exists[item] = 1;
        }
    });

    return result;
}
