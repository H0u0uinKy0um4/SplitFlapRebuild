# Split-Flap OS — návod pro začátečníky

Tahle integrace propojí Home Assistant s mechanickou split-flap tabulí
(„překlápěcí“ displej s fyzickými lístky).
Po instalaci získáte panel v postranním menu, několik entit a služby, které pak
můžete používat v automatizacích a skriptech.

Anglický originál najdete v [README.md](README.md).

> **Jazyk:** Přidání integrace, možnosti a názvy služeb mají český překlad.
> Vlastní panel a názvy entit jsou zatím anglicky.

---

## 1. Jak to celé funguje

Home Assistant sám nemluví přímo s jednotlivými moduly. Mezi nimi stojí řídící
deska **ESP32 SplitFlap Master**:

```text
Home Assistant                    ESP32 master                Moduly
┌───────────────────────────┐ MQTT ┌──────────────┐  RS485    ┌────────┐
│ Integrace Split-Flap OS   │─────>│ command/*    │──────────>│ modul  │
│ engine + aplikace + panel │<─────│ status       │<──────────│ modul  │
└───────────────────────────┘      └──────────────┘           └────────┘
```

- **Home Assistant** připraví text, zalamování, aplikace, playlisty a uloží
  nastavení.
- Přes **MQTT** pošle příkaz masteru.
- **Master** ho přeloží na RS485 příkazy pro jednotlivé moduly.
- Master průběžně zveřejňuje svůj stav na `status` topic, takže integrace ví,
  kolik je modulů, kde stojí a jestli je tabule online.

MQTT topic prefix je volitelný, výchozí je `splitflap`:

| Směr | Topic |
| --- | --- |
| stav z masteru | `<prefix>/status` |
| příkazy do masteru | `<prefix>/command/display`, `sync`, `scan`, `update`, `calibrate` |

> **Důležité:** integrace povoluje jen **jednu konfigurační položku**. Firmware
> je stavěný pro jeden master, takže jedna tabule = jedna instance Home
> Assistanta.

---

## 2. Co potřebujete

- Home Assistant **2024.11** nebo novější.
- Nastavenou integraci **MQTT** připojenou ke stejnému brokeru, který používá
  master.
- Nahraný firmware **SplitFlap Master** s výše uvedenými topicy.
- Znát MQTT prefix. Pokud jste ho neměnili, je to `splitflap`.

---

## 3. Instalace

### Varianta A: přes HACS (doporučeno)

1. Otevřete **HACS**.
2. Klikněte na tři tečky vpravo nahoře → **Custom repositories**.
3. Do pole **Repository** vložte adresu tohoto repozitáře na GitHubu.
4. Jako **Category** vyberte **Integration** a potvrďte.
5. V HACS vyhledejte **Split-Flap OS** a klikněte na **Download**.
6. Restartujte Home Assistant.
7. Pokračujte kapitolou [Přidání integrace](#4-přidání-integrace).

### Varianta B: ručně

1. Zkopírujte složku `custom_components/splitflap_os` do své složky
   `config/custom_components/` v Home Assistantu.
2. Restartujte Home Assistant.
3. Pokračujte kapitolou [Přidání integrace](#4-přidání-integrace).

> Panel v postranním menu se registruje automaticky. Nemusíte nic přidávat do
> Lovelace ani vytvářet žádný resource.

---

## 4. Přidání integrace

1. V Home Assistantu jděte na **Nastavení → Zařízení a služby**.
2. Klikněte na **Přidat integraci**.
3. Vyhledejte **Split-Flap OS**.
4. Vyplňte:
   - **MQTT topic prefix** — výchozí `splitflap`. Nesmí obsahovat `+` ani `#`.
   - **Display name** — jméno, které se zobrazí v Home Assistantu a v panelu.
     Například `Tabule` nebo `Split-Flap Display`.
5. Potvrďte.

Po přidání se v levém menu objeví položka **Split-Flap OS**. Pokud ne, jednou
reloadněte integraci a obnovte stránku v prohlížeči (ideálně tvrdým refreshem).

---

## 5. Panel v postranním menu

Panel má čtyři záložky:

| Záložka | Co tam najdete |
| --- | --- |
| **Control** | Živý náhled tabule, víceřádkové psaní textu, vkládání barevných lístků, startovní sloupec, pořadí odesílání, rychlost, tvorbu playlistu a uložené playlisty. |
| **Apps** | Seznam aplikací (hodiny, počasí, akcie, doprava…). Kliknutím aplikaci spustíte, ozubené kolečko otevře její nastavení. |
| **Tuning** | Diagnostika modulů, homing, goto, kroky, záznam pozic do EEPROM, sken sběrnice a mapa znaků. |
| **Settings** | Nastavení displeje, počasí, trhů, sportu, dopravy, času a animací. Najdete tu i zálohu/obnovu a informace o připojení. |

V panelu jde také nastavit **Preview scale (%)** — zvětšení náhledu pro malé
fyzické displeje (50–200 %, výchozí 100 %).

---

## 6. Entity

Názvy entit vycházejí z **Display name**, které zadáte při instalaci. Pokud
tabuli pojmenujete `Split-Flap Display`, budou entity vypadat takto:

| Platforma | Příklad entity | Význam |
| --- | --- | --- |
| sensor | `sensor.split_flap_display_status` | `online` / `offline` masteru |
| sensor | `sensor.split_flap_display_module_count` | počet nalezených modulů |
| sensor | `sensor.split_flap_display_display_text` | naposledy zobrazený text |
| sensor | `sensor.split_flap_display_active_app` | aktivní aplikace, playlist nebo `idle` |
| button | `button.split_flap_display_home_all` | najede všemi moduly domů |
| button | `button.split_flap_display_scan_bus` | plný sken RS485 sběrnice |
| button | `button.split_flap_display_sync_state` | vyžádá si aktuální stav masteru |
| button | `button.split_flap_display_refresh_modules` | obnoví známé moduly bez skenu |
| button | `button.split_flap_display_stop_display` | zastaví aplikaci/playlist |
| text | `text.split_flap_display_set_display_text` | zápis textu z automatizace |
| select | `select.split_flap_display_app` | spuštění aplikace nebo `Off` |

> Přesné `entity_id` si vždy ověřte v **Nastavení → Zařízení a služby → Entity**.
> Záleží na jméně, které jste zvolili.

Užitečné atributy:

- **Status** obsahuje `mqtt_prefix`, `modules_count`, `last_status` a `restored`.
- **Display text** obsahuje `lines`, `mode`, `active_app` a informace o stránce.
- **Active app** obsahuje `mode`, `running`, `board` a informace o stránce.

---

## 7. Služby

Všechny služby najdete pod doménou `splitflap_os.*`. V automatizacích je
voláte přes `action:` (dříve `service:`).

| Služba | K čemu je |
| --- | --- |
| `send_text` | Pošle text na tabuli. |
| `notify` | Zařadí přerušující zprávu s dobou zobrazení, stylem a prioritou; aktivní aplikace nebo playlist pak pokračuje, kde skončil. |
| `play_playlist` | Přehraje seznam stránek, volitelně ve smyčce. |
| `start_app` / `stop_app` | Spustí nebo zastaví aplikaci. |
| `sync` / `scan` / `update` | Práce s hardwarem a stavem masteru. |
| `calibrate` | Kalibrace jednoho modulu. |
| `home_all` / `record_all` | Hromadné najetí domů / záznam pozice. |
| `save_playlist` / `delete_playlist` / `run_saved_playlist` | Správa playlistů. |
| `set_settings` | Sloučí a uloží nastavení (klíče s prefixem aplikace, např. `clock.clock_format`). |

V tabulce jsou krátké názvy; v YAML je vždy voláte jako `splitflap_os.<název>`,
například `splitflap_os.send_text`.

### `splitflap_os.send_text`

| Pole | Výchozí | Význam |
| --- | --- | --- |
| `text` | *(povinné)* | Text. Nový řádek (`\n`) začne novou řadu. |
| `start` | `1` | Startovní sloupec, **počítáno od 1**. `1` = bez posunu. |
| `style` | `ltr` | Pořadí odesílání: `ltr`, `rtl`, `columns`, `center_out`, `outside_in`, `diagonal`, `random`, `rain`, `spiral`. |
| `speed` | `15` | Zpoždění v ms na modul. Aktuální firmware ho ignoruje a používá vlastní časování. |
| `stop` | `true` | Nejdřív zastaví běžící aplikaci/playlist. |
| `raw` | `false` | Text se bere jako hotová data tabule — nezalamuje se a nemění velikost písmen. Pro běžné použití nechte `false`. |

Běžný text se **převede na velká písmena** a automaticky se **zalomí** podle
šířky tabule. Emoji barevných čtverců se převedou na fyzické barevné lístky:
🟥 `r`, 🟧 `o`, 🟨 `y`, 🟩 `g`, 🟦 `b`, 🟪 `p`, ⬜ `w`, ⬛ mezera.

> **Diakritika:** standardní buben má 64 lístků a **neobsahuje česká písmena
> s diakritikou** (ě, š, č, ř, ž…). Pište proto bez diakritiky, například
> `PRACKA HOTOVA` místo `PRAČKA HOTOVÁ`. Uvozovky `"` se posílají jako `q`.

### Kontrola znaků před odesláním

Integrace před odesláním ověří, že každý modul má požadovaný znak ve svém
`flap_list` (bubnu). Když některý modul znak nemá, text se **vůbec neodešle** a
vrátí se chyba s ID modulu a chybějícím znakem, například:

```text
Cannot display: module 4 lacks 'X'. Use a character from the module's drum
or update its flap list in Tuning.
```

Co to znamená:

- Kontrola platí pro služby `splitflap_os.send_text` a
  `splitflap_os.play_playlist`; u playlistu se ověří všechny stránky ještě před
  spuštěním. Stejně se chová i textová entita.
- Mezery se nekontrolují — používají se na zarovnání a vycentrování textu.
- Moduly, které svůj `flap_list` nehlásí, se přeskočí; bez seznamu lístků nelze
  znak ověřit.
- Když modul znak nemá, použijte jiný znak, nebo v **Tuning** zkontrolujte jeho
  buben a případně opravte seznam lístků ve firmwaru.

### `splitflap_os.play_playlist`

| Pole | Výchozí | Význam |
| --- | --- | --- |
| `pages` | *(povinné)* | Seznam stránek. V YAML skriptu může být skutečný seznam, v UI JSON pole jako string. |
| `delay` | `5` | Sekundy čekání po každé stránce. |
| `loop` | `true` | Opakovat do zastavení. |

Stránka může být jen text (`"AHOJ"`) nebo objekt s klíči `text`, `delay`,
`style` a `speed`.

### `splitflap_os.start_app`

`app` je klíč aplikace:

`clock`, `date`, `dashboard`, `weather`, `stocks`, `crypto`, `sports`, `metro`,
`countdown`, `world_clock`, `iss`, `animations`.

### `splitflap_os.calibrate`

| Pole | Význam |
| --- | --- |
| `module` | ID modulu. |
| `action` | `goto`, `home`, `step`, `record`, `apply`, `clear_map`, `get_pos`. |
| `index` | Index lístku na bubnu, **od 0**. |
| `flap` | Znak pro `goto`, pokud není zadaný `index`. |
| `home_offset` | Kroky od hall senzoru k prvnímu lístku (akce `apply`). |
| `positions` | Mapa index → absolutní krok (akce `apply`). |
| `clear_map` | Vymazat mapu v EEPROM před `apply`. |
| `steps` | Relativní kroky; integrace je převede na absolutní pozici. |

> **Pozor na firmware:** akce `record` s `index: 0` pošle navíc ničivý zápis
> `m<id>w0:0`, který může poškodit první záznam v EEPROM. Používejte indexy
> větší než 0, nebo firmware upravte.

### Ostatní služby

- `home_all` — najede všemi moduly domů.
- `record_all` — uloží zadaný `index` na všech modulech.
- `save_playlist` — uloží playlist pod jménem (`name`, `pages`, `delay`).
- `delete_playlist` — smaže playlist podle `name`.
- `run_saved_playlist` — spustí uložený playlist ve smyčce podle `name`.
- `set_settings` — sloučí a uloží nastavení (`settings` je objekt).

---

## 8. Příklady do automatizací a skriptů

Následující příklady fungují v **automatizacích**, **skriptech** i v
**Nástroje pro vývojáře → Služby**. V UI je potřeba u seznamů (`pages`) zadat
JSON, v YAML použijte běžný seznam.

> Ukázky s klíčem `automation:` patří do `configuration.yaml`. Pokud je
> vkládáte přímo do `automations.yaml` nebo do YAML režimu v UI, vynechte první
> řádek `automation:` a zbytek o dvě mezery odsaďte.

### Ráno pošli pozdrav

```yaml
automation:
  - alias: "Ranní pozdrav na tabuli"
    triggers:
      - trigger: time
        at: "07:00:00"
    actions:
      - action: splitflap_os.send_text
        data:
          text: "GOOD MORNING"
          style: center_out
```

### Více řádků a barevné lístky

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: |-
        POZOR
        🟥🟩🟦
      style: rain
```

### Reakce na jinou entitu

```yaml
automation:
  - alias: "Pračka dokončena"
    triggers:
      - trigger: state
        entity_id: binary_sensor.pracka
        to: "on"
    actions:
      - action: splitflap_os.send_text
        data:
          text: "PRACKA HOTOVA"
          style: spiral
```

### Spuštění a zastavení aplikace

```yaml
actions:
  - action: splitflap_os.start_app
    data:
      app: clock
  # později…
  - action: splitflap_os.stop_app
```

### Playlist přímo ze skriptu (YAML seznam)

```yaml
actions:
  - action: splitflap_os.play_playlist
    data:
      pages:
        - text: "AHOJ"
          delay: 3
        - text: "JAK SE MAS?"
          style: rtl
          delay: 4
        - text: "DNES JE {{ now().strftime('%d.%m.%Y') }}"
          delay: 5
      delay: 2
      loop: true
```

Stejný playlist v UI (**Nástroje pro vývojáře → Služby**) zadejte jako JSON:

```json
[
  {"text": "AHOJ", "delay": 3},
  {"text": "JAK SE MAS?", "style": "rtl", "delay": 4}
]
```

### Uložení a spuštění pojmenovaného playlistu

```yaml
actions:
  - action: splitflap_os.save_playlist
    data:
      name: "Ranni zpravy"
      pages:
        - "DOBRE RANO"
        - text: "DNES JE {{ now().strftime('%d.%m.%Y') }}"
          delay: 5
      delay: 3

  - action: splitflap_os.run_saved_playlist
    data:
      name: "Ranni zpravy"
```

### Změna nastavení z automatizace

```yaml
actions:
  - action: splitflap_os.set_settings
    data:
      settings:
        clock_format: "24h"
        page_delay: 8
        ui_scale: 120
```

### Zápis přes textovou entitu

Textová entita je jednodušší, když chcete jen poslat text a neřešit službu:

```yaml
actions:
  - action: text.set_value
    target:
      entity_id: text.split_flap_display_set_display_text
    data:
      value: "AHOJ SVETE"
```

### Stisk tlačítka z automatizace

```yaml
actions:
  - action: button.press
    target:
      entity_id: button.split_flap_display_sync_state
```

### Synchronizace po restartu Home Assistantu

```yaml
automation:
  - alias: "Po startu obnov stav tabule"
    triggers:
      - trigger: homeassistant
        event: start
    actions:
      - delay: "00:00:10"
      - action: splitflap_os.sync
```

---

## 9. Fyzické rozložení tabule

Integrace se snaží velikost odhadnout z počtu modulů (například 45 modulů →
3×15, 64 → 4×16). Pokud máte nepravidelnou tabuli, nastavte ji ručně v
**Settings**:

- `row_counts` — počet modulů v každé řadě, například `3,3,1`.
- `rows` / `cols` — rozměry rámu. `0` znamená „odvodit automaticky“.

Příklad:

```text
row_counts = 3,3,1     rám = 3 řady × 3 sloupce

řada 1: modul 1  modul 2  modul 3
řada 2: modul 4  modul 5  modul 6
řada 3:          modul 7
```

Pravidla:

- Moduly se číslují zleva doprava, pak shora dolů.
- Kratší řada se v rámu **vycentruje**.
- Prázdných míst v rámu může být nejvýše jedna řada. Třeba 7 modulů v rámu 3×3
  je v pořádku, ale 7 modulů v rámu 3×15 ne.
- Text a animace fungují na jakémkoli platném rozložení, klidně i s jedním
  modulem.
- Datové aplikace (hodiny, počasí, akcie…) potřebují dost široké řady. Když
  tabule nestačí, karta aplikace se zobrazí jako zakázaná a spuštění vrátí
  chybu.

Minimální velikosti aplikací:

| Aplikace | Minimální rám |
| --- | --- |
| Animations | jakákoli velikost |
| Clock | 3 × 9 |
| Date | 3 × 11 |
| Dashboard | 3 × 11 |
| Weather | 3 × 10 |
| Stocks | 3 × 7 |
| Crypto | 3 × 8 |
| Sports | 3 × 8 |
| Metro | 3 × 10 |
| Countdown | 3 × 12 |
| World Clock | 1 × 10 |
| ISS | 3 × 10 |

---

## 10. Nejdůležitější nastavení

Nastavení se ukládají k integraci a najdete je v panelu na záložce **Settings**.
Nastavení aplikací mají prefix `<aplikace>.<klíč>` (například `clock.clock_format`
nebo `weather.weather_entity`); staré ploché klíče se migrují automaticky při
prvním načtení. Přes službu `set_settings` je můžete měnit i z automatizace.

| Klíč | Význam |
| --- | --- |
| `row_counts`, `rows`, `cols` | Fyzické rozložení tabule. |
| `ui_scale` | Zvětšení náhledu v panelu, 50–200 %, výchozí 100. |
| `timezone`, `units`, `page_delay` | Časové pásmo, jednotky a výchozí prodleva stránek. |
| `weather_entity` | Preferovaná entita počasí z Home Assistantu. |
| `zip_code`, `weather_api_key` | Záložní cesta přes OpenWeather. |
| `stocks_list`, `crypto_list`, `sports_teams` | Symboly akcií, kryptoměn a týmy NHL. |
| `metro_stop`, `metro_route`, `mbta_api_key` | Nastavení MBTA dopravy. |
| `countdown_event`, `countdown_target`, `clock_format`, `world_clock_zones` | Odpočet, formát hodin a světové časy. |
| `anim_effect`, `anim_style`, `anim_speed` | Vzhled a rychlost animací. |

Počasí se standardně bere z Home Assistantu přes `weather.get_forecasts`, takže
pro běžné použití nepotřebujete žádný externí API klíč. Akcie používají Yahoo
Finance, kryptoměny CoinGecko a MBTA funguje i bez klíče při malém provozu.

---

## 11. Verze a firmware modulů

Všechny tři části systému (firmware modulů, ESP32 master a tato integrace)
používají dvě nezávislé **osy kompatibility**, protože spolu mluví dva různé
páry partnerů:

| Osa | Kontrakt | Kdo ji nese |
| --- | --- | --- |
| **BUS_COMPAT** | RS485 aplikační protokol a kontrakt vstupu do OTA/bootloaderu | modul + master |
| **MQTT_COMPAT** | JSON schéma MQTT statusu a příkazů | master + Home Assistant |

Master obě strany propojuje, takže nese obě čísla. Každý repozitář má navíc
vlastní vydání v rámci těchto generací a zobrazovaná verze se skládá z čísel,
která se na něj vztahují:

```
modul    <bus>.<vydání>               1.0.1      bus 1, vydání 0.1
master   <bus>.<mqtt>.<vydání>        1.1.0.0    bus 1, mqtt 1, vydání 0.0
HA       <mqtt>.<vydání>              1.2.7      mqtt 1, vydání 2.7
```

| Kde | Verze | Kompatibilita | Kde ji uvidíte |
| --- | --- | --- | --- |
| Integrace Home Assistant | `1.2.7` | MQTT `1` | hlavička panelu, informace o připojení, WebSocket `version`/`mqtt_compat` |
| ESP32 master | `1.1.0.0` | bus `1`, MQTT `1` | status `version`/`bus_compat`/`mqtt_compat`, informace o připojení |
| Firmware modulu | `1.0.1` | bus `1` | inspektor modulu, karta firmwaru, `m<id>v`, UPDI dump |

Integrace porovnává `mqtt_compat` masteru s `MQTT_COMPAT` v `const.py`. Při
neshodě se zobrazí žluté upozornění, ale normální zobrazení, zrušení OTA ani
reset modulu to nikdy nezablokuje. Pokud master verzi vůbec nehlásí (starší
firmware), panel ji označí jako neznámou a nebude předpokládat kompatibilitu.
Generace sběrnice se zobrazuje pro diagnostiku; Home Assistant s ní přímo
nemluví.

Karta **MODULE FIRMWARE** ukazuje verzi a generaci sběrnice, kterou každý modul
skutečně hlásí. Použijte ji jako důkaz, že OTA proběhla: zvyšte `FW_RELEASE` ve
firmwaru modulu, nahrajte nový `.hex` a po restartu a homogenizaci se na kartě
musí objevit nová verze. OTA sama odmítne neznámý protokol bootloaderu ještě
před zápisem první stránky.

Při změně frontendu zvyšte `VERSION` v `const.py`, `manifest.json` i
`frontend/constants.js` a všechny parametry `?v=` v importech současně.
`tests/test_versions.py` tuto shodu a vztah major/kompatibilita hlídá.

---

## 12. Řešení potíží

**Panel hlásí OFFLINE**

Zkontrolujte integraci MQTT, správný prefix a retained zprávu na
`<prefix>/status`. Master posílá heartbeat každých 30 sekund; po 90 sekundách
bez zprávy integrace přepne na offline.

**Nenajdou se žádné moduly**

V záložce **Tuning** stiskněte **Scan bus**. Velikost tabule se řídí polem
`modules_count` ve status zprávě.

**Chyba rozložení nebo zakázané aplikace**

Otevřete **Settings** a upravte rám nebo `row_counts`. Rozložení musí popsat
všechny nalezené moduly a smí nechat nejvýše jednu řadu prázdnou. Datové
aplikace zůstanou zakázané, dokud nebude každá řada dost široká.

**Po restartu je na tabuli starý text**

Integrace obnoví poslední známý stav. Stiskněte **Sync** nebo zavolejte
`splitflap_os.sync`.

**Panel po instalaci chybí**

Jednou reloadněte integraci a obnovte stránku v prohlížeči tvrdým refreshem.
Do logu Home Assistantu se podívejte na chyby kolem `panel` nebo statické cesty.

**Text se zobrazí jinak, než jsem napsal**

Zkontrolujte diakritiku (buben ji nezná), velikost písmen (běžný text se
převádí na velká) a šířku tabule (text se automaticky zalamuje).

**Služba vrátí chybu „Cannot display: module ... lacks ...“**

Některý modul nemá daný znak ve svém bubnu. Otevřete **Tuning**, vyberte modul
a zkontrolujte jeho seznam lístků. Použijte znak, který v bubnu je, nebo znak
odstraňte. Text se v takovém případě na tabuli vůbec neodešle.

**Panel hlásí neshodu kompatibility**

Master a integrace nemají stejnou generaci kompatibility. Aktualizujte master
(nebo integraci) na stejnou generaci. Zobrazení může dál fungovat, ale OTA je
bezpečnější řešit až po sjednocení. Pokud panel píše, že master verzi nehlásí,
jde o firmware starší než protokol verzí.

---

## Poděkování

Tento projekt vychází z původního návrhu **Split-Flap Display** od
**Adam G Makes** ([@adamgmakes](https://github.com/adamgmakes)):

- Repozitář: https://github.com/adamgmakes/SplitFlapDisplay
- 3D tištěný modulový hardware, bubnový znakový set, protokol sběrnice RS485
  a referenční Python frontend v kořeni tohoto repozitáře (`app.py`,
  `index.html`) jsou odvozeny z jeho práce.

Původní projekt je licencován pod
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Tento derivát je sdílen za stejných podmínek: nekomerční použití, uvedení
autora (Adam G Makes) a šíření dalších derivátů pod stejnou licencí.
Komerční použití vyžaduje souhlas původního autora.

## 13. Poznámky pro zvídavé

- Integrace má vlastní engine aplikací, playlisty, ukládání nastavení a
  zálohu/obnovu.
- Data aplikací se berou především z Home Assistantu; síťová volání se cachují.
- Panel je obyčejný JavaScript načtený přes `panel_custom`, bez build kroku a
  bez externích závislostí.
- Soubory `app.py` a `index.html` v kořeni repozitáře jsou původní referenční
  implementace od AdamGMakes a Home Assistant je nepoužívá.

Technické podrobnosti, MQTT kontrakt a vývojové poznámky najdete v anglickém
[README.md](README.md).
