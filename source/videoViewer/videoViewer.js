/**
 * PhotoShow video details viewer.
 * Displays the video's direct source along with its available format, resolution, duration, and file size.
 */
(() => {
  const videoSrc = new URLSearchParams(location.search).get('src'),
    player = document.getElementById('player'),
    details = document.getElementById('details');

  let probeInfo;

  const formatBytes = bytes => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i += 1;
    }
    return `${bytes.toFixed(bytes >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const formatTime = seconds => {
    if (!Number.isFinite(seconds)) return '';
    const h = Math.floor(seconds / 3600),
      m = Math.floor((seconds % 3600) / 60),
      s = Math.round(seconds % 60);
    return (h ? [h, m, s] : [m, s]).map(part => String(part).padStart(2, '0')).join(':');
  };

  const render = () => {
    const rows = [['Address', videoSrc]];

    try {
      const extension = new URL(videoSrc).pathname.split('.').pop();

      extension && rows.push(['Format', extension.toUpperCase()]);
    } catch (error) {}

    if (probeInfo?.type) rows.push(['Content type', probeInfo.type]);
    if (player.videoWidth) rows.push(['Resolution', `${player.videoWidth} \u00d7 ${player.videoHeight}`]);
    if (Number.isFinite(player.duration) && player.duration) rows.push(['Duration', formatTime(player.duration)]);
    if (probeInfo?.size) {
      const rangeMatch = String(probeInfo.size).match(/bytes \S+\/(\d+)/),
        size = rangeMatch ? +rangeMatch[1] : +probeInfo.size;

      size && rows.push(['File size', formatBytes(size)]);
    }

    details.innerHTML = `<table>${rows
      .map(([key, value]) => `<tr><td class="key">${key}:</td><td>${value}</td></tr>`)
      .join('')}</table>`;
  };

  if (videoSrc) {
    player.src = videoSrc;
    player.addEventListener('loadedmetadata', render);

    chrome.runtime.sendMessage({ cmd: 'PROBE_VIDEO', args: { videoSrc } }, info => {
      if (!chrome.runtime.lastError) {
        probeInfo = info;
        render();
      }
    });
  } else {
    details.textContent = 'No video source specified.';
  }
})();
