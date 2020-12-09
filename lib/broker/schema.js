const validate         = require('./validate');
const types            = validate.types;
const conversions      = ['toNumber', 'toInt', 'toBoolean'];

/**
 * Schema - schema analyzer for validate.js and transform.js
 */
const schema = {

  /**
   * Analyze the descriptor used to transform or validate the data
   *
   * @param {object} obj : Object descriptor
   * @return {object} An object which is used by the method by validate.js or transform.js
   */
  analyzeDescriptor : function (obj) {
    var _mainType    = 'object';
    var _analyzedObj = obj;
    if (obj instanceof Array) {
      _mainType    = 'array';
      _analyzedObj = obj[0];
    }
    var _onValidate  = {};
    var _onTransform = {};
    var _meta        = {
      sortGroup          : {},
      jsonToSQL          : {},
      sortMandatory      : [],
      primaryKey         : [],
      externalAggregates : {},
      aggregates         : {},
      aggregatesSort     : [],
      joins              : {},
      references         : {},
      computedFns        : {} // functions for  aggregates are stored in aggregates values
    };
    // I give an arbitrary unique name of the first array (the root).
    var _pathToCurrentObjName = ['main0'];
    var _currentObjName       = 'main0';
    var _nbObjArr             = 0;
    var _nbArr                = 0;
    var _arrLevel             = 0;
    var _objDesc              = {};
    var _virtualObjDesc       = {}; // use for joins
    var _defaultValue         = {};
    var _aggregateAttributes  = {};
    _objDesc.main0            = {
      arrChild   : [],
      arrParents : [],
      objParent  : '',
      name       : '',
      uniqueName : 'main0',
      type       : _mainType,
      obj        : {},
      objTrans   : {},
      level      : _arrLevel,
      keys       : [],
    };

    // For each attribute of the object (level 0), call analyzeRecursive;
    for (var _attrName in _analyzedObj) {
      var _value = _analyzedObj[_attrName];
      analyzeRecursive(_attrName, _value, false, _defaultValue);
      _arrLevel = 0;
    }

    // Recursive function
    function analyzeRecursive (attrName, attrValue, comingFromArray, defaultValue) {

      if (typeof attrValue === 'string') {
        throw new Error('Lunaris.store.map: ' + attrName + ' is not an array. All properties key names should be defined as arrays (e.g. ["<id>"], ["object", {}], ["array", {}])');
      }
      var _lastElement = attrValue[attrValue.length - 1];

      // if (_lastElement === 'optional' && (attrValue[0] === 'array' || attrValue[0] === 'object')) {
      //   throw new Error('`optional` value cannot be set after a sub map object');
      // }

      // if the attribute value is an array of objects
      if (attrValue[0] === 'array' && validate.isObject(_lastElement)) {
        defaultValue[attrName] = [];
        // Copy the array parameters except the last one which represent the schema of the the nested object
        _objDesc[_currentObjName].obj[attrName] = attrValue.slice(0,-1);
        // For transform.js
        _objDesc[_currentObjName].objTrans[attrName] = [];
        // Add the next array to the child list of all previous objects (TODO: not used for validation, do I keep it for further use when the validation descriptor will merge with the transform descriptor)
        var _nextObjName = attrName+''+(_nbObjArr + 1); // the next
        for (var i = 0; i<_pathToCurrentObjName.length; i++) {
          _objDesc[ _pathToCurrentObjName[i] ].arrChild.push(_nextObjName);
        }
        _nbArr++; // count number of arrays
        _arrLevel++;

        // Go to the object inside the array
        analyzeRecursive(attrName, _lastElement, true, {});
      }
      // If it is an object
      else if (attrValue[0] === 'object' && validate.isObject(_lastElement)) {
        // Copy the object parameters except the last one which represent the schema of the the nested object
        _objDesc[_currentObjName].obj[attrName] = attrValue.slice(0,-1);
        // For transform.js
        _objDesc[_currentObjName].objTrans[attrName] = { type : 'object' };

        var _currentDefaultValue = {};
        // Go to the object inside the object
        analyzeRecursive(attrName, _lastElement, false, _currentDefaultValue);
        defaultValue[attrName] = _currentDefaultValue;
      }
      // analyze the nested object (we may come from an array or an object)
      else if (validate.isObject(attrValue)) {
        // generate a unique name for this object
        _nbObjArr++;
        _nextObjName = attrName+''+_nbObjArr;
        // keep array parents
        var _pathToCurrentObjNameArr = [];
        for (i = 0; i<_pathToCurrentObjName.length; i++) {
          var _vistedObjName = _pathToCurrentObjName[i];
          if (_objDesc[ _vistedObjName ].type === 'array') {
            _pathToCurrentObjNameArr.push(_vistedObjName);
          }
        }
        // Add the name of next visited object to the path
        _pathToCurrentObjName.push(_nextObjName);
        // create the next object
        _objDesc[_nextObjName] = {
          arrChild   : [],
          arrParents : _pathToCurrentObjNameArr,
          objParent  : _currentObjName,
          name       : attrName,
          uniqueName : _nextObjName,
          type       : comingFromArray ? 'array' : 'object',
          obj        : {},
          objTrans   : {},
          level      : _arrLevel,
          keys       : []
        };

        // the next become the current
        _currentObjName = _nextObjName;
        // For each attribute of this currently visited object, call analyzeRecursive
        var _currentArrLevel = _arrLevel;
        for (var _attrName in attrValue) {
          analyzeRecursive(_attrName, attrValue[_attrName], false, defaultValue);
          _arrLevel = _currentArrLevel;
        }

        // End of the object which is currently visited.
        _pathToCurrentObjName.pop();
        // go up in the path
        _currentObjName = _pathToCurrentObjName[_pathToCurrentObjName.length-1];

        // take into account primary keys in object which are within an array
        if (_objDesc[_currentObjName].type === 'array' &&  _objDesc[_nextObjName].type === 'object') {
          _objDesc[_currentObjName].keys = _objDesc[_currentObjName].keys.concat(_objDesc[_nextObjName].keys);
        }
      }
      // if the attribute value is a simple array
      else {
        // parse the array to separate what is for validation and what is for transformation
        defaultValue[attrName] = parseArray(attrName, attrValue, _objDesc[_currentObjName], _currentObjName, _onValidate, _onTransform, _objDesc, _meta, _nbArr, _aggregateAttributes, _virtualObjDesc);
      }
    } // end of the recursive function

    // remove the keys of objects
    for (var _objName in _objDesc) {
      var _obj = _objDesc[_objName];
      if (_obj.type === 'object') {
        _obj.keys = [];
      }
      _meta.sortMandatory = _meta.sortMandatory.concat(_obj.keys);
    }

    return {
      meta               : _meta,
      onValidate         : _onValidate,
      onTransform        : _onTransform,
      compilation        : _objDesc,
      virtualCompilation : _virtualObjDesc,
      defaultValue       : _defaultValue
    };
  }


};

module.exports = schema;

/** ***************************************************************************************************************/
/*  Privates methods */
/** ***************************************************************************************************************/

/**
 * Parse array of each descriptor attribute
 *
 * @param {string} attrName : the currently visited attribute name
 * @param {array} attrArray : the array of the currently visited attribute.
 * @param {object} currentObj : The current flattenned object. This object is updated by the function.
 * @param {string} currentObjName : The current flattenned object name ('main0', ...)
 * @param {object} onValidate : object which list the functions used by the validator. This object is updated by the function.
 * @param {object} onTransform : object which list the functions used by the transformer. This object is updated by the function.
 */
function parseArray (attrName, attrArray, currentObj, currentObjName, onValidate, onTransform, objDesc, meta, currentArrayNumber, aggregateAttributes, virtualObjectDesc) {
  var _regexSQL         = /^\s*<{1}\s*(\w+)\s*>{1}\s*$/;   // regex which find sql column names <idMenu> (simple chevron)
  var _regexSQLpk       = /^\s*<{2}\s*(\w+)\s*>{2}\s*$/; // regex which find sql column primary keys <<idMenu>> (double chevron)
  var _defaultValue     = null;
  var _validateArray    = [];
  var _currentAggregate = null;

  // Parse the array and seperate what is for the validation what is for the transformation
  for (var i = 0; i<attrArray.length; i++) {
    var _item           = attrArray[i];
    var _jsonUniqueName = generateJsonUniqueName(objDesc, currentObjName, attrName);
    if (typeof _item === 'string') {
      // on Validate functions
      if (_item === 'onValidate') {
        _validateArray.push(_item); // keep this validate function in the validate array
        _item = attrArray[++i];  // get the validate function (the next element)
        _validateArray.push(_item); // keep this validate function in the validate array
        if (typeof _item !== 'function') {
          throw new Error('kitten-mq.map: "' + _item + '" is not a validate function. You must provide a function after "onValidate"');
        }
        onValidate[currentObjName+'_'+attrName] = _item;
      }
      // on Transform
      else if (_item === 'onTransform') {
        _item = attrArray[++i];  // get the transform value (the next element)
        if (typeof _item === 'function') {
          onTransform[currentObjName + '_' + attrName] = _item;
          currentObj.objTrans[attrName] = { type : 'function' };
        }
        else if (typeof _item === 'string') {
          currentObj.objTrans[attrName] = { type : 'string', value : _item };
        }
        else {
          currentObj.objTrans[attrName] = { type : 'int', value : _item };
        }
        // i++; // pass the transform function for the next loop
      }
      // detect database column names (simple chevron. ex : <idMenu>)
      else if (_regexSQL.test(_item)) {
        var _colName                    = _regexSQL.exec(_item)[1];
        currentObj.objTrans[attrName]   = _colName;
        meta.jsonToSQL[_jsonUniqueName] = _colName;
        meta.sortGroup[_colName]        = currentArrayNumber;
      }
      // detect database primary keys column names (double chevron. ex : <<idMenu>>)
      else if (_regexSQLpk.test(_item)) {
        _colName = _regexSQLpk.exec(_item)[1];

        var _col = _colName;
        if (types.indexOf(_colName) >= 0) {
          _col = attrName;
          _validateArray.push(_colName);
        }

        currentObj.keys.push(_col);
        currentObj.objTrans[attrName]   = _col;
        meta.jsonToSQL[_jsonUniqueName] = _col;
        meta.sortGroup[_col]            = currentArrayNumber;

        // Set root object primary key
        if (currentObjName === 'main0') {
          meta.primaryKey.push(attrName);
        }
      }
      else if (_item === 'min') {
        _validateArray.push(_item);
        _validateArray.push(attrArray[++i]);
      }
      else if (_item === 'max') {
        _validateArray.push(_item);
        _validateArray.push(attrArray[++i]);
      }
      else if (_item === 'array') {
        _defaultValue = [];
        _validateArray.push(_item);
      }
      else if (_item === 'optional') {
        _validateArray.push(_item);
      }
      else if (types.indexOf(_item) === -1 && conversions.indexOf(_item) === -1) {
        _defaultValue = _item;
      }
      else {
        // keep other params in the validate array
        _validateArray.push(_item);
      }
    }
    // If a function is found (alone without onTransform or onValidate in front of), it is a transformer function
    else if (typeof _item === 'function') {
      // e must detect if the function belongs to an aggregate
      if (_currentAggregate) {
        // Aggregate fns will call the function
        _currentAggregate.push(_item);
      }
      else {
        meta.computedFns[_jsonUniqueName] = _item;
      }
    }
    else if (types.indexOf(_item) === -1) {
      _defaultValue = _item;
    }
    else {
      // keep other params in the validate array
      _validateArray.push(_item);
    }
  }

  currentObj.obj[attrName] = _validateArray;
  return _defaultValue;
}


/**
 * Generate json unique name
 * @param {Object} objDesc
 * @param {String} currentObjName
 * @param {String} attrName
 * @returns {String}
 */
function generateJsonUniqueName (objDesc, currentObjName, attrName) {
  var _jsonUniqueName = attrName;
  var _parent         = currentObjName;

  while (_parent !== '' && objDesc[_parent].name !== '') {
    _jsonUniqueName = objDesc[_parent].name + '.' + _jsonUniqueName;
    _parent         = objDesc[_parent].objParent;
  }

  return _jsonUniqueName;
}
