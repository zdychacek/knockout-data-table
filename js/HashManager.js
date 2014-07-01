(function (Utils) {
  'use strict';

  var DiffType = {
    Created: 'created',
    Updated: 'updated',
    Deleted: 'deleted',
    Unchanged: 'unchanged'
  };

  function HashManager () {
    this._state = {};
    this._listeners = {};

    this._silentChangeLock = false;

    window.addEventListener('hashchange', function (e) {
      if (!this._silentChangeLock) {
        this._onHashChange(e.oldURL, e.newURL);
      }
    }.bind(this), false);
  }

  HashManager.prototype._serializeState = function (obj) {
    var fragBuffer = [];
    obj || (obj = this._state);

    for (var masterKey in obj) {
      var masterValue = obj[masterKey];

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
    this._onHashChange(document.location.href, document.location.href);
  }

  HashManager.prototype.registerKeyChange = function (key, cb) {
    this._listeners[key] = cb;
  }

  HashManager.prototype.set = function (path, val) {
    var pathParts = this._normalizePath(path);
    var oldState = Utils.clone(this._state);
    var newState = Utils.clone(this._state);
    var curr = null;

    for (var i = 0, l = pathParts.length - 1; i < l; i++) {
      var currPath = pathParts[i];

      curr = newState[currPath] = oldState[currPath] || {};
    }

    curr[pathParts.pop()] = val.toString();

    this.setHash(this._serializeState(newState));
  }

  HashManager.prototype.remove = function (path) {
    var pathParts = this._normalizePath(path);
    var newState = Utils.clone(this._state);
    var curr = null;

    for (var i = 0, l = pathParts.length - 1; i < l; i++) {
      var currPath = pathParts[i];

      curr = newState[currPath];

      if (typeof curr === 'undefined') {
        return null;
      }
    }

    var propToDelete = pathParts.pop();

    if (typeof curr[propToDelete] !== 'undefined') {
      delete curr[propToDelete];

      this.setHash(this._serializeState(newState));
    }
  }

  HashManager.prototype.get = function (path) {
    var pathParts = this._normalizePath(path);
    var curr = this._state;

    for (var i = 0, l = pathParts.length - 1; i < l; i++) {
      var currPath = pathParts[i];

      curr = this._state[currPath];

      if (typeof curr === 'undefined') {
        return null;
      }
    }

    return curr[pathParts.pop()];
  }

  HashManager.prototype._normalizePath = function (path) {
    if (Array.isArray(path)) {
      return path;
    }
    else {
      return path.split('.');
    }
  }

  HashManager.prototype.silentChange = function (hash) {
    if (hash[0] != '#') {
      hash = '#' + hash;
    }

    this._silentChangeLock = true;
    document.location.hash = hash;
    this._silentChangeLock = false;
  }

  HashManager.prototype.setHash = function (hash) {
    if (hash[0] != '#') {
      hash = '#' + hash;
    }

    document.location.hash = hash;
  }

  HashManager.prototype._onHashChange = function (oldUrl, newUrl) {
    var newUrl = this._parseHashFragmentFromUrl(newUrl);
    var oldUrl = this._parseHashFragmentFromUrl(oldUrl);
    var newState = this._parseFragment(newUrl);

    //setTimeout(this._triggerChanges.bind(this, this._state, newState), 0);
    this._triggerChanges(this._state, newState)
    this._state = newState;
  }

  HashManager.prototype._triggerChanges = function (oldState, newState) {
    var diff = this._compareStates(oldState, newState);

    for (var key in this._listeners) {
      if (this._listeners.hasOwnProperty(key)) {
        var changes = this._collectKeyChanges(key, diff);

        this._listeners[key](changes);
      }
    }
  }

  HashManager.prototype._collectKeyChanges = function (key, diff) {
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
        diff[key].key = key;
        changes.push(diff[key]);
      }
      else {
        for (var prop in obj) {
          if (Utils.isObject(obj[prop])) {
            traverse(obj, prop, change);
          }
          else {
            changes.push({
              key: prop,
              type: change,
              value: obj[prop]
            });
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
  // ->
  // #campaigns-list=status:active;order:name;direction:ASC&foo=28&bar=98
  HashManager.prototype._parseFragment = function (fragment) {
    if (!fragment) {
      return {};
    }

    var masterValues = fragment.split('&');
    var result = {};

    if (masterValues.length) {
      for (var i = 0, l = masterValues.length; i < l; i++) {
        var masterValue = masterValues[i];

        this._parseMasterValue(masterValue, result);
      }
    }
    else {
      console.log('Nothing to parse.');
    }

    return result;
  }

  HashManager.prototype._parseMasterValue = function (value, result) {
    var keyValuePair = value.split('=');
    var key = keyValuePair[0];

    if (keyValuePair.length == 2) {
      result[key] = this._parseSubValue(keyValuePair[1]);
    }
    else {
      console.log('No value assigned to key ' + key);
    }
  }

  HashManager.prototype._parseSubValue = function (value) {
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

  HashManager.prototype._compareStates = function (obj1, obj2) {
    if (Utils.isFunction(obj1) || Utils.isFunction(obj2)) {
      throw new Error('Invalid argument. Function given, object expected.');
    }

    if (Utils.isValue(obj1) || Utils.isValue(obj2)) {
      var diffType = null;
      var ret = {};

      if (obj1 === obj2) {
        diffType = DiffType.Unchanged;
        ret.value = obj1;
      }
      else if (typeof obj1 === 'undefined') {
        diffType = DiffType.Created;
        ret.value = obj2;
      }
      else if (typeof obj2 === 'undefined') {
        diffType = DiffType.Deleted;
        ret.oldValue = obj1;
      }
      else {
        diffType = DiffType.Updated;
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

      diff[key] = this._compareStates(obj1[key], value2);
    }

    for (var key in obj2) {
      if (Utils.isFunction(obj2[key]) || typeof diff[key] !== 'undefined') {
        continue;
      }

      diff[key] = this._compareStates(undefined, obj2[key]);
    }

    return diff;
  }

  HashManager.prototype._parseHashFragmentFromUrl = function (url) {
    var hashCharPos = url.indexOf('#');

    if (hashCharPos > -1) {
      return url.substring(hashCharPos + 1, url.length);
    }
    else {
      return '';
    }
  }

  HashManager.DiffType = DiffType;

  window.HashManager = new HashManager();
})(Utils);