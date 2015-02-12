
var fs = require('fs');

function readResourceFile(resourceId) {
    var amd = require('./amd');
    var fileName = amd.toUrl(resourceId);

    try {
        if (fileName) {
            if (fs.existsSync(fileName)) {
                return fs.readFileSync(fileName, 'UTF-8');
            }

            console.log(resourceId + ' resource file not found: ' + fileName);
        }
        else {
            console.log('Cannot found url of resource ' + resourceId);   
        }
    } 
    catch (ex) {
    }

    return '';
}

exports = module.exports = readResourceFile;
