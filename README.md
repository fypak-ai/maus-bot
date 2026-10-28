# Maus — interface de demonstração

Uma interface web responsiva inspirada no OpenMausBot. Permite criar/remover bots e guardar conversas no navegador. O servidor encaminha mensagens ao Codex CLI local em modo somente leitura.

## Iniciar

```bash
cd /data/home/openmausbot-site
node server.js
```

Abra http://localhost:4173. O servidor usa `PORT` e `HOST` do ambiente quando definidos. O Codex CLI deve estar instalado e autenticado com `codex login`.

Para usar Claude Code em vez de Codex: `OPENMAUSBOT_ENGINE=claude node server.js`. O CLI escolhido precisa estar instalado e autenticado. O agente roda sem ferramentas de escrita; este bridge responde a mensagens e não executa ações externas.

Se a sandbox bloquear portas locais, abrir `index.html` diretamente só mostra a interface; a conexão real precisa do servidor HTTP, pois navegadores não permitem chamadas locais a partir de arquivos. Este bridge não substitui o harness completo do OpenMausBot e não inclui o código original.
