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

    const parseTotalSize = sizeHeader => {
    if (!sizeHeader) return NaN;
    const rangeMatch = String(sizeHeader).match(/bytes \S+\/(\d+)/);
    return rangeMatch ? +rangeMatch[1] : +sizeHeader;
  };

  // Discovers sibling container formats (.webm <-> .mp4) and size variants
  // such as Civitai's '.../transcode=true,width=NNN,optimized=true/...' pattern.
  const buildVariants = src => {
    const variants = [];

    if (/\.(webm|mp4|mov|mkv|avi|m4v)(?=$|\?)/i.test(src)) {
      const swapped = src.replace(/\.(webm|mp4|mov|mkv|avi|m4v)(?=$|\?)/i, match => {
        const map = { '.webm': '.mp4', '.mp4': '.webm', '.mov': '.mp4', '.mkv': '.mp4', '.avi': '.mp4', '.m4v': '.mp4' };
        return map[match.toLowerCase()] || match;
      });

      swapped !== src && variants.push({ label: 'other format', url: swapped });
    }

    if (/width=[^,/$]+/i.test(src)) {
      ['width=original', 'width=1080', 'width=720', 'width=450'].forEach(width =>
        variants.push({ label: width.replace('width=', 'width '), url: src.replace(/width=[^,/$]+/i, width) })
      );
    }

    return variants.filter(variant => variant.url !== src);
  };

  const probeVariants = () => {
    const variants = buildVariants(videoSrc);

    if (!variants.length) return;

    const probed = new Array(variants.length).fill(null);
    let pending = variants.length;

    const renderVariants = () => {
      const rows = probed
        .map((info, index) => ({ ...variants[index], info }))
        .filter(({ url, info }) => url === videoSrc || (info && info.ok !== false));

      if (pending && !rows.some(({ info }) => info)) return;

      document.getElementById('variants')?.remove();
      if (!rows.length) return;

      const section = document.createElement('div');
      section.id = 'variants';
      section.innerHTML = `<h3>Available formats &amp; sizes</h3><ul>${rows
        .map((row, index) => {
          const size = row.info ? formatBytes(parseTotalSize(row.info.size)) : 'checking…';
          return `<li><a href="#" data-url="${row.url}">${row.label}</a> — ${size}` +
            (row.info?.finalUrl ? ` <a href="${row.info.finalUrl}" target="_blank">[direct link]</a>` : '') +
            `</li>`;
        })
        .join('')}</ul>`;
      section.querySelectorAll('a[data-url]').forEach(link =>
        link.addEventListener('click', event => {
          event.preventDefault();
          player.src = link.dataset.url;
          probeInfo = undefined;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
      );
      details.after(section);
    };

    variants.forEach((variant, index) =>
      chrome.runtime.sendMessage({ cmd: 'PROBE_VIDEO', args: { videoSrc: variant.url } }, info => {
        if (!chrome.runtime.lastError) probed[index] = info;
        pending -= 1;
        renderVariants();
      })
    );
  };

  if (videoSrc) {
    player.src = videoSrc;
    player.addEventListener('loadedmetadata', render);

    chrome.runtime.sendMessage({ cmd: 'PROBE_VIDEO', args: { videoSrc } }, info => {
      if (!chrome.runtime.lastError) {
        probeInfo = info;
        render();
        probeVariants();
      }
    });
  } else {
    details.textContent = 'No video source specified.';
  }
})();
