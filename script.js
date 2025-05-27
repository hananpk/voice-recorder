let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let animationId;
let startTime;
let timerInterval;
let currentSpeed = 1;

const recordButton = document.getElementById('record-button');
const timerDisplay = document.querySelector('.timer');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
const recordingsList = document.getElementById('recordings-list');
const input = document.getElementById('recordingName');
const label = document.getElementById('search-label');
const expandBtn = document.querySelector('.expand');
const recordControls = document.getElementById('record-controls');
const askAi = document.getElementById('ask-ai');
const speedToggleBtn = document.getElementById('speed-toggle');

askAi.addEventListener('click', () => {
  alert('AI is Coming.... Stay tuned for updates! 🙈');
});
expandBtn.addEventListener('click', () => {
  recordControls.classList.toggle('expanded');
});

// hide the label when the input has text
input.addEventListener('input', () => {
  if (input.value.trim() !== '') {
    label.style.display = 'none';
  } else {
    label.style.display = 'inline';
  }

  loadRecordings(input.value);
});



const formatTime = (seconds) => {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};


function downloadAudio(blob, fileName = 'recording.wav') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); 
}



const loadRecordings = (searchTerm = '') => {
  recordingsList.innerHTML = '';
  const recordings = JSON.parse(localStorage.getItem('recordings') || '[]')
    .reverse()
    .filter(rec => rec.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (recordings.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'no-results';
      noResult.textContent = 'No recordings found.';
      recordingsList.appendChild(noResult);
      return;
    }

  recordings.forEach((rec, index) => {
    const container = document.createElement('div');
    container.className = 'recording-item';

    const meta = document.createElement('div');
    meta.className = 'recording-meta';
    meta.textContent = formatDate(rec.timestamp || new Date());

    const title = document.createElement('p');
    title.className = 'recording-title';
    title.innerHTML = `${rec.name} <span class="recording-duration">(${formatTime(rec.duration)})</span>`;

    const audio = document.createElement('audio');
    audio.className = 'recording-audio';
    audio.controls = true;
    audio.src = rec.dataUrl;

    const del = document.createElement('button');
    del.className = 'icon-button';
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.onclick = () => {
      const originalRecordings = JSON.parse(localStorage.getItem('recordings') || '[]');
      const originalIndex = originalRecordings.findIndex(r => r.name === rec.name && r.dataUrl === rec.dataUrl);
      if (originalIndex > -1) {
        originalRecordings.splice(originalIndex, 1);
        localStorage.setItem('recordings', JSON.stringify(originalRecordings));
        loadRecordings(searchTerm); 
      }
    };

    const download = document.createElement('button');
    download.className = 'icon-button';
    download.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
    download.onclick = () => {
      const blob = new Blob([rec.dataUrl], { type: 'audio/wav' });
      downloadAudio(blob, `${rec.name}.wav`);
    };

    const topSection = document.createElement('div');
    topSection.className = 'recording-top';
    topSection.appendChild(meta);
    topSection.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'recording-controls';
    controls.appendChild(audio);

    const actions = document.createElement('div');
    actions.className = 'recording-actions';
    const speedBtn = document.createElement('button');
    speedBtn.className = 'icon-button speed-toggle';
    speedBtn.textContent = '1x';
    
    let localSpeed = 1;
    speedBtn.addEventListener('click', () => {
      localSpeed = localSpeed === 1 ? 2 : 1;
      audio.playbackRate = localSpeed;
      speedBtn.textContent = `${localSpeed}x`;
    });
    
    actions.appendChild(speedBtn);
    actions.appendChild(download);
    actions.appendChild(del);

    controls.appendChild(actions);

    container.appendChild(topSection);
    container.appendChild(controls);

    recordingsList.appendChild(container);
  });
};

//wave animation
const drawWaveform = (analyser, dataArray) => {
  let phase = 0;
  let currentAmplitude = 3;
  const idleAmplitude = 3;
  const maxAmplitude = canvas.height / 3;

  const draw = () => {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const avgFreq = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const isTalking = avgFreq > 10;
    const boosted = avgFreq * 1.5;
    const targetAmplitude = isTalking
      ? Math.min(boosted, maxAmplitude)
      : idleAmplitude;

    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.1;

    ctx.beginPath();
    const frequency = 0.04;
    const centerY = canvas.height / 2;

    ctx.moveTo(0, centerY);
    for (let x = 0; x <= canvas.width; x++) {
      const y = currentAmplitude * Math.sin(x * frequency + phase) + centerY;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();

    ctx.fillStyle = '#a5c4f4';
    ctx.fill();

    phase += 0.1;
  };

  draw();
};

recordButton.onclick = async () => {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    drawWaveform(analyser, dataArray);

    mediaRecorder = new MediaRecorder(stream);
    startTime = Date.now();

    timerDisplay.innerHTML = '<i class="fa-solid fa-pause"></i> 00:00';
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerDisplay.innerHTML = `<i class="fa-solid fa-pause"></i> ${formatTime(elapsed)}` || '<i class="fa-solid fa-play"></i> 00:00';
    }, 1000);

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const durationInSeconds = Math.round((Date.now() - startTime) / 1000);
      const blob = new Blob(audioChunks, { type: 'audio/webm' });

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        const fileName = prompt('Enter a name for recording:') || `Recording-${Date.now()}`;
        const newRecording = {
          name: fileName,
          duration: durationInSeconds,
          dataUrl: base64data
        };

        const recordings = JSON.parse(localStorage.getItem('recordings') || '[]');
        recordings.push(newRecording);
        localStorage.setItem('recordings', JSON.stringify(recordings));
        loadRecordings();
      };
      reader.readAsDataURL(blob);
      audioChunks = [];
    };

    mediaRecorder.start();
    recordButton.textContent = 'Done';
    isRecording = true;
  } else {
    mediaRecorder.stop();
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearInterval(timerInterval);
    timerDisplay.textContent = '';
    isRecording = false;
    recordButton.textContent = 'Start';
    timerDisplay.innerHTML = '<i class="fa-solid fa-play"></i> 00:00';

  }
};

loadRecordings();
