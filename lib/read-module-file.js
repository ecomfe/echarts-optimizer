
function readModuleFile(moduleId) {
    var amd = require('./amd');
    var fileName = amd.toUrl(moduleId) + '.js';

    try {
        if (fileName) {
            return require('fs').readFileSync(fileName, 'UTF-8');
        }
    } 
    catch (ex) {}

    return '';
}

exports = module.exports = readModuleFile;
