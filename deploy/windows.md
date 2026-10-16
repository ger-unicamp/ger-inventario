# Rodar como serviço no Windows

Se o PC do GER for Windows, o systemd não existe. Duas opções, em ordem de preferência.

## Opção A — NSSM (serviço de verdade, sobe sem ninguém logar)

[NSSM](https://nssm.cc/download) é um utilitário pequeno que transforma qualquer programa em serviço do Windows.

1. Faça o build uma vez, no PowerShell, dentro da pasta do projeto:

   ```powershell
   npm install
   npm run build
   ```

2. Descubra o caminho do Node:

   ```powershell
   (Get-Command node).Source
   ```

3. Baixe o NSSM, extraia, e no PowerShell **como administrador**:

   ```powershell
   .\nssm.exe install InventarioGER
   ```

   Na janela que abre:

   - **Path**: o caminho do `node.exe` do passo 2
   - **Startup directory**: a pasta do projeto (ex.: `C:\ger-inventario`)
   - **Arguments**: `node_modules\next\dist\bin\next start -p 3939 -H 127.0.0.1`
   - Aba **Details** → **Startup type**: `Automatic`
   - Aba **Exit actions** → **Restart**: deixe no padrão (reinicia sozinho se cair)

4. Inicie:

   ```powershell
   .\nssm.exe start InventarioGER
   ```

Comandos úteis depois: `nssm restart InventarioGER`, `nssm stop InventarioGER`, `nssm remove InventarioGER confirm`.

## Opção B — Agendador de Tarefas (mais simples, exige login)

Só vale se o PC do GER fizer login automático em uma conta.

1. Crie `iniciar.bat` na pasta do projeto:

   ```bat
   @echo off
   cd /d "%~dp0"
   npm run start
   ```

2. Abra o Agendador de Tarefas → **Criar Tarefa**:
   - **Disparador**: Ao fazer logon
   - **Ação**: iniciar o `iniciar.bat`
   - **Configurações**: marque "Se a tarefa falhar, reiniciar a cada 1 minuto"

## Variáveis de ambiente

Nos dois casos o arquivo `.env` na raiz do projeto é lido normalmente pelo Next.js — não precisa definir variáveis no Windows.

Guarde o `.env` fora de qualquer pasta sincronizada com nuvem ou com o Git: ele contém a chave privada da service account.
