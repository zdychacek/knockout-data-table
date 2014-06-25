connector.on('remote', function (sklikApi) {
  'use strict';

  var Direction = {
    ASC: 'SORT_ASC',
    DESC: 'SORT_DESC'
  };

  function TableViewModel (rowTemplateId, columnsConfig) {
    // pole nactenych dat pro jednu stranku
    this.items = [];

    // celkovy pocet zaznamu
    this.totalCount = 0;

    // seznam poctu zaznamu na stranku
    this.itemsPerCountList = [ 10, 20, 50, 100, 200, 500, 800, 1000];

    // aktualne na stranku
    this.itemsPerPage = 200;

    // cislo aktualni stranky
    this.currentPage = 1;

    // pager pages
    this.pager = [];

    // nazev sloupce, podle ktereho se tridi
    this.order = 'name';

    // smer razeni
    this.direction = Direction.ASC;

    // kongigurace sloupcu
    this.columnsConfig = columnsConfig;

    // docasna konfigurace
    this.tempColumnsConfig = clone(columnsConfig);

    // trackuj tento viewmodel
    ko.track(this);

    // id sablony pro jeden radek
    this.rowTemplateId = rowTemplateId;

    // kontejner pro sablonu (script tag)
    this.rowTemplateCnt = document.getElementById(rowTemplateId);

    // text sablony
    this.originalRowTemplate = this.rowTemplateCnt.innerHTML;

    // naveseni posluchacu
    this.attachSubscriptions();

    // nastavim prvni stranku
    this.setPage(1);

    // preskladani sloupcu
    this.reorderTemplate(this.columnsConfig);
  }

  TableViewModel.prototype.attachSubscriptions = function () {
    ko.getObservable(this, 'itemsPerPage').subscribe(function (newValue) {
      this.setPage();
    }.bind(this));

    ko.getObservable(this, 'columnsConfig').subscribe(function (newConfig) {
      this.reorderTemplate(newConfig);
    }.bind(this));
  }

  TableViewModel.prototype.sortColumns = function () {
    this.columnsConfig = this.tempColumnsConfig;
    this.tempColumnsConfig = clone(this.tempColumnsConfig);
  }

  TableViewModel.prototype.reorderTemplate = function (newConfig) {
    var src = document.createElement('tbody');
    var dest = document.createElement('tbody');

    src.innerHTML = this.originalRowTemplate;

    newConfig.forEach(function (item) {
      if (item.show) {
        var td = src.querySelector('td[data-col="' + item.columnId + '"]');

        dest.appendChild(td);
      }
    }, this);

    this.rowTemplateCnt.innerHTML = '<tr>' + dest.innerHTML + '</tr>';

    var itemsObservable = ko.getObservable(this, 'items');

    setTimeout(function() {
      console.time('Preskladani sloupcu');
      itemsObservable.refresh();
      console.timeEnd('Preskladani sloupcu');
    }, 0);
  }

  TableViewModel.prototype.getRangeForPage = function (page) {
    page = page || this.currentPage;

    return [ (page - 1) * this.itemsPerPage, this.itemsPerPage ];
  }

  TableViewModel.prototype.loadCampaigns = function (options) {
    sklikApi.getCampaigns(options, function (err, data) {
      this.totalCount = data.totalCount;
      this.items = data.campaigns.map(function (item) {
        return ko.track(item);
      });

      this.preparePager();
    }.bind(this));
  }

  TableViewModel.prototype.preparePager = function () {
    var pagesCount = Math.ceil(this.totalCount / this.itemsPerPage);

    this.pager.removeAll();

    for (var i = 1; i <= pagesCount; i++)  {
      this.pager.push(i) ;
    }
  }

  TableViewModel.prototype.setPage = function (pageNum) {
    pageNum || (pageNum = this.currentPage);

    var range = this.getRangeForPage(pageNum);

    this.currentPage = pageNum;

    this.loadCampaigns({
      order: this.order,
      direction: this.direction,
      offset: range[0],
      limit: range[1]
    });
  }

  TableViewModel.prototype.sortBy = function (newOrder) {
    if (newOrder != this.order) {
      this.order = newOrder;
      this.direction = Direction.ASC;
    }
    else {
      if (this.direction == Direction.ASC) {
        this.direction = Direction.DESC;
      }
      else {
        this.direction = Direction.ASC; 
      }
    }

    var range = this.getRangeForPage(1);

    this.loadCampaigns({
      order: this.order,
      direction: this.direction,
      offset: range[0],
      limit: range[1]
    });
  }

  /*{
     "id":1747,
     "name":"Kampaň č. 748",
     "status":"STATUS_ACTIVE",
     "budget":800,
     "clicks":344,
     "views":3638,
     "ctr":0.4000000059604645,
     "cpc":96,
     "price":369.20001220703125,
     "position":8.5
  }*/

  var columnsConfig = [
    {
      columnId: 'id',
      name: 'ID',
      show: false
    },
    {
      columnId: 'name',
      name: 'Kampaň',
      show: true
    },
    {
      columnId: 'status',
      name: 'Stav',
      show: true
    },
    {
      columnId: 'budget',
      name: 'Rozpočet',
      show: true
    },
    {
      columnId: 'clicks',
      name: 'Prokliky',
      show: true
    },
    {
      columnId: 'views',
      name: 'Zobrazení',
      show: true
    },
    {
      columnId: 'ctr',
      name: 'CTR',
      show: true
    },
    {
      columnId: 'cpc',
      name: 'CPC',
      show: true
    },
    {
      columnId: 'price',
      name: 'Cena',
      show: true
    },
    {
      columnId: 'position',
      name: 'Pozice',
      show: true
    }
  ];

  var tableViewModel = window.tableViewModel = new TableViewModel('tpl-row', columnsConfig);

  ko.applyBindings(tableViewModel);
});

// helpers
ko.observableArray.fn.refresh = function () {
  var data = this().slice(0);
  this([]);
  this(data);
};

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}