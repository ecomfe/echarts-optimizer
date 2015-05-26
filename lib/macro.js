/**
 * @file 简易自定义宏处理
 * @author hushicai(bluthcy@gmail.com)
 */


var esprima = require('esprima');
var escodegen = require('escodegen');
var estraverse = require('estraverse');
var Syntax = estraverse.Syntax;

function accessByDot(obj, key) {
    key = (key || '').split('.');
    while (obj && key.length) {
        obj = obj[key.shift()];
    }
    return obj;
}

var registry = {
    EC_DEFINED: function (key) {
        return !!accessByDot(config, key);
    },
    EC_NO_DEFINED: function (key) {
        return !accessByDot(config, key);
    },
    EC_EQUAL: function (key, value) {
        return accessByDot(config, key) === value;
    }
};

var config;

function setConfig(cfg) {
    config = cfg;
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
    } else if (node.type === Syntax.UnaryExpression) {
        // 一元运算
        findMacroInCondition(node.argument, result);
        result.push(node.operator);
    } else if (node.type === Syntax.CallExpression) {
        // 宏调用
        var name = node.callee.name;
        var entry = registry[name];
        if (entry) {
            var args = node.arguments;
            args = args.map(function(item) {
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
        '&&': function(a, b) {
            return a && b;
        },
        '||': function(a, b) {
            return a || b;
        }
    };
    expr.forEach(function(v) {
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
};

function replaceMacroIfStatement(node) {
    var result = [];
    findMacroInCondition(node.test, result);
    result = evaluate(result);
    var newNode;
    if (result) {
        newNode = node.consequent;
    } else {
        newNode = node.alternate;
    }

    return newNode;
}

exports.isMacroIfStatement = isMacroIfStatement;
exports.replaceMacroIfStatement = replaceMacroIfStatement;
exports.setConfig = setConfig;
