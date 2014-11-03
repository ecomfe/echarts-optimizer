
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
        {name: 'echarts/chart/map', weight: 90},
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
