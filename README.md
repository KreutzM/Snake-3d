# Snake 3D — First Person

Echtes WebGL-Spiel mit Three.js: Egoperspektive, Verfolgerkamera, Licht und Schatten,
kontinuierliche Bewegung, wachsende Schlange, Säulen, Minikarte und lokale Bestleistung.

## Spielen

`index.html` direkt im Browser öffnen, oder mit `npm start` den lokalen Server starten
und `http://localhost:3000` aufrufen. Das fertige `game.js` enthält die 3D-Engine;
zum Spielen ist kein CDN und keine Installation nötig. WebGL 2 ist erforderlich.

- **Maus:** Blick und Laufrichtung. Klick auf „Spiel starten“ bindet die Maus.
- **A/D oder ←/→:** links/rechts lenken (auch ohne Mausbindung).
- **W/S oder ↑/↓:** beschleunigen/bremsen. Vorwärtsbewegung ist automatisch.
- **M / Ton-Button:** Soundeffekte an/aus. Standardmäßig ab dem Spielstart aktiv; die Tonwahl wird gespeichert.
- **C / Kamera-Button:** Ego- und Verfolgerkamera umschalten.
- **Leertaste:** starten, pausieren, fortsetzen. **Esc:** pausieren und Maus freigeben.
- **Touch:** Richtungstasten gedrückt halten; auf dem Spielfeld ziehen zum Umsehen.

Im Startmenü kann **Direkt in Level 3 starten** aktiviert werden. Die Auswahl wird gespeichert
und gilt für neue Runs und Neustarts, damit die Brückenarena direkt ausprobiert werden kann.

Die Tempostufen verdoppeln sich jeweils: **Chill 2,4 m/s**, **Flow 4,8 m/s**,
**Rush 9,6 m/s**. W erhöht das gewählte Tempo um 40 %, S bremst auf 58 %.
Das gewählte Tempo bleibt beim Wiederholen und beim Levelwechsel erhalten.

Drei orange Energiekugeln stehen gleichzeitig zur Auswahl. Jede bringt 10 Basispunkte
und 2 Meter Länge. Sammle innerhalb von 6 Sekunden weiter, um den Multiplikator
von ×1 bis ×5 zu erhöhen. Ohne weitere Kugel läuft die Combo aus.

Nach 15 Sekunden aktiver Spielzeit erscheint eine goldene Bonuskugel für 10 Sekunden:
30 Basispunkte mal Combo, ebenfalls 2 Meter Wachstum. Die nächste erscheint 15 Sekunden
nach Einsammeln oder Ablauf. Gold wird als gelbe Raute auf der Minikarte und mit einem
eigenen Richtungspfeil angezeigt. Pausieren hält alle Timer an.

Drei Level bilden einen Run:

1. **Einstieg:** offene Arena mit drei Säulen, 6 Meter Startlänge.
2. **Slalom:** versetzte Säulenreihen, 7 Meter Startlänge.
3. **Zitadelle:** dichte Mitte und freie Außenwege, 8 Meter Startlänge.

Jede Arena hat ein begehbares 3D-Gelände. Hügel, Rampen und Plateaus verändern die Höhe
unter der Schlange; ihre Segmente, Energie, Gold und Portale liegen direkt auf der Oberfläche.
Die Egoperspektive steigt und fällt mit dem Gelände, während die Verfolgerkamera den Höhen-
unterschied sichtbar macht. Die Minikarte bleibt als Draufsicht erhalten, damit die räumliche
Orientierung trotz Steigungen klar bleibt.

Level 3 enthält zusätzlich eine echte Routenentscheidung: Eine Rampe führt auf eine fünf
Meter hohe Brücke, darunter bleibt eine befahrbare Unterführung am Boden. Wer auf der Brücke
seitlich aus dem Korridor fährt, stürzt und verliert ein Leben. Brückenrampen wechseln die
Oberflächenebene automatisch; die Minikarte zeigt die obere Route als blaues Portalziel.

Pro Level öffnen 10 Kugeln (inklusive Gold) das blaue Ausgangsportal. Danach verschwinden
Energie und Gold; erreiche den Ring, um das Level zu beenden. Erst der dritte Ausgang
gewinnt den Run. Portal, Fortschritt und Richtung werden im HUD und auf der Minikarte angezeigt.

Zwischen den Leveln pausiert das Spiel. Die Übersicht zeigt Levelpunkte, Gesamtpunkte,
beste Combo und die nächste Herausforderung. Klick oder Leertaste startet das nächste Level.
Punkte und die Gesamtzahl gesammelter Kugeln bleiben erhalten. Körper, Combo, Goldtimer
und Levelziel starten neu.

Jeder Run beginnt mit **drei Leben**. Wände, Säulen und der eigene Körper kosten ein Leben.
Solange Leben übrig sind, startet Klick oder Leertaste einen neuen Versuch im aktuellen Level.
Bei jedem Unfall werden Punkte und gesammelte Kugeln auf den Stand beim Levelstart zurückgesetzt.
Körper, Combo, Goldtimer und Portal werden beim Wiederholen ebenfalls zurückgesetzt.
Die Leben gelten für alle drei Arenen zusammen; ein Levelwechsel füllt sie nicht auf.
Nach dem dritten Unfall endet der Run, der nächste beginnt in Level 1 mit drei Leben.

Ein Levelabschluss **ohne einen einzigen Unfall in diesem Level** bringt einmalig 100 Bonuspunkte
(auch im Finale). Nach einem Fehlversuch entfällt dieser Bonus für das aktuelle Level; im nächsten
Level ist er wieder möglich. Die Bestleistung speichert gesicherte Punkte beim Erreichen eines
Portals, inklusive Bonus, separat von früheren Spielversionen.

## Entwickeln

Node.js 22+: `npm ci`, `npm run build`, `npm test`.
`npm run test:browser` prüft das Spiel zusätzlich mit installiertem Google Chrome
(WebGL, Mausbindung, Kamerawechsel, Pause/Neustart, Mobilansicht und Dateistart).
`src/levels.js` definiert die Arenen für Simulation, Darstellung und Minikarte.
`src/simulation.js` enthält die unabhängig getestete Simulation;
`src/game.js` enthält Rendering, Kameras und Eingabe. Nach Änderungen neu bauen.
`game.js` und `game.js.LEGAL.txt` gehören zum auslieferbaren Spiel.

Three.js: MIT-Lizenz, siehe `game.js.LEGAL.txt` und `THIRD_PARTY_LICENSES.txt`.
