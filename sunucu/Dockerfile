# Röle sunucusu — konteyner imajı.
#
# DİKKAT: yapı bağlamı depo KÖKÜ, `sunucu/` değil. Sunucu maçı kendisi
# koşturduğu için oyun motorunu (`src/game/`) içe aktarıyor; bağlam
# yalnız `sunucu/` olsaydı o dosyalar imaja hiç girmezdi.
#
#   docker build -f sunucu/Dockerfile .        (kökten)
#   docker compose up -d --build               (sunucu/ içinden, compose halleder)

FROM node:20-alpine

WORKDIR /app

# Bağımlılıklar önce: kaynak değişince npm katmanı önbellekten gelsin
COPY sunucu/package.json sunucu/package-lock.json ./sunucu/
RUN cd sunucu && npm ci --omit=dev

# Sunucu ve motorun ihtiyaç duyduğu oyun kaynağı.
# `src/utils` de gerekli: motor Türkçe metin yardımcılarını oradan alıyor.
COPY sunucu/ ./sunucu/
COPY src/game/ ./src/game/
COPY src/utils/ ./src/utils/

WORKDIR /app/sunucu

# DAĞITIM DAMGASI.
#
# İmajın içinde git yok, olsun da istemiyoruz (depoyu imaja koymak
# demekti). Damga dışarıdan yapı argümanı olarak geliyor ve `/saglik`
# onu yayınlıyor. Sebebi yaşanmış bir kafa karışıklığı: istemci
# Vercel'den kendiliğinden güncelleniyor, röle elle dağıtılıyor ve
# ikisi ayrı sürümdeyken belirti "düzeltme işe yaramadı" oluyordu.
#
# `docker compose up -d --build` bunu kendisi geçiriyor (compose'daki
# `args`), elle yapı için:
#   docker build -f sunucu/Dockerfile --build-arg SURUM=$(git rev-parse --short HEAD) .
ARG SURUM=bilinmiyor
ENV SURUM=$SURUM

# fly.toml / docker-compose ile aynı olmalı
ENV PORT=8787
EXPOSE 8787

# Alpine'da PID 1 sinyalleri iletmiyor; tini olmadan dağıtım sırasında
# eski makine SIGTERM'i yiyip zorla kapatılmayı bekliyor ve devam eden
# maçlar o süre boyunca yarım kalıyor.
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "index.js"]
