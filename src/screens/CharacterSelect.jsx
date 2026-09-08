import { useEffect, useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import StatBar from '../components/StatBar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import {
  DEFAULT_PLAYER_ID,
  getActiveRoster,
  getBonusRoster,
  getPlayerById,
  formatBirthDate,
  getAge,
} from '../game/players.js';
import { DIFFICULTY, FORMATS, SURVIVAL } from '../game/constants.js';
import {
  kullanilabilir, bedel, sonrakiHedef, FP_ACIK,
} from '../game/ilerleme.js';
import { OPPONENT_TEAMS } from '../game/opponents.js';
import { getGameMode } from '../game/modes.js';
import { TOURNAMENT_ROUNDS } from '../game/tournament.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const MODES = [
  { id: '1v1', label: '1 vs 1', description: 'Tek oyuncu, tek rakip.' },
  {
    id: '2v2',
    label: '2 vs 2',
    description: 'İki oyuncu — sen + AI takım arkadaşı.',
  },
];

/** Künye satırı — bilinmeyen değer '—' gösterilir. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className="mt-[2px] text-white/70">{value}</dd>
    </div>
  );
}

/**
 * Kayıtlı kadroyu geçerli hale getirir.
 *
 * KİLİDİ de süzüyor: kayıt, oyuncunun artık sahip olmadığı bir
 * oyuncuyu taşıyabiliyor (başka bir cihazdan gelen tercih, elle
 * kurcalanmış depo, ileride değişecek bir başlangıç kadrosu). Süzmesek
 * maç kilitli bir oyuncuyla başlardı — kilidin hiçbir anlamı kalmazdı.
 *
 * @param {string[]} ids
 * @param {string} mode
 * @param {string[]} acilanlar
 */
function sanitizeHomeIds(ids, mode, acilanlar = []) {
  const required = mode === '2v2' ? 2 : 1;
  const valid = (Array.isArray(ids) ? ids : [])
    .filter((id) => Boolean(getPlayerById(id)) && kullanilabilir(id, acilanlar))
    .slice(0, required);
  if (valid.length === 0) return [DEFAULT_PLAYER_ID];
  return valid;
}

/**
 * Karakter seçim ekranı — mod, zorluk, format, rakip ve kadro.
 */
export default function CharacterSelect({
  onBack,
  onStart,
  muted,
  onToggleMute,
  campaign = 'match',
  playMode = 'solo',
  modeId = 'match',
  initialMode = '1v1',
  initialDifficulty = 'normal',
  initialFormat = 'classic',
  initialOpponentId = 'random',
  initialHomeIds,
  ilerleme = { puan: 0, acilanlar: [] },
  onUnlock,
}) {
  const gameMode = getGameMode(modeId);
  const twoPlayer = playMode === 'coop' || playMode === 'vs';
  // Turnuvada rakip ve format turlara bağlı, hayatta kalmada dalgalara —
  // ikisi de oyuncunun seçeceği şey değil.
  const picksMatchup = gameMode.pickOpponent;
  const [mode, setMode] = useState(initialMode === '2v2' ? '2v2' : '1v1');
  const [difficulty, setDifficulty] = useState(
    DIFFICULTY[initialDifficulty] ? initialDifficulty : 'normal'
  );
  const [format, setFormat] = useState(
    FORMATS[initialFormat] ? initialFormat : 'classic'
  );
  const [opponentId, setOpponentId] = useState(
    initialOpponentId === 'random' || OPPONENT_TEAMS.some((t) => t.id === initialOpponentId)
      ? initialOpponentId
      : 'random'
  );
  const [selected, setSelected] = useState(() =>
    sanitizeHomeIds(initialHomeIds, initialMode === '2v2' ? '2v2' : '1v1', ilerleme.acilanlar)
  );
  const [focused, setFocused] = useState(() => selected[0] ?? DEFAULT_PLAYER_ID);

  const activeRoster = useMemo(() => getActiveRoster(), []);
  const bonusRoster = useMemo(() => getBonusRoster(), []);

  /*
   * Co-Op iki oyuncuyu aynı takımda oynatır → 2v2 zorunlu.
   * VS'te 2. oyuncu rakip takımı sürer, ev sahibi kadro tek kişiliktir.
   */
  const required = playMode === 'coop' ? 2 : mode === '2v2' ? 2 : 1;
  const focusedPlayer = useMemo(
    () => getPlayerById(focused) ?? activeRoster[0],
    [focused, activeRoster]
  );

  const handleModeChange = (nextMode) => {
    Sfx.select();
    setMode(nextMode);
    setSelected((prev) => prev.slice(0, nextMode === '2v2' ? 2 : 1));
  };

  /*
   * `ilerleme` her render'da yeni bir nesne olabiliyor; `acilanlar`
   * doğrudan yazılsaydı `useMemo`nun bağımlılığı her seferinde
   * değişirdi — yani memo hiçbir şey saklamazdı.
   */
  const acilanlar = useMemo(() => ilerleme?.acilanlar ?? [], [ilerleme]);
  const puan = ilerleme?.puan ?? 0;
  const hedef = useMemo(
    () => (FP_ACIK ? sonrakiHedef(puan, acilanlar) : null),
    [puan, acilanlar],
  );
  const odakAcik = kullanilabilir(focused, acilanlar);
  const odakBedel = bedel(focused);

  const togglePlayer = (id) => {
    /*
     * Kilitli karta basmak SEÇMİYOR, odaklıyor. Böylece alttaki künye
     * kartı o oyuncuyu gösteriyor: istatistikleri, bonusu ve açma
     * düğmesi. Basışı tamamen yok saymak, oyuncuya neyi kaçırdığını
     * göstermeden "hayır" demek olurdu.
     */
    if (!kullanilabilir(id, acilanlar)) {
      Sfx.select();
      setFocused(id);
      return;
    }

    Sfx.select();
    setFocused(id);

    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter((p) => p !== id);
      }
      if (prev.length >= required) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  /*
   * SATIN ALMA ANI.
   *
   * Önce sessizdi: düğmeye basılıyor, kilit kalkıyor, kart diğerleriyle
   * aynı görünüyordu. Oysa oyuncunun onlarca maç biriktirdiği şey tam
   * olarak o an — karşılığı olmalı.
   *
   * `bekleyen` iyimser bir NİYET kaydı, sonucun kendisi değil: satın
   * alma doğrulaması saf modülde (`ilerleme.js` → `ac`) ve reddedilmesi
   * mümkün. O yüzden kutlama, oyuncu gerçekten `acilanlar` listesine
   * GİRDİĞİNDE tetikleniyor; reddedilirse hiçbir şey olmuyor.
   */
  const [bekleyen, setBekleyen] = useState(null);
  const [kutlama, setKutlama] = useState(null);

  useEffect(() => {
    if (!bekleyen || !acilanlar.includes(bekleyen)) return undefined;
    setBekleyen(null);
    setKutlama(bekleyen);

    /*
     * Alınan oyuncu KADROYA DA giriyor. Satın alıp sonra ayrıca seçmek
     * gerekseydi, oyuncu çoğu zaman eski kadrosuyla maça başlar ve
     * aldığı oyuncuyu ilk maçta oynayamazdı.
     */
    setSelected((prev) => (
      prev.includes(bekleyen)
        ? prev
        : prev.length >= required
          ? [...prev.slice(1), bekleyen]
          : [...prev, bekleyen]
    ));
    setFocused(bekleyen);

    const zaman = setTimeout(() => setKutlama(null), 2600);
    return () => clearTimeout(zaman);
  }, [bekleyen, acilanlar, required]);

  const satinAl = (id) => {
    setBekleyen(id);
    onUnlock?.(id);
  };

  const canStart = selected.length === required;

  const handleStart = () => {
    if (!canStart) return;
    Sfx.confirm();

    if (!picksMatchup) {
      // Kampanya modlarında format/rakip yapılandırması çağırana ait
      onStart({ campaign, playMode, mode, difficulty, homeIds: selected });
      return;
    }

    onStart({
      campaign,
      playMode,
      mode: playMode === 'coop' ? '2v2' : playMode === 'vs' ? '1v1' : mode,
      difficulty,
      format,
      // random ise undefined — Game rastgele seçer; bitişte id kilitlenir
      opponentId: opponentId === 'random' ? undefined : opponentId,
      opponentRandom: opponentId === 'random',
      homeIds: selected,
    });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-4 px-3 pb-28 pt-5 sm:gap-6 sm:px-4 sm:pb-10 sm:py-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base text-turkiye-red text-outline-red sm:text-xl">
            KADRONU SEÇ
          </h2>
          <p className="mt-1 text-[7px] text-white/50 sm:mt-2 sm:text-[8px]">
            {!picksMatchup && (
              <span className="text-retro-accent">{gameMode.label} · </span>
            )}
            {required === 2
              ? playMode === 'coop'
                ? 'İKİ OYUNCU · 1. VE 2. KİŞİ'
                : 'İKİ OYUNCU · 1. SEN, 2. AI'
              : 'BİR OYUNCU SEÇ'}{' '}
            ·{' '}
            {selected.length}/{required}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button type="button" className="retro-button-ghost px-3 py-2 text-[8px]" onClick={onBack}>
            ← GERİ
          </button>
        </div>
      </div>

      {/* Ayarlar — kompakt chip satırları */}
      <div className="retro-panel flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        {twoPlayer ? (
          <div className="border-l-4 border-retro-accent/70 py-1 pl-3">
            <p className="text-[8px] text-retro-accent">
              {gameMode.label} · {playMode === 'coop' ? '2 vs 2' : '1 vs 1'}
            </p>
            {/*
              Çevrimiçide iki oyuncu aynı klavyede değil: herkes kendi
              cihazında 1. oyuncu tuşlarını kullanıyor. Yerel eşleşmenin
              metnini olduğu gibi göstermek, karşıdakine "sen ok
              tuşlarını kullan" dedirtirdi.
            */}
            {gameMode.online ? (
              <>
                <p className="mt-2 text-[7px] leading-relaxed text-white/60">
                  <b className="text-white/80">SENİN TUŞLARIN</b> — W A S D · BOŞLUK vur
                </p>
                <p className="mt-2 text-[7px] leading-relaxed text-white/45">
                  Rakibin kendi cihazında aynı tuşları kullanır. Seçtiğin kadro
                  ve rakip takım odayı açan taraf olarak ikinize de geçerlidir.
                </p>
              </>
            ) : (
              <>
                <div className="mt-2 grid gap-1 text-[7px] leading-relaxed text-white/60 sm:grid-cols-2">
                  <span>
                    <b className="text-white/80">1. OYUNCU</b> — W A S D · BOŞLUK vur
                  </span>
                  <span>
                    <b className="text-white/80">2. OYUNCU</b> — ok tuşları · ENTER vur
                  </span>
                </div>
                <p className="mt-2 text-[7px] leading-relaxed text-white/45">
                  {playMode === 'coop'
                    ? 'İki oyuncu aynı takımda; rakip yapay zekâ.'
                    : '2. oyuncu rakip takımı sürer.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <ChipRow label="MOD">
            {MODES.map((item) => (
              <Chip
                key={item.id}
                active={mode === item.id}
                onClick={() => handleModeChange(item.id)}
                title={item.description}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>
        )}

        <ChipRow label="ZORLUK">
          {Object.entries(DIFFICULTY).map(([key, value]) => (
            <Chip
              key={key}
              active={difficulty === key}
              onClick={() => {
                Sfx.select();
                setDifficulty(key);
              }}
            >
              {value.label}
            </Chip>
          ))}
        </ChipRow>

        {picksMatchup ? (
          <>
            <ChipRow label="FORMAT">
              {Object.values(FORMATS).map((item) => (
                <Chip
                  key={item.id}
                  active={format === item.id}
                  onClick={() => {
                    Sfx.select();
                    setFormat(item.id);
                  }}
                  title={item.description}
                >
                  {item.label}
                </Chip>
              ))}
            </ChipRow>

            <ChipRow label="RAKİP" wrap>
              <Chip
                active={opponentId === 'random'}
                onClick={() => {
                  Sfx.select();
                  setOpponentId('random');
                }}
              >
                RASTGELE
              </Chip>
              {OPPONENT_TEAMS.map((team) => (
                <Chip
                  key={team.id}
                  active={opponentId === team.id}
                  onClick={() => {
                    Sfx.select();
                    setOpponentId(team.id);
                  }}
                  title={team.blurb}
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 border border-black/40"
                    style={{ backgroundColor: team.colors.primary }}
                  />
                  {team.shortName}
                </Chip>
              ))}
            </ChipRow>
          </>
        ) : (
          <div className="border-l-4 border-retro-accent/70 py-1 pl-3">
            <p className="text-[8px] text-retro-accent">{gameMode.label}</p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {campaign === 'tournament'
                ? `${TOURNAMENT_ROUNDS.length} tur, ${TOURNAMENT_ROUNDS.length} rakip. Rakip ve format turlara göre belirlenir; zorluk her turda bir tık artar.`
                : `${SURVIVAL.lives} can. Her ${SURVIVAL.waveLength} puanda yeni dalga: rakip değişir ve sertleşir. Seçtiğin zorluk başlangıç seviyesidir.`}
            </p>
          </div>
        )}
      </div>

      {/*
        FP cüzdanı — sistem KAPALIYKEN hiç çizilmiyor.
        Kilit rozetleri ve "KADROYA KAT" paneli ayrıca gizlenmiyor:
        onlar `kullanilabilir`den besleniyor ve kapalıyken herkes
        açık olduğu için kendiliğinden yok oluyorlar.
      */}
      {FP_ACIK && (
        <div className="retro-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[7px] tracking-widest text-white/40">FORMA PUANI</p>
            <p className="mt-1 text-sm text-retro-accent">{puan.toLocaleString('tr-TR')} FP</p>
          </div>
          {hedef && (
            <div className="min-w-[140px] flex-1 sm:max-w-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[7px] text-white/45">
                  {hedef.kalan > 0 ? 'SIRADAKİ' : 'AÇILABİLİR'}
                </span>
                <span className="text-[7px] text-white/70">
                  {upper(getPlayerById(hedef.id)?.name ?? '')}
                </span>
              </div>
              {/*
                Çubuk, çıplak bakiyenin söylemediğini söylüyor: bir sonraki
                oyuncuya NE KADAR kaldığı. "412 FP" bir sayı; "40 FP kaldı"
                bir maç daha oynamak için sebep.
              */}
              <div className="mt-1 h-2 w-full border border-white/20 bg-black/40">
                <div
                  className="h-full bg-retro-accent transition-[width] duration-500"
                  style={{ width: `${Math.round(hedef.oran * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[7px] text-white/45">
                {hedef.kalan > 0 ? `${hedef.kalan} FP KALDI` : 'HAZIR'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Aktif kadro */}
      <RosterGrid
        title="AKTİF KADRO"
        players={activeRoster}
        selected={selected}
        focused={focused}
        onSelect={togglePlayer}
        onFocus={setFocused}
        acilanlar={acilanlar}
        puan={puan}
        kutlama={kutlama}
      />

      {bonusRoster.length > 0 && (
        <div className="flex flex-col gap-2 sm:gap-3">
          <div>
            <p className="text-[8px] tracking-widest text-retro-accent">★ BONUS KADRO ★</p>
            <p className="mt-1 text-[7px] text-white/40">
              Özel eklenti oyuncular
            </p>
          </div>
          <RosterGrid
            players={bonusRoster}
            selected={selected}
            focused={focused}
            onSelect={togglePlayer}
            onFocus={setFocused}
            acilanlar={acilanlar}
            puan={puan}
            kutlama={kutlama}
            guest
          />
        </div>
      )}

      {/* Odak kartı — mobilde daha sıkı */}
      <div className="retro-panel flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:gap-5 sm:px-5 sm:py-5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <PixelAvatar player={focusedPlayer} scale={4} pose="cheer" />
          <span className="text-[9px] text-retro-accent">#{focusedPlayer.number}</span>
        </div>

        <div className="flex-1">
          <h3 className="text-sm text-white">{upper(focusedPlayer.name)}</h3>
          <p className="mt-1 text-[8px] text-white/50">
            {focusedPlayer.position}
            {focusedPlayer.captain && ' · KAPTAN'}
            {focusedPlayer.guest && ' · BONUS'}
          </p>

          {/*
            Açma düğmesi künye kartında, ızgarada değil: satın alma geri
            alınamıyor ve ızgarada tek dokunuşla yapılabilseydi yanlış
            oyuncuya basmak bütün bakiyeyi harcatabilirdi. Burada oyuncu
            önce kimi aldığını görüyor.
          */}
          {kutlama === focusedPlayer.id && (
            <div className="mt-3 animate-pulse-gold border-2 border-retro-accent bg-retro-accent/20 px-3 py-2">
              <p className="text-[9px] tracking-widest text-retro-accent">
                ★ KADRONA KATILDI ★
              </p>
              <p className="mt-1 text-[7px] text-white/70">
                Seçili kadroya da alındı — doğrudan maça çıkabilirsin.
              </p>
            </div>
          )}

          {!odakAcik && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-2 border-[#FFD24A]/40 bg-black/30 px-3 py-2">
              <span className="text-[9px] text-[#FFD24A]">{odakBedel} FP</span>
              <button
                type="button"
                className="retro-button px-4 py-2 text-[8px] disabled:opacity-40"
                disabled={puan < odakBedel || !onUnlock}
                onClick={() => satinAl(focusedPlayer.id)}
              >
                {puan >= odakBedel ? 'KADROYA KAT' : `${odakBedel - puan} FP EKSİK`}
              </button>
              <span className="text-[7px] text-white/40">
                CÜZDAN: {puan.toLocaleString('tr-TR')} FP
              </span>
            </div>
          )}

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] sm:grid-cols-4">
            <Fact label="DOĞUM" value={formatBirthDate(focusedPlayer)} />
            <Fact
              label="YAŞ"
              value={getAge(focusedPlayer) !== null ? `${getAge(focusedPlayer)}` : '—'}
            />
            <Fact
              label="BOY"
              value={focusedPlayer.height ? `${focusedPlayer.height} cm` : '—'}
            />
            <Fact
              label="KİLO"
              value={focusedPlayer.weight ? `${focusedPlayer.weight} kg` : '—'}
            />
          </dl>

          <div
            className="mt-3 border-l-4 py-1 pl-3"
            style={{ borderColor: focusedPlayer.colors.accent }}
          >
            <p className="text-[8px]" style={{ color: focusedPlayer.colors.accent }}>
              BONUS: {upper(focusedPlayer.bonus.name)}
            </p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {focusedPlayer.bonus.description}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatBar label="SMAÇ" value={focusedPlayer.stats.attack} compact />
            <StatBar label="BLOK" value={focusedPlayer.stats.block} compact color="#FFC633" />
            <StatBar label="SERVİS" value={focusedPlayer.stats.serve} compact color="#FF7A18" />
            <StatBar label="SAVUNMA" value={focusedPlayer.stats.defense} compact color="#5FC2E8" />
            <StatBar label="HIZ" value={focusedPlayer.stats.speed} compact color="#B7F5C6" />
            <StatBar label="DAYANIM" value={focusedPlayer.stats.stamina} compact color="#FF9ED2" />
          </div>
        </div>
      </div>

      {/* Sticky CTA — mobilde her zaman erişilir */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-white/20 bg-retro-bg/95 px-3 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)] sm:pb-4">
          <button
            type="button"
            className="retro-button w-full max-w-md px-8 py-3 text-sm sm:w-auto sm:px-10 sm:py-4"
            onClick={handleStart}
            disabled={!canStart}
          >
            {campaign === 'tournament'
              ? 'KUPA YOLUNA ÇIK'
              : campaign === 'survival'
                ? 'SAHAYA ÇIK'
                : gameMode.online
                  ? 'ODA KUR'
                  : twoPlayer
                    ? 'İKİ KİŞİ BAŞLA'
                    : 'MAÇA BAŞLA'}
          </button>
          {!canStart && (
            <p className="text-[7px] text-white/45 sm:text-[8px]">
              {playMode === 'coop' ? 'CO-OP' : '2v2'} İÇİN{' '}
              {required - selected.length} OYUNCU DAHA
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipRow({ label, children, wrap = false }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[7px] tracking-widest text-retro-accent sm:w-14">
        {label}
      </span>
      <div className={`flex gap-2 ${wrap ? 'flex-wrap' : 'flex-wrap sm:flex-nowrap'}`}>
        {children}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`border-2 px-2.5 py-1.5 text-[8px] transition sm:px-3 sm:py-2 sm:text-[9px] ${
        active
          ? 'border-turkiye-red bg-turkiye-red/25 text-white'
          : 'border-white/20 text-white/70 hover:border-white/50'
      }`}
    >
      {children}
    </button>
  );
}

function RosterGrid({
  title, players, selected, focused, onSelect, onFocus, guest = false,
  acilanlar = [], puan = 0, kutlama = null,
}) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {title && <p className="text-[8px] tracking-widest text-white/45">{title}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {players.map((player) => {
          const isSelected = selected.includes(player.id);
          const order = selected.indexOf(player.id) + 1;
          const kilitli = !kullanilabilir(player.id, acilanlar);
          const yeniAlindi = kutlama === player.id;
          const fiyat = bedel(player.id);
          // Parası yeten kilit, yetmeyenden farklı görünüyor: biri davet
          const alinabilir = kilitli && puan >= fiyat;

          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player.id)}
              onMouseEnter={() => onFocus(player.id)}
              aria-label={kilitli ? `${player.name} — kilitli, ${fiyat} FP` : player.name}
              className={`relative flex flex-col items-center gap-1 border-4 px-1 py-2 transition sm:gap-2 sm:px-2 sm:py-3 ${
                isSelected
                  ? 'border-retro-accent bg-turkiye-red/25'
                  : alinabilir
                    ? 'border-[#FFD24A]/70 bg-retro-panel/60'
                    : kilitli
                      ? 'border-white/10 bg-black/40'
                      : focused === player.id
                        ? 'border-white/60 bg-retro-panel'
                        : 'border-white/15 bg-retro-panel/60 hover:border-white/40'
              }`}
              style={{
                boxShadow: yeniAlindi
                  ? '0 0 0 3px #FFD24A, 4px 4px 0 0 rgba(0,0,0,0.6)'
                  : isSelected ? '4px 4px 0 0 rgba(0,0,0,0.6)' : undefined,
              }}
            >
              {/*
                Kilit rozeti EMOJİ DEĞİL: oyunun yazı tipi (Press Start
                2P) emojileri taşımıyor, tarayıcı başka bir yazı tipine
                düşer ve piksel ızgarasında yamuk duran tek şey o olurdu.
                Fiyatın kendisi zaten kilidi anlatıyor; alınabilir olanı
                ★ ve altın renk ayırıyor.
              */}
              {kilitli && (
                <span
                  className={`absolute right-0.5 top-0.5 z-10 text-[6px] sm:text-[7px] ${
                    alinabilir ? 'text-[#FFD24A]' : 'text-white/40'
                  }`}
                >
                  {alinabilir ? '★ ' : ''}{fiyat} FP
                </span>
              )}
              {isSelected && (
                <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center border-2 border-black bg-retro-accent text-[8px] text-black sm:h-6 sm:w-6 sm:text-[9px]">
                  {order}
                </span>
              )}
              {player.captain && (
                <span className="absolute right-0.5 top-0.5 text-[6px] text-retro-accent sm:text-[7px]">
                  ★ K
                </span>
              )}
              {guest && !player.captain && (
                <span className="absolute right-0.5 top-0.5 text-[5px] text-[#FFD24A]/80 sm:text-[6px]">
                  BONUS
                </span>
              )}

              {/*
                Kilitli oyuncu SİLÜET değil, soluk. Tamamen karartmak
                oyuncunun neyi kaçırdığını gizlerdi — oysa istenen tam
                tersi: kimi açacağını görsün, sonra istesin.
              */}
              <div
                style={kilitli
                  ? { filter: 'grayscale(1) brightness(0.55)', opacity: 0.75 }
                  : undefined}
              >
                <PixelAvatar player={player} scale={2} />
              </div>

              <span
                className={`text-center text-[6px] leading-tight sm:text-[8px] ${
                  kilitli ? 'text-white/45' : ''
                }`}
              >
                {upper(player.name)}
              </span>
              <span className="hidden text-[7px] text-white/45 sm:block">
                #{player.number} · {player.position}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
