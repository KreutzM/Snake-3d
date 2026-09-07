// Shared by simulation, rendering and minimap. Coordinates are in metres.
export const LEVELS = [
  {
    name: 'Einstieg', description: 'Viel Platz für deine ersten Combos. Sammle 10 Kugeln und erreiche das blaue Portal.',
    halfSize: 18, start: { x: 0, z: 9 }, startLength: 6, target: 10,
    foods: [{ x: 0, z: 1 }, { x: -4, z: 1 }, { x: 4, z: 1 }],
    portal: { x: 12, z: -12 }, color: '#bdf986', floor: '#263a35',
    obstacles: [
      { x: -7, z: -5, radius: 1.35 }, { x: 7, z: -5, radius: 1.35 },
      { x: 0, z: -11, radius: 1.5 },
    ],
  },
  {
    name: 'Slalom', description: 'Versetzte Säulenreihen verlangen weite, geplante Kurven. Dein Startkörper ist 7 Meter lang.',
    halfSize: 18, start: { x: 0, z: 7 }, startLength: 7, target: 10,
    foods: [{ x: 0, z: -1 }, { x: -4, z: -1 }, { x: 4, z: -1 }],
    portal: { x: -12, z: -12 }, color: '#82cfff', floor: '#24333f',
    obstacles: [
      { x: -10, z: -6, radius: 1.4 }, { x: 0, z: -6, radius: 1.4 }, { x: 10, z: -6, radius: 1.4 },
      { x: -5, z: 3, radius: 1.4 }, { x: 5, z: 3, radius: 1.4 },
      { x: -5, z: -12, radius: 1.2 }, { x: 5, z: -12, radius: 1.2 },
    ],
  },
  {
    name: 'Zitadelle', description: 'Eine dichte Mitte, freie Außenwege und 8 Meter Startlänge. Plane auch deinen Weg zum letzten Portal.',
    halfSize: 18, start: { x: 0, z: 7 }, startLength: 8, target: 10,
    foods: [{ x: 0, z: -1 }, { x: -3, z: 2 }, { x: 3, z: 2 }],
    portal: { x: 0, z: -14 }, color: '#d4acff', floor: '#352d40',
    obstacles: [
      { x: -6, z: -6, radius: 1.5 }, { x: 0, z: -6, radius: 1.5 }, { x: 6, z: -6, radius: 1.5 },
      { x: -6, z: 0, radius: 1.4 }, { x: 6, z: 0, radius: 1.4 },
      { x: -6, z: 6, radius: 1.3 }, { x: 6, z: 6, radius: 1.3 },
      { x: -12, z: -11, radius: 1.5 }, { x: 12, z: -11, radius: 1.5 },
    ],
  },
];
