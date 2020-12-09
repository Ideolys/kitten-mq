var validate = require('../lib/broker/validate');
var schema   = require('../lib/broker/schema');

describe('Validate', () => {

  describe('Public methods', () => {

    describe('is[Type](value)', () => {
      it('', () => {
        /**
         * Build a function which can validate any object
         *
         * @return {array}
         */
      });
      describe('tests', () => {


        it('should return true if it is an alpha', () => {
          // ok
          should(validate.isAlpha('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(true);
          // errors
          should(validate.isAlpha('')).eql(false);
          should(validate.isAlpha('éàè')).eql(false);
          should(validate.isAlpha('1dszdzd')).eql(false);
          should(validate.isAlpha('2')).eql(false);
          should(validate.isAlpha(1.23)).eql(false);
          should(validate.isAlpha({})).eql(false);
          should(validate.isAlpha([])).eql(false);
          should(validate.isAlpha(function () { return 1; })).eql(false);
          should(validate.isAlpha(1)).eql(false);
          should(validate.isAlpha(true)).eql(false);
          should(validate.isAlpha(false)).eql(false);
          should(validate.isAlpha(null)).eql(false);
        });

        it('should return true if it is an alphanumeric', () => {
          // ok
          should(validate.isAlphanumeric('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(true);
          should(validate.isAlphanumeric('1234567890')).eql(true);
          should(validate.isAlphanumeric('1234azkjazlskjlmsa567890')).eql(true);
          // errors
          should(validate.isAlphanumeric('')).eql(false);
          should(validate.isAlphanumeric('éàè')).eql(false);
          should(validate.isAlphanumeric(1.23)).eql(false);
          should(validate.isAlphanumeric({})).eql(false);
          should(validate.isAlphanumeric([])).eql(false);
          should(validate.isAlphanumeric(function () { return 1; })).eql(false);
          should(validate.isAlphanumeric(1)).eql(false);
          should(validate.isAlphanumeric(true)).eql(false);
          should(validate.isAlphanumeric(false)).eql(false);
          should(validate.isAlphanumeric(null)).eql(false);
        });

        it('should return true if it is an array', () => {
          // ok
          should(validate.isArray([])).eql(true);
          // errors
          should(validate.isArray(1.23)).eql(false);
          should(validate.isArray({})).eql(false);
          should(validate.isArray(function () { return 1; })).eql(false);
          should(validate.isArray('1')).eql(false);
          should(validate.isArray(1)).eql(false);
          should(validate.isArray(true)).eql(false);
          should(validate.isArray(false)).eql(false);
          should(validate.isArray(null)).eql(false);
          should(validate.isArray('instanceof Array')).eql(false);
        });

        it('should return true if it is a binary', () => {
          // ok
          should(validate.isBinary(true)).eql(true);
          should(validate.isBinary(false)).eql(true);
          should(validate.isBinary('false')).eql(true);
          should(validate.isBinary('true')).eql(true);
          should(validate.isBinary(0)).eql(true);
          should(validate.isBinary(-0)).eql(true);
          should(validate.isBinary(1)).eql(true);
          should(validate.isBinary('0')).eql(true);
          should(validate.isBinary('1')).eql(true);
          // errors
          should(validate.isBinary(10)).eql(false);
          should(validate.isBinary('10')).eql(false);
          should(validate.isBinary(-1)).eql(false);
          should(validate.isBinary(2)).eql(false);
          should(validate.isBinary(-2)).eql(false);
          should(validate.isBinary('1.3456')).eql(false);
          should(validate.isBinary('-1.3456')).eql(false);
          should(validate.isBinary('1.000')).eql(false);
          should(validate.isBinary('001.000')).eql(false);
          should(validate.isBinary('20783021.02238702710')).eql(false);
          should(validate.isBinary('-1.000')).eql(false);
          should(validate.isBinary('34')).eql(false);
          should(validate.isBinary('-34')).eql(false);
          should(validate.isBinary('- 1.3456')).eql(false);
          should(validate.isBinary('1.3456  ')).eql(false);
          should(validate.isBinary('')).eql(false);
          should(validate.isBinary('1 .  3456')).eql(false);
          should(validate.isBinary('3,32')).eql(false);
          should(validate.isBinary('3.443.000')).eql(false);
          should(validate.isBinary('éàè#@&é""\'((§§èè!!çàà)-ù:;#)')).eql(false);
          should(validate.isBinary('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isBinary('a1234567890')).eql(false);
          should(validate.isBinary('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isBinary(13)).eql(false);
          should(validate.isBinary(13223455)).eql(false);
          should(validate.isBinary(-213)).eql(false);
          should(validate.isBinary(1.23)).eql(false);
          should(validate.isBinary(1.763)).eql(false);
          should(validate.isBinary(NaN)).eql(false);
          should(validate.isBinary({})).eql(false);
          should(validate.isBinary([])).eql(false);
          should(validate.isBinary(() => { return 1; })).eql(false);
          should(validate.isBinary(null)).eql(false);
        });

        it('should return true if it is a boolean (strict)', () => {
          // ok
          should(validate.isBoolean(true)).eql(true);
          should(validate.isBoolean(false)).eql(true);
          // errors
          should(validate.isBoolean('false')).eql(false);
          should(validate.isBoolean('true')).eql(false);
          should(validate.isBoolean(0)).eql(false);
          should(validate.isBoolean(-0)).eql(false);
          should(validate.isBoolean(1)).eql(false);
          should(validate.isBoolean('0')).eql(false);
          should(validate.isBoolean('1')).eql(false);
          should(validate.isBoolean(10)).eql(false);
          should(validate.isBoolean('10')).eql(false);
          should(validate.isBoolean(-1)).eql(false);
          should(validate.isBoolean(2)).eql(false);
          should(validate.isBoolean(-2)).eql(false);
          should(validate.isBoolean('1.3456')).eql(false);
          should(validate.isBoolean('-1.3456')).eql(false);
          should(validate.isBoolean('1.000')).eql(false);
          should(validate.isBoolean('001.000')).eql(false);
          should(validate.isBoolean('20783021.02238702710')).eql(false);
          should(validate.isBoolean('-1.000')).eql(false);
          should(validate.isBoolean('34')).eql(false);
          should(validate.isBoolean('-34')).eql(false);
          should(validate.isBoolean('- 1.3456')).eql(false);
          should(validate.isBoolean('1.3456  ')).eql(false);
          should(validate.isBoolean('')).eql(false);
          should(validate.isBoolean('1 .  3456')).eql(false);
          should(validate.isBoolean('3,32')).eql(false);
          should(validate.isBoolean('3.443.000')).eql(false);
          should(validate.isBoolean('éàè#@&é""\'((§§èè!!çàà)-ù:;#)')).eql(false);
          should(validate.isBoolean('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isBoolean('a1234567890')).eql(false);
          should(validate.isBoolean('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isBoolean(13)).eql(false);
          should(validate.isBoolean(13223455)).eql(false);
          should(validate.isBoolean(-213)).eql(false);
          should(validate.isBoolean(1.23)).eql(false);
          should(validate.isBoolean(1.763)).eql(false);
          should(validate.isBoolean(NaN)).eql(false);
          should(validate.isBoolean({})).eql(false);
          should(validate.isBoolean([])).eql(false);
          should(validate.isBoolean(() => {return 1;})).eql(false);
          should(validate.isBoolean(null)).eql(false);
        });

        it('should return true if it is a decimal (accept strings)', () => {
          // ok
          should(validate.isDecimal(1.23)).eql(true);
          should(validate.isDecimal(13)).eql(true);
          should(validate.isDecimal(1.763)).eql(true);
          should(validate.isDecimal('1.3456')).eql(true);
          should(validate.isDecimal('-1.3456')).eql(true);
          should(validate.isDecimal('1.000')).eql(true);
          should(validate.isDecimal('001.000')).eql(true);
          should(validate.isDecimal('20783021.02238702710')).eql(true);
          should(validate.isDecimal('-1.000')).eql(true);
          should(validate.isDecimal('34')).eql(true);
          should(validate.isDecimal('-34')).eql(true);
          should(validate.isDecimal(13)).eql(true);
          should(validate.isDecimal(-213)).eql(true);
          // errors
          should(validate.isDecimal('- 1.3456')).eql(false);
          should(validate.isDecimal('1.3456  ')).eql(false);
          should(validate.isDecimal('')).eql(false);
          should(validate.isDecimal('1 .  3456')).eql(false);
          should(validate.isDecimal('3,32')).eql(false);
          should(validate.isDecimal('3.443.000')).eql(false);
          should(validate.isDecimal('éàè')).eql(false);
          should(validate.isDecimal('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isDecimal('a1234567890')).eql(false);
          should(validate.isDecimal('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isDecimal({})).eql(false);
          should(validate.isDecimal([])).eql(false);
          should(validate.isDecimal(() => {return 1;})).eql(false);
          should(validate.isDecimal(true)).eql(false);
          should(validate.isDecimal(false)).eql(false);
          should(validate.isDecimal(null)).eql(false);
        });

        it('should return true if it is a int (pure integer)', () => {
          // ok
          should(validate.isInt(13)).eql(true);
          should(validate.isInt(13223455)).eql(true);
          should(validate.isInt(-213)).eql(true);
          should(validate.isInt(-0)).eql(true);
          // errors
          // should(validate.isInt(1.0), false); <-- do not pass but anyway).eql(all functions of javascript convert it to "1" (even toString)
          should(validate.isInt(1.23)).eql(false);
          should(validate.isInt(1.763)).eql(false);
          should(validate.isInt('1.3456')).eql(false);
          should(validate.isInt('-1.3456')).eql(false);
          should(validate.isInt('1.000')).eql(false);
          should(validate.isInt('001.000')).eql(false);
          should(validate.isInt('20783021.02238702710')).eql(false);
          should(validate.isInt('-1.000')).eql(false);
          should(validate.isInt('34')).eql(false);
          should(validate.isInt('-34')).eql(false);
          should(validate.isInt('- 1.3456')).eql(false);
          should(validate.isInt('1.3456  ')).eql(false);
          should(validate.isInt('')).eql(false);
          should(validate.isInt('1 .  3456')).eql(false);
          should(validate.isInt('3,32')).eql(false);
          should(validate.isInt('3.443.000')).eql(false);
          should(validate.isInt('éàè')).eql(false);
          should(validate.isInt('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isInt('a1234567890')).eql(false);
          should(validate.isInt('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isInt(NaN)).eql(false);
          should(validate.isInt({})).eql(false);
          should(validate.isInt([])).eql(false);
          should(validate.isInt(() => {return 1;})).eql(false);
          should(validate.isInt(true)).eql(false);
          should(validate.isInt(false)).eql(false);
          should(validate.isInt(null)).eql(false);
        });


        it('should return true if it is a number (integer or float)', () => {
          // ok
          should(validate.isNumber(13)).eql(true);
          should(validate.isNumber(13223455)).eql(true);
          should(validate.isNumber(-213)).eql(true);
          should(validate.isNumber(-0)).eql(true);
          should(validate.isNumber(1.23)).eql(true);
          should(validate.isNumber(1.763)).eql(true);
          should(validate.isNumber(-1.23)).eql(true);
          should(validate.isNumber(-2441.763)).eql(true);
          // errors
          // should(validate.isInt(1.0), false); <-- do not pass but anyway).eql(all functions of javascript convert it to "1" (even toString)
          should(validate.isNumber('1.3456')).eql(false);
          should(validate.isNumber('-1.3456')).eql(false);
          should(validate.isNumber('1.000')).eql(false);
          should(validate.isNumber('001.000')).eql(false);
          should(validate.isNumber('20783021.02238702710')).eql(false);
          should(validate.isNumber('-1.000')).eql(false);
          should(validate.isNumber('34')).eql(false);
          should(validate.isNumber('-34')).eql(false);
          should(validate.isNumber('- 1.3456')).eql(false);
          should(validate.isNumber('1.3456  ')).eql(false);
          should(validate.isNumber('')).eql(false);
          should(validate.isNumber('1 .  3456')).eql(false);
          should(validate.isNumber('3,32')).eql(false);
          should(validate.isNumber('3.443.000')).eql(false);
          should(validate.isNumber('éàè')).eql(false);
          should(validate.isNumber('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isNumber('a1234567890')).eql(false);
          should(validate.isNumber('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isNumber(NaN)).eql(false);
          should(validate.isNumber({})).eql(false);
          should(validate.isNumber([])).eql(false);
          should(validate.isNumber(() => {return 1;})).eql(false);
          should(validate.isNumber(true)).eql(false);
          should(validate.isNumber(false)).eql(false);
          should(validate.isNumber(null)).eql(false);
        });


        it('should return true if it is a numeric value (int or string of int)', () => {
          // ok
          should(validate.isNumeric(13)).eql(true);
          should(validate.isNumeric(13223455)).eql(true);
          should(validate.isNumeric(-213)).eql(true);
          should(validate.isNumeric(-0)).eql(true);
          should(validate.isNumeric('34')).eql(true);
          should(validate.isNumeric('-34')).eql(true);
          should(validate.isNumeric('1234567890')).eql(true);
          // errors
          // should(validate.isNumeric(1.0), false);//  <-- do not pass but anyway).eql(all functions of javascript convert it to "1" (even toString)
          should(validate.isNumeric(1.23)).eql(false);
          should(validate.isNumeric(1.763)).eql(false);
          should(validate.isNumeric(-1.23)).eql(false);
          should(validate.isNumeric(-2441.763)).eql(false);
          should(validate.isNumeric('1.3456')).eql(false);
          should(validate.isNumeric('1322 ')).eql(false);
          should(validate.isNumeric(' 1322 ')).eql(false);
          should(validate.isNumeric('-1.3456')).eql(false);
          should(validate.isNumeric('1.000')).eql(false);
          should(validate.isNumeric('001.000')).eql(false);
          should(validate.isNumeric('20783021.02238702710')).eql(false);
          should(validate.isNumeric('-1.000')).eql(false);
          should(validate.isNumeric('- 1.3456')).eql(false);
          should(validate.isNumeric('1.3456  ')).eql(false);
          should(validate.isNumeric('')).eql(false);
          should(validate.isNumeric('1 .  3456')).eql(false);
          should(validate.isNumeric('3,32')).eql(false);
          should(validate.isNumeric('3.443.000')).eql(false);
          should(validate.isNumeric('éàè')).eql(false);
          should(validate.isNumeric('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(false);
          should(validate.isNumeric('a1234567890')).eql(false);
          should(validate.isNumeric('1234azkjazlskjlmsa567890')).eql(false);
          should(validate.isNumeric(NaN)).eql(false);
          should(validate.isNumeric({})).eql(false);
          should(validate.isNumeric([])).eql(false);
          should(validate.isNumeric(() => {return 1;})).eql(false);
          should(validate.isNumeric(true)).eql(false);
          should(validate.isNumeric(false)).eql(false);
          should(validate.isNumeric(null)).eql(false);
        });


        it('should return true if it is an object', () => {
          // ok
          should(validate.isObject({})).eql(true);
          // errors
          should(validate.isObject(1.23)).eql(false);
          should(validate.isObject([])).eql(false);
          should(validate.isObject(() => {return 1;})).eql(false);
          should(validate.isObject('1')).eql(false);
          should(validate.isObject(1)).eql(false);
          should(validate.isObject(true)).eql(false);
          should(validate.isObject(false)).eql(false);
          should(validate.isObject(null)).eql(false);
        });

        it('should return true if it is a string', () => {
          // ok
          should(validate.isString('1.3456')).eql(true);
          should(validate.isString('-1.3456')).eql(true);
          should(validate.isString('1.000')).eql(true);
          should(validate.isString('001.000')).eql(true);
          should(validate.isString('20783021.02238702710')).eql(true);
          should(validate.isString('-1.000')).eql(true);
          should(validate.isString('34')).eql(true);
          should(validate.isString('-34')).eql(true);
          should(validate.isString('- 1.3456')).eql(true);
          should(validate.isString('1.3456  ')).eql(true);
          should(validate.isString('')).eql(true);
          should(validate.isString('1 .  3456')).eql(true);
          should(validate.isString('3,32')).eql(true);
          should(validate.isString('3.443.000')).eql(true);
          should(validate.isString('éàè#@&é""\'((§§èè!!çàà)-ù:;#)')).eql(true);
          should(validate.isString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')).eql(true);
          should(validate.isString('a1234567890')).eql(true);
          should(validate.isString('1234azkjazlskjlmsa567890')).eql(true);
          // errors
          should(validate.isString(13)).eql(false);
          should(validate.isString(13223455)).eql(false);
          should(validate.isString(-213)).eql(false);
          should(validate.isString(-0)).eql(false);
          should(validate.isString(1.23)).eql(false);
          should(validate.isString(1.763)).eql(false);
          should(validate.isString(NaN)).eql(false);
          should(validate.isString({})).eql(false);
          should(validate.isString([])).eql(false);
          should(validate.isString(() => {return 1;})).eql(false);
          should(validate.isString(true)).eql(false);
          should(validate.isString(false)).eql(false);
          should(validate.isString(null)).eql(false);
        });

        it('should return true if it is a valid email', () => {
          // ok
          should(validate.isEmail('foo@bar.fr')).eql(true);
          should(validate.isEmail('foo@bar.frazerty')).eql(true);
          should(validate.isEmail('foo86@bar3.fr')).eql(true);
          should(validate.isEmail('fOo@bar.fr')).eql(true);
          should(validate.isEmail('foo@bAr.fr')).eql(true);
          should(validate.isEmail('foo@bar.Fr')).eql(true);
          should(validate.isEmail('foo.bar@bar.fr')).eql(true);
          // errors
          should(validate.isEmail('foobar.fr')).eql(false);
          should(validate.isEmail('foo@bar')).eql(false);
          should(validate.isEmail('foo@bar.f')).eql(false);
          should(validate.isEmail('foo@bar.')).eql(false);
          should(validate.isEmail('foo.bar')).eql(false);
          should(validate.isEmail('foo@@bar.fr')).eql(false);
          should(validate.isEmail('foo@bar@hello.fr')).eql(false);
          should(validate.isEmail('f.o.o.bar.fr')).eql(false);
          should(validate.isEmail('foobar')).eql(false);
          should(validate.isEmail('')).eql(false);
          should(validate.isEmail('.fr')).eql(false);
          should(validate.isEmail('@.fr')).eql(false);
        });

        it('should return true if it is a valid emails list', () => {
          // ok
          should(validate.isEmailList('foo@bar.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr;bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr       ;bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr;       bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr;  bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr ; bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr;\nbar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr\n;bar@foo.fr')).eql(true);
          should(validate.isEmailList('foo@bar.fr ; bar@foo.fr; balle@foo.fr  ; test@moi.fr\n; abc@def.com')).eql(true);
          // errors
          should(validate.isEmailList('foo@bar.frbar@foo.fr')).eql(false);
          should(validate.isEmailList('foo@bar.fr;')).eql(false);
          should(validate.isEmailList(';')).eql(false);
          should(validate.isEmailList('foo@bar.fr;qsd')).eql(false);
          should(validate.isEmailList('')).eql(false);
        });

        it('should retrue if value is defined', () => {
          should(validate.isNotNull()).eql(false);
          should(validate.isNotNull(undefined)).eql(false);
          should(validate.isNotNull(null)).eql(false);
          should(validate.isNotNull('')).eql(true);
          should(validate.isNotNull(0)).eql(true);
          should(validate.isNotNull('abc')).eql(true);
          should(validate.isNotNull([])).eql(true);
          should(validate.isNotNull(['a'])).eql(true);
          should(validate.isNotNull({})).eql(true);
          should(validate.isNotNull({ label : 'a' })).eql(true);
        });
      }); /* End of descript test */
    });


    describe('buildValidateFunction(objectDescriptor)', () => {
      it('', () => {
        /**
         * Build a function which can validate any object
         *
         * @return {array}
         */
      });
      describe('tests', () => {
        it('should build a function which check the validity of an object and return no errors if there is no errors', () => {
          var _objectDescriptor = {
            id        : ['int'],
            continent : ['string']
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france'
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should return no errors if there are nothing to validate in an object', () => {
          var _objectDescriptor = {
            id        : ['<<idMenu>>'],
            continent : ['<idContinent>']
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france'
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array', () => {
          var _objectDescriptor = [{
            id        : ['int', '<<idMenu>>'],
            continent : ['string', '<idContinent>']
          }];
          var _objectToCheck = [{
            id        : 2,
            continent : 'france'
          }];
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should return no errors if there are nothing to validate in an object in an array', () => {
          var _objectDescriptor = [{
            id        : ['<<idMenu>>'],
            continent : ['<idContinent>']
          }];
          var _objectToCheck = [{
            id        : 2,
            continent : 'france'
          }];
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects', () => {
          var _objectDescriptor = [{
            id        : ['int', '<<idMenu>>'],
            continent : ['string', '<idContinent>']
          }];
          var _objectToCheck = [{
            id        : 2,
            continent : 'france'
          },{
            id        : 3,
            continent : 'england'
          }
          ];
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and detect errors', () => {
          var _objectDescriptor = [{
            id        : ['int', '<<idMenu>>'],
            continent : ['string', '<idContinent>']
          }];
          var _objectToCheck = [{
            id        : 1,
            continent : 'france',
          },{
            id        : 'bullshit',
            continent : 'england',
          }
          ];
          var _expectedResult     = [{ value : 'bullshit', field : 'id', index: 1, error : '${must be an integer}' }];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, true);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and do not validate keys', () => {
          var _objectDescriptor = [{
            id        : ['<<int>>'],
            continent : ['string']
          }];
          var _objectToCheck = [{
            id        : 1,
            continent : 'france'
          },{
            id        : 'bullshit',
            continent : 'england'
          }
          ];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and validate optional value', () => {
          var _objectDescriptor = [{
            id        : ['<<int>>'],
            continent : ['string', 'optional']
          }];
          var _objectToCheck = [{
            id        : 1,
            continent : 'france'
          },{
            id        : null,
            continent : null
          }];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and validate optional value : undefined', () => {
          var _objectDescriptor = [{
            id        : ['<<int>>'],
            continent : ['string', 'optional']
          }];
          var _objectToCheck = [{
            id        : 1,
            continent : 'france'
          },{
            id : null
          }];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and validate optional value : \'\'', () => {
          var _objectDescriptor = [{
            id        : ['<<int>>'],
            continent : ['string', 'optional']
          }];

          var _objectToCheck = [{
            id        : 1,
            continent : ''
          }];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and validate optional object value', () => {
          var _objectDescriptor = [{
            id        : ['<<int>>'],
            continent : ['object', 'optional', {
              id : ['int']
            }]
          }];
          var _objectToCheck = [{
            id        : 1,
            continent : { id : 2 }
          },{
            id : null
          }];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should validate array with 2 objects and validate empty array', () => {
          var _objectDescriptor = [{
            id         : ['<<int>>'],
            continents : ['array', {
              id : ['<<int>>']
            }]
          }];
          var _objectToCheck = [{
            id         : 1,
            continents : [{ id : 2 }]
          },{
            id         : null,
            continents : []
          }];
          var _expectedResult     = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult     = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck, null, false);
          should(_computedResult).eql(_expectedResult);
        });

        it('should return an error if there is an error', () => {
          var _objectDescriptor = {
            id        : ['int'],
            continent : ['string']
          };
          var _objectToCheck = {
            id        : 'wrongValue',
            continent : 'france'
          };
          var _expectedResult = [{ value : 'wrongValue', field : 'id', error : '${must be an integer}', index : null }];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should works even if there is a nested object', () => {
          var _objectDescriptor = {
            id        : ['int'],
            continent : ['string'],
            info      : ['object',{
              temperature : ['string']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            info      : {
              temperature : '5degree'
            }
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should return an error if wa have an array instead of an object. And should stop validation', () => {
          var _objectDescriptor = {
            id        : ['int'],
            continent : ['string'],
            info      : ['object',{
              temperature : ['string']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            info      : [{
              temperature : '5degree'
            }]
          };
          var _expectedResult = [
            { value : [{ temperature : '5degree' }], field : 'info', error : '${must be an object}', index : null }
          ];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).have.lengthOf(1);
          should(_computedResult).eql(_expectedResult);
        });

        it('should detect errors inside nested object', () => {
          var _objectDescriptor = {
            id        : ['int'],
            continent : ['string'],
            info      : ['object',{
              temperature : ['string']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            info      : {
              temperature : 5
            }
          };
          var _expectedResult = [{ value : 5, field : 'info[temperature]', error : '${must be a string}', index : null }];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should works even if there is one arrays', () => {
          var _objectDescriptor = {
            id        : ['<<int>>'],
            continent : ['string'],
            countries : ['array',{
              id   : ['<<int>>'],
              name : ['string']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            countries : [{
              id   : 2,
              name : 'france'
            }]
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should works even if there are nested arrays', () => {
          var _objectDescriptor = {
            id        : ['<<int>>'],
            continent : ['string'],
            countries : ['array',{
              id     : ['<<int>>'],
              name   : ['string'],
              cities : ['array', {
                id : ['<<int>>']
              }]
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            countries : [{
              id     : 2,
              name   : 'france',
              cities : [{
                id : 2
              }]
            }]
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should works even if there are nested arrays', () => {
          var _objectDescriptor = {
            id        : ['<<int>>'],
            continent : ['string'],
            countries : ['array',{
              id   : ['<<int>>'],
              name : ['string'],
            }],
            cities : ['array', {
              id : ['<<int>>']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            countries : [{
              id   : 2,
              name : 'france'
            }],
            cities : [{
              id : 2
            }]
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should works even if there are nested arrays', () => {
          var _objectDescriptor = {
            id        : ['<<int>>'],
            continent : ['string'],
            countries : ['array',{
              id     : ['<<int>>'],
              name   : ['string'],
              cities : ['array', {
                id   : ['<<int>>'],
                info : ['object',{
                  temperature : ['string']
                }]
              }]
            }],
            cities : ['array', {
              id : ['<<int>>']
            }]
          };
          var _objectToCheck = {
            id        : 2,
            continent : 'france',
            countries : [{
              id     : 2,
              name   : 'france',
              cities : [{
                id   : 2,
                info : {
                  temperature : 'france'
                }
              }]
            }],
            cities : [{
              id : 2
            }]
          };
          var _expectedResult = [];
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _computedResult = validate.buildValidateFunction(_analyzedDescriptor.compilation)(_objectToCheck);
          should(_computedResult).eql(_expectedResult);
        });

        it('should build a function which checks integers ', () => {
          var _objectDescriptor = { id : ['int'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 5 }).length).eql(0);
          should(_validateFunction({ id : 0 }).length).eql(0);
          should(_validateFunction({ id : 6 }).length).eql(0);
          should(_validateFunction({ id : -6 }).length).eql(0);
          should(_validateFunction({ id : -0 }).length).eql(0);

          // errors
          // should(_validateFunction({ 'id': 2.00 }).length).eql(1);
          should(_validateFunction({ id : 'NaN' }).length).eql(1);
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
          should(_validateFunction({ id : true }).length).eql(1);
          should(_validateFunction({ id : null }).length).eql(1);
          should(_validateFunction({ id : false }).length).eql(1);
        });

        it('should build a function which checks integers with max', () => {
          var _objectDescriptor = { id : ['int', 'max', 1000000] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : -2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 999999 }).length).eql(0);
          should(_validateFunction({ id : 1000000 }).length).eql(0);
          // errors
          should(_validateFunction({ id : 2000000 }).length).eql(1);
        });

        it('should build a function which checks integers with min and max', () => {
          var _objectDescriptor = { id : ['int', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 5 }).length).eql(0);
          // errors
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });


        it('should build a function which checks strings ', () => {
          var _objectDescriptor = { id : ['string'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : '2' }).length).eql(0);
          should(_validateFunction({ id : '9' }).length).eql(0);
          should(_validateFunction({ id : '@hueioé&!yàçe"émdsdnqsmdkd=dlk' }).length).eql(0);
          // errors
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });


        it('should build a function which checks strings with min and max', () => {
          var _objectDescriptor = { id : ['string', 'min', 1, 'max', 30] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : '2' }).length).eql(0);
          should(_validateFunction({ id : '9' }).length).eql(0);
          should(_validateFunction({ id : ' ' }).length).eql(0);
          should(_validateFunction({ id : '@hueioé&!yàçe"émdsdnqsmdkd=dlk' }).length).eql(0); // 30 chars
          // errors
          should(_validateFunction({ id : '' }).length).eql(1);
          should(_validateFunction({ id : 'sqldkjqslm dkjqsdlmzaz dmlkaz dlmazkdj azmldk j' }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);

          // test of variant types
          var _typeVariant = ['alpha', 'alphanumeric'];
          for (var i = 0; i < _typeVariant.length; i++) {
            var _objectDescriptorV = { id : ['alpha', 'min', 1, 'max', 10] };
            var _analyzedDescriptorV = schema.analyzeDescriptor(_objectDescriptorV);
            var _validateFunctionV = validate.buildValidateFunction(_analyzedDescriptorV.compilation);
            // ok
            should(_validateFunctionV({ id : 'azertyuiop' }).length).eql(0);
            should(_validateFunctionV({ id : 'qsjsldfld' }).length).eql(0);
            should(_validateFunctionV({ id : 'z' }).length).eql(0);
            // errors
            should(_validateFunctionV({ id : 'aksjffhjezijsisjsyzkzozoskzsjzZ' }).length).eql(1); // 30 valid chars
            should(_validateFunctionV({ id : '' }).length).eql(1);
            should(_validateFunctionV({ id : 'sqldkjqslm dkjqsdlmzaz dmlkaz dlmazkdj azmldk j' }).length).eql(1);
            should(_validateFunctionV({ id : 0 }).length).eql(1);
            should(_validateFunctionV({ id : 6 }).length).eql(1);
            should(_validateFunctionV({ id : [] }).length).eql(1);
            should(_validateFunctionV({ id : {} }).length).eql(1);
          }
        });

        it('should build a function which checks array ', () => {
          var _objectDescriptor = {  id : ['array']  };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : [] }).length).eql(0);
          // errors
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : 'grtgtrg' }).length).eql(1);
          should(_validateFunction({ id : '[]' }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which checks array of objects', () => {
          var _objectDescriptor = {
            id : ['array', {
              test : ['<<int>>']
            }]
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : [] }).length).eql(0);
          should(_validateFunction({ id : [{ test : 2}] }).length).eql(0);
          should(_validateFunction({ id : [{ test : 2}, { test : 5}] }).length).eql(0);
          // errors
          should(_validateFunction({ id : [{ test : 2}, { test : 'bad' }] }).length).eql(1);
          should(_validateFunction({ id : [1, 2] }).length).eql(2);
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : 'grtgtrg' }).length).eql(1);
          should(_validateFunction({ id : '[]' }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which checks array of objects and optional', () => {
          var _objectDescriptor = {
            id : ['array', 'optional', {
              test : ['<<int>>']
            }]
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : null }).length).eql(0);
          should(_validateFunction({ id : undefined }).length).eql(0);
          should(_validateFunction({ id : [] }).length).eql(0);
          should(_validateFunction({ id : [{ test : 2}] }).length).eql(0);
          should(_validateFunction({ id : [{ test : 2}, { test : 5}] }).length).eql(0);
          // errors
          should(_validateFunction({ id : [{ test : 2}, { test : 'bad' }] }).length).eql(1);
          should(_validateFunction({ id : [1, 2] }).length).eql(2);
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : 'grtgtrg' }).length).eql(1);
          should(_validateFunction({ id : '[]' }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });


        it('should build a function which checks array of object with min and max', () => {
          var _objectDescriptor = {
            id : ['array', 'min', 1, 'max', 2, {
              test : ['<<int>>']
            }]
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : [{test : 2}] }).length).eql(0);
          should(_validateFunction({ id : [{test : 2}, {test : 5}] }).length).eql(0);
          // errors
          should(_validateFunction({ id : [{test : 2}, {test : 5}, {test : 5}] }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : [{test : 2}, {test : 'bad'}] }).length).eql(1);
          should(_validateFunction({ id : [1, 2] }).length).eql(2);
          should(_validateFunction({ id : '2' }).length).eql(1);
          should(_validateFunction({ id : 'grtgtrg' }).length).eql(1);
          should(_validateFunction({ id : '[]' }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which checks decimal with min and max', () => {
          var _objectDescriptor = { id : ['decimal', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 5.00 }).length).eql(0);
          should(_validateFunction({ id : '4.999' }).length).eql(0);
          should(_validateFunction({ id : '2.545' }).length).eql(0);
          should(_validateFunction({ id : 4.54542 }).length).eql(0);

          // errors
          should(_validateFunction({ id : 6.54545 }).length).eql(1);
          should(_validateFunction({ id : 5.1 }).length).eql(1);
          should(_validateFunction({ id : 0.999999 }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which checks number with min and max', () => {
          var _objectDescriptor = { id : ['number', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 5.00 }).length).eql(0);
          should(_validateFunction({ id : 4.54542 }).length).eql(0);

          // errors
          should(_validateFunction({ id : '4.999' }).length).eql(1);
          should(_validateFunction({ id : '2.545' }).length).eql(1);
          should(_validateFunction({ id : 6.54545 }).length).eql(1);
          should(_validateFunction({ id : 5.1 }).length).eql(1);
          should(_validateFunction({ id : 0.999999 }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which checks numeric with min and max', () => {
          var _objectDescriptor = { id : ['numeric', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 2 }).length).eql(0);
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : '2' }).length).eql(0);
          should(_validateFunction({ id : '1' }).length).eql(0);
          should(_validateFunction({ id : 5.00 }).length).eql(0); // <-- exception, javascirpt convert it to an int value anyway
          // errors

          should(_validateFunction({ id : 4.54542 }).length).eql(1);
          should(_validateFunction({ id : '4.999' }).length).eql(1);
          should(_validateFunction({ id : '2.545' }).length).eql(1);
          should(_validateFunction({ id : 6.54545 }).length).eql(1);
          should(_validateFunction({ id : 5.1 }).length).eql(1);
          should(_validateFunction({ id : 0.999999 }).length).eql(1);
          should(_validateFunction({ id : 0 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });


        it('should build a function which checks binary and does not take into account "min and max"', () => {
          var _objectDescriptor = { id : ['binary', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 0 }).length).eql(0);
          should(_validateFunction({ id : '0' }).length).eql(0);
          should(_validateFunction({ id : '1' }).length).eql(0);
          should(_validateFunction({ id : true }).length).eql(0);
          should(_validateFunction({ id : false }).length).eql(0);
          should(_validateFunction({ id : 'true' }).length).eql(0);
          should(_validateFunction({ id : 'false' }).length).eql(0);
          // errors

          should(_validateFunction({ id : 4.54542 }).length).eql(1);
          should(_validateFunction({ id : '4.999' }).length).eql(1);
          should(_validateFunction({ id : '2.545' }).length).eql(1);
          should(_validateFunction({ id : 6.54545 }).length).eql(1);
          should(_validateFunction({ id : 5.1 }).length).eql(1);
          should(_validateFunction({ id : 0.999999 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });


        it('should build a function which checks boolean and does not take into account "min and max"', () => {
          var _objectDescriptor = { id : ['binary', 'min', 1, 'max', 5] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : true }).length).eql(0);
          should(_validateFunction({ id : false }).length).eql(0);

          // errors
          should(_validateFunction({ id : 1 }).length).eql(0);
          should(_validateFunction({ id : 0 }).length).eql(0);
          should(_validateFunction({ id : '0' }).length).eql(0);
          should(_validateFunction({ id : '1' }).length).eql(0);
          should(_validateFunction({ id : 'true' }).length).eql(0);
          should(_validateFunction({ id : 'false' }).length).eql(0);
          should(_validateFunction({ id : 4.54542 }).length).eql(1);
          should(_validateFunction({ id : '4.999' }).length).eql(1);
          should(_validateFunction({ id : '2.545' }).length).eql(1);
          should(_validateFunction({ id : 6.54545 }).length).eql(1);
          should(_validateFunction({ id : 5.1 }).length).eql(1);
          should(_validateFunction({ id : 0.999999 }).length).eql(1);
          should(_validateFunction({ id : 6 }).length).eql(1);
          should(_validateFunction({ id : '9' }).length).eql(1);
          should(_validateFunction({ id : [] }).length).eql(1);
          should(_validateFunction({ id : {} }).length).eql(1);
        });

        it('should build a function which and concatenate erorr messages', () => {
          var _objectDescriptor = {
            id  : ['int', 'min', 1],
            id2 : ['int', 'min', 1, 'max', 3],
            id3 : ['numeric', 'min', 1],
            id4 : ['numeric', 'min', 1, 'max', 3],
            id5 : ['decimal', 'min', 1],
            id6 : ['decimal', 'min', 1, 'max', 3],
            id7 : ['string', 'min', 1],
            id8 : ['string', 'min', 1, 'max', 3]
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction   = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          var _objToValidate      = {
            id  : 0,
            id2 : 4,
            id3 : 0,
            id4 : 4,
            id5 : 0,
            id6 : 4,
            id7 : '',
            id8 : 'abcd',
          };
          should(_validateFunction(_objToValidate)).eql([
            { value : 0     , field : 'id' , index : null, error : '${must be an integer} ${and must be superior or equal to} 1'},
            { value : 4     , field : 'id2', index : null, error : '${must be an integer} ${and must be superior or equal to} 1 ${and must be inferior or equal to} 3'},
            { value : 0     , field : 'id3', index : null, error : '${must be a numeric value} ${and must be superior or equal to} 1'},
            { value : 4     , field : 'id4', index : null, error : '${must be a numeric value} ${and must be superior or equal to} 1 ${and must be inferior or equal to} 3'},
            { value : 0     , field : 'id5', index : null, error : '${must be a decimal} ${and must be superior or equal to} 1'},
            { value : 4     , field : 'id6', index : null, error : '${must be a decimal} ${and must be superior or equal to} 1 ${and must be inferior or equal to} 3'},
            { value : ''    , field : 'id7', index : null, error : '${must be a string} ${and the length must be superior or equal to} 1'},
            { value : 'abcd', field : 'id8', index : null, error : '${must be a string} ${and the length must be superior or equal to} 1 ${and the length must be inferior or equal to} 3'},
          ]);
        });

        it('should build a function which returns multiple errors', () => {
          var _objectDescriptor = {
            id    : ['int'],
            label : ['string']
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // ok
          should(_validateFunction({ id : 1, label : 'A' }).length).eql(0);
          // errors
          should(_validateFunction({ id : 'B', label : 'A' }).length).eql(1);
          should(_validateFunction({ id : 'B', label : 1 }).length).eql(2);
          should(_validateFunction({ id : 'B', label : 1 })).eql([
            { value : 'B', field : 'id'   , error : '${must be an integer}', index : null },
            { value : 1  , field : 'label', error : '${must be a string}', index : null   }
          ]);
        });

        it('should build a function which returns multiple errors with array in error', () => {
          var _objectDescriptor = {
            id     : ['int'],
            label  : ['string'],
            prices : ['array', {
              price : ['<<number>>']
            }],
            total : ['number']
          };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);
          // errors
          var _result = _validateFunction({
            id     : 'B',
            label  : 'A',
            prices : { price : 1 },
            total  : 'total'
          });

          should(_result).have.lengthOf(3);
          should(_result).eql([
            { value : 'B', field : 'id', error : '${must be an integer}', index : null },
            {
              value : { price : 1 },
              field : 'prices',
              error : '${must be an array}',
              index : null
            },
            { value : 'total', field : 'total', error : '${must be a number}', index : null   }
          ]);
        });

        it('should build a function which convert the binary to a real boolean if it is binary and if we add the filter "toBoolean"', () => {
          var _objectDescriptor = { id : ['binary', 'toBoolean'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var _data =  {};
          var _dataFalse = { id : false };
          var _dataTrue = { id : true };

          // ok, converted to false
          _data = { id : 0 };
          _validateFunction(_data);
          should(_data).eql(_dataFalse);
          _data = { id : '0' };
          _validateFunction(_data);
          should(_data).eql(_dataFalse);
          _data = { id : 'false' };
          _validateFunction(_data);
          should(_data).eql(_dataFalse);
          _data = { id : false };
          _validateFunction(_data);
          should(_data).eql(_dataFalse);

          // ok, converted to true
          _data = { id : 1 };
          _validateFunction(_data);
          should(_data).eql(_dataTrue);
          _data = { id : '1' };
          _validateFunction(_data);
          should(_data).eql(_dataTrue);
          _data = { id : 'true' };
          _validateFunction(_data);
          should(_data).eql(_dataTrue);
          _data = { id : true};
          _validateFunction(_data);
          should(_data).eql(_dataTrue);

          // errors, not converted
          _data = { id : 4 };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : 5.54 };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : -1 };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : {} };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : [] };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : 'strur' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : '' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : NaN };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : null };
          _validateFunction(_data);
          should(_data).eql(_data);
        });


        it('should build a function which convert the numeric to a real integer if it is numeric and if we add the filter "toInt"', () => {
          var _objectDescriptor = { id : ['numeric', 'toInt'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var _data =  {};
          var _dataExpected = { id : 5 };

          // ok, converted to false
          _data = { id : 5 };
          _validateFunction(_data);
          should(_data).eql(_dataExpected);
          _data = { id : '5' };
          _validateFunction(_data);
          should(_data).eql(_dataExpected);

          // errors, not converted
          _data = { id : {} };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : [] };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : 'strur' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : '' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : NaN };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : null };
          _validateFunction(_data);
          should(_data).eql(_data);
        });

        it('should build a function which do not convert the numeric to a real integer if it is not a numeric and if we add the filter "toInt"', () => {
          var _objectDescriptor = { id : ['alpha', 'toInt'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var _data =  {};

          // no conversion
          _data = { id : '5' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : {} };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : [] };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : 'strur' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : '' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : NaN };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : null };
          _validateFunction(_data);
          should(_data).eql(_data);
        });


        it('should build a function which convert the decimal to a real number (float) if it is decimal and if we add the filter "toNumber"', () => {
          var _objectDescriptor = { id : ['decimal', 'toNumber'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var _data =  {};

          // ok, converted to false
          _data = { id : 5 };
          _validateFunction(_data);
          should(_data).eql({id : 5});
          _data = { id : '6.5545' };
          _validateFunction(_data);
          should(_data).eql({id : 6.5545});
          _data = { id : '-2.5545' };
          _validateFunction(_data);
          should(_data).eql({id : -2.5545});

          // errors, not converted
          _data = { id : {} };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : [] };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : 'strur' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : '' };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : NaN };
          _validateFunction(_data);
          should(_data).eql(_data);
          _data = { id : null };
          _validateFunction(_data);
          should(_data).eql(_data);
        });


        it('should call the callback if provided', function (done) {
          var _objectDescriptor = { id : ['decimal', 'toNumber'] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var _data =  {};

          // ok, converted to false
          _data = { id : '5' };
          _validateFunction(_data, _analyzedDescriptor.onValidate, true, function () {
            should(_data).eql({id : 5});
            done();
          });
        });



        it('should work in asynchrone when the user provide a custom validate function in the descriptor', function (done) {
          var specialValidator = function (callback) {
            if (this.value!==3) {
              callback('error');
            }
            else {
              callback();
            }
          };

          var _objectDescriptor   = { id : ['int', 'onValidate', specialValidator] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction   = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          _validateFunction({id : 2 }, _analyzedDescriptor.onValidate, true, function (resFirst) {
            should(resFirst.length).eql(1);
            _validateFunction({id : 3 }, _analyzedDescriptor.onValidate, true, function (resSecond) {
              should(resSecond.length).eql(0);
              done();
            });
          });
        });

        it('should return an array of errors even in asynchrone', function (done) {
          var specialValidator = function (callback) {
            if (this.value!==3) {
              callback('myMessage');
            }
            else {
              callback();
            }
          };

          var _objectDescriptor   = { id : ['int', 'onValidate', specialValidator] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction   = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          _validateFunction({id : 2 }, _analyzedDescriptor.onValidate, true, function (resFirst) {
            var _expectedResult = [{value : 2, field : 'id', error : 'myMessage'}];
            should(resFirst).eql(_expectedResult);
            _validateFunction({id : 3 }, _analyzedDescriptor.onValidate, true, function (resSecond) {
              should(resSecond.length).eql(0);
              done();
            });
          });
        });


        it('should work in asynchrone and it should be fast', function (done) {
          var _nbExecuted = 1000;
          var _incomplete = _nbExecuted;

          var specialValidator = function (callback) {
            if (this.value !== 3) {
              callback('error'+Math.floor(Math.random()*10));
            }
            else {
              callback();
            }
          };

          var _objectDescriptor   = { id : ['int', 'onValidate', specialValidator] };
          var _analyzedDescriptor = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction   = validate.buildValidateFunction(_analyzedDescriptor.compilation);

          var start = new Date();
          for (var i = 0; i < _nbExecuted ; i++) {
            _validateFunction({id : Math.floor(Math.random()*4) }, _analyzedDescriptor.onValidate, true, function () {
              _incomplete--;
              if (_incomplete===0) {
                var end = new Date();
                var elapsed = (end.getTime() - start.getTime())/_nbExecuted; //  time in milliseconds
                console.log('\n\n Validate Time Elapsed : '+elapsed + ' ms\n\n\n');
                done();
              }
            });
          }
        });
      }); /* End of descript test */
    });




    describe('analyzeDescriptor(obj)', () => {
      it('', () => {
        /**
         * Analyze the descriptor used to validate the data
         *
         * @param {object} obj : Object to validate
         * @return {object} An object which is used by the method validate
         */
      });
      describe('tests', () => {


        it('should analyze a descriptor and return a flat description of the object and accept that an array has no descriptions', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {id : ['array']},
                objTrans   : {},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              id : []
            }
          };

          var _objectDescriptor = {
            id : ['array']
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept that an object has no descriptions', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {id : ['object']},
                objTrans   : {},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              id : null
            }
          };

          var _objectDescriptor = {
            id : ['object']
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept multtiple paramaters in the array descriptions', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {id : ['array','min',1,'max',5]},
                objTrans   : {},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              id : []
            }
          };

          var _objectDescriptor = {
            id : ['array','min',1,'max',5]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept that attribute has does not contain a type', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL : {
                id : 'idMenu'
              },
              sortGroup : {
                idMenu : 0
              },
              sortMandatory      : [],
              primaryKey         : ['id'],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {id : []},
                objTrans   : {id : 'idMenu'},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              id : null
            }
          };

          var _objectDescriptor = {
            id : ['<<idMenu>>']
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });


        it('should analyze a descriptor and return a flat description of the object and accept multtiple paramaters in the array descriptions', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL : {
                'obj.test' : 'test'
              },
              sortGroup : {
                test : 1
              },
              sortMandatory      : [ 'test' ],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : ['obj1'],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : []},
                keys       : []
              },
              obj1 : {
                arrChild   : [],
                arrParents : [],
                level      : 1,
                objParent  : 'main0',
                name       : 'obj',
                uniqueName : 'obj1',
                type       : 'array',
                obj        : {test : ['int']},
                objTrans   : {
                  test : 'test'
                },
                keys : [ 'test' ]
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          var _objectDescriptor = {
            obj : ['array','min',1,'max',5, {
              test : ['<<int>>']
            }]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept transform functions', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {
              main0_obj : function () {return 1;}
            },
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : {type : 'function'}},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          var _objectDescriptor = {
            obj : ['array','min',1,'max',5, 'onTransform', function () {return 1;}]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and consider transform functions instead of column names if both are defined', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL : {
                obj : 'idMenu'
              },
              sortGroup : {
                idMenu : 0
              },
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {
              main0_obj : function () {return 1;}
            },
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : {type : 'function'}},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          var _objectDescriptor = {
            obj : ['array','min',1,'max',5, '<idMenu>', 'onTransform', function () {return 1;}]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept integer values on Transform', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : {type : 'int', value : 33}},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          var _objectDescriptor = {
            obj : ['array','min',1,'max',5, 'onTransform', 33]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and accept integer values on Transform', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL          : {},
              sortGroup          : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              references         : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : {type : 'string', value : '33string'}},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          var _objectDescriptor = {
            obj : ['array','min',1,'max',5, 'onTransform', '33string']
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);

          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and parse sql column names in simple chevron (remove any unused spaces)', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL : {
                obj : 'idMenu'
              },
              sortGroup : {
                idMenu : 0
              },
              references         : {},
              sortMandatory      : [],
              primaryKey         : [],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : 'idMenu'},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<idMenu>']});

          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<   idMenu>']});

          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<  idMenu   >']});

          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '   < idMenu   >  ']});

          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should analyze a descriptor and return a flat description of the object and parse sql column names in double chevron (remove any unused spaces)', () => {
          var _expectedTreeDescriptor = {
            meta : {
              jsonToSQL : {
                obj : 'idMenu'
              },
              sortGroup : {
                idMenu : 0
              },
              references         : {},
              sortMandatory      : [],
              primaryKey         : ['obj'],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              computedFns        : {}
            },
            onValidate  : { },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : [],
                arrParents : [],
                keys       : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {obj : ['array','min',1,'max',5]},
                objTrans   : {obj : 'idMenu'},
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              obj : []
            }
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<<idMenu>>']});
          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<<   idMenu>>']});
          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '<<  idMenu   >>']});
          should(_computed).eql(_expectedTreeDescriptor);
          _computed = schema.analyzeDescriptor({obj : ['array','min',1,'max',5, '   << idMenu   >>  ']});
          should(_computed).eql(_expectedTreeDescriptor);
        });

        it('should throw an error if the validate or transform function is not passed or nor correct', () => {
          // Compute the result
          try {
            schema.analyzeDescriptor({obj : ['array', () => { return 1; } ]});
          }
          catch (e) {
            should(e).be.an.Error();
          }
        });

        it('should analyze a descriptor and return a flat description of the object with transform information', function (done) {
          var _expectedTreeDescriptor = {
            meta : {
              sortGroup : {
                idContinent       : 0,
                continentName     : 0,
                idCountry         : 1,
                countryName       : 1,
                idCity            : 2,
                cityName          : 2,
                temperature       : 2,
                language          : 2,
                idGoodies         : 3,
                goodiesName       : 3,
                goodieTemperature : 3,
                goodieLanguage    : 3,
              },
              jsonToSQL : {
                continent                                        : 'continentName',
                'countries.cities.id'                            : 'idCity',
                'countries.cities.info.goodies.id'               : 'idGoodies',
                'countries.cities.info.goodies.info.language'    : 'goodieLanguage',
                'countries.cities.info.goodies.info.temperature' : 'goodieTemperature',
                'countries.cities.info.goodies.name'             : 'goodiesName',
                'countries.cities.info.language'                 : 'language',
                'countries.cities.info.temperature'              : 'temperature',
                'countries.cities.name'                          : 'cityName',
                'countries.id'                                   : 'idCountry',
                'countries.name'                                 : 'countryName',
                id                                               : 'idContinent'
              },
              sortMandatory : [
                'idCountry',
                'idCity',
                'idGoodies'
              ],
              references         : {},
              primaryKey         : ['id'],
              aggregates         : {},
              aggregatesSort     : [],
              externalAggregates : {},
              joins              : {},
              computedFns        : {}
            },
            onValidate : {
              cities2_name : function () {return 'test';}
            },
            onTransform : {},
            compilation : {
              main0 : {
                arrChild   : ['countries1', 'cities2', 'goodies4'],
                arrParents : [],
                keys       : [],
                level      : 0,
                objParent  : '',
                name       : '',
                uniqueName : 'main0',
                type       : 'object',
                obj        : {id : ['int']      , continent : ['string'],      countries : ['array']},
                objTrans   : {id : 'idContinent', continent : 'continentName', countries : []}
              },
              countries1 : {
                arrChild   : ['cities2', 'goodies4'],
                arrParents : [],
                level      : 1,
                objParent  : 'main0',
                name       : 'countries',
                uniqueName : 'countries1',
                type       : 'array',
                obj        : {id : ['int'],     name : ['string'],     cities : ['array']},
                objTrans   : {id : 'idCountry', name : 'countryName' , cities : []},
                keys       : ['idCountry']
              },
              cities2 : {
                arrChild   : ['goodies4'],
                arrParents : ['countries1'],
                level      : 2,
                objParent  : 'countries1',
                name       : 'cities',
                uniqueName : 'cities2',
                type       : 'array',
                obj        : {id : ['int'],  name : ['string', 'onValidate', function () {return 'test';}], info : ['object']},
                objTrans   : {id : 'idCity', name : 'cityName', info                                             : {type : 'object'}},
                keys       : ['idCity']
              },
              info3 : {
                arrChild   : ['goodies4'],
                arrParents : ['countries1', 'cities2'],
                level      : 2,
                objParent  : 'cities2',
                name       : 'info',
                uniqueName : 'info3',
                type       : 'object',
                obj        : {temperature : ['string'],    language : ['string'], goodies : ['array']},
                objTrans   : {temperature : 'temperature', language : 'language', goodies : []},
                keys       : []
              },
              goodies4 : {
                arrChild   : [],
                arrParents : ['countries1', 'cities2'],
                level      : 3,
                objParent  : 'info3',
                name       : 'goodies',
                uniqueName : 'goodies4',
                type       : 'array',
                obj        : {id : ['int'],     name : ['string'],    info : ['object']},
                objTrans   : {id : 'idGoodies', name : 'goodiesName', info : {type : 'object'}},
                keys       : ['idGoodies']
              },
              info5 : {
                arrChild   : [],
                arrParents : ['countries1', 'cities2', 'goodies4'],
                level      : 3,
                objParent  : 'goodies4',
                name       : 'info',
                uniqueName : 'info5',
                type       : 'object',
                obj        : {temperature : ['string'],          language : ['string']},
                objTrans   : {temperature : 'goodieTemperature', language : 'goodieLanguage'},
                keys       : []
              }
            },
            virtualCompilation : {},
            defaultValue       : {
              id        : null,
              continent : null,
              countries : []
            }
          };

          var _objectDescriptor = {
            id        : ['int',    '<<idContinent>>'],
            continent : ['string', '<continentName>'],
            countries : ['array' , {
              id     : ['int'   , '<<idCountry>>'],
              name   : ['string', '<countryName>'],
              cities : ['array' , {
                id   : ['int'   , '<<idCity>>'],
                name : ['string', '<cityName>', 'onValidate', function () {return 'test';}],
                info : ['object', {
                  temperature : ['string', '<temperature>'],
                  language    : ['string', '<language>'],
                  goodies     : ['array' , {
                    id   : ['int'   , '<<idGoodies>>'],
                    name : ['string', '<goodiesName>'],
                    info : ['object', {
                      temperature : ['string', '<goodieTemperature>'],
                      language    : ['string', '<goodieLanguage>']
                    }]
                  }]
                }]
              }]
            }]
          };
          // Compute the result
          var _computed = schema.analyzeDescriptor(_objectDescriptor);

          should(_computed).eql(_expectedTreeDescriptor);
          done();
        });

        it('should validate a custom join : object', () => {
          var _objectDescriptor = {
            id    : ['<<id>>'],
            total : ['sum', '@elements.cost']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, join_elements : [] })).eql([]);
        });

        it('should validate a custom join : array', () => {
          var _objectDescriptor = [{
            id    : ['<<id>>'],
            total : ['sum', '@elements.cost']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, join_elements : [] })).eql([]);
        });

        it('should validate a join : array', () => {
          var _objectDescriptor = [{
            id       : ['<<id>>'],
            total    : ['sum', 'elements.cost'],
            elements : ['@elements']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, elements : [] })).eql([]);
        });

        it('should validate a join : object', () => {
          var _objectDescriptor = {
            id       : ['<<id>>'],
            total    : ['sum', 'elements.cost'],
            elements : ['@elements']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, elements : [] })).eql([]);
        });

        it('should validate a join : object', () => {
          var _objectDescriptor = {
            id       : ['<<id>>'],
            elements : ['@elements'],
            total    : ['sum', 'elements.cost']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, elements : [] })).eql([]);
        });

        it('should validate a join : array', () => {
          var _objectDescriptor = [{
            id       : ['<<id>>'],
            elements : ['@elements'],
            total    : ['sum', 'elements.cost']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2, elements : [] })).eql([]);
        });

        it('should validate a custom join : object && undefined', () => {
          var _objectDescriptor = {
            id    : ['<<id>>'],
            total : ['sum', '@elements.cost']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

        it('should validate a custom join : array && undefined', () => {
          var _objectDescriptor = [{
            id    : ['<<id>>'],
            total : ['sum', '@elements.cost']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

        it('should validate a join : array && undefined', () => {
          var _objectDescriptor = [{
            id       : ['<<id>>'],
            total    : ['sum', 'elements.cost'],
            elements : ['@elements']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

        it('should validate a join : object && undefined', () => {
          var _objectDescriptor = {
            id       : ['<<id>>'],
            total    : ['sum', 'elements.cost'],
            elements : ['@elements']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

        it('should validate a join : object && undefined', () => {
          var _objectDescriptor = {
            id       : ['<<id>>'],
            elements : ['@elements'],
            total    : ['sum', 'elements.cost']
          };
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

        it('should validate a join : array && undefined', () => {
          var _objectDescriptor = [{
            id       : ['<<id>>'],
            elements : ['@elements'],
            total    : ['sum', 'elements.cost']
          }];
          var _schema = schema.analyzeDescriptor(_objectDescriptor);
          var _validateFunction = validate.buildValidateFunction(_schema.compilation);

          should(_validateFunction({ id : 2, total : 2 })).eql([]);
        });

      }); /* end describe test */
    });


    describe('getConditionCode(varName, params)', () => {
      it('', () => {
        /**
         *
         * @return {object} An object which is used by the method validate
         */
      });
      describe('tests', () => {

        it('should return the condition which test if it is an int', function (done) {
          var _expectedTreeDescriptor = {
            testStr      : 'typeof(myVariable) === "number" && myVariable % 1 === 0 && !isNaN(myVariable)',
            errorMessage : '${must be an integer}'
          };
          var _computed = validate.getConditionCode('myVariable', ['int']);
          should(_computed).eql(_expectedTreeDescriptor);
          done();
        });

        it('should return the condition which test if it is an array', function (done) {
          var _expectedTreeDescriptor = {
            testStr      : 'myVariable instanceof Array',
            errorMessage : '${must be an array}'
          };
          var _computed = validate.getConditionCode('myVariable', ['array']);
          should(_computed).eql(_expectedTreeDescriptor);
          done();
        });

        it('should return the condition which test if it is an object', function (done) {
          var _expectedTreeDescriptor = {
            testStr      : '!(myVariable instanceof Array) && (myVariable instanceof Object) && (typeof myVariable !== "function")',
            errorMessage : '${must be an object}'
          };
          var _computed = validate.getConditionCode('myVariable', ['object']);
          should(_computed).eql(_expectedTreeDescriptor);
          done();
        });

        it('should return the condition which test if it is a string', function (done) {
          var _expectedTreeDescriptor = {
            testStr      : 'typeof(myVariable) === "string"',
            errorMessage : '${must be a string}'
          };
          var _computed = validate.getConditionCode('myVariable', ['string']);
          should(_computed).eql(_expectedTreeDescriptor);
          done();
        });

        it('should not modify the data passed in the fonction', function (done) {
          var _str   = 'myVariable';
          var _array = ['string'];
          validate.getConditionCode(_str, _array);
          should(_str).eql('myVariable');
          should(_array[0]).eql('string');
          done();
        });

      });
    });


    describe('getFieldName(path, attr)', () => {
      it('', () => {
        /**
         *
         * @return {string} a string
         */
      });
      describe('tests', () => {

        it('should return a string which represent the path in an object', () => {
          var _expected = 'info';
          var _path = [];
          should(validate.getFieldName(_path, 'info')).eql(_expected);
        });

        it('should return a string which represent the path in an object', () => {
          var _expected = 'info[temperature]';
          var _path = [{type : 'object', realObjName : 'info'}];
          should(validate.getFieldName(_path, 'temperature')).eql(_expected);
        });

        it('should return a string which represent the path in an object', () => {
          var _expected = 'info[][temperature]';
          var _path = [{type : 'array', realObjName : 'info'}];
          should(validate.getFieldName(_path, 'temperature')).eql(_expected);
        });

        it('should return a string which represent the path in an object', () => {
          var _expected = 'info[subobj][temperature]';
          var _path     = [{ type : 'object', realObjName : 'info'}, {type : 'object', realObjName : 'subobj'}];
          should(validate.getFieldName(_path, 'temperature')).eql(_expected);
        });

        it('should return a string which represent the path in an object', () => {
          var _expected = 'info[subobj][][temperature]';
          var _path = [{type : 'object', realObjName : 'info'}, {type : 'array', realObjName : 'subobj'}];
          should(validate.getFieldName(_path, 'temperature')).eql(_expected);
        });

      });
    });

  });
});
