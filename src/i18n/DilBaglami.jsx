/* eslint-disable react-refresh/only-export-components -- sağlayıcı + useDil */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { loadPrefs, savePrefs } from '../utils/storage.js';
import {
  detectBrowserLang,
  setLang as setLangMotor,
  t,
  dilLocale,
  yuzde,
  sayiYazi,
} from './index.js';

const DilContext = createContext({
  lang: 'tr',
  locale: 'tr-TR',
  t,
  changeLang: () => {},
  yuzde,
  sayiYazi,
});

function baslangicDili() {
  const kayit = loadPrefs().lang;
  if (kayit === 'tr' || kayit === 'en') return kayit;
  return detectBrowserLang();
}

/**
 * Dil sağlayıcı — App'i sarar. `changeLang` tercihe yazar, motoru
 * günceller, abone ekranları yeniler.
 */
export function DilSaglayici({ children }) {
  const [lang, setLangState] = useState(() => {
    const kod = baslangicDili();
    setLangMotor(kod, { silent: true });
    if (typeof document !== 'undefined') document.documentElement.lang = kod;
    /*
     * İlk ziyarette tarayıcı dilini kalıcı yaz: yoksa her açılışta
     * `navigator.language` yeniden okunur ve oyuncu dil tuşuna
     * basmadan dil "kayar".
     */
    const kayit = loadPrefs();
    if (kayit.lang !== kod) savePrefs({ lang: kod });
    return kod;
  });

  const changeLang = useCallback((next) => {
    const kod = setLangMotor(next);
    savePrefs({ lang: kod });
    setLangState(kod);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      locale: dilLocale(lang),
      t,
      changeLang,
      yuzde,
      sayiYazi,
    }),
    [lang, changeLang],
  );

  return <DilContext.Provider value={value}>{children}</DilContext.Provider>;
}

export function useDil() {
  return useContext(DilContext);
}
