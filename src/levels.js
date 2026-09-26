// Shared by simulation, rendering and minimap. Coordinates are in metres.
export const LEVELS = [
  {
    name: 'Einstieg', description: 'Sanfte Hügel und breite Rampen führen auf ein 3,5 Meter hohes Plateau. Sammle 10 Kugeln und erreiche das Portal.',
    halfSize: 18, start: { x: 0, z: 9 }, startLength: 6, target: 10,
    foods: [{ x: 0, z: 1 }, { x: -4, z: 1 }, { x: 4, z: 1 }],
    portal: { x: 9, z: -10 }, color: '#bdf986', floor: '#263a35',
    terrain: [
      { type: 'hill', x: -9, z: -2, radius: 7, height: 2.5 },
      { type: 'hill', x: 10, z: 7, radius: 6, height: 2 },
      { type: 'plateau', x: 8, z: -9, halfX: 3, halfZ: 3, ramp: 5, height: 3.5 },
    ],
    obstacles: [
      { x: -7, z: -5, radius: 1.35 }, { x: 7, z: -5, radius: 1.35 },
      { x: 0, z: -11, radius: 1.5 },
    ],
  },
  {
    name: 'Slalom', description: 'Ein Tal zwischen Höhenwegen: Plane deine Kurven über sanfte Hänge und ein 4 Meter hohes Plateau. Startlänge: 7 Meter.',
    halfSize: 18, start: { x: 0, z: 7 }, startLength: 7, target: 10,
    foods: [{ x: 0, z: -1 }, { x: -4, z: -1 }, { x: 4, z: -1 }],
    portal: { x: -9, z: -10 }, color: '#82cfff', floor: '#24333f',
    terrain: [
      { type: 'plateau', x: -8, z: -6, halfX: 3, halfZ: 5, ramp: 5, height: 4 },
      { type: 'hill', x: 9, z: -7, radius: 8, height: 3.5 },
      { type: 'hill', x: 10, z: 8, radius: 6, height: 2.5 },
    ],
    obstacles: [
      { x: -10, z: -6, radius: 1.4 }, { x: 0, z: -6, radius: 1.4 }, { x: 10, z: -6, radius: 1.4 },
      { x: -5, z: 3, radius: 1.4 }, { x: 5, z: 3, radius: 1.4 },
      { x: -5, z: -12, radius: 1.2 }, { x: 5, z: -12, radius: 1.2 },
    ],
  },
  {
    name: 'Zitadelle', description: 'Erklimme die 5 Meter hohe Zitadelle über breite Rampen. Die äußeren Hügel bieten Ausweichrouten. Startlänge: 8 Meter.',
    halfSize: 18, start: { x: 0, z: 7 }, startLength: 8, target: 10,
    foods: [{ x: 0, z: -1, surface: 'bridge:0' }, { x: -3, z: 2 }, { x: 3, z: 2 }],
    portal: { x: 0, z: -10, surface: 'bridge:0' }, color: '#d4acff', floor: '#352d40',
    terrain: [
      { type: 'hill', x: -11, z: 8, radius: 6, height: 3 },
      { type: 'hill', x: 11, z: 8, radius: 6, height: 3 },
    ],
    structures: [
      { type: 'bridge', x: 0, z: -4, width: 6, length: 12, height: 5, ramp: 4 },
    ],
    obstacles: [
      { x: -6, z: -6, radius: 1.5 }, { x: 0, z: -6, radius: 1.5 }, { x: 6, z: -6, radius: 1.5 },
      { x: -6, z: 0, radius: 1.4 }, { x: 6, z: 0, radius: 1.4 },
      { x: -6, z: 6, radius: 1.3 }, { x: 6, z: 6, radius: 1.3 },
      { x: -12, z: -11, radius: 1.5 }, { x: 12, z: -11, radius: 1.5 },
    ],
  },
];
