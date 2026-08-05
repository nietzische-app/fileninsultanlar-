import { Component } from 'react';

/**
 * Yakalanmamış React hatalarında boş ekran yerine
 * yeniden yükleme yolu sunar.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Bilinmeyen hata' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <h1 className="text-xl text-turkiye-red text-outline-red sm:text-3xl">
          BİR ŞEYLER TERS GİTTİ
        </h1>
        <p className="max-w-md text-[9px] leading-relaxed text-white/55 sm:text-[10px]">
          {this.state.message}
        </p>
        <button
          type="button"
          className="retro-button px-8 py-4"
          onClick={() => window.location.reload()}
        >
          YENİDEN YÜKLE
        </button>
      </div>
    );
  }
}
