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
  kullanilabilir, bedel, sonrakiHedef,
} from '../game/ilerleme.js';
import { OPPONENT_TEAMS } from '../game/opponents.js';
import { getGameMode } from '../game/modes.js';
import { TOURNAMENT_ROUNDS } from '../game/tournament.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';
import { t, sayiYazi, mevkiYazi, modeYazi } from '../i18n/index.js';

const MODES = [
  { id: '1v1', label: '1 vs 1', descKey: 'select.1v1.desc' },
  {
    id: '2v2',
    label: '2 vs 2',
    descKey: 'select.2v2.desc',
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
 * @param {boolean} [fpAcik]
 */
function sanitizeHomeIds(ids, mode, acilanlar = [], fpAcik = false) {
  const required = mode === '2v2' ? 2 : 1;
  const valid = (Array.isArray(ids) ? ids : [])
    .filter((id) => Boolean(getPlayerById(id)) && kullanilabilir(id, acilanlar, fpAcik))
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
  fpAcik = false,
}) {
  const gameMode = getGameMode(modeId);
  const modYazi = modeYazi(gameMode, {
    n: TOURNAMENT_ROUNDS.length,
    lives: SURVIVAL.lives,
    wave: SURVIVAL.waveLength,
  });
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
    sanitizeHomeIds(
      initialHomeIds,
      playMode === 'coop' || initialMode === '2v2' ? '2v2' : '1v1',
      ilerleme.acilanlar,
      fpAcik,
    )
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
    () => (fpAcik ? sonrakiHedef(puan, acilanlar) : null),
    [puan, acilanlar, fpAcik],
  );
  const odakAcik = kullanilabilir(focused, acilanlar, fpAcik);
  const odakBedel = bedel(focused);

  const togglePlayer = (id) => {
    /*
     * Kilitli karta basmak SEÇMİYOR, odaklıyor. Böylece alttaki künye
     * kartı o oyuncuyu gösteriyor: istatistikleri, bonusu ve açma
     * düğmesi. Basışı tamamen yok saymak, oyuncuya neyi kaçırdığını
     * göstermeden "hayır" demek olurdu.
     */
    if (!kullanilabilir(id, acilanlar, fpAcik)) {
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
            {t('select.title')}
          </h2>
          <p className="mt-1 text-[7px] text-white/50 sm:mt-2 sm:text-[8px]">
            {!picksMatchup && (
              <span className="text-retro-accent">{modYazi.label} · </span>
            )}
            {required === 2
              ? playMode === 'coop'
                ? t('select.coopTwo')
                : t('select.aiTwo')
              : t('select.one')}{' '}
            ·{' '}
            {selected.length}/{required}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button type="button" className="retro-button-ghost px-3 py-2 text-[8px]" onClick={onBack}>
            {t('nav.back')}
          </button>
        </div>
      </div>

      {/* Ayarlar — kompakt chip satırları */}
      <div className="retro-panel flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        {twoPlayer ? (
          <div className="border-l-4 border-retro-accent/70 py-1 pl-3">
            <p className="text-[8px] text-retro-accent">
              {modYazi.label} · {playMode === 'coop' ? '2 vs 2' : '1 vs 1'}
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
                  <b className="text-white/80">{t('select.yourKeys')}</b> — {t('select.yourKeysBody')}
                </p>
                <p className="mt-2 text-[7px] leading-relaxed text-white/45">
                  {t('select.onlineKeysHint')}
                </p>
              </>
            ) : (
              <>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2 bg-black/30 px-2 py-2">
                    <span className="jersey-mark mt-px" aria-hidden="true">1</span>
                    <span className="text-[7px] leading-relaxed text-white/65">
                      <b className="text-white">{t('select.p1Keys')}</b>
                      <span className="mt-1 block text-white/40">{t('select.p1Mobile')}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2 bg-black/30 px-2 py-2">
                    <span className="jersey-mark jersey-mark-p2 mt-px" aria-hidden="true">2</span>
                    <span className="text-[7px] leading-relaxed text-white/65">
                      <b className="text-white">{t('select.p2Keys')}</b>
                      <span className="mt-1 block text-white/40">{t('select.p2Mobile')}</span>
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[7px] leading-relaxed text-white/45">
                  {playMode === 'coop'
                    ? t('select.coopHint')
                    : t('select.vsHint')}
                </p>
              </>
            )}
          </div>
        ) : (
<ChipRow label={t("select.chipMode")}>
            {MODES.map((item) => (
              <Chip
                key={item.id}
                active={mode === item.id}
                onClick={() => handleModeChange(item.id)}
                title={t(item.descKey)}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>
        )}

<ChipRow label={t("select.chipDiff")}>
          {Object.keys(DIFFICULTY).map((key) => (
            <Chip
              key={key}
              active={difficulty === key}
              onClick={() => {
                Sfx.select();
                setDifficulty(key);
              }}
            >
{t(`diff.${key}`)}
            </Chip>
          ))}
        </ChipRow>

        {picksMatchup ? (
          <>
<ChipRow label={t("select.chipFormat")}>
              {Object.values(FORMATS).map((item) => (
                <Chip
                  key={item.id}
                  active={format === item.id}
                  onClick={() => {
                    Sfx.select();
                    setFormat(item.id);
                  }}
                  title={t(`format.${item.id}.desc`)}
                >
{t(`format.${item.id}`)}
                </Chip>
              ))}
            </ChipRow>

<ChipRow label={t("select.chipOpp")} wrap>
              <Chip
                active={opponentId === 'random'}
                onClick={() => {
                  Sfx.select();
                  setOpponentId('random');
                }}
              >
{t("select.random")}
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
            <p className="text-[8px] text-retro-accent">{modYazi.label}</p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {campaign === 'tournament'
                ? t('select.tourHint', { n: TOURNAMENT_ROUNDS.length })
                : t('select.survHint', { lives: SURVIVAL.lives, wave: SURVIVAL.waveLength })}
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
      {fpAcik && (
        <div className="retro-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[7px] tracking-widest text-white/40">{t('start.fp')}</p>
            <p className="mt-1 text-sm text-retro-accent">{sayiYazi(puan)} {t('fp.unit')}</p>
          </div>
          {hedef && (
            <div className="min-w-[140px] flex-1 sm:max-w-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[7px] text-white/45">
                  {hedef.kalan > 0 ? t('select.next') : t('select.unlockable')}
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
                {hedef.kalan > 0 ? t('select.fpLeft', { n: hedef.kalan }) : t('select.ready')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Aktif kadro */}
      <RosterGrid
        title={t("select.active")}
        players={activeRoster}
        selected={selected}
        focused={focused}
        onSelect={togglePlayer}
        onFocus={setFocused}
        acilanlar={acilanlar}
        puan={puan}
        kutlama={kutlama}
        fpAcik={fpAcik}
      />

      {bonusRoster.length > 0 && (
        <div className="flex flex-col gap-2 sm:gap-3">
          <div>
            <p className="text-[8px] tracking-widest text-retro-accent">{t('select.bonus')}</p>
            <p className="mt-1 text-[7px] text-white/40">
              {t('select.bonusHint')}
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
            fpAcik={fpAcik}
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
            {mevkiYazi(focusedPlayer.position)}
            {focusedPlayer.captain && ` · ${t('select.captain')}`}
            {focusedPlayer.guest && ` · ${t('tag.bonus')}`}
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
{t('select.joined')}
              </p>
              <p className="mt-1 text-[7px] text-white/70">
{t('select.joinedHint')}
              </p>
            </div>
          )}

          {!odakAcik && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-2 border-[#FFD24A]/40 bg-black/30 px-3 py-2">
              <span className="text-[9px] text-[#FFD24A]">{odakBedel} {t('fp.unit')}</span>
              <button
                type="button"
                className="retro-button px-4 py-2 text-[8px] disabled:opacity-40"
                disabled={puan < odakBedel || !onUnlock}
                onClick={() => satinAl(focusedPlayer.id)}
              >
                {puan >= odakBedel ? t('select.join') : t('select.short', { n: odakBedel - puan })}
              </button>
              <span className="text-[7px] text-white/40">
                {t('select.wallet', { n: sayiYazi(puan) })}
              </span>
            </div>
          )}

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] sm:grid-cols-4">
            <Fact label={t("select.born")} value={formatBirthDate(focusedPlayer)} />
            <Fact
              label={t("select.age")}
              value={getAge(focusedPlayer) !== null ? `${getAge(focusedPlayer)}` : '—'}
            />
            <Fact
              label={t("select.height")}
              value={focusedPlayer.height ? `${focusedPlayer.height} cm` : '—'}
            />
            <Fact
              label={t("select.weight")}
              value={focusedPlayer.weight ? `${focusedPlayer.weight} kg` : '—'}
            />
          </dl>

          <div
            className="mt-3 border-l-4 py-1 pl-3"
            style={{ borderColor: focusedPlayer.colors.accent }}
          >
            <p className="text-[8px]" style={{ color: focusedPlayer.colors.accent }}>
              {t('select.bonusLabel', { ad: upper(focusedPlayer.bonus.name) })}
            </p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {focusedPlayer.bonus.description}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatBar label={t("stat.spike")} value={focusedPlayer.stats.attack} compact />
            <StatBar label={t("stat.block")} value={focusedPlayer.stats.block} compact color="#FFC633" />
            <StatBar label={t("stat.serve")} value={focusedPlayer.stats.serve} compact color="#FF7A18" />
            <StatBar label={t("stat.defense")} value={focusedPlayer.stats.defense} compact color="#5FC2E8" />
            <StatBar label={t("stat.speed")} value={focusedPlayer.stats.speed} compact color="#B7F5C6" />
            <StatBar label={t("stat.stamina")} value={focusedPlayer.stats.stamina} compact color="#FF9ED2" />
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
              ? t('select.goCup')
              : campaign === 'survival'
                ? t('select.goCourt')
                : gameMode.online
                  ? t('select.openRoom')
                  : twoPlayer
                    ? t('select.startTwo')
                    : t('select.startMatch')}
          </button>
          {!canStart && (
            <p className="text-[7px] text-white/45 sm:text-[8px]">
              {t('select.needMore', { mod: playMode === 'coop' ? 'CO-OP' : '2v2', n: required - selected.length })}
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
  acilanlar = [], puan = 0, kutlama = null, fpAcik = false,
}) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {title && <p className="text-[8px] tracking-widest text-white/45">{title}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {players.map((player) => {
          const isSelected = selected.includes(player.id);
          const order = selected.indexOf(player.id) + 1;
          const kilitli = !kullanilabilir(player.id, acilanlar, fpAcik);
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
              aria-label={kilitli ? t('select.locked', { ad: player.name, n: fiyat }) : player.name}
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
                  {alinabilir ? '★ ' : ''}{fiyat} {t('fp.unit')}
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
                  {t('tag.bonus')}
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
                #{player.number} · {mevkiYazi(player.position)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
