#!/usr/bin/env bash
#
# Instala o Inventario GER como servico no PC do GER (Linux com systemd).
# Rode a partir da raiz do projeto:  sudo bash deploy/instalar-linux.sh
#
set -euo pipefail

DESTINO="${DESTINO:-/opt/ger-inventario}"
USUARIO="${USUARIO:-$(logname 2>/dev/null || echo "$SUDO_USER")}"
SERVICO="ger-inventario"

if [[ $EUID -ne 0 ]]; then
  echo "Rode com sudo: sudo bash deploy/instalar-linux.sh" >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "Rode a partir da raiz do projeto (onde esta o package.json)." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Falta o arquivo .env. Copie o .env.example e preencha antes." >&2
  exit 1
fi

echo "==> Copiando o projeto para ${DESTINO}"
mkdir -p "${DESTINO}"
# node_modules e .next sao refeitos no destino; nao vale a pena copiar.
tar --exclude=node_modules --exclude=.next --exclude=.git -cf - . \
  | tar -xf - -C "${DESTINO}"

echo "==> Instalando dependencias e compilando"
cd "${DESTINO}"
npm ci --omit=dev 2>/dev/null || npm install
npm install --include=dev --no-save >/dev/null
npm run build
# Depois do build as dependencias de desenvolvimento nao fazem mais falta,
# mas tsx e usado pelos scripts de planilha e etiqueta, entao ficam.

echo "==> Ajustando permissoes para o usuario ${USUARIO}"
chown -R "${USUARIO}":"${USUARIO}" "${DESTINO}"
chmod 600 "${DESTINO}/.env"

echo "==> Instalando o servico systemd"
sed -e "s|^User=.*|User=${USUARIO}|" \
    -e "s|^WorkingDirectory=.*|WorkingDirectory=${DESTINO}|" \
    -e "s|^EnvironmentFile=.*|EnvironmentFile=${DESTINO}/.env|" \
    -e "s|^ReadWritePaths=.*|ReadWritePaths=${DESTINO}/.next|" \
    deploy/${SERVICO}.service > "/etc/systemd/system/${SERVICO}.service"

systemctl daemon-reload
systemctl enable "${SERVICO}"
systemctl restart "${SERVICO}"

sleep 3
systemctl --no-pager status "${SERVICO}" || true

cat <<FIM

================================================================
Pronto. O inventario sobe sozinho sempre que o PC ligar.

  Acesse:    http://localhost:3939
  Status:    systemctl status ${SERVICO}
  Logs:      journalctl -u ${SERVICO} -f
  Reiniciar: sudo systemctl restart ${SERVICO}

Se a pagina acusar erro de conexao com a planilha, confira se ela
foi compartilhada como Editor com o e-mail da service account.
================================================================
FIM
