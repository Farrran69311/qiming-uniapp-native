import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const workletSource = await readFile(
  new URL("./assistant-speech-player.worklet.js", import.meta.url),
  "utf8"
);

function createProcessor(jitterBufferMs = 120) {
  let Processor;

  class FakeAudioWorkletProcessor {
    constructor() {
      this.messages = [];
      this.port = {
        onmessage: null,
        postMessage: message => this.messages.push(message)
      };
    }
  }

  const sandbox = {
    ArrayBuffer,
    Float32Array,
    Int16Array,
    Math,
    Number,
    AudioWorkletProcessor: FakeAudioWorkletProcessor,
    registerProcessor: (_name, processor) => {
      Processor = processor;
    },
    sampleRate: 48000
  };
  vm.runInNewContext(workletSource, sandbox, {
    filename: "assistant-speech-player.worklet.js"
  });

  const processor = new Processor({
    processorOptions: {
      sourceSampleRate: 24000,
      jitterBufferMs
    }
  });
  return processor;
}

function appendSamples(processor, sampleCount) {
  processor.handleMessage({
    type: "append",
    pcm: new Int16Array(sampleCount).buffer
  });
}

function renderQuantum(processor) {
  processor.process([], [[new Float32Array(128)]]);
}

test("starts within the server initial lead", () => {
  const processor = createProcessor();

  assert.ok(processor.initialBufferMs > 0);
  assert.ok(processor.initialBufferMs <= 240);
  assert.ok(processor.rebufferMs >= processor.initialBufferMs);
  assert.ok(processor.rebufferMs <= 600);

  const initialSamples = Math.round((24000 * processor.initialBufferMs) / 1000);
  appendSamples(processor, initialSamples - 1);
  renderQuantum(processor);
  assert.equal(
    processor.messages.some(message => message.type === "started"),
    false
  );

  appendSamples(processor, 1);
  renderQuantum(processor);
  assert.equal(
    processor.messages.some(message => message.type === "started"),
    true
  );
});

test("keeps the recovery target below the server steady-state lead", () => {
  const processor = createProcessor(300);

  assert.ok(processor.initialBufferMs > 0);
  assert.ok(processor.initialBufferMs <= 240);
  assert.ok(processor.rebufferMs >= processor.initialBufferMs);
  assert.ok(processor.rebufferMs <= 600);

  appendSamples(
    processor,
    Math.round((24000 * processor.initialBufferMs) / 1000)
  );
  renderQuantum(processor);
  for (let index = 0; index < 100; index += 1) renderQuantum(processor);
  assert.equal(
    processor.messages.some(message => message.type === "underrun"),
    true
  );

  appendSamples(processor, Math.round((24000 * processor.rebufferMs) / 1000));
  renderQuantum(processor);
  assert.equal(
    processor.messages.some(message => message.type === "resumed"),
    true
  );
});
