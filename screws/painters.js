// Browser-side painters for the procedural sample scenes. Injected by gen-samples.mjs.

function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sunsetPalms(ctx, w, h, rnd) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, '#1b0b3a');
  sky.addColorStop(0.32, '#61186b');
  sky.addColorStop(0.56, '#c62d6b');
  sky.addColorStop(0.72, '#ff6a34');
  sky.addColorStop(0.85, '#ffc25c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // sun
  const sunX = w * 0.66, sunY = h * 0.615, sunR = h * 0.15;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.4);
  glow.addColorStop(0, 'rgba(255,236,170,0.95)');
  glow.addColorStop(0.22, 'rgba(255,168,80,0.55)');
  glow.addColorStop(1, 'rgba(255,90,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff1c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // retro bands across the sun, clipped to the disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(198,45,107,0.55)';
  for (let i = 0; i < 6; i++) {
    const y = sunY - sunR + sunR * 0.45 + i * sunR * 0.11;
    ctx.fillRect(sunX - sunR, y, sunR * 2, 2 + i * 1.4);
  }
  ctx.restore();

  // clouds: thin horizontal streaks, nothing that reads as an object
  for (let i = 0; i < 10; i++) {
    const y = h * (0.08 + rnd() * 0.44);
    const x = rnd() * w;
    const cw = w * (0.04 + rnd() * 0.16), ch = h * (0.004 + rnd() * 0.009);
    ctx.fillStyle = `rgba(255,${120 + rnd() * 80 | 0},${140 + rnd() * 60 | 0},${0.05 + rnd() * 0.07})`;
    ctx.beginPath();
    ctx.ellipse(x, y, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // sea
  const sea = ctx.createLinearGradient(0, h * 0.72, 0, h);
  sea.addColorStop(0, '#ff9a55');
  sea.addColorStop(0.16, '#9c3f74');
  sea.addColorStop(0.5, '#29124f');
  sea.addColorStop(1, '#0b0620');
  ctx.fillStyle = sea;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // sun reflection
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const y = h * 0.72 + t * h * 0.27;
    const len = (0.06 + rnd() * 0.34) * w * (1 - t * 0.5);
    const x = sunX - len / 2 + (rnd() - 0.5) * w * 0.1;
    ctx.fillStyle = `rgba(255,${180 + rnd() * 60 | 0},${110 + rnd() * 80 | 0},${0.55 * (1 - t)})`;
    ctx.fillRect(x, y, len, 1 + rnd() * 2.4);
  }

  // headland: a dune the left palm stands on, lit along its crest
  ctx.fillStyle = '#160826';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.bezierCurveTo(w * 0.12, h * 0.7, w * 0.24, h * 0.755, w * 0.34, h * 0.8);
  ctx.lineTo(w * 0.34, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,140,90,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.bezierCurveTo(w * 0.12, h * 0.7, w * 0.24, h * 0.755, w * 0.34, h * 0.8);
  ctx.stroke();

  // palms, silhouette first: tapered trunk, drooping fronds
  const palm = (x, base, scale, lean, mirror) => {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(mirror ? -scale : scale, scale);
    const topX = lean * 34, topY = -356;
    ctx.fillStyle = '#120619';
    ctx.strokeStyle = '#120619';
    // trunk as a tapered shape
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.bezierCurveTo(-9, -120, topX - 11, -240, topX - 6, topY);
    ctx.lineTo(topX + 6, topY);
    ctx.bezierCurveTo(topX + 11, -240, 9, -120, 13, 0);
    ctx.closePath();
    ctx.fill();
    // a thin warm rim on the sun side
    ctx.strokeStyle = 'rgba(255,150,90,0.22)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.bezierCurveTo(8, -120, topX + 9, -240, topX + 5, topY);
    ctx.stroke();

    ctx.fillStyle = '#120619';
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI * 1.02 + (f / 8) * Math.PI * 1.06;
      const len = 132 + ((f * 37) % 3) * 46;
      const droop = 46 + (f % 3) * 26;
      const ex = topX + Math.cos(a) * len;
      const ey = topY + Math.sin(a) * len * 0.45 + droop;
      const mx = topX + Math.cos(a) * len * 0.52;
      const my = topY + Math.sin(a) * len * 0.3 - 24;
      ctx.lineWidth = 7 - (f % 3);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const bx = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * mx + t * t * ex;
        const by = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * my + t * t * ey;
        const spread = 34 * (1 - t * 0.5);
        ctx.lineWidth = 4.2 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.85) * spread, by + Math.sin(a - 0.85) * spread * 0.5 + spread * 0.55);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.85) * spread, by + Math.sin(a + 0.85) * spread * 0.5 + spread * 0.55);
        ctx.stroke();
      }
    }
    // coconut cluster at the crown
    ctx.beginPath();
    ctx.arc(topX - 5, topY + 12, 9, 0, Math.PI * 2);
    ctx.arc(topX + 8, topY + 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  palm(w * 0.13, h * 0.79, h / 900, 0.7, false);
  palm(w * 0.88, h * 0.9, h / 760, -0.5, true);
  palm(w * 0.78, h * 0.8, h / 1500, -0.2, false);

  // birds
  ctx.strokeStyle = 'rgba(26,8,36,0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x = w * (0.2 + rnd() * 0.5), y = h * (0.16 + rnd() * 0.22), s = 8 + rnd() * 12;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y);
    ctx.stroke();
  }

  grain(ctx, w, h, rnd, 0.05);
}

function nightDrive(ctx, w, h, rnd) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#05030f');
  sky.addColorStop(0.45, '#180a3d');
  sky.addColorStop(0.8, '#5b1668');
  sky.addColorStop(1, '#b02a6a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // moon
  const mx = w * 0.22, my = h * 0.2, mr = h * 0.075;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.6);
  mg.addColorStop(0, 'rgba(255,214,235,0.32)');
  mg.addColorStop(1, 'rgba(255,120,200,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffe6f2';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  // skyline
  const horizon = h * 0.62;
  for (let i = 0; i < 34; i++) {
    const bw = w * (0.018 + rnd() * 0.05);
    const bx = i * (w / 34) + rnd() * 12;
    const bh = h * (0.05 + rnd() * 0.24);
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(bx, horizon - bh, bw, bh);
    ctx.fillStyle = `rgba(0,229,255,${0.25 + rnd() * 0.5})`;
    for (let ry = 0; ry < 9; ry++) {
      for (let rx = 0; rx < 4; rx++) {
        if (rnd() > 0.68) continue;
        ctx.fillRect(bx + 4 + rx * (bw / 4.4), horizon - bh + 6 + ry * (bh / 10), bw / 7, bh / 26);
      }
    }
  }

  // ground plane with a receding neon grid
  const groundG = ctx.createLinearGradient(0, horizon, 0, h);
  groundG.addColorStop(0, '#2a0d3f');
  groundG.addColorStop(0.45, '#190a2c');
  groundG.addColorStop(1, '#0b0417');
  ctx.fillStyle = groundG;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, h - horizon);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,229,255,0.28)';
  ctx.lineWidth = 2;
  const vpx = w * 0.5, vpy = horizon;
  for (let i = -22; i <= 22; i++) {
    ctx.beginPath();
    ctx.moveTo(vpx + i * w * 0.055, h);
    ctx.lineTo(vpx + i * w * 0.004, vpy);
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const y = horizon + Math.pow(t, 2.2) * (h - horizon);
    ctx.strokeStyle = `rgba(255,43,214,${0.06 + t * 0.22})`;
    ctx.lineWidth = 1 + t * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // road
  ctx.fillStyle = '#0a0614';
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - w * 0.02, horizon);
  ctx.lineTo(w * 0.5 + w * 0.02, horizon);
  ctx.lineTo(w * 1.06, h);
  ctx.lineTo(w * -0.06, h);
  ctx.closePath();
  ctx.fill();

  // neon horizon
  const hg = ctx.createLinearGradient(0, horizon - 12, 0, horizon + 12);
  hg.addColorStop(0, 'rgba(255,43,214,0)');
  hg.addColorStop(0.5, 'rgba(255,43,214,0.85)');
  hg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizon - 12, w, 24);

  // lane dashes
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const y = horizon + Math.pow(t, 2.1) * (h - horizon);
    const dh = 2 + Math.pow(t, 2) * 42;
    const dw = 1 + t * 9;
    ctx.fillStyle = `rgba(255,240,200,${0.25 + t * 0.6})`;
    ctx.fillRect(w * 0.5 - dw / 2, y, dw, dh);
  }

  // light trails
  const trail = (x0, x1, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.bezierCurveTo(x0 * 1.02, h * 0.8, x1, h * 0.7, x1, horizon + 6);
    ctx.stroke();
  };
  trail(w * 0.2, w * 0.42, 'rgba(255,52,90,0.55)');
  trail(w * 0.34, w * 0.46, 'rgba(255,52,90,0.35)');
  trail(w * 0.8, w * 0.57, 'rgba(255,240,190,0.45)');

  // palms silhouettes
  const palm = (x, base, scale) => {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#03010a';
    ctx.fillStyle = '#03010a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18, -150, 12, -300, -8, -430);
    ctx.stroke();
    for (let f = 0; f < 8; f++) {
      const a = -Math.PI * 0.92 + (f / 7) * Math.PI * 1.0;
      const len = 150 + (f % 2) * 60;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(-8, -430);
      ctx.quadraticCurveTo(-8 + Math.cos(a) * len * 0.5, -430 + Math.sin(a) * len * 0.3 - 30,
        -8 + Math.cos(a) * len, -430 + Math.sin(a) * len * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  };
  palm(w * 0.07, h * 1.02, h / 700);
  palm(w * 0.95, h * 1.06, h / 640);

  grain(ctx, w, h, rnd, 0.07);
}

function poolside(ctx, w, h, rnd) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#ffd8a1');
  sky.addColorStop(0.5, '#ff9a76');
  sky.addColorStop(1, '#f45f8e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.55);

  // sun flare
  const sx = w * 0.78, sy = h * 0.2;
  const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, h * 0.5);
  g.addColorStop(0, 'rgba(255,255,235,0.95)');
  g.addColorStop(0.12, 'rgba(255,230,170,0.7)');
  g.addColorStop(1, 'rgba(255,150,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // wall
  ctx.fillStyle = '#f2c4a8';
  ctx.fillRect(0, h * 0.42, w, h * 0.2);
  ctx.fillStyle = 'rgba(120,50,80,0.18)';
  for (let x = 0; x < w; x += w / 26) ctx.fillRect(x, h * 0.42, 2, h * 0.2);

  // deck
  ctx.fillStyle = '#e8d3bd';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = 'rgba(120,70,70,0.22)';
  ctx.lineWidth = 2;
  for (let y = h * 0.55; y < h; y += h * 0.055) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // pool
  const px = w * 0.08, py = h * 0.6, pw = w * 0.62, ph = h * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 22);
  const water = ctx.createLinearGradient(px, py, px + pw, py + ph);
  water.addColorStop(0, '#25d3c4');
  water.addColorStop(0.5, '#0e9fb6');
  water.addColorStop(1, '#0a5d8f');
  ctx.fillStyle = water;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(220,255,255,${0.05 + rnd() * 0.2})`;
    ctx.lineWidth = 1 + rnd() * 3;
    const yy = py + rnd() * ph;
    ctx.beginPath();
    ctx.moveTo(px + rnd() * pw, yy);
    ctx.bezierCurveTo(px + pw * 0.3, yy - 10, px + pw * 0.6, yy + 12, px + pw, yy - 4);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const bx = px + rnd() * pw, by = py + rnd() * ph, br = 10 + rnd() * 60;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.14})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // coping
  ctx.strokeStyle = '#f6e3cb';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.roundRect(px - 4, py - 4, pw + 8, ph + 8, 24);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,70,70,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px - 13, py - 13, pw + 26, ph + 26, 28);
  ctx.stroke();

  // umbrella
  const ux = w * 0.78, uy = h * 0.5;
  ctx.fillStyle = 'rgba(90,45,60,0.28)';
  ctx.beginPath();
  ctx.ellipse(ux + 12, h * 0.865, w * 0.032, w * 0.011, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4b3a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(ux, uy);
  ctx.lineTo(ux + 10, h * 0.86);
  ctx.stroke();
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    ctx.fillStyle = i % 2 ? '#ff5f7e' : '#fff3e2';
    ctx.beginPath();
    ctx.moveTo(ux, uy - h * 0.02);
    ctx.arc(ux, uy - h * 0.02, w * 0.12, Math.PI + (i / seg) * Math.PI, Math.PI + ((i + 1) / seg) * Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  grain(ctx, w, h, rnd, 0.04);
}

function grain(ctx, w, h, rnd, alpha) {
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const nc = n.getContext('2d');
  const img = nc.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 190;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nc.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(n, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

window.paintScene = (name, ctx, w, h, rnd) => ({ sunsetPalms, nightDrive, poolside }[name])(ctx, w, h, rnd);
window.mulberrySeed = mulberry;
