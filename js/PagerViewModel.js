(function () {
  function PagerViewModel (params) {
    this.pager = params.pager;
    this.table = params.table;
  }

  ko.components.register('sklik-pager', {
    viewModel: PagerViewModel,
    template:
    '<div class="col-md-12"> \
      <ul class="pagination" data-bind="foreach: pager"> \
        <li data-bind="css: { active: $data == $parent.table.currentPage }"> \
          <a href="#" data-bind="click: $parent.table.setPage.bind($parent.table, $data), text: $data"></a> \
        </li> \
      </ul> \
      <select data-bind="options: $parent.itemsPerCountList, value: $parent.itemsPerPage" class="items-per-page"></select> \
    </div>'
  });
})();
