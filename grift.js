'use strict';

class Grift {
	/**
	 * Create a new `Grift` container.
	 * @param {Object.<string, any>} [in_context]
	 */
	constructor(in_context) {
		if (! in_context) in_context = {};

		/** @type {Function[]} */
		this.steps = [];

		/** @type {Function[]} */
		this.rb_steps = [];

		this.txn_context = {};
		this.last_result = null;

		this.txn_start_time = 0;
		this.txn_run_time = null;

		this.yays = [];
		this.nays = [];

		this.abort_triggered = false;
		this.executing = false;
		
		this.result = null;
		this.resolver = null;

		// mix in in_context and prefix keys with '$' to distinguish them
		// from step output.
		for (var k in in_context) {
			var ck = `$${k}`;
			this.txn_context[ck] = in_context[k];
		}
	}

	/**
	 * Erases container
	 * @return {Grift}
	 */
	reset() {
		this.steps = [];
		this.rb_steps = [];

		this.txn_context = {};
		this.yays = [];
		this.nays = [];

		this.result = this.resolver = null;
		this.abort_triggered = false;
		this.executing = false;

		return this;
	}

	/**
	 * Adds a step to the transaction stack, tagged with `tag`. 
	 * The `pfunc` Function when called (with the context object as its 
	 * sole argument) _should_ return a Promise -- any other value will be
	 * treated as a resolved Promise.
	 * The optional `rfunc` Function is the code that should trigger,
	 * in the event the step needs to be "rolled back". If returns a
	 * `Promise`, it will wait for it to complete until moving on to
	 * the next step.
	 * 
	 * Cannot be ran if the transaction has started executing.
	 * @param {string} tag 
	 * @param {Function<Promise>} pfunc
	 * @param {Function} [rfunc]
	 * @return {Grift}
	 */
	add(tag, pfunc, rfunc) {
		if (this.executing) return this;

		// no-op rollback function
		if (! rfunc) rfunc = function() {};

		this.steps.push([tag, pfunc, rfunc]);

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
	 * @return {Promise<Grift>}
	 */
	execute() {
		// don't execute again.. like Promises, Grifts are immutable
		if (this.result !== null || this.executing) return Promise.resolve(this);

		if (this.steps.length == 0) {
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

			_nextStep.apply(this);
			
			return p;
		}
	}

	/**
	 * Trigger the stack to abort after the completion of the
	 * currently running step, if any. Returns `true` if the
	 * stack was still abort-able, otherwise it will return
	 * `false`.
	 * @return {boolean}
	 */
	abort() {
		if (! this.executing) return false;
		else if (! this.steps.length) return false;

		this.abort_triggered = true;
		return true;
	}

	/**
	 * Returns any results from the step marked `tag`
	 * @param {string} tag
	 * @return {any}
	 */
	resultsFrom(tag) {
		if (tag.match(/^\$/)) return null;
		return this.txn_context[tag];
	}

	/**
	 * Returns an object w/ all the step results.
	 * @return {Object.<string, any>}
	 */
	resultsAll() {
		var ret = {};

		for (var k in this.txn_context) {
			if (k.match(/^\$/)) continue;
			ret[k] = this.txn_context[k];
		}

		return ret;
	}

	/**
	 * Evaluate if the step `tag` was a success.
	 * @param {string} tag 
	 * @return {boolean}
	 */
	stepSucceeded(tag) {
		var succ = false;
		this.yays.forEach((v) => {
			if (v == tag) succ = true;
		});

		return succ;
	}

	/**
	 * Evaluate if the step `tag` failed.
	 * @param {string} tag 
	 * @return {boolean}
	 */
	stepFailed(tag) {
		var fail = false;

		this.nays.forEach((v) => {
			if (v[0] == tag) fail = true;
		});

		return fail;
	}

	/**
	 * Evaluate if the step `tag` was skipped (due to an earlier failure or `abort()` call)
	 * @param {string} tag 
	 * @return {boolean}
	 */
	stepSkipped(tag) {
		return this.stepSucceeded(tag) === false && this.stepFailed(tag) === false;
	}

	/**
	 * Returns any error output from step `tag`
	 * @param {string} tag 
	 * @return {any}
	 */
	errorFrom(tag) {
		var msg = null;
		this.nays.forEach((v) => {
			if (v[0] == tag) msg = v[1];
		});

		return msg;
	}

	/**
	 * Returns an object containing the error output from
	 * every step.
	 * @return {Object.<string, any>}
	 */
	errorsAll() {
		var errs = {};

		this.nays.forEach((v) => {
			errs[ v[0] ] = v[1];
		});

		return errs;
	}

	/**
	 * Was the Grift ultimately successful?
	 * @return {boolean}
	 */
	success() {
		return this.result === true;
	}

	/**
	 * Was the Grift ultimately a failure?
	 * @return {boolean}
	 */	
	failed() {
		return this.result === false;
	}
}

/**
 * PRIVATE METHODS
 */
function _nextStep() {
	if (this.abort_triggered || (this.nays.length > 0)) {
		// stop everything!
		_rollback.apply(this);
		return;
	}

	if (this.steps.length == 0) {
		_complete.apply(this);
		return;
	}	

	var prm = this.steps.shift();
	var tag = prm[0];
	var pfunc = prm[1];
	var rfunc = prm[2];

	var p = pfunc(this.last_result, this.txn_context);

	if (! (p instanceof Promise)) {
		// something went wrong here..
		_markStepFailed.apply(this, [tag, "Initializer did not return a Promise"]);
		setTimeout(() => { _nextStep.apply(this); }, 1);
	} else {
		// handle our promise result information
		p.then((res) => {
			_markStepSuccess.apply(this, [tag, res]);
			this.rb_steps.push(rfunc);
			setTimeout(() => { _nextStep.apply(this); }, 1);
		}, (err) => {
			_markStepFailed.apply(this, [tag, err]);
			setTimeout(() => { _nextStep.apply(this); }, 1);
		});
	}
}

function _rollback() {
	if (this.rb_steps.length == 0) {
		_complete.apply(this);
	} else {
		this.rb_steps.reverse();

		var rb = Promise.resolve(true);

		for (var rbfunc of this.rb_steps) {
			rb = rb.then(
				(function(rbf, ctx) {
					return function() { return rbf(ctx); };
				})(rbfunc, this.txn_context)
			);
		}

		rb.then(() => {
			_complete.apply(this);
		});
	}
}

function _complete() {
	this.executing = false;
	
	this.txn_run_time = Date.now() - this.txn_start_time;

	this.result = this.nays.length == 0;
	this.resolver(this);
}

function _markStepFailed(tag, msg) {
	this.nays.push([
		tag, msg
	]);
}

function _markStepSuccess(tag, res) {
	this.txn_context[tag] = res;
	this.last_result = res;
	this.yays.push(tag);
}

module.exports = Grift;