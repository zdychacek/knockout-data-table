(function () {
  var toString = Object.prototype.toString;

  window.Utils = {
    clone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    isFunction: function(obj) {
      return toString.apply(obj) === '[object Function]';
    },

    isArray: function(obj) {
      return toString.apply(obj) === '[object Array]';
    },

    isObject: function(obj) {
      return toString.apply(obj) === '[object Object]';
    },
    
    isValue: function(obj) {
      return !this.isObject(obj) && !this.isArray(obj);
    }
  };
})();