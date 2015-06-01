/**
 * @file 简易自定义宏处理
 * @author hushicai(bluthcy@gmail.com)
 */


var Syntax = require('estraverse').Syntax;

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
var MACRO_MODULE_ID = 'echarts/macro';

/**
 * 设置环境
 *
 * @public
 * @param {Object} env 环境配置
 */
function setMacroEnv(env) {
    var amd = require('./amd');
    if (env) {
        // 如果macro module不存在的话，捕获异常
        try {
            var macroModule = require(amd.toUrl(MACRO_MODULE_ID));
            macroModule.setEnv(env);
            registry = macroModule.registry;
        }
        catch (ex) {}
    }
}

/**
 * 构建宏调用逆波兰式
 *
 * @inner
 * @param {Object} node 语法树节点
 * @param {Array} result 结果数组
 */
function findMacroInCondition(node, result) {
    if (node.type === Syntax.LogicalExpression) {
        findMacroInCondition(node.left, result);
        findMacroInCondition(node.right, result);
        result.push(node.operator);
    }
    else if (node.type === Syntax.UnaryExpression) {
        // 一元运算
        findMacroInCondition(node.argument, result);
        result.push(node.operator);
    }
    else if (node.type === Syntax.CallExpression) {
        // 宏调用
        var name = node.callee.name;
        var entry = registry[name];
        if (entry) {
            var args = node.arguments;
            args = args.map(function (item) {
                return item.value;
            });
            result.push(entry.apply(null, args));
        }
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
 * 判断是否是宏调用表达式
 *
 * @public
 * @param {Object} node 抽象语法树节点
 * @return {boolean}
 */
function isMacroIfStatement(node) {
    if (node.type === Syntax.IfStatement) {
        var hasMacro;
        var testNode = node.test;
        // if (EC_DEFINED('mobile')) {// ...}
        if (testNode.type === Syntax.CallExpression) {
            hasMacro = (testNode.callee.name in registry);
        }
        // if (EC_DEFINED('ios') && EC_DEFINED('mobile')) {// ...}
        else if (testNode.type === Syntax.LogicalExpression && testNode.right.type === Syntax.CallExpression) {
            hasMacro = (testNode.right.callee.name in registry);
        }
        return hasMacro;
    }
    return false;
}

/**
 * 根据宏调用表达式计算结果替换节点
 *
 * @public
 * @param {Object} node 抽象语法树节点
 * @return {Object}
 */
function replaceMacroIfStatement(node) {
    var result = [];
    findMacroInCondition(node.test, result);
    result = evaluate(result);
    var newNode;
    if (result) {
        newNode = node.consequent;
    }
    else {
        newNode = node.alternate;
    }

    return newNode;
}

exports.isMacroIfStatement = isMacroIfStatement;
exports.replaceMacroIfStatement = replaceMacroIfStatement;
exports.setMacroEnv = setMacroEnv;
