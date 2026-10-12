import * as THREE from 'three';
import { rooms, items } from './data/scene-config.js';
import { toWorld, rawBoxToWorld } from './world.js';
import { createFocus } from './focus.js';

// Ceiling height is 245 cm; once the camera rises above this we slice the ceiling away so the
// apartment reads as a cut-away model instead of a roof.
const CUT_HEIGHT = 2.3;
// Transitions between eye-level stops hop over the walls instead of flying through them.
const HOP_HEIGHT = 4.2;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function startTour(app) {
  const { camera, ceilingCut } = app;

  const stops = rooms.map((r) => ({ ...r, pos: toWorld(r.cam), lookAt: toWorld(r.look) }));
  for (const item of items) {
    item.box = rawBoxToWorld(item.min, item.max);
    item.fromWorld = toWorld(item.from);
    item.roomIndex = rooms.findIndex((r) => r.id === item.room);
  }

  const sections = buildSections(stops);
  const nav = buildNav(stops);
  const pins = buildPins();

  // --- scroll → tour progress -------------------------------------------------------------
  let target = 0;
  let progress = 0;
  const readScroll = () => {
    target = Math.min(stops.length - 1, Math.max(0, window.scrollY / window.innerHeight));
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  progress = target;

  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50 };
  function poseAt(s) {
    const i = Math.min(Math.floor(s), stops.length - 2);
    const f = s - i;
    const a = stops[i];
    const b = stops[i + 1];
    // Hold on each stop for a moment before moving on.
    const e = smoothstep(0.1, 0.9, f);
    pose.pos.lerpVectors(a.pos, b.pos, e);
    pose.look.lerpVectors(a.lookAt, b.lookAt, e);
    pose.fov = THREE.MathUtils.lerp(a.fov, b.fov, e);
    const hop = Math.max(0, HOP_HEIGHT - pose.pos.y) * Math.pow(Math.sin(Math.PI * e), 0.6);
    pose.pos.y += a.pos.distanceTo(b.pos) > 1 ? hop : 0;
    return pose;
  }

  const focus = createFocus(app, {
    getReturnPose: () => {
      const p = poseAt(progress);
      return { pos: p.pos.clone(), look: p.look.clone(), fov: p.fov };
    },
    onEnter: () => {
      document.documentElement.classList.add('locked');
      hideHover();
    },
    onExit: () => document.documentElement.classList.remove('locked'),
  });
  pins.forEach((pin) => pin.el.addEventListener('click', () => focus.enter(pin.item)));
  sections.forEach((s) =>
    s.chips.forEach((chip) => chip.el.addEventListener('click', () => focus.enter(chip.item))),
  );

  // --- hover / click on furniture -----------------------------------------------------------
  const hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xd9772b);
  hoverBox.visible = false;
  app.scene.add(hoverBox);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let hovered = null;

  function itemUnderPointer(e) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const room = Math.round(progress);
    let best = null;
    let bestDist = Infinity;
    for (const item of items) {
      if (item.roomIndex !== room) continue;
      if (raycaster.ray.intersectBox(item.box, hit)) {
        const d = hit.distanceTo(camera.position);
        if (d < bestDist) [best, bestDist] = [item, d];
      }
    }
    return best;
  }
  function showHover(item) {
    hovered = item;
    hoverBox.box.copy(item.box);
    hoverBox.visible = true;
    document.body.style.cursor = 'pointer';
  }
  function hideHover() {
    hovered = null;
    hoverBox.visible = false;
    document.body.style.cursor = '';
  }
  app.renderer.domElement.addEventListener('pointermove', (e) => {
    if (focus.active || Math.abs(progress - Math.round(progress)) > 0.12) return hideHover();
    const item = itemUnderPointer(e);
    item ? showHover(item) : hideHover();
  });
  app.renderer.domElement.addEventListener('click', () => hovered && focus.enter(hovered));

  // --- per-frame ----------------------------------------------------------------------------
  const timer = new THREE.Timer();
  const projected = new THREE.Vector3();
  app.onTick(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    progress += (target - progress) * (1 - Math.exp(-dt * 5));
    if (Math.abs(target - progress) < 1e-4) progress = target;

    if (!focus.active) {
      const p = poseAt(progress);
      camera.position.copy(p.pos);
      app.lookTarget.copy(p.look);
      if (camera.fov !== p.fov) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
    }
    ceilingCut.constant = camera.position.y > CUT_HEIGHT ? CUT_HEIGHT : 100;

    const active = Math.round(progress);
    const settled = Math.abs(progress - active) < 0.12 && !focus.active;
    sections.forEach((s, i) => s.el.classList.toggle('current', i === active));
    nav.forEach((n, i) => n.classList.toggle('current', i === active));
    for (const pin of pins) {
      const show = settled && pin.item.roomIndex === active;
      if (show) {
        projected.copy(pin.anchor).project(camera);
        const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
        pin.el.style.transform = `translate(${((projected.x + 1) / 2) * window.innerWidth}px, ${((1 - projected.y) / 2) * window.innerHeight}px)`;
        pin.el.classList.toggle('show', visible);
      } else {
        pin.el.classList.remove('show');
      }
    }
  });
}

function buildSections(stops) {
  const main = document.querySelector('#sections');
  return stops.map((stop, i) => {
    const section = document.createElement('section');
    section.className = 'stop';
    section.id = stop.id;
    const roomItems = items.filter((it) => it.room === stop.id);
    section.innerHTML = `
      <div class="card">
        <span class="kicker">${String(i).padStart(2, '0')} · ${stop.kicker}</span>
        <h2>${stop.title}</h2>
        <p>${stop.text}</p>
        ${roomItems.length ? '<div class="chips"></div>' : ''}
        ${i === 0 ? '<div class="scroll-hint">Kaydırarak gezin ↓</div>' : ''}
      </div>`;
    const chipBox = section.querySelector('.chips');
    const chips = roomItems.map((item) => {
      const el = document.createElement('button');
      el.className = 'chip';
      el.textContent = item.name;
      chipBox.append(el);
      return { el, item };
    });
    main.append(section);
    return { el: section, chips };
  });
}

function buildNav(stops) {
  const nav = document.querySelector('#nav');
  return stops.map((stop, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span>${stop.title}</span>`;
    btn.setAttribute('aria-label', stop.title);
    btn.addEventListener('click', () => window.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' }));
    nav.append(btn);
    return btn;
  });
}

function buildPins() {
  const layer = document.querySelector('#pins');
  return items.map((item) => {
    const el = document.createElement('button');
    el.className = 'pin';
    el.innerHTML = `<i></i><span>${item.name}</span>`;
    layer.append(el);
    const center = item.box.getCenter(new THREE.Vector3());
    const anchor = new THREE.Vector3(center.x, Math.min(item.box.max.y + 0.08, 2.1), center.z);
    return { el, item, anchor };
  });
}
