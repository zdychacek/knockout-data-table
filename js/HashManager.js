(function () {
  'use strict';

  // ?status=active&sorting.orderColumn=status&sorting.direction=ASC&dateSelect=week
  // #table1=status:active;order:name;direction:ASC
  
  function HashManager () {
    this.hasMap = {};

    window.onHashChange = this.onHashChange.bind(this);
  }

  HashManager.prototype.onHashChange = function (e) {
    console.log(e);
  }

  window.HashManager = new HashManager();
})();