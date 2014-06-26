 (function (ko) {
  'use strict';

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
  function MainViewModel () {
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

    this.config = {
      columnsConfig: columnsConfig,
      rowTemplateId: 'tpl-table-row',
      sumRowsTemplatesIds: 'tpl-table-sum-row',
      defaultOrder: 'price',
      itemsSelectionOn: true,
      defaultItemsPerPage: 100,
      defaultDirection: 'SORT_ASC',
      lazyRendering: true
    }
  }

  window.MainViewModel = MainViewModel;
})(ko);
