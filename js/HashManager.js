(function (Utils) {
  'use strict';
  
  var DiffType = HashManager.DiffType = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    UNCHANGED: 'unchanged'
  } ;

  function HashManager () {
    this.state = {};
    this.listeners = {};

    this._silentChangeLock = false;

    window.addEventListener('hashchange', function (e) {
      if (!this._silentChangeLock) {
        this.onHashChange(e.oldURL, e.newURL);
      }
    }.bind(this), false);
  }

  HashManager.prototype.init = function () {
    this.onHashChange(document.location.href, document.location.href);
  }

  HashManager.prototype.registerKeyChange = function (key, cb) {
    this.listeners[key] = cb;
  }

  HashManager.prototype.setKey = function (key) {

  }

  HashManager.prototype.silentChange = function (hash) {
    if (hash[0] != '#') {
      hash = '#' + hash;
    }

    this._silentChangeLock = true;
    document.location.hash = hash;
    this._silentChangeLock = false;
  }

  HashManager.prototype.onHashChange = function (oldUrl, newUrl) {
    var newUrl = this.parseHashFragmentFromUrl(newUrl);
    var oldUrl = this.parseHashFragmentFromUrl(oldUrl);
    var newState = this.parseFragment(newUrl);

    var diff = this.compareStates(this.state, newState);

    //console.log(diff);

    this.triggerChanges(diff);
    
    //console.log('old:', this.state, 'new:', newState, 'diff:', diff);

    this.state = newState;
  }

  HashManager.prototype.triggerChanges = function (diff) {
    for (var key in this.listeners) {
      if (this.listeners.hasOwnProperty(key)) {
        var changes = this.collectKeyChanges(key, diff);

        this.listeners[key](changes);
      }
    }
  }

  // TODO: brutal refactoring
  // {"campaign-list":{"value":{"status":"noactive","order":"name"},"type":"created"}}
  HashManager.prototype.collectKeyChanges = function (key, diff) {
    var pathParts = key.split('.');
    var changes = [];

    (function traverse (currObj, key, change) {
      var obj = currObj[key];

      if (obj.type) {
        change = obj.type;
        obj = obj.value;
      }

      if (typeof obj !== 'object') {
        if (change !== 'unchanged') {
          currObj[key].key = key;
          changes.push(currObj[key]);
        }
      }
      else {
        for (var prop in obj) {
          if (typeof obj[prop] == 'object') {
            traverse(obj, prop, change);
          }
          else {
            if (change !== 'unchanged') {
              changes.push({
                key: prop,
                type: change,
                value: obj[prop]
              });
            }
          }
        }
      }
    })(diff, key);

    var map = {};

    changes.forEach(function (item) {
      map[item.key] = item;
      delete item.key;
    });

    return map;
  }

  // ?status=active&sorting.orderColumn=status&sorting.direction=ASC&dateSelect=week
  
  // #table1=status:active;order:name;direction:ASC&foo=28&bar=98
  HashManager.prototype.parseFragment = function (fragment) {
    if (!fragment) {
      return {};
    }

    var masterValues = fragment.split('&');
    var result = {};

    if (masterValues.length) {
      for (var i = 0, l = masterValues.length; i < l; i++) {
        var masterValue = masterValues[i];

        this.parseMasterValue(masterValue, result);
      }
    }
    else {
      console.log('Nothing to parse.');
    }

    return result;
  }

  HashManager.prototype.parseMasterValue = function (value, result) {
    var keyValuePair = value.split('=');
    var key = keyValuePair[0];

    if (keyValuePair.length == 2) {

      result[key] = this.parseSubValue(keyValuePair[1]);
    }
    else {
      console.log('No value assigned to key ' + key);
    }
  }

  HashManager.prototype.parseSubValue = function (value) {
    if (value.indexOf(';') > -1) {
      var values = value.split(';');
      var ret = {};

      for (var i = 0, l = values.length; i < l; i++) {
        var keyValuePair = values[i].split(':');

        var key = keyValuePair[0];
        var value = keyValuePair[1];

        if (keyValuePair.length == 2) {
          ret[key] = keyValuePair[1];
        }
      }

      return ret;
    }
    else {
      var keyValuePair = value.split(':');

      if (keyValuePair.length == 1) {
        return keyValuePair[0];
      }
      else {
        var ret = {};
        var key = keyValuePair[0];
        var value = keyValuePair[1];

        if (keyValuePair.length == 2) {
          ret[key] = keyValuePair[1];
        }

        return ret;
      }
    }
  }

  HashManager.prototype.compareStates = function (obj1, obj2) {
    if (Utils.isFunction(obj1) || Utils.isFunction(obj2)) {
      throw new Error('Invalid argument. Function given, object expected.');
    }

    if (Utils.isValue(obj1) || Utils.isValue(obj2)) {
      var diffType = null;
      var ret = {};

      if (obj1 === obj2) {
        diffType = DiffType.UNCHANGED;
        ret.value = obj1;
        //return obj1;
      }
      else if (typeof obj1 === 'undefined') {
        diffType = DiffType.CREATED;
        ret.value = obj2;
      }
      else if (typeof obj2 === 'undefined') {
        diffType = DiffType.DELETED;
        ret.oldValue = obj1;
      }
      else {
        diffType = DiffType.UPDATED;
        ret.oldValue = obj1;
        ret.newValue = obj2;
      }

      ret.type = diffType;

      return ret;
    }
    
    var diff = {};

    for (var key in obj1) {
      if (Utils.isFunction(obj1[key])) {
        continue;
      }
      
      var value2 = undefined;

      if ('undefined' != typeof(obj2[key])) {
        value2 = obj2[key];
      }
      
      diff[key] = this.compareStates(obj1[key], value2);
    }
    for (var key in obj2) {
      if (Utils.isFunction(obj2[key]) || ('undefined' != typeof diff[key])) {
        continue;
      }
      
      diff[key] = this.compareStates(undefined, obj2[key]);
    }
    
    return diff;
  }

  HashManager.prototype.parseHashFragmentFromUrl = function (url) {
    var hashCharPos = url.indexOf('#');

    if (hashCharPos > -1) {
      return url.substring(hashCharPos + 1, url.length);
    }
    else {
      return '';
    }
  }

  window.HashManager = new HashManager();
})(Utils);