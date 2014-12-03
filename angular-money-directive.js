/**
 * Heavily adapted from the `type="number"` directive in Angular's
 * /src/ng/directive/input.js
 */

/**
 * wiwo:
 * - directive needs to allow users to input what looks like a number - 1,000
 * - strip everything that parseFloat doesn't accept
 *
 * parseFloat acceptable input: 0-9 + - .
 * all other characters stripped out, if nothing remains after stripping, then ng-invalid = true stop further processing
 * 
 * Directive use:
 * 
 * <input type="text"
 *        money="precision"           // defaults to 2
 *        [money-clamp="true|false"]  // defaults to "true"
 *        [min="{{expression}}"]      // defaults to Number.MAX_VALUE
 *        [max="{{expression}}"]      // defaults to 0 (if attribute specified).
 *                                    // Allows 'NEGATIVE_INFINITY' for no minimum value.
 *        >
 * 
 * With these configuration attributes:
 *  - min: 333
 *  - max: 9999
 * 
 * Results:
 * 
 *  input    |   clamped?   |    outcome     |   valid?   |
 * --------------------------------------------------------
 *  asdf     |    yes       |    333         |     yes
 *  asdf     |    no        |    undefined   |     no
 *  332      |    yes       |    333         |     yes
 *  332      |    no        |    undefined   |     no
 *  333      |    yes       |    333         |     yes
 *  1,000    |    yes       |    1000        |     yes
 *  10,000   |    yes       |    9999        |     yes
 *  10,000   |    no        |    undefined   |     no
 * 
 */
angular.module('fiestah.money', [])
    .directive('money', ['$filter', function ($filter) {
        'use strict';

        var NUMBER_REPLACE_REGEXP = /[^\d.+\-]/g;  // Keep numbers, delimiters and signs.
        //var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/;
        var NUMBER_REGEXP = /^\s*(\-|\+)?(\(?\d*\.?\d*\)?)?\s*$/; //allow . without numbers following

        function link(scope, el, attrs, ngModelCtrl) {
            var min = 0,     //wiwo: min can be dynamically set // parseFloat(attrs.min || 0);
                max = Number.MAX_VALUE,
                clampBounds = attrs['moneyClamp'] !== 'false';

            //wiwo: allow precison to be set to 0
            //var precision = parseFloat(attrs.precision || 2);
            var precision = parseInt(attrs.money, 10);
            if (isNaN(precision)){
                precision = 2;
            }

            var lastValidValue;


            //wiwo: global flag to allow original parsers to continue
            var continueParsing = true;

            function round(num) {
                var d = Math.pow(10, precision);
                return Math.round(num * d) / d;
            }

            //function formatPrecision(value) {
            //    return parseFloat(value).toFixed(precision);
            //}
            //wiwo: use ng number filter to get , in the formatter
            function formatPrecision(value) {
                return $filter('number')(value, precision);
            }

            function formatViewValue(value) {
                return ngModelCtrl.$isEmpty(value) ? '' : '' + value;
            }

            /**
             * wiwo - watch changes to min
             * @param newMin
             */
            function setMin(newMin){
                if (newMin == 'NEGATIVE_INFINITY'){
                    min = Number.NEGATIVE_INFINITY;
                } else {
                    min = parseFloat(newMin);
                    if (isNaN(min) || !isFinite(min)){
                        min = 0;
                    }
                }
            }
    
            /**
             * Set a valid max bound.
             * 
             * @param newMax
             */
            function setMax(newMax){
                max = parseFloat(newMax);
                if (isNaN(max) || !isFinite(max)){
                    max = Number.MAX_VALUE;
                }
            }

            if (attrs.hasOwnProperty('min')){
                // 2014-04-07 Coridyn:
                // Add watcher on the max validator.
                attrs.$observe('min', function(newMin){
                    setMin(newMin);
                    ngModelCtrl.$setViewValue(ngModelCtrl.$viewValue);
                });

                // Set the default minimum value.
                if (attrs.min){
                    setMin(attrs.min);
                }
            }
            // wiwo: end of min


            function stripNonNumeric(value) {
                NUMBER_REPLACE_REGEXP.lastIndex = 0;  // Reset lastIndex for IE.
                if (ngModelCtrl.$isEmpty(value)) {
                    return value;
                } else {
                    //+"" to be super sure it's a String
                    return (value+"").replace(NUMBER_REPLACE_REGEXP, '');
                }
            }

            /**
             * wiwo: check for any invalid number (after stripping non-numerics input is empty
             *
             * @param value
             * @returns {*}
             */
            function cleanAndCheckNumberValidity(value) {

                continueParsing = true;
                var stripped = stripNonNumeric(value);

                if (ngModelCtrl.$isEmpty(stripped) && !ngModelCtrl.$isEmpty(value)) {
                    //an invalid numeric input
                    continueParsing = false;
                    ngModelCtrl.$setValidity('number', false);

                    value = undefined;

                } else {

                    value = stripped;
                    ngModelCtrl.$setValidity('number', true);
                }
                return value;
            }

            ngModelCtrl.$parsers.push(cleanAndCheckNumberValidity);


            ngModelCtrl.$parsers.push(function (value) {

                //wiwo: fast fail back, our validity has already failed - but leave the displayed value alone
                if (!continueParsing) {
                    return value;
                }

                if (angular.isUndefined(value)) {
                    value = '';
                }

                // Handle leading decimal point, like ".5"
                if (value.indexOf('.') === 0) {
                    value = '0' + value;
                }

                // Allow "-" inputs only when min < 0
                //wiwo: this is the concern of min-validation, don't do this here
                //if (value.indexOf('-') === 0) {
                //    if (min >= 0) {
                //        value = null;
                //        ngModelCtrl.$setViewValue('');
                //        ngModelCtrl.$render();
                //    } else if (value === '-') {
                //        value = '';
                //    }
                //}

                var empty = ngModelCtrl.$isEmpty(value);
                if (empty || NUMBER_REGEXP.test(value)) {
                    lastValidValue = (value === '')
                        ? null
                        : (empty ? value : parseFloat(value));
                } else {
                    // Render the last valid input in the field
                    //ngModelCtrl.$setViewValue(formatViewValue(lastValidValue));
                    setModelValue(lastValidValue);
                }

                ngModelCtrl.$setValidity('number', true);
                return lastValidValue;
            });
            ngModelCtrl.$formatters.push(formatViewValue);

            var minValidator = function(value) {
                var newValue = value;
                var hasError = (ngModelCtrl.$isEmpty(value) || value < min);
                if (hasError){
                    if (clampBounds){
                        newValue = min;
                    } else {
                        ngModelCtrl.$setValidity('min', false);
                        newValue = undefined;
                    }
                } else {
                    ngModelCtrl.$setValidity('min', true);
                    newValue = value;
                }
                
                return newValue;
            };
            ngModelCtrl.$parsers.push(minValidator);
            ngModelCtrl.$formatters.push(minValidator);

            if (attrs.hasOwnProperty('max')) {
                setMax(attrs.max);

                //wiwo: observe max for dynamic updates
                attrs.$observe('max', function(newMax){
                    setMax(newMax);
                    ngModelCtrl.$setViewValue(ngModelCtrl.$viewValue);
                });

                var maxValidator = function(value) {
                    var newValue = value;
                    var hasError = ngModelCtrl.$isEmpty(value) || value > max;
                    if (hasError) {
                        if (clampBounds){
                            newValue = max;
                        } else {
                            ngModelCtrl.$setValidity('max', false);
                            newValue = undefined;
                        }
                    } else {
                        ngModelCtrl.$setValidity('max', true);
                        newValue = value;
                    }
                    return newValue;
                };

                ngModelCtrl.$parsers.push(maxValidator);
                ngModelCtrl.$formatters.push(maxValidator);
            }

            // Round off
            if (precision > -1) {
                ngModelCtrl.$parsers.push(function (value) {
                    return value ? round(value) : value;
                });
                ngModelCtrl.$formatters.push(function (value) {
                    return value ? formatPrecision(value) : value;
                });
            }

            el.bind('blur', function () {
                // Force the new model value.
                var value = ngModelCtrl.$modelValue;
                setModelValue(value);

                //if (value) {
                //    ngModelCtrl.$viewValue = formatPrecision(value);
                //    ngModelCtrl.$render();
                //}
            });


            function setModelValue(value){
                // wiwo: 2013-11-01 Coridyn:
                // Run through all of the formatters.
                if (value){
                    for (var i = 0, formatters = ngModelCtrl.$formatters, len = formatters.length; i < len; i++){
                        value = formatters[i](value);
                    }
                    ngModelCtrl.$viewValue = value;
                    ngModelCtrl.$render();
                }
            }
        }

        return {
            restrict: 'A',
            require: 'ngModel',
            link: link
        };
    }]
);
