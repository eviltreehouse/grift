'use strict';

class PromiseTransaction {
	/**
	 * Create a new `PromiseTransaction`, optionally setting `fragile`
	 * to halt/abort if any Promises fail.
	 * @param {boolean} [fragile=true] 
	 */
	constructor(fragile) {
		/** @type {Function[]} */
		this.prms = [];
		this.txn_context = {};
		this.txn_start_time = 0;
		this.txn_run_time = null;

		this.yays = [];
		this.nays = [];


		this.fragile = fragile === true;
		this.abort_triggered = false;
		
		this.executing = false;
		this.result = null;

		this.resolver = null;
	}

	/**
	 * Adds a step to the transaction stack, tagged with `tag`. 
	 * The `pfunc` Function when called (with the context object as its 
	 * sole argument) MUST return a `Promise`.
	 * 
	 * Cannot be ran if the transaction has started executing.
	 * @param {string} tag 
	 * @param {Function<Promise>} pfunc
	 * @return {PromiseTransaction}
	 */
	add(tag, pfunc) {
		if (this.executing) return this;
		this.prms.push([tag, pfunc]);

		return this;
	}

	/**
	 * Returns the current runtime of the txn in ms. If
	 * the txn as completed, you will get the total runtime.
	 */
	runningTime() {
		if (! this.executing) return this.txn_run_time;
		else return Date.now() - this.txn_start_time;
	}

	/**
	 * Executes the promise "stack" and returns
	 * itself so the results can be interrogated.
	 * @return {Promise<PromiseTransaction>}
	 */
	execute() {
		// don't execute again.. like Promises this is immutable
		if (this.result !== null || this.executing) return Promise.resolve(this);
		if (this.prms.length == 0) {
			// nothing to do
			this.result = true;
			return Promise.resolve(this);
		} else {
			this.executing = true;
			this.txn_start_time = Date.now();

			// break out our resolver function to call
			// at a later time.
			var p = new Promise((resolve) => {
				this.resolver = resolve;
			});

			this._nextStep();
			
			return p;
		}
	}

	abort() {
		this.abort_triggered = true;
	}

	_nextStep() {
		if (this.prms.length == 0) {
			this._complete();
			return;
		}

		if (this.abort_triggered || (this.fragile && this.nays.length > 0)) {
			// stop everything!
			this._complete();
			return;
		}

		var prm = this.prms.shift();
		var tag = prm[0];
		var pfunc = prm[1];

		var p = pfunc(this.txn_context);
		if (! (p instanceof Promise)) {
			// something went wrong here..
			this._markStepFailed(tag, "Initializer did not return a Promise");
			setTimeout(() => { this._nextStep(); }, 1);
		} else {
			// handle our promise result information
			p.then((res) => {
				this._markStepSuccess(tag, res);
				setTimeout(() => { this._nextStep(); }, 1);
			}, (err) => {
				//this.txn_context[tag] = err;
				this._markStepFailed(tag, err);
				setTimeout(() => { this._nextStep(); }, 1);
			});
		}
	}

	_complete() {
		this.executing = false;
		
		this.txn_run_time = Date.now() - this.txn_start_time;

		if (this.fragile && this.nays.length > 0) {
			this.result = false;
		} else {
			this.result = true;
		}

		this.resolver(this);
	}

	_markStepFailed(tag, msg) {
		this.nays.push([
			tag, msg
		]);
	}

	_markStepSuccess(tag, res) {
		this.txn_context[tag] = res;
		this.yays.push(tag);
	}

	resultsFrom(tag) {
		return this.txn_context[tag];
	}

	allResults() {
		return this.txn_context;
	}

	didSucceed(tag) {
		var succ = false;
		this.yays.forEach((v) => {
			if (v == tag) succ = true;
		});

		return succ;
	}

	didFail(tag) {
		var fail = false;

		this.nays.forEach((v) => {
			if (v[0] == tag) fail = true;
		});

		return fail;
	}

	wasSkipped(tag) {
		return this.didSucceed(tag) === false && this.didFail(tag) === false;
	}

	errorFrom(tag) {
		var msg = null;
		this.nays.forEach((v) => {
			if (v[0] == tag) msg = v[1];
		});

		return msg;
	}

	allErrors() {
		var errs = [];
		this.nays.forEach((v) => {
			errs[ v[0] ] = v[1];
		});

		return errs;
	}

	success() {
		return this.result === true;
	}

	failed() {
		return this.result === false;
	}
}

module.exports = PromiseTransaction;