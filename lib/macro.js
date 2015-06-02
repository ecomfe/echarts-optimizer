/**
 * @file 简易自定义宏处理
 * @author hushicai(bluthcy@gmail.com)
 */


var Syntax = require('estraverse').Syntax;
var amd = require('./amd');

/**
 * 宏函数注册表
 *
 * @type {Object}
 */
var registry = {};

/**
 * 宏定义的模块ID
 *
 * @type {string}
 */
var MACRO_MODULE_ID = 'zrender/macro';

// require('zrender/macro');
// require('./macro');
// require('../macro');
// ...
var MACRO_MODULE_ID_REGEXP = /\/macro$/;

/**
 * 设置环境
 *
 * @public
 * @param {Object} env 环境配置
 */
function setMacroEnv(env) {
    if (env) {
        // 如果macro module不存在的话，捕获异常
        try {
            var macroModule = require(amd.toUrl(MACRO_MODULE_ID));
            macroModule.setEnv(env);
            delete macroModule.setEnv;
            registry = macroModule;
        }
        catch (ex) {}
    }
}

/**
 * 计算逆波兰式
 *
 * @inner
 * @param {Array.<string|Object>} expr 逆波兰表达式数组
 * @return {boolean} 表达式是否为真
 */
function evaluate(expr) {
    var stack = [];
    // 二元运算
    var binaryExpression = {
        '&&': function (a, b) {
            return a && b;
        },
        '||': function (a, b) {
            return a || b;
        }
    };
    expr.forEach(function (v) {
        var a;
        var b;
        switch (v) {
            case '&&':
            case '||':
                a = stack.pop();
                b = stack.pop();
                stack.push(binaryExpression[v](a, b));
                break;
            case '!':
                a = stack.pop();
                stack.push(!a);
                break;
            default:
                stack.push(v);
        }
    });
    return stack[0];
}

/**
 * 构建宏调用逆波兰式
 *
 * @inner
 * @param {Object} node 语法树节点
 */
function findMacroInCondition(tree, macroVariableDeclaratorName) {
    var result = [];
    /**
     * 深度优先遍历
     *
     * @inner
     * @param {Object} node 语法树节点
     */
    function dfs(node) {
        if (node.type === Syntax.LogicalExpression) {
            dfs(node.left, result);
            dfs(node.right, result);
            result.push(node.operator);
        }
        else if (node.type === Syntax.UnaryExpression) {
            // 一元运算
            dfs(node.argument, result);
            result.push(node.operator);
        }
        else if (isMacroCallExpression(node, macroVariableDeclaratorName)) {
            // 宏调用
            var name = node.callee.property.name;
            var entry = registry[name];
            if (entry) {
                var args = node.arguments;
                args = args.map(function (item) {
                    return item.value;
                });
                result.push(entry.apply(null, args));
            }
        }
        else {
            // 如果有其他表达式，比如`a === b`等，则忽略该if表达式
            // 因为没办法获得a、b的值
            throw new SyntaxError('Not expected expression');
        }
    }

    try {
        dfs(tree);
    }
    catch (ex) {
        result = [];
    }

    return result;
}


/**
 * 判断是否是宏调用if表达式
 *
 * @public
 * @param {Object} node 抽象语法树节点
 * @param {string} macroVariableDeclaratorName 模块声明的变量名称
 * @return {boolean}
 */
function isMacroIfStatement(node, macroVariableDeclaratorName) {
    // 如果没找到模块声明，则返回false
    if (!macroVariableDeclaratorName) {
        return false;
    }

    if (node.type === Syntax.IfStatement) {
        var testNode = node.test;

        if (isMacroCallExpression(testNode, macroVariableDeclaratorName)
            || (
                testNode.type === Syntax.LogicalExpression
                && isMacroCallExpression(testNode.right, macroVariableDeclaratorName)
            )
        ) {
            return true;
        }
    }
    return false;
}

/**
 * 判断单个节点是否是宏调用表达式
 *
 * @inner
 * @param {Object} node 语法树节点
 * @param {string} macroVariableDeclaratorName 宏模块名称
 * @return {boolean}
 */
function isMacroCallExpression(node, macroVariableDeclaratorName) {
    if (node.type === Syntax.CallExpression
        && node.callee.type === Syntax.MemberExpression
    ) {
        return node.callee.object.name === macroVariableDeclaratorName
            && node.callee.property.name in registry;
    }
    return false;
}

/**
 * 是否是宏模块声明表达式
 *
 * @public
 * @param {Object} node 语法树节点
 * @param {string} baseModuleId 所在的模块id
 * @return {boolean}
 */
function isMacroVariableDeclarator(node, baseModuleId) {
    var moduleId;
    return node.type === Syntax.VariableDeclarator
        && node.init
        && node.init.type === Syntax.CallExpression
        && node.init.callee.name === 'require'
        && (moduleId = node.init.arguments[0].value)
        // 先匹配一下模块id是不是以macro结尾的
        && MACRO_MODULE_ID_REGEXP.test(moduleId)
        // 再看看模块id是不是等于`zrender/macro`
        && amd.normalize(moduleId, baseModuleId) === MACRO_MODULE_ID;
}

/**
 * 根据宏调用表达式计算结果替换节点
 *
 * @public
 * @param {Object} node 抽象语法树节点
 * @param {string} macroVariableDeclaratorName 宏模块名称
 * @return {Object}
 */
function replaceMacroIfStatement(node, macroVariableDeclaratorName) {
    var result = findMacroInCondition(node.test, macroVariableDeclaratorName);
    if (result.length === 0) {
        return null;
    }

    var ifStatementValue = evaluate(result);

    var newNode;
    if (ifStatementValue) {
        newNode = node.consequent;
    }
    else {
        newNode = node.alternate;
    }

    return newNode;
}

exports.isMacroIfStatement = isMacroIfStatement;
exports.isMacroVariableDeclarator = isMacroVariableDeclarator;
exports.replaceMacroIfStatement = replaceMacroIfStatement;
exports.setMacroEnv = setMacroEnv;
