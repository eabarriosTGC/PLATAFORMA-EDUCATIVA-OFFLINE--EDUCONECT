/* js/video-player.js — Reproductor de video inline con progreso */
(function() {
  var modal = null;
  var closeBtn = null;
  var videoEl = null;
  var titleEl = null;
  var continueBanner = null;
  var currentVideo = null;
  var saveInterval = null;
  var progressInterval = null;
  var progressFill = null;
  var metaEl = null;
  var infoEl = null;

  function getPosKey(id) {
    return 'video-pos-' + id;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function savePosition() {
    if (!currentVideo || !videoEl) return;
    var pos = videoEl.currentTime;
    var dur = videoEl.duration;
    if (pos > 0 && dur > 0) {
      try {
        localStorage.setItem(getPosKey(currentVideo.id), JSON.stringify({
          position: pos,
          duration: dur,
          timestamp: Date.now(),
          title: currentVideo.title
        }));
      } catch(e) {}
    }
  }

  function getStoredPosition(id) {
    try {
      var stored = localStorage.getItem(getPosKey(id));
      if (stored) {
        var data = JSON.parse(stored);
        if (data && data.position > 1) return data;
      }
    } catch(e) {}
    return null;
  }

  function updateProgressBar() {
    if (!videoEl || !progressFill) return;
    var dur = videoEl.duration;
    var pos = videoEl.currentTime;
    if (dur > 0) {
      var pct = Math.min(100, Math.round((pos / dur) * 100));
      progressFill.style.width = pct + '%';
    }
  }

  function updateMeta() {
    if (!videoEl || !metaEl) return;
    var dur = videoEl.duration;
    var pos = videoEl.currentTime;
    if (dur > 0) {
      metaEl.textContent = formatTime(pos) + ' / ' + formatTime(dur);
    } else {
      metaEl.textContent = 'Cargando...';
    }
  }

  function abrirVideo(videoData) {
    currentVideo = videoData;
    if (!modal) return;

    titleEl.textContent = videoData.title || 'Video';

    var url = videoData.url || ('/videos/' + videoData.file);

    var storedData = getStoredPosition(videoData.id);

    // Show continue banner if there's stored position
    if (storedData && storedData.position > 1 && storedData.duration > 0) {
      continueBanner.style.display = 'block';
      continueBanner.innerHTML =
        '<span>⏯ Continuar desde ' + formatTime(storedData.position) + '</span>' +
        '<button class=\"video-resume-btn\">Continuar</button>' +
        '<button class=\"video-restart-btn\" style=\"background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;margin-left:8px;\">Empezar de nuevo</button>';
      continueBanner.querySelector('.video-resume-btn').onclick = function() {
        videoEl.currentTime = storedData.position;
        videoEl.play().catch(function() {});
        continueBanner.style.display = 'none';
      };
      continueBanner.querySelector('.video-restart-btn').onclick = function() {
        continueBanner.style.display = 'none';
      };
    } else {
      continueBanner.style.display = 'none';
    }

    videoEl.src = url;
    videoEl.load();

    // Show info area
    if (infoEl) infoEl.style.display = 'block';
    if (metaEl) metaEl.textContent = 'Cargando...';

    modal.classList.add('visible');

    // Start saving position every 5s
    if (saveInterval) clearInterval(saveInterval);
    saveInterval = setInterval(savePosition, 5000);

    // Start updating progress bar
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(function() {
      updateProgressBar();
      updateMeta();
    }, 500);

    videoEl.play().catch(function() {});
  }

  function cerrarVideo() {
    if (!modal) return;
    if (videoEl) {
      videoEl.pause();
      savePosition();
    }
    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    modal.classList.remove('visible');
    currentVideo = null;

    // Clean up src to stop buffering
    if (videoEl) {
      videoEl.removeAttribute('src');
      videoEl.load();
    }
    if (infoEl) infoEl.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
  }

  function init() {
    modal = document.getElementById('video-modal');
    closeBtn = document.getElementById('video-modal-close');
    videoEl = document.getElementById('video-player-element');
    titleEl = document.getElementById('video-modal-title');
    continueBanner = document.getElementById('video-continue-banner');
    progressFill = document.getElementById('video-progress-fill');
    metaEl = document.getElementById('video-modal-meta');
    infoEl = document.getElementById('video-modal-info');

    if (!modal || !closeBtn || !videoEl) return;

    closeBtn.addEventListener('click', cerrarVideo);

    // Close on overlay click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) cerrarVideo();
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        cerrarVideo();
      }
    });

    // Handle pause to save progress
    videoEl.addEventListener('pause', savePosition);
    videoEl.addEventListener('ended', function() {
      try {
        localStorage.removeItem(getPosKey(currentVideo ? currentVideo.id : ''));
      } catch(e) {}
      if (progressFill) progressFill.style.width = '100%';
    });
  }

  // Export
  window.abrirVideo = abrirVideo;
  window.videoPlayerInit = init;
})();
