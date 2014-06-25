connector.on('remote', function (sklikApi) {
  'use strict';

  var Direction = {
    ASC: 'SORT_ASC',
    DESC: 'SORT_DESC'
  };

  TableViewModel.defaults = {
    lazyRendering: false,
    lazyRenderingBatchSize: 10,
    lazyRenderingBatchDelay: 25,
    lazyRenderingInitialCount: 40
  };

  function TableViewModel (config) {
    if (!config) {
      throw new Error('Missing configuration data.');
    }

    // vychozi nastaveni
    var defaults = TableViewModel.defaults;

    // pole nactenych dat pro jednu stranku
    this.items = [];

    // pole zaznamu, ktere zobrazujeme
    this.itemsBuffer = [];

    // celkovy pocet zaznamu
    this.totalCount = 0;

    // seznam poctu zaznamu na stranku
    this.itemsPerCountList = [ 10, 20, 50, 100, 200, 500, 800, 1000];

    // aktualne na stranku
    this.itemsPerPage = 500;

    // cislo aktualni stranky
    this.currentPage = 1;

    // pager pages
    this.pager = [];

    // nazev sloupce, podle ktereho se tridi
    this.order = 'name';

    // smer razeni
    this.direction = Direction.ASC;

    // kongigurace sloupcu
    this.columnsConfig = config.columnsConfig;

    // docasna konfigurace
    this.tempColumnsConfig = clone(this.columnsConfig);

    // priznak, zda je tabulka jiz cela dorenderovana
    this.isRendered = false;

    // priznak, zda jsou jiz nactena vsechna data
    this.isDataLoaded = false;

    // trackuj tento viewmodel
    ko.track(this);

    // id sablony pro jeden radek
    this.rowTemplateId = config.rowTemplateId;

    // kontejner pro sablonu (script tag)
    this.rowTemplateCnt = document.getElementById(this.rowTemplateId);

    // text sablony
    this.originalRowTemplate = this.rowTemplateCnt.innerHTML;

    // ----------- LAZY RENDERING STUFF
    
    // mae zapnuty lazyloading?
    this.lazyRendering = config.lazyRendering || defaults.lazyRendering;

    // pocet radku vykreslovanych v ramci jedne davky
    this.lazyRenderingBatchSize = config.lazyRenderingBatchSize || defaults.lazyRenderingBatchSize;

    // prodlevy pred vykreslenim dalsi davky
    this.lazyRenderingBatchDelay = typeof config.lazyRenderingBatchDelay !== 'undefined'?
      config.lazyRenderingBatchDelay : defaults.lazyRenderingBatchDelay;

    // pocet radku vyrendrovanych na prvni dobrou
    this.lazyRenderingInitialCount = config.lazyRenderingInitialCount || defaults.lazyRenderingInitialCount;

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
    // pred preskladanim sloupcu oriznu mnozni dat
    var temp = this.itemsBuffer.slice(0, this.lazyRenderingInitialCount);
    this.items = this.itemsBuffer.slice(this.lazyRenderingInitialCount, this.itemsBuffer.length - 1);
    this.itemsBuffer = temp;

    this.columnsConfig = this.tempColumnsConfig;
    this.tempColumnsConfig = clone(this.tempColumnsConfig);

    // po preskladani dorenderuji zbytek
    this.renderBatch();
  }

  TableViewModel.prototype.reorderTemplate = function (newConfig) {
    var src = document.createElement('tbody');
    var dest = document.createElement('tbody');

    src.innerHTML = this.originalRowTemplate;

    newConfig.forEach(function (item) {
      if (item.show) {
        var td = src.querySelector('td[data-col="' + item.id + '"]');

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
    this.isDataLoaded = false;
    this.isRendered = false;

    sklikApi.getCampaigns(options, function (err, data) {
      this.totalCount = data.totalCount;
      this.items = data.campaigns.map(function (item) {
        return ko.track(item);
      });

      this.isDataLoaded = true;

      // pokud nerendrujeme lazy, tak do bufferu hodim vsechny zaznamy
      if (!this.lazyRendering) {
        this.itemsBuffer = this.items;
        // tabulka je vyrenderovana zaraz
        this.isRendered = true;
      }
      // lazy rendering
      else {
        this.itemsBuffer = this.shiftItemsFromArray(this.items, this.lazyRenderingInitialCount);

        // pokud jsme prave nezobrazili vse, tak zacneme rendrovat po davkach
        if (this.items.length) {
          this.renderBatch();
        }
      }

      // priprav data pro vykresleni pageru
      this.preparePager();
    }.bind(this));
  }

  TableViewModel.prototype.renderBatch = function () {
    setTimeout(function () {
      var batchItems = this.shiftItemsFromArray(this.items, this.lazyRenderingBatchDelay);

      // vyrendrovani dalsi davky
      batchItems.forEach(function (item) {
        this.itemsBuffer.push(item);
      }, this);

      //console.log('itemsBuffer:', this.itemsBuffer.length, 'items:', this.items.length);

      if (this.items.length) {
        this.renderBatch();
      }
      else {
        // tabulka je cela vyrendrovana
        this.isRendered = true;
      }
    }.bind(this), this.lazyRenderingBatchDelay);
  }

  TableViewModel.prototype.shiftItemsFromArray = function (arr, count) {
    var acc = [];

    while (count-- && arr.length > 0) {
      acc.push(arr.shift());
    }

    return acc;
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
      id: 'id',
      name: 'ID',
      show: false
    },
    {
      id: 'name',
      name: 'Kampaň',
      show: true
    },
    {
      id: 'status',
      name: 'Stav',
      show: true
    },
    {
      id: 'budget',
      name: 'Rozpočet',
      show: true
    },
    {
      id: 'clicks',
      name: 'Prokliky',
      show: true
    },
    {
      id: 'views',
      name: 'Zobrazení',
      show: true
    },
    {
      id: 'ctr',
      name: 'CTR',
      show: true
    },
    {
      id: 'cpc',
      name: 'CPC',
      show: true
    },
    {
      id: 'price',
      name: 'Cena',
      show: true
    },
    {
      id: 'position',
      name: 'Pozice',
      show: true
    }
  ];

  var tableViewModel = window.tableViewModel = new TableViewModel({
    rowTemplateId: 'tpl-row',
    columnsConfig: columnsConfig,
    lazyRendering: true
  });

  // nabindovani na document.body
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