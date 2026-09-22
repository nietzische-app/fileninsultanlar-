import { useEffect, useMemo, useRef, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import { drawTrophy } from '../game/sprites.js';
import { getPlayerById } from '../game/players.js';
import { FORMATS } from '../game/constants.js';
import { survivalRankKey } from '../game/survival.js';
import { getAchievement } from '../game/achievements.js';
import { TOURNAMENT_ROUNDS, tournamentSummary } from '../game/tournament.js';
import { upper } from '../utils/text.js';
import { t, sayiYazi, achYazi, turYazi, kalemYazi } from '../i18n/index.js';

const CONFETTI_COLORS = ['#E30A17', '#FFFFFF', '#FFD24A', '#FF7A18', '#9BE7FF'];

/**
 * Maç sonu ekranı — kupa, konfeti ve
 * onurlandırma mesajı.
 */
export default function ResultScreen({
  result,
  brokenRecords,
  onRematch,
  onHome,
  muted,
  onToggleMute,
  /** Turnuva kapanışında bracket durumu — kupa/elenme özeti için. */
  tournamentState = null,
  /** Bu maçta açılan rozet id'leri. */
  freshAchievements = [],
  /** Bu maçın Forma Puanı kazancı — kalem dökümüyle (bkz. ilerleme.js). */
  kazanc = null,
  /**
   * Çevrimiçi rövanş durumu — {ben, rakip, bekleniyor, ayrildi}.
   * `null` ise maç çevrimiçi değil (ya da bağlantı kapandı).
   */
  rovans = null,
  onRovans,
}) {
  const survival = result.campaign === 'survival' ? result.survival : null;
  /*
   * Çevrimiçi sıralamalı maçın puan sonucu. Sunucudan geliyor —
   * istemci hesaplamıyor, çünkü hesaplasa uydurabilirdi. Yalnız hızlı
   * eşleşme maçlarında dolu.
   */
  const puan = result.puan ?? null;
  const tournament = useMemo(
    () => (tournamentState ? tournamentSummary(tournamentState) : null),
    [tournamentState]
  );

  // Hayatta kalmada "kazanma" yok; turnuvada asıl zafer kupadır.
  const won = tournament ? tournament.champion : result.winner === 'home';
  const formatLabel = t(`format.${result.format}`) !== `format.${result.format}`
    ? t(`format.${result.format}`)
    : (FORMATS[result.format]?.label ?? result.format ?? t('format.classic'));
  const practice = result.format === 'practice';

  const squad = useMemo(
    () => result.homeIds.map((id) => getPlayerById(id)).filter(Boolean),
    [result.homeIds]
  );

  const newRecords = useMemo(() => {
    if (!brokenRecords) return [];
    const labels = [];
    if (brokenRecords.firstWin) labels.push(t('rec.firstWin'));
    if (brokenRecords.bestWinStreak) labels.push(t('rec.streak'));
    if (brokenRecords.longestRally) labels.push(t('rec.rally'));
    if (brokenRecords.mostSpikes) labels.push(t('rec.spikes'));
    if (brokenRecords.mostBlocks) labels.push(t('rec.blocks'));
    if (brokenRecords.mostSaves) labels.push(t('rec.saves'));
    if (brokenRecords.bestSurvivalPoints) labels.push(t('rec.survPts'));
    if (brokenRecords.bestSurvivalWave) labels.push(t('rec.survWave'));
    if (brokenRecords.tournamentWon) labels.push(t('rec.cup'));
    if (brokenRecords.bestTournamentRound) labels.push(t('rec.round'));
    return labels;
  }, [brokenRecords, /* t current lang */]);

  // Konfeti parçaları — yalnızca zaferde
  const confetti = useMemo(() => {
    if (!won) return [];
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3.5,
      duration: 2.8 + Math.random() * 2.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: 6 + Math.random() * 7,
      height: 10 + Math.random() * 9,
    }));
  }, [won]);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-7 overflow-hidden px-4 py-10">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </div>

      {/* Konfeti katmanı */}
      {won && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                width: `${piece.width}px`,
                height: `${piece.height}px`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-7">
        {/*
          Çevrimiçi puan değişimi. Sunucu maçı koşturduğu ve kazananı
          kendi bildiği için bu sayı uydurulamıyor; ekranda göstermek
          de o yüzden anlamlı.
        */}
        {puan && (
          <div className="order-first w-full max-w-xs border-4 border-retro-accent/40 bg-black/50 px-4 py-3 text-center">
            <p className="text-[7px] tracking-widest text-white/45">{t('result.elo')}</p>
            <p className="mt-2 text-[18px] text-retro-accent">
              {puan.ben?.puan}
              <span
                className={`ml-2 text-[10px] ${
                  puan.degisim >= 0 ? 'text-retro-accent' : 'text-turkiye-red'
                }`}
              >
                {puan.degisim >= 0 ? '+' : ''}
                {puan.degisim}
              </span>
            </p>
            <p className="mt-2 text-[7px] text-white/45">
              {t('result.eloLine', { g: puan.ben?.galibiyet, m: puan.ben?.maglubiyet })}
              {puan.sira ? t('online.rank', { n: puan.sira }) : ''}
            </p>
          </div>
        )}

        {/* Başlık */}
        <div className="text-center">
          <h2
            className={`text-2xl leading-relaxed sm:text-4xl ${
              won ? 'text-retro-accent text-outline-red' : 'text-white/80'
            }`}
          >
            {survival ? t('result.runOver') : tournament ? (won ? t('result.cupOurs') : t('result.out')) : won ? t('result.champ') : t('result.over')}
          </h2>
          <p className="mt-3 text-[9px] text-white/55">
            {survival
              ? t('result.survLine', { rank: t(`rank.${survivalRankKey(survival.points)}`), n: survival.points })
              : tournament
                ? won
                  ? t('result.cupLift')
                  : t('result.bye', { label: turYazi({ id: tournament.lastRoundId, label: tournament.lastRoundLabel }) })
                : won
                  ? t('result.won')
                  : t('result.lost', { ad: result.opponent?.name ?? t('hud.away') })}
          </p>
          <p className="mt-2 text-[7px] tracking-widest text-white/35">
            {survival
              ? t('result.survMeta', { n: survival.wave })
              : tournament
                ? t('result.tourMeta', { n: tournament.wins, toplam: tournament.total })
                : formatLabel}
            {!survival && !tournament && result.opponent?.shortName
              ? ` · vs ${result.opponent.shortName}`
              : ''}
            {/* Antrenman galibiyet/seri sayacına işlemez ama stat
                rekorları (en uzun ralli, en çok smaç...) geçerlidir —
                "REKORLARA YAZILMAZ" demek yanlıştı, aynı ekranda
                "YENİ REKOR" rozetleri çıkıyordu. */}
            {practice && !survival && !tournament ? t('result.practice') : ''}
          </p>
        </div>

        {/* Kupa */}
        {won && <PixelTrophy />}

        {/* Skor özeti */}
        <div className="retro-panel w-full px-5 py-5">
          {survival ? (
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-[9px] text-turkiye-red">{t('hud.points')}</p>
                <p className="mt-2 text-3xl text-shadow-pixel">{survival.points}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-retro-accent">{t('result.wave')}</p>
                <p className="mt-2 text-3xl text-shadow-pixel">{survival.wave}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-[#9BB0FF]">{t('result.rank')}</p>
                <p className="mt-3 text-[9px] text-white/80">
                  {t(`rank.${survivalRankKey(survival.points)}`)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-[9px] text-turkiye-red">{t('hud.home')}</p>
                <p className="mt-2 text-3xl text-shadow-pixel">{result.sets.home}</p>
              </div>
              <span className="text-lg text-white/30">—</span>
              <div className="text-center">
                <p className="text-[9px] text-[#9BB0FF]">
                  {result.opponent?.shortName ?? t('hud.away')}
                </p>
                <p className="mt-2 text-3xl text-shadow-pixel">{result.sets.away}</p>
              </div>
            </div>
          )}

          {/* Set skorları — hayatta kalmada set yok */}
          {!survival && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t-2 border-white/15 pt-4">
              {result.setHistory.map((set, i) => (
                <span
                  key={i}
                  className={`border-2 px-3 py-1 text-[7px] ${
                    set.winner === 'home'
                      ? 'border-turkiye-red text-turkiye-red'
                      : 'border-[#9BB0FF]/60 text-[#9BB0FF]'
                  }`}
                >
                  {t('hud.setLine', { n: i + 1, a: set.home, b: set.away })}
                </span>
              ))}
            </div>
          )}

          {/* Maç istatistikleri */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t-2 border-white/15 pt-4 text-center sm:grid-cols-4">
            <Stat label={t("stat.spike")} value={result.stats.spikes} highlight={brokenRecords?.mostSpikes} />
            <Stat label={t("stat.block")} value={result.stats.blocks} highlight={brokenRecords?.mostBlocks} />
            <Stat label={t("stat.save")} value={result.stats.saves} highlight={brokenRecords?.mostSaves} />
            <Stat
              label={t("stat.rally")}
              value={result.stats.longestRally}
              highlight={brokenRecords?.longestRally}
            />
          </div>

          {/* Beceri satırı — kombo / tam vuruş / plase */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t-2 border-white/15 pt-4 text-center">
            <Stat
              label={t("stat.combo")}
              value={result.stats.bestCombo ?? 0}
              highlight={brokenRecords?.bestCombo}
            />
            <Stat label={t("stat.perfect")} value={result.stats.perfects ?? 0} />
            <Stat label={t("stat.tip")} value={result.stats.tips ?? 0} />
          </div>
        </div>

        {/* Turnuva yolu özeti */}
        {tournamentState && (
          <div className="retro-panel w-full px-4 py-4">
            <p className="mb-3 text-[7px] tracking-widest text-retro-accent">
{t('result.path')}
            </p>
            <div className="flex flex-col gap-1.5">
              {tournamentState.results.map((entry, i) => (
                <div
                  key={entry.roundId}
                  className={`flex items-center gap-3 border-2 px-3 py-1.5 text-[7px] ${
                    entry.won
                      ? 'border-retro-accent/70 text-retro-accent'
                      : 'border-white/20 text-white/50'
                  }`}
                >
                  <span className="w-3">{entry.won ? '✓' : '✗'}</span>
                  <span className="flex-1 truncate">
                    {TOURNAMENT_ROUNDS[i] ? turYazi(TOURNAMENT_ROUNDS[i]) : t('round.r1').replace('1', String(i+1))}
                  </span>
                  <span>
                    {entry.sets.home}-{entry.sets.away}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yeni rekorlar */}
        {newRecords.length > 0 && (
          <div className="w-full border-2 border-retro-accent/80 bg-retro-accent/10 px-4 py-3 text-center">
            <p className="text-[8px] tracking-widest text-retro-accent">{t('result.newRec')}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {newRecords.map((label) => (
                <span
                  key={label}
                  className="border border-retro-accent/50 px-2 py-1 text-[7px] text-retro-accent"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bu maçta kazanılan Forma Puanı */}
        {kazanc && kazanc.toplam > 0 && <FormaPuani kazanc={kazanc} />}

        {/* Bu maçta açılan rozetler */}
        {freshAchievements.length > 0 && (
          <div className="w-full border-2 border-[#9BE7FF]/70 bg-[#9BE7FF]/10 px-4 py-3 text-center">
            <p className="text-[8px] tracking-widest text-[#9BE7FF]">
{t('result.newBadge')}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {freshAchievements.map((id) => {
                const badge = getAchievement(id);
                if (!badge) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-2 border border-[#9BE7FF]/50 px-2 py-1 text-[7px] text-[#9BE7FF]"
                    title={badge.description}
                  >
                    <span aria-hidden="true">{badge.icon}</span>
                    {achYazi(badge).label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Sahaya çıkan kadro */}
        <div className="flex items-end justify-center gap-6">
          {squad.map((player, i) => (
            <div
              key={player.id}
              className="flex flex-col items-center gap-2"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <div className={won ? 'animate-float' : ''}>
                <PixelAvatar player={player} scale={4} pose={won ? 'cheer' : 'idle'} />
              </div>
              <span className="text-[7px] text-white/60">{upper(player.name)}</span>
            </div>
          ))}
        </div>

        {/* Onurlandırma mesajı */}
        <div className="retro-panel w-full px-5 py-5 text-center">
          <p className="mb-3 text-[8px] tracking-widest text-retro-accent">
{t('result.dedicate')}
          </p>
          <p className="text-[8px] leading-relaxed text-white/75 sm:text-[9px]">
            {t('result.honor')}
            <br />
            {t('result.honor2')}
            <br />
            <span className="text-turkiye-red">{t('result.goodGame')}</span>
          </p>
        </div>

        {/*
          ÇEVRİMİÇİ RÖVANŞ.
          
          Çevrimiçi bir maçın en sık istenen devamı "bir daha" ve az
          önce oynadığın kişi zaten karşında. Eskiden bunun yolu yoktu:
          maç biter bitmez soket kapanıyor, oyuncu menüye dönüp baştan
          rakip arıyordu — yeni rakip bulmak, mevcut rakiple tekrar
          oynamaktan çok daha uzun.

          İKİ TARAF DA İSTEMELİ; ekran hangi aşamada olduğunu söylüyor,
          çünkü "bastım ve bir şey olmadı" en kötü hâl.
        */}
        {rovans && (
          <div className="w-full max-w-sm border-2 border-retro-accent/60 bg-retro-accent/10 px-4 py-3 text-center">
            {rovans.ayrildi ? (
              <p className="text-[8px] leading-relaxed text-white/55">
{t('result.oppLeft')}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="retro-button w-full py-3 text-[9px] disabled:opacity-50"
                  disabled={rovans.bekleniyor}
                  onClick={onRovans}
                >
                  {rovans.bekleniyor ? t('result.rematchWait') : t('result.rematch')}
                </button>
                <p className="mt-2 text-[7px] leading-relaxed text-white/50">
                  {rovans.rakip && !rovans.ben
                    ? t('result.oppWants')
                    : rovans.bekleniyor
                      ? t('result.bothNeed')
                      : t('result.sameOpp')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Butonlar */}
        <div className="flex flex-wrap justify-center gap-4 pb-6">
          {/*
            Çevrimiçide "TEKRAR OYNA" yok: o düğme yerel maçı aynı
            ayarla yeniden kuruyor ve çevrimiçide karşılığı yok —
            basınca rakipsiz bir maç açardı. Rövanş yukarıda.
          */}
          {!rovans && (
            <button type="button" className="retro-button px-8 py-4" onClick={onRematch}>
              {survival ? t('result.retry') : tournament ? t('result.newTour') : t('result.again')}
            </button>
          )}
          <button type="button" className="retro-button-ghost px-8 py-4" onClick={onHome}>
{t('nav.home')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-lg text-retro-accent">
        {value}
        {highlight && <span className="ml-1 text-[7px] text-turkiye-red">★</span>}
      </p>
      <p className={`mt-1 text-[7px] ${highlight ? 'text-retro-accent/80' : 'text-white/45'}`}>
        {label}
      </p>
    </div>
  );
}

/** Canvas üzerine çizilen piksel şampiyonluk kupası. */
function PixelTrophy() {
  const canvasRef = useRef(null);
  const size = 8;
  const width = size * 16;
  const height = size * 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    drawTrophy(ctx, width / 2, height - size * 2, size);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixelated animate-float"
      aria-label={t('result.trophyAria')}
    />
  );
}

/**
 * Forma Puanı paneli — bu maçın kazancı, kalem kalem.
 *
 * Tek bir "+68 FP" yeterdi ama kalemleri göstermek başka bir iş
 * yapıyor: oyuncuya bir dahaki sefere NEYİ artıracağını söylüyor.
 * "PERFORMANS +14" satırını gören, blokların sayıldığını öğreniyor;
 * "ZOR ×1.35" satırını gören zorluğu bir tık yükseltmeyi düşünüyor.
 */
function FormaPuani({ kazanc }) {
  const sayac = useSayac(kazanc.toplam);

  return (
    <div className="w-full border-2 border-[#FFD24A]/70 bg-[#FFD24A]/10 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[8px] tracking-widest text-[#FFD24A]">{t('result.fp')}</p>
        <p className="text-base text-[#FFD24A]">+{sayiYazi(sayac)}</p>
      </div>

      {/*
        Satırlar TOPLANABİLİR: her satır bir FP farkı, oran değil. Çarpan
        da fark olarak yazılıyor ve maç kalemlerinin hemen ardında
        duruyor — rozet/kupa satırları çarpanın altında değil, çünkü
        onlara uygulanmıyor (bkz. ilerleme.js `satirlariKur`).
      */}
      <div className="mt-3 flex flex-col gap-1">
        {kazanc.satirlar.map((k, i) => (
          <div
            key={`${k.id ?? k.ad}-${i}`}
            className={`flex justify-between gap-3 text-[7px] ${
              k.carpan ? 'text-[#FFD24A]/80' : 'text-white/60'
            }`}
          >
            <span>{kalemYazi(k)}</span>
            <span className={k.carpan ? '' : 'text-white/80'}>
              {k.puan < 0 ? '' : '+'}{k.puan}
            </span>
          </div>
        ))}
      </div>

      {typeof kazanc.bakiye === 'number' && (
        <p className="mt-2 border-t border-white/10 pt-2 text-right text-[7px] text-white/45">
          {t('result.wallet', { n: sayiYazi(kazanc.bakiye) })}
        </p>
      )}

      {/*
        EŞİK HABERİ. Bakiye tek başına bir sayı; bu satır onu bir şeye
        çeviriyor. Yalnızca bu maçta AÇILABİLİR HALE GELENLER yazılıyor
        (bkz. ilerleme.js `yeniAcilabilirler`) — bakiyesi zaten yetenleri
        her maç sonunda tekrarlamak uyarıyı gürültüye çevirirdi.
      */}
      {kazanc.yeni?.length > 0 && (
        <div className="mt-3 border-2 border-retro-accent bg-retro-accent/15 px-3 py-2">
          <p className="text-[8px] tracking-widest text-retro-accent">
{t('result.canUnlock')}
          </p>
          <p className="mt-1 text-[7px] leading-relaxed text-white/75">
            {kazanc.yeni.slice(0, 3).map((p) => upper(p.name)).join(' · ')}
            {kazanc.yeni.length > 3 && ` +${kazanc.yeni.length - 3}`}
          </p>
          <p className="mt-1 text-[7px] text-white/40">{t('result.buyHint')}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Sıfırdan hedefe sayan sayaç.
 *
 * Sayının BİRDEN belirmesiyle sayarak gelmesi arasındaki fark küçük
 * ama kazanmanın hissedildiği yer tam olarak orası — ödül anlık değil,
 * bir an sürüyor.
 *
 * `prefers-reduced-motion` açıksa animasyon hiç çalışmıyor: hareket
 * rahatsızlık verenler için burada taşınan bir bilgi yok, sayı zaten
 * son değerinde duruyor.
 */
function useSayac(hedef, sure = 700) {
  const [deger, setDeger] = useState(hedef);

  useEffect(() => {
    const azHareket = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (azHareket || hedef <= 0) {
      setDeger(hedef);
      return undefined;
    }

    let kare = 0;
    const bas = performance.now();
    const adim = (simdi) => {
      const t = Math.min(1, (simdi - bas) / sure);
      // Sonu yavaşlayan eğri: sayı hedefe yaklaşırken duruyor gibi olsun
      setDeger(Math.round(hedef * (1 - (1 - t) ** 3)));
      if (t < 1) kare = requestAnimationFrame(adim);
    };
    kare = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(kare);
  }, [hedef, sure]);

  return deger;
}
