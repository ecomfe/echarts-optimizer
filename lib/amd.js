
var requireConf;

/**
 * paths内部索引
 *
 * @inner
 * @type {Array}
 */
var pathsIndex;

/**
 * packages内部索引
 *
 * @inner
 * @type {Array}
 */
var packagesIndex;

/**
 * mapping内部索引
 *
 * @inner
 * @type {Array}
 */
var mappingIdIndex;

/**
 * 将key为module id prefix的Object，生成数组形式的索引，并按照长度和字面排序
 *
 * @inner
 * @param {Object} value 源值
 * @param {boolean} allowAsterisk 是否允许*号表示匹配所有
 * @return {Array}
 */
function createKVSortedIndex( value, allowAsterisk ) {
    var index = kv2List( value, 1, allowAsterisk );
    index.sort( descSorterByKOrName );
    return index;
}

/**
 * 创建配置信息内部索引
 *
 * @inner
 */
function createConfIndex() {
    requireConf.baseUrl = requireConf.baseUrl.replace( /\/$/, '' ) + '/';

    // create paths index
    pathsIndex = createKVSortedIndex( requireConf.paths );

    // create mappingId index
    mappingIdIndex = createKVSortedIndex( requireConf.map, 1 );
    each(
        mappingIdIndex,
        function ( item ) {
            item.v = createKVSortedIndex( item.v );
        }
    );

    // create packages index
    packagesIndex = [];
    each(
        requireConf.packages,
        function ( packageConf ) {
            var pkg = packageConf;
            if ( typeof packageConf === 'string' ) {
                pkg = {
                    name: packageConf.split('/')[ 0 ],
                    location: packageConf,
                    main: 'main'
                };
            }

            pkg.location = pkg.location || pkg.name;
            pkg.main = (pkg.main || 'main').replace(/\.js$/i, '');
            pkg.reg = createPrefixRegexp( pkg.name );
            packagesIndex.push( pkg );
        }
    );
    packagesIndex.sort( descSorterByKOrName );
}

/**
 * 对配置信息的索引进行检索
 *
 * @inner
 * @param {string} value 要检索的值
 * @param {Array} index 索引对象
 * @param {Function} hitBehavior 索引命中的行为函数
 */
function indexRetrieve( value, index, hitBehavior ) {
    each( index, function ( item ) {
        if ( item.reg.test( value ) ) {
            hitBehavior( item.v, item.k, item );
            return false;
        }
    } );
}

/**
 * 将对象数据转换成数组，数组每项是带有k和v的Object
 *
 * @inner
 * @param {Object} source 对象数据
 * @return {Array.<Object>}
 */
function kv2List( source, keyMatchable, allowAsterisk ) {
    var list = [];
    for ( var key in source ) {
        if ( source.hasOwnProperty( key ) ) {
            var item = {
                k: key,
                v: source[ key ]
            };
            list.push( item );

            if ( keyMatchable ) {
                item.reg = key === '*' && allowAsterisk
                    ? /^/
                    : createPrefixRegexp( key );
            }
        }
    }

    return list;
}

/**
 * 创建id前缀匹配的正则对象
 *
 * @inner
 * @param {string} prefix id前缀
 * @return {RegExp}
 */
function createPrefixRegexp( prefix ) {
    return new RegExp( '^' + prefix + '(/|$)' );
}

/**
 * 循环遍历数组集合
 *
 * @inner
 * @param {Array} source 数组源
 * @param {function(Array,Number):boolean} iterator 遍历函数
 */
function each( source, iterator ) {
    if ( source instanceof Array ) {
        for ( var i = 0, len = source.length; i < len; i++ ) {
            if ( iterator( source[ i ], i ) === false ) {
                break;
            }
        }
    }
}

/**
 * 根据元素的k或name项进行数组字符数逆序的排序函数
 *
 * @inner
 */
function descSorterByKOrName( a, b ) {
    var aValue = a.k || a.name;
    var bValue = b.k || b.name;

    if ( bValue === '*' ) {
        return -1;
    }

    if ( aValue === '*' ) {
        return 1;
    }

    return bValue.length - aValue.length;
}

/**
 * 将`模块标识+'.extension'`形式的字符串转换成相对的url
 *
 * @inner
 * @param {string} source 源字符串
 * @return {string}
 */
function toUrl( source ) {
    // 分离 模块标识 和 .extension
    var extReg = /(\.[a-z0-9]+)$/i;
    var queryReg = /(\?[^#]*)$/;
    var extname = '';
    var id = source;
    var query = '';

    if ( queryReg.test( source ) ) {
        query = RegExp.$1;
        source = source.replace( queryReg, '' );
    }

    if ( extReg.test( source ) ) {
        extname = RegExp.$1;
        id = source.replace( extReg, '' );
    }

    var url = id;

    // paths处理和匹配
    var isPathMap;
    indexRetrieve( id, pathsIndex, function ( value, key ) {
        url = url.replace( key, value );
        isPathMap = 1;
    } );

    var path = require('path');

    // packages处理和匹配
    if ( !isPathMap ) {
        indexRetrieve(
            id,
            packagesIndex,
            function ( value, key, item ) {
                url = path.join(item.location, url.replace( item.name, '' ));
            }
        );
    }

    // 相对路径时，附加baseUrl
    if ( !/^([a-z]{1,10}:\/)?\//i.test( url ) && !/^[a-z]:\\/i.test( url ) ) {
        url = path.join(requireConf.baseUrl, url);
    }

    // 附加 .extension 和 query
    url += extname + query;

    return url;
}
/**
 * id normalize化
 *
 * @inner
 * @param {string} id 需要normalize的模块标识
 * @param {string} baseId 当前环境的模块标识
 * @return {string}
 */
function normalize( id, baseId ) {
    if ( !id ) {
        return '';
    }

    baseId = baseId || '';
    var idInfo = parseId( id );
    if ( !idInfo ) {
        return id;
    }

    var resourceId = idInfo.resource;
    var moduleId = relative2absolute( idInfo.module, baseId );

    each(
        packagesIndex,
        function ( packageConf ) {
            var name = packageConf.name;
            if ( name === moduleId ) {
                moduleId = name + '/' + packageConf.main;
                return false;
            }
        }
    );

    // 根据config中的map配置进行module id mapping
    indexRetrieve(
        baseId,
        mappingIdIndex,
        function ( value ) {

            indexRetrieve(
                moduleId,
                value,
                function ( mdValue, mdKey ) {
                    moduleId = moduleId.replace( mdKey, mdValue );
                }
            );

        }
    );

    if ( resourceId ) {
        moduleId += '!' + resourceId;
    }

    return moduleId;
}

/**
 * 相对id转换成绝对id
 *
 * @inner
 * @param {string} id 要转换的id
 * @param {string} baseId 当前所在环境id
 * @return {string}
 */
function relative2absolute( id, baseId ) {
    if ( id.indexOf( '.' ) === 0 ) {
        var basePath = baseId.split( '/' );
        var namePath = id.split( '/' );
        var baseLen = basePath.length - 1;
        var nameLen = namePath.length;
        var cutBaseTerms = 0;
        var cutNameTerms = 0;

        pathLoop: for ( var i = 0; i < nameLen; i++ ) {
            var term = namePath[ i ];
            switch ( term ) {
                case '..':
                    if ( cutBaseTerms < baseLen ) {
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
        namePath = namePath.slice( cutNameTerms );

        return basePath.concat( namePath ).join( '/' );
    }

    return id;
}

/**
 * 解析id，返回带有module和resource属性的Object
 *
 * @inner
 * @param {string} id 标识
 * @return {Object}
 */
function parseId( id ) {
    var segs = id.split( '!' );

    if ( /^[-_a-z0-9\.]+(\/[-_a-z0-9\.]+)*$/i.test( segs[ 0 ] ) ) {
        return {
            module   : segs[ 0 ],
            resource : segs[ 1 ]
        };
    }

    return null;
}

exports.parseId = parseId;
exports.normalize = normalize;
exports.toUrl = toUrl;
exports.config = function ( conf ) {
    requireConf = conf;
    createConfIndex();
};

exports.getPackageInfo = function (id) {
    var info;

    indexRetrieve(
        id,
        packagesIndex,
        function ( value, key, item ) {
            info = item;
        }
    );

    return info;
};
