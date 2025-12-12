Abbiamo sviluppato, utilizzando Vite come ambiente di sviluppo, una mappa interattiva che mostra in tempo reale la qualità dell’aria in tutto il mondo. La mappa si aggiorna automaticamente ogni minuto, garantendo dati sempre attuali e affidabili.

Le informazioni visualizzate provengono da un dataset pubblico, accessibile al seguente link:
https://public.opendatasoft.com/explore/dataset/openaq/export/?disjunctive.location&disjunctive.measurements_parameter&q=belgium&refine.location=Belgium+&disjunctive.city

Da questo dataset estraiamo i valori relativi ai principali parametri ambientali, che vengono poi elaborati e rappresentati graficamente sulla mappa in modo chiaro e intuitivo.

Per gestire e organizzare i dati in modo efficiente abbiamo utilizzato PocketBase, dove abbiamo caricato e strutturato tutte le informazioni necessarie. Ciò ci permette di garantire un accesso rapido, un backend leggero e un sistema di aggiornamento fluido.
