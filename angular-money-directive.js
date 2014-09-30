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
 *
 * input        outcome
 * asdf         number invalid
 * 1,000        valid, number = 1000
 *
 *
 *
 */
angular.module('fiestah.money', [])
    .directive('money', ['$filter', function ($filter) {
        'use strict';

        var NUMBER_REPLACE_REGEXP = /[^\d.+\-]/g;  // Keep numbers, delimiters and signs.
        //var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/;
        var NUMBER_REGEXP = /^\s*(\-|\+)?(\(?\d*\.?\d*\)?)?\s*$/; //allow . without numbers following

        function link(scope, el, attrs, ngModelCtrl) {
            var min = 0; //wiwo: min can be dynamically set // parseFloat(attrs.min || 0);

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
                    min = parseFloat(newMin) || 0;
                }
            }

            if (attrs.min){
                // 2014-04-07 Coridyn:
                // Add watcher on the max validator.
                attrs.$observe('min', function(newMin){
                    setMin(newMin);
                    ngModelCtrl.$setViewValue(ngModelCtrl.$viewValue);
                });

                // Set the default minimum value.
                setMin(attrs.min);
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
                    ngModelCtrl.$setViewValue(formatViewValue(lastValidValue));
                    ngModelCtrl.$render();
                }

                ngModelCtrl.$setValidity('number', true);
                return lastValidValue;
            });
            ngModelCtrl.$formatters.push(formatViewValue);

            var minValidator = function(value) {
                if (!ngModelCtrl.$isEmpty(value) && value < min) {
                    ngModelCtrl.$setValidity('min', false);
                    return undefined;
                } else {
                    ngModelCtrl.$setValidity('min', true);
                    return value;
                }
            };
            ngModelCtrl.$parsers.push(minValidator);
            ngModelCtrl.$formatters.push(minValidator);

            if (attrs.max) {
                var max = parseFloat(attrs.max);

                //wiwo: observe max for dynamic updates
                attrs.$observe('max', function(newMax){
                    max = parseFloat(newMax);
                    ngModelCtrl.$setViewValue(ngModelCtrl.$viewValue);
                });

                var maxValidator = function(value) {
                    if (!ngModelCtrl.$isEmpty(value) && value > max) {
                        ngModelCtrl.$setValidity('max', false);
                        return undefined;
                    } else {
                        ngModelCtrl.$setValidity('max', true);
                        return value;
                    }
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
                var value = ngModelCtrl.$modelValue;

                // wiwo: 2013-11-01 Coridyn:
                // Run through all of the formatters.
                if (value){
                    for (var i = 0, formatters = ngModelCtrl.$formatters, len = formatters.length; i < len; i++){
                        value = formatters[i](value);
                    }
                    ngModelCtrl.$viewValue = value;
                    ngModelCtrl.$render();
                }

                //if (value) {
                //    ngModelCtrl.$viewValue = formatPrecision(value);
                //    ngModelCtrl.$render();
                //}
            });
        }

        return {
            restrict: 'A',
            require: 'ngModel',
            link: link
        };
    }]
);
