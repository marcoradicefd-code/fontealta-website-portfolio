# Voce narrante con cinque lingue: solo l'italiano, a richiesta

> 26/10/2026 · nessuna PR: cartella senza git · **stato: proposta, decide Marco**

- **Contesto:** la tavola è in 5 lingue, ma la voce di Valerio (ElevenLabs) esiste solo in italiano.
  - Oggi nelle altre lingue il pulsante dice «Voce narrante (in italiano)». I sottotitoli sono tradotti ma seguono i tempi della voce italiana.
  - A voce spenta il giro va ai tempi di lettura del testo tradotto.
  - La voce pesa 1.960 KB dei 2,56 MB della pagina.
  - In fiera la voce è muta per regola: Cersaie di norma vieta il suono.
- **Decisione proposta:**
  - si tiene **solo la voce italiana**, presentata come «voce originale» con l'etichetta «(in italiano)»;
  - è **spenta di base** ovunque e si accende a richiesta;
  - nella versione per il sito si carica come file separato solo quando la si accende, non incorporata nell'HTML;
  - il doppiaggio per lingua si fa solo se un mercato lo chiede, con un video dedicato (social, fiera estera).
  
  I motivi:
  - la fabbrica è italiana e la voce italiana è un segnale di Made in Italy;
  - la maggior parte delle persone guarda senza audio;
  - i sottotitoli tradotti portano già tutto il contenuto.
- **Alternative scartate:**
  - **Voce sintetica per lingua (TTS ElevenLabs).** Costa poco, circa 4.000 caratteri a lingua, ovvero circa 0,30 $ a lingua a 0,08 $ ogni 1.000 caratteri. Il lavoro vero però è altrove:
    - 4 file audio in più;
    - per ogni lingua vanno ritarati i tempi dei 12 reparti (`CUES_V`) e dei sottotitoli (`CAPS`), quindi 5 tempi da mantenere a ogni modifica;
    - serve l'ascolto di un madrelingua;
    - l'AI Act, art. 50, chiede di dichiarare le voci sintetiche o clonate;
    - va verificata la licenza commerciale del piano.
  - **Doppiaggio con clonazione della voce di Valerio (dubbing v2, circa 2,20 $ al minuto).** È ancora in alpha, quindi è probabilmente un «Beta Service», escluso dalla licenza commerciale. In più clonare una voce in altre lingue richiede il consenso esplicito.
  - **Togliere la voce del tutto.** È la soluzione più leggera, perché si risparmiano 1,96 MB. Ma così si perde il racconto di Valerio, che è il materiale originale girato in officina e il motivo stesso dell'ordine delle fasi.
- **Conseguenze:**
  - nessun nuovo file audio, una sola tabella dei tempi;
  - nel sito la voce diventa un file `.mp3` a parte, caricato al primo clic;
  - se Marco sceglie il doppiaggio, serve un ADR nuovo che superi questo, con i costi del piano ElevenLabs verificati quel giorno.
