# Röle sunucusu — Fly.io imajı.
#
# Yapı bağlamı `sunucu/` dizinidir; oyunun kendisi bu imaja girmez.
# Röle oyunu bilmediği için (mesajları ham metin olarak taşıyor) oyun
# değiştiğinde bu imajı yeniden dağıtmak gerekmiyor.

FROM node:20-alpine

WORKDIR /app

# Bağımlılıklar önce: kaynak değişince npm katmanı önbellekten gelsin
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# fly.toml'daki internal_port ile aynı olmalı
ENV PORT=8787
EXPOSE 8787

# Alpine'da PID 1 sinyalleri iletmiyor; tini olmadan `fly deploy`
# sırasında eski makine SIGTERM'i yiyip 30 sn zorla kapatılmayı
# bekliyor ve devam eden maçlar o süre boyunca yarım kalıyor.
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "index.js"]
