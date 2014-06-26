(function () {
  // helpers
  ko.observableArray.fn.refresh = function () {
    var data = this().slice(0);
    this([]);
    this(data);
  };

  // some exports and renaming
  ko.deepTrack = ko.es5.mapping.track;
  window.clone = clone;

  function clone (obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // shortcut
  var bindings = ko.bindingHandlers;

  // knockout bindings
  bindings.currency = {
    symbol: ko.observable('Kč'),

    update: function (element, valueAccessor, allBindingsAccessor) {
      return ko.bindingHandlers.html.update(element, function () {
        var value = +(ko.utils.unwrapObservable(valueAccessor()) || 0);
        // TODO: nastaveni symbolu pres binding param
        var symbol = bindings.currency.symbol();

        return value.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,") + '&nbsp;</span>' + symbol + '</span>';
      });
    }
  };

  bindings.percent = {
    update: function (element, valueAccessor, allBindingsAccessor) {
      return ko.bindingHandlers.html.update(element, function () {
        var value = +(ko.utils.unwrapObservable(valueAccessor()) || 0);

        return value.toFixed(2) + '&nbsp;<span>%</span>';
      });
    }
  };

  bindings.decimal = {
    decimalPlaces: 2,

    update: function(element, valueAccessor, allBindingsAccessor) {
      return ko.bindingHandlers.text.update(element, function () {
        var value = +(ko.utils.unwrapObservable(valueAccessor()) || 0);
        // TODO: nastaveni poctu desetinnych mist pres binding param
        var decimalPlaces = bindings.decimal.decimalPlaces;

        return value.toFixed(decimalPlaces);
      });
    }
  };

  bindings.toJSON = {
    update: function(element, valueAccessor){
      return ko.bindingHandlers.text.update(element,function () {
        return ko.toJSON(valueAccessor(), null, 2);
      });
    }
  };
})();