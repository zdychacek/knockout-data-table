;(function(window) {

		'use strict';

		var bench;

		bench = new Bench({
			selectors: {
				activity: '.appActivity',
				lazy: '.appConfiguratorLazy',
				batch: '.appConfiguratorBatch',
				delay: '.appConfiguratorDelay',
				initial: '.appConfiguratorInitial',
				threshold: '.appConfiguratorThreshold',
				range: '.appPaginatorSelect',
				configuratorApply: '.appConfiguratorApply',
				columnSorterApply: '.appColumnSorterApply',
				logger: '.appLogger'
			},

			scenarios: [
				{
					range: 10
				},
				{
					range: 20
				},
				{
					range: 50
				},
				{
					range: 100
				},
				{
					range: 200
				},
				{
					range: 500
				},
				{
					batch: 20
				},
				{
					delay: 0
				},
				{
					lazy: false
				}
			]
		});

		window.bench = bench;

})(window);
