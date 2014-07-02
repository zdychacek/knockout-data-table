// TODO:
// - pouzivat hashbang !#, kvuli odskrolovani na element
// - vytahnout konfiguraci oddelovacu hodnot v ve fragmentu
// - pridat moznost registrace zmeny primo "podhodnoty", napr. "campaigns-list=itemsPerPage:50" (nyni je mozne se nahadnout jen na master hodnotu - "campaigns-list")
// - zrefaktorovat (hlavne parsovaci funkce)
// - podpora pro pole napr. campaigns-list=selectedIds:1,2,3
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
    this._oldUrl = '';

    window.addEventListener('hashchange', function (e) {
      this._onHashChange(this._oldUrl, document.location.href);
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
    this._oldUrl = document.location.href;
    this._onHashChange(document.location.href, document.location.href);
  }

  HashManager.prototype.registerStateChange = function (key, cb) {
    if (Utils.isFunction(cb)) {
      this._listeners[key] = cb;
    }
  }

  HashManager.prototype._setOneItem = function (path, val, silently, newState) {
    var pathParts = this._normalizePath(path);
    var curr = null;

    for (var i = 0, l = pathParts.length - 1; i < l; i++) {
      var currPath = pathParts[i];

      curr = newState[currPath] || (newState[currPath] = {});
    }

    curr[pathParts.pop()] = val.toString();
  }

  HashManager.prototype.set = function (paths, vals, silently) {
    var newState = Utils.clone(this._state);

    for (var i = 0, l = paths.length; i < l; i++) {
      this._setOneItem(paths[i], vals[i], !!silently, newState);
    }

    var hash = this._serializeState(newState);

    this.setHash(hash, silently);
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

  HashManager.prototype.setHash = function (hash, silent) {
    if (hash[0] != '#') {
      hash = '#' + hash;
    }

    this._silentChangeLock = !!silent;

    document.location.hash = hash;
  }

  HashManager.prototype._onHashChange = function (oldUrl, newUrl) {
    var newUrl = this._parseHashFragmentFromUrl(newUrl);
    var oldUrl = this._parseHashFragmentFromUrl(oldUrl);
    var newState = this._parseFragment(newUrl);

    if (!this._silentChangeLock) {
      // callbacky musi byt odpaleny po navratu z teto funkce, aby z nich bylo mozne pristupovat k novemu stavu
      setTimeout(this._triggerChanges.bind(this, this._state, newState), 0);
    }

    this._oldUrl = newUrl;

    this._silentChangeLock = false;
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

      if (!Utils.isObject(obj) && change != DiffType.Unchanged) {
        diff[key].key = key;
        changes.push(diff[key]);
      }
      else {
        for (var prop in obj) {
          if (Utils.isObject(obj[prop])) {
            traverse(obj, prop, change);
          }
          else if (change != DiffType.Unchanged) {
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
      return this._compareValues(obj1, obj2);
    }
    
    var diff = {};

    for (var key in obj1) {
      if (Utils.isFunction(obj1[key])) {
        continue;
      }
      
      var value2 = undefined;

      if ('undefined' != typeof obj2[key]) {
        value2 = obj2[key];
      }
      
      diff[key] = this._compareStates(obj1[key], value2);
    }

    for (var key in obj2) {
      if (Utils.isFunction(obj2[key]) || ('undefined' != typeof diff[key])) {
        continue;
      }
      
      diff[key] = this._compareStates(undefined, obj2[key]);
    }
    
    return diff;
  }

  HashManager.prototype._compareValues = function (value1, value2) {
    var ret = {};

    if (value1 === value2) {
      ret.type = DiffType.Unchanged;
      ret.value = value1;
    }
    else if ('undefined' == typeof(value1)) {
      ret.type = DiffType.Created;
      ret.value = value2;
    }
    else if ('undefined' == typeof(value2)) {
      ret.type = DiffType.Deleted;
      ret.value = value1;
    }
    else {
      ret.type = DiffType.Updated;
      ret.value = value2;
      ret.oldValue = value1;
    }

    return ret;
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

  HashManager.prototype.DiffType = DiffType;

  // je to jedinacek
  window.HashManager = new HashManager();
})(Utils);
