# ⭐ Memory Kids

Gioco Memory educativo per bambini (circa 7 anni), realizzato come **Progressive Web App**:
si installa sul telefono dalla schermata Home, funziona **offline** ed è **gratis al 100%**:
niente pubblicità, acquisti, registrazione o raccolta di dati.

L'app si trova nella cartella [`docs/`](docs/): sono file statici, senza passaggi di build.

## 🌍 Pubblicarla gratis (GitHub Pages)

1. Su GitHub apri il repository → **Settings** → **Pages**.
2. In **Build and deployment** scegli **Source: Deploy from a branch**.
3. Seleziona il branch (`main` dopo il merge, oppure direttamente `claude/sweet-gates-66b9b5`) e la cartella **`/docs`**, poi **Save**.
4. Dopo 1-2 minuti il gioco è online all'indirizzo:
   **https://turko86185.github.io/turko86185/**

GitHub Pages è gratuito per i repository pubblici e usa HTTPS, che serve per installare l'app e farla funzionare offline.

## 📲 Installarla su iPhone / iPad

1. Apri il link con **Safari**.
2. Tocca **Condividi** (il quadrato con la freccia verso l'alto).
3. Scegli **"Aggiungi alla schermata Home"**, poi **Aggiungi**.
4. Apri Memory Kids dall'icona: parte a schermo intero con la sua schermata iniziale.
   Dopo la prima apertura funziona anche in modalità aereo.

## 🤖 Installarla su Android

Apri il link con **Chrome**, poi menu **⋮** → **Installa app** (o **Aggiungi a schermata Home**).
Nel gioco, la sezione **📲 Installa** ha anche il pulsante **Installa ora**.

## 🎮 Cosa contiene

- **5 modalità**: Classica, A Tempo, Sfida (12 tappe che diventano più difficili, con anteprima delle carte che si accorcia), Relax (senza orologio), Super Memory (da 24 a 40 carte di categorie mescolate).
- **7 livelli**: 6, 8, 12, 16, 20 carte, più due livelli sbloccabili da 24 e 30 carte. Ogni livello completato apre il successivo.
- **12 categorie** con 18-20 carte ciascuna: Animali, Unicorni e Magia, Principesse, Dinosauri, Frutta e Verdura, Dolci e Gelati, Animali Marini, Faccine, Fiori e Natura, Oggetti di Casa, Spazio e Pianeti, Personaggi Buffi, più "Sorpresa".
- **Premi**: da 1 a 3 stelle, punti esperienza con 9 gradi (da 🌱 Semino a 👑 Leggenda), 18 medaglie, 6 trofei e 7 temi da sbloccare con le stelle. Ci sono i coriandoli e Stellina, la mascotte, che festeggia.
- **Nessuna penalità**: gli errori non tolgono mai punti. Se il tempo finisce si può chiedere "+30 secondi", e le coppie trovate valgono comunque punti esperienza.
- Contatore delle mosse, cronometro (si può disattivare), punteggio, coppie trovate, pulsanti Ricomincia e Pausa (la pausa copre le carte).
- Effetti sonori e musica originali, generati in tempo reale (si possono disattivare). Vibrazione su Android.
- **Salvataggio automatico** sul dispositivo. Una partita interrotta si riprende con "Continua la partita".
- Statistiche e record personali per ogni livello.
- Area genitori: per azzerare i progressi bisogna tenere premuto il pulsante per 3 secondi.

## 🔒 Privacy

Nessuna chat, nessun social, nessun link esterno, nessun tracciamento. Una Content-Security-Policy
impedisce di caricare risorse esterne. I progressi stanno solo nel `localStorage` del dispositivo.
Il font *Fredoka* (licenza SIL OFL) è incluso nei file.

## 🧪 Test

```bash
npm test                                   # test del motore di gioco e dei salvataggi (Node)
python3 -m http.server 8765 -d docs &      # server locale
node tests/e2e.cjs                         # test end-to-end nel browser (Playwright)
```

Il test end-to-end gioca partite vere toccando le carte. Controlla che non si possano scoprire più di 2 carte,
che le coppie trovate restino scoperte, che le mosse si contino bene, che i livelli si sblocchino,
che i progressi restino dopo aver ricaricato la pagina, che il gioco funzioni senza rete
e che tutto stia nello schermo su iPhone, Android, iPad, schermi piccoli e in orizzontale.

## 🔄 Aggiornare il gioco

Dopo aver modificato i file, cambia `VERSION` in `docs/sw.js`: così i telefoni scaricano la nuova versione.
