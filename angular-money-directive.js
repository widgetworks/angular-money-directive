/**
 * Heavily adapted from the `type="number"` directive in Angular's
 * /src/ng/directive/input.js
 */

angular.module('fiestah.money', [])
.directive('money', function ($filter) {
  'use strict';
  
  var numberFilter = $filter('number');
  var NUMBER_REPLACE_REGEXP = /[^\d.+\-]/g;  // Keep numbers, delimiters and signs.
  // var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/;
  var NUMBER_REGEXP = /^\s*(\-|\+)?(\(?\d*\.?\d*\)?)?\s*$/;
  function isUndefined(value) {
    return typeof value == 'undefined';
  }
  function isEmpty(value) {
    return isUndefined(value) || value === '' || value === null || value !== value;
  }

  return {
    restrict: 'A',
    require: 'ngModel',
    link: function (scope, el, attr, ctrl) {
      // 2013-11-01 Coridyn:
      // TODO: Handle precision here - default to 2.
      function round(num, precision) { 
        if (typeof precision != 'number'){
          precision = 2;
        }
        var factor = Math.pow(10, precision);
        return Math.round(num * factor) / factor;
      }
      
      var min = 0;
      if (attr.min){
        if (attr.min == 'NEGATIVE_INFINITY'){
          min = Number.NEGATIVE_INFINITY;
        } else {
          min = parseFloat(attr.min) || 0;
        }
      }
      
      // TODO:
      //  - Don't clear the field if there are invalid characters.
      //  - Specify precision.
      //  - Format output numbers (e.g. with commas).
      var precision = parseInt(attr.money, 10);
      if (isNaN(precision)){
        precision = 2;
      }
      
      // 2013-11-01 Coridyn:
      // Strip invalid characters.
      ctrl.$parsers.push(function(value){
        NUMBER_REPLACE_REGEXP.lastIndex = 0;  // Reset lastIndex for IE.
        return value.replace(NUMBER_REPLACE_REGEXP, '');
      });
    
      // Returning NaN so that the formatter won't render invalid chars
      ctrl.$parsers.push(function(value) {

        // Allow "-" inputs only when min < 0
        if (value === '-') {
          ctrl.$setValidity('number', false);
          return (min < 0) ? -0 : NaN;
        }

        var empty = isEmpty(value);
        if (empty || NUMBER_REGEXP.test(value)) {
          ctrl.$setValidity('number', true);
          return value === '' ? null : (empty ? value : parseFloat(value));
        } else {
          ctrl.$setValidity('number', false);
          return NaN;
        }
      });
      ctrl.$formatters.push(function(value) {
        return isEmpty(value) ? '' : '' + value;
      });

      var minValidator = function(value) {
        if (!isEmpty(value) && value < min) {
          ctrl.$setValidity('min', false);
          return undefined;
        } else {
          ctrl.$setValidity('min', true);
          return value;
        }
      };
      ctrl.$parsers.push(minValidator);
      ctrl.$formatters.push(minValidator);

      if (attr.max) {
        var max = parseFloat(attr.max);
        var maxValidator = function(value) {
          if (!isEmpty(value) && value > max) {
            ctrl.$setValidity('max', false);
            return undefined;
          } else {
            ctrl.$setValidity('max', true);
            return value;
          }
        };

        ctrl.$parsers.push(maxValidator);
        ctrl.$formatters.push(maxValidator);
      }

      // Round off to 'precision' decimal places
      ctrl.$parsers.push(function (value) {
        return value ? round(value, precision) : value;
      });
      ctrl.$formatters.push(function (value) {
        return value ? numberFilter(value, precision) : value;
      });

      el.bind('blur', function () {
        var value = ctrl.$modelValue;
        
        // 2013-11-01 Coridyn:
        // Run through all of the formatters.
        if (value){
          for (var i = 0, formatters = ctrl.$formatters, len = formatters.length; i < len; i++){
            value = formatters[i](value);
          }
          ctrl.$viewValue = value;
          ctrl.$render();
        }
        
        // if (value) {
        //   ctrl.$viewValue = round(value, precision).toFixed(precision);
        //   ctrl.$render();
        // }
      });
    }
  };
});
