/*
 * player.js —— 步骤播放器。
 * 因为每一步都是完整快照，所以暂停 / 上一步 / 下一步 / 跳到结束都不用重新计算。
 */
(function (global) {
  'use strict';

  function noop() {}

  class StepPlayer {
    constructor(options) {
      const opts = options || {};
      this.steps = [];
      this.index = -1;
      this.duration = 700;
      this.timer = null;
      this.playing = false;
      this.done = false;

      this.onStep = opts.onStep || noop;
      this.onDone = opts.onDone || noop;
      this.onStateChange = opts.onStateChange || noop;
    }

    get total() {
      return this.steps.length;
    }

    get current() {
      return this.index >= 0 ? this.steps[this.index] : null;
    }

    state() {
      return {
        playing: this.playing,
        index: this.index,
        total: this.steps.length,
        done: this.done,
      };
    }

    setDuration(ms) {
      this.duration = Math.max(80, ms);
    }

    load(steps) {
      this.clearTimer();
      this.steps = steps || [];
      this.index = -1;
      this.playing = false;
      this.done = false;
      this.onStateChange(this.state());
    }

    stop() {
      this.load([]);
    }

    play() {
      if (this.playing || !this.steps.length) return;

      if (this.done) {
        this.done = false;
        // 停在最后一帧时再点播放 = 重播；从中间回看时点播放 = 继续往后播
        if (this.index >= this.steps.length - 1) this.index = -1;
      }

      this.playing = true;
      this.onStateChange(this.state());
      this.advance();
    }

    pause() {
      this.clearTimer();
      if (!this.playing) return;
      this.playing = false;
      this.onStateChange(this.state());
    }

    toggle() {
      if (this.playing) this.pause();
      else this.play();
    }

    /** 直接跳到本步操作的最后一帧 */
    finish() {
      this.clearTimer();
      this.playing = false;

      if (!this.steps.length) {
        this.onStateChange(this.state());
        return;
      }

      if (this.index !== this.steps.length - 1) {
        this.index = this.steps.length - 1;
        this.emitStep();
      }

      this.complete();
      this.onStateChange(this.state());
    }

    next() {
      this.pause();
      if (this.index >= this.steps.length - 1) return;

      this.index += 1;
      this.done = false;
      this.emitStep();
      this.onStateChange(this.state());

      if (this.index === this.steps.length - 1) this.complete();
    }

    prev() {
      this.pause();
      if (this.index <= 0) return;

      this.index -= 1;
      this.emitStep();
      this.onStateChange(this.state());
    }

    advance() {
      if (!this.playing) return;

      if (this.index >= this.steps.length - 1) {
        this.finish();
        return;
      }

      this.index += 1;
      this.emitStep();

      if (this.index === this.steps.length - 1) {
        this.playing = false;
        this.complete();
        this.onStateChange(this.state());
        return;
      }

      this.timer = setTimeout(() => this.advance(), this.duration);
    }

    complete() {
      if (this.done) return;
      this.done = true;
      this.onDone(this.current, this.index);
    }

    emitStep() {
      const step = this.steps[this.index];
      if (step) this.onStep(step, this.index, this.steps.length);
    }

    clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }

  global.StepPlayer = StepPlayer;
})(window);
