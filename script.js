// Elementos DOM
const messageEditor = document.getElementById('messageEditor');
const includeClockCheckbox = document.getElementById('includeClock');
const historyList = document.getElementById('historyList');
const announcementDisplay = document.getElementById('announcementDisplay');
const announcementText = document.getElementById('announcementText');
const announcementClock = document.getElementById('announcementClock');
const generateBtn = document.getElementById('generateBtn');
const saveBtn = document.getElementById('saveBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const closeBtn = document.getElementById('closeBtn');
const toolbarButtons = document.querySelectorAll('.toolbar button');

// Variáveis
let clockInterval = null;
let isFullscreen = false;
// Offset em ms entre hora do servidor público e hora local (serverTime = Date.now() + serverTimeOffset)
let serverTimeOffset = 0;
// Endpoint público (WorldTimeAPI - usa IP do cliente para determinar timezone)
const PUBLIC_TIME_ENDPOINT = 'https://worldtimeapi.org/api/ip';

// Carregar histórico do localStorage ao iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadHistory();
    
    // Adicionar event listeners
    generateBtn.addEventListener('click', generateAnnouncement);
    saveBtn.addEventListener('click', saveToHistory);
    clearHistoryBtn.addEventListener('click', clearAllHistory);
    closeBtn.addEventListener('click', closeAnnouncement);
    
    // Adicionar event listeners para os botões da toolbar
    toolbarButtons.forEach(button => {
        button.addEventListener('click', function() {
            const command = this.getAttribute('data-command');
            formatText(command);
        });
    });
    
    // Event listener para detectar saída do modo tela cheia
    document.addEventListener('fullscreenchange', exitHandler);
    document.addEventListener('webkitfullscreenchange', exitHandler);
    document.addEventListener('mozfullscreenchange', exitHandler);
    document.addEventListener('MSFullscreenChange', exitHandler);
});

// Funções de formatação de texto
function formatText(command) {
    document.execCommand(command, false, null);
    messageEditor.focus();
}

// ---------- Clock / Sincronização com servidor público ----------

// Tenta buscar hora pública (WorldTimeAPI).
// Aguarda JSON com campo 'datetime' (ISO). Retorna { success: boolean, serverNow: Date | null }
async function fetchPublicTime() {
    try {
        const res = await fetch(PUBLIC_TIME_ENDPOINT, { cache: 'no-store' });
        if (!res.ok) throw new Error('Resposta não OK: ' + res.status);
        const data = await res.json();
        // WorldTimeAPI devolve 'datetime' (ISO) e também 'unixtime'
        // Checamos 'datetime' primeiro; se não existir, tentamos 'unixtime'
        if (data && data.datetime) {
            const serverNow = new Date(data.datetime);
            if (isNaN(serverNow.getTime())) throw new Error('datetime inválido');
            return { success: true, serverNow };
        } else if (data && typeof data.unixtime === 'number') {
            // unixtime é em segundos
            return { success: true, serverNow: new Date(data.unixtime * 1000) };
        } else {
            throw new Error('Resposta sem campos de tempo válidos');
        }
    } catch (err) {
        console.warn('Não foi possível obter hora pública:', err);
        return { success: false, serverNow: null };
    }
}

// Inicia ou reinicia o relógio exibido.
// Se includeClock for false, garante que o clock foi parado e escondido.
// Se true: tenta sincronizar com servidor público; caso falhe, usa hora local.
// Sempre limpa qualquer intervalo anterior antes de criar outro.
async function startClock(includeClock) {
    // Limpa intervalo anterior se existir
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }

    if (!includeClock) {
        announcementClock.style.display = 'none';
        serverTimeOffset = 0; // reset offset
        return;
    }

    // Mostra imediatamente (evita "piscar")
    announcementClock.style.display = 'block';

    // Tenta buscar hora pública e calcular offset
    const result = await fetchPublicTime();
    if (result.success && result.serverNow) {
        const clientNow = new Date();
        serverTimeOffset = result.serverNow.getTime() - clientNow.getTime();
        updateClock();
        // Garante que não criamos múltiplos intervals
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateClock, 1000);
    } else {
        // fallback para hora local (offset = 0)
        serverTimeOffset = 0;
        updateClock();
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateClock, 1000);
    }
}

// Atualizar relógio (usa serverTimeOffset se disponível)
function updateClock() {
    const now = new Date(Date.now() + serverTimeOffset);
    const timeString = now.toLocaleTimeString('pt-BR');
    announcementClock.textContent = timeString;
}

// Retorna um objeto Date representando "agora" considerando o offset.
// Útil para salvar timestamps sincronizados.
function nowWithOffset() {
    return new Date(Date.now() + serverTimeOffset);
}

// ---------- Geração / Exibição / Fechamento de aviso ----------

function generateAnnouncement() {
    const content = messageEditor.innerHTML;
    if (!content.trim()) {
        alert('Por favor, digite uma mensagem antes de gerar o aviso.');
        return;
    }
    
    // Salvar automaticamente no histórico (silent = true para não mostrar alerta)
    saveToHistory(true);
    
    announcementText.innerHTML = content;
    
    if (includeClockCheckbox.checked) {
        // Inicia o clock (tenta servidor público e, se não, usa local)
        startClock(true);
    } else {
        startClock(false);
    }
    
    // Entrar em modo tela cheia
    openFullscreen();
    
    announcementDisplay.style.display = 'flex';
    document.body.classList.add('fullscreen-mode');
}

// Abrir tela cheia
function openFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
    
    isFullscreen = true;
}

// Fechar aviso
function closeAnnouncement() {
    // Sair do modo tela cheia se estiver ativo
    if (isFullscreen) {
        closeFullscreen();
    }
    
    announcementDisplay.style.display = 'none';
    document.body.classList.remove('fullscreen-mode');
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

// Sair do modo tela cheia
function closeFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    isFullscreen = false;
}

// Manipulador para quando o usuário sai do modo tela cheia
function exitHandler() {
    // Compatibilidade com vários navegadores
    const fs = document.fullscreenElement || document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement;
    if (!fs) {
        isFullscreen = false;
        announcementDisplay.style.display = 'none';
        document.body.classList.remove('fullscreen-mode');
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
    }
}

// ---------- Histórico (salvar / carregar / excluir) ----------

// Salvar no histórico
// se silent === true não mostra alert de sucesso
function saveToHistory(silent = false) {
    const content = messageEditor.innerHTML;
    if (!content.trim()) {
        if (!silent) {
            alert('Por favor, digite uma mensagem antes de salvar.');
        }
        return;
    }
    
    const includeClock = includeClockCheckbox.checked;
    // Usa agora com offset (serverTimeOffset) se houver
    const timestamp = nowWithOffset().toLocaleString('pt-BR');
    
    // Recuperar histórico atual
    let history = JSON.parse(localStorage.getItem('announcementHistory')) || [];
    
    // Adicionar novo item
    history.unshift({
        content: content,
        includeClock: includeClock,
        timestamp: timestamp,
        id: Date.now() // ID único baseado no timestamp local (ok para a maioria dos casos)
    });
    
    // Salvar no localStorage
    localStorage.setItem('announcementHistory', JSON.stringify(history));
    
    // Atualizar a exibição
    loadHistory();
    
    if (!silent) {
        alert('Aviso salvo no histórico com sucesso!');
    }
}

// Carregar histórico
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('announcementHistory')) || [];
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">Nenhum aviso salvo no histórico</div>';
        return;
    }
    
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-content">
                <div class="history-date">${item.timestamp}</div>
                <div class="history-text">${item.content}</div>
                <div class="history-meta">${item.includeClock ? 'Com relógio' : 'Sem relógio'}</div>
            </div>
            <div class="history-actions">
                <button onclick="replayAnnouncement(${item.id})" title="Reproduzir">▶️</button>
                <button onclick="deleteAnnouncement(${item.id})" title="Excluir">🗑️</button>
            </div>
        `;
        historyList.appendChild(historyItem);
    });
}

// Reproduzir aviso do histórico
function replayAnnouncement(id) {
    const history = JSON.parse(localStorage.getItem('announcementHistory')) || [];
    const item = history.find(i => i.id === id);
    
    if (item) {
        announcementText.innerHTML = item.content;
        
        if (item.includeClock) {
            // Inicia clock (tentará sincronizar)
            startClock(true);
        } else {
            startClock(false);
        }
        
        // Entrar em modo tela cheia
        openFullscreen();
        
        announcementDisplay.style.display = 'flex';
        document.body.classList.add('fullscreen-mode');
    }
}

// Excluir aviso do histórico
function deleteAnnouncement(id) {
    if (!confirm('Tem certeza que deseja excluir este aviso do histórico?')) {
        return;
    }
    
    let history = JSON.parse(localStorage.getItem('announcementHistory')) || [];
    history = history.filter(item => item.id !== id);
    localStorage.setItem('announcementHistory', JSON.stringify(history));
    loadHistory();
}

// Limpar todo o histórico
function clearAllHistory() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    localStorage.removeItem('announcementHistory');
    loadHistory();
}