let audioCtx = null;
let noiseNode = null;
let gainNode = null;
let isPlaying = false;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// --- Generate white noise buffer ---
function createNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// --- Pink / brown filters ---
function createNoiseFilters(ctx) {
  const pinkFilter = ctx.createBiquadFilter();
  pinkFilter.type = "lowpass";
  pinkFilter.frequency.value = 2000;
  pinkFilter.Q.value = 1;

  const brownFilter = ctx.createBiquadFilter();
  brownFilter.type = "lowpass";
  brownFilter.frequency.value = 600;
  brownFilter.Q.value = 0.7;

  return { pinkFilter, brownFilter };
}

function startNoise() {
  const ctx = getAudioContext();

  const buffer = createNoiseBuffer(ctx);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // **Lower volume massively**
  gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.08, ctx.currentTime);

  // Filters
  const { pinkFilter, brownFilter } = createNoiseFilters(ctx);

  // Connect in series (white → pink → brown → gain)
  source.connect(pinkFilter);
  pinkFilter.connect(brownFilter);
  brownFilter.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start();

  noiseNode = { source, pinkFilter, brownFilter };
  isPlaying = true;
}

function stopNoise() {
  if (noiseNode) {
    noiseNode.source.stop();
    noiseNode = null;
  }
  isPlaying = false;
}

// --- Noise mix control ---
function updateNoiseMix(value) {
  // value is 0 → 1
  // 0 = brown, 0.5 = pink, 1.0 = white

  if (!noiseNode) return;

  const { pinkFilter, brownFilter } = noiseNode;

  // White = no filtering → bypass by opening filters fully
  if (value >= 0.75) {
    const amt = (value - 0.75) * 4; // 0–1
    pinkFilter.frequency.setValueAtTime(2000 + 18000 * amt, audioCtx.currentTime);
    brownFilter.frequency.setValueAtTime(600 + 18000 * amt, audioCtx.currentTime);
  }

  // Pink region
  if (value >= 0.25 && value < 0.75) {
    const amt = (value - 0.25) * 2; // 0–1
    pinkFilter.frequency.setValueAtTime(1500 + 500 * amt, audioCtx.currentTime);
    brownFilter.frequency.setValueAtTime(500 + 100 * amt, audioCtx.currentTime);
  }

  // Brown region
  if (value < 0.25) {
    const amt = value * 4; // 0–1
    pinkFilter.frequency.setValueAtTime(800 + 700 * amt, audioCtx.currentTime);
    brownFilter.frequency.setValueAtTime(200 + 400 * amt, audioCtx.currentTime);
  }
}

// --- UI control ---
document.getElementById("toggleBtn").addEventListener("click", () => {
  const btn = document.getElementById("toggleBtn");

  if (!isPlaying) {
    startNoise();
    btn.textContent = "Pause";
  } else {
    stopNoise();
    btn.textContent = "Play";
  }
});

document.getElementById("noiseTypeSlider").addEventListener("input", (e) => {
  updateNoiseMix(parseFloat(e.target.value));
});
