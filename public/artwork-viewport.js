// One coordinate model for the full artwork and the evidence spotlight.
// Offsets are viewport pixels; artwork coordinates stay normalized to the source.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function pageFit(width, height, pageWidth, pageHeight, padding = 18) {
  const ratio = Math.max(1, pageWidth) / Math.max(1, pageHeight);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const fitWidth = Math.min(usableWidth, usableHeight * ratio);
  return { width, height, pageWidth: fitWidth, pageHeight: fitWidth / ratio, padding };
}

export function constrainView(view, layout, maxScale = 4) {
  const scale = clamp(Number(view.scale) || 1, 1, maxScale);
  if (scale === 1) return { scale: 1, x: 0, y: 0 };
  const maxX = Math.max(0, (layout.pageWidth * scale - layout.width) / 2 + layout.padding);
  const maxY = Math.max(0, (layout.pageHeight * scale - layout.height) / 2 + layout.padding);
  return { scale, x: clamp(Number(view.x) || 0, -maxX, maxX), y: clamp(Number(view.y) || 0, -maxY, maxY) };
}

export function zoomAt(view, scale, point, layout, maxScale = 4) {
  const nextScale = clamp(scale, 1, maxScale);
  const ratio = nextScale / view.scale;
  return constrainView({ scale: nextScale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }, layout, maxScale);
}

export function sourcePoint(view, point, layout) {
  return { x: clamp(.5 + (point.x - view.x) / (layout.pageWidth * view.scale), 0, 1), y: clamp(.5 + (point.y - view.y) / (layout.pageHeight * view.scale), 0, 1) };
}

export function focusBox(box, layout, maxScale = 4) {
  const [x0, y0, x1, y1] = box;
  const scale = clamp(Math.min(layout.width * .66 / (layout.pageWidth * Math.max(.06, x1 - x0)), layout.height * .54 / (layout.pageHeight * Math.max(.06, y1 - y0))), 1, maxScale);
  return constrainView({ scale, x: (.5 - (x0 + x1) / 2) * layout.pageWidth * scale, y: (.5 - (y0 + y1) / 2) * layout.pageHeight * scale }, layout, maxScale);
}

export function mountViewport({ frame, content, controls, slider, initialView, focus, onChange, onPoint }) {
  if (!frame || !content || frame.dataset.viewportMounted) return;
  frame.dataset.viewportMounted = 'true';
  const maxScale = Number(slider?.max || 400) / 100;
  let layout, view = { scale: 1, x: 0, y: 0, ...initialView }, gesture = null, suppressClick = false;
  const pointers = new Map();
  const framePoint = event => {
    const rect = frame.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const render = () => {
    view = constrainView(view, layout, maxScale);
    content.style.width = `${layout.pageWidth}px`;
    content.style.height = `${layout.pageHeight}px`;
    content.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    frame.dataset.zoom = String(Math.round(view.scale * 100));
    frame.dataset.panX = String(view.x);
    frame.dataset.panY = String(view.y);
    frame.classList.toggle('is-zoomed', view.scale > 1.001);
    content.style.setProperty('--inverse-zoom', String(1 / view.scale));
    if (slider) {
      slider.value = String(Math.round(view.scale * 100));
      const output = slider.parentElement?.querySelector('output');
      if (output) output.textContent = `${Math.round(view.scale * 100)}%`;
    }
    controls?.querySelectorAll('[data-viewport-step]').forEach(button => {
      button.disabled = Number(button.dataset.viewportStep) < 0 ? view.scale <= 1 : view.scale >= maxScale;
    });
    onChange?.({ ...view });
    frame.dispatchEvent(new Event('viewportchange'));
  };
  const resize = () => {
    const width = frame.clientWidth, height = frame.clientHeight;
    if (!width || !height) return;
    const previous = layout;
    layout = pageFit(width, height, Number(frame.dataset.pageWidth) || 1200, Number(frame.dataset.pageHeight) || 860);
    if (previous) {
      view.x *= layout.pageWidth / previous.pageWidth;
      view.y *= layout.pageHeight / previous.pageHeight;
    }
    render();
  };
  resize();
  if (!layout) return;
  const setScale = (scale, point = { x: 0, y: 0 }) => { view = zoomAt(view, scale, point, layout, maxScale); render(); };
  const fit = () => { view = { scale: 1, x: 0, y: 0 }; render(); };
  const focusEvidence = () => { if (focus) { view = focusBox(focus, layout, maxScale); render(); } };
  if (frame.hasAttribute('data-start-focused')) focusEvidence();
  slider?.addEventListener('input', () => setScale(Number(slider.value) / 100));
  controls?.querySelector('[data-viewport-fit]')?.addEventListener('click', fit);
  controls?.querySelector('[data-viewport-focus]')?.addEventListener('click', focusEvidence);
  controls?.querySelectorAll('[data-viewport-step]').forEach(button => button.addEventListener('click', () => setScale(view.scale + Number(button.dataset.viewportStep))));
  controls?.querySelectorAll('[data-viewport-pan]').forEach(button => button.addEventListener('click', () => {
    const [dx, dy] = button.dataset.viewportPan.split(',').map(Number);
    if (view.scale === 1) view = zoomAt(view, 2, { x: 0, y: 0 }, layout, maxScale);
    view.x -= dx * layout.width * .18; view.y -= dy * layout.height * .18; render();
  }));

  const startGesture = () => {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const a = points[0], b = points[1];
      gesture = { type: 'pinch', center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view: { ...view } };
    } else if (points.length) gesture = { type: 'drag', start: points[0], view: { ...view }, moved: false };
    else gesture = null;
  };
  frame.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    suppressClick = false;
    pointers.set(event.pointerId, framePoint(event));
    event.target.setPointerCapture?.(event.pointerId);
    startGesture();
    frame.focus({ preventScroll: true });
    event.preventDefault();
  });
  frame.addEventListener('pointermove', event => {
    const point = framePoint(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, point);
      if (gesture?.type === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        view = zoomAt(gesture.view, gesture.view.scale * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance, gesture.center, layout, maxScale);
        view.x += center.x - gesture.center.x; view.y += center.y - gesture.center.y;
        suppressClick = true; frame.classList.add('is-panning'); render();
      } else if (gesture?.type === 'drag' && view.scale > 1) {
        const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
        if (gesture.moved || Math.hypot(dx, dy) > 4) {
          gesture.moved = true; suppressClick = true; frame.classList.add('is-panning');
          view = { ...view, x: gesture.view.x + dx, y: gesture.view.y + dy }; render();
        }
      }
    }
    onPoint?.(sourcePoint(view, point, layout));
  });
  const stopPointer = event => {
    pointers.delete(event.pointerId);
    startGesture();
    if (!pointers.size) frame.classList.remove('is-panning');
  };
  frame.addEventListener('pointerup', stopPointer);
  frame.addEventListener('pointercancel', stopPointer);
  frame.addEventListener('lostpointercapture', stopPointer);
  frame.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }, true);
  frame.addEventListener('dragstart', event => event.preventDefault());
  frame.addEventListener('dblclick', event => { event.preventDefault(); view.scale > 1 ? fit() : setScale(2, framePoint(event)); });
  frame.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault(); setScale(view.scale * Math.exp(-event.deltaY * .006), framePoint(event));
    } else if (view.scale > 1) {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? layout.height : 1;
      view.x -= (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
      view.y -= (event.shiftKey ? 0 : event.deltaY) * unit;
      render();
    }
  }, { passive: false });
  frame.addEventListener('keydown', event => {
    if (event.target !== frame) return;
    const arrows = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (arrows[event.key] && view.scale > 1) {
      event.preventDefault(); const [x, y] = arrows[event.key]; const step = event.shiftKey ? 100 : 40;
      view.x += x * step; view.y += y * step; render();
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault(); setScale(view.scale + (event.key === '-' ? -.25 : .25));
    } else if (event.key === 'Home' || event.key === '0') { event.preventDefault(); fit(); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); focusEvidence(); }
  });
  const observer = globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(frame);
  // Removed review views must release observers and pointer state.
  const removal = globalThis.MutationObserver ? new MutationObserver(() => {
    if (!frame.isConnected) { observer?.disconnect(); removal.disconnect(); pointers.clear(); }
  }) : null;
  if (removal) removal.observe(frame.ownerDocument.body, { childList: true, subtree: true });
  return { getView: () => ({ ...view }), fit, focus: focusEvidence, resize };
}
