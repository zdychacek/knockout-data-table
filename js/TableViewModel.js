(function ($) {
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
    lazyRenderingBatchSize: 7,
    lazyRenderingBatchDelay: 250,
    lazyRenderingInitialCount: 25,
    lazyRenderingThreshold: 100
  };

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
    this.tempColumnsConfig = clone(this.columnsConfig);

    // nazev sloupce, podle ktereho se tridi
    // bud z configu nebo se bere prvni sortovatelny
    this.order = config.defaultOrder || this.getFirstSortableColumn().id;

    // smer razeni
    this.direction = config.defaultDirection || this.getDefaults('defaultDirection');

    // priznak, zda je tabulka jiz cela dorenderovana
    this.isRendered = false;

    // priznak, zda jsou jiz nactena vsechna data
    this.isDataLoaded = false;

    // cache pro zkompilovane sablony
    this.compiledTemplatesCache = {};
    
    // zda zobrazovat checkboxy pro vyber polozek
    this.itemsSelectionOn = typeof config.itemsSelectionOn !== 'undefined' ? config.itemsSelectionOn : this.getDefaults('itemsSelectionOn');

    // ----------- LAZY RENDERING STUFF
    
    // mae zapnuty lazyloading?
    this.lazyRendering = config.lazyRendering || this.getDefaults('lazyRendering');

    // pocet radku vykreslovanych v ramci jedne davky
    this.lazyRenderingBatchSize = config.lazyRenderingBatchSize || this.getDefaults('lazyRenderingBatchSize');

    // prodlevy pred vykreslenim dalsi davky
    this.lazyRenderingBatchDelay = typeof config.lazyRenderingBatchDelay !== 'undefined'?
      config.lazyRenderingBatchDelay : this.getDefaults('lazyRenderingBatchDelay');

    // pocet radku vyrendrovanych na prvni dobrou
    this.lazyRenderingInitialCount = config.lazyRenderingInitialCount || this.getDefaults('lazyRenderingInitialCount');

    // pokud je povoleno postupne renderovani, tak se zacne skutecne renderovat postupne az pri pozadavku na zobrazeni tohoto poctu dat
    this.lazyRenderingThreshold = config.lazyRenderingThreshold || this.getDefaults('lazyRenderingThreshold');

    // DEBUG: 
    this.eventLog = [];

    // mereni renderingu jedne davky
    this.batchRenderingTime = 0;

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

    // reference na underlying observable
    this.itemsBufferObservable = ko.getObservable(this, 'itemsBuffer');

    // definice computed vlastnosti
    this.defineComputeds();

    // naveseni posluchacu
    this.attachSubscriptions();

    // nastavim prvni stranku
    this.setPage(1);

    // priprava sablon
    this.prepareTemplates(config);

    // preskladani sloupcu
    this.reorderRowTemplate(this.columnsConfig);
  }

  TableViewModel.prototype.defineComputeds = function () {
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

  TableViewModel.prototype.prepareTemplates = function (config) {
    // sablona pro radky tabulky 
    this.rowTemplateId = config.rowTemplateId;
    this.compileTemplate(this.rowTemplateId);

    // sablony pro souctove radky
    this.sumRowsTemplatesIds = config.sumRowsTemplatesIds;

    if (!Array.isArray(config.sumRowsTemplatesIds)) {
      this.sumRowsTemplatesIds = [ config.sumRowsTemplatesIds ];
    }

    this.sumRowsTemplatesIds.forEach(this.compileTemplate, this);
  }

  TableViewModel.prototype.getDefaults = function (key) {
    if (key) {
      return this.constructor.defaults[key];
    }
    else {
      return this.constructor.defaults;
    }
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
      this.tsRendering = new Date();

      // pred preskladanim sloupcu oriznu mnozinu dat
      var firstItems = this.itemsBuffer.slice(0, this.lazyRenderingInitialCount);
      this.items = this.itemsBuffer.slice(this.lazyRenderingInitialCount, this.itemsBuffer.length - 1);
      this.itemsBuffer = firstItems;

      this.columnsConfig = this.tempColumnsConfig;
      this.tempColumnsConfig = clone(this.tempColumnsConfig);

      this.reorderRowTemplate(this.columnsConfig);

      // force rerenderingu
      ko.getObservable(this, 'itemsBuffer').refresh();
      ko.getObservable(this, 'sums').refresh();

      if (!this.lazyRendering) {
        this.isRendered = true;
        this.logEvent('Rendering of ' + this.items.length + ' items', new Date() - this.tsRendering);
      }

      // po preskladani dorenderuji zbytek
      this.renderBatch();
    }.bind(this), 0);
  }

  TableViewModel.prototype.compileTemplate = function (tplId) {
    var tplEl = document.getElementById(tplId);
    var cnt = document.createElement('tbody');
    cnt.innerHTML = tplEl.innerHTML;

    if (this.compiledTemplatesCache[tplId]) {
      return this.compiledTemplatesCache[tplId];
    }

    if (cnt.children.length > 1 || cnt.children[0].tagName.toLowerCase() !== 'tr') {
      throw new Error('Template must contain only one <tr> root element.');
    }

    this.compiledTemplatesCache[tplId] = cnt;

    return cnt;
  }

  TableViewModel.prototype.reorderRowTemplate = function (columnsConfig) {
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
      container.innerHTML = dest.innerHTML;
    }
  }

  TableViewModel.prototype.getRangeForPage = function (page) {
    page = page || this.currentPage;

    return [ (page - 1) * this.itemsPerPage, this.itemsPerPage ];
  }

  TableViewModel.prototype.loadCampaigns = function (options) {
    this.isDataLoaded = false;
    // zrusim oznaceni vsech polozek
    this.allItemsSelected = false;

    var tsLoading = new Date();

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

      this.tsRendering = new Date();

      // lazy rendering
      if (this.lazyRendering && this.items.length > this.lazyRenderingThreshold) {
        this.itemsBuffer = this.shiftItemsFromArray(this.items, this.lazyRenderingInitialCount);

        // pokud jsme prave nezobrazili vse, tak zacneme rendrovat po davkach
        if (this.items.length) {
          this.batchRenderingTime = 0;
          this.renderBatch();
        }
      }
      // pokud nerendrujeme lazy, tak do bufferu hodim vsechny zaznamy
      else {
        this.itemsBuffer = this.items;
        // DEBUG
        this.logEvent('Rendering of ' + data.campaigns.length + ' items', new Date() - this.tsRendering);
        this.items = [];
        // tabulka je vyrenderovana zaraz
        this.isRendered = true;
      }

      // priprav data pro vykresleni pageru
      this.preparePager();
    }.bind(this));
  }

  TableViewModel.prototype.renderBatch = function () {
    /*setTimeout(function() {
        if (!this.batchRenderingTime) {
          var start = new Date();
        }

        var batchItems = this.shiftItemsFromArray(this.items, this.lazyRenderingBatchSize);

        // vyrendrovani dalsi davky
        Array.prototype.push.apply(this.itemsBuffer, batchItems);
        this.itemsBufferObservable.valueHasMutated();

        if (!this.batchRenderingTime) {
          this.batchRenderingTime = new Date() - start;

          this.logEvent('1 batch rendering', this.batchRenderingTime);
          this.logEvent('UI idleness', this.lazyRenderingBatchDelay - this.batchRenderingTime);
        }

        this.rfaCurrCounter = 0;
      //}

      if (this.items.length) {
        this.renderBatch();
      }
      else {
        // tabulka je cela vyrendrovana
        this.isRendered = true;
        this.logEvent('Rendering of ' + this.itemsBuffer.length + ' items', new Date() - this.tsRendering);
      }
    }.bind(this), this.lazyRenderingBatchDelay);*/
    
    requestAnimationFrame(function () {
      var batchItems = this.shiftItemsFromArray(this.items, this.lazyRenderingBatchSize);
      var start;

      if (!this.batchRenderingTime) {
        start = new Date();
      }

      // vyrendrovani dalsi davky
      Array.prototype.push.apply(this.itemsBuffer, batchItems);
      this.itemsBufferObservable.valueHasMutated();

      if (!this.batchRenderingTime) {
        this.batchRenderingTime = new Date() - start;

        this.logEvent('1 batch rendering', this.batchRenderingTime);
        this.logEvent('UI idleness', this.lazyRenderingBatchDelay - this.batchRenderingTime);
      }

      if (this.items.length) {
        this.renderBatch();
      }
      else {
        // tabulka je cela vyrendrovana
        this.isRendered = true;
        this.logEvent('Rendering of ' + this.itemsBuffer.length + ' items', new Date() - this.tsRendering);
      }
    }.bind(this));
  }

  TableViewModel.prototype.shiftItemsFromArray = function (arr, count) {
    return arr.splice(0, count);
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

  TableViewModel.prototype.logEvent = function (msg, timeInMs) {
    var message = '<strong>' + (timeInMs / 1000) + 's:</strong> ' + msg;

    this.eventLog.push(message);
  }

  TableViewModel.prototype.setNewConfig = function (config) {
    var tempConfig = this.tempConfig;

    for (var item in tempConfig) {
      if (tempConfig.hasOwnProperty(item)) {
        this[item] = tempConfig[item];
      }
    }

    this.setPage();

    /*
    lazyRendering: false,
    lazyRenderingBatchSize: 10,
    lazyRenderingBatchDelay: 70,
    lazyRenderingInitialCount: 40,
    lazyRenderingThreshold: 100
    */

    //debugger;
  }

  // export
  window.TableViewModel = TableViewModel;
})(jQuery);