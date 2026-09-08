import { useMemo } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import StatBar from '../components/StatBar.jsx';
import {
  kullanilabilir,
  bedel,
  sonrakiHedef,
  kademeGruplari,
  koleksiyonOzeti,
  FP_ACIK,
} from '../game/ilerleme.js';
import { getPlayerById } from '../game/players.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/**
 * KOLEKSİYON — kadronun tamamı, kademe kademe.
 *
 * NEDEN AYRI EKRAN
 * ----------------
 * Kilitler kadro seçim ekranında da görünüyor ama orası maça
 * HAZIRLANMA ekranı: mod, zorluk, format, rakip ve kadro aynı sayfada.
 * Oraya bir de koleksiyon dökümü sıkıştırmak ikisini birden
 * okunmaz yapardı. Üstelik farklı bir niyet: koleksiyona maç kurmak
 * için değil, "ne kadar yol aldım" diye bakılıyor.
 *
 * DÖRT SORU
 * ---------
 * Ekran dekoratif olmasın diye dört somut soruya cevap vermek üzere
 * kuruldu; her bölüm bunlardan birine karşılık geliyor:
 *
 *   1. Ne kadar yol aldım?   → üstteki sayaç ve çubuk
 *   2. Sırada ne var?        → hedef satırı ve kalan FP
 *   3. Neyi kaçırıyorum?     → kilitli kartlarda BONUS metni açık
 *   4. Nasıl alırım?         → kartın üstünde satın alma düğmesi
 *
 * Üçüncüsü özellikle önemli: kilitli oyuncunun yeteneğini gizlemek
 * merak değil kayıtsızlık üretiyor. Neyi kaçırdığını GÖREN oyuncu onu
 * istiyor.
 */
export default function CollectionScreen({
  onBack,
  muted,
  onToggleMute,
  ilerleme = { puan: 0, acilanlar: [] },
  onUnlock,
}) {
  const acilanlar = useMemo(() => ilerleme?.acilanlar ?? [], [ilerleme]);
  const puan = ilerleme?.puan ?? 0;

  const ozet = useMemo(() => koleksiyonOzeti(acilanlar), [acilanlar]);
  const gruplar = useMemo(() => kademeGruplari(acilanlar), [acilanlar]);
  const hedef = useMemo(
    () => (FP_ACIK ? sonrakiHedef(puan, acilanlar) : null),
    [puan, acilanlar],
  );

  const satinAl = (id) => {
    Sfx.select();
    onUnlock?.(id);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-4 px-3 pb-10 pt-5 sm:gap-6 sm:px-4 sm:py-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base text-turkiye-red text-outline-red sm:text-xl">
            KOLEKSİYON
          </h2>
          <p className="mt-1 text-[7px] text-white/50 sm:mt-2 sm:text-[8px]">
            {FP_ACIK ? 'KADRONUN TAMAMI · FORMA PUANIYLA AÇILIR' : 'KADRONUN TAMAMI'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button
            type="button"
            className="retro-button-ghost px-3 py-2 text-[8px]"
            onClick={onBack}
          >
            ← GERİ
          </button>
        </div>
      </div>

      {/*
        İlerleme paneli — FP KAPALIYKEN çizilmiyor. Kapalıyken
        "3 / 24 OYUNCU AÇIK" yazmak yalan olurdu: hepsi açık.
      */}
      {FP_ACIK && (
        <div className="retro-panel flex flex-col gap-3 px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-white">
              {ozet.acik}
              <span className="text-white/40"> / {ozet.toplam}</span>
              <span className="ml-2 text-[8px] text-white/45">OYUNCU AÇIK</span>
            </span>
            <span className="text-sm text-retro-accent">
              {puan.toLocaleString('tr-TR')} FP
            </span>
          </div>

          <div className="h-3 w-full border-2 border-white/20 bg-black/40">
            <div
              className="h-full bg-retro-accent transition-[width] duration-700"
              style={{ width: `${Math.round(ozet.oran * 100)}%` }}
            />
          </div>

          {/*
            Tamamlandığında hedef satırı YOK — `sonrakiHedef` null dönüyor.
            Yerine bitiş mesajı, çünkü boş bir alan "bir şey bozuldu" gibi
            okunur.
          */}
          {hedef ? (
            <p className="text-[8px] leading-relaxed text-white/60">
              SIRADAKİ:{' '}
              <span className="text-white/85">
                {upper(getPlayerById(hedef.id)?.name ?? '')}
              </span>
              {' · '}
              {hedef.kalan > 0 ? (
                <span className="text-white/45">{hedef.kalan} FP KALDI</span>
              ) : (
                <span className="text-retro-accent">AÇILMAYA HAZIR</span>
              )}
            </p>
          ) : (
            <p className="text-[8px] text-retro-accent">
              ★ KADRONUN TAMAMI AÇIK ★
            </p>
          )}
        </div>
      )}

      {/* Kademeler */}
      {gruplar.map((grup) => (
        <section key={grup.bedel} className="flex flex-col gap-2 sm:gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-white/10 pb-1">
            <h3 className="text-[9px] tracking-widest text-retro-accent">
              {grup.ad}
            </h3>
            {/* Sayaç yalnız FP açıkken anlamlı: kapalıyken hepsi açık */}
            {FP_ACIK && (
              <span className="text-[7px] text-white/40">
                {grup.acik} / {grup.toplam} AÇIK
              </span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {grup.oyuncular.map((oyuncu) => (
              <OyuncuKarti
                key={oyuncu.id}
                oyuncu={oyuncu}
                acik={kullanilabilir(oyuncu.id, acilanlar)}
                fiyat={bedel(oyuncu.id)}
                puan={puan}
                onAl={satinAl}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Tek oyuncu kartı.
 *
 * Kilitli olan da AÇIK olan kadar bilgi gösteriyor — bonusu, mevkisi,
 * istatistikleri. Kilitliyken saklamak "neyi kaçırıyorum" sorusunu
 * yanıtsız bırakır ve o soru bu ekranın varlık sebebi.
 */
function OyuncuKarti({ oyuncu, acik, fiyat, puan, onAl }) {
  const alinabilir = !acik && puan >= fiyat;

  return (
    <div
      /*
        `data-oyuncu`: tarayıcı testi kartları SAYABİLSİN diye.
        Testte adları metinden okumayı denedim ve seçici istatistik
        etiketlerini de topladı — araç yanlış ölçtü, kod değil. Kimlik
        taşıyan bir kanca, metin desenine bakmaktan hem doğru hem
        kırılgan olmayan bir ölçüm veriyor.
      */
      data-oyuncu={oyuncu.id}
      className={`flex gap-3 border-2 px-3 py-3 transition ${
        acik
          ? 'border-white/25 bg-retro-panel'
          : alinabilir
            ? 'border-[#FFD24A]/70 bg-retro-panel/70'
            : 'border-white/10 bg-black/30'
      }`}
    >
      {/* Kilitli oyuncu SİLÜET değil, soluk — neyi kaçırdığını görsün */}
      <div
        className="shrink-0"
        style={acik ? undefined : { filter: 'grayscale(1) brightness(0.6)', opacity: 0.8 }}
      >
        <PixelAvatar player={oyuncu} scale={2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className={`text-[8px] ${acik ? 'text-white' : 'text-white/55'}`}>
            {upper(oyuncu.name)}
          </span>
          <span className="text-[7px] text-white/35">
            #{oyuncu.number}
            {oyuncu.captain && ' · ★'}
          </span>
        </div>
        <p className="mt-[2px] text-[7px] text-white/40">{oyuncu.position}</p>

        <p
          className="mt-2 border-l-2 pl-2 text-[7px] leading-relaxed"
          style={{ borderColor: oyuncu.colors.accent, color: acik ? '#ffffffb0' : '#ffffff70' }}
        >
          <span style={{ color: oyuncu.colors.accent }}>
            {upper(oyuncu.bonus.name)}
          </span>
          {' — '}
          {oyuncu.bonus.description}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          <StatBar label="SMAÇ" value={oyuncu.stats.attack} compact />
          <StatBar label="BLOK" value={oyuncu.stats.block} compact color="#FFC633" />
          <StatBar label="SAVUNMA" value={oyuncu.stats.defense} compact color="#5FC2E8" />
          <StatBar label="HIZ" value={oyuncu.stats.speed} compact color="#B7F5C6" />
        </div>

        {/* 4) Nasıl alırım */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {acik ? (
            <span className="text-[7px] text-retro-accent">✔ KADRONDA</span>
          ) : (
            <>
              <span
                className={`text-[8px] ${alinabilir ? 'text-[#FFD24A]' : 'text-white/40'}`}
              >
                {fiyat} FP
              </span>
              <button
                type="button"
                className="retro-button px-3 py-1.5 text-[7px] disabled:opacity-40"
                disabled={!alinabilir}
                onClick={() => onAl(oyuncu.id)}
              >
                {alinabilir ? 'AÇ' : `${fiyat - puan} FP EKSİK`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
