;(function(window, jQuery) {

	'use strict';

	var Bench;

	Bench = function(options) {
		this.selectors = options.selectors;
		this.scenarios = options.scenarios;

		this.times = {
			bootstrap: 1000,
			beginScenario: 500,
			endScenario: 500
		};

		this.currentScenario = null;

		this.detectAppBootstrap();
	};

	Bench.prototype.bindElements = function() {
		this.elements = {
			activity: jQuery(this.selectors.activity),
			lazy: jQuery(this.selectors.lazy),
			batch: jQuery(this.selectors.batch),
			delay: jQuery(this.selectors.delay),
			initial: jQuery(this.selectors.initial),
			threshold: jQuery(this.selectors.threshold),
			range: jQuery(this.selectors.range),
			configuratorApply: jQuery(this.selectors.configuratorApply),
			columnSorterApply: jQuery(this.selectors.columnSorterApply),
			logger: jQuery(this.selectors.logger)
		};
	};

	Bench.prototype.setLazy = function(value) {
		this.elements.lazy.prop('checked', value);
		if(value){
			this.log('zapinam lazy rendering');
		} else {
			this.log('vypinam lazy rendering');
		}
	};

	Bench.prototype.setBatch = function(value) {
		this.elements.batch.val(value);

		this.log('nastavuji velikost davky na '+value);
	};

	Bench.prototype.setDelay = function(value) {
		this.elements.delay.val(value);

		this.log('nastavuji prodlevu mezi renderingem davky na '+value);
	};

	Bench.prototype.setInitial = function(value) {
		this.elements.initial.val(value);

		this.log('nastavuji pocet radku na prvni dobrou na '+value);
	};

	Bench.prototype.setThreshold = function(value) {
		this.elements.threshold.val(value);

		this.log('nastavuji pocet radku, od kterych se zacne pouzivat lazy rendering na '+value);
	};

	Bench.prototype.setRange = function(value) {
		this.elements.range.val(value).trigger('change');

		this.log('nastavuji rozsah na '+value);
	};

	Bench.prototype.configuratorApply = function() {
		this.elements.configuratorApply.click();

		this.log('nastavuji konfiguraci');
	};

	Bench.prototype.columnSorterApply = function() {
		this.elements.columnSorterApply.click();

		this.log('ukladam sortovani sloupcu');
	};

	Bench.prototype.beginScenario = function() {
		if(!this.scenarios[this.currentScenario]) {
			this.onBenchEnd();
			return;
		}

		if(this.currentScenario === 0) {
			this.onBenchBegin();
		}

		window.setTimeout(function() {
			this.onScenarioBegin();
		}.bind(this), this.times.beginScenario);
	};

	Bench.prototype.detectAppBootstrap = function() {
		window.setTimeout(function() {
			if(jQuery(this.selectors.activity).length > 0 && !jQuery(this.selectors.activity).is(':visible')) {
				this.onAppBootstrap();
			} else {
				this.detectAppBootstrap();
			}
		}.bind(this), this.times.bootstrap);
	};

	Bench.prototype.detectScenarioEnd = function() {
		window.setTimeout(function() {
			if(!this.elements.activity.is(':visible')) {
				this.onScenarioEnd();
			} else {
				this.detectScenarioEnd();
			}
		}.bind(this), this.times.endScenario);
	};

	Bench.prototype.onAppBootstrap = function() {
		this.log('aplikace spustena');

		this.bindElements();

		this.currentScenario = 0;
		this.beginScenario();
	};

	Bench.prototype.onBenchBegin = function() {
		this.log('test zacal');
	};

	Bench.prototype.onBenchEnd = function() {
		this.log('test skoncil');

		this.log(this.elements.logger.find('li').text().trim().replace(/  /g, ' '));
	};

	Bench.prototype.onScenarioBegin = function() {
		var scenario;

		this.log('scenar '+this.currentScenario+' zacal');

		scenario = this.scenarios[this.currentScenario];

		if('range' in scenario) {
			this.setRange(scenario.range);
		} else {
			if('lazy' in scenario) {
				this.setLazy(scenario.lazy);
			}

			if('batch' in scenario) {
				this.setBatch(scenario.batch);
			}
			
			if('delay' in scenario) {
				this.setDelay(scenario.delay);
			}

			if('initial' in scenario) {
				this.setInitial(scenario.initial);
			}

			if('threshold' in scenario) {
				this.setTimeout(scenario.threshold);
			}

			this.configuratorApply();
		}

		this.detectScenarioEnd();
	};

	Bench.prototype.onScenarioEnd = function() {
		this.log('scenar '+this.currentScenario+' skoncil');

		this.currentScenario ++;
		this.beginScenario();
	};

	Bench.prototype.log = function(message) {
		window.console.log('[bench] '+message);
	};

	window.Bench = Bench;

})(window, jQuery);
