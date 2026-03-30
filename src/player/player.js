/**
 * Frame Player — Step through or animate OCF drill frames.
 */

export class FramePlayer {
  constructor(options = {}) {
    this.doc = null;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.animationTimer = null;
    this.onFrameChange = options.onFrameChange || (() => {});
    this.onPlayStateChange = options.onPlayStateChange || (() => {});
    this.defaultDuration = 1500; // ms between frames during auto-play
  }

  /** Load a document into the player. */
  load(doc) {
    this.stop();
    this.doc = doc;
    this.currentFrame = 0;
    this._notify();
  }

  /** Total number of frames. */
  get frameCount() {
    return this.doc?.frames?.length || 0;
  }

  /** Current frame object. */
  get frame() {
    if (!this.doc?.frames) return null;
    return this.doc.frames[this.currentFrame] || null;
  }

  /** Go to specific frame. */
  goTo(index) {
    if (!this.doc) return;
    this.currentFrame = Math.max(0, Math.min(index, this.frameCount - 1));
    this._notify();
  }

  /** Go to next frame. */
  next() {
    if (this.currentFrame < this.frameCount - 1) {
      this.currentFrame++;
      this._notify();
      return true;
    }
    return false;
  }

  /** Go to previous frame. */
  prev() {
    if (this.currentFrame > 0) {
      this.currentFrame--;
      this._notify();
      return true;
    }
    return false;
  }

  /** Start auto-playing. */
  play() {
    if (this.isPlaying || this.frameCount <= 1) return;
    this.isPlaying = true;
    this.onPlayStateChange(true);
    this._scheduleNext();
  }

  /** Stop auto-playing. */
  stop() {
    this.isPlaying = false;
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    this.onPlayStateChange(false);
  }

  /** Toggle play/stop. */
  toggle() {
    this.isPlaying ? this.stop() : this.play();
  }

  /** Get display info for current frame. */
  getInfo() {
    const frame = this.frame;
    return {
      index: this.currentFrame,
      total: this.frameCount,
      label: frame?.label || `Step ${this.currentFrame + 1}`,
      description: frame?.description || '',
      isFirst: this.currentFrame === 0,
      isLast: this.currentFrame >= this.frameCount - 1,
      isPlaying: this.isPlaying,
    };
  }

  _scheduleNext() {
    if (!this.isPlaying) return;
    const duration = this.frame?.duration_ms || this.defaultDuration;
    this.animationTimer = setTimeout(() => {
      if (!this.next()) {
        // Loop back to start
        this.currentFrame = 0;
        this._notify();
      }
      if (this.isPlaying) this._scheduleNext();
    }, duration);
  }

  _notify() {
    this.onFrameChange(this.currentFrame, this.frame);
  }
}
