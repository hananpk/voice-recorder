let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let animationId;
let startTime;
let timerInterval;

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

  recordings.forEach((rec) => { 
    const container = document.createElement('div');
    container.className = 'recording-item';

    const meta = document.createElement('div');
    meta.className = 'recording-meta';
    meta.textContent = formatDate(rec.timestamp || new Date());

    const title = document.createElement('p');
    title.className = 'recording-title';
    title.innerHTML = `${rec.name} <span class="recording-duration">(${formatTime(rec.duration)})</span>`;

    const howler = new Howl({
      src: [rec.dataUrl],
      format: ['mp3', 'aac', 'webm'], 
      html5: true, 
      preload: true,
    });

    let isPlaying = false;

    
    const player = document.createElement('div');
    player.className = 'custom-player';

    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'custom-player-wrapper';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'icon-button play-button';
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = 0;
    progress.max = 100;
    progress.value = 0;
    progress.className = 'progress-bar progress-slider';
    progress.style.width = '100%'; 
    progress.style.margin = '10px 0'; 
    progress.style.height = '5px'; 
    progress.style.borderRadius = '5px'; 
    progress.style.background = '#e0e0e0';
    progress.style.cursor = 'pointer';
    progress.style.accentColor = '#000'; 

    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'time-display';
    howler.on('load', () => {
        timeDisplay.textContent = `00:00 / ${formatTime(rec.duration)}`;
    });
    if (howler.state() === 'loaded') {
        timeDisplay.textContent = `00:00 / ${formatTime(rec.duration)}`;
    }


    let progressInterval;

    playBtn.onclick = () => {
      if (isPlaying) {
        howler.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        clearInterval(progressInterval);
      } else {
        howler.play();
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        progressInterval = setInterval(() => {
          const seekTime = howler.seek();
          const duration = howler.duration();
          const percentage = (isNaN(duration) || duration === 0) ? 0 : (seekTime / duration) * 100;
          progress.value = percentage;
          timeDisplay.textContent = `${formatTime(Math.floor(seekTime))} / ${formatTime(rec.duration)}`;
        }, 200); 
      }
      isPlaying = !isPlaying;
    };

    progress.addEventListener('input', () => {
      const duration = howler.duration();
      if (isNaN(duration) || !isFinite(duration) || duration === 0) return;

      const seekTime = (progress.value / 100) * duration;
      howler.seek(seekTime);
      timeDisplay.textContent = `${formatTime(Math.floor(seekTime))} / ${formatTime(rec.duration)}`;
    });


    howler.on('end', () => { 
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      isPlaying = false;
      clearInterval(progressInterval);
      progress.value = 0;
      timeDisplay.textContent = `00:00 / ${formatTime(rec.duration)}`; 
    });

    howler.on('play', () => {
      if (timeDisplay.textContent === '00:00 / 00:00' && howler.duration()) {
        timeDisplay.textContent = `00:00 / ${formatTime(rec.duration)}`;
      }
    });

    playerWrapper.appendChild(playBtn);
    playerWrapper.appendChild(progress);
    player.appendChild(playerWrapper);
    player.appendChild(timeDisplay); 

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
        howler.unload(); // Unload howler instance to free up memory
      }
    };

    const download = document.createElement('button');
    download.className = 'icon-button';
    download.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
    download.onclick = () => {
      const arr = rec.dataUrl.split(',');
      const mime = rec.mimeType || 'audio/mp4'; 
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      const ext = mime.split('/')[1].replace('x-', ''); 
      downloadAudio(blob, `${rec.name}.${ext}`);
    };

    const topSection = document.createElement('div');
    topSection.className = 'recording-top';
    topSection.appendChild(meta);
    topSection.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'recording-controls';
    controls.appendChild(player);


    const actions = document.createElement('div');
    actions.className = 'recording-actions';
    const speedBtn = document.createElement('button');
    speedBtn.className = 'icon-button speed-toggle';
    speedBtn.textContent = '1x';

    let localSpeed = 1;
    speedBtn.addEventListener('click', () => {
      localSpeed = localSpeed === 1 ? 2 : 1;
      howler.rate(localSpeed);
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
    // Check for media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording. Please try a different browser or update it.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings to record audio.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please ensure a microphone is connected and enabled.');
      } else {
        alert('An error occurred while accessing the microphone: ' + err.message);
      }
      return;
    }


    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    drawWaveform(analyser, dataArray);


    let mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/aac')) {
      mimeType = 'audio/aac';
    } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) { 
      mimeType = 'audio/webm; codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else {

      console.warn('No specific audio MIME type supported, using browser default.');
      mimeType = '';
    }

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    startTime = Date.now();

    timerDisplay.innerHTML = '<i class="fa-solid fa-pause"></i> 00:00';
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerDisplay.innerHTML = `<i class="fa-solid fa-pause"></i> ${formatTime(elapsed)}` || '<i class="fa-solid fa-play"></i> 00:00';
    }, 1000);

    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const durationInSeconds = Math.round((Date.now() - startTime) / 1000);
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || mimeType || 'audio/mp4' });

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        const fileName = prompt('Enter a name for recording:') || `Recording-${Date.now()}`;
        const newRecording = {
          name: fileName,
          duration: durationInSeconds,
          dataUrl: base64data,
          mimeType: blob.type,
          timestamp: new Date().toISOString()
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