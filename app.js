(() => {
  const STORE_KEY = 'maus-demo-v1';
  const defaults = [
    { name: 'Chief of Staff', role: 'Assistente pessoal', icon: '✳', model: 'Claude Sonnet', color: 'purple', greeting: 'Bom dia, Alex! ☀️\n\nPosso ajudar a organizar seu dia, preparar reuniões e acompanhar suas prioridades. O que vamos fazer?' },
    { name: 'Researcher', role: 'Pesquisa e análise', icon: '✦', model: 'Claude Sonnet', color: 'green', greeting: 'Oi! Posso pesquisar um tema, comparar opções e preparar um resumo claro com os principais pontos. O que você quer descobrir?' },
    { name: 'Code buddy', role: 'Programação', icon: '⌘', model: 'Codex', color: 'yellow', greeting: 'Pronto para programar! Posso ajudar a entender código, encontrar bugs ou pensar numa implementação. Qual é o desafio?' },
    { name: 'Writer', role: 'Escrita e conteúdo', icon: '✎', model: 'Claude Sonnet', color: 'pink', greeting: 'Olá! Posso ajudar a escrever, revisar e ajustar o tom de qualquer texto. O que você está preparando?' }
  ];
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { saved = {}; }
  const bots = Array.isArray(saved.bots) && saved.bots.length ? saved.bots : defaults;
  let conversations = saved.conversations && typeof saved.conversations === 'object' ? saved.conversations : {};
  let active = Math.min(Number(saved.active) || 0, bots.length - 1);
  const botList = $('#botList');
  const messages = $('#messages');
  const input = $('#messageInput');
  const toastEl = $('#toast');
  const responseQueues = new WeakMap();
  let toastTimer;

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ bots, conversations, active })); } catch { toast('Não foi possível salvar neste navegador.'); }
  }
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  function historyFor(bot) {
    if (!conversations[bot.name]) conversations[bot.name] = [{ from: 'bot', text: bot.greeting, time: 'agora' }];
    return conversations[bot.name];
  }
  function renderBots() {
    botList.innerHTML = '';
    bots.forEach((bot, index) => {
      const item = document.createElement('button');
      item.className = `bot-item${index === active ? ' active' : ''}`;
      item.innerHTML = `<span class="bot-avatar ${bot.color}">${escapeHtml(bot.icon)}</span><span><b>${escapeHtml(bot.name)}</b><small>${escapeHtml(bot.role)}</small></span>`;
      item.addEventListener('click', () => selectBot(index));
      botList.append(item);
    });
    $('#statChats').textContent = bots.length;
    $('#statMessages').textContent = Object.values(conversations).flat().filter((message) => message.from === 'user').length;
  }
  function renderMessages() {
    const bot = bots[active];
    messages.innerHTML = '<div class="date-divider">CONVERSA LOCAL</div>';
    historyFor(bot).forEach((message) => {
      if (message.from === 'user') {
        const row = document.createElement('div');
        row.className = 'user-msg';
        row.innerHTML = `<div class="bubble">${escapeHtml(message.text).replace(/\n/g, '<br>')}</div>`;
        messages.append(row);
      } else {
        const row = document.createElement('div');
        row.className = 'assistant-msg';
        row.innerHTML = `<div class="bot-avatar small ${bot.color}">${escapeHtml(bot.icon)}</div><div class="bubble-wrap"><div class="msg-label">${escapeHtml(bot.name)} <span>${escapeHtml(message.time || 'agora')}</span></div><div class="bubble">${escapeHtml(message.text).replace(/\n/g, '<br>')}</div><div class="msg-tools"><button type="button" data-copy="${escapeHtml(message.text)}" title="Copiar resposta">⧉</button><button type="button" data-like title="Marcar como útil">♡</button></div></div>`;
        messages.append(row);
      }
    });
    if (historyFor(bot).length === 1) {
      const suggestions = document.createElement('div');
      suggestions.className = 'quick-prompts';
      suggestions.innerHTML = '<button data-prompt="Me ajude a organizar meu dia">✦ Organizar meu dia</button><button data-prompt="Faça um resumo desse assunto">▤ Criar um resumo</button><button data-prompt="O que você pode fazer por mim?">＋ Ver sugestões</button>';
      messages.append(suggestions);
    }
    messages.scrollTop = messages.scrollHeight;
  }
  function selectBot(index) {
    active = index;
    const bot = bots[active];
    $('#activeAvatar').textContent = bot.icon;
    $('#activeAvatar').className = `bot-avatar ${bot.color}`;
    $('#activeName').textContent = bot.name;
    $('#activeModel').textContent = `${bot.model} · conectando…`;
    input.placeholder = `Envie uma mensagem para ${bot.name}…`;
    renderBots();
    renderMessages();
    save();
  }
  function respond(text) {
    const bot = bots[active];
    const history = historyFor(bot);
    const userMessage = { from: 'user', text, time: 'agora' };
    history.push(userMessage);
    renderMessages();
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.textContent = `${bot.name} está pensando…`;
    messages.append(typing);
    messages.scrollTop = messages.scrollHeight;
    const previousRequest = responseQueues.get(bot) || Promise.resolve();
    const request = previousRequest.catch(() => {}).then(async () => {
      const userIndex = history.indexOf(userMessage);
      const requestHistory = history.slice(0, userIndex).map(({ from, text: message }) => ({ from, text: message }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot: bot.name, role: bot.role, message: text, history: requestHistory })
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('O servidor retornou uma resposta inválida.'); }
      if (!response.ok) throw new Error(data.error || 'O agente não conseguiu responder.');
      history.splice(history.indexOf(userMessage) + 1, 0, { from: 'bot', text: data.reply, time: 'agora' });
      if (bots[active] === bot) {
        $('#activeModel').textContent = `${bot.model} · ${data.engine} conectado`;
        $('#agentStatus').textContent = `${data.engine} conectado · somente leitura`;
      }
    }).catch((error) => {
      history.splice(history.indexOf(userMessage) + 1, 0, { from: 'bot', text: `Não consegui falar com o agente real. ${error.message} Verifique se o servidor local está rodando e se o CLI está instalado e autenticado.`, time: 'agora' });
      if (bots[active] === bot) {
        $('#activeModel').textContent = `${bot.model} · agente desconectado`;
        $('#agentStatus').textContent = 'CLI local desconectado';
      }
    });
    const queuedRequest = request.finally(() => {
      typing.remove();
      renderMessages();
      renderBots();
      save();
    });
    responseQueues.set(bot, queuedRequest);
    renderBots();
    save();
  }
  function openBotDialog() {
    $('#botDialog').showModal();
    setTimeout(() => $('#botNameInput').focus(), 80);
  }

  $('#chatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    respond(text);
    input.value = '';
  });
  messages.addEventListener('click', async (event) => {
    const prompt = event.target.closest('[data-prompt]');
    if (prompt) respond(prompt.dataset.prompt);
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Resposta copiada.'); }
      catch { toast('Seu navegador não permitiu copiar a resposta.'); }
    }
    if (event.target.closest('[data-like]')) toast('Obrigado pelo feedback.');
  });
  $('#newBot').addEventListener('click', openBotDialog);
  $('#newBotTop').addEventListener('click', () => { $('#workspace').scrollIntoView({ behavior: 'smooth' }); setTimeout(openBotDialog, 450); });
  $('#botForm').addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'create') return;
    event.preventDefault();
    const name = $('#botNameInput').value.trim();
    if (!name) return;
    if (bots.some((bot) => bot.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast('Já existe um bot com esse nome.'); return; }
    const role = $('#botRole').value;
    const icon = role.includes('Pesquisa') ? '✦' : role.includes('Programação') ? '⌘' : role.includes('Escrita') ? '✎' : role.includes('Planejamento') ? '◷' : '✳';
    const color = ['purple', 'green', 'yellow', 'pink'][bots.length % 4];
    const personality = $('#botPersonality').value.trim();
    bots.push({ name, role, icon, color, model: role === 'Programação' ? 'Codex' : 'Claude Sonnet', greeting: `Olá! Sou ${name}, seu novo bot para ${role.toLocaleLowerCase('pt-BR')}. ${personality || 'Como posso ajudar você hoje?'}` });
    $('#botDialog').close();
    $('#botForm').reset();
    selectBot(bots.length - 1);
    toast(`${name} foi adicionado ao seu time`);
  });
  $('#attach').addEventListener('click', () => toast('Anexos precisam de uma integração com arquivos.'));
  $('#settings').addEventListener('click', () => toast('Esta demonstração salva bots e conversas apenas neste navegador.'));
  $('#approvalInfo').addEventListener('click', () => toast('No OpenMausBot, ações importantes podem pedir sua aprovação antes de serem executadas.'));
  document.querySelectorAll('.tool-row').forEach((button) => button.addEventListener('click', () => toast(`${button.dataset.panel}: disponível após conectar um agente.`)));
  $('.activity-head button').addEventListener('click', () => { renderBots(); toast('Resumo atualizado.'); });
  fetch('/api/status').then((response) => response.json()).then((status) => {
    $('#activeModel').textContent = status.available ? `${bots[active].model} · ${status.engine} pronto, somente leitura` : `${bots[active].model} · CLI ${status.engine} indisponível`;
    $('#agentStatus').textContent = status.available ? `${status.engine} pronto · somente leitura` : `instale o CLI ${status.engine}`;
  }).catch(() => {
    $('#activeModel').textContent = `${bots[active].model} · servidor do agente desconectado`;
    $('#agentStatus').textContent = 'servidor local não iniciado';
  });
  $('.head-actions button:first-child').addEventListener('click', () => {
    const query = window.prompt('Buscar nesta conversa:');
    if (!query) return;
    const match = [...messages.querySelectorAll('.bubble')].find((bubble) => bubble.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (match) { match.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Mensagem encontrada.'); }
    else toast('Nenhuma mensagem encontrada.');
  });
  $('.head-actions button:last-child').addEventListener('click', () => {
    const bot = bots[active];
    if (bots.length === 1) { toast('Mantenha pelo menos um bot no seu time.'); return; }
    if (!window.confirm(`Remover ${bot.name} e a conversa salva neste navegador?`)) return;
    bots.splice(active, 1);
    delete conversations[bot.name];
    selectBot(Math.max(0, active - 1));
    toast(`${bot.name} foi removido.`);
  });
  renderBots();
  selectBot(active);
})();
