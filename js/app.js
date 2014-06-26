connector.on('remote', function (SklikApi) {
  'use strict';

  window.SklikApi = SklikApi;

  ko.applyBindings(new MainViewModel());
});
