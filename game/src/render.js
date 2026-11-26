// Island Hopper — everything the eye sees: golden-hour sky and sea, the island
// chain with its strips, the glowing rings, squall rain, the bush plane, and a
// lit HUD (airspeed and altitude dials, attitude ball, compass tape, fuel and
// damage bars, throttle lever). Canvas 2D only, no images, no network.
import { FEET_PER_M, KNOTS_PER_MS, PALETTE, SCALE, VIEW } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

/** The plane is drawn bigger than life so it reads at 1.6 px/m. */
const PLANE_DRAW_SCALE = 4.5;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const clouds = [];
  const cloudRandom = createRandom(20261126);
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: cloudRandom.range(-500, 11500),
      y: cloudRandom.range(300, 520),
      size: cloudRandom.range(50, 150),
      speed: cloudRandom.range(2, 6),
    });
  }
  const camera = { x: 0, y: 0, scale: SCALE, ready: false };

  function worldToScreen(x, y) {
    return { x: (x - camera.x) * camera.scale, y: VIEW.height - (y - camera.y) * camera.scale };
  }

  function drawSky(state) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.45, PALETTE.skyMid);
    g.addColorStop(0.75, PALETTE.skyLow);
    g.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Low sun, upper right, with a warm halo.
    const sunX = VIEW.width - 190;
    const sunY = 118;
    const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    halo.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    halo.addColorStop(0.25, 'rgba(255, 214, 130, 0.55)');
    halo.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds(state) {
    ctx.fillStyle = 'rgba(255, 250, 240, 0.85)';
    for (const cloud of clouds) {
      const drift = (cloud.x + state.elapsed * cloud.speed) % 12000;
      const p = worldToScreen(drift, cloud.y);
      if (p.x < -200 || p.x > VIEW.width + 200) continue;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cloud.size, cloud.size * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + cloud.size * 0.55, p.y + 6, cloud.size * 0.6, cloud.size * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - cloud.size * 0.55, p.y + 8, cloud.size * 0.55, cloud.size * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSea(state, world) {
    const horizon = worldToScreen(0, 0);
    const g = ctx.createLinearGradient(0, horizon.y, 0, VIEW.height);
    g.addColorStop(0, PALETTE.seaShallow);
    g.addColorStop(0.35, '#1a8fb0');
    g.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, horizon.y), VIEW.width, VIEW.height - Math.max(0, horizon.y));
    // Sun glitter and slow swell lines, both functions of elapsed time only.
    ctx.strokeStyle = 'rgba(255, 240, 190, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      const wx = ((i * 173 + state.elapsed * 12) % (VIEW.width + 120)) - 60;
      const wy = horizon.y + 24 + ((i * 47) % 180);
      if (wy > VIEW.height - 8) continue;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 46 + (i % 3) * 18, wy);
      ctx.stroke();
    }
  }

  function drawPalm(x, y, lean, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(3, -size * 0.55, 8, -size);
    ctx.stroke();
    ctx.fillStyle = '#2f8a3d';
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI * (0.15 + i * 0.17);
      ctx.beginPath();
      ctx.moveTo(8, -size);
      ctx.quadraticCurveTo(8 + Math.cos(a) * size * 0.6, -size + Math.sin(a) * size * 0.55, 8 + Math.cos(a) * size, -size + Math.sin(a) * size * 0.9 + 4);
      ctx.quadraticCurveTo(8 + Math.cos(a) * size * 0.5, -size + Math.sin(a) * size * 0.4, 8, -size);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawIslets(state, world) {
    const left = camera.x - 60;
    const right = camera.x + VIEW.width / camera.scale + 60;
    for (const islet of world.islets) {
      if (islet.centre + islet.halfWidth < left || islet.centre - islet.halfWidth > right) continue;
      ctx.beginPath();
      let first = true;
      for (let x = Math.max(left, islet.centre - islet.halfWidth); x <= Math.min(right, islet.centre + islet.halfWidth); x += 6) {
        const p = worldToScreen(x, world.terrainHeight(x));
        if (first) {
          ctx.moveTo(p.x, VIEW.height);
          ctx.lineTo(p.x, p.y);
          first = false;
        } else ctx.lineTo(p.x, p.y);
      }
      const last = worldToScreen(Math.min(right, islet.centre + islet.halfWidth), 0);
      ctx.lineTo(last.x, VIEW.height);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, worldToScreen(0, islet.height).y, 0, VIEW.height);
      g.addColorStop(0, PALETTE.sand);
      g.addColorStop(0.5, PALETTE.grass);
      g.addColorStop(1, PALETTE.jungle);
      ctx.fillStyle = g;
      ctx.fill();
      const rng = createRandom(Math.floor(islet.centre * 3 + 5));
      for (let i = 0; i < 2; i += 1) {
        const px = islet.centre + rng.range(-islet.halfWidth * 0.5, islet.halfWidth * 0.5);
        const p = worldToScreen(px, world.terrainHeight(px));
        drawPalm(p.x, p.y, rng.range(-0.12, 0.12), rng.range(13, 20));
      }
    }
  }

  function drawIslands(state, world) {
    const left = camera.x - 60;
    const right = camera.x + VIEW.width / camera.scale + 60;
    for (const island of world.islands) {
      if (island.centre + island.halfWidth < left || island.centre - island.halfWidth > right) continue;
      // Terrain silhouette, sampled every 8 m.
      ctx.beginPath();
      let first = true;
      for (let x = Math.max(left, island.centre - island.halfWidth); x <= Math.min(right, island.centre + island.halfWidth); x += 8) {
        const p = worldToScreen(x, world.terrainHeight(x));
        if (first) {
          ctx.moveTo(p.x, VIEW.height);
          ctx.lineTo(p.x, p.y);
          first = false;
        } else ctx.lineTo(p.x, p.y);
      }
      const last = worldToScreen(Math.min(right, island.centre + island.halfWidth), 0);
      ctx.lineTo(last.x, VIEW.height);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, worldToScreen(0, island.height).y, 0, VIEW.height);
      g.addColorStop(0, PALETTE.grass);
      g.addColorStop(0.55, PALETTE.jungle);
      g.addColorStop(1, '#1e5230');
      ctx.fillStyle = g;
      ctx.fill();
      // Sand rim where the island meets the sea.
      ctx.strokeStyle = PALETTE.sand;
      ctx.lineWidth = 5;
      ctx.beginPath();
      first = true;
      for (let x = Math.max(left, island.centre - island.halfWidth); x <= Math.min(right, island.centre + island.halfWidth); x += 8) {
        const h = world.terrainHeight(x);
        if (h > 6) continue;
        const p = worldToScreen(x, h);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // Palms and huts, placed deterministically from the island centre.
      const rng = createRandom(Math.floor(island.centre * 7 + 11));
      for (let i = 0; i < 7; i += 1) {
        const px = island.centre + rng.range(-island.halfWidth * 0.8, island.halfWidth * 0.8);
        const py = world.terrainHeight(px);
        if (py < 4 || Math.abs(px - island.runwayCentre) < 190) continue;
        const p = worldToScreen(px, py);
        drawPalm(p.x, p.y, rng.range(-0.14, 0.14), rng.range(16, 26));
      }
      const hutX = island.runway.start - 70;
      const hut = worldToScreen(hutX, world.terrainHeight(hutX));
      ctx.fillStyle = '#b5763f';
      ctx.fillRect(hut.x - 12, hut.y - 16, 26, 16);
      ctx.fillStyle = '#8a5a2e';
      ctx.beginPath();
      ctx.moveTo(hut.x - 15, hut.y - 16);
      ctx.lineTo(hut.x + 1, hut.y - 28);
      ctx.lineTo(hut.x + 17, hut.y - 16);
      ctx.closePath();
      ctx.fill();
      // Island name, floating over the strip.
      const label = worldToScreen(island.runwayCentre, island.height + 26);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(island.name.toUpperCase(), label.x, label.y);
      drawRunway(state, world, island);
    }
  }

  function drawRunway(state, world, island) {
    const r = island.runway;
    const a = worldToScreen(r.start, island.height);
    const b = worldToScreen(r.end, island.height);
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(a.x, a.y - 4, b.x - a.x, 7);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let x = r.start + 10; x < r.end - 6; x += 24) {
      const p = worldToScreen(x, island.height);
      ctx.fillRect(p.x, a.y - 1.5, 12, 3);
    }
    // Threshold bars and the "09" designator.
    ctx.fillRect(a.x + 2, a.y - 4, 4, 7);
    ctx.fillRect(b.x - 6, a.y - 4, 4, 7);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('09', a.x + 12, a.y - 8);
    // Windsock by the threshold, leaning with the wind.
    const wind = world.windAt(island.runwayCentre, island.height + 10, state.elapsed);
    const sock = worldToScreen(r.start + 14, island.height);
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y - 4);
    ctx.lineTo(sock.x, sock.y - 26);
    ctx.stroke();
    ctx.fillStyle = '#ff7f2a';
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y - 26);
    ctx.lineTo(sock.x + (wind >= 0 ? 14 : -14), sock.y - 22);
    ctx.lineTo(sock.x, sock.y - 18);
    ctx.closePath();
    ctx.fill();
  }

  function drawRings(state, world) {
    for (const ring of world.rings) {
      if (ring.leg !== state.leg) continue;
      const p = worldToScreen(ring.x, ring.y);
      if (p.x < -80 || p.x > VIEW.width + 80) continue;
      const radius = ring.radius * camera.scale;
      ctx.save();
      ctx.globalAlpha = ring.hit ? 0.35 : 1;
      ctx.strokeStyle = ring.hit ? '#7dff9a' : '#ffd166';
      ctx.lineWidth = 7;
      ctx.shadowColor = ring.hit ? '#7dff9a' : '#ffd166';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSquall(state, world) {
    const squall = world.inSquall(state.plane.x, state.elapsed);
    if (!squall) return;
    // Rain curtains across the squall band, plus a dimming veil.
    ctx.fillStyle = 'rgba(40, 60, 90, 0.18)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.5)';
    ctx.lineWidth = 1.5;
    const start = squall.start + squall.drift * state.elapsed;
    for (let i = 0; i < 90; i += 1) {
      const wx = start + ((i * 97.3) % squall.width);
      const p = worldToScreen(wx, 40 + ((i * 53.7) % 380));
      if (p.x < -20 || p.x > VIEW.width + 20) continue;
      const fall = (state.elapsed * 260 + i * 31) % 90;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + fall);
      ctx.lineTo(p.x - 6, p.y + fall + 16);
      ctx.stroke();
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    const p = worldToScreen(plane.x, plane.y);
    // Shadow on the ground or sea below, for depth.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#06283a';
    const ground = worldToScreen(plane.x, 0);
    const h = Math.max(0, Math.min(1, 1 - (plane.y - 30) / 260));
    ctx.beginPath();
    ctx.ellipse(p.x, Math.min(VIEW.height - 6, ground.y), 26 * h + 4, 5 * h + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-plane.pitch);
    ctx.scale(PLANE_DRAW_SCALE, PLANE_DRAW_SCALE);
    // High wing, cream with red tips.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-1.2, -1.5);
    ctx.lineTo(1.4, -1.5);
    ctx.lineTo(1.7, -1.1);
    ctx.lineTo(-1.5, -1.1);
    ctx.closePath();
    ctx.fill();
    // Tail: fin and stabiliser.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-4.4, -0.4);
    ctx.lineTo(-5.4, -2.2);
    ctx.lineTo(-4.6, -2.2);
    ctx.lineTo(-3.8, -0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeWing;
    ctx.fillRect(-5.6, -0.7, 1.6, 0.35);
    // Fuselage: rounded red body, yellow cheatline, blue windows.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-4.6, -0.9);
    ctx.quadraticCurveTo(-4.8, 0.4, -3.4, 0.75);
    ctx.lineTo(3.6, 0.75);
    ctx.quadraticCurveTo(4.9, 0.5, 5.0, -0.2);
    ctx.quadraticCurveTo(4.9, -0.9, 3.8, -0.95);
    ctx.lineTo(-3.6, -0.95);
    ctx.quadraticCurveTo(-4.4, -0.95, -4.6, -0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.fillRect(-3.4, -0.15, 8.2, 0.28);
    ctx.fillStyle = '#bfe6f2';
    ctx.beginPath();
    ctx.moveTo(1.6, -0.85);
    ctx.lineTo(3.4, -0.85);
    ctx.lineTo(3.2, -0.25);
    ctx.lineTo(1.6, -0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#bfe6f2';
    ctx.fillRect(-0.6, -0.8, 1.4, 0.55);
    // Tundra tyres and struts.
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(-1.6, 0.7);
    ctx.lineTo(-2.0, 1.7);
    ctx.moveTo(1.8, 0.7);
    ctx.lineTo(2.2, 1.7);
    ctx.stroke();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(-2.0, 1.9, 0.62, 0, Math.PI * 2);
    ctx.arc(2.2, 1.9, 0.62, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: spinning disc when the engine runs.
    const spin = state.elapsed * (6 + plane.throttle * 42);
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.85)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.ellipse(5.1, -0.1, 0.35, 2.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(5.1, -0.1);
    ctx.rotate(spin);
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -2.5);
    ctx.lineTo(0, 2.5);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawTargetArrow(state, world) {
    const target = world.nextTarget();
    const p = worldToScreen(target.x, target.y);
    if (p.x > 60 && p.x < VIEW.width - 60) return;
    const dir = p.x >= VIEW.width - 60 ? 1 : -1;
    const ax = dir > 0 ? VIEW.width - 46 : 46;
    // Keep the arrow above the throttle lever and its flaps/gear chip.
    const ay = Math.max(90, Math.min(VIEW.height - 290, p.y));
    const distNm = Math.max(0, Math.abs(target.x - state.plane.x) / 1852).toFixed(1);
    ctx.save();
    ctx.fillStyle = 'rgba(10, 30, 46, 0.65)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(ax + dir * 14, ay);
    ctx.lineTo(ax - dir * 8, ay - 10);
    ctx.lineTo(ax - dir * 8, ay + 10);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${target.kind === 'ring' ? 'RING' : 'STRIP'} ${distNm} NM`, ax, ay + 42);
    ctx.restore();
  }

  function drawDial(cx, cy, radius, label, value, max, unit) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(8, 24, 38, 0.82)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - 12), Math.sin(a) * (radius - 12));
      ctx.lineTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
      ctx.stroke();
    }
    const angle = -Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max))) * Math.PI * 1.5;
    ctx.strokeStyle = '#ff5a3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * (radius - 14), Math.sin(angle) * (radius - 14));
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(label, 0, radius - 14);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(value)}`, 0, radius - 30);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(unit, 0, radius - 44 < -radius + 18 ? radius - 44 : -radius + 18);
    ctx.restore();
  }

  function drawAttitude(cx, cy, radius, pitch, bankNote) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    const horizon = -pitch * radius * 1.4;
    ctx.fillStyle = '#c98d4b';
    ctx.fillRect(-radius, horizon, radius * 2, radius * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius, horizon);
    ctx.lineTo(radius, horizon);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('ATT', cx, cy + radius - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(bankNote, cx, cy - radius - 8);
  }

  function drawHud(state, world) {
    const plane = state.plane;
    const speedKts = plane.speed * KNOTS_PER_MS;
    const altFt = Math.max(0, plane.y * FEET_PER_M);
    const vsFpm = state.vs * FEET_PER_M * 60;
    const wind = world.windAt(plane.x, plane.y, state.elapsed);
    const dest = world.islands[state.leg + 1];

    // Top bar.
    ctx.fillStyle = 'rgba(8, 24, 38, 0.78)';
    ctx.fillRect(0, 0, VIEW.width, 64);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, 64, VIEW.width, 2);
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('SPD', 18, 20);
    ctx.fillText('ALT', 118, 20);
    ctx.fillText('V/S', 218, 20);
    ctx.fillText('HDG', 318, 20);
    ctx.fillText('WIND', 408, 20);
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(speedKts)}`, 18, 48);
    ctx.fillText(`${Math.round(altFt)}`, 118, 48);
    ctx.fillText(`${vsFpm >= 0 ? '+' : ''}${Math.round(vsFpm)}`, 218, 48);
    ctx.fillText('090°', 318, 48);
    ctx.fillText(`${wind >= 0 ? '◀' : '▶'} ${Math.abs(Math.round(wind * KNOTS_PER_MS))} kt`, 408, 48);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('KT', 74, 48);
    ctx.fillText('FT', 180, 48);
    ctx.fillText('FPM', 288, 48);

    // Compass tape, centre top.
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('◀ 060 · 075 · 090 · 105 · 120 ▶', VIEW.width / 2, 24);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`LEG ${state.leg + 1}/3 · ${world.islands[state.leg].name.toUpperCase()} → ${dest ? dest.name.toUpperCase() : 'DONE'}`, VIEW.width / 2, 48);

    // Score, fuel, damage — right side.
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('SCORE', VIEW.width - 18, 20);
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${state.score}`, VIEW.width - 18, 48);
    drawBar(VIEW.width - 330, 16, 130, 10, plane.fuel / 100, plane.fuel > 25 ? '#7dff9a' : '#ff5a3c', 'FUEL');
    drawBar(VIEW.width - 330, 40, 130, 10, 1 - plane.damage / 100, plane.damage < 60 ? '#7fb6d9' : '#ff5a3c', 'HULL');

    // Lit instruments, bottom-left.
    drawDial(66, VIEW.height - 66, 52, 'AIRSPEED', speedKts, 160, 'KT');
    drawDial(186, VIEW.height - 66, 52, 'ALTITUDE', altFt, 1500, 'FT');
    drawAttitude(306, VIEW.height - 66, 52, plane.pitch, plane.airborne ? (plane.speed < 24 ? 'STALL!' : 'LEVEL') : 'ON GROUND');

    // Throttle lever, bottom-right (also the mouse drag target).
    const leverX = VIEW.width - 60;
    const leverTop = VIEW.height - 190;
    const leverBottom = VIEW.height - 60;
    ctx.fillStyle = 'rgba(8, 24, 38, 0.82)';
    ctx.fillRect(leverX - 34, leverTop - 24, 68, leverBottom - leverTop + 48);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(leverX - 34, leverTop - 24, 68, leverBottom - leverTop + 48);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(leverX - 3, leverTop, 6, leverBottom - leverTop);
    const handleY = leverBottom - plane.throttle * (leverBottom - leverTop);
    ctx.fillStyle = plane.throttle > 0.85 ? '#ff5a3c' : '#ffd166';
    ctx.fillRect(leverX - 16, handleY - 7, 32, 14);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('THR', leverX, leverTop - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, leverX, leverBottom + 18);
    // Flaps and gear state on a dark chip, so it reads against sky or sea.
    ctx.fillStyle = 'rgba(8, 24, 38, 0.82)';
    ctx.beginPath();
    ctx.roundRect(leverX - 164, leverTop - 6, 150, 48, 6);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = plane.flaps ? '#7dff9a' : 'rgba(255,255,255,0.55)';
    ctx.fillText(`FLAPS ${plane.flaps ? 'DOWN' : 'UP'}  [F]`, leverX - 156, leverTop + 12);
    ctx.fillStyle = plane.gear ? '#7dff9a' : '#ff5a3c';
    ctx.fillText(`GEAR ${plane.gear ? 'DOWN' : 'UP'}  [G]`, leverX - 156, leverTop + 32);

    // Toast message under the top bar.
    if (state.message && state.elapsed - state.messageAt < 4.5) {
      ctx.font = 'bold 17px system-ui, sans-serif';
      const w = ctx.measureText(state.message).width + 36;
      ctx.fillStyle = 'rgba(8, 24, 38, 0.8)';
      ctx.beginPath();
      ctx.roundRect((VIEW.width - w) / 2, 78, w, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW.width / 2, 100);
    }
    drawTargetArrow(state, world);
  }

  function drawBar(x, y, w, h, fraction, color, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(label, x, y - 4);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 20, 34, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(title, VIEW.width / 2, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 300 + i * 32);
    });
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(6, 20, 34, 0.35)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('A BUSH-PLANE RUN ACROSS THE TROPICS', VIEW.width / 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillText('ISLAND HOPPER', VIEW.width / 2, 240);
    ctx.shadowBlur = 0;
    ctx.font = '21px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText('Fly three legs between four island strips. Mind the wind, mind the fuel,', VIEW.width / 2, 292);
    ctx.fillText('thread the golden rings — and put her down soft on a short strip.', VIEW.width / 2, 322);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('↑ ↓ pitch      ← → throttle      F flaps      G gear      SPACE brakes      P pause', VIEW.width / 2, 392);
    ctx.fillText('Mouse: drag the throttle lever, bottom-right.', VIEW.width / 2, 420);
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#7dff9a';
    ctx.fillText('PRESS ENTER OR CLICK TO FLY', VIEW.width / 2, 480);
    if (best > 0) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`Best score: ${best}`, VIEW.width / 2, 522);
    }
  }

  function drawCrash(state) {
    overlay('CRASHED', [
      state.crashReason || 'The flight ended badly.',
      `Score ${state.score} · rings ${state.ringsHit} of 9 · leg ${state.leg + 1} of 3`,
      'Press R to fly the route again.',
    ], '#ff5a3c');
  }

  function drawComplete(state) {
    const ringPts = state.ringsHit * 100;
    overlay('ROUTE COMPLETE!', [
      `All four islands, three soft landings — the mail got through.`,
      `Rings ${state.ringsHit} of 9 · ${ringPts} pts from rings`,
      `Final score ${state.score}`,
      'Press R to fly it again, faster and softer.',
    ], '#7dff9a');
  }

  function drawPaused() {
    overlay('PAUSED', ['Press P to keep flying.', 'Press R to restart the route.'], '#ffd166');
  }

  return {
    draw(world, screen, best, snap) {
      const state = world.state;
      // Zoom out when high and far from the next target, so the next island and
      // ring stay in frame; zoom in low, where the strip fills the view.
      const target = world.nextTarget();
      const distToTarget = Math.abs(target.x - state.plane.x);
      const targetScale = state.plane.y < 60
        ? SCALE
        : Math.max(0.85, Math.min(SCALE, 1000 / Math.max(600, distToTarget)));
      // On the title screen the plane sits right of the instrument dials.
      const planeScreenX = screen === SCREEN_TITLE ? 500 : 380;
      const targetX = state.plane.x - planeScreenX / targetScale;
      const targetY = Math.max(-30, Math.min(500, state.plane.y - 390 / targetScale));
      if (!camera.ready || snap) {
        camera.x = targetX;
        camera.y = targetY;
        camera.scale = targetScale;
        camera.ready = true;
      } else {
        camera.x += (targetX - camera.x) * 0.1;
        camera.y += (targetY - camera.y) * 0.1;
        camera.scale += (targetScale - camera.scale) * 0.06;
      }
      drawSky(state);
      drawClouds(state);
      drawSea(state, world);
      drawIslets(state, world);
      drawIslands(state, world);
      drawRings(state, world);
      drawSquall(state, world);
      drawPlane(state);
      drawHud(state, world);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_OVER) drawCrash(state);
      else if (screen === SCREEN_COMPLETE) drawComplete(state);
      else if (screen === SCREEN_PAUSED) drawPaused();
    },
  };
}
