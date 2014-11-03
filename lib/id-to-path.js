
function idToPath(moduleId, moduleConfig) {
    var baseUrl = moduleConfig.baseUrl || process.cwd();
    var packages = moduleConfig.packages || [];
    var idTerms = moduleId.split('/');
    var path = require('path');

    var len = packages.length;
    while (len--) {
        var packageInfo = packages[len];
        if (packageInfo.name === idTerms[0]) {
            if (idTerms.length === 1) {
                idTerms.push(packageInfo.main);
            }
            
            idTerms.splice(0, 1);
            return path.join(packageInfo.location, idTerms.join('/')) + '.js';
        }
    }

    return path.join(baseUrl, idTerms.join('/')) + '.js';
}

exports = module.exports = idToPath;
