class AssistantSpeechPlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions || {};
    this.sourceSampleRate = Number(config.sourceSampleRate) || 24000;
    this.jitterBufferMs = Number(config.jitterBufferMs) || 120;
    // The provider recommendation is a starting point, not a safe playback
    // target. A 120 ms target starts too eagerly for the intermittent 500-900
    // ms delivery gaps seen on real networks, so keep a practical client-side
    // cushion while retaining a cap for short responses.
    this.initialBufferMs = Math.min(
      900,
      Math.max(480, Math.round(this.jitterBufferMs * 4))
    );
    this.rebufferMs = Math.min(
      1400,
      Math.max(720, Math.round(this.initialBufferMs * 1.6))
    );
    this.lowWaterMs = Math.min(
      this.initialBufferMs - 80,
      Math.max(220, Math.round(this.initialBufferMs * 0.5))
    );
    this.capacity = Math.max(this.sourceSampleRate * 120, 48000);
    this.buffer = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;
    this.readPhase = 0;
    this.playedSample = 0;
    this.started = false;
    this.hasStartedEver = false;
    this.rebuffering = false;
    this.bufferLowReported = false;
    this.underrunCount = 0;
    this.minBufferedSamples = Number.POSITIVE_INFINITY;
    this.lastOutputValue = 0;
    this.fadeInGain = 0;
    this.fadeInStep = 1 / Math.max(1, sampleRate * 0.008);
    this.fadeOutFactor = Math.exp(-1 / Math.max(1, sampleRate * 0.006));
    this.endedInput = false;
    this.endedReported = false;
    this.reportFrames = 0;
    this.rmsSum = 0;
    this.rmsCount = 0;
    this.port.onmessage = event => this.handleMessage(event.data || {});
  }

  reset(startSample = 0) {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;
    this.readPhase = 0;
    this.playedSample = Number(startSample) || 0;
    this.started = false;
    this.hasStartedEver = false;
    this.rebuffering = false;
    this.bufferLowReported = false;
    this.underrunCount = 0;
    this.minBufferedSamples = Number.POSITIVE_INFINITY;
    this.lastOutputValue = 0;
    this.fadeInGain = 0;
    this.endedInput = false;
    this.endedReported = false;
    this.reportFrames = 0;
    this.rmsSum = 0;
    this.rmsCount = 0;
  }

  handleMessage(data) {
    if (data.type === "reset") {
      this.reset(data.startSample);
      return;
    }
    if (data.type === "end") {
      this.endedInput = true;
      return;
    }
    if (data.type !== "append" || !(data.pcm instanceof ArrayBuffer)) return;

    const pcm = new Int16Array(data.pcm);
    if (data.discontinuity) this.reset(data.startSample);
    if (!this.available && !this.started && Number.isFinite(data.startSample)) {
      this.playedSample = Number(data.startSample);
    }
    for (let index = 0; index < pcm.length; index += 1) {
      if (this.available >= this.capacity - 1) {
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available -= 1;
        this.playedSample += 1;
      }
      this.buffer[this.writeIndex] = pcm[index] / 32768;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.available += 1;
    }
    if (
      this.available >=
      Math.round((this.sourceSampleRate * this.initialBufferMs) / 1000)
    ) {
      this.bufferLowReported = false;
    }
  }

  sampleAt(offset) {
    if (offset >= this.available) return 0;
    return this.buffer[(this.readIndex + offset) % this.capacity];
  }

  report(force = false) {
    if (!force && this.reportFrames < Math.max(128, sampleRate * 0.06)) return;
    const rms = this.rmsCount ? Math.sqrt(this.rmsSum / this.rmsCount) : 0;
    this.port.postMessage({
      type: "stats",
      playedSample: Math.floor(this.playedSample),
      bufferedMs: Math.round((this.available / this.sourceSampleRate) * 1000),
      minBufferedMs: Number.isFinite(this.minBufferedSamples)
        ? Math.round((this.minBufferedSamples / this.sourceSampleRate) * 1000)
        : undefined,
      underrunCount: this.underrunCount,
      rebuffering: this.rebuffering,
      rms
    });
    this.reportFrames = 0;
    this.rmsSum = 0;
    this.rmsCount = 0;
  }

  reportBufferLow() {
    if (this.bufferLowReported || this.endedInput) return;
    this.bufferLowReported = true;
    this.port.postMessage({
      type: "buffer-low",
      playedSample: Math.floor(this.playedSample),
      bufferedMs: Math.round((this.available / this.sourceSampleRate) * 1000),
      underrunCount: this.underrunCount
    });
  }

  enterRebuffering() {
    if (!this.started || this.endedInput) return;
    this.started = false;
    this.rebuffering = true;
    this.bufferLowReported = true;
    this.underrunCount += 1;
    this.port.postMessage({
      type: "underrun",
      playedSample: Math.floor(this.playedSample),
      bufferedMs: Math.round((this.available / this.sourceSampleRate) * 1000),
      underrunCount: this.underrunCount,
      targetBufferMs: this.rebufferMs
    });
  }

  process(_inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) return true;

    const targetBufferMs = this.hasStartedEver
      ? this.rebufferMs
      : this.initialBufferMs;
    const startThreshold = Math.max(
      2,
      Math.round((this.sourceSampleRate * targetBufferMs) / 1000)
    );
    if (
      !this.started &&
      (this.available >= startThreshold ||
        (this.endedInput && this.available > 1))
    ) {
      const eventType = this.hasStartedEver ? "resumed" : "started";
      this.started = true;
      this.hasStartedEver = true;
      this.rebuffering = false;
      this.bufferLowReported = false;
      this.fadeInGain = 0;
      this.endedReported = false;
      this.port.postMessage({
        type: eventType,
        playedSample: Math.floor(this.playedSample),
        bufferedMs: Math.round((this.available / this.sourceSampleRate) * 1000),
        underrunCount: this.underrunCount
      });
    }

    const sourceStep = this.sourceSampleRate / sampleRate;
    for (let index = 0; index < output.length; index += 1) {
      let value = 0;
      if (this.started && this.available > 1) {
        const current = this.sampleAt(0);
        const next = this.sampleAt(1);
        const sourceValue = current + (next - current) * this.readPhase;
        this.fadeInGain = Math.min(1, this.fadeInGain + this.fadeInStep);
        value = sourceValue * this.fadeInGain;
        this.readPhase += sourceStep;
        while (this.readPhase >= 1 && this.available > 1) {
          this.readPhase -= 1;
          this.readIndex = (this.readIndex + 1) % this.capacity;
          this.available -= 1;
          this.playedSample += 1;
        }
      } else {
        value = this.lastOutputValue * this.fadeOutFactor;
        if (Math.abs(value) < 0.000001) value = 0;
      }
      this.lastOutputValue = value;
      output[index] = value;
      this.rmsSum += value * value;
      this.rmsCount += 1;
      this.reportFrames += 1;
    }

    this.report();
    if (this.hasStartedEver) {
      this.minBufferedSamples = Math.min(
        this.minBufferedSamples,
        this.available
      );
    }
    const lowWaterSamples = Math.max(
      2,
      Math.round((this.sourceSampleRate * this.lowWaterMs) / 1000)
    );
    if (this.started && !this.endedInput) {
      if (this.available <= 1) this.enterRebuffering();
      else if (this.available <= lowWaterSamples) this.reportBufferLow();
    }
    if (
      this.hasStartedEver &&
      this.endedInput &&
      this.available <= 1 &&
      !this.endedReported
    ) {
      this.endedReported = true;
      this.started = false;
      this.rebuffering = false;
      this.report(true);
      this.port.postMessage({
        type: "ended",
        playedSample: Math.floor(this.playedSample)
      });
    }
    return true;
  }
}

registerProcessor("assistant-speech-player", AssistantSpeechPlayerProcessor);
