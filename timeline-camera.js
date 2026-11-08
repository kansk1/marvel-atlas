'use strict';

function createTimelineCamera(viewport, world, controls) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const maxScale = 2.5;
  const pointers = new Map();
  let scene = { width: 1, height: 1, lanes: [] };
  let view = { x: 0, y: 0, scale: 1 };
  let screen = { width: 1, height: 1 };
  let frame = 0;
  let fitted = false;
  let gesture;
  let moved = false;
  const miniViewport = document.createElementNS(svgNamespace, 'rect');
  miniViewport.setAttribute('class', 'mini-viewport');

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function measure() {
    screen = { width: Math.max(1, viewport.clientWidth), height: Math.max(1, viewport.clientHeight - 65) };
  }

  function fitScale() {
    return Math.max(.025, Math.min(
      Math.max(1, screen.width - 30) / scene.width,
      Math.max(1, screen.height - 52) / scene.height,
      1.25
    ));
  }

  function minScale() {
    return Math.min(.28, fitScale());
  }

  function limitOrigin(origin, size, available) {
    return size <= available ? clamp(origin, 0, available - size) : clamp(origin, available - size - 72, 72);
  }

  function draw() {
    frame = 0;
    const { x, y, scale } = view;
    world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    const grid = Math.max(9, 23 * scale);
    viewport.style.setProperty('--grid-step', grid + 'px');
    viewport.style.setProperty('--grid-x', x % grid + 'px');
    viewport.style.setProperty('--grid-y', y % grid + 'px');
    const label = Math.round(scale * 100) + '%';
    if (controls.value.value !== label) controls.value.value = label;
    controls.out.disabled = scale <= minScale() + .0001;
    controls.in.disabled = scale >= maxScale - .0001;
    miniViewport.setAttribute('x', -x / scale);
    miniViewport.setAttribute('y', -y / scale);
    miniViewport.setAttribute('width', screen.width / scale);
    miniViewport.setAttribute('height', screen.height / scale);
  }

  function update(x, y, scale, isFit = false) {
    fitted = isFit;
    view = {
      x: limitOrigin(x, scene.width * scale, screen.width),
      y: limitOrigin(y, scene.height * scale, screen.height),
      scale,
    };
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function fit() {
    const scale = fitScale();
    update((screen.width - scene.width * scale) / 2, (screen.height - scene.height * scale) / 2, scale, true);
  }

  function setScene(nextScene) {
    scene = nextScene;
    measure();
    world.style.width = scene.width + 'px';
    world.style.height = scene.height + 'px';
    controls.miniSvg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
    const marks = scene.lanes.map(lane => {
      const rect = document.createElementNS(svgNamespace, 'rect');
      rect.setAttribute('x', lane.x);
      rect.setAttribute('y', lane.y + 48);
      rect.setAttribute('width', lane.width);
      rect.setAttribute('height', 128);
      rect.setAttribute('rx', 12);
      rect.setAttribute('class', lane.kind === 'timeline' ? 'mini-main' : 'mini-alt');
      return rect;
    });
    controls.miniSvg.replaceChildren(...marks, miniViewport);
    update(24, 48, screen.width < 660 ? .76 : .94);
  }

  function zoomAt(factor, point = { x: screen.width / 2, y: screen.height / 2 }) {
    const scale = clamp(view.scale * factor, minScale(), maxScale);
    const ratio = scale / view.scale;
    update(point.x - (point.x - view.x) * ratio, point.y - (point.y - view.y) * ratio, scale);
  }

  function focus(position, sheetOpen = false) {
    const scale = Math.max(view.scale, .72);
    const x = screen.width * (sheetOpen && screen.width > 660 ? .34 : .5);
    const y = screen.height * (sheetOpen && screen.width <= 660 ? .23 : .45);
    update(x - (position.x + position.width / 2) * scale, y - (position.y + position.height / 2) * scale, scale);
  }

  function reveal(position) {
    const left = view.x + position.x * view.scale;
    const top = view.y + position.y * view.scale;
    const right = left + position.width * view.scale;
    const bottom = top + position.height * view.scale;
    if (left < 0 || top < 0 || right > screen.width || bottom > screen.height) focus(position);
  }

  function keepAbove(position, sheetTop) {
    const top = view.y + position.y * view.scale;
    const bottom = top + position.height * view.scale;
    if (bottom < sheetTop - 10 && top >= 38) return;
    const target = Math.max(38, sheetTop - 14 - position.height * view.scale);
    update(view.x, target - position.y * view.scale, view.scale);
  }

  const positionOf = event => {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function measureGesture() {
    const [a, b] = pointers.values();
    if (!b) return { center: a, distance: 0 };
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  function startMoving() {
    moved = true;
    viewport.classList.add('is-moving');
    for (const id of pointers.keys()) viewport.setPointerCapture(id);
  }

  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size >= 2) return;
    if (!pointers.size) moved = false;
    pointers.set(event.pointerId, positionOf(event));
    gesture = { ...measureGesture(), view };
    if (pointers.size === 2) startMoving();
  });

  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, positionOf(event));
    const { center, distance } = measureGesture();
    const initial = gesture.view;
    if (!moved && Math.hypot(center.x - gesture.center.x, center.y - gesture.center.y) < 6) return;
    if (!moved) startMoving();
    const scale = gesture.distance ? clamp(initial.scale * distance / gesture.distance, minScale(), maxScale) : initial.scale;
    const ratio = scale / initial.scale;
    update(center.x - (gesture.center.x - initial.x) * ratio, center.y - (gesture.center.y - initial.y) * ratio, scale);
  });

  function finishPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    gesture = pointers.size ? { ...measureGesture(), view } : undefined;
    if (!pointers.size) viewport.classList.remove('is-moving');
  }

  viewport.addEventListener('pointerup', finishPointer);
  viewport.addEventListener('pointercancel', finishPointer);
  viewport.addEventListener('lostpointercapture', event => {
    if (event.target === viewport) finishPointer(event);
  });
  viewport.addEventListener('pointerleave', event => {
    if (!moved && event.pointerType === 'mouse') finishPointer(event);
  });
  viewport.addEventListener('click', event => {
    if (!moved || !event.detail) return;
    moved = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? screen.height : 1;
    if (event.ctrlKey || event.metaKey) {
      zoomAt(Math.exp(clamp(-event.deltaY * unit * .0025, -1, 1)), positionOf(event));
    } else {
      update(view.x - event.deltaX * unit, view.y - event.deltaY * unit, view.scale);
    }
  }, { passive: false });

  const keys = {
    ArrowLeft: () => update(view.x + 110, view.y, view.scale),
    ArrowRight: () => update(view.x - 110, view.y, view.scale),
    ArrowUp: () => update(view.x, view.y + 110, view.scale),
    ArrowDown: () => update(view.x, view.y - 110, view.scale),
    '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(.8), '0': fit,
  };
  viewport.addEventListener('keydown', event => {
    if (!Object.hasOwn(keys, event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    keys[event.key]();
  });
  controls.out.addEventListener('click', () => zoomAt(.8));
  controls.in.addEventListener('click', () => zoomAt(1.25));
  controls.fit.addEventListener('click', fit);
  controls.minimap.addEventListener('click', event => {
    const matrix = controls.miniSvg.getScreenCTM();
    if (!event.detail || !matrix) {
      fit();
      return;
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    update(screen.width / 2 - point.x * view.scale, screen.height / 2 - point.y * view.scale, view.scale);
  });
  new ResizeObserver(() => {
    measure();
    if (fitted) fit();
    else update(view.x, view.y, view.scale);
  }).observe(viewport);

  return { setScene, focus, reveal, keepAbove };
}
