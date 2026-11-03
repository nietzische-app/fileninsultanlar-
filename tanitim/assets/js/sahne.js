var Sahne = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // motor/sahne.js
  var sahne_exports = {};
  __export(sahne_exports, {
    ciz: () => ciz,
    denetle: () => denetle,
    topKonum: () => topKonum
  });

  // ../src/game/constants.js
  var GAME_WIDTH = 900;
  var GAME_HEIGHT = 500;
  var GROUND_Y = 420;
  var WALL_PAD = 30;
  var NET = {
    x: GAME_WIDTH / 2,
    width: 12,
    height: 150,
    get topY() {
      return GROUND_Y - this.height;
    }
  };
  var PHYSICS = {
    ballGravity: 1150,
    playerGravity: 2300,
    jumpVelocity: -770,
    playerSpeed: 340,
    airControl: 0.75,
    // havadayken yatay kontrol çarpanı
    ballRadius: 13,
    /** Hedefli vuruşların hedefleyebileceği azami hız. */
    ballMaxSpeed: 1e3,
    /** Mutlak tavan — çarpanlar üst üste binse de hiçbir top bunu aşamaz. */
    ballSpeedCeiling: 1700,
    ballAirDrag: 0.999,
    wallRestitution: 0.9,
    netRestitution: 0.65,
    bumpPower: 500,
    // normal temas
    hitPower: 640,
    // vuruş tuşuyla temas
    spikePower: 810,
    // havada + vuruş tuşu
    hitCooldown: 0.14,
    // saniye — aynı oyuncunun ard arda vurmasını engeller
    /** Bu hızın üstündeki toplarda temas alanı daralmaya başlar. */
    cleanTouchSpeed: 520,
    /**
     * Bu hızın üstünde gelen top ilk temasta smaçlanamaz, manşetle
     * karşılanır. Dig → pas → smaç ritmini kuran eşik budur.
     */
    attackControlSpeed: 620,
    /**
     * Sabit simülasyon adımı (sn).
     *
     * Fizik eskiden ekranın tazeleme hızına bağlıydı: adım, iki kare
     * arasında geçen gerçek süreydi — yani 60 Hz telefonla 144 Hz telefon
     * aynı topu farklı yere düşürüyordu. Ölçümde (adim.mjs) eski döngü
     * altı ayrı kare hızında altı ayrı sonuç verdi; yeni döngü hepsinde
     * birebir aynısını veriyor. Ağ üzerinden oynanacaksa bu zaten şart:
     * anlık görüntüler adım numarasına bağlanacak.
     *
     * Ölçüm koşumları (tests/olcum) zaten `update(1/60)` çağırıyordu;
     * oyun da artık ölçtüğümüz şeyi çalıştırıyor.
     */
    step: 1 / 60,
    /**
     * Bir karede telafi edilecek en fazla gerçek zaman (sn) — 2 adım.
     *
     * Sekme arkaya alınıp geri gelindiğinde biriken saniyeler tek karede
     * kapatılmaya çalışılırsa top fileden geçip gider.
     *
     * Sınırın 5 adım (1/12) olduğu sürüm ölçümde reddedildi: eski döngü
     * ağır cihazda oyunu sessizce ağır çekime alıp kareleri ucuzlatıyordu,
     * 5 adımlık telafi ise gerçek zamanı korumak için kare başına üç kat
     * iş yapıyor ve 6x CPU kısıtında 50 ms üstü kare oranını %33'ten
     * %50'ye çıkarıyordu. 2 adımda oran %27–37 bandında, yani tabanla
     * aynı. Bedeli açık: 30 FPS'in altında oyun yine ağırlaşıyor —
     * eskisi gibi. Düşük FPS'te akıcılık, kare maliyetiyle takas
     * edilemiyor; takas edilebilen tek şey hangisinin bozulacağıydı.
     */
    maxCatchUp: 1 / 30,
    /**
     * Adım eşiğindeki tolerans (sn) — "az kaldıysa yine de at".
     *
     * 60 Hz ekranda kare süresi adımın kendisidir ama zaman damgası ±1 ms
     * oynar. Tolerans olmadan biriken artık sıfırın iki yanında gezinir:
     * bir kare hiç ilerlemez, sonraki iki adım atar. Ölçüm (adim.mjs,
     * 10 sn, ±1 ms titreme) bunu tam 60 Hz'de 600 karenin 148'inde boş +
     * 148'inde çift olarak gösterdi; hissedilen "hafif kasma" bu.
     *
     * Adımı erken atıp açığı biriktirerek taşıyoruz — bu yüzden oyun
     * hızlanmıyor. İlk denemem kare süresini tam adıma YUVARLAMAKTI;
     * boş/çift kareyi o da kesiyordu ama 61 Hz ekranda oyunu kalıcı
     * olarak %1.5 hızlandırıyordu. Açığı taşımak ikisini de çözer:
     * fazlalık birikince kendiliğinden bir boş kare doğar.
     */
    stepSlack: 2e-3
  };
  var ARENA = {
    roofH: 22,
    upperTierY: 24,
    upperTierH: 68,
    ribbonY: 96,
    ribbonH: 18,
    lowerTierY: 118,
    lowerTierH: 66,
    boardsY: 188,
    boardsH: 24,
    /**
     * Panoların altı oyun hacmidir. Zıplayan oyuncunun kafası ~y228'e
     * kadar çıkıyor; panolar bundan yukarıda kalmalı, yoksa oyuncular
     * tribünün içinde duruyormuş gibi görünüyor.
     */
    backWallY: 212
  };
  var FLOOR = {
    spread: 1.7,
    nearY: GAME_HEIGHT - 10
  };
  var PLAYER = {
    hitRadius: 40,
    // gövde + kollar
    hitOffsetY: 44,
    // ayaklardan gövde merkezine
    /*
     * HAVADA + vuruş tuşundayken temas merkezi yükselir — kol uzanır.
     *
     * Voleybolda smaç kafanın ÜSTÜNDEN vurulur; oyunda ise temas dairesi
     * zıplarken bile göğüs hizasında (44px) kalıyordu. Ölçümde
     * gerçekleşen temaslarda topun KENARI ile gövde kutusu arasındaki
     * boşluk ortanca 8.5px, havadaki vuruşların %13'ünde ise sıfırın
     * altındaydı — yani topu üstüne almadan vurulamıyordu.
     *
     * Neden merkez, neden yarıçap değil: yarıçapı büyütmek savunmayı da
     * kolaylaştırıyor. Denendi ve ölçüm reddetti — ralliler bitmez oldu
     * (zorda temas 9.7 → 14.5, 2v2'de 19.8 → 33.7). Merkezi yukarı almak
     * yalnızca hücum hamlesine dokunuyor.
     *
     * 52 = +8px. 60 da denendi; boşluğu 15.6px'e çıkarıyor ama dengeyi
     * belirgin kaydırıyordu (zor sayı payı %49 → %69).
     */
    attackOffsetY: 52,
    /*
     * Vuruş tuşu basılıyken erişim artışı — yerdeyken.
     *
     * Bunu 20'ye çıkarmak denendi ve ölçüm reddetti: pay savunmaya da
     * yaradığı için ralliler bitmez oldu (zorda temas 9.0 → 14.5, 2v2'de
     * 19.5 → 33.7) ve rakip çöktü. Yerdeki değer olduğu gibi kalıyor.
     */
    reachBonus: 12,
    /*
     * HAVADAYKEN vuruş tuşu: kolunu uzatarak vurma payı.
     *
     * Asıl şikâyet buydu — "şut atarken topu üstüne almak gerekiyor".
     * Ölçümde gerçekleşen temaslarda topun KENARI ile gövde kutusu
     * arasındaki boşluk ortanca 8.5px, %15.6'sında sıfırın altındaydı
     * (top gövdeye biniyor). Teorik pay da dardı: smaçta 19px.
     *
     * Pay yalnızca hücum hamlesine verilir; yerdeki manşet aynı kalır,
     * böylece ralliler uzamıyor.
     */
    attackReachBonus: 12,
    /**
     * Vuruş salınımının süresi (sn).
     *
     * Vuruş eskiden "tuş basılı mı" durumuydu: basılı tutan oyuncu sürekli
     * vuruş pozunda kalıyor, erişim artışını ve vuruş gücünü hiç
     * bırakmıyordu. Yani en iyi strateji tuşu bırakmamaktı ve karakter
     * kalıcı olarak vuruş pozunda donuyordu.
     *
     * Artık basış bir SALINIM başlatıyor: bu süre boyunca vuruş açık,
     * sonra kapanıyor. Basılı tutmak yeni salınım başlatmaz — tuşu
     * bırakıp yeniden basmak gerekir.
     *
     * Süre tam vuruş penceresinden (PERFECT.window, 0.17) uzun olmalı:
     * eşit olsaydı salınımdaki HER temas tam vuruş sayılır ve zamanlama
     * ödülü anlamını yitirirdi. 0.34 = pencerenin iki katı; ilk yarısı
     * tam vuruş, kalanı normal vuruş.
     */
    swingDuration: 0.45,
    minReachFactor: 0.55,
    // hızlı toplarda temas alanının inebileceği alt sınır
    spriteScale: 3.4
  };
  var PALETTE = {
    night: "#0b0b12",
    hallWall: "#141428",
    hallWallDark: "#0e0e1d",
    standRow: "#1d1d38",
    courtIn: "#8E1018",
    courtOut: "#5C070D",
    courtLine: "#FFFFFF",
    net: "#F2F2F2",
    netPost: "#C9CBD6",
    ballWhite: "#FFFFFF",
    ballRed: "#E30A17",
    ballBlue: "#1B4FE0",
    flame: ["#FFF3A0", "#FFC633", "#FF7A18", "#E30A17"],
    outline: "#15121A",
    shadow: "rgba(0, 0, 0, 0.38)",
    turkishRed: "#E30A17",
    gold: "#FFD24A",
    // Salon katmanları
    roof: "#0a0a14",
    truss: "#242440",
    tierBack: "#12122a",
    tierStep: "#1b1b38",
    ribbonDark: "#0d0d1c",
    ribbonOn: "#FFD24A",
    adBoard: "#101024",
    backWall: "#0e0e1c",
    backWallPanel: "#14142c",
    lightWarm: "rgba(255, 244, 205,",
    floorSheen: "rgba(255, 255, 255, 0.05)",
    awayPrimary: "#2B3A8F",
    awaySecondary: "#E8ECFF",
    awaySkin: "#D9A57C",
    awayHair: "#22303F"
  };

  // ../src/game/players.js
  var POSITIONS = {
    ORTA: "Orta Oyuncu",
    PASOR: "Pas\xF6r",
    PASOR_CAPRAZI: "Pas\xF6r \xC7apraz\u0131",
    SMACOR: "Sma\xE7\xF6r",
    LIBERO: "Libero"
  };
  var DEFAULT_APPEARANCE = {
    hairStyle: "ponytail",
    headband: null,
    wristband: null,
    kneePads: "#FFFFFF",
    necklace: null,
    earring: null,
    tattoos: false
  };
  var KIT = {
    primary: "#E30A17",
    secondary: "#FFFFFF"
  };
  var LIBERO_KIT = {
    primary: "#1B1B3A",
    secondary: "#FFD24A"
  };
  var ROSTER = [
    {
      id: "gizel-orgen",
      name: "Gizel \xD6rgen",
      number: 2,
      position: POSITIONS.LIBERO,
      captain: true,
      birthDate: "1994-03-11",
      height: 171,
      weight: 60,
      stats: { attack: 38, block: 42, serve: 72, defense: 97, speed: 95, stamina: 93 },
      colors: {
        ...LIBERO_KIT,
        skin: "#F8D5C2",
        hair: "#3D2314",
        accent: "#FFD24A"
      },
      appearance: {
        hairStyle: "sleek-bun",
        headband: null,
        wristband: null,
        kneePads: "#FFD24A",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Kurtar\u0131\u015F",
        description: "Man\u015Fette \xFCst\xFCn savunma; al\xE7ak toplara geni\u015F eri\u015Fim."
      },
      modifiers: { bumpPower: 1.3, speed: 1.18, reach: 1.12, spikePower: 0.78, jump: 0.94 }
    },
    {
      id: "cansel-ozbey",
      name: "Cansel \xD6zbey",
      number: 5,
      position: POSITIONS.PASOR,
      captain: false,
      birthDate: "1997-01-23",
      height: 181,
      weight: 76,
      stats: { attack: 70, block: 76, serve: 82, defense: 86, speed: 92, stamina: 90 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#2B1D0C",
        accent: "#B7F5C6"
      },
      appearance: {
        hairStyle: "sleek-bun",
        headband: null,
        wristband: null,
        kneePads: null,
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "H\u0131zl\u0131 Tempo",
        description: "En h\u0131zl\u0131 saha i\xE7i hareket ve y\xFCksek s\u0131\xE7rama."
      },
      modifiers: { speed: 1.22, jump: 1.1, spikePower: 0.9, bumpPower: 1.1 }
    },
    {
      id: "salise-sanli",
      name: "Salise \u015Eanl\u0131",
      number: 9,
      position: POSITIONS.SMACOR,
      captain: false,
      birthDate: "1999-06-14",
      height: 185,
      weight: 73,
      stats: { attack: 87, block: 80, serve: 84, defense: 82, speed: 85, stamina: 86 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#3B2219",
        accent: "#9BE7FF"
      },
      appearance: {
        hairStyle: "bun",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "\xC7ift Y\xF6nl\xFC",
        description: "H\xFCcum ve savunmada dengeli; man\u015Fette ek g\xFC\xE7."
      },
      modifiers: { spikePower: 1.08, bumpPower: 1.12, speed: 1.04 }
    },
    {
      id: "handan-balatan",
      name: "Handan Balatan",
      number: 11,
      position: POSITIONS.SMACOR,
      captain: false,
      birthDate: "1996-12-03",
      height: 189,
      weight: 77,
      stats: { attack: 90, block: 82, serve: 86, defense: 84, speed: 84, stamina: 87 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#2A1B0E",
        accent: "#FF9ED2"
      },
      appearance: {
        hairStyle: "sleek-bun",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "\xC7apraz Plase",
        description: "Dengeli h\xFCcum; vuru\u015Flarda daha keskin a\xE7\u0131."
      },
      modifiers: { spikePower: 1.14, angle: 1.25, speed: 1.04 }
    },
    {
      id: "sinem-jak-kisar",
      name: "Sinem Jak-K\u0131sar",
      number: 4,
      position: POSITIONS.ORTA,
      captain: false,
      birthDate: "1994-02-19",
      height: 191,
      weight: 82,
      stats: { attack: 85, block: 92, serve: 78, defense: 76, speed: 74, stamina: 85 },
      colors: {
        ...KIT,
        skin: "#4A2E1B",
        hair: "#1A1A1A",
        accent: "#FFD24A"
      },
      appearance: {
        hairStyle: "curly-long",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: "#FFD24A",
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Tecr\xFCbeli Duvar",
        description: "Blokta %22 ek g\xFC\xE7 ve geni\u015F eri\u015Fim."
      },
      modifiers: { blockPower: 1.22, reach: 1.1, speed: 0.94 }
    },
    {
      id: "eylem-akarpinar",
      name: "Eylem Akarp\u0131nar",
      number: 17,
      position: POSITIONS.LIBERO,
      captain: false,
      birthDate: "2000-05-27",
      height: 172,
      weight: 56,
      stats: { attack: 36, block: 40, serve: 70, defense: 94, speed: 96, stamina: 92 },
      colors: {
        ...LIBERO_KIT,
        skin: "#F8D5C2",
        hair: "#B8860B",
        accent: "#FFD24A"
      },
      appearance: {
        hairStyle: "ponytail",
        headband: null,
        wristband: null,
        kneePads: "#FFD24A",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Seri Refleks",
        description: "Sahan\u0131n en h\u0131zl\u0131s\u0131; dal\u0131\u015Fta geni\u015F eri\u015Fim."
      },
      modifiers: { speed: 1.24, bumpPower: 1.2, reach: 1.08, spikePower: 0.75, jump: 0.96 }
    },
    {
      id: "elifnur-sahan",
      name: "Elifnur \u015Eahan",
      number: 19,
      position: POSITIONS.PASOR,
      captain: false,
      birthDate: "2001-08-08",
      height: 188,
      weight: 69,
      stats: { attack: 74, block: 82, serve: 80, defense: 80, speed: 86, stamina: 88 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#3B2219",
        accent: "#C8B7FF"
      },
      appearance: {
        hairStyle: "high-bun",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Uzun Pas\xF6r",
        description: "Pas\xF6r h\u0131z\u0131 ile orta oyuncu eri\u015Fimi bir arada."
      },
      modifiers: { speed: 1.12, reach: 1.08, blockPower: 1.1, spikePower: 0.94 }
    },
    {
      id: "dilan-ozdener",
      name: "Dilan \xD6zdener",
      number: 21,
      position: POSITIONS.PASOR,
      captain: false,
      birthDate: "2004-11-30",
      height: 187,
      weight: 59,
      stats: { attack: 68, block: 72, serve: 78, defense: 82, speed: 88, stamina: 86 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#4A311E",
        accent: "#A8E6CF"
      },
      appearance: {
        hairStyle: "high-bun",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Sakin Da\u011F\u0131t\u0131m",
        description: "\u0130stikrarl\u0131 pas; man\u015Fette ve h\u0131zda dengeli."
      },
      modifiers: { speed: 1.14, bumpPower: 1.08, spikePower: 0.9 }
    },
    {
      id: "ela-erdim-dundal",
      name: "Ela Erdim D\xFCndal",
      number: 23,
      position: POSITIONS.ORTA,
      captain: false,
      birthDate: "1988-09-12",
      height: 187,
      weight: 74,
      stats: { attack: 88, block: 97, serve: 84, defense: 82, speed: 74, stamina: 90 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#7A5230",
        accent: "#FFD24A"
      },
      appearance: {
        hairStyle: "long",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: "#C0C0C0",
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Efsane Duvar",
        description: "Blokta %24 g\xFC\xE7; tecr\xFCbeyle geni\u015F file eri\u015Fimi."
      },
      modifiers: { blockPower: 1.24, reach: 1.14, jump: 1.04, speed: 0.94 }
    },
    {
      id: "derin-uyanir",
      name: "Derin Uyan\u0131r",
      number: 24,
      position: POSITIONS.ORTA,
      captain: false,
      birthDate: "2002-03-04",
      height: 194,
      weight: 71,
      stats: { attack: 86, block: 93, serve: 76, defense: 74, speed: 76, stamina: 84 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#2B1B10",
        accent: "#FFB86B"
      },
      appearance: {
        hairStyle: "high-ponytail",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: "#E8E8E8",
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Y\xFCksek Kademe",
        description: "Uzun boyla file \xFCst\xFCnde eri\u015Fim ve blok \xFCst\xFCnl\xFC\u011F\xFC."
      },
      modifiers: { blockPower: 1.18, reach: 1.14, jump: 1.06, speed: 0.94 }
    },
    {
      id: "berna-buse-ozdem",
      name: "Berna Buse \xD6zdem",
      number: 27,
      position: POSITIONS.ORTA,
      captain: false,
      birthDate: "2005-01-21",
      height: 186,
      weight: 66,
      stats: { attack: 82, block: 88, serve: 74, defense: 76, speed: 82, stamina: 82 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#3D2314",
        accent: "#FFE066"
      },
      appearance: {
        hairStyle: "high-ponytail",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Gen\xE7 Enerji",
        description: "Diri blok; file \xF6n\xFCnde toparlanmas\u0131 h\u0131zl\u0131."
      },
      /*
       * Sultan Gücü kaldırılınca `charge: 1.2` boşa düştü ve bu oyuncu
       * tek modifikatörle kalıyordu. Blok gücü telafi olarak yükseltildi
       * — kaldırılan bonusun yerine yenisi uydurulmadı, mevcut yönü
       * güçlendirildi.
       */
      modifiers: { blockPower: 1.24, jump: 1.06 }
    },
    {
      id: "zeliha-gunay",
      name: "Zeliha G\xFCnay",
      number: 28,
      position: POSITIONS.ORTA,
      captain: false,
      birthDate: "1998-10-09",
      height: 197,
      weight: 79,
      stats: { attack: 87, block: 96, serve: 78, defense: 76, speed: 72, stamina: 85 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#3B2219",
        accent: "#E30A17"
      },
      appearance: {
        hairStyle: "half-up",
        headband: null,
        wristband: "#E30A17",
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Duvar",
        description: "Kadronun en uzunu \u2014 en geni\u015F eri\u015Fim, en sert blok."
      },
      modifiers: { reach: 1.18, blockPower: 1.15, jump: 1.06, speed: 0.92 }
    },
    {
      id: "yagmur-erkin",
      name: "Ya\u011Fmur Erkin",
      number: 31,
      position: POSITIONS.SMACOR,
      captain: false,
      birthDate: "2002-04-17",
      height: 183,
      weight: 61,
      stats: { attack: 84, block: 76, serve: 82, defense: 84, speed: 92, stamina: 86 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#2A1B0E",
        accent: "#B7F5C6"
      },
      appearance: {
        hairStyle: "high-bun",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Hafif Ayak",
        description: "Kadronun en \xE7evik sma\xE7\xF6r\xFC; h\u0131zl\u0131 ve y\xFCksek s\u0131\xE7rar."
      },
      modifiers: { speed: 1.18, jump: 1.08 }
    },
    {
      id: "ilknur-aydan",
      name: "\u0130lknur Aydan",
      number: 33,
      position: POSITIONS.SMACOR,
      captain: false,
      birthDate: "2001-02-25",
      height: 184,
      weight: 66,
      stats: { attack: 89, block: 78, serve: 88, defense: 82, speed: 88, stamina: 85 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#2B1D0C",
        accent: "#FF7A18"
      },
      appearance: {
        hairStyle: "braided-bun",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: null,
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Servis Ate\u015Fi",
        description: "Sert servis ve sma\xE7; bar h\u0131zl\u0131 dolar."
      },
      modifiers: { spikePower: 1.16, speed: 1.08 }
    },
    {
      id: "melina-vargaz",
      name: "Melina Vargaz",
      number: 37,
      position: POSITIONS.PASOR_CAPRAZI,
      captain: false,
      birthDate: "1998-07-06",
      height: 193,
      weight: 75,
      stats: { attack: 98, block: 86, serve: 96, defense: 74, speed: 76, stamina: 86 },
      colors: {
        ...KIT,
        secondary: "#FFD24A",
        skin: "#7C5035",
        hair: "#111111",
        accent: "#FFD24A"
      },
      appearance: {
        hairStyle: "short-fade",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: "#FFD24A",
        earring: "#FFD24A",
        tattoos: true
      },
      bonus: {
        name: "Top Sallama",
        description: "Sma\xE7 \xE7\u0131k\u0131\u015F h\u0131z\u0131 %25 daha y\xFCksek."
      },
      modifiers: { spikePower: 1.25, bumpPower: 1.05, speed: 0.96 }
    },
    {
      id: "derya-basyolu",
      name: "Derya Ba\u015Fyolu",
      number: 42,
      position: POSITIONS.SMACOR,
      captain: false,
      birthDate: "2006-11-19",
      height: 192,
      weight: 70,
      stats: { attack: 82, block: 76, serve: 80, defense: 80, speed: 86, stamina: 84 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#4A3222",
        accent: "#FF9ED2"
      },
      appearance: {
        hairStyle: "half-ponytail",
        headband: null,
        wristband: null,
        kneePads: "#FFFFFF",
        necklace: "#E8E8E8",
        earring: null,
        tattoos: false
      },
      bonus: {
        name: "Taze Kan",
        description: "\xC7evik ve hevesli; bar biraz daha h\u0131zl\u0131 dolar."
      },
      modifiers: { speed: 1.1, spikePower: 1.04 }
    },
    {
      id: "ebru-karakut",
      name: "Ebru Karakut",
      number: 55,
      position: POSITIONS.PASOR_CAPRAZI,
      captain: false,
      birthDate: "2000-06-28",
      height: 194,
      weight: 73,
      stats: { attack: 96, block: 80, serve: 90, defense: 72, speed: 80, stamina: 88 },
      colors: {
        ...KIT,
        skin: "#F8D5C2",
        hair: "#4A3525",
        accent: "#FF7A18"
      },
      appearance: {
        hairStyle: "short-spiky",
        headband: null,
        wristband: null,
        kneePads: "#1B1B2E",
        necklace: null,
        earring: null,
        tattoos: true
      },
      bonus: {
        name: "Kara Kurt",
        description: "Sert sma\xE7; a\xE7\u0131l\u0131 bitiri\u015F."
      },
      modifiers: { spikePower: 1.22, angle: 1.12, bumpPower: 0.95 }
    }
  ];
  var OPPONENT_TEMPLATE = {
    id: "rakip",
    name: "Rakip",
    number: 1,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: null,
    height: 188,
    weight: 75,
    stats: { attack: 86, block: 86, serve: 84, defense: 84, speed: 84, stamina: 86 },
    colors: {
      primary: "#2B3A8F",
      secondary: "#E8ECFF",
      skin: "#D9A57C",
      hair: "#22303F",
      accent: "#9BB0FF"
    },
    appearance: {
      hairStyle: "short",
      headband: null,
      wristband: "#9BB0FF",
      kneePads: "#1B1B2E"
    },
    bonus: { name: "\u2014", description: "\u2014" },
    modifiers: {}
  };
  function getAppearance(data) {
    return { ...DEFAULT_APPEARANCE, ...data?.appearance ?? {} };
  }

  // ../src/game/sprites.js
  var SPRITE_UNITS_W = 14;
  var SPRITE_UNITS_H = 22;
  var DIGITS = {
    0: ["111", "101", "101", "101", "111"],
    1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"],
    3: ["111", "001", "111", "001", "111"],
    4: ["101", "101", "111", "001", "001"],
    5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"],
    7: ["111", "001", "001", "001", "001"],
    8: ["111", "101", "111", "101", "111"],
    9: ["111", "101", "111", "001", "111"]
  };
  var DIGIT_W = 3;
  var DIGIT_H = 5;
  var DIGIT_GAP = 1;
  function drawPixelNumber(ctx, value, cx, cy, dot, color, outline) {
    const text = String(value);
    const totalW = text.length * DIGIT_W * dot + (text.length - 1) * DIGIT_GAP * dot;
    const startX = cx - totalW / 2;
    const startY = cy - DIGIT_H * dot / 2;
    text.split("").forEach((char, index) => {
      const glyph = DIGITS[char];
      if (!glyph) return;
      const gx = startX + index * (DIGIT_W + DIGIT_GAP) * dot;
      for (let row = 0; row < DIGIT_H; row += 1) {
        for (let col = 0; col < DIGIT_W; col += 1) {
          if (glyph[row][col] !== "1") continue;
          const x = Math.round(gx + col * dot);
          const y = Math.round(startY + row * dot);
          const size = Math.max(1, Math.ceil(dot));
          if (outline) {
            ctx.fillStyle = outline;
            ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
          }
          ctx.fillStyle = color;
          ctx.fillRect(x, y, size, size);
        }
      }
    });
  }
  function blockPainter(ctx, originX, originY, u) {
    return (gx, gy, gw, gh, color, outline = true) => {
      if (!color) return;
      const x = originX + gx * u;
      const y = originY + gy * u;
      const w = gw * u;
      const h = gh * u;
      if (outline) {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(
          Math.round(x - 1),
          Math.round(y - 1),
          Math.round(w + 2),
          Math.round(h + 2)
        );
      }
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      if (h >= u * 1.6 && w >= u * 1.2) {
        const band = Math.max(1, Math.round(h * 0.24));
        ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), band);
        ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
        ctx.fillRect(
          Math.round(x),
          Math.round(y + h - band),
          Math.round(w),
          band
        );
      }
    };
  }
  function drawTaperedStack(ctx, originX, originY, u, bands, opts = {}) {
    const { shade = true, centerX = SPRITE_UNITS_W / 2 } = opts;
    const box = (b) => [
      Math.round(originX + (centerX - b.w / 2) * u),
      Math.round(originY + b.y * u),
      Math.round(b.w * u),
      Math.round(b.h * u)
    ];
    ctx.fillStyle = PALETTE.outline;
    bands.forEach((b) => {
      const [x, y, w, h] = box(b);
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    });
    bands.forEach((b) => {
      const [x, y, w, h] = box(b);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, w, h);
    });
    if (!shade) return;
    const strip = Math.max(1, Math.round(u * 0.36));
    const [fx, fy, fw] = box(bands[0]);
    ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
    ctx.fillRect(fx, fy, fw, strip);
    const [lx, ly, lw, lh] = box(bands[bands.length - 1]);
    ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
    ctx.fillRect(lx, ly + lh - strip, lw, strip);
  }
  var TORSO_BANDS = [
    { y: 8, h: 1.3, w: 7.1 },
    { y: 9.3, h: 2.2, w: 6.8 },
    { y: 11.5, h: 1.4, w: 6 },
    { y: 12.9, h: 1.4, w: 7.4 }
  ];
  var TORSO_MAX_W = Math.max(...TORSO_BANDS.map((b) => b.w));
  function drawHair(px, style, hair, facing) {
    const HAIR_L = 3.6;
    const HAIR_R = 10.4;
    const OVERLAP = 1;
    const back = (gy, gw, gh, outline = true) => px(
      facing > 0 ? HAIR_L - gw + OVERLAP : HAIR_R - OVERLAP,
      gy,
      gw,
      gh,
      hair,
      outline
    );
    const front = (gy, gw, gh, outline = false) => px(
      facing > 0 ? HAIR_R - OVERLAP : HAIR_L - gw + OVERLAP,
      gy,
      gw,
      gh,
      hair,
      outline
    );
    let crown = null;
    switch (style) {
      case "short-spiky":
        px(4.3, 0.1, 1.3, 1.3, hair);
        px(6.1, -0.3, 1.5, 1.7, hair);
        px(8.1, 0.1, 1.3, 1.3, hair);
        crown = [4.3, 5.1];
        break;
      case "short-fade":
        px(5.4, -0.2, 1.2, 1.7, hair);
        px(7, -0.4, 1.2, 1.9, hair);
        crown = [5.4, 2.8];
        break;
      case "bun":
        px(5.6, -0.7, 2.8, 2.1, hair);
        px(6.3, -1.2, 1.4, 0.9, hair, false);
        crown = [5.6, 2.8];
        break;
      case "sleek-bun":
        px(5.9, -0.4, 2.2, 1.8, hair);
        px(6.3, -0.8, 1.4, 0.7, hair, false);
        crown = [5.9, 2.2];
        break;
      case "high-bun":
        px(5.2, -1.3, 3.6, 2.7, hair);
        px(5.8, -1.9, 2.4, 1, hair, false);
        crown = [5.2, 3.6];
        break;
      case "braided-bun":
        px(5.7, -0.9, 2.6, 2.3, hair);
        crown = [5.7, 2.6];
        break;
      case "half-up":
        px(5.5, -0.7, 3, 1.9, hair);
        crown = [5.5, 3];
        break;
      case "high-ponytail":
        px(5.9, -0.5, 2.2, 1.6, hair);
        crown = [5.9, 2.2];
        break;
      case "half-ponytail":
        px(5.9, -0.2, 2, 1.4, hair);
        crown = [5.9, 2];
        break;
      default:
        break;
    }
    px(3.7, 0.8, 6.6, 2.2, hair);
    px(3.6, 1.6, 1.15, 3.9, hair, false);
    px(9.25, 1.6, 1.15, 3.9, hair, false);
    if (crown) px(crown[0] + 0.15, 0.7, crown[1] - 0.3, 0.85, hair, false);
    switch (style) {
      case "short":
        px(3.5, 5.2, 1.35, 1.2, hair, false);
        px(9.15, 5.2, 1.35, 1.2, hair, false);
        break;
      case "short-spiky":
        px(3.5, 5, 1.25, 1, hair, false);
        px(9.25, 5, 1.25, 1, hair, false);
        break;
      case "short-fade":
        px(3.35, 2, 0.9, 3.2, hair, false);
        px(9.75, 2, 0.9, 3.2, hair, false);
        back(2.8, 1.4, 2.6);
        back(5, 1.5, 1.8, false);
        break;
      case "sleek-bun":
        px(4.2, 1.2, 5.6, 1, hair, false);
        break;
      case "braided-bun":
        back(2.8, 1.5, 2);
        back(4.6, 1.7, 1.6);
        break;
      case "long":
        back(2.6, 1.8, 5.6);
        back(7.8, 1.45, 4.2, false);
        front(2.8, 1.2, 5);
        break;
      case "curly-long":
        back(2.4, 2, 3.2);
        back(4.6, 2.2, 3);
        back(6.8, 1.9, 3);
        front(2.9, 1.3, 2.6);
        front(4.8, 1.4, 2.4);
        break;
      case "half-up":
        back(2.6, 1.8, 5.8);
        back(8, 1.45, 4.4, false);
        front(3, 1.2, 5.4);
        break;
      case "high-ponytail":
        back(1.7, 1.5, 5.8);
        back(7.3, 1.8, 1.9, false);
        break;
      case "half-ponytail":
        back(2.8, 1.3, 3.4);
        front(3.2, 1.2, 4);
        break;
      case "braid":
        back(2.5, 1.5, 2.3);
        back(4.6, 1.8, 2);
        back(6.4, 1.5, 2);
        back(8.2, 1.2, 1.6);
        break;
      case "bun":
      case "high-bun":
        break;
      case "ponytail":
      default:
        back(2.7, 1.4, 4.4);
        back(6.9, 1.7, 1.6, false);
        break;
    }
  }
  function drawExtras(px, look, facing, skin) {
    if (look.necklace) {
      px(5.6, 8.5, 2.8, 0.45, look.necklace, false);
      px(6.4, 8.8, 1.2, 0.4, look.necklace, false);
    }
    if (look.earring) {
      const earX = facing > 0 ? 9.3 : 4;
      px(earX, 4.7, 0.7, 0.9, look.earring, false);
    }
    if (look.tattoos) {
      const ink = "#2A1810";
      if (facing > 0) {
        px(10.6, 10.2, 1.3, 0.5, ink, false);
        px(10.75, 11.2, 0.95, 0.42, ink, false);
        px(2.1, 10.6, 1.1, 0.45, ink, false);
      } else {
        px(2.1, 10.2, 1.3, 0.5, ink, false);
        px(2.25, 11.2, 0.95, 0.42, ink, false);
        px(10.6, 10.6, 1.1, 0.45, ink, false);
      }
      void skin;
    }
  }
  function drawSultanDirect(ctx, data, opts) {
    const {
      x,
      y,
      scale: u = 3,
      pose = "idle",
      facing = 1,
      frame = 0,
      showNumber = true
    } = opts;
    const { primary, secondary, skin, hair, accent } = data.colors;
    const look = getAppearance(data);
    const originX = x - SPRITE_UNITS_W / 2 * u;
    const originY = y - SPRITE_UNITS_H * u;
    const px = blockPainter(ctx, originX, originY, u);
    ctx.save();
    if (pose === "dive") {
      drawDivingSultan(ctx, data, look, { x, y, u, facing });
      ctx.restore();
      return;
    }
    const stride = pose === "run" ? Math.sin(frame * Math.PI * 2) * 1.1 : 0;
    const legSpread = pose === "jump" || pose === "spike" ? 1.2 : 0;
    const legW = 1.85;
    const legL = 4.45 - legSpread + stride;
    const legR = 7.7 + legSpread - stride;
    px(legL, 16.1, legW, 4.4, skin);
    px(legR, 16.1, legW, 4.4, skin);
    px(legL - 0.25, 17.5, legW + 0.5, 1.25, look.kneePads, false);
    px(legR - 0.25, 17.5, legW + 0.5, 1.25, look.kneePads, false);
    px(legL - 0.1, 20.1, legW + 0.2, 0.95, "#FFFFFF", false);
    px(legR - 0.1, 20.1, legW + 0.2, 0.95, "#FFFFFF", false);
    px(legL - 0.5, 20.9, legW + 1, 1.2, "#F5F5F5");
    px(legR - 0.5, 20.9, legW + 1, 1.2, "#F5F5F5");
    let wristL = null;
    let wristR = null;
    const armW = 1.7;
    const armL = SPRITE_UNITS_W / 2 - TORSO_MAX_W / 2 - armW + 0.15;
    const armR = SPRITE_UNITS_W / 2 + TORSO_MAX_W / 2 - 0.15;
    if (pose === "jump" || pose === "spike") {
      const hitArmY = pose === "spike" ? 1.4 : 3.2;
      const hitArmH = pose === "spike" ? 7.2 : 5.6;
      const hitX = facing > 0 ? armR : armL;
      const offX = facing > 0 ? armL : armR;
      px(hitX, hitArmY, armW, hitArmH, skin);
      px(offX, 4.4, armW, 5.4, skin);
      wristL = [hitX - 0.2, hitArmY + 0.5, armW + 0.4, 1.05];
      wristR = [offX - 0.2, 4.9, armW + 0.4, 1.05];
    } else if (pose === "bump") {
      const armX = facing > 0 ? 9.2 : 3;
      px(armX, 10.4, 3.6, 2.1, skin);
      px(facing > 0 ? 11.9 : 0.4, 11.4, 1.7, 1.75, skin);
      wristL = [facing > 0 ? 11.3 : 1.5, 10.6, 1.2, 1.85];
      wristR = null;
    } else if (pose === "cheer") {
      px(armL + 0.3, 2.4, armW, 6.4, skin);
      px(armR - 0.3, 2.4, armW, 6.4, skin);
      wristL = [armL + 0.1, 3, armW + 0.4, 1.05];
      wristR = [armR - 0.5, 3, armW + 0.4, 1.05];
    } else {
      px(armL, 8.9, armW, 5.4, skin);
      px(armR, 8.9, armW, 5.4, skin);
      wristL = [armL - 0.2, 13, armW + 0.4, 1.05];
      wristR = [armR - 0.2, 13, armW + 0.4, 1.05];
    }
    if (look.wristband) {
      if (wristL) px(...wristL, look.wristband, false);
      if (wristR) px(...wristR, look.wristband, false);
    }
    drawTaperedStack(
      ctx,
      originX,
      originY,
      u,
      TORSO_BANDS.map((b, i) => ({ ...b, color: i === 0 ? secondary : primary }))
    );
    const mid = SPRITE_UNITS_W / 2;
    TORSO_BANDS.slice(1).forEach((b) => {
      px(mid - b.w / 2, b.y, 0.5, b.h, secondary, false);
      px(mid + b.w / 2 - 0.5, b.y, 0.5, b.h, secondary, false);
    });
    const hem = TORSO_BANDS[TORSO_BANDS.length - 1];
    px(mid - hem.w / 2, hem.y + hem.h - 0.5, hem.w, 0.5, secondary, false);
    if (data.captain) {
      px(facing > 0 ? armL - 0.2 : armR - 0.2, 9.4, armW + 0.4, 1.25, accent, false);
    }
    px(3.3, 14.1, 7.4, 2.3, "#1B1B2E");
    px(6.05, 6.7, 1.9, 1.7, skin);
    px(5.75, 7.9, 2.5, 0.65, skin, false);
    drawTaperedStack(ctx, originX, originY, u, [
      { y: 2.3, h: 4, w: 5.2, color: skin },
      { y: 6.3, h: 0.8, w: 4.2, color: skin }
    ]);
    const eyeSize = Math.max(1, Math.round(u * 0.8));
    const eyeY = Math.round(originY + 4.3 * u);
    const eyeAX = Math.round(originX + (facing > 0 ? 6.6 : 5.25) * u);
    const eyeBX = Math.round(originX + (facing > 0 ? 8.15 : 6.8) * u);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(eyeAX, eyeY, eyeSize, eyeSize);
    ctx.fillRect(eyeBX, eyeY, eyeSize, eyeSize);
    const lashH = Math.max(1, Math.round(u * 0.24));
    const lashW = Math.max(1, Math.round(eyeSize * 1.15));
    const lashShift = Math.round(u * 0.18) * (facing > 0 ? 1 : -1);
    ctx.fillRect(eyeAX + lashShift, eyeY - lashH, lashW, lashH);
    ctx.fillRect(eyeBX + lashShift, eyeY - lashH, lashW, lashH);
    drawHair(px, look.hairStyle, hair, facing);
    px(3.6, 2.3, 6.8, 0.85, look.headband, false);
    drawExtras(px, look, facing, skin);
    if (showNumber) {
      const dot = Math.max(1, Math.round(u * 0.56));
      drawPixelNumber(
        ctx,
        data.number,
        originX + mid * u,
        originY + 10.4 * u,
        dot,
        secondary === primary ? "#FFFFFF" : secondary
      );
    }
    ctx.restore();
  }
  var sultanOnbellek = /* @__PURE__ */ new Map();
  var SULTAN_ONBELLEK_TAVAN = 48;
  var KOSU_ADIM = 8;
  function kosuKaresi(frame, pose) {
    if (pose !== "run") return 0;
    const f = (Number(frame) % 1 + 1) % 1;
    return Math.min(KOSU_ADIM - 1, Math.floor(f * KOSU_ADIM));
  }
  function onbellegeYaz(map, key, value, tavan) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > tavan) {
      const ilk = map.keys().next().value;
      map.delete(ilk);
    }
  }
  function drawSultan(ctx, data, opts = {}) {
    const pose = opts.pose ?? "idle";
    if (pose === "dive" || typeof document === "undefined") {
      drawSultanDirect(ctx, data, opts);
      return;
    }
    const u = opts.scale ?? 3;
    const facing = opts.facing ?? 1;
    const showNumber = opts.showNumber !== false;
    const kare = kosuKaresi(opts.frame ?? 0, pose);
    const id = data?.id ?? `${data?.number ?? ""}:${data?.name ?? ""}`;
    const key = `${id}|${pose}|${facing}|${kare}|${u}|${showNumber ? 1 : 0}`;
    let kayit = sultanOnbellek.get(key);
    if (!kayit) {
      const pad = Math.ceil(u * 4);
      const w = Math.ceil(SPRITE_UNITS_W * u) + pad * 2;
      const h = Math.ceil(SPRITE_UNITS_H * u) + pad * 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const octx = canvas.getContext("2d");
      if (!octx) {
        drawSultanDirect(ctx, data, opts);
        return;
      }
      octx.imageSmoothingEnabled = false;
      const feetX = pad + SPRITE_UNITS_W * u / 2;
      const feetY = pad + SPRITE_UNITS_H * u;
      drawSultanDirect(octx, data, {
        ...opts,
        x: feetX,
        y: feetY,
        scale: u,
        pose,
        facing,
        frame: pose === "run" ? (kare + 0.5) / KOSU_ADIM : 0,
        showNumber
      });
      kayit = { canvas, feetX, feetY };
      onbellegeYaz(sultanOnbellek, key, kayit, SULTAN_ONBELLEK_TAVAN);
    } else {
      onbellegeYaz(sultanOnbellek, key, kayit, SULTAN_ONBELLEK_TAVAN);
    }
    ctx.drawImage(kayit.canvas, opts.x - kayit.feetX, opts.y - kayit.feetY);
  }
  function drawDivingSultan(ctx, data, look, { x, y, u, facing }) {
    const { primary, secondary, skin, hair, accent } = data.colors;
    const f = facing >= 0 ? 1 : -1;
    const px = (gx, gy, gw, gh, color, outline = true) => {
      if (!color) return;
      const left = x + (f > 0 ? gx : -gx - gw) * u;
      const top = y + gy * u;
      const w = gw * u;
      const h = gh * u;
      if (outline) {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(
          Math.round(left - 1),
          Math.round(top - 1),
          Math.round(w + 2),
          Math.round(h + 2)
        );
      }
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(left), Math.round(top), Math.round(w), Math.round(h));
    };
    px(-11, -6.5, 6, 2.6, skin);
    px(-9.4, -7, 2.6, 1.3, look.kneePads, false);
    px(-12.6, -6.6, 2, 2.4, "#F5F5F5");
    px(-6.5, -8.6, 4.6, 4.2, "#1B1B2E");
    px(-2.6, -9.6, 6.8, 5.4, primary);
    px(-2.6, -9.6, 6.8, 1, secondary, false);
    px(-2.6, -4.8, 6.8, 0.8, secondary, false);
    if (data.captain) {
      px(2.2, -9.2, 1.6, 1.2, accent, false);
    }
    px(6.6, -7.6, 6, 2.4, skin);
    px(11.4, -7.9, 1.6, 3, look.wristband, false);
    px(3.4, -10.6, 5, 4.8, skin);
    ctx.fillStyle = PALETTE.outline;
    const eye = Math.max(1, Math.round(u * 0.8));
    ctx.fillRect(
      Math.round(x + (f > 0 ? 6.4 : -7.2) * u),
      Math.round(y - 9.2 * u),
      eye,
      eye
    );
    px(3.2, -11.4, 5.2, 1.8, hair);
    px(0.6, -11.2, 3, 1.6, hair, false);
    const trailing = look.hairStyle !== "short" && look.hairStyle !== "short-spiky" && look.hairStyle !== "short-fade";
    if (trailing) {
      px(-1.8, -11, 2.6, 1.4, hair, false);
      if (look.hairStyle === "long" || look.hairStyle === "curly-long" || look.hairStyle === "half-up") {
        px(-4, -10.6, 2.4, 1.2, hair, false);
      }
    }
    px(3.4, -10.6, 5, 0.9, look.headband, false);
    if (look.necklace) {
      px(4.2, -6.2, 2.4, 0.5, look.necklace, false);
    }
    drawPixelNumber(
      ctx,
      data.number,
      x + (f > 0 ? 0.8 : -0.8) * u,
      y - 7 * u,
      Math.max(1, Math.round(u * 0.5)),
      secondary === primary ? "#FFFFFF" : secondary
    );
  }
  function drawBallDisk(ctx, x, y, r) {
    const cell = Math.max(2, r / 5.5);
    const steps = Math.ceil(r / cell) + 1;
    const base = PALETTE.ballWhite;
    const stripeA = PALETTE.ballRed;
    const stripeB = PALETTE.ballBlue;
    for (let i = -steps; i <= steps; i += 1) {
      for (let j = -steps; j <= steps; j += 1) {
        const cx = i * cell;
        const cy = j * cell;
        const dist = Math.hypot(cx, cy);
        if (dist > r) continue;
        const ratio = dist / r;
        let color = base;
        if (ratio > 0.82) {
          color = PALETTE.outline;
        } else if (ratio > 0.34 && ratio < 0.74) {
          const angle = Math.atan2(cy, cx);
          if (angle > 0.25 && angle < 2.85) color = stripeA;
          else if (angle < -0.25 && angle > -2.85) color = stripeB;
        }
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(x + cx - cell / 2),
          Math.round(y + cy - cell / 2),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }
  var topOnbellek = /* @__PURE__ */ new Map();
  function topSprite(r) {
    if (typeof document === "undefined") return null;
    const key = Math.round(r * 2);
    const hazir = topOnbellek.get(key);
    if (hazir) return hazir;
    const cell = Math.max(2, r / 5.5);
    const pad = Math.ceil(cell) + 2;
    const size = Math.ceil(r * 2 + pad * 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, size);
    canvas.height = Math.max(1, size);
    const octx = canvas.getContext("2d");
    if (!octx) return null;
    octx.imageSmoothingEnabled = false;
    const half = size / 2;
    drawBallDisk(octx, half, half, r);
    const kayit = { canvas, half };
    onbellegeYaz(topOnbellek, key, kayit, 8);
    return kayit;
  }
  function drawBall(ctx, ball) {
    const { x, y, radius: r, rotation } = ball;
    const cell = Math.max(2, r / 5.5);
    const sprite = topSprite(r);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    if (sprite) {
      ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half);
    } else {
      drawBallDisk(ctx, 0, 0, r);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillRect(
      Math.round(x - r * 0.55),
      Math.round(y - r * 0.62),
      Math.ceil(cell),
      Math.ceil(cell)
    );
  }
  function drawTurkishFlag(ctx, x, y, u, wave = 0) {
    const cols = 12;
    const rows = 8;
    const cell = Math.ceil(u);
    const offsets = new Array(cols);
    ctx.fillStyle = PALETTE.turkishRed;
    for (let c = 0; c < cols; c += 1) {
      const offset = Math.sin(wave + c * 0.55) * u * 0.5;
      offsets[c] = offset;
      ctx.fillRect(
        Math.round(x + c * u),
        Math.round(y + offset),
        cell,
        Math.ceil(rows * u)
      );
    }
    ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < FLAG_WHITE.length; i += 1) {
      const [c, r] = FLAG_WHITE[i];
      ctx.fillRect(
        Math.round(x + c * u),
        Math.round(y + r * u + offsets[c]),
        cell,
        cell
      );
    }
  }
  var FLAG_WHITE = [
    // Hilal
    [3, 3],
    [3, 4],
    [4, 2],
    [4, 5],
    [5, 1],
    [5, 6],
    [6, 1],
    [6, 6],
    [7, 2],
    [7, 5],
    // Yıldız
    [9, 3],
    [9, 4],
    [10, 4]
  ];

  // ../src/game/arena.js
  var LIGHT_X = [GAME_WIDTH * 0.18, GAME_WIDTH * 0.5, GAME_WIDTH * 0.82];
  function floorX(x, y) {
    const span = FLOOR.nearY - GROUND_Y;
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, (y - GROUND_Y) / span));
    const k = 1 + (FLOOR.spread - 1) * t;
    return GAME_WIDTH / 2 + (x - GAME_WIDTH / 2) * k;
  }
  function rand(seed) {
    const v = Math.sin(seed * 127.1) * 43758.5453;
    return v - Math.floor(v);
  }
  function drawArena(ctx, time, hype = 0, score = null, touch = null) {
    drawShell(ctx);
    drawRoof(ctx, time);
    drawTier(ctx, {
      y: ARENA.upperTierY,
      height: ARENA.upperTierH,
      rows: 2,
      spacing: 20,
      size: 0.95,
      flagEvery: 5,
      dim: 0.55,
      time,
      hype
    });
    drawRibbon(ctx, time);
    drawTier(ctx, {
      y: ARENA.lowerTierY,
      height: ARENA.lowerTierH,
      rows: 2,
      spacing: 30,
      size: 1.45,
      flagEvery: 3,
      dim: 0.9,
      time,
      hype
    });
    const haze = ctx.createLinearGradient(0, 0, 0, ARENA.boardsY);
    haze.addColorStop(0, "rgba(8, 8, 20, 0.30)");
    haze.addColorStop(1, "rgba(8, 8, 20, 0.55)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, GAME_WIDTH, ARENA.boardsY);
    drawAdBoards(ctx, time);
    drawBackWall(ctx);
    drawWallScoreboards(ctx, score, touch);
    drawLightBeams(ctx, time);
  }
  function drawShell(ctx) {
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = PALETTE.tierBack;
    ctx.fillRect(0, 0, GAME_WIDTH, GROUND_Y);
  }
  function drawRoof(ctx, time) {
    ctx.fillStyle = PALETTE.roof;
    ctx.fillRect(0, 0, GAME_WIDTH, ARENA.roofH);
    ctx.fillStyle = PALETTE.truss;
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      ctx.fillRect(x, 6, 26, 3);
      ctx.fillRect(x + 12, 9, 3, 10);
    }
    ctx.fillRect(0, 19, GAME_WIDTH, 3);
    LIGHT_X.forEach((x, i) => {
      const flicker = 0.9 + Math.sin(time * 4 + i * 2.1) * 0.1;
      ctx.fillStyle = "#2b2b48";
      ctx.fillRect(Math.round(x - 30), 12, 60, 8);
      ctx.fillStyle = `rgba(255, 248, 214, ${flicker})`;
      ctx.fillRect(Math.round(x - 26), 20, 52, 7);
      ctx.fillStyle = `${PALETTE.lightWarm} ${0.18 * flicker})`;
      ctx.fillRect(Math.round(x - 34), 26, 68, 4);
    });
  }
  function drawTier(ctx, opts) {
    const { y, height, rows, spacing, size, flagEvery, dim, time, hype } = opts;
    const x0 = opts.x0 ?? 0;
    const x1 = opts.x1 ?? GAME_WIDTH;
    const steps = opts.steps ?? true;
    const crowd = opts.crowd ?? true;
    const rowHeight = height / rows;
    for (let r = 0; steps && r < rows; r += 1) {
      ctx.fillStyle = r % 2 === 0 ? PALETTE.tierStep : PALETTE.tierBack;
      ctx.fillRect(x0, y + r * rowHeight, x1 - x0, rowHeight);
    }
    if (steps) {
      ctx.fillStyle = PALETTE.hallWallDark;
      ctx.fillRect(x0, y + height - 5, x1 - x0, 5);
    }
    if (!crowd) return;
    ctx.save();
    ctx.globalAlpha = dim;
    for (let r = 0; r < rows; r += 1) {
      const baseY = y + r * rowHeight + rowHeight * 0.15;
      const offsetX = r % 2 * (spacing / 2);
      for (let i = 0; ; i += 1) {
        const seed = y * 3.7 + r * 31.3 + i * 17.9;
        const n = rand(seed);
        const jitter = (rand(seed + 5.5) - 0.5) * spacing * 0.45;
        const x = x0 + 8 + offsetX + i * spacing + jitter;
        if (x > x1) break;
        const bobSpeed = 2.2 + hype * 5;
        const bobAmount = (1.8 + hype * 5) * size;
        const bob = Math.sin(time * bobSpeed + seed) * bobAmount;
        if (i % flagEvery === Math.floor(n * flagEvery)) {
          drawFlagBearer(ctx, x, baseY + bob, size, time, seed, hype);
        } else {
          drawSpectator(ctx, x, baseY + bob, size, n);
        }
      }
    }
    ctx.restore();
  }
  function drawSpectator(ctx, x, y, size, n) {
    const w = Math.max(3, Math.round(7 * size));
    const headH = Math.max(3, Math.round(6 * size));
    const bodyH = Math.max(4, Math.round(9 * size));
    ctx.fillStyle = n < 0.33 ? "#C98A5E" : n < 0.66 ? "#E8B48C" : "#EFC7A6";
    ctx.fillRect(Math.round(x), Math.round(y), w, headH);
    ctx.fillStyle = n < 0.5 ? "#2B1B14" : "#3A2418";
    ctx.fillRect(Math.round(x), Math.round(y), w, Math.max(1, Math.round(2 * size)));
    ctx.fillStyle = n < 0.55 ? PALETTE.turkishRed : "#EFEFF6";
    ctx.fillRect(
      Math.round(x - size),
      Math.round(y + headH),
      Math.round(w + size * 2),
      bodyH
    );
  }
  function drawFlagBearer(ctx, x, y, size, time, seed, hype) {
    const u = Math.max(1, size * 1.4);
    const flagW = 12 * u;
    const flagH = 8 * u;
    const poleH = flagH + 8 * size;
    ctx.fillStyle = "#6b5b3e";
    ctx.fillRect(Math.round(x - 1), Math.round(y - 2), Math.max(1, Math.round(size)), poleH);
    drawTurkishFlag(
      ctx,
      x,
      y - 2,
      u,
      time * (3 + hype * 5) + seed
    );
    ctx.fillStyle = PALETTE.turkishRed;
    ctx.fillRect(
      Math.round(x),
      Math.round(y - 2 + flagH + 2 * size),
      Math.round(flagW * 0.5),
      Math.round(7 * size)
    );
  }
  function drawRibbon(ctx, time) {
    const { ribbonY: y, ribbonH: h } = ARENA;
    ctx.fillStyle = PALETTE.ribbonDark;
    ctx.fillRect(0, y, GAME_WIDTH, h);
    ctx.fillStyle = PALETTE.hallWallDark;
    ctx.fillRect(0, y, GAME_WIDTH, 2);
    ctx.fillRect(0, y + h - 2, GAME_WIDTH, 2);
    const cell = 10;
    const shift = time * 70 % (cell * 8);
    for (let x = -cell * 8; x < GAME_WIDTH + cell * 8; x += cell) {
      const index = Math.floor((x + shift) / cell);
      const phase = (index % 8 + 8) % 8;
      let color = null;
      if (phase === 0 || phase === 1) color = PALETTE.turkishRed;
      else if (phase === 2) color = "#FFFFFF";
      else if (phase === 4) color = PALETTE.ribbonOn;
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - shift + cell * 8), y + 4, cell - 2, h - 8);
    }
  }
  function drawAdBoards(ctx, time) {
    const { boardsY: y, boardsH: h } = ARENA;
    ctx.fillStyle = PALETTE.adBoard;
    ctx.fillRect(0, y, GAME_WIDTH, h);
    ctx.fillStyle = "#1b1b3a";
    for (let x = 6; x < GAME_WIDTH; x += 58) {
      ctx.fillRect(x, y + 4, 46, h - 8);
    }
    const bw = 330;
    const bx = GAME_WIDTH / 2 - bw / 2;
    ctx.fillStyle = PALETTE.turkishRed;
    ctx.fillRect(bx, y + 2, bw, h - 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(bx, y + 2, bw, 2);
    ctx.fillRect(bx, y + h - 4, bw, 2);
    const shine = time * 90 % (bw + 160) - 80;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(bx + shine, y + 2, 40, h - 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RETRO VOLEYBOL", GAME_WIDTH / 2, y + h / 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, y + h, GAME_WIDTH, 6);
  }
  function drawBackWall(ctx) {
    const top = ARENA.backWallY;
    ctx.fillStyle = PALETTE.backWall;
    ctx.fillRect(0, top, GAME_WIDTH, GROUND_Y - top);
    ctx.fillStyle = PALETTE.backWallPanel;
    for (let x = 20; x < GAME_WIDTH; x += 72) {
      ctx.fillRect(x, top + 6, 3, GROUND_Y - top - 12);
    }
    const grad = ctx.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y - 60, GAME_WIDTH, 60);
  }
  function drawWallScoreboards(ctx, score, touch) {
    if (!score) return;
    const boards = [
      { x: 112, label: PALETTE.turkishRed, value: score.home, side: "home" },
      { x: GAME_WIDTH - 112, label: "#7d8ad8", value: score.away, side: "away" }
    ];
    boards.forEach(({ x, label, value, side }) => {
      const w = 96;
      const h = 62;
      const top = 246;
      const left = x - w / 2;
      ctx.fillStyle = "#05050c";
      ctx.fillRect(left, top, w, h);
      ctx.fillStyle = "#2a2a4a";
      ctx.fillRect(left, top, w, 3);
      ctx.fillRect(left, top + h - 3, w, 3);
      ctx.fillRect(left, top, 3, h);
      ctx.fillRect(left + w - 3, top, 3, h);
      ctx.fillStyle = "#1d1d38";
      ctx.fillRect(x - 22, top - 10, 4, 10);
      ctx.fillRect(x + 18, top - 10, 4, 10);
      ctx.fillStyle = label;
      ctx.fillRect(left + 8, top + 9, w - 16, 5);
      drawPixelNumber(ctx, value, x, top + 32, 4, "#FF6B3D");
      const active = touch && touch.side === side ? touch.count : 0;
      for (let i = 0; i < 3; i += 1) {
        const dotX = x - 21 + i * 15;
        const dotY = top + h - 14;
        const used = i < active;
        ctx.fillStyle = used ? active >= 3 ? PALETTE.turkishRed : PALETTE.gold : "rgba(255,255,255,0.14)";
        ctx.fillRect(dotX, dotY, 10, 8);
      }
    });
  }
  function drawLightBeams(ctx, time) {
    LIGHT_X.forEach((x, i) => {
      const flicker = 0.88 + Math.sin(time * 3.4 + i * 1.7) * 0.12;
      const grad = ctx.createLinearGradient(0, ARENA.roofH, 0, GROUND_Y);
      grad.addColorStop(0, `${PALETTE.lightWarm} ${0.16 * flicker})`);
      grad.addColorStop(0.55, `${PALETTE.lightWarm} ${0.05 * flicker})`);
      grad.addColorStop(1, `${PALETTE.lightWarm} 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 26, ARENA.roofH);
      ctx.lineTo(x + 26, ARENA.roofH);
      ctx.lineTo(x + 150, GROUND_Y);
      ctx.lineTo(x - 150, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    });
  }
  function drawFloor(ctx) {
    const nearY = FLOOR.nearY;
    ctx.fillStyle = PALETTE.courtOut;
    ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    ctx.fillStyle = PALETTE.courtIn;
    ctx.beginPath();
    ctx.moveTo(WALL_PAD, GROUND_Y);
    ctx.lineTo(GAME_WIDTH - WALL_PAD, GROUND_Y);
    ctx.lineTo(floorX(GAME_WIDTH - WALL_PAD, nearY), nearY);
    ctx.lineTo(floorX(WALL_PAD, nearY), nearY);
    ctx.closePath();
    ctx.fill();
    LIGHT_X.forEach((x) => {
      const grad = ctx.createRadialGradient(x, GROUND_Y + 40, 4, x, GROUND_Y + 40, 190);
      grad.addColorStop(0, `${PALETTE.lightWarm} 0.13)`);
      grad.addColorStop(1, `${PALETTE.lightWarm} 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - 200, GROUND_Y, 400, GAME_HEIGHT - GROUND_Y);
    });
    ctx.fillStyle = PALETTE.courtLine;
    const nl = floorX(WALL_PAD, nearY);
    const nr = floorX(GAME_WIDTH - WALL_PAD, nearY);
    ctx.fillRect(Math.round(nl), Math.round(nearY - 4), Math.round(nr - nl), 5);
    [
      WALL_PAD,
      GAME_WIDTH - WALL_PAD,
      NET.x,
      NET.x - 130,
      NET.x + 130
    ].forEach((x) => drawConvergingLine(ctx, x, GROUND_Y, nearY));
    drawCourtEmblem(ctx);
    drawFloorTexture(ctx);
    ctx.fillStyle = PALETTE.floorSheen;
    for (let y = GROUND_Y + 12; y < nearY; y += 16) {
      const l = floorX(WALL_PAD, y);
      const r = floorX(GAME_WIDTH - WALL_PAD, y);
      ctx.fillRect(Math.round(l), Math.round(y), Math.round(r - l), 1);
    }
  }
  function drawCourtEmblem(ctx) {
    const cx = GAME_WIDTH / 2;
    const cy = GROUND_Y + (FLOOR.nearY - GROUND_Y) * 0.66;
    const cellW = 14;
    const cellH = 9;
    const originX = cx - 12 * cellW / 2;
    const originY = cy - 8 * cellH / 2;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#FFFFFF";
    FLAG_WHITE.forEach(([c, r]) => {
      ctx.fillRect(
        Math.round(originX + c * cellW),
        Math.round(originY + r * cellH),
        Math.ceil(cellW),
        Math.ceil(cellH)
      );
    });
    ctx.restore();
  }
  function drawFloorTexture(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = "#000000";
    for (let i = 0; i < 220; i += 1) {
      const n = rand(i * 3.13);
      const m = rand(i * 7.77);
      const y = GROUND_Y + m * (FLOOR.nearY - GROUND_Y);
      const x = floorX(WALL_PAD + n * (GAME_WIDTH - WALL_PAD * 2), y);
      ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
    }
    ctx.restore();
  }
  function drawConvergingLine(ctx, x, topY, bottomY) {
    const wTop = 3;
    const wBottom = 5;
    const xt = floorX(x, topY);
    const xb = floorX(x, bottomY);
    ctx.fillStyle = PALETTE.courtLine;
    ctx.beginPath();
    ctx.moveTo(xt - wTop / 2, topY);
    ctx.lineTo(xt + wTop / 2, topY);
    ctx.lineTo(xb + wBottom / 2, bottomY);
    ctx.lineTo(xb - wBottom / 2, bottomY);
    ctx.closePath();
    ctx.fill();
  }
  function drawNetDirect(ctx, netFloorY) {
    const left = NET.x - NET.width / 2;
    const topY = netFloorY - NET.height;
    const meshTop = topY + 8;
    const meshBottom = topY + 86;
    const meshLeft = left - 21;
    const meshRight = left + NET.width + 21;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(NET.x, netFloorY + 2, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.netPost;
    ctx.fillRect(left, topY, NET.width, NET.height);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(left + NET.width - 4, topY, 4, NET.height);
    const padTop = meshBottom + 6;
    const padH = netFloorY - padTop;
    ctx.fillStyle = PALETTE.turkishRed;
    ctx.fillRect(left - 3, padTop, NET.width + 6, padH);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(left - 3, padTop, 3, padH);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(left + NET.width, padTop, 3, padH);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(left - 3, padTop, NET.width + 6, 3);
    ctx.fillStyle = "#8d90a0";
    ctx.fillRect(left - 9, netFloorY - 10, NET.width + 18, 10);
    ctx.fillStyle = "#6d7080";
    ctx.fillRect(left - 13, netFloorY - 3, NET.width + 26, 4);
    const sag = 5;
    ctx.fillStyle = "rgba(240, 240, 248, 0.8)";
    for (let y = meshTop; y <= meshBottom; y += 9) {
      for (let x = meshLeft; x < meshRight; x += 2) {
        const t = (x - meshLeft) / (meshRight - meshLeft);
        const dip = Math.sin(t * Math.PI) * sag;
        ctx.fillRect(Math.round(x), Math.round(y + dip), 2, 2);
      }
    }
    for (let x = meshLeft; x <= meshRight; x += 9) {
      const t = (x - meshLeft) / (meshRight - meshLeft);
      const dip = Math.sin(t * Math.PI) * sag;
      ctx.fillRect(Math.round(x), Math.round(meshTop + dip), 2, meshBottom - meshTop);
    }
    ctx.fillStyle = PALETTE.courtLine;
    ctx.fillRect(meshLeft - 4, topY, meshRight - meshLeft + 8, 9);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(meshLeft - 4, topY + 7, meshRight - meshLeft + 8, 2);
    [meshLeft - 1, meshRight - 2].forEach((x) => {
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? PALETTE.turkishRed : "#FFFFFF";
        ctx.fillRect(Math.round(x), topY - 21 + i * 7, 3, 7);
      }
    });
  }
  var netOnbellek = null;
  var netOnbellekY = null;
  function drawNet(ctx, netFloorY) {
    if (typeof document === "undefined") {
      drawNetDirect(ctx, netFloorY);
      return;
    }
    if (!netOnbellek || netOnbellekY !== netFloorY) {
      const left = NET.x - NET.width / 2;
      const topY = netFloorY - NET.height;
      const x0 = Math.floor(left - 40);
      const y0 = Math.floor(topY - 28);
      const w = Math.ceil(NET.width + 80);
      const h = Math.ceil(netFloorY + 12 - y0);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const octx = canvas.getContext("2d");
      if (!octx) {
        drawNetDirect(ctx, netFloorY);
        return;
      }
      octx.translate(-x0, -y0);
      drawNetDirect(octx, netFloorY);
      netOnbellek = { canvas, x0, y0 };
      netOnbellekY = netFloorY;
    }
    ctx.drawImage(netOnbellek.canvas, netOnbellek.x0, netOnbellek.y0);
  }

  // motor/sahne.js
  var GIZEL = ROSTER.find((p) => p.id === "gizel-orgen");
  var ATLAS = {
    ...OPPONENT_TEMPLATE,
    id: "atlas",
    name: "Atlas",
    number: 7
  };
  var G = 1150;
  var TOP_R = 13;
  var BANT = 270;
  var EL = 16;
  var DALIS = 44;
  var RAKIP_EL = 38;
  var YAY = [
    { ad: "ust", t0: 0, t1: 0.26, x0: 470, y0: 236, x1: 418, y1: 240, duz: true },
    { ad: "gelis", t0: 0.26, t1: 0.62, x0: 418, y0: 240, x1: 308, y1: 388 },
    { ad: "pas", t0: 0.62, t1: 1.16, x0: 308, y0: 388, x1: 360, y1: 240 },
    { ad: "hucum", t0: 1.16, t1: 1.66, x0: 360, y0: 240, x1: 708, y1: 342 },
    { ad: "donus", t0: 1.66, t1: 2.16, x0: 708, y0: 342, x1: 356, y1: 240 },
    { ad: "smac", t0: 2.16, t1: 2.8, x0: 356, y0: 240, x1: 774, y1: 407 },
    { ad: "atis", t0: 5.42, t1: 5.8, x0: 328, y0: 356, x1: 348, y1: 240 },
    { ad: "servis", t0: 5.8, t1: 6.3, x0: 348, y0: 240, x1: 706, y1: 340 },
    { ad: "donus2", t0: 6.3, t1: 6.8, x0: 706, y0: 340, x1: 352, y1: 242 },
    { ad: "final", t0: 6.8, t1: 7.3, x0: 352, y0: 242, x1: 698, y1: 346 }
  ];
  var yay = (ad2) => YAY.find((s) => s.ad === ad2);
  var UST = yay("ust");
  var GELIS = yay("gelis");
  var PAS = yay("pas");
  var HUCUM = yay("hucum");
  var DONUS = yay("donus");
  var SMAC = yay("smac");
  var ATIS = yay("atis");
  var SERVIS = yay("servis");
  var DONUS2 = yay("donus2");
  var FINAL = yay("final");
  var SAYI = SMAC.t1;
  var ELDE = 4.95;
  var ZOOM = FINAL.t0 + 0.16;
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, u) {
    return a + (b - a) * u;
  }
  function yumusak(u) {
    const x = clamp(u, 0, 1);
    return x * x * (3 - 2 * x);
  }
  function parca(t, t0, t1) {
    if (t1 <= t0) return t >= t1 ? 1 : 0;
    return clamp((t - t0) / (t1 - t0), 0, 1);
  }
  function fizik(seg, t) {
    const T = seg.t1 - seg.t0;
    const tt = clamp(t, seg.t0, seg.t1) - seg.t0;
    const vx = (seg.x1 - seg.x0) / T;
    if (seg.duz) {
      const vy = (seg.y1 - seg.y0) / T;
      return { x: seg.x0 + vx * tt, y: seg.y0 + vy * tt, vx, vy };
    }
    const vy0 = (seg.y1 - seg.y0 - 0.5 * G * T * T) / T;
    return {
      x: seg.x0 + vx * tt,
      y: seg.y0 + vy0 * tt + 0.5 * G * tt * tt,
      vx,
      vy: vy0 + G * tt
    };
  }
  function elde(t) {
    const u = yumusak(parca(t, ELDE, ATIS.t0));
    return {
      x: lerp(250, ATIS.x0, u),
      y: lerp(364, ATIS.y0, u),
      vx: 0,
      vy: 0
    };
  }
  function topKonum(t) {
    if (t >= SAYI && t < ELDE) return { x: SMAC.x1, y: SMAC.y1, vx: 0, vy: 0 };
    if (t >= ELDE && t < ATIS.t0) return elde(t);
    for (let i = YAY.length - 1; i >= 0; i -= 1) {
      if (t >= YAY[i].t0) return fizik(YAY[i], t);
    }
    return fizik(UST, UST.t0);
  }
  function zipla(t, t0, t1, h) {
    const u = parca(t, t0, t1);
    if (u <= 0 || u >= 1) return 0;
    return Math.sin(u * Math.PI) * h;
  }
  function gizel(t) {
    const dig = topKonum(GELIS.t1);
    const pas = topKonum(PAS.t1);
    const bitir = topKonum(SMAC.t0);
    const servis = topKonum(SERVIS.t0);
    const son = topKonum(FINAL.t0);
    const el = elde(t);
    let x = 210;
    let y = GROUND_Y;
    let pose = "run";
    if (t < GELIS.t1 - 0.05) {
      x = lerp(210, dig.x - DALIS, yumusak(parca(t, 0, GELIS.t1 - 0.05)));
      pose = "run";
    } else if (t < GELIS.t1 + 0.1) {
      x = dig.x - DALIS;
      pose = "dive";
    } else if (t < PAS.t1 - 0.2) {
      x = lerp(dig.x - DALIS, pas.x - EL, yumusak(parca(t, GELIS.t1 + 0.14, PAS.t1 - 0.2)));
      pose = "run";
    } else if (t < PAS.t1 + 0.24) {
      x = pas.x - EL;
      y = GROUND_Y - zipla(t, PAS.t1 - 0.2, PAS.t1 + 0.24, 112);
      pose = t < PAS.t1 + 0.08 ? "spike" : "jump";
    } else if (t < SMAC.t0 - 0.2) {
      x = lerp(pas.x - EL, bitir.x - EL, yumusak(parca(t, PAS.t1 + 0.24, SMAC.t0 - 0.2)));
      pose = "run";
    } else if (t < SAYI) {
      x = bitir.x - EL;
      const kalk = SMAC.t0 - 0.18;
      const inis = SMAC.t0 + 0.28;
      y = GROUND_Y - zipla(t, kalk, inis, 112);
      pose = t < SMAC.t0 + 0.1 ? "spike" : t < inis ? "jump" : "idle";
    } else if (t < ELDE) {
      x = lerp(bitir.x - EL, 236, yumusak(parca(t, SAYI, SAYI + 0.7)));
      pose = "cheer";
    } else if (t < ATIS.t0) {
      x = el.x - EL;
      pose = "run";
    } else if (t < SERVIS.t0 + 0.22) {
      x = servis.x - EL;
      y = GROUND_Y - zipla(t, SERVIS.t0 - 0.2, SERVIS.t0 + 0.22, 112);
      pose = "spike";
    } else if (t < FINAL.t0 - 0.18) {
      x = lerp(servis.x - EL, son.x - EL, yumusak(parca(t, SERVIS.t0 + 0.22, FINAL.t0 - 0.18)));
      pose = "run";
    } else if (t < FINAL.t1) {
      x = son.x - EL;
      y = GROUND_Y - zipla(t, FINAL.t0 - 0.18, FINAL.t0 + 0.22, 112);
      pose = "spike";
    } else {
      x = son.x - EL;
      pose = "idle";
    }
    return {
      data: GIZEL,
      x,
      y,
      pose,
      facing: 1,
      frame: t * (pose === "run" ? 7.5 : 2.4) % 1
    };
  }
  function atlas(t) {
    const hucum = topKonum(HUCUM.t1);
    const servis = topKonum(SERVIS.t1);
    let x = 640;
    let y = GROUND_Y;
    let pose = "idle";
    if (t < 0.22) {
      x = 628;
      y = GROUND_Y - zipla(t, -0.12, 0.34, 96);
      pose = "spike";
    } else if (t < HUCUM.t1 - 0.28) {
      x = lerp(620, hucum.x + RAKIP_EL, yumusak(parca(t, 0.22, HUCUM.t1 - 0.28)));
      pose = t < 0.42 ? "jump" : "run";
    } else if (t < HUCUM.t1 + 0.14) {
      x = hucum.x + RAKIP_EL;
      y = GROUND_Y - zipla(t, HUCUM.t1 - 0.16, HUCUM.t1 + 0.14, 44);
      pose = "bump";
    } else if (t < SERVIS.t0) {
      x = lerp(hucum.x + RAKIP_EL, 690, yumusak(parca(t, HUCUM.t1 + 0.16, HUCUM.t1 + 0.55)));
      pose = "idle";
    } else if (t < SERVIS.t1 - 0.16) {
      x = lerp(690, servis.x + RAKIP_EL, yumusak(parca(t, SERVIS.t0, SERVIS.t1 - 0.16)));
      pose = "run";
    } else if (t < SERVIS.t1 + 0.14) {
      x = servis.x + RAKIP_EL;
      y = GROUND_Y - zipla(t, SERVIS.t1 - 0.16, SERVIS.t1 + 0.14, 44);
      pose = "bump";
    } else {
      x = servis.x + RAKIP_EL - 20;
      pose = "idle";
    }
    return {
      data: ATLAS,
      x,
      y,
      pose,
      facing: -1,
      frame: t * (pose === "run" ? 7.5 : 0) % 1
    };
  }
  function cekim(t) {
    const plan = [
      { t: 0, s: 1.88, cx: 448, cy: 258, whip: 0 },
      { t: GELIS.t0 + 0.1, s: 1.6, cx: 320, cy: 342, whip: 0.1 },
      { t: PAS.t1 - 0.12, s: 1.42, cx: 400, cy: 286, whip: 0.1 },
      { t: HUCUM.t0 + 0.04, s: 1.72, cx: 470, cy: 256, whip: 0.09 },
      { t: HUCUM.t1 - 0.12, s: 1.36, cx: 690, cy: 330, whip: 0.1 },
      { t: SMAC.t0, s: 1.06, cx: 470, cy: 300, whip: 0.1 },
      { t: SAYI + 0.62, s: 3.05, cx: 156, cy: 278, whip: 0.13 },
      { t: SAYI + 1.45, s: 1.52, cx: 270, cy: 330, whip: 0.12 },
      { t: ELDE, s: 1.24, cx: 390, cy: 296, whip: 0.12 },
      { t: SERVIS.t0, s: 1.7, cx: 490, cy: 262, whip: 0.1 },
      { t: FINAL.t0, s: 1.4, cx: 460, cy: 276, whip: 0.1 }
    ];
    let i = 0;
    for (let k = 1; k < plan.length; k += 1) {
      if (t >= plan[k].t) i = k;
    }
    const simdi = plan[i];
    const once = plan[Math.max(0, i - 1)];
    let s = simdi.s;
    let cx = simdi.cx;
    let cy = simdi.cy;
    const whip = simdi.whip;
    if (whip > 0 && t < simdi.t + whip) {
      const k = 1 - (1 - (t - simdi.t) / whip) ** 3;
      s = lerp(once.s, simdi.s, k);
      cx = lerp(once.cx, simdi.cx, k);
      cy = lerp(once.cy, simdi.cy, k);
    }
    if (t >= ZOOM) {
      const u = clamp((t - ZOOM) / 0.36, 0, 1);
      const e = u * u;
      const top = topKonum(t);
      s = lerp(s, 12, e);
      cx = lerp(cx, top.x, Math.min(1, e + 0.35));
      cy = lerp(cy, top.y + 8, Math.min(1, e + 0.35));
    }
    const gorunenW = GAME_WIDTH / s;
    const gorunenH = GAME_HEIGHT / s;
    cx = clamp(cx, gorunenW / 2, GAME_WIDTH - gorunenW / 2);
    cy = clamp(cy, gorunenH / 2, GAME_HEIGHT - gorunenH / 2);
    return { s, cx, cy };
  }
  function sarsinti(t) {
    const vuruslar = [
      [GELIS.t1, 2.4, 0.08],
      [PAS.t1, 3.2, 0.07],
      [HUCUM.t1, 2.2, 0.07],
      [SMAC.t1, 5.2, 0.1],
      [SERVIS.t0, 2.6, 0.06],
      [FINAL.t0, 3.4, 0.07]
    ];
    let x = 0;
    let y = 0;
    for (let i = 0; i < vuruslar.length; i += 1) {
      const [t0, gen, sure] = vuruslar[i];
      const a = t - t0;
      if (a < 0 || a > sure) continue;
      const d = 1 - a / sure;
      x += Math.sin(a * 120) * gen * d;
      y += Math.sin(a * 90 + 1.3) * gen * 0.45 * d;
    }
    return { x, y };
  }
  function golge(ctx, x, y, yari) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, yari, yari * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function cizOyuncu(ctx, oyuncu) {
    const havada = oyuncu.y < GROUND_Y - 2;
    const gen = oyuncu.pose === "dive" ? 46 : 30 * (1 - clamp((GROUND_Y - oyuncu.y) / 170, 0, 1) * 0.45);
    golge(ctx, oyuncu.x, GROUND_Y, gen);
    let sx = 1;
    let sy = 1;
    if (havada && oyuncu.pose !== "dive") {
      sy = 1.06;
      sx = 0.96;
    }
    ctx.save();
    ctx.translate(oyuncu.x, oyuncu.y);
    ctx.scale(sx, sy);
    ctx.translate(-oyuncu.x, -oyuncu.y);
    drawSultan(ctx, oyuncu.data, {
      x: oyuncu.x,
      y: oyuncu.y,
      scale: PLAYER.spriteScale,
      pose: oyuncu.pose,
      facing: oyuncu.facing,
      frame: oyuncu.frame
    });
    ctx.restore();
  }
  function cizIz(ctx, top) {
    if (Math.abs(top.vx) < 480) return;
    for (let i = 4; i >= 1; i -= 1) {
      const dt = i * 0.01;
      const oran = i / 5;
      ctx.globalAlpha = (1 - oran) * 0.4;
      ctx.fillStyle = "#FFC633";
      const boy = 16 * (1 - oran);
      const x = top.x - top.vx * dt;
      const y = top.y - top.vy * dt;
      ctx.fillRect(x - boy / 2, y - boy / 2, boy, boy);
    }
    ctx.globalAlpha = 1;
  }
  function parcacik(ctx, t, t0, x, y, renk, adet, sure) {
    const yas = t - t0;
    if (yas < 0 || yas > sure) return;
    const omur = 1 - yas / sure;
    for (let i = 0; i < adet; i += 1) {
      const aci = i / adet * Math.PI * 2 + i * 0.37;
      const hiz = 90 + i % 4 * 48;
      const px = x + Math.cos(aci) * hiz * yas;
      const py = y + Math.sin(aci) * hiz * yas + 260 * yas * yas;
      ctx.globalAlpha = omur;
      ctx.fillStyle = i % 2 === 0 ? renk : "#FFFFFF";
      const boy = 3 + omur * 4;
      ctx.fillRect(px - boy / 2, py - boy / 2, boy, boy);
    }
    ctx.globalAlpha = 1;
  }
  function mesaj(ctx, yazi, renk, alfa) {
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gen = ctx.measureText(yazi).width;
    const kutu = gen + 52;
    const sol = GAME_WIDTH / 2 - kutu / 2;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(sol, 218, kutu, 44);
    ctx.strokeStyle = renk;
    ctx.lineWidth = 3;
    ctx.strokeRect(sol, 218, kutu, 44);
    ctx.fillStyle = renk;
    ctx.fillText(yazi, GAME_WIDTH / 2, 241);
    ctx.restore();
  }
  function mesajAlfa(t, bas, sure) {
    const a = t - bas;
    if (a < 0 || a > sure) return 0;
    if (a < 0.05) return a / 0.05;
    if (a > sure - 0.16) return (sure - a) / 0.16;
    return 1;
  }
  function ad(ctx, t, oyuncu) {
    if (t < SAYI + 1.5 || t > ELDE - 0.05) return;
    const giris = clamp((t - (SAYI + 1.5)) / 0.12, 0, 1);
    ctx.save();
    ctx.globalAlpha = giris;
    ctx.font = '15px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const yazi = "G\u0130ZEL \xD6RGEN";
    const w = ctx.measureText(yazi).width;
    const x = oyuncu.x;
    const y = oyuncu.y - 22 * PLAYER.spriteScale - 28;
    ctx.fillStyle = "#05050c";
    ctx.fillRect(x - w / 2 - 12, y - 16, w + 24, 32);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(yazi, x, y);
    ctx.restore();
  }
  function perde(ctx, t) {
    const kesmeler = [SAYI + 0.62, SAYI + 1.45, ELDE];
    const vuruslar = [
      [GELIS.t1, "#9BE7FF", 0.05, 0.18],
      [PAS.t1, "#FFD24A", 0.045, 0.2],
      [SMAC.t1, "#E30A17", 0.05, 0.18],
      [SERVIS.t0, "#FFD24A", 0.04, 0.16],
      [FINAL.t0, "#FFD24A", 0.045, 0.2]
    ];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < kesmeler.length; i += 1) {
      const a = t - kesmeler[i];
      if (a < 0 || a > 0.08) continue;
      ctx.globalAlpha = (1 - a / 0.08) * 0.5;
      ctx.fillStyle = "#0b0b12";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    for (let i = 0; i < vuruslar.length; i += 1) {
      const [t0, renk, sure, guc] = vuruslar[i];
      const a = t - t0;
      if (a < 0 || a > sure) continue;
      ctx.globalAlpha = (1 - a / sure) * guc;
      ctx.fillStyle = renk;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    ctx.restore();
  }
  function temas(t) {
    if (t < GELIS.t1) return { side: "away", count: 1 };
    if (t < PAS.t1) return { side: "home", count: 2 };
    if (t < HUCUM.t1) return { side: "home", count: 3 };
    if (t < DONUS.t1) return { side: "away", count: 1 };
    if (t < SAYI) return { side: "home", count: 1 };
    if (t < SERVIS.t0) return { side: "home", count: 0 };
    if (t < SERVIS.t1) return { side: "home", count: 1 };
    if (t < DONUS2.t1) return { side: "away", count: 1 };
    return { side: "home", count: 1 };
  }
  function ciz(ctx, t) {
    const zaman = Number.isFinite(t) ? t : 0;
    const top = topKonum(zaman);
    const ev = gizel(zaman);
    const rakip = atlas(zaman);
    const cam = cekim(zaman);
    const sar = sarsinti(zaman);
    const sayiOldu = zaman >= SAYI;
    const hype = sayiOldu ? clamp((zaman - SAYI) / 0.28, 0, 1) : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(
      cam.s,
      0,
      0,
      cam.s,
      GAME_WIDTH / 2 - cam.cx * cam.s + sar.x,
      GAME_HEIGHT / 2 - cam.cy * cam.s + sar.y
    );
    drawArena(ctx, zaman, hype, { home: sayiOldu ? 22 : 21, away: 20 }, temas(zaman));
    drawFloor(ctx);
    const topYuksek = Math.max(0, GROUND_Y - top.y);
    golge(ctx, top.x, GROUND_Y, 16 * Math.max(0.35, 1 - topYuksek / 500));
    cizOyuncu(ctx, rakip);
    cizOyuncu(ctx, ev);
    drawNet(ctx, GROUND_Y);
    cizIz(ctx, top);
    drawBall(ctx, {
      x: top.x,
      y: top.y,
      radius: TOP_R,
      rotation: zaman * 14 + top.x * 0.02,
      flaming: Math.abs(top.vx) > 620 ? 1 : 0
    });
    const vur = (an) => topKonum(an);
    parcacik(ctx, zaman, GELIS.t1, vur(GELIS.t1).x, vur(GELIS.t1).y, "#9BE7FF", 8, 0.28);
    parcacik(ctx, zaman, PAS.t1, vur(PAS.t1).x, vur(PAS.t1).y, "#FFD24A", 8, 0.22);
    parcacik(ctx, zaman, SMAC.t1, vur(SMAC.t1).x, vur(SMAC.t1).y, "#E30A17", 10, 0.32);
    parcacik(ctx, zaman, FINAL.t0, vur(FINAL.t0).x, vur(FINAL.t0).y, "#FFD24A", 8, 0.22);
    const kurtaris = mesajAlfa(zaman, GELIS.t1, 0.42);
    if (kurtaris > 0) mesaj(ctx, "KURTARI\u015E!", "#9BE7FF", kurtaris);
    const sayi = mesajAlfa(zaman, SAYI, 0.58);
    if (sayi > 0) mesaj(ctx, "SAYI!", PALETTE.gold, sayi);
    ad(ctx, zaman, ev);
    ctx.restore();
    perde(ctx, zaman);
  }
  function denetle() {
    const rapor = [];
    let ok = true;
    for (const seg of YAY) {
      const T = seg.t1 - seg.t0;
      let minY = 1e9;
      let yOrta = null;
      let yKenar = -1;
      const gecer = seg.x0 < 450 !== seg.x1 < 450 || seg.x0 > 410 && seg.x0 < 490;
      for (let i = 0; i <= 180; i += 1) {
        const p = fizik(seg, seg.t0 + T * i / 180);
        minY = Math.min(minY, p.y);
        if (p.x > 408 && p.x < 492) yKenar = Math.max(yKenar, p.y);
        if (Math.abs(p.x - 450) < 14) yOrta = p.y;
      }
      const pano = minY - TOP_R < 214;
      const file = gecer && (yOrta != null && yOrta + TOP_R > BANT - 12 || yKenar > 0 && yKenar + TOP_R > BANT - 4);
      if (pano || file) ok = false;
      const hiz = Math.hypot((seg.x1 - seg.x0) / T, (seg.y1 - seg.y0) / T);
      rapor.push({
        ad: seg.ad,
        hiz: Math.round(hiz),
        minY: Math.round(minY),
        pay: yOrta == null ? null : Math.round(BANT - (yOrta + TOP_R)),
        pano,
        file
      });
    }
    return { ok, rapor };
  }
  return __toCommonJS(sahne_exports);
})();
