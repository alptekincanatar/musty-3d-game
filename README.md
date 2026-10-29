# Musty Playground · Çarşı

Vanilla HTML, CSS ve ES modülleriyle hazırlanmış statik oyun / 360° stüdyo sitesi. Derleme, npm veya framework gerekmez.

## Çalıştırma

Proje klasöründe:

```sh
python3 -m http.server 8780
```

Ardından `http://localhost:8780` adresini aç. ES modülleri nedeniyle siteyi `file://` ile değil, HTTP üzerinden çalıştır.

## Dosya haritası

- `index.html` — Türkçe sayfa yapısı, oyun kökü, stüdyo, mimikler, ses tahtası ve lightbox.
- `css/main.css` — responsive site tasarımı, erişilebilir odaklar ve reduced-motion stilleri.
- `css/game.css` — oyunun kendi arayüz stilleri.
- `js/main.js` — başlatma, mobil menü, scroll reveal ve global ses düğmesi.
- `js/audio.js` — ses yöneticisi, ElevenLabs sesleri, Web Audio efektleri ve kalıcı sessiz mod.
- `js/game.js` — canvas oyunu ve DOM arayüzü.
- `js/game-logic.js` — DOM’suz, test edilebilir oyun kuralları.
- `js/studio.js` — 8 kareli 360° sürükleme, atalet, otomatik dönüş, kıyafetler ve gerçek PNG dışa aktarma.
- `js/gallery.js` — mimik lightbox’ı ve 12 satırlık ses tahtası.
- `test/game.test.mjs` — oyun kuralı testleri.

## Sesler nasıl tetiklenir?

Sesler ilk kullanıcı hareketinden sonra açılır. Oyun başlangıcında `start`; siyah indirim yakalayınca sınırlandırılmış `good1–3`; kırmızı tuzağa çarpınca `bad1–3`; seviye artışında dönüşümlü `speed1–3`; oyun sonunda `over1–2` çalar. Yakalama, çarpma, seviye ve oyun sonu sentetik Web Audio efektleri de kullanır.

Üstteki düğme global sessiz modu değiştirir ve tercih `localStorage` içinde saklanır. Mimik kartları rastgele bir Musty repliği çalar. Ses tahtasındaki doğrudan düğmeler `{ force: true }` ile çağrıldığından sessiz modda bile bilinçli tıklamayla bir replik çalar.

## Kontroller

- Oyun: `←` / `→` veya `A` / `D`; dokunmatikte işaretçiyi sürükle. `P` / `Esc` duraklatır.
- Stüdyo: yatay sürükle veya odaktayken ok tuşları; `Home` ilk açı (0°), `End` son açı (315°). Ön / Arka düğmeleri 0° ve 180°’ye gider.
- Mimik kartı: büyütür ve seslendirir; `Esc` lightbox’ı kapatır.

## Hızlı kontrol

```sh
for file in js/*.js; do node --check "$file"; done
node --test test/game.test.mjs
```
