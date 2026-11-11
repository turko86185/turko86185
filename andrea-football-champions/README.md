# ⚽ ANDREA FOOTBALL CHAMPIONS

Videogioco di calcio 3D per bambini (5-6 anni), in italiano, installabile su iPhone come app (PWA), gratuito e offline.
Si gioca **disegnando con il dito la traiettoria del pallone**: passaggi, lanci, cross, tiri e tiri a effetto.

- Nessuna pubblicità, nessun acquisto, nessun account, nessuna chat, nessun dato raccolto.
- I progressi restano sul dispositivo (storage locale).

## Come si gioca
1. Tocca lo schermo, ascolta il saluto di Golino la mascotte, premi **GIOCHIAMO!**
2. Scegli la tua squadra di Serie A 2026/2027.
3. In campo: appoggia il dito (meglio vicino al pallone), **disegna** dove deve andare e **stacca il dito**.
   - Linea verso un compagno → passaggio (se c'è un difensore in mezzo diventa un pallonetto).
   - Linea oltre il compagno → passaggio in profondità.
   - Dalla fascia verso un compagno in area → cross e **colpo di testa** (poi disegni il tiro di testa).
   - Linea fino alla porta → tiro (più in alto disegni, più alto va il tiro).
   - Linea **curva** → tiro/passaggio a effetto.
   - Gesto veloce → tiro più potente.
4. L'assistenza corregge i tiri "quasi giusti" e aggancia i passaggi ai compagni vicini.

## Modalità
- **Livelli**: 100 livelli in 4 capitoli (Impara a giocare, Diventa un attaccante, Il grande campionato, La strada verso la Coppa con quarti, semifinale, finale e premiazione).
- **Partita veloce**, **Campionato** (19 giornate con classifica e coppa), **Rigori** (tiri tu e pari tu), **Allenamento** (bersagli, passaggi, precisione).
- Premi: stelle, medaglie, trofei, coppe, palloni, maglie e stadi sbloccabili, record personali.

## Squadre (Serie A 2026/2027)
Atalanta, Bologna, Cagliari, Como, Fiorentina, Frosinone, Genoa, Inter, Juventus, Lazio, Lecce, Milan, Monza, Napoli, Parma, Roma, Sassuolo, Torino, Udinese, Venezia
(neopromosse Venezia, Frosinone, Monza; retrocesse Pisa, Cremonese, Hellas Verona).
Stemmi, divise e giocatori sono **originali/di fantasia**, ispirati solo ai colori sociali: nessun marchio ufficiale.

## Architettura (TypeScript + React + Three.js)
```
src/game/engine      motore: renderer, stadio, porte con rete animata, pubblico, temi, pallone 3D
src/game/physics     fisica del pallone (moto, effetto, rimbalzi, attrito, pali, rete, gol)
src/game/trajectory  disegno col dito → direzione, potenza, elevazione, effetto + assistenza
src/game/animation   calciatori 3D procedurali e animazioni (corsa, tiro, testa, tuffo, esultanza…)
src/game/ai          portiere e difensori
src/game/camera      telecamera dinamica
src/game/match       controller dell'azione + modalità (livelli, partita, rigori, allenamento, campionato)
src/game/levels      100 livelli
src/game/teams       20 squadre, divise
src/game/audio       effetti, musica, cori sintetizzati (Web Audio) + voce italiana (sintesi vocale)
src/game/save        salvataggi locali, premi
src/ui               interfaccia React
```

## Sviluppo
```bash
npm install
npm run dev        # sviluppo
npm test           # test unitari (fisica, traiettorie, IA, livelli, salvataggi)
npm run build      # build → ../docs (pronta per GitHub Pages)
npm run preview & npm run e2e   # test E2E con touch emulato su iPhone, offline, service worker
```

## Pubblicazione gratuita e installazione su iPhone
Vedi le istruzioni nel messaggio di consegna: GitHub Pages serve la cartella `docs/`.
Su iPhone: apri il link in **Safari** → tasto **Condividi** → **Aggiungi alla schermata Home** → **Aggiungi**.
Apri il gioco una volta con internet: da quel momento funziona anche offline.
