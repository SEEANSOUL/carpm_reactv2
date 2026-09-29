import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  EncodingType,
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

type Point = { latitude: number; longitude: number };

export type DriveStoryPosterInput = {
  photoUrl: string;
  name: string;
  distance: string;
  duration: string;
  maxSpeed: string;
  vehicleLabel?: string | null;
  ledgerLine?: string | null;
  points: Point[];
};

function mimeFromUrl(url: string) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function thinPoints(points: Point[], max = 420): Point[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const result: Point[] = [];
  for (let i = 0; i < max; i += 1) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

async function photoToDataUrl(url: string) {
  if (!cacheDirectory) throw new Error('Fotoğraf hazırlanamadı.');
  const local = url.startsWith('file://') || url.startsWith('content://');
  const fileUri = local ? url : `${cacheDirectory}drive-photo-${Date.now()}`;
  if (!local) await downloadAsync(url, fileUri);
  let jpegUri = fileUri;
  try {
    const context = ImageManipulator.manipulate(fileUri);
    context.resize({ width: 720 });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.55, format: SaveFormat.JPEG });
    jpegUri = saved.uri;
    const base64 = await readAsStringAsync(jpegUri, { encoding: EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    const base64 = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
    return `data:${mimeFromUrl(url)};base64,${base64}`;
  } finally {
    if (!local) await deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
    if (jpegUri !== fileUri) await deleteAsync(jpegUri, { idempotent: true }).catch(() => undefined);
  }
}

function posterHtml(spec: Record<string, unknown>) {
  const payload = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#000;overflow:hidden}</style>
</head>
<body>
<canvas id="c" width="720" height="1280"></canvas>
<script>
const spec = ${payload};
function publish(message) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
  else setTimeout(() => publish(message), 40);
}
function thin(points, max) {
  if (!points || points.length <= max) return points || [];
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}
function clipText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1);
  return value + '…';
}
function drawRoute(ctx, points, x, y, w, h) {
  const source = thin(points, 420);
  if (source.length < 2) return;
  const lats = source.map((p) => p.latitude);
  const lngs = source.map((p) => p.longitude);
  const minLat = Math.min.apply(null, lats);
  const maxLat = Math.max.apply(null, lats);
  const minLng = Math.min.apply(null, lngs);
  const maxLng = Math.max.apply(null, lngs);
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const xSpan = Math.max((maxLng - minLng) * lngScale, 0.00015);
  const ySpan = Math.max(maxLat - minLat, 0.00015);
  const pad = Math.max(16, Math.min(28, w * 0.08, h * 0.08));
  const scale = Math.min((w - pad * 2) / xSpan, (h - pad * 2) / ySpan);
  const drawnW = xSpan * scale;
  const drawnH = ySpan * scale;
  const ox = x + (w - drawnW) / 2;
  const oy = y + (h - drawnH) / 2;
  const coords = source.map((p) => ({
    x: ox + (p.longitude - minLng) * lngScale * scale,
    y: oy + (maxLat - p.latitude) * scale,
  }));
  function stroke(width, color) {
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i += 1) ctx.lineTo(coords[i].x, coords[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  stroke(22, '#FFFFFF');
  stroke(26, 'rgba(225,6,0,0.45)');
  stroke(11, '#E10600');
  ctx.beginPath();
  ctx.arc(coords[0].x, coords[0].y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  const end = coords[coords.length - 1];
  ctx.beginPath();
  ctx.arc(end.x, end.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#E10600';
  ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function stat(ctx, label, value, unit, x, y, maxWidth) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#6B6B6B';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(label, x, y);
  let size = 46;
  const gap = 6;
  while (size > 26) {
    ctx.font = '800 ' + size + 'px sans-serif';
    const valueWidth = ctx.measureText(value).width;
    ctx.font = '700 16px sans-serif';
    const unitWidth = unit ? ctx.measureText(unit).width + gap : 0;
    if (valueWidth + unitWidth <= maxWidth) break;
    size -= 2;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 ' + size + 'px sans-serif';
  ctx.fillText(value, x, y + size + 10);
  if (unit) {
    const valueWidth = ctx.measureText(value).width;
    ctx.fillStyle = '#A0A0A0';
    ctx.font = '700 16px sans-serif';
    ctx.fillText(unit, x + valueWidth + gap, y + size + 6);
  }
}
function paint(img) {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 720;
  const H = 1280;
  const left = 80;
  const contentW = W - left * 2;
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#E10600';
  ctx.fillRect(left, 72, 28, 4);
  ctx.fillStyle = '#E10600';
  ctx.font = '800 16px sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillText('SÜRÜŞ', left + 40, 80);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('CARPM', left + contentW, 80);
  ctx.textAlign = 'left';
  const wellX = left;
  const wellY = 118;
  const wellW = contentW;
  const wellH = 620;
  roundRect(ctx, wellX, wellY, wellW, wellH, 28);
  ctx.fillStyle = '#141414';
  ctx.fill();
  const pad = 22;
  const boxX = wellX + pad;
  const boxY = wellY + pad;
  const boxW = wellW - pad * 2;
  const boxH = wellH - pad * 2;
  let dx = boxX;
  let dy = boxY;
  let dw = boxW;
  let dh = boxH;
  if (img && img.width && img.height) {
    const scale = Math.min(boxW / img.width, boxH / img.height);
    dw = img.width * scale;
    dh = img.height * scale;
    dx = boxX + (boxW - dw) / 2;
    dy = boxY + (boxH - dh) / 2;
    ctx.save();
    roundRect(ctx, wellX, wellY, wellW, wellH, 28);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, wellX, wellY, wellW, wellH, 28);
  ctx.clip();
  drawRoute(ctx, spec.points, wellX + 16, wellY + 16, wellW - 32, wellH - 32);
  ctx.restore();
  const col = contentW / 3;
  const statY = 800;
  stat(ctx, 'MESAFE', spec.distance, 'km', left, statY, col - 12);
  stat(ctx, 'SÜRE', spec.duration, '', left + col, statY, col - 12);
  stat(ctx, 'MAKS', spec.maxSpeed, 'km/h', left + col * 2, statY, col - 12);
  ctx.strokeStyle = '#2A2A2A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, 980);
  ctx.lineTo(left + contentW, 980);
  ctx.stroke();
  if (spec.vehicleLabel) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 26px sans-serif';
    ctx.fillText(clipText(ctx, spec.vehicleLabel, contentW), left, 1036);
    if (spec.ledgerLine) {
      ctx.fillStyle = '#A0A0A0';
      ctx.font = '600 20px sans-serif';
      ctx.fillText(clipText(ctx, spec.ledgerLine, contentW), left, 1076);
    }
  }
  publish(canvas.toDataURL('image/jpeg', 0.72));
}
const image = new Image();
image.onload = () => paint(image);
image.onerror = () => publish('ERR:Fotoğraf yüklenemedi.');
image.src = spec.photoDataUrl;
</script>
</body>
</html>`;
}

export async function prepareDriveStoryPage(input: DriveStoryPosterInput) {
  if (!cacheDirectory) throw new Error('Kart görseli oluşmadı.');
  const photoDataUrl = await photoToDataUrl(input.photoUrl);
  const html = posterHtml({
    photoDataUrl,
    name: input.name,
    distance: input.distance,
    duration: input.duration,
    maxSpeed: input.maxSpeed,
    vehicleLabel: input.vehicleLabel ?? '',
    ledgerLine: input.ledgerLine ?? '',
    points: thinPoints(input.points),
  });
  const path = `${cacheDirectory}drive-story-${Date.now()}.html`;
  await writeAsStringAsync(path, html);
  return path;
}
