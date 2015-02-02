
var fs = require('fs');
var path = require('path');
var conf;
var modules;

function readResourceFile(fileName) {
    return fs.readFileSync(
        path.join(__dirname, 'resource', fileName),
        'UTF-8'
    );
}
var eslCode = readResourceFile('esl.js');
var wrapStart = readResourceFile('all-start.js');
var wrapNut = readResourceFile('all-nut.js');
var wrapEndTpl = readResourceFile('all-end.js');

var HIGH_WEIGHT = 100;
var BUILTIN_MODULES = ['require', 'module', 'exports'];

var amd = require('./lib/amd');
var analyse = require('./lib/analyse');
var etpl = require('./lib/etpl');
etpl.config({
    commandOpen: '/**',
    commandClose: '*/'
});

exports.setConf = function (customConf) {
    conf = customConf || require('./conf');
    modules = conf.modules;
    amd.config(conf.amd);
};

var distDir = path.join(process.cwd(), 'dist');
exports.setDistDir = function (dir) {
    if (dir) {
        distDir = dir;
    }
};

exports.getDistDir = function () {
    return distDir;
};

function writeFile(file, content) {
    var filePath = path.join(distDir, file);
    require('mkdirp').sync(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'UTF-8');
}


exports.analyse = function (debug) {
    var main = modules.main;

    // analyse dependencies
    main.dependencies = subtract(analyse(main.name, 1, {}, main.exclude), BUILTIN_MODULES);
    debug && writeFile('analyses/echarts.dependencies', main.dependencies.join('\n'));
    modules.parts.forEach(function (mod) {
        mod.dependencies = subtract(analyse(mod.name, 1, {}, mod.exclude), BUILTIN_MODULES);
        debug && writeFile(
            'analyses/' + mod.name.split('/').join('.') + '.dependencies',
            mod.dependencies.join('\n')
        );
    });

    // analyse extra dependencies of main module
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

    extraMainDependencies = extraMainDependencies || [];
    
    // analyse expect dependencies for all modules
    main.expectDependencies = union(main.dependencies, extraMainDependencies);
    debug && writeFile('analyses/echarts.dependencies.expect', main.expectDependencies.join('\n'));
    modules.parts.forEach(function (mod) {
        mod.expectDependencies = subtract(mod.dependencies, main.expectDependencies);

        if (mod.includeShallow) {
            Array.prototype.push.apply(mod.expectDependencies, mod.includeShallow);
        }
        debug && writeFile(
            'analyses/' + mod.name.split('/').join('.') + '.dependencies.expect',
            mod.expectDependencies.join('\n')
        );
    });
};


exports.packAsDemand = function () {
    var main = modules.main;

    var includeEsl = conf.includeEsl == null ? true : conf.includeEsl;
    // write built source
    writeCompiledCode(
        (conf.name || 'echarts') + '.js', main.name, main.expectDependencies,
        includeEsl ? eslCode : ''
    );
    modules.parts.forEach(function (mod) {
        writeCompiledCode(
            mod.name.slice(mod.name.indexOf('/') + 1) + '.js',
            mod.name,
            mod.expectDependencies
        );
    });
};

exports.packAsAll = function () {
    var main = modules.main;

    // calc modules list
    var mods = [main.name];
    mods = union(mods, main.expectDependencies);
    modules.parts.forEach(function (mod) {
        mods = union(mods, [mod.name]);
        mods = union(mods, mod.expectDependencies);
    });

    // combine built code
    var result = ''
    mods.forEach(function (mod) {
        result += analyse.getAnalysed(mod).builtCode;
    });

    // write file by wrapped code
    var hasMap = modules.parts.filter(function (mod) {
        return mod.name.indexOf('chart/map') >= 0;
    }).length > 0;
    var wrapEnd = etpl.compile(wrapEndTpl)({
        parts: modules.parts,
        hasMap: hasMap
    });
    var code = wrapStart + wrapNut + result + wrapEnd;
    var name = (conf.name || 'echarts') + '-all';
    writeFile(
        'source/' + name + '.js', code
    );
    writeFile(
        'dist/' + name + '.js',
        jsCompress(code)
    );
};

function jsCompress(source) {
    var UglifyJS = require('uglify-js');
    var ast = UglifyJS.parse(source);
    /* jshint camelcase: false */
    // compressor needs figure_out_scope too
    ast.figure_out_scope();
    ast = ast.transform(UglifyJS.Compressor( {} ));

    // need to figure out scope again so mangler works optimally
    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();

    return ast.print_to_string();
}

function writeCompiledCode(file, moduleId, expectDependencies, beforeContent) {
    var result = beforeContent || '';
    result += analyse.getAnalysed(moduleId).builtCode;

    expectDependencies.forEach(function (dep) {
        var depInfo = analyse.getAnalysed(dep);
        if (depInfo) {
            result += depInfo.builtCode;
        }
    });

    writeFile('source/' + file, result);
    writeFile('dist/' + file, jsCompress(result));
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
