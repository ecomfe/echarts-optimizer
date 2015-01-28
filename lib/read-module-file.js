
var fs = require('fs');

function readModuleFile(moduleId) {
    var amd = require('./amd');
    var fileName = amd.toUrl(moduleId) + '.js';

    try {
        if (fileName) {
            if (fs.existsSync(fileName)) {
                return fs.readFileSync(fileName, 'UTF-8');
            }

            console.log(moduleId + ' module file not found: ' + fileName);
        }
        else {
            console.log('Cannot found url of module ' + moduleId);   
        }
    } 
    catch (ex) {
    }

    return '';
}

exports = module.exports = readModuleFile;
