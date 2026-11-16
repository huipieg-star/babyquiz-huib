# De grote babyquiz

Mobiele babyquiz met een startscherm voor Team Huib en Team Naomy.

## Huidige versie
- Team Huib: zes vragen en daarna een jongen/meisje-voorspelling.
- Eén fout antwoord geeft 30 minuten cooldown.
- Na de cooldown kan de quiz opnieuw vanaf vraag 1 worden gestart.
- Team Naomy is nog niet ingevuld.
- De onthullingsvideo is nog niet gekoppeld.

## Starten
Vereist Node.js 18 of nieuwer:
```sh
npm install
npm start
``
Open daarna http://localhost:3000.

## Online hosting
Build/install: `npm install`
Start: `npm start`

Let op: de huidige prototypeversie bewaart sessies in data.json. Een hostingplatform kan lokale bestanden wissen bij herstart of opnieuw deployen. Voor de definitieve openbare versie moeten we duurzame databaseopslag instellen. Deelnemers worden voorlopig via een anonieme browsercookie herkend; wissen van cookies of wisselen van apparaat kan een nieuwe sessie opleveren.
