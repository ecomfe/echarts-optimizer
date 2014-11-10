

var esprima = require('esprima');
var estraverse = require('estraverse');
var SYNTAX = estraverse.Syntax;

var analysedModules = {};

function analyse(moduleId, deep, visited) {
    visited = visited || {};

    if (visited[moduleId]) {
        return false;
    }

    var source = require('./read-module-file')(moduleId);
    if (!source) {
        return false;
    }

    var moduleInfo = analysedModules[moduleId];
    if (!moduleInfo) {
        var packageInfo = amd.getPackageInfo(moduleId);
        if (packageInfo && packageInfo.name === moduleId) {
            var realdep = moduleId + '/' + packageInfo.main;
            var realDepsIndex = {};
            realDepsIndex[realdep] = 1;
            moduleInfo = {
                id: moduleId,
                dependencies: [realdep],
                literalDependencies: [realdep],
                dependenciesIndex: realDepsIndex,
                builtCode: ''
            };

            analysedModules[moduleId] = moduleInfo;
        }
        else {
            var ast = esprima.parse(source,{
                // raw: true,
                // tokens: true,
                // range: true,
                // comment: true
            });

            estraverse.traverse(ast, {
                enter: function (node) {
                    if (node.type == SYNTAX.CallExpression
                        && node.callee.name == 'define'
                    ) {
                        this.skip();
                        moduleInfo = analyseDefineNode(node, moduleId);
                        analysedModules[moduleId] = moduleInfo;
                    }
                }
            });

            moduleInfo.ast = ast;
            genBuiltCode(moduleInfo);
        }
    }

    var result = moduleInfo.dependencies.slice(0);

    if (deep) {
        var depDeps = [];
        result.forEach(function (dep) {
            var currentDepDeps = analyse(dep, 1, visited);
            if (currentDepDeps !== false) {
                depDeps.push.apply(depDeps, currentDepDeps);
            }
        });

        var depDepsMap = {};
        depDeps.forEach(function (depDep){
            if (moduleInfo.dependenciesIndex[depDep]) {
                depDepsMap[depDep] = 1;
            }
            else if (!depDepsMap[depDep]) {
                result.push(depDep);
                depDepsMap[depDep] = 1;
            }
        });
    }

    return result;
}

var amd = require('./amd');

/**
 * define分析
 *
 * @inner
 * @param {Object} node define的语法树节点
 */
function analyseDefineNode(node, moduleId) {
    var args = node.arguments;
    var argsLen = args.length;
    var factory = args[ --argsLen ];
    var factoryArgLen = factory.type == SYNTAX.FunctionExpression
        ? factory.params.length
        : 0;

    var dependencies = ['require', 'exports', 'module'].slice(0, factoryArgLen);
    var id = moduleId;
    while ( argsLen-- ) {
        var arg = args[ argsLen ];
        if ( arg.type == SYNTAX.ArrayExpression ) {
            dependencies = ast2obj( arg );
        }
        else if ( arg.type == SYNTAX.Literal
            && typeof arg.value == 'string'
        ) {
            id = arg.value;
        }
    }

    if ( !id ) {
        return;
    }

    var functionLevel = -1;

    var literalDependenciesMap = {};
    function addLiteralDependency( depId ) {
        var depObj = literalDependenciesMap[ depId ];
        if ( !depObj ) {
            dependencies.push( depId );
            literalDependenciesMap[ depId ] = 1;
        }
    }
    dependencies.forEach(function ( dep ) {
        literalDependenciesMap[dep] = 1;
    });

    var realDependencies = [];
    var realDependenciesMap = {};
    function addRealDependency( depId ) {
        var depObj = realDependenciesMap[ depId ];
        if ( !depObj ) {
            realDependencies.push( depId );
            realDependenciesMap[ depId ] = 1;
        }
    }

    dependencies.forEach( function ( dep, index ) {
        var depId = amd.normalize( amd.parseId( dep ).module, id );
        addRealDependency(depId);
    } );

    if ( factory.type == SYNTAX.FunctionExpression ) {
        var requireFormalParameter;
        dependencies.forEach( function ( dep, index ) {
            if ( index >= factory.params.length ) {
                return false;
            }

            if ( dep === 'require' ) {
                requireFormalParameter = factory.params[ index ].name;
                return false;
            }
        });

        estraverse.traverse( factory, {
            enter: function ( node ) {
                var requireArg0;

                switch ( node.type ) {
                    case SYNTAX.FunctionExpression:
                    case SYNTAX.FunctionDeclaration:
                        functionLevel++;
                        break;
                    case SYNTAX.CallExpression:
                        if ( requireFormalParameter
                            && node.callee.name == requireFormalParameter
                            && (requireArg0 = node.arguments[0])
                            && requireArg0.type == SYNTAX.Literal
                            && typeof requireArg0.value == 'string'
                        ) {
                            var depId = amd.parseId(requireArg0.value).module;
                            addLiteralDependency(depId);
                            addRealDependency(amd.normalize(depId, id));
                        }
                        break;
                }
            },

            leave: function ( node ) {
                switch ( node.type ) {
                    case SYNTAX.FunctionExpression:
                    case SYNTAX.FunctionDeclaration:
                        functionLevel--;
                        break;
                }
            }
        } );
    }

    return {
        id: id,
        factoryAst: factory,
        literalDependencies: dependencies,
        dependencies: realDependencies,
        dependenciesIndex: realDependenciesMap
    };
}

function genBuiltCode(moduleInfo) {
    var ast = moduleInfo.ast;
    estraverse.replace( ast, {
        enter: function ( node ) {
            if ( node.type === SYNTAX.CallExpression
                && node.callee.name === 'define'
            ) {
                return generateModuleAst(moduleInfo);
            }
        }
    } );

    var escodegen = require('escodegen');
    moduleInfo.builtCode = escodegen.generate(
        ast,
        {
            format: {escapeless: true},
            comment: true
        }
    );

    var moduleId = moduleInfo.id;
    var packageInfo = amd.getPackageInfo(moduleId);
    if (moduleId === packageInfo.name + '/' + packageInfo.main) {
        moduleInfo.builtCode = 'define(\'' + packageInfo.name
            + '\', [\'' + moduleId
            + '\'], function (main) {return main;});\n'
            + moduleInfo.builtCode;
    }

}

function generateModuleAst( moduleInfo ) {
    var dependenciesExpr;
    var dependencies = moduleInfo.literalDependencies;
    if ( dependencies instanceof Array ) {
        dependenciesExpr = {
            type: SYNTAX.ArrayExpression,
            elements: []
        };

        dependencies.forEach( function ( dependency ) {
            dependenciesExpr.elements.push( {
                type: SYNTAX.Literal,
                value: dependency,
                raw: '\'' + dependency + '\''
            });
        } );
    }

    var defineArgs = [ moduleInfo.factoryAst ];
    if ( dependenciesExpr ) {
        defineArgs.unshift( dependenciesExpr );
    }
    var id = moduleInfo.id;
    if ( id ) {
        defineArgs.unshift( {
            type: SYNTAX.Literal,
            value: moduleInfo.id,
            raw: '\'' + moduleInfo.id + '\''
        } );
    }

    return {
        type: SYNTAX.CallExpression,
        callee: {
            type: SYNTAX.Identifier,
            name: 'define'
        },
        'arguments': defineArgs
    };
}

/**
 * 根据抽象语法树获取对象的值，仅支持Array,Object,Literal(boolean,string,number)
 *
 * 由于chrome extension的沙箱限制，不能eval和new Function
 * 所以不能根据语法树生成source再eval，只好自己写了个这货
 *
 * @param {Object} ast 语法树节点
 * @return {*}
 */
function ast2obj( ast ) {

    /**
     * 解析对象
     *
     * @inner
     * @param {Object} node 语法树节点
     * @return {Object}
     */
    function parseObject( node ) {
        var value = {};
        node.properties.forEach( function ( prop ) {
            value[ prop.key.name || prop.key.value ] = parse( prop.value );
        });

        return value;
    }

    /**
     * 解析数组
     *
     * @inner
     * @param {Object} node 语法树节点
     * @return {Array}
     */
    function parseArray( node ) {
        var value = [];
        node.elements.forEach( function ( element ) {
            value.push( parse( element ) );
        });

        return value;
    }

    /**
     * 解析Literal
     *
     * @inner
     * @param {Object} node 语法树节点
     * @return {*}
     */
    function parseLiteral( node ) {
        return node.value;
    }

    /**
     * 解析节点
     *
     * @inner
     * @param {Object} node 语法树节点
     * @return {*}
     */
    function parse( node ) {
        switch (node.type) {
            case SYNTAX.ObjectExpression:
                return parseObject( node );
            case SYNTAX.Literal:
                return parseLiteral( node );
            case SYNTAX.ArrayExpression:
                return parseArray( node );
            default:
                throw new Error( '[RAWOBJECT_FAIL]' );
        }
    }

    return parse( ast );
}

exports = module.exports = analyse;


exports.getAnalysed = function (id) {
    if (!analysedModules[id]) {
        analyse(id, 1);
    }

    return analysedModules[id];
};
