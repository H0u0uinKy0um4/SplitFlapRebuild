# Panel a nastavení

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/use/panel.md)

Panel je JavaScriptový ES modul bez buildu, registrovaný přes `panel_custom`.
Není potřeba přidávat žádný zdroj do Lovelace.

## Záložky

| Záložka | Obsah |
| --- | --- |
| **Control** | Živý náhled, víceřádkové psaní, tlačítka barevných lístků, startovní sloupec, pořadí odesílání, rychlost, tvorba playlistu a uložené playlisty. |
| **Apps** | Karty aplikací s dostupností, ozubené kolečko pro nastavení aplikace, tlačítko režimu a spuštění/zastavení. |
| **Tuning** | Záložky Commands, Map, Auto-tune, Teach a Drum. |
| **Settings** | Záložky Display, Apps, Drums a System. System má vnořené OTA modulů, OTA masteru a Připojení a zálohu. |

## Control

- Text se skládá v poli a odesílá se zvoleným **pořadím odesílání** a
  **rychlostí**. Platí stejná pravidla zalamování jako u `send_text`, takže
  náhled odpovídá tomu, co tabule dostane.
- **Tlačítka barevných lístků** vkládají malé barevné znaky firmwaru (`r`, `o`,
  `y`, `g`, `b`, `p`, `w`). Buben barevná emoji neobsahuje; integrace je na tyto
  lístky převádí.
- **Startovní sloupec** je od 1 a aplikuje se před zalamováním, stejně jako pole
  `start` u služby.
- **Playlisty** se skládají stránku po stránce s vlastní prodlevou a stylem a pak
  se uloží pod jménem pro `run_saved_playlist`.

## Apps

Karta ukazuje název, popis, ikonu a dostupnost aplikace. Když se aplikace nevejde
do rozvržení, karta je zakázaná a uvede požadavek; viz
[rozvržení](../protocol/layout.md#dostupnost-aplikaci). Ozubené kolečko otevírá
nastavení aplikace, tlačítko režimu volí variantu z manifestu, například u hodin
`full`, `time`, `date` nebo `minutes`. Režim `minutes` ukazuje aktuální
dvoumístné minuty a vejde se do rámu 1 × 2.

## Tuning

| Záložka | Účel |
| --- | --- |
| **Commands** | Seznam modulů, stav online, home, goto, relativní kroky, scan, sync, refresh. |
| **Map** | Mapa pozic v EEPROM pro každý modul, včetně mazání záznamů. |
| **Auto-tune** | Projede modul celým bubnem a zaznamená pozice. |
| **Teach** | Uloží aktuální pozici jako index bubnu, včetně indexu `0`. |
| **Drum** | Zapíše 64znakový buben do EEPROM modulu. Mapa znaků zůstává na podzáložce Map. |

Pohyby jsou blokující. Po `home`, `goto`, `step` nebo `apply` master odloží
obnovení stavu o 5 sekund, takže modul se může krátce jevit jako offline. To je
očekávané.

## Nastavení

### Záložka Display

Záložka Display je jedna karta se třemi sekcemi: **Rozvržení desky**,
**Předvolby** a **Vývojářské volby**. Rozvržení používá kompaktní třísloupcovou
mřížku, předvolby dvousloupcovou a vývojářské možnosti jsou přepínače.
**Uložit nastavení** je v liště podzáložek.

| Klíč | Význam |
| --- | --- |
| `row_counts` | Počet modulů v každé fyzické řadě oddělený čárkou, například `3,3,1`. Prázdná hodnota znamená automaticky. |
| `rows`, `cols` | Rozměry rámu. `0` je odvodí z počtu zjištěných modulů. |
| `debug_ignore_module_limit` | Ladící přepínač: použije nastavený rám, i když je nalezeno méně modulů, a povolí aplikace, které obvykle potřebují větší tabuli. Výchozí `false`. |
| `debug_allow_incompatible_firmware` | Ladící přepínač: povolí zápis firmwaru, jehož generace sběrnice nebo OTA neodpovídá masteru. Výchozí `false`. |
| `ui_scale` | Měřítko náhledu v procentech (`50`–`200`, výchozí `100`). |
| `theme` | `auto` (podle Home Assistantu), `light` nebo `dark`. |
| `timezone` | IANA název, například `Europe/Prague`. Prázdné použije časové pásmo Home Assistantu. |
| `units` | `auto`, `imperial` nebo `metric`. |
| `page_delay` | Výchozí prodleva stránky v sekundách (`0.1`–`120`, výchozí `5`). |

Když je ladění zapnuté, stavový řádek zobrazí odznak **LADĚNÍ**. Panel vykreslí
celý nastavený rám a karty aplikací jsou povolené, ale buňky bez fyzického modulu
se při odesílání příkazů přeskočí. Před běžným použitím displeje ladění znovu
vypněte. Viz [ladící přepínač](../protocol/layout.md#ladici-prepinac).

### Záložka Apps

Nastavení aplikací mají jmenný prostor `<aplikace>.<klíč>`, takže dvě aplikace
mohou mít obě `clock_format`. Výchozí hodnoty jsou v
`apps/<klíč>/manifest.json`. Staré ploché klíče z dřívějších verzí se při prvním
načtení migrují. Pole manifestu může použít `visible_when`, aby se zobrazilo jen
při určité hodnotě jiného pole; například pole API klíče počasí je skryté, když je
vybraná entita `weather`.

Registrované klíče jsou `animations.*`, `clock.*`, `countdown.*`, `dashboard.*`,
`date.*`, `stocks.*` a `weather.*`. Přesný seznam je v manifestech aplikací.

### Záložka Drums

`default_drum` je záložní 64znakový buben pro moduly, které svůj nehlásí. Není to
textové pole; záložka buben zobrazí a nabídne standardní.

### Záložka System

System má vlastní vnořené podzáložky, výchozí je **OTA modulů**:

| Vnořená podzáložka | Obsah |
| --- | --- |
| **OTA modulů** | Cílový modul, publikované verze modulů, místní HEX, hromadný zápis, průběh a zrušení. |
| **OTA masteru** | Publikované verze masteru, místní BIN, přehled verze a kompatibility, průběh a zrušení. |
| **Připojení a záloha** | Dlaždice připojení a sběrnice plus záloha a obnova nastavení, playlistů a snímku. |

Vždy se vykresluje jen jedna vnořená stránka a průběh zůstává v její
podzáložce; globální odznak OTA není. Dlaždice připojení ukazují stav masteru,
MQTT prefix, hardware a engine včetně verzí a poznámek o kompatibilitě.

## OTA firmware modulů

**Settings → System** obsahuje i OTA ovládání. Hlavní výběr zobrazuje publikované
verze firmwaru modulu z GitHubu: nejprve stabilní tagy, pak nejnovější `dev`
sestavení. Panel vybraný HEX stáhne až při zápisu, ověří kontrolní součet
a kompatibilitu z manifestu, zkontroluje aplikační oblast a posílá ji přes
`<prefix>/command/firmware`. Místně sestavený `firmware.hex` z buildu
`ATtiny1616_OTA` zůstává dostupný v sekci **Místní HEX (pokročilé)**. Pokrok dorazí
v objektu `ota` ve statusu a master během flashování blokuje zobrazování
přibližně 20–25 sekund.

Stejná karta nabízí i **ZAPSAT VŠECHNY MODULY**. Hromadný zápis prochází nalezené
moduly ve vzestupném pořadí id. Po úspěšném zápisu se modul sám restartuje do
aplikace, proto panel už nenabízí tlačítko spuštění. Master dovoluje jen jednu
OTA relaci, proto panel frontu zpracovává striktně postupně: další zápis začne
až po dokončení předchozího modulu. Selhání nebo zrušení modulu frontu zastaví
a **Zrušit** přeruší celou operaci. Řádek průběhu ukazuje aktuální modul a počet
dokončených. Drátové detaily jsou v [OTA modulů](../protocol/ota.md).

## OTA masteru

**Nastavení → Systém → OTA masteru** aktualizuje samotný ESP32 master přes
samostatný MQTT topic. Výběr verze zobrazuje publikované verze typu `master-app`,
nejprve stabilní a pak nejnovější `dev`. Home Assistant stáhne `.bin` až při
zápisu, ověří SHA-256 a porovná `mqtt_compat` verze s integrací i s připojeným
masterem. Známá neshoda zápis zablokuje; jedinou výjimkou je ladící přepínač.

Po potvrzení master přijme obraz, ověří ho, zapíše do neaktivního OTA oddílu,
restartuje se a publikuje novou verzi. Panel považuje aktualizaci za úspěšnou
až po tomto znovupřipojení do pěti minut. Zrušení je možné během přijímání; po
`flash` se master restartuje sám a tlačítko reset neexistuje. Pokud se nevrátí,
použijte ruční obnovení přes ArduinoOTA (hostitel `SplFlp_Master`, port 3232,
heslo z `OTA_PASSWORD`); panel tento port nikdy nepoužije. Viz
[kontrakt protokolu](../protocol/master-ota.md).

**Místní BIN (pokročilé)** přijímá místně sestavenou aplikaci `firmware.bin`.
Očekávaná verze je volitelná; bez ní panel upozorní a potvrdí jen znovupřipojení.
S očekávanou verzí se neshoda s kteroukoli generací MQTT odmítne; bez ní se
kontrola kompatibility přeskočí a zobrazí se jen upozornění. OTA modulů a OTA
masteru nemohou běžet současně.

## Poznámky k chování

- Statické vstupy se během psaní nepřekreslují, takže status neruší psaní.
- Zvolená záložka, podzáložka nastavení, vnořená podzáložka Systému a měřítko
  náhledu se ukládají do `localStorage`; platí pro daný prohlížeč, ne pro
  instalaci.
- Přepnutí jazyka pokrývá texty panelu, popisky nastavení, manifesty aplikací
  i názvy služeb a entit.

## Viz také

- [Entity](../use/entities.md)
- [Služby](../use/services.md)
- [Protokol OTA masteru](../protocol/master-ota.md)
- [YAML příklady](../automation/examples.md)
