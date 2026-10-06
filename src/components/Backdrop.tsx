// Backdrop — Mondrian-coloured squares, triangles and circles bouncing around
// behind the main column. matter.js runs the 2D physics, three.js draws it;
// both are imported lazily so they stay out of the first-paint bundle.

import { useEffect, useRef } from 'react';
import { clampSpeed } from './backdrop-utils';

// Mondrian primaries are art data, like the assets chart palette.
const PRIMARIES = ['#d52b1e', '#1d4f91', '#f4c20d'];
const RADII = [28, 40, 56, 80];
const STEP = 1000 / 60;
const MIN_SPEED = 2.5; // px per step
const MAX_SPEED = 5;
const MAX_SPIN = 0.06; // rad per step
const WALL = 400;

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    let cleanup = () => {};

    Promise.all([
      import('three'),
      import('matter-js'),
      import('three/addons/lines/LineSegments2.js'),
      import('three/addons/lines/LineSegmentsGeometry.js'),
      import('three/addons/lines/LineMaterial.js'),
    ])
      .then(
        ([
          {
            WebGLRenderer,
            Scene,
            OrthographicCamera,
            CircleGeometry,
            ShapeGeometry,
            Shape,
            Vector2,
            EdgesGeometry,
            Mesh,
            MeshBasicMaterial,
          },
          { default: Matter },
          { LineSegments2 },
          { LineSegmentsGeometry },
          { LineMaterial },
        ]) => {
          if (cancelled) return;
          const { Engine, Bodies, Body, Composite } = Matter;
          // Hits slower than this (default 2 px/step) skip restitution and glide along walls.
          (Matter.Resolver as unknown as { _restingThresh: number })._restingThresh = 0.001;
          let renderer: import('three').WebGLRenderer;
          try {
            renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
          } catch {
            return;
          }
          renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

          // Screen-pixel world: matter's y points down, so three draws at (x, -y).
          let w = canvas.clientWidth || 1;
          let h = canvas.clientHeight || 1;
          const scene = new Scene();
          const camera = new OrthographicCamera(0, w, 0, -h, -1, 1);

          const face = (color: string) => new MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
          const primaries = PRIMARIES.map(face);
          const lineMat = new LineMaterial({ linewidth: 3, depthTest: false, depthWrite: false });
          const disposables: { dispose(): void }[] = [...primaries, lineMat];

          const engine = Engine.create();
          engine.gravity.y = 0;
          const physics = { restitution: 1, friction: 0, frictionStatic: 0, frictionAir: 0 };

          const placed: { x: number; y: number; r: number }[] = [];
          // One body per shape × colour: i % 3 picks the shape, i / 3 the colour.
          const bodies = Array.from({ length: 9 }, (_, i) => {
            const r = pick(RADII);
            let x = 0;
            let y = 0;
            for (let tries = 0; tries < 50; tries++) {
              x = r + Math.random() * Math.max(0, w - 2 * r);
              y = r + Math.random() * Math.max(0, h - 2 * r);
              if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r)) break;
            }
            placed.push({ x, y, r });
            const kind = i % 3;
            return kind === 0
              ? Bodies.circle(x, y, r, physics)
              : kind === 1
                ? Bodies.rectangle(x, y, r * Math.SQRT2, r * Math.SQRT2, physics)
                : Bodies.polygon(x, y, 3, r, physics);
          });

          const meshes = bodies.map((body, i) => {
            const geo = body.circleRadius
              ? new CircleGeometry(body.circleRadius, 48)
              : new ShapeGeometry(
                  new Shape(body.vertices.map((v) => new Vector2(v.x - body.position.x, body.position.y - v.y))),
                );
            const edges = new EdgesGeometry(geo);
            const lineGeo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
            edges.dispose();
            disposables.push(geo, lineGeo);
            const mesh = new Mesh(geo, primaries[Math.floor(i / 3)]);
            const outline = new LineSegments2(lineGeo, lineMat);
            outline.renderOrder = 1;
            mesh.add(outline);
            scene.add(mesh);

            const a = Math.random() * Math.PI * 2;
            const s = 3 + Math.random() * 1.5;
            Body.setVelocity(body, { x: Math.cos(a) * s, y: Math.sin(a) * s });
            Body.setAngle(body, Math.random() * Math.PI * 2);
            return mesh;
          });
          Composite.add(engine.world, bodies);

          let walls: import('matter-js').Body[] = [];
          const setBounds = () => {
            Composite.remove(engine.world, walls);
            const opts = { isStatic: true, ...physics };
            walls = [
              Bodies.rectangle(w / 2, -WALL / 2, w + 2 * WALL, WALL, opts),
              Bodies.rectangle(w / 2, h + WALL / 2, w + 2 * WALL, WALL, opts),
              Bodies.rectangle(-WALL / 2, h / 2, WALL, h + 2 * WALL, opts),
              Bodies.rectangle(w + WALL / 2, h / 2, WALL, h + 2 * WALL, opts),
            ];
            Composite.add(engine.world, walls);
            bodies.forEach((b, i) => {
              const { r } = placed[i];
              const x = clamp(b.position.x, r, w - r);
              const y = clamp(b.position.y, r, h - r);
              if (x !== b.position.x || y !== b.position.y) Body.setPosition(b, { x, y });
            });
          };
          setBounds();

          const draw = () => {
            bodies.forEach((b, i) => {
              meshes[i].position.set(b.position.x, -b.position.y, 0);
              meshes[i].rotation.z = -b.angle;
            });
            renderer.render(scene, camera);
          };

          const css = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();
          const syncColors = () => {
            lineMat.color.set(css('--fg'));
          };
          syncColors();

          const mo = new MutationObserver(() => {
            syncColors();
            draw();
          });
          mo.observe(document.body, { attributeFilter: ['data-mode'] });

          const ro = new ResizeObserver(() => {
            if (!canvas.clientWidth || !canvas.clientHeight) return;
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            renderer.setSize(w, h, false);
            camera.right = w;
            camera.bottom = -h;
            camera.updateProjectionMatrix();
            setBounds();
            draw();
          });
          ro.observe(canvas);

          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            let last = 0;
            let acc = 0;
            renderer.setAnimationLoop((ms) => {
              acc += Math.min(ms - last, 100);
              last = ms;
              for (; acc >= STEP; acc -= STEP) {
                for (const b of bodies) {
                  const v = Body.getVelocity(b);
                  const next = clampSpeed(v, MIN_SPEED, MAX_SPEED);
                  if (next !== v) Body.setVelocity(b, next);
                  const spin = Body.getAngularVelocity(b);
                  if (Math.abs(spin) > MAX_SPIN) Body.setAngularVelocity(b, Math.sign(spin) * MAX_SPIN);
                }
                Engine.update(engine, STEP);
              }
              draw();
            });
          }

          cleanup = () => {
            renderer.setAnimationLoop(null);
            mo.disconnect();
            ro.disconnect();
            Composite.clear(engine.world, false);
            Engine.clear(engine);
            disposables.forEach((d) => d.dispose());
            renderer.dispose();
          };
        },
      )
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return <canvas ref={ref} className="main-backdrop" aria-hidden="true" />;
}
