connector.on('remote', function (SklikApi) {
  'use strict';

  window.SklikApi = SklikApi;

  function loadTemplates (tplsList, callback) {
    var requestsCount = tplsList.length;
    var processed = 0;
    var docFrag = document.createDocumentFragment();

    tplsList.forEach(function (tpl) {
      $.get('/tpls/' + tpl, function (data) {
        var tplContainer = document.createElement('script');

        tplContainer.id = tpl.replace('.html', '');
        tplContainer.type = 'text/html';
        tplContainer.innerHTML = data;

        docFrag.appendChild(tplContainer);

        if (++processed == requestsCount) {
          document.body.appendChild(docFrag);
          callback();
        }
      });
    });
  }

  function bootstrapApp () {
    window.tableViewModel = new TableViewModel({
      id: 'campaigns-list',
      rowTemplateId: 'tpl-table-row',
      sumRowsTemplatesIds: 'tpl-table-sum-row',
      //defaultOrder: 'price',
      itemsSelectionOn: true,
      defaultItemsPerPage: 500,
      defaultDirection: TableViewModel.Direction.ASC,
      lazyRendering: true,
      columnsConfig: [
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
          sortable: false
        }
      ]
    });

    // nabindovani na document.body
    ko.applyBindings(tableViewModel);

    HashManager.init();
  }

  // load templates and bootstrap app
  loadTemplates(['tpl-table-row.html', 'tpl-table-sum-row.html', 'tpl-pager.html'], bootstrapApp);
});