import { useCallback, useEffect, useRef, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import TutorialScreen from './screens/TutorialScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import CollectionScreen from './screens/CollectionScreen.jsx';
import TournamentScreen from './screens/TournamentScreen.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import OnlineScreen from './screens/OnlineScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import RotateGate from './components/RotateGate.jsx';
import useViewport from './hooks/useViewport.js';
import useGeriTusu, { geriKarari } from './hooks/useGeriTusu.js';
import Sfx from './game/audio.js';
import {
  advanceTournament,
  createTournament,
  roundMatchConfig,
} from './game/tournament.js';
import {
  DEFAULT_PREFS,
  clearTournament,
  loadAchievements,
  loadPrefs,
  loadRecords,
  loadTournament,
  recordMatchResult,
  recordSurvivalResult,
  recordTournamentResult,
  saveAchievements,
  savePrefs,
  saveTournament,
  loadIlerleme,
  saveIlerleme,
} from './utils/storage.js';
import { evaluateAchievements, newlyUnlocked } from './game/achievements.js';
import {
  macKazanci,
  rozetKazanci,
  turnuvaKazanci,
  yeniAcilabilirler,
  ac,
} from './game/ilerleme.js';
import { getGameMode } from './game/modes.js';

/**
 * Ekran akışı:
 *
 *   start → tutorial? → select ─┬─ (hızlı maç)   → match → result
 *     ↑                         ├─ (turnuva)     → bracket ⇄ match → result
 *     └─────────────────────────┴─ (hayatta kalma) → match → result
 *
 * Turnuvada her tur maçından sonra bracket ekranına dönülür; turnuva
 * kupa ya da elenmeyle kapandığında sonuç ekranına geçilir.
 */
export default function App() {
  const initialPrefs = loadPrefs();
  const [screen, setScreen] = useState('start');
  const [campaign, setCampaign] = useState('match');
  /** 'solo' | 'coop' | 'vs' — tek klavyede kaç kişi. */
  const [playMode, setPlayMode] = useState('solo');
  /** Seçilen menü modunun id'si (coop/versus ayrımı için). */
  const [modeId, setModeId] = useState('match');
  const [matchConfig, setMatchConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  /** Sonuç ekranında gösterilecek kapanmış turnuva (bracket özeti). */
  const [finishedTournament, setFinishedTournament] = useState(null);
  const [result, setResult] = useState(null);
  const [brokenRecords, setBrokenRecords] = useState(null);
  const [muted, setMuted] = useState(initialPrefs.muted);
  const [musicVolume, setMusicVolume] = useState(initialPrefs.musicVolume);
  const [sfxVolume, setSfxVolume] = useState(initialPrefs.sfxVolume);
  const [controls, setControls] = useState(initialPrefs.controls);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [records, setRecords] = useState(() => loadRecords());
  const [savedTournament, setSavedTournament] = useState(() => loadTournament());
  const [achievements, setAchievements] = useState(() => loadAchievements());
  /**
   * Rozetlerin ref aynası.
   *
   * `syncAchievements` hem kaydı güncelliyor hem de bu maçta açılanları
   * DÖNDÜRÜYOR (rozetler FP kazandırıyor). Durum güncelleyicisinin
   * içinden okumak bunu veremezdi; ref, aynı olay içinde güncel değeri
   * senkron okumanın yolu.
   */
  const rozetRef = useRef(achievements);
  /** Bu maçta açılan rozetler — sonuç ekranında gösterilir. */
  const [freshAchievements, setFreshAchievements] = useState([]);
  /** Forma Puanı ve açılan oyuncular. */
  const [ilerleme, setIlerleme] = useState(() => loadIlerleme());
  /** Bu maçın FP kazancı — sonuç ekranındaki kalem dökümü. */
  const [kazanc, setKazanc] = useState(null);
  /**
   * Rövanş oyları — {ben, rakip, bekleniyor}.
   *
   * Sunucu iki tarafın da istemesini bekliyor; ekran "sen istedin,
   * rakip bekleniyor" ile "rakip istedi, sıra sende" arasındaki farkı
   * gösterebilsin diye ikisi ayrı tutuluyor.
   */
  const [rovans, setRovans] = useState({ ben: false, rakip: false, bekleniyor: false });
  /** Tutorial menüden mi açıldı (geri → start), yoksa ilk akış mı (→ select). */
  const [tutorialFromMenu, setTutorialFromMenu] = useState(false);
  /** Açık çevrimiçi bağlantı — sahibi burası, kapatan da burası. */
  const baglantiRef = useRef(null);

  // Dokunmatik cihazda dikey tutuş oyunu tamamen kapatır
  const { portrait, coarse } = useViewport();
  const blockedByOrientation = portrait && coarse;

  // İlk yüklemede ses motoruna kayıtlı tercihleri uygula
  useEffect(() => {
    Sfx.setMuted(initialPrefs.muted);
    Sfx.setMusicVolume(initialPrefs.musicVolume);
    Sfx.setSfxVolume(initialPrefs.sfxVolume);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca mount
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      Sfx.setMuted(next);
      setPrefs(savePrefs({ muted: next }));
      return next;
    });
  }, []);

  /**
   * Müzik sesi.
   *
   * Ses motoruna hemen uygulanır (kaydırıcı sürüklenirken duyulsun),
   * tercihe de yazılır. `savePrefs` her çağrıda localStorage'a yazıyor;
   * kaydırıcının `step` değeri 5 olduğu için tek sürüklemede en fazla
   * 20 yazma olur, ayrıca kısma gerekmiyor.
   */
  const changeMusicVolume = useCallback((value) => {
    setMusicVolume(value);
    Sfx.setMusicVolume(value);
    setPrefs(savePrefs({ musicVolume: value }));
  }, []);

  const changeSfxVolume = useCallback((value) => {
    setSfxVolume(value);
    Sfx.setSfxVolume(value);
    setPrefs(savePrefs({ sfxVolume: value }));
  }, []);

  /**
   * Dokunmatik tuş ayarı — kısmi yama alır (ör. yalnızca `scale`).
   * `savePrefs` iç içe `controls` nesnesini birleştirdiği için diğer
   * alanlar korunur.
   */
  const changeControls = useCallback((patch) => {
    const saved = savePrefs({ controls: patch });
    setControls(saved.controls);
    setPrefs(saved);
  }, []);

  /** Ses ve tuş ayarlarını varsayılana döndürür; rekorlara dokunmaz. */
  const resetSettings = useCallback(() => {
    const saved = savePrefs({
      muted: false,
      musicVolume: DEFAULT_PREFS.musicVolume,
      sfxVolume: DEFAULT_PREFS.sfxVolume,
      controls: { ...DEFAULT_PREFS.controls },
    });
    setMuted(false);
    setMusicVolume(saved.musicVolume);
    setSfxVolume(saved.sfxVolume);
    setControls(saved.controls);
    setPrefs(saved);
    Sfx.setMuted(false);
    Sfx.setMusicVolume(saved.musicVolume);
    Sfx.setSfxVolume(saved.sfxVolume);
  }, []);

  const openCollection = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    setScreen('collection');
  }, []);

  const openSettings = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    setScreen('settings');
  }, []);

  const goSelect = useCallback(() => {
    setScreen('select');
  }, []);

  const handleStart = useCallback(
    (modeId = 'match') => {
      // Mod id'si kampanya ile oyuncu sayısını birlikte taşır
      const mode = getGameMode(modeId);
      setCampaign(mode.campaign);
      setPlayMode(mode.playMode ?? 'solo');
      setModeId(mode.id);
      if (!prefs.tutorialSeen) {
        setTutorialFromMenu(false);
        setScreen('tutorial');
        return;
      }

      /*
       * HEMEN OYNA kadro ekranını ATLIYOR.
       *
       * Rakip aramak en sık istenen şeydi ama beş adım gerisindeydi.
       * Kayıtlı tercihlerle doğrudan lobiye gidiliyor; kadrosunu
       * değiştirmek isteyen ARKADAŞLA OYNA ya da HIZLI MAÇ'tan seçim
       * ekranına ulaşıyor. Yani kısayol seçenekleri kaldırmıyor,
       * yalnız varsayılanı hızlandırıyor.
       */
      if (mode.hizli) {
        setResult(null);
        setBrokenRecords(null);
        setFinishedTournament(null);
        setMatchConfig({
          campaign: 'match',
          playMode: 'vs',
          mode: prefs.mode,
          difficulty: prefs.difficulty,
          format: prefs.format,
          opponentId: prefs.opponentId === 'random' ? undefined : prefs.opponentId,
          opponentRandom: prefs.opponentId === 'random',
          homeIds: prefs.homeIds,
          hizli: true,
          startedAt: Date.now(),
        });
        setScreen('online');
        return;
      }

      goSelect();
    },
    [prefs, goSelect]
  );

  const openTutorial = useCallback(() => {
    Sfx.select();
    setTutorialFromMenu(true);
    setScreen('tutorial');
  }, []);

  const finishTutorial = useCallback(() => {
    const next = savePrefs({ tutorialSeen: true });
    setPrefs(next);
    if (tutorialFromMenu) {
      setScreen('start');
      return;
    }
    goSelect();
  }, [tutorialFromMenu, goSelect]);

  const goHome = useCallback(() => {
    Sfx.select();
    setScreen('start');
  }, []);

  /*
   * Android donanım GERİ tuşu.
   *
   * İşlenmezse varsayılan davranış uygulamayı KAPATMAK. Maçın
   * ortasında yanlışlıkla dokunmak çevrimiçide hükmen mağlubiyet
   * demek — karşı taraf "rakip ayrıldı" alıyor.
   *
   * Kural: maçta YUTULUYOR (hiçbir şey yapmıyor; çıkmak için ekrandaki
   * duraklat → maçtan çık yolu var, o da onay soruyor). Öteki
   * ekranlarda menüye dönüyor. Başlangıç ekranında yutulmuyor, yani
   * uygulama kapanıyor — Android'de beklenen davranış bu.
   */
  useGeriTusu(
    useCallback(() => {
      const { yut, hedef } = geriKarari(screen);
      if (hedef) setScreen(hedef);
      return yut;
    }, [screen]),
  );

  // --- Turnuva ---

  /** Bracket'teki sıradaki turu sahaya taşır. */
  const playTournamentRound = useCallback((state) => {
    const config = roundMatchConfig(state);
    if (!config) return;

    setMatchConfig({ ...config, startedAt: Date.now() });
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, []);

  const abandonTournament = useCallback(() => {
    clearTournament();
    setTournament(null);
    setSavedTournament(null);
  }, []);

  const resumeSavedTournament = useCallback(() => {
    if (!savedTournament) return;
    setCampaign('tournament');
    setTournament(savedTournament);
    setScreen('bracket');
  }, [savedTournament]);

  // --- Maç başlatma ---

  const startMatch = useCallback(
    (config) => {
      const mode = config.campaign ?? 'match';
      // Çevrimiçi bilgisi menü modundan gelir; kadro ekranı bunu bilmez
      const online = getGameMode(modeId).online === true;
      setCampaign(mode);
      if (config.playMode) setPlayMode(config.playMode);

      const nextPrefs = savePrefs({
        mode: config.mode,
        difficulty: config.difficulty,
        ...(mode === 'match'
          ? {
              format: config.format,
              opponentId: config.opponentId ?? 'random',
            }
          : {}),
        homeIds: config.homeIds,
      });
      setPrefs(nextPrefs);
      setResult(null);
      setBrokenRecords(null);
      setFinishedTournament(null);

      if (mode === 'tournament') {
        const state = createTournament(config);
        saveTournament(state);
        setTournament(state);
        setSavedTournament(state);
        setScreen('bracket');
        return;
      }

      // Yeni nesne referansı → MatchScreen motoru sıfırdan kurar
      setMatchConfig({
        ...config,
        campaign: mode,
        playMode: config.playMode ?? 'solo',
        startedAt: Date.now(),
      });
      /*
       * Çevrimiçi modda seçim ekranından doğrudan maça gidilmiyor:
       * önce lobi. Maçın ne zaman başlayacağını karşı taraf belirliyor
       * ve ayarlar odayı açanınkiler.
       */
      setScreen(online ? 'online' : 'match');
    },
    [modeId]
  );

  /**
   * Rozetleri güncel rekorlara göre yeniden değerlendirir ve bu maçta
   * açılanları saklar. Üç mod da aynı kapıdan geçer.
   *
   * Açılanları DÖNDÜRÜYOR: rozetler artık FP de kazandırıyor ve
   * kazancı hesaplayan taraf listeyi bu çağrıdan almalı. `setState`
   * içinden okumak yetmezdi — o geri çağrı sonra çalışır, oysa puan
   * aynı olayda hesaplanıyor.
   */
  const syncAchievements = useCallback(
    (nextRecords, matchResult) => {
      const earned = evaluateAchievements(nextRecords, matchResult);
      // Ref, `achievements` durumunun her an güncel aynası (aşağıda yazılıyor)
      const taze = newlyUnlocked(rozetRef.current, earned);
      const hepsi = saveAchievements([...rozetRef.current, ...earned]);
      rozetRef.current = hepsi;
      setAchievements(hepsi);
      setFreshAchievements(taze);
      return taze;
    },
    []
  );

  /**
   * Bir maçın/koşunun FP kazancını işler ve kaydeder.
   *
   * Tek kapı: üç mod da buradan geçiyor. Ayrı ayrı yazsaydık, yeni bir
   * mod eklendiğinde puan vermeyi unutmak (ya da iki kez vermek)
   * sessizce mümkün olurdu.
   *
   * @param {object} matchResult
   * @param {string[]} tazeRozetler
   * @param {object|null} kapananTurnuva Kupa yalnızca kapanışta sayılır
   */
  const puanIsle = useCallback((matchResult, tazeRozetler, kapananTurnuva = null) => {
    const mac = macKazanci(matchResult);
    const rozet = rozetKazanci(tazeRozetler);
    const kupa = turnuvaKazanci(kapananTurnuva);

    const toplam = mac.toplam + rozet.toplam + kupa.toplam;
    /*
     * `satirlar`, `kalemler` DEĞİL: çarpan yalnızca maça uygulanıyor ve
     * satır listesi onu maç kalemlerinin hemen ardına, fark olarak
     * koyuyor. Ham kalemleri birleştirseydik ekrandaki kolon toplamı
     * gerçek toplamı tutmazdı (bkz. ilerleme.js `satirlariKur`).
     */
    const satirlar = [...mac.satirlar, ...rozet.satirlar, ...kupa.satirlar];

    setIlerleme((prev) => {
      const sonraki = saveIlerleme({ ...prev, puan: prev.puan + toplam });
      /*
       * Kazanç özeti, kazançtan SONRAKİ bakiyeyle birlikte saklanıyor:
       * sonuç ekranı "+68 FP · 412 FP" diyebilsin. Bakiyeyi ayrıca
       * okumak, iki kaynağın farklı anlarda güncellenmesi riskini
       * getirirdi.
       *
       * `yeni`: bu maçla eşiği geçilen oyuncular. Hesap BURADA çünkü
       * maç ÖNCESİ bakiye yalnız burada duruyor — sonuç ekranına
       * geçtiğinde o sayı çoktan güncellenmiş olur ve fark alınamaz.
       */
      setKazanc({
        toplam,
        satirlar,
        bakiye: sonraki.puan,
        yeni: yeniAcilabilirler(prev.puan, sonraki.puan, sonraki.acilanlar),
      });
      return sonraki;
    });
  }, []);

  /** Oyuncu satın alma — doğrulama saf modülde (bkz. ilerleme.js `ac`). */
  const oyuncuAc = useCallback((id) => {
    setIlerleme((prev) => {
      const sonuc = ac(prev, id);
      if (!sonuc.ok) return prev;
      Sfx.confirm();
      return saveIlerleme(sonuc.durum);
    });
  }, []);

  const handleFinish = useCallback(
    (matchResult) => {
      /*
       * BAĞLANTI AÇIK KALIYOR — rövanş için.
       *
       * Eskiden maç biter bitmez soket kapanıyordu ve aynı rakiple
       * tekrar oynamanın yolu yoktu: menüye dönüp baştan rakip aramak
       * gerekiyordu. Oysa çevrimiçi bir maçın en sık istenen devamı
       * "bir daha" ve az önce oynadığın kişi zaten karşında.
       *
       * Soket ANA MENÜYE dönülünce kapanıyor (`goHome` → `agiKapat`);
       * sahibi hâlâ burası.
       */
      const cevrimici = matchResult.playMode === 'online' || Boolean(baglantiRef.current);
      if (!cevrimici) {
        baglantiRef.current?.kapat();
        baglantiRef.current = null;
      }
      setRovans({ ben: false, rakip: false, bekleniyor: false });

      // --- Hayatta kalma: koşu bitti ---
      if (matchResult.campaign === 'survival') {
        const { records: nextRecords, broken } = recordSurvivalResult(matchResult);
        setRecords(nextRecords);
        setBrokenRecords(broken);
        puanIsle(matchResult, syncAchievements(nextRecords, matchResult));
        setResult(matchResult);
        setFinishedTournament(null);
        setScreen('result');
        return;
      }

      // --- Turnuva turu ---
      if (matchResult.campaign === 'tournament' && tournament) {
        // Tur maçı gerçek bir maçtır: galibiyet/seri tablosuna işler
        const { records: matchRecords, broken: matchBroken } =
          recordMatchResult(matchResult);
        const nextState = advanceTournament(tournament, matchResult);
        setTournament(nextState);

        if (nextState.status === 'active') {
          saveTournament(nextState);
          setSavedTournament(nextState);
          setRecords(matchRecords);
          setBrokenRecords(matchBroken);
          // Ara tur: maç kazancı var, kupa YOK — turnuva daha bitmedi
          puanIsle(matchResult, syncAchievements(matchRecords, matchResult));
          setResult(matchResult);
          setScreen('bracket');
          return;
        }

        // Kupa ya da elenme — turnuva kapandı
        const { records: nextRecords, broken: tourBroken } =
          recordTournamentResult(nextState);
        clearTournament();
        setSavedTournament(null);
        setRecords(nextRecords);
        setBrokenRecords({ ...matchBroken, ...tourBroken });
        puanIsle(matchResult, syncAchievements(nextRecords, matchResult), nextState);
        setResult(matchResult);
        setFinishedTournament(nextState);
        setScreen('result');
        return;
      }

      // --- Tek maç ---
      // Rematch aynı rakiple devam etsin (rastgele seçilmiş olsa bile)
      setMatchConfig((prev) =>
        prev && matchResult?.opponent?.id
          ? { ...prev, opponentId: matchResult.opponent.id, opponentRandom: false }
          : prev
      );

      const { records: nextRecords, broken } = recordMatchResult(matchResult);
      setRecords(nextRecords);
      setBrokenRecords(broken);
      puanIsle(matchResult, syncAchievements(nextRecords, matchResult));
      setResult(matchResult);
      setFinishedTournament(null);
      setScreen('result');
    },
    [tournament, syncAchievements, puanIsle]
  );

  const handleRematch = useCallback(() => {
    if (!matchConfig) {
      setScreen('select');
      return;
    }
    Sfx.confirm();

    // Turnuva sonrası "tekrar" = aynı kadroyla yeni kupa yolu
    if (campaign === 'tournament') {
      const state = createTournament({
        mode: matchConfig.mode,
        difficulty: matchConfig.difficulty ?? prefs.difficulty,
        homeIds: matchConfig.homeIds,
      });
      saveTournament(state);
      setTournament(state);
      setSavedTournament(state);
      setFinishedTournament(null);
      setResult(null);
      setBrokenRecords(null);
      setScreen('bracket');
      return;
    }

    setMatchConfig((prev) => ({
      ...prev,
      startedAt: Date.now(),
      // Hızlı maçta rakip kilitlenir; hayatta kalmada rakip dalgaya
      // bağlı olduğu için son dalganın takımını taşımanın anlamı yok
      ...(campaign === 'survival'
        ? {}
        : {
            opponentId: prev.opponentId ?? result?.opponent?.id,
            opponentRandom: false,
          }),
    }));
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, [matchConfig, result, campaign, prefs.difficulty]);

  /** Maçtan çıkış — kampanyada koşu/turnuva iptal olur. */
  /**
   * Çevrimiçi bağlantıyı kapatır.
   *
   * Soketin sahibi App: maç ekranı efekt temizliğinde kapatamaz, çünkü
   * StrictMode efekti bağla-çöz-bağla diye çalıştırıyor ve bağlantı
   * daha maç başlamadan ölüyor.
   */
  const agiKapat = useCallback(() => {
    baglantiRef.current?.kapat();
    baglantiRef.current = null;
  }, []);

  /**
   * RÖVANŞ — sonuç ekranından aynı rakiple yeni maç.
   *
   * İstek tek taraflı gitmiyor: sunucu ikisini de bekliyor. Burada
   * yalnız "ben hazırım" oyu veriliyor ve ekran beklemeye geçiyor.
   */
  const rovansIste = useCallback(() => {
    const baglanti = baglantiRef.current;
    if (!baglanti) return;
    Sfx.confirm();
    baglanti.rovans();
    setRovans((o) => ({ ...o, ben: true, bekleniyor: true }));
  }, []);

  /*
   * Rövanş olayları — bağlantı maç sonrası açık kaldığı için sonuç
   * ekranındayken de dinleniyor.
   *
   * Dinleyiciler `screen` değiştikçe kuruluyor: bağlantı nesnesi
   * `baglantiRef`te ve ref değişimi yeniden render tetiklemiyor, o
   * yüzden ekrana bağlamak tek güvenilir yol.
   */
  useEffect(() => {
    const baglanti = baglantiRef.current;
    if (!baglanti || screen !== 'result') return undefined;

    const cozucular = [
      baglanti.on('rovans-durum', (m) => {
        setRovans({ ben: Boolean(m.ben), rakip: Boolean(m.rakip), bekleniyor: Boolean(m.ben) });
      }),
      /*
       * `mac` paketi yeni maçın kurulduğunu söylüyor. Motor ayarı
       * sunucunun KESİNLEŞMİŞ hâlinden alıyor — ilk maçtaki gibi.
       */
      baglanti.on('mac', (m) => {
        setResult(null);
        setBrokenRecords(null);
        setKazanc(null);
        setFreshAchievements([]);
        setRovans({ ben: false, rakip: false, bekleniyor: false });
        setMatchConfig((prev) => ({
          ...(prev ?? {}),
          ...(m.cfg ?? {}),
          agYuvam: m.yuva,
          rakipKimlik: m.rakip ?? null,
          baglanti,
          campaign: 'match',
          playMode: 'online',
          startedAt: Date.now(),
        }));
        setScreen('match');
      }),
      baglanti.on('ayrildi', () => {
        setRovans({ ben: false, rakip: false, bekleniyor: false, ayrildi: true });
      }),
    ];
    return () => cozucular.forEach((c) => c?.());
  }, [screen]);

  const handleQuitMatch = useCallback(() => {
    agiKapat();
    if (campaign === 'tournament') {
      abandonTournament();
      setScreen('start');
      return;
    }
    if (campaign === 'survival') {
      setScreen('start');
      return;
    }
    setScreen('select');
  }, [campaign, abandonTournament, agiKapat]);

  return (
    <div className="min-h-full">
      {/*
        Yatay kapısı en üstte dursun: altındaki ekranlar mount kalır
        (maç motoru durumunu kaybetmez) ama tamamen kapanır.
      */}
      {blockedByOrientation && <RotateGate />}

      {screen === 'start' && (
        <StartScreen
          onStart={handleStart}
          onTutorial={openTutorial}
          muted={muted}
          onToggleMute={toggleMute}
          musicVolume={musicVolume}
          onMusicVolume={changeMusicVolume}
          onSettings={openSettings}
          records={records}
          resumeTournament={savedTournament}
          onResumeTournament={resumeSavedTournament}
          achievements={achievements}
          ilerleme={ilerleme}
          onCollection={openCollection}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          onBack={goHome}
          muted={muted}
          onToggleMute={toggleMute}
          ilerleme={ilerleme}
          onUnlock={oyuncuAc}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          onBack={goHome}
          muted={muted}
          onToggleMute={toggleMute}
          musicVolume={musicVolume}
          onMusicVolume={changeMusicVolume}
          sfxVolume={sfxVolume}
          onSfxVolume={changeSfxVolume}
          controls={controls}
          onControls={changeControls}
          onReset={resetSettings}
        />
      )}

      {screen === 'tutorial' && (
        <TutorialScreen
          onDone={finishTutorial}
          onBack={tutorialFromMenu ? goHome : undefined}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'select' && (
        <CharacterSelect
          onBack={goHome}
          onStart={startMatch}
          muted={muted}
          onToggleMute={toggleMute}
          campaign={campaign}
          playMode={playMode}
          modeId={modeId}
          initialMode={prefs.mode}
          initialDifficulty={prefs.difficulty}
          initialFormat={prefs.format}
          initialOpponentId={prefs.opponentId}
          initialHomeIds={prefs.homeIds}
          ilerleme={ilerleme}
          onUnlock={oyuncuAc}
        />
      )}

      {screen === 'bracket' && tournament && (
        <TournamentScreen
          state={tournament}
          onPlay={() => playTournamentRound(tournament)}
          onQuit={() => {
            abandonTournament();
            setScreen('start');
          }}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'online' && matchConfig && (
        <OnlineScreen
          config={matchConfig}
          onStart={(agConfig) => {
            baglantiRef.current = agConfig.baglanti;
            setMatchConfig({
              ...matchConfig,
              ...agConfig,
              campaign: 'match',
              startedAt: Date.now(),
            });
            setScreen('match');
          }}
          /*
            HEMEN OYNA kadro ekranını atladığı için oradan GERİ, hiç
            görülmemiş bir ekrana düşürürdü. Nereden gelindiyse oraya.
          */
          onBack={() => setScreen(matchConfig.hizli ? 'start' : 'select')}
        />
      )}

      {screen === 'match' && matchConfig && (
        <MatchScreen
          controls={controls}
          onControls={changeControls}
          musicVolume={musicVolume}
          onMusicVolume={changeMusicVolume}
          sfxVolume={sfxVolume}
          onSfxVolume={changeSfxVolume}
          config={matchConfig}
          onFinish={handleFinish}
          onQuit={handleQuitMatch}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          brokenRecords={brokenRecords}
          tournamentState={finishedTournament}
          freshAchievements={freshAchievements}
          kazanc={kazanc}
          rovans={baglantiRef.current ? rovans : null}
          onRovans={rovansIste}
          onRematch={handleRematch}
          onHome={goHome}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
