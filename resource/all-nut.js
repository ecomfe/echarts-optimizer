var require, define;
(function () {
    var mods = {};

    define = function (id, deps, factory) {
        mods[id] = {
            id: id,
            deps: deps,
            factory: factory,
            defined: 0,
            exports: {}
        };
    };

    require = createRequire();

    function normalize(id, baseId) {
        if (!baseId) {
            return id;
        }

        if (id.indexOf('.') === 0) {
            var basePath = baseId.split('/');
            var namePath = id.split('/');
            var baseLen = basePath.length - 1;
            var nameLen = namePath.length;
            var cutBaseTerms = 0;
            var cutNameTerms = 0;

            pathLoop: for (var i = 0; i < nameLen; i++) {
                switch (namePath[i]) {
                    case '..':
                        if (cutBaseTerms < baseLen) {
                            cutBaseTerms++;
                            cutNameTerms++;
                        }
                        else {
                            break pathLoop;
                        }
                        break;
                    case '.':
                        cutNameTerms++;
                        break;
                    default:
                        break pathLoop;
                }
            }

            basePath.length = baseLen - cutBaseTerms;
            namePath = namePath.slice(cutNameTerms);

            return basePath.concat(namePath).join('/');
        }

        return id;
    }

    function createRequire(baseId) {
        function localRequire(id) {
            id = normalize(id, baseId);
            var mod = mods[id];
            if (!mod) {
                throw new Error('No ' + id);
            }

            if (!mod.defined) {
                var factory = mod.factory;
                var deps = mod.deps;
                var args = [];
                for (var i = 0, l = Math.min(deps.length, factory.length); i < l; i++) {
                    var requireMod = deps[i];
                    var arg;
                    switch (requireMod) {
                        case 'require':
                            arg = createRequire(id);
                            break;
                        case 'exports':
                            arg = mod.exports;
                            break;
                        case 'module':
                            arg = mod;
                            break;
                        default:
                            arg = require(requireMod)
                    }
                    args.push(arg);
                }

                var factoryReturn = factory.apply(this, args);
                if (typeof factoryReturn !== 'undefined') {
                    mod.exports = factoryReturn;
                }
                mod.defined = 1;
            }

            return mod.exports;
        };

        return localRequire;
    }
}());
