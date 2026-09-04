module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  // `portal` build çıktısıdır (minified paket) — dist gibi taranmamalı
  /*
   * `android` ve `ios`: Capacitor yerel projeleri. İçlerinde bizim
   * yazdığımız JS yok — `assets/public` altındaki şey `dist`in bire bir
   * kopyası, yani zaten paketlenmiş kod. Dışlanmazsa lint 116 hatayla
   * düşüyor ve hepsi kendi kaynağımızda olmayan sorunlar.
   */
  ignorePatterns: ['dist', 'portal', 'android', 'ios', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  overrides: [
    {
      files: ['**/*.test.{js,jsx}'],
      env: { node: true },
    },
    {
      // Dağıtım betikleri Node'da çalışır, tarayıcıda değil
      files: ['scripts/**/*.mjs'],
      env: { node: true, browser: false },
    },
    {
      // Röle sunucusu Node'da çalışır; oyunun paketine girmez
      files: ['sunucu/**/*.js'],
      env: { node: true, browser: false },
    },
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // Proje PropTypes kullanmıyor — tipler JSDoc ile belgeleniyor
    'react/prop-types': 'off',

    // Türkçe metinlerde kesme işareti çok sık geçiyor
    // ("Sultanları'na"), JSX içinde kaçırmak okunabilirliği düşürür
    'react/no-unescaped-entities': 'off',
  },
};
