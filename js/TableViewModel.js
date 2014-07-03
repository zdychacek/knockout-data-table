(function ($, Utils, HashManager) {
  'use strict';

  var Direction = TableViewModel.Direction = {
    ASC: 'SORT_ASC',
    DESC: 'SORT_DESC'
  };

  // defaultni konfigurace
  TableViewModel.defaults = {
    defaultDirection: Direction.ASC,
    itemsSelectionOn: true,
    lazyRendering: false,
    lazyRenderingBatchSize: 10,
    lazyRenderingBatchDelay: 100,
    lazyRenderingInitialCount: 30,
    lazyRenderingThreshold: 100
  };

  // seznam idecek instanci
  TableViewModel.instanceIds = [];

  /**
   * .ctor
   */
  function TableViewModel (config) {
    if (!config) {
      throw new Error('Missing configuration data.');
    }

    // pole nactenych dat pro jednu stranku
    this.items = [];

    // pole zaznamu, ktere zobrazujeme
    this.itemsBuffer = [];

    // celkovy pocet zaznamu
    this.totalCount = 0;

    // data pro souctove radky
    this.sums = [];

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
    this.tempColumnsConfig = Utils.clone(this.columnsConfig);

    // nazev sloupce, podle ktereho se tridi
    // bud z configu nebo se bere prvni sortovatelny
    this.order = config.defaultOrder || this._getFirstSortableColumn().id;

    // smer razeni
    this.direction = config.defaultDirection || this._getDefaults('defaultDirection');

    // priznak, zda je tabulka jiz cela dorenderovana
    this.isRendered = false;

    // priznak, zda jsou jiz nactena vsechna data
    this.isDataLoaded = false;

    // cache pro zkompilovane sablony
    this.compiledTemplatesCache = {};

    // zda zobrazovat checkboxy pro vyber polozek
    this.itemsSelectionOn = typeof config.itemsSelectionOn !== 'undefined' ? config.itemsSelectionOn : this._getDefaults('itemsSelectionOn');

    // ----------- LAZY RENDERING STUFF

    // mae zapnuty lazyloading?
    this.lazyRendering = config.lazyRendering || this._getDefaults('lazyRendering');

    // pocet radku vykreslovanych v ramci jedne davky
    this.lazyRenderingBatchSize = config.lazyRenderingBatchSize || this._getDefaults('lazyRenderingBatchSize');

    // prodlevy pred vykreslenim dalsi davky
    this.lazyRenderingBatchDelay = typeof config.lazyRenderingBatchDelay !== 'undefined'?
      config.lazyRenderingBatchDelay : this._getDefaults('lazyRenderingBatchDelay');

    // pocet radku vyrendrovanych na prvni dobrou
    this.lazyRenderingInitialCount = config.lazyRenderingInitialCount || this._getDefaults('lazyRenderingInitialCount');

    // pokud je povoleno postupne renderovani, tak se zacne skutecne renderovat postupne az pri pozadavku na zobrazeni tohoto poctu dat
    this.lazyRenderingThreshold = config.lazyRenderingThreshold || this._getDefaults('lazyRenderingThreshold');

    // DEBUG:
    this.eventLog = [];

    this.tempConfig = {
      lazyRendering: this.lazyRendering,
      lazyRenderingBatchSize: this.lazyRenderingBatchSize,
      lazyRenderingBatchDelay: this.lazyRenderingBatchDelay,
      lazyRenderingInitialCount: this.lazyRenderingInitialCount,
      lazyRenderingThreshold: this.lazyRenderingThreshold
    };

    ko.track(this.tempConfig);

    // trackuj tento viewmodel
    ko.track(this);

    // id instance - kvuli reakci na hashchange
    this.tableId = config.id;

    // defaultni nastaveni
    this.defaultDirection = this.direction;
    this.defaultOrder = this.order;

    if (!this.tableId || TableViewModel.instanceIds.indexOf(this.tableId) > -1) {
      throw new Error('Missing table component id.');
    }
    else {
      TableViewModel.instanceIds.push(this.tableId);
    }

    // reference na underlying observable
    this.itemsBufferObservable = ko.getObservable(this, 'itemsBuffer');

    this.renderBatchTimer = null;

    // definice computed vlastnosti
    this._defineComputeds();

    // priprava sablon
    this._prepareTemplates(config);

    // preskladani sloupcu
    this._reorderRowTemplate(this.columnsConfig);

    // zaregistrovani zmeny hashe
    HashManager.registerStateChange(this.tableId, this.onHashStateChange.bind(this));
  }

  TableViewModel.prototype._defineComputeds = function () {
    // stavova informace o nacitani dat a rendrovani
    ko.defineProperty(this, 'systemStatus', function () {
      if (!this.isDataLoaded) {
        return 'Loading data...';
      }
      else if (!this.isRendered) {
        return 'Rendering data...';
      }
    }, this);

    // vraci sloupce, ktere se maji zobrazit
    ko.defineProperty(this, 'visibleColumns', function () {
      return this.columnsConfig.filter(function (col) {
        return col.show;
      });
    }, this);

    // vraci data do sablony souctove radky tabulky
    ko.defineProperty(this, 'sumRowsForTeplate', function () {
      return this.sums.map(function (sumRow, index) {
        // pokud mam vice souctovych radku ale mene sablon, tak na zbyvajici pouziji prvni sablonu
        var tplIndex = this.sumRowsTemplatesIds.length > index? index : 0;

        // pridam informaci o indexu
        sumRow.$index = index;

        return {
          template: this.sumRowsTemplatesIds[tplIndex],
          data: sumRow
        };
      }, this);
    }, this);
  }

  TableViewModel.prototype.setItemsPerPage = function (value) {
    this.setHashState('itemsPerPage', value);
  }

  TableViewModel.prototype._prepareTemplates = function (config) {
    // sablona pro radky tabulky
    this.rowTemplateId = config.rowTemplateId;
    this._compileTemplate(this.rowTemplateId);

    // sablony pro souctove radky
    this.sumRowsTemplatesIds = config.sumRowsTemplatesIds;

    if (!Array.isArray(config.sumRowsTemplatesIds)) {
      this.sumRowsTemplatesIds = [ config.sumRowsTemplatesIds ];
    }

    this.sumRowsTemplatesIds.forEach(this._compileTemplate, this);
  }

  TableViewModel.prototype._getDefaults = function (key) {
    if (key) {
      return this.constructor.defaults[key];
    }
    else {
      return this.constructor.defaults;
    }
  }

  TableViewModel.prototype._clearRenderBatchTimout = function () {
    if (this.renderBatchTimer) {
      clearTimeout(this.renderBatchTimer);
      this.renderBatchTimer = null;
    }
  }

  TableViewModel.prototype.selectAllItems = function () {
    var allSelected = this.allItemsSelected;

    this.itemsBuffer.forEach(function (item) {
      item.$isSelected = !allSelected;
    });

    return true;
  }

  TableViewModel.prototype._getFirstSortableColumn = function () {
    return this.columnsConfig.filter(function (item) {
      return item.sortable;
    })[0];
  }

  TableViewModel.prototype.sortColumns = function () {
    this.isRendered = false;

    this._clearRenderBatchTimout();

    // at se pred akci stihne nadechnout UI
    setTimeout(function () {
      this.tsRendering = new Date();

      // pred preskladanim sloupcu oriznu mnozinu dat
      var firstItems = this.itemsBuffer.slice(0, this.lazyRenderingInitialCount);
      this.items = this.itemsBuffer.slice(this.lazyRenderingInitialCount, this.itemsBuffer.length - 1);
      this.itemsBuffer = firstItems;

      this.columnsConfig = this.tempColumnsConfig;
      this.tempColumnsConfig = Utils.clone(this.tempColumnsConfig);

      this._reorderRowTemplate(this.columnsConfig);

      // force rerenderingu
      ko.getObservable(this, 'itemsBuffer').refresh();
      ko.getObservable(this, 'sums').refresh();

      if (!this.lazyRendering) {
        this.isRendered = true;
        this.logEvent('Rendering of ' + this.items.length + ' items', new Date() - this.tsRendering);
      }

      // po preskladani dorenderuji zbytek
      this._renderBatch();
    }.bind(this), 0);
  }

  TableViewModel.prototype._compileTemplate = function (tplId) {
    var tplEl = document.getElementById(tplId);
    var cnt = document.createElement('tbody');
    // odstraneni mezer bilych znaku mezi tagy, at se nevytvari zbytecne nody
    $(cnt).html((tplEl.innerHTML || tplEl.text)
      .replace(/(\r\n|\n|\r)/gm, '')
      .replace(/\>[\t ]+\</g, '><'));

    if (this.compiledTemplatesCache[tplId]) {
      return this.compiledTemplatesCache[tplId];
    }

    if (cnt.children.length > 1 || cnt.children[0].tagName.toLowerCase() !== 'tr') {
      throw new Error('Template must contain only one <tr> root element.');
    }

    this.compiledTemplatesCache[tplId] = cnt;

    return cnt;
  }

  TableViewModel.prototype._reorderRowTemplate = function (columnsConfig) {    
    for (var tplId in this.compiledTemplatesCache) {
      var src = this.compiledTemplatesCache[tplId].cloneNode(true);
      var dest = document.createElement('tbody');
      var rowEl = src.children[0].cloneNode();

      if (this.itemsSelectionOn) {
        var selectionEl = src.querySelector('td[data-col="selection"]');

        rowEl.appendChild(selectionEl);
      }

      columnsConfig.forEach(function (col) {
        if (col.show) {
          rowEl.appendChild(src.querySelector('td[data-col="' + col.id + '"]'));
        }
      });

      dest.appendChild(rowEl);

      var container = document.getElementById(tplId);

      // nastavim text nove sablony
      container.text = $(dest).html();
    }
  }

  TableViewModel.prototype._getRangeForPage = function (page, itemsPerPage) {
    itemsPerPage || (itemsPerPage = this.itemsPerPage);

    return [ (page - 1) * itemsPerPage, itemsPerPage ];
  }

  TableViewModel.prototype.loadCampaigns = function (options) {
    this.isDataLoaded = false;
    // zrusim oznaceni vsech polozek
    this.allItemsSelected = false;

    var tsLoading = new Date();

    this._clearRenderBatchTimout();

    // pozadavek na API
    SklikApi.getCampaigns(options, function (err, data) {
      // DEBUG
      this.logEvent('Loading of ' + data.campaigns.length + ' items', new Date() - tsLoading);

      this.isRendered = false;
      this.isDataLoaded = true;

      this.totalCount = data.totalCount;
      this.items = data.campaigns.map(function (item) {
        // pridani zvlastni property
        item.$isSelected = false;

        // trackovani zmen na objektu (muze byt vnorena struktura)
        return ko.deepTrack(item);
      });

      // data pro souctove radky
      this.sums = [];

      for (var prop in data) {
        if (data.hasOwnProperty(prop) && prop.indexOf('sum') == 0) {
          this.sums.push(data[prop]);
        }
      }

      // lazy rendering
      if (this.lazyRendering && this.items.length > this.lazyRenderingThreshold) {
        this.tsRendering = new Date();

        this.itemsBuffer = this.items.splice(0, this.lazyRenderingInitialCount);

        // pokud jsme prave nezobrazili vse, tak zacneme rendrovat po davkach
        if (this.items.length) {
          this.batchRenderingTime = 0;
          this._renderBatch();
        }
      }
      // pokud nerendrujeme lazy, tak do bufferu hodim vsechny zaznamy
      else {
        this.tsRendering = new Date();

        this.itemsBuffer = this.items;
        // DEBUG
        this.logEvent('Rendering of ' + data.campaigns.length + ' items', new Date() - this.tsRendering);
        this.items = [];
        // tabulka je vyrenderovana zaraz
        this.isRendered = true;
      }

      // priprav data pro vykresleni pageru
      this._preparePager();
    }.bind(this));
  }

  TableViewModel.prototype._renderBatch = function () {
    this.renderBatchTimer = setTimeout(function() {
      var batchItems = this.items.splice(0, this.lazyRenderingBatchSize);

      // vyrendrovani dalsi davky
      Array.prototype.push.apply(this.itemsBuffer, batchItems);
      this.itemsBufferObservable.valueHasMutated();

      if (this.items.length) {
        this._renderBatch();
      }
      else {
        // tabulka je cela vyrendrovana
        this.isRendered = true;
        this.logEvent('Rendering of ' + this.itemsBuffer.length + ' items', new Date() - this.tsRendering);
      }
    }.bind(this), this.lazyRenderingBatchDelay);
  }

  TableViewModel.prototype._preparePager = function () {
    var pagesCount = this.getTotalPagesCount();

    this.pager.removeAll();

    for (var i = 1; i <= pagesCount; i++)  {
      this.pager.push(i) ;
    }
  }

  TableViewModel.prototype.getTotalPagesCount = function () {
    return Math.ceil(this.totalCount / this.itemsPerPage);
  }

  TableViewModel.prototype.setPage = function (pageNum, force) {
    this.setHashState('page', pageNum);
  }

  TableViewModel.prototype.sortBy = function (newOrder) {
    var order = this.order;
    var direction = Direction.ASC;

    if (newOrder != this.order) {
      order = newOrder;
    }
    else {
      if (this.direction == Direction.ASC) {
        direction = Direction.DESC;
      }
      else {
        direction = Direction.ASC;
      }
    }

    // TODO:
    HashManager.set([ [this.tableId, 'order'], [this.tableId, 'direction'] ], [ order, direction ]);
  }

  TableViewModel.prototype.getSelectedItems = function () {
    return this.itemsBuffer.filter(function (item) {
      return item.$isSelected;
    });
  }

  TableViewModel.prototype.logEvent = function (msg, timeInMs) {
    this.eventLog.push('<strong>' + (timeInMs / 1000) + 's:</strong> ' + msg);
  }

  TableViewModel.prototype.setNewConfig = function (config) {
    var tempConfig = this.tempConfig;

    for (var item in tempConfig) {
      if (tempConfig.hasOwnProperty(item)) {
        this[item] = tempConfig[item];
      }
    }

    this.reload();
  }

  TableViewModel.prototype.reload = function () {
    var range = this._getRangeForPage(this.currentPage);

    this.loadCampaigns({
      order: this.order,
      direction: this.direction,
      offset: range[0],
      limit: range[1]
    });
  }

  TableViewModel.prototype.setHashState = function (key, value, silent) {
    HashManager.set([ [this.tableId, key] ], [value], silent);
  }

  TableViewModel.prototype.onHashStateChange = function (changes) {
    var pageValue = changes.page && changes.page.value;
    var itemsPerPageValue = changes.itemsPerPage && changes.itemsPerPage.value;
    var orderValue = changes.order && changes.order.value;
    var directionValue = changes.direction && changes.direction.value;

    console.log('TableViewModel#onHashStateChange:', changes);

    if (pageValue) {
      if (changes.page.type == 'deleted') {
        this.currentPage = 1;
      }
      else {
        this.currentPage = pageValue;
      }
    }
    
    if (itemsPerPageValue) {
      this.itemsPerPage = itemsPerPageValue;

      if (pageValue) {
        this.currentPage = pageValue;
      }
      else {
        this.currentPage = 1;
        this.setHashState('page', 1, true);
      }
    }

    if (orderValue) {
      if (changes.order.type == 'deleted') {
        this.order = this.defaultOrder;
      }
      else {
        this.order = orderValue;
      }
    }

    if (directionValue) {
      if (changes.direction.type == 'deleted') {
        this.direction = this.defaultDirection;
      }
      else {
        this.direction = directionValue;
      }
    }

    var range = this._getRangeForPage(this.currentPage);

    var params = {
      order: this.order,
      direction: this.direction,
      offset: range[0],
      limit: range[1]
    };

    this.loadCampaigns(params);
  }

  // export
  window.TableViewModel = TableViewModel;
})(jQuery, Utils, HashManager);