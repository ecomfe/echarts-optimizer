
var fs = require('fs');
var path = require('path');
var conf = require('./conf');

function readResourceFile(fileName) {
    return fs.readFileSync(
        path.join(__dirname, 'resource', fileName),
        'UTF-8'
    );
}
var eslCode = readResourceFile('esl.js');
var wrapStart = readResourceFile('all-start.js');
var wrapNut = readResourceFile('all-nut.js');
var wrapEnd = readResourceFile('all-end.js');

var modules = conf.modules;

var HIGH_WEIGHT = 100;
var BUILTIN_MODULES = ['require', 'module', 'exports'];

var amd = require('./lib/amd');
amd.config(conf.amd);

var analyse = require('./lib/analyse');

var distDir = path.join(process.cwd(), 'dist');
exports.setDistDir = function (dir) {
    if (dir) {
        distDir = dir;
    }
};

function writeFile(file, content) {
    var filePath = path.join(distDir, file);
    require('mkdirp').sync(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'UTF-8');
}


exports.analyse = function () {
    var main = modules.main;

    // analyse dependencies
    main.dependencies = subtract(analyse(main.name, 1), BUILTIN_MODULES);
    writeFile('analyses/echarts.dependencies', main.dependencies.join('\n'));
    modules.parts.forEach(function (mod) {
        mod.dependencies = subtract(analyse(mod.name, 1), BUILTIN_MODULES);
        writeFile(
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

    // analyse expect dependencies for all modules
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
};


exports.packAsDemand = function () {
    var main = modules.main;

    // write built source
    writeCompiledCode(
        'echarts.source.js', main.name, main.expectDependencies,
        eslCode
    );
    modules.parts.forEach(function (mod) {
        writeCompiledCode(
            mod.name.slice(mod.name.indexOf('/') + 1) + '.source.js',
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
    console.log(mods)

    // write file by wrapped code
    var code = wrapStart + wrapNut + result + wrapEnd;
    writeFile(
        'echarts-all.source.js', code
    );
    writeFile(
        'echarts-all.js',
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

    writeFile(file, result);
    writeFile(file.replace('.source', ''), jsCompress(result));
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
