connector.on('remote', function (SklikApi) {
  'use strict';

  var Direction = {
    ASC: 'SORT_ASC',
    DESC: 'SORT_DESC'
  };

  // defaultni konfigurace
  TableViewModel.defaults = {
    defaultDirection: Direction.ASC,
    lazyRendering: false,
    cellTemplatePrefix: 'tpl-cell-',
    itemsSelectionOn: true,
    tplSelectionCol: '<td><input data-bind="checked: item.$isSelected" type="checkbox"/></td>',
    lazyRenderingBatchSize: 10,
    lazyRenderingBatchDelay: 70,
    lazyRenderingInitialCount: 40,
    lazyRenderingThreshold: 200
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
    this.itemsPerCountList = [ 10, 20, 50, 100, 200, 500, 800, 1000 ];

    // aktualne na stranku
    this.itemsPerPage = config.defaultItemsPerPage || this.itemsPerCountList[0];

    // priznak, zda jsou vybrany vsechny zaznamy v tabulce
    this.allItemsSelected = false;

    // cislo aktualni stranky
    this.currentPage = 1;

    // pager pages
    this.pager = [];

    // kongigurace sloupcu
    this.columnsConfig = config.columnsConfig;

    // docasna konfigurace
    this.tempColumnsConfig = clone(this.columnsConfig);

    // nazev sloupce, podle ktereho se tridi
    // bud z configu nebo se bere prvni sortovatelny
    this.order = config.defaultOrder || this.getFirstSortableColumn().id;

    // smer razeni
    this.direction = config.defaultDirection || defaults.defaultDirection;

    // priznak, zda je tabulka jiz cela dorenderovana
    this.isRendered = false;

    // priznak, zda jsou jiz nactena vsechna data
    this.isDataLoaded = false;

    // trackuj tento viewmodel
    ko.track(this);

    // mapovani id sloupcu na sablonky
    this.cellsTemplatesMap = {};

    // reference na underlying observable
    this.itemsBufferObservable = ko.getObservable(this, 'itemsBuffer');

    // unikatni id sablony radku
    this.rowTemplateId = 'tpl-table-' + (new Date().getTime());
    
    // kontejner pro sablonu radku
    this.rowTemplateCnt = this.createRowTemplateCnt(this.rowTemplateId);

    // text sablony
    this.originalRowTemplate = this.rowTemplateCnt.innerHTML;

    // zda zobrazovat checkboxy pro vyber polozek
    this.itemsSelectionOn = typeof config.itemsSelectionOn !== 'undefined' ? config.itemsSelectionOn : defaults.itemsSelectionOn;

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

    // pokud je povoleno postupne renderovani, tak se zacne skutecne renderovat postupne az pri pozadavku na zobrazeni tohoto poctu dat
    this.lazyRenderingThreshold = config.lazyRenderingThreshold || defaults.lazyRenderingThreshold;

    // stavova informace o nacitani dat a rendrovani
    ko.defineProperty(this, 'systemStatus', function () {
      if (!this.isDataLoaded) {
        return 'Loading data...';
      }
      else if (!this.isRendered) {
        return 'Rendering data...';
      }
    }, this);

    ko.defineProperty(this, 'visibleColumns', function () {
      return this.columnsConfig.filter(function (col) {
        return col.show;
      });
    }, this);

    // naveseni posluchacu
    this.attachSubscriptions();

    // namapovani idecek sloupcu na sablonky bunek
    this.mapColumnsTemplates(this.columnsConfig);

    // nastavim prvni stranku
    this.setPage(1);

    // preskladani sloupcu
    this.reorderTemplate(this.columnsConfig);
  }

  TableViewModel.prototype.createRowTemplateCnt = function (tplId) {
    var scriptTag = document.createElement('script');

    scriptTag.id = tplId;
    scriptTag.type = 'text/html';

    return document.body.appendChild(scriptTag);
  }

  TableViewModel.prototype.mapColumnsTemplates = function (columnsConfig) {
    var tplPrefix = TableViewModel.defaults.cellTemplatePrefix;

    columnsConfig.forEach(function (col) {
      var tplId = col.templateId || tplPrefix + col.id;
      var tpl = document.getElementById(tplId);

      if (!tpl) {
        throw new Error('Missing template for column "' + col.id + '".');
      }

      this.cellsTemplatesMap[col.id] = tpl;
    }, this);
  }

  TableViewModel.prototype.selectAllItems = function () {
    var allSelected = this.allItemsSelected;

    this.itemsBuffer.forEach(function (item) {
      item.$isSelected = !allSelected;
    });

    return true;
  }

  TableViewModel.prototype.getFirstSortableColumn = function () {
    return this.columnsConfig.filter(function (item) {
      return item.sortable;
    })[0];
  }

  TableViewModel.prototype.attachSubscriptions = function () {
    ko.getObservable(this, 'itemsPerPage').subscribe(function () {
      this.setPage(1);
    }.bind(this));
  }

  TableViewModel.prototype.sortColumns = function () {
    this.isRendered = false;

    // at se pred akci stihne nadechnout UI
    setTimeout(function () {
      // pred preskladanim sloupcu oriznu mnozinu dat
      var firstItems = this.itemsBuffer.slice(0, this.lazyRenderingInitialCount);
      this.items = this.itemsBuffer.slice(this.lazyRenderingInitialCount, this.itemsBuffer.length - 1);
      this.itemsBuffer = firstItems;

      this.columnsConfig = this.tempColumnsConfig;
      this.tempColumnsConfig = clone(this.tempColumnsConfig);

      this.reorderTemplate(this.columnsConfig);

      // force rerenderingu
      ko.getObservable(this, 'itemsBuffer').refresh();

      if (!this.lazyRendering) {
        this.isRendered = true;
      }

      // po preskladani dorenderuji zbytek
      this.renderBatch();
    }.bind(this), 0);
  }

  TableViewModel.prototype.reorderTemplate = function (newConfig) {
    var strBuilder = ['<tr>'];

    if (this.itemsSelectionOn) {
      strBuilder.push(TableViewModel.defaults.tplSelectionCol);
    }

    newConfig.forEach(function (item) {
      if (item.show) {
        var cellTpl = this.cellsTemplatesMap[item.id];

        strBuilder.push(cellTpl.innerHTML);
      }
    }, this);

    strBuilder.push('</tr>');

    this.rowTemplateCnt.innerHTML = strBuilder.join('');
  }

  TableViewModel.prototype.getRangeForPage = function (page) {
    page = page || this.currentPage;

    return [ (page - 1) * this.itemsPerPage, this.itemsPerPage ];
  }

  TableViewModel.prototype.loadCampaigns = function (options) {
    this.isDataLoaded = false;
    // zrusim oznaceni vsech polozek
    this.allItemsSelected = false;

    // pozadavek na API
    SklikApi.getCampaigns(options, function (err, data) {
      this.isRendered = false;

      this.totalCount = data.totalCount;
      this.items = data.campaigns.map(function (item) {
        // pridani zvlastni property
        item.$isSelected = false;

        // trackovani zmen na objektu
        return ko.track(item);
      });

      this.isDataLoaded = true;

      // lazy rendering
      if (this.lazyRendering && this.items.length > this.lazyRenderingThreshold) {
        this.itemsBuffer = this.shiftItemsFromArray(this.items, this.lazyRenderingInitialCount);

        // pokud jsme prave nezobrazili vse, tak zacneme rendrovat po davkach
        if (this.items.length) {
          this.renderBatch();
        }
      }
      // pokud nerendrujeme lazy, tak do bufferu hodim vsechny zaznamy
      else {
        this.itemsBuffer = this.items;
        // tabulka je vyrenderovana zaraz
        this.isRendered = true;
      }

      // priprav data pro vykresleni pageru
      this.preparePager();
    }.bind(this));
  }

  TableViewModel.prototype.renderBatch = function () {
    setTimeout(function () {
      //console.time('b');

      var batchItems = this.shiftItemsFromArray(this.items, this.lazyRenderingBatchSize);

      // vyrendrovani dalsi davky
      Array.prototype.push.apply(this.itemsBuffer, batchItems);
      this.itemsBufferObservable.valueHasMutated();

      //console.timeEnd('b');

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

  TableViewModel.prototype.getSelectedItems = function () {
    return this.itemsBuffer.filter(function (item) {
      return item.$isSelected;
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
      id: 'name',
      name: 'Kampaň',
      show: true,
      sortable: true
    },
    {
      id: 'status',
      name: 'Stav',
      show: true,
      sortable: true
    },
    {
      id: 'budget',
      name: 'Rozpočet',
      show: true,
      sortable: true
    },
    {
      id: 'clicks',
      name: 'Prokliky',
      show: true,
      sortable: true
    },
    {
      id: 'views',
      name: 'Zobrazení',
      show: true,
      sortable: true
    },
    {
      id: 'ctr',
      name: 'CTR',
      show: true,
      sortable: true
    },
    {
      id: 'cpc',
      name: 'CPC',
      show: true,
      sortable: true
    },
    {
      id: 'price',
      name: 'Cena',
      show: true,
      sortable: true
    },
    {
      id: 'position',
      name: 'Pozice',
      show: true,
      sortable: true
    }
  ];

  var tableViewModel = window.tableViewModel = new TableViewModel({
    columnsConfig: columnsConfig,
    //defaultOrder: 'price',
    itemsSelectionOn: true,
    defaultItemsPerPage: 500,
    defaultDirection: Direction.ASC,
    lazyRendering: true
  });

  // nabindovani na document.body
  ko.applyBindings(tableViewModel);
});