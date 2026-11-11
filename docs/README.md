# Andrea Football Champions

Videogioco di calcio 3D per bambini (5-6 anni), con Andrea protagonista.
Funziona nel browser del telefono, si installa come app (PWA) e gioca anche senza internet.

## Modalità

- **Gioca ora**: partita immediata con la squadra del cuore contro un avversario a caso.
- **Partita veloce**: scegli squadra, avversario, stadio, durata e difficoltà.
- **Campionato**: le 20 squadre della Serie A 2026/2027, 19 giornate (girone unico), classifica completa (punti, vittorie, pareggi, sconfitte, gol fatti e subiti). Chi arriva primo vince lo Scudetto.
- **Calci di rigore**: Andrea tira (mirino + potenza) e para (sceglie dove tuffarsi). Serie da 5 e poi a oltranza.
- **Allenamento**: tiri in porta, passaggi, dribbling, percorso a ostacoli, bersagli, rigori. Ogni esercizio dà una medaglia.

## Comandi

| Comando | Telefono | Tastiera |
|---|---|---|
| Muoversi | joystick (tocca e trascina nella metà sinistra dello schermo) | frecce o WASD, oppure mouse: Andrea corre verso il puntatore |
| Tiro | TIRA (tieni premuto per caricare, lascia per tirare) | Spazio o clic sinistro (tieni premuto) |
| Passaggio | PASSA | J, X o clic destro (verso il compagno indicato dal mouse) |
| Scatto | SCATTO (tieni premuto) | Shift |
| Cambio giocatore | CAMBIO | C o Q |
| Senza palla | TIRA diventa RUBA (contrasto) | Spazio o clic sinistro |
| Rigori | mirino con il joystick | punta la porta con il mouse |

La **modalità assistita** (attiva di serie) passa al compagno giusto, mira da sola, aiuta a controllare la palla e rende gli avversari meno aggressivi.

## Installare sul telefono

1. Apri il link del gioco nel browser.
2. **iPhone / iPad**: in Safari tocca *Condividi* (il quadrato con la freccia) → *Aggiungi alla schermata Home* → *Aggiungi*.
3. **Android**: in Chrome tocca il menu ⋮ → *Installa app* (oppure *Aggiungi a schermata Home*).
4. Apri il gioco dall'icona. Dopo la prima apertura funziona anche offline.

## Pubblicare il gioco (link pubblico gratuito con GitHub Pages)

1. Su GitHub apri il repository → *Settings* → *Pages*.
2. In *Build and deployment* scegli *Deploy from a branch*, ramo `main` (dopo aver unito questo lavoro) e cartella `/docs`, poi *Save*.
3. Dopo un minuto il gioco è su `https://<nome-utente>.github.io/<nome-repository>/`.

## Aggiornare le squadre

Le squadre, i colori, le divise e gli stadi stanno in `data/teams.json`: si possono modificare senza toccare il codice.
Campi della divisa: `pattern` (`plain`, `stripes`, `halves`, `hoops`, `cross`, `band`), `c1`, `c2`, `shorts`, `socks`.
`rating` (50-95) è la forza della squadra controllata dal computer. Facoltativo: un elenco `players` con `name`, `speed`, `shot`, `pass`, `defense` (0-1) per i 6 giocatori.
Dopo una modifica, cambia `VERSION` in `sw.js` (per esempio `afc-v2`) così i telefoni scaricano i dati nuovi.

## Note

- Stemmi: gli stemmi ufficiali sono marchi registrati, quindi il gioco disegna stemmi originali con i colori sociali e la sigla della squadra. Anche gli stadi hanno nomi originali.
- Privacy: nessuna pubblicità, nessun acquisto, nessuna chat, nessuna registrazione, nessun collegamento esterno. I progressi sono salvati solo sul dispositivo (localStorage).
- Audio sintetizzato al momento (Web Audio). La telecronaca usa la voce italiana del dispositivo, se presente. Tutto si può spegnere nelle Impostazioni.
- Tecnologia: Three.js r170 (incluso nel progetto, nessun CDN), JavaScript moduli ES, nessuna compilazione necessaria.
