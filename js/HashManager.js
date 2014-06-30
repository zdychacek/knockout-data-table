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

  HashManager.prototype.serializeState = function () {
    var fragBuffer = [];

    for (var masterKey in this.state) {
      var masterValue = this.state[masterKey];

      if (Utils.isObject(masterValue)) {
        var subsBuffer = [];

        for (var subKey in masterValue) {
          var subValue = masterValue[subKey];

          subsBuffer.push(subKey + ':' + subValue);
        }

        fragBuffer.push(masterKey + '=' + subsBuffer.join(';'));
      }
      else {
        fragBuffer.push(masterKey + '=' + masterValue);
      }
    }

    return fragBuffer.join('&');
  }

  HashManager.prototype.init = function () {
    this.onHashChange(document.location.href, document.location.href);
  }

  HashManager.prototype.registerKeyChange = function (key, cb) {
    this.listeners[key] = cb;
  }

  HashManager.prototype.set = function (str, val) {


    this.silentChange(this.serializeState());
    //this.triggerChanges(oldState, this.state);
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

    this.triggerChanges(this.state, newState);

    this.state = newState;
  }

  HashManager.prototype.triggerChanges = function (oldState, newState) {
    var diff = this.compareStates(oldState, newState);

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

    (function traverse (diff, key, change) {
      var obj = diff[key];

      if (typeof obj === 'undefined') {
        return;
      }

      if (obj.type) {
        change = obj.type;
        obj = obj.value;
      }

      if (!Utils.isObject(obj)) {
        if (change !== DiffType.UNCHANGED) {
          diff[key].key = key;
          changes.push(diff[key]);
        }
      }
      else {
        for (var prop in obj) {
          if (Utils.isObject(obj[prop])) {
            traverse(obj, prop, change);
          }
          else {
            if (change !== DiffType.UNCHANGED) {
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

  // #campaigns-list=status:active;order:name;direction:ASC&foo=28&bar=98
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
    var ret = {};

    if (value.indexOf(';') > -1) {
      var values = value.split(';');

      for (var i = 0, l = values.length; i < l; i++) {
        var keyValuePair = values[i].split(':');
        var key = keyValuePair[0];
        var value = keyValuePair[1];

        if (keyValuePair.length == 2) {
          ret[key] = value;
        }
      }
    }
    else {
      var keyValuePair = value.split(':');

      if (keyValuePair.length == 1) {
        return keyValuePair[0];
      }
      else {
        var key = keyValuePair[0];
        var value = keyValuePair[1];

        if (keyValuePair.length == 2) {
          ret[key] = value;
        }

      }
    }

    return ret;
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
        ret.value = obj2;
        ret.oldValue = obj1;
      }

      ret.type = diffType;

      return ret;
    }

    var diff = {};

    for (var key in obj1) {
      if (Utils.isFunction(obj1[key])) {
        continue;
      }

      var value2;

      if (typeof obj2[key] !== 'undefined') {
        value2 = obj2[key];
      }

      diff[key] = this.compareStates(obj1[key], value2);
    }

    for (var key in obj2) {
      if (Utils.isFunction(obj2[key]) || typeof diff[key] !== 'undefined') {
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
