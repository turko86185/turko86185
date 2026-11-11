# 🌼 Il Giardino dei Giochi

Giochi educativi per bambini dai **3 ai 7 anni**: basta un browser, senza installare niente e senza internet.

## Come si gioca
- **Online:** https://turko86185.github.io/turko86185/gioco-bambini/ (con GitHub Pages attivo)
- **Sul computer:** apri `index.html` con un browser (Chrome, Safari, Firefox)

## Installarlo come app sul telefono
1. Apri il link qui sopra sul telefono.
2. **iPhone (Safari):** tocca Condividi ⬆️, poi "Aggiungi alla schermata Home".
   **Android (Chrome):** tocca ⋮, poi "Installa app" (o "Aggiungi a schermata Home").
3. Sulla schermata Home compare l'icona del fiore 🌼. L'app si apre a schermo intero e funziona anche senza internet.

## I giochi
| Gioco | Cosa impara il bambino |
|---|---|
| 🐶 **Memory**: trova le coppie di animali (3 livelli: 4, 6 e 8 coppie) | memoria e attenzione |
| 🍎 **Contiamo!**: quanti oggetti vedi? (da 1 a 5, poi fino a 10). Se tocchi gli oggetti, la voce li conta | numeri e conteggio |
| 🔺 **Colori e forme**: "Tocca il colore rosso!", poi "Tocca la stella gialla!" | colori, forme, ascolto |
| 🎹 **Piano magico**: 8 tasti colorati con le note Do-Re-Mi | musica e creatività, gioco libero |

## Cosa c'è dentro
- **La voce in italiano legge le istruzioni**, così giocano anche i bambini che non sanno ancora leggere (il tasto 🔈 le ripete)
- **Stelle ⭐ come premio**, coriandoli e suoni allegri. Le stelle restano salvate sul dispositivo
- Pulsanti grandi, adatti alle dita piccole
- Il tasto 🔊/🔇 spegne tutti i suoni
- Niente pubblicità, niente link esterni, nessun dato raccolto

## Dati tecnici
Un unico file HTML con CSS e JavaScript, senza librerie esterne. Un manifest e un service worker (`manifest.webmanifest`, `sw.js`) lo rendono un'app installabile che funziona offline. I suoni sono generati con Web Audio API, la voce con Speech Synthesis API e la grafica con emoji e SVG.
