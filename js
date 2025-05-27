// --- Constantes e Variáveis Globais ---
const USER_API_KEY = ""; // API Key will be injected at runtime
const KNOWN_STATES_LIST = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const LOCAL_STORAGE_KEY = 'painelLeadsData_v22_gemini_comp_nurt'; // Incremented version
const STATUS_LEAD_OPTIONS = [ {value: "", text: "---"}, {value: "A Contatar", text: "A Contatar 📞"}, {value: "Contato Feito", text: "Contato Feito 👋"}, {value: "Qualificado", text: "Qualificado 👍"}, {value: "Não Qualificado", text: "Não Qualificado 👎"}, {value: "Sem Interesse", text: "Sem Interesse 🚫"}, {value: "Agendado", text: "Agendado 🗓️"}, {value: "Convertido", text: "Convertido ⭐"}, {value: "Perdido", text: "Perdido 🏳️"} ];
const FUNNEL_STAGES = STATUS_LEAD_OPTIONS.filter(option => option.value !== "" && option.value !== "Convertido" && option.value !== "Perdido");
const FIRST_FUNNEL_STAGE = FUNNEL_STAGES.length > 0 ? FUNNEL_STAGES[0].value : "A Contatar";
const FEZ_CONTATO_OPTIONS = [{value: "", text: "---"}, {value: "Sim", text: "Sim ✅"}, {value: "Não", text: "Não ❌"}];
const REUNIAO_AGENDADA_OPTIONS = [{value: "", text: "---"}, {value: "Sim", text: "Sim ✅"}, {value: "Não", text: "Não ❌"}];
const TEMPERATURA_LEAD_OPTIONS = [ {value: "", text: "---"}, {value: "Quente", text: "Quente 🔥"}, {value: "Morno", text: "Morno ☀️"}, {value: "Frio", text: "Frio ❄️"} ];
const TASK_TYPES_OPTIONS = ["", "LIGAÇÃO", "EMAIL", "REUNIÃO", "FOLLOW-UP", "OUTRO"].map(v => ({value: v, text: v || "---"}));
const TASK_RESPONSES_OPTIONS = ["", "INTERESSADO", "NÃO INTERESSADO", "SEM RESPOSTA", "AGENDADO", "REAGENDAR", "OUTRO"].map(v => ({value: v, text: v || "---"}));
const LEAD_ORIGIN_OPTIONS = ["Prospecção Ativa", "Indicação", "Evento", "Website", "Mídia Social", "Outro"];
const CAR_BRANDS = ["", "Chevrolet", "Volkswagen", "Fiat", "Ford", "Hyundai", "Toyota", "Honda", "Renault", "Jeep", "Nissan", "Peugeot", "Citroën", "Mitsubishi", "Mercedes-Benz", "BMW", "Audi", "Kia", "Land Rover", "Volvo", "Outra"].map(b => ({value: b, text: b || "---"}));
const LEAD_POSITIONS = ["", "Proprietário(a)", "Sócio(a)", "Diretor(a) Comercial", "Gerente de Vendas", "Gerente Geral", "Comprador(a)", "Consultor(a) de Vendas", "Analista de Marketing", "Outro"].map(p => ({value: p, text: p || "---"}));
const MOTIVOS_PERDA_OPTIONS = ["", "Preço", "Concorrência", "Sem Interesse no Momento", "Falta de Orçamento", "Não Responde", "Decisão Adiada", "Outro"].map(m => ({value: m, text: m || "---"}));


let allLeads = [];
let backupIntervalId = null;
let currentLeadIdToEnrich = null;
let currentLeadIdForInteraction = null;
let currentLeadIdForNextTask = null;
let currentLeadIdForEdit = null;
let currentLeadIdForScript = null;
let interactionHistory = [];
let leadToDeleteId = null; // For delete confirmation

const DOM = {}; // Object to store DOM element references

// --- Utility Functions ---
function formatPhoneNumber(phone) {
    if (!phone) return "";
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match8 = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
    const match9 = cleaned.match(/^(\d{2})(\d{1})(\d{4})(\d{4})$/);
    if (match9) {
        return `(${match9[1]}) ${match9[2]} ${match9[3]}-${match9[4]}`;
    }
    if (match8){
        return `(${match8[1]}) ${match8[2]}-${match8[3]}`;
    }
    return phone;
}

function formatEmail(email) {
    if (!email) return "";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return email.toLowerCase();
    }
    return email;
}

function formatWebsite(url) {
    if (!url) return "";
    if (!/^https?:\/\//i.test(url)) {
        return 'http://' + url;
    }
    return url;
}

function calculateLeadScore(lead) {
    let score = 0;
    if (!lead) return 0;
    const weights = {
        nome_empresa: 5, marca: 3, contato_nome: 10, contato_cargo: 8, endereco: 5, cidade: 3, estado: 3,
        telefone1: 10, email: 10, linkedin_contato: 7, site: 5, fez_contato_sim: 5, status_qualificado: 10,
        status_agendado: 15, temperatura_quente: 10, temperatura_morno: 5, reuniao_agendada_sim: 15,
        origem_indicacao: 8, origem_website: 6, pdv_bonus: 2
    };
    if (lead.nome_empresa) score += weights.nome_empresa;
    if (lead.marca && lead.marca !== "---") score += weights.marca;
    if (lead.contato_nome) score += weights.contato_nome;
    if (lead.contato_cargo && lead.contato_cargo !== "---" && lead.contato_cargo !== "Outro") score += weights.contato_cargo;
    if (lead.endereco) score += weights.endereco;
    if (lead.cidade) score += weights.cidade;
    if (lead.estado && lead.estado !== "---") score += weights.estado;
    if (lead.telefone1) score += weights.telefone1;
    if (lead.email) score += weights.email;
    if (lead.linkedin_contato) score += weights.linkedin_contato;
    if (lead.site) score += weights.site;
    if (lead.fez_contato === "Sim") score += weights.fez_contato_sim;
    if (lead.status_lead === "Qualificado") score += weights.status_qualificado;
    if (lead.status_lead === "Agendado") score += weights.status_agendado;
    if (lead.temperatura_lead === "Quente") score += weights.temperatura_quente;
    if (lead.temperatura_lead === "Morno") score += weights.temperatura_morno;
    if (lead.reuniao_agendada === "Sim") score += weights.reuniao_agendada_sim;
    if (lead.origem_lead === "Indicação") score += weights.origem_indicacao;
    if (lead.origem_lead === "Website") score += weights.origem_website;
    if (lead.pdv && parseInt(lead.pdv) > 1) {
        score += (parseInt(lead.pdv) -1) * weights.pdv_bonus;
    }
    if (lead.status_lead === "Não Qualificado" || lead.status_lead === "Sem Interesse" || lead.status_lead === "Perdido") {
        score = Math.max(0, score - 20);
    }
    return Math.min(100, Math.max(0, score));
}

function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function showToast(message, duration = 3000, type = 'success') {
    const container = DOM.toastContainer;
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('visible'); }, 50);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => { if (toast.parentNode === container) { container.removeChild(toast);}}, 300);
    }, duration);
}

function showLoading(show) {
    if (DOM.loadingOverlay) {
        DOM.loadingOverlay.classList.toggle('visible', show);
    }
}
function populateSelectWithOptions(selectElement, optionsArray, includeEmptyFirst = true) {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    if (includeEmptyFirst && optionsArray.every(opt => opt.value !== "")) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = "";
        emptyOpt.textContent = "---";
        selectElement.appendChild(emptyOpt);
    }
    optionsArray.forEach(optData => {
        if(optData.value === "" && !includeEmptyFirst && selectElement.options.length > 0) return;
        const option = document.createElement('option');
        option.value = optData.value;
        option.textContent = optData.text;
        selectElement.appendChild(option);
    });
}

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    DOM.mainTableBody = document.querySelector('#leadsTable tbody');
    DOM.leadsTable = document.getElementById('leadsTable');
    DOM.filterNomeInput = document.getElementById('filterNome');
    DOM.filterEstadoSelect = document.getElementById('filterEstado');
    DOM.filterStatusSelect = document.getElementById('filterStatus');
    DOM.clearFiltersButton = document.getElementById('clearFilters');
    DOM.rowCountDisplay = document.getElementById('rowCount');
    DOM.dashboardElement = document.getElementById('dashboard');
    DOM.salesFunnelElement = document.getElementById('salesFunnel');
    DOM.addLeadModal = document.getElementById('addLeadModal');
    DOM.openAddLeadModalBtn = document.getElementById('openAddLeadModalBtn');
    DOM.closeAddLeadModalBtn = document.getElementById('closeAddLeadModal');
    DOM.addLeadForm = document.getElementById('addLeadForm');
    DOM.saveChangesBtn = document.getElementById('saveChangesBtn');
    DOM.backupNowBtn = document.getElementById('backupNowBtn');
    DOM.backupReminderEl = document.getElementById('backupReminder');
    DOM.editLeadModal = document.getElementById('editLeadModal');
    DOM.closeEditLeadModalBtn = document.getElementById('closeEditLeadModal');
    DOM.editLeadForm = document.getElementById('editLeadForm');
    DOM.motivoPerdaContainer = document.getElementById('motivoPerdaContainer');
    DOM.editLeadMotivoPerda = document.getElementById('editLeadMotivoPerda');
    DOM.scriptModal = document.getElementById('scriptModal');
    DOM.closeScriptModalBtn = document.getElementById('closeScriptModal');
    DOM.scriptModalContent = document.getElementById('scriptModalContent');
    DOM.scriptModalInfo = document.getElementById('scriptModalInfo');
    DOM.copyScriptBtn = document.getElementById('copyScriptBtn');
    DOM.emailModal = document.getElementById('emailModal');
    DOM.closeEmailModalBtn = document.getElementById('closeEmailModal');
    DOM.emailModalContent = document.getElementById('emailModalContent');
    DOM.emailModalInfo = document.getElementById('emailModalInfo');
    DOM.copyEmailBtn = document.getElementById('copyEmailBtn');
    DOM.nextTaskModal = document.getElementById('nextTaskModal');
    DOM.closeNextTaskModalBtn = document.getElementById('closeNextTaskModal');
    DOM.nextTaskModalInfoFor = document.getElementById('nextTaskModalInfoFor');
    DOM.originalNextTaskSuggestion = document.getElementById('originalNextTaskSuggestion');
    DOM.refinedNextTaskDescription = document.getElementById('refinedNextTaskDescription');
    DOM.refinedNextTaskDate = document.getElementById('refinedNextTaskDate');
    DOM.applyRefinedNextTaskBtn = document.getElementById('applyRefinedNextTaskBtn');
    DOM.enrichModal = document.getElementById('enrichModal');
    DOM.closeEnrichModalBtn = document.getElementById('closeEnrichModal');
    DOM.enrichModalInfo = document.getElementById('enrichModalInfo');
    DOM.enrichModalRawContent = document.getElementById('enrichModalRawContent');
    DOM.enrichLeadTelefoneInput = document.getElementById('enrichLeadTelefoneInput');
    DOM.enrichLeadEmailInput = document.getElementById('enrichLeadEmailInput');
    DOM.enrichLeadWebsiteInput = document.getElementById('enrichLeadWebsiteInput');
    DOM.enrichLeadContatoNomeInput = document.getElementById('enrichLeadContatoNomeInput');
    DOM.enrichLeadContatoCargoInput = document.getElementById('enrichLeadContatoCargoInput');
    DOM.enrichLeadLinkedInInput = document.getElementById('enrichLeadLinkedInInput');
    DOM.enrichLeadObservacoesInput = document.getElementById('enrichLeadObservacoesInput');
    DOM.enrichLeadObservacoesApiInput = document.getElementById('enrichLeadObservacoesApiInput');
    DOM.applyEnrichDataBtn = document.getElementById('applyEnrichDataBtn');
    DOM.enrichLeadCepInput = document.getElementById('enrichLeadCepInput');
    DOM.fetchAddressByCepBtn = document.getElementById('fetchAddressByCepBtn');
    DOM.enrichLeadLogradouroInput = document.getElementById('enrichLeadLogradouroInput');
    DOM.enrichLeadBairroInput = document.getElementById('enrichLeadBairroInput');
    DOM.enrichLeadCidadeInput = document.getElementById('enrichLeadCidadeInput');
    DOM.enrichLeadEstadoInput = document.getElementById('enrichLeadEstadoInput');
    DOM.interactionModal = document.getElementById('interactionModal');
    DOM.closeInteractionModalBtn = document.getElementById('closeInteractionModal');
    DOM.interactionModalLeadInfo = document.getElementById('interactionModalLeadInfo');
    DOM.iaSuggestionArea = document.getElementById('iaSuggestionArea');
    DOM.userInputResponse = document.getElementById('userInputResponse');
    DOM.sendResponseBtn = document.getElementById('sendResponseBtn');
    DOM.attemptScheduleBtn = document.getElementById('attemptScheduleBtn');
    DOM.handleObjectionBtn = document.getElementById('handleObjectionBtn');
    DOM.loadingOverlay = document.getElementById('loadingOverlay');
    DOM.themeToggleBtn = document.getElementById('themeToggleBtn');
    DOM.themeIconSun = document.getElementById('theme-icon-sun');
    DOM.themeIconMoon = document.getElementById('theme-icon-moon');
    DOM.currentYearFooter = document.getElementById('currentYearFooter');
    DOM.pageTitle = document.getElementById('pageTitle');
    DOM.contentSections = document.querySelectorAll('.content-section');
    DOM.navLinks = document.querySelectorAll('.sidebar-nav a');
    DOM.toastContainer = document.getElementById('toast-container');
    DOM.getLeadInsightsBtn = document.getElementById('getLeadInsightsBtn');
    DOM.leadInsightsArea = document.getElementById('leadInsightsArea');
    DOM.addLeadPasteArea = document.getElementById('addLeadPasteArea');
    DOM.addLeadExtractBtn = document.getElementById('addLeadExtractBtn');
    DOM.editLeadPasteArea = document.getElementById('editLeadPasteArea');
    DOM.editLeadExtractBtn = document.getElementById('editLeadExtractBtn');
    DOM.summarizeLeadHistoryBtn = document.getElementById('summarizeLeadHistoryBtn');
    DOM.leadHistorySummaryArea = document.getElementById('leadHistorySummaryArea');
    DOM.leadPainPointsInput = document.getElementById('leadPainPointsInput');
    DOM.customizeScriptBtn = document.getElementById('customizeScriptBtn');
    DOM.customizedScriptArea = document.getElementById('customizedScriptArea');
    DOM.analyzeSentimentBtn = document.getElementById('analyzeSentimentBtn');
    DOM.leadSentimentArea = document.getElementById('leadSentimentArea');
    DOM.generateFollowUpBtn = document.getElementById('generateFollowUpBtn');
    DOM.generatedFollowUpArea = document.getElementById('generatedFollowUpArea');
    DOM.copyFollowUpBtn = document.getElementById('copyFollowUpBtn');
    DOM.getIndustryNewsBtn = document.getElementById('getIndustryNewsBtn');
    DOM.industryNewsArea = document.getElementById('industryNewsArea');
    DOM.getMeetingPrepBtn = document.getElementById('getMeetingPrepBtn');
    DOM.meetingPrepArea = document.getElementById('meetingPrepArea');
    DOM.deleteLeadBtn = document.getElementById('deleteLeadBtn');
    DOM.confirmationModal = document.getElementById('confirmationModal');
    DOM.confirmActionBtn = document.getElementById('confirmActionBtn');
    DOM.confirmCancelBtn = document.getElementById('confirmCancelBtn');
    DOM.appClock = document.getElementById('appClock');
    // Report Filters
    DOM.reportTemperaturaFilter = document.getElementById('reportTemperaturaFilter');
    DOM.reportOrigemFilter = document.getElementById('reportOrigemFilter');
    DOM.getCompetitorAnalysisBtn = document.getElementById('getCompetitorAnalysisBtn');
    DOM.competitorAnalysisArea = document.getElementById('competitorAnalysisArea');
    DOM.getNurturingSequenceBtn = document.getElementById('getNurturingSequenceBtn');
    DOM.nurturingSequenceArea = document.getElementById('nurturingSequenceArea');


    loadLeadsFromStorage();
    populateFilterDropdowns();
    updateDashboard(allLeads);
    renderSalesFunnel(allLeads);
    renderTable(allLeads);
    applyFilters();
    setupNavigation();
    showView('dashboardView');


    checkBackupReminder();
    if (backupIntervalId) clearInterval(backupIntervalId);
    backupIntervalId = setInterval(checkBackupReminder, 60000 * 5);

    if(DOM.currentYearFooter) {
        DOM.currentYearFooter.textContent = new Date().getFullYear();
    }

    setupEventListeners();
    setupThemeToggle();
    startClock();
});

function populateFilterDropdowns() {
    populateSelectWithOptions(DOM.filterEstadoSelect, KNOWN_STATES_LIST.map(s => ({value: s, text: s})), true);
    populateSelectWithOptions(DOM.filterStatusSelect, STATUS_LEAD_OPTIONS.filter(opt => opt.value), true);
    // For report filters
    if (DOM.reportTemperaturaFilter) populateSelectWithOptions(DOM.reportTemperaturaFilter, TEMPERATURA_LEAD_OPTIONS.filter(opt => opt.value), true);
    if (DOM.reportOrigemFilter) populateSelectWithOptions(DOM.reportOrigemFilter, LEAD_ORIGIN_OPTIONS.map(o => ({value: o, text: o})), true);
}

function startClock() {
    function updateClock() {
        if (DOM.appClock) {
            const now = new Date();
            DOM.appClock.textContent = now.toLocaleTimeString('pt-BR');
        }
    }
    updateClock(); // Initial call
    setInterval(updateClock, 1000); // Update every second
}


function setupEventListeners() {
    DOM.filterNomeInput?.addEventListener('input', applyFilters);
    DOM.filterEstadoSelect?.addEventListener('change', applyFilters);
    DOM.filterStatusSelect?.addEventListener('change', applyFilters);
    DOM.clearFiltersButton?.addEventListener('click', () => {
        DOM.filterNomeInput.value = '';
        DOM.filterEstadoSelect.value = '';
        DOM.filterStatusSelect.value = '';
        applyFilters();
    });

    DOM.openAddLeadModalBtn?.addEventListener('click', () => {
        DOM.addLeadModal.classList.remove('hidden');
        // Populate dropdowns in Add Lead Modal
        populateSelectWithOptions(document.getElementById('newLeadMarca'), CAR_BRANDS);
        populateSelectWithOptions(document.getElementById('newLeadContatoCargo'), LEAD_POSITIONS);
        populateSelectWithOptions(document.getElementById('newLeadEstado'), KNOWN_STATES_LIST.map(s => ({value: s, text: s})));
        populateSelectWithOptions(document.getElementById('newLeadOrigem'), LEAD_ORIGIN_OPTIONS.map(o => ({value: o, text: o})));
        document.getElementById('newLeadDataCriacao').value = new Date().toISOString().slice(0,10);
    });
    DOM.closeAddLeadModalBtn?.addEventListener('click', () => DOM.addLeadModal.classList.add('hidden'));
    DOM.addLeadModal?.addEventListener('click', (e) => { if (e.target === DOM.addLeadModal) DOM.addLeadModal.classList.add('hidden'); });
    DOM.addLeadForm?.addEventListener('submit', handleAddLeadSubmit);
    DOM.addLeadExtractBtn?.addEventListener('click', () => extractLeadDataFromText('addLeadPasteArea', 'addLeadForm'));


    DOM.closeEditLeadModalBtn?.addEventListener('click', () => DOM.editLeadModal.classList.add('hidden'));
    DOM.editLeadModal?.addEventListener('click', (e) => { if (e.target === DOM.editLeadModal) DOM.editLeadModal.classList.add('hidden'); });
    DOM.editLeadForm?.addEventListener('submit', handleEditLeadSubmit);
    DOM.editLeadForm?.querySelector('#editLeadStatusLead')?.addEventListener('change', (e) => {
        DOM.motivoPerdaContainer.classList.toggle('hidden', e.target.value !== 'Perdido' && e.target.value !== 'Não Qualificado' && e.target.value !== 'Sem Interesse');
    });
    DOM.getLeadInsightsBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            getLeadQualificationInsights(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para obter insights.", 3000, 'warning');
        }
    });
    DOM.editLeadExtractBtn?.addEventListener('click', () => extractLeadDataFromText('editLeadPasteArea', 'editLeadForm'));
    DOM.summarizeLeadHistoryBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            getLeadHistorySummary(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para resumir o histórico.", 3000, 'warning');
        }
    });
    DOM.analyzeSentimentBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            getSentimentAnalysis(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para análise de sentimento.", 3000, 'warning');
        }
    });
    DOM.generateFollowUpBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            generatePersonalizedFollowUp(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para gerar follow-up.", 3000, 'warning');
        }
    });
    DOM.copyFollowUpBtn?.addEventListener('click', () => {
        copyToClipboard(DOM.generatedFollowUpArea.value, 'Follow-up copiado!', 'Nenhum follow-up válido para copiar.');
    });
    DOM.getIndustryNewsBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            getIndustryNews(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para obter notícias da indústria.", 3000, 'warning');
        }
    });
    DOM.getMeetingPrepBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            getMeetingPrepGuide(currentLeadIdForEdit);
        } else {
            showToast("Nenhum lead selecionado para preparar a reunião.", 3000, 'warning');
        }
    });
    DOM.getCompetitorAnalysisBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) getCompetitorAnalysis(currentLeadIdForEdit);
        else showToast("Nenhum lead selecionado para análise competitiva.", 3000, 'warning');
    });
    DOM.getNurturingSequenceBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) getNurturingSequence(currentLeadIdForEdit);
        else showToast("Nenhum lead selecionado para sugerir sequência de nurturing.", 3000, 'warning');
    });
    DOM.deleteLeadBtn?.addEventListener('click', () => {
        if (currentLeadIdForEdit) {
            openConfirmationModal('Excluir Lead', 'Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.', () => handleDeleteLead(currentLeadIdForEdit));
        } else {
            showToast("Nenhum lead selecionado para excluir.", 3000, 'warning');
        }
    });


    DOM.saveChangesBtn?.addEventListener('click', () => {
        saveLeadsToStorage();
        showToast("Alterações salvas manualmente!", 2000);
    });
    DOM.backupNowBtn?.addEventListener('click', backupDataAsJson);


    DOM.closeScriptModalBtn?.addEventListener('click', () => { DOM.scriptModal.classList.add('hidden'); });
    DOM.scriptModal?.addEventListener('click', (event) => { if (event.target === DOM.scriptModal) { DOM.scriptModal.classList.add('hidden'); } });
    DOM.copyScriptBtn?.addEventListener('click', () => {
        const customizedText = DOM.customizedScriptArea?.textContent?.trim();
        const originalText = DOM.scriptModalContent?.textContent?.trim();
        const textToCopy = (customizedText && customizedText !== "Aguarde, a personalizar o guião..." && !customizedText.startsWith("Erro")) ? customizedText : originalText;
        copyToClipboard(textToCopy, 'Guião copiado!', 'Nenhum guião válido para copiar.');
    });
    DOM.customizeScriptBtn?.addEventListener('click', () => {
        if(currentLeadIdForScript) {
            customizeSalesPitch(currentLeadIdForScript);
        } else {
            showToast("Nenhum lead associado para personalizar o guião.", 3000, 'warning');
        }
    });


    DOM.closeEmailModalBtn?.addEventListener('click', () => { DOM.emailModal.classList.add('hidden'); });
    DOM.emailModal?.addEventListener('click', (event) => { if (event.target === DOM.emailModal) { DOM.emailModal.classList.add('hidden'); } });
    DOM.copyEmailBtn?.addEventListener('click', () => {
        copyToClipboard(DOM.emailModalContent.textContent, 'Minuta de email copiada!', 'Nenhuma minuta de email válida para copiar.');
    });

    DOM.closeNextTaskModalBtn?.addEventListener('click', () => { DOM.nextTaskModal.classList.add('hidden'); currentLeadIdForNextTask = null; });
    DOM.nextTaskModal?.addEventListener('click', (event) => { if (event.target === DOM.nextTaskModal) { DOM.nextTaskModal.classList.add('hidden'); currentLeadIdForNextTask = null; } });
    DOM.applyRefinedNextTaskBtn?.addEventListener('click', applyRefinedNextTask);

    DOM.closeEnrichModalBtn?.addEventListener('click', () => { DOM.enrichModal.classList.add('hidden'); currentLeadIdToEnrich = null; });
    DOM.enrichModal?.addEventListener('click', (event) => { if (event.target === DOM.enrichModal) { DOM.enrichModal.classList.add('hidden'); currentLeadIdToEnrich = null; } });
    DOM.applyEnrichDataBtn?.addEventListener('click', applyEnrichedData);
    DOM.fetchAddressByCepBtn?.addEventListener('click', () => {
        const cep = DOM.enrichLeadCepInput.value;
        fetchAddressFromViaCEP(cep);
    });

    DOM.closeInteractionModalBtn?.addEventListener('click', () => {
        DOM.interactionModal.classList.add('hidden');
        currentLeadIdForInteraction = null;
        interactionHistory = [];
    });
    DOM.interactionModal?.addEventListener('click', (event) => {
        if (event.target === DOM.interactionModal) {
            DOM.interactionModal.classList.add('hidden');
            currentLeadIdForInteraction = null;
            interactionHistory = [];
        }
    });
    DOM.sendResponseBtn?.addEventListener('click', handleUserResponse);
    DOM.attemptScheduleBtn?.addEventListener('click', attemptScheduling);
    DOM.handleObjectionBtn?.addEventListener('click', handleObjection);

    // Confirmation Modal Listeners
    DOM.confirmCancelBtn?.addEventListener('click', () => DOM.confirmationModal.classList.add('hidden'));
    DOM.confirmationModal?.addEventListener('click', (e) => {
        if (e.target === DOM.confirmationModal) DOM.confirmationModal.classList.add('hidden');
    });
}

function copyToClipboard(text, successMessage, errorMessage) {
    if (text && !text.startsWith("Aguarde") && !text.startsWith("Erro")) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast(successMessage, 2000);
        } catch (err) {
            console.error('Falha ao copiar: ', err);
            showToast('Falha ao copiar. Copie manualmente.', 3000, 'error');
        }
    } else {
        showToast(errorMessage, 2000, 'warning');
    }
}


function showView(viewId) {
    DOM.contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === viewId) {
            section.classList.add('active');
        }
    });
    const activeLink = document.querySelector(`.sidebar-nav a[href="#${viewId}"]`);
    if (activeLink && DOM.pageTitle) {
        const titleText = (activeLink.textContent || "").replace(/^[^\w]+/, '').trim();
        DOM.pageTitle.textContent = titleText || "Dashboard";
        document.title = `CRM Auto Arremate - ${titleText || "Dashboard"}`;
    }

    DOM.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${viewId}`) {
            link.classList.add('active');
        }
    });

    if (viewId === 'remindersView') renderTaskReminders();
    if (viewId === 'reportsView') setupReportsView();
    if (viewId === 'leadsView') renderTable(allLeads);
    if (viewId === 'dashboardView') updateDashboard(allLeads);
    if (viewId === 'funnelView') renderSalesFunnel(allLeads);
}

function setupNavigation() {
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('href').substring(1);
            showView(viewId);
        });
    });
}

function setupReportsView() {
    const reportContentArea = document.getElementById('reportContentArea');
    if(reportContentArea) reportContentArea.textContent = "Selecione os filtros e clique em 'Gerar Relatório'.";

    const reportStatusFilter = document.getElementById('reportStatusFilter');
    if (reportStatusFilter) {
        populateSelectWithOptions(reportStatusFilter, STATUS_LEAD_OPTIONS.filter(opt => opt.value), true);
    }
    // Populate new report filters
    if (DOM.reportTemperaturaFilter) populateSelectWithOptions(DOM.reportTemperaturaFilter, TEMPERATURA_LEAD_OPTIONS.filter(opt => opt.value), true);
    if (DOM.reportOrigemFilter) populateSelectWithOptions(DOM.reportOrigemFilter, LEAD_ORIGIN_OPTIONS.map(o => ({value: o, text: o})), true);


    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn && !generateReportBtn.hasAttribute('data-listener-attached')) {
        generateReportBtn.addEventListener('click', generateReport);
        generateReportBtn.setAttribute('data-listener-attached', 'true');
    }
}


function renderTaskReminders() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const overdueTasksList = document.getElementById('overdueTasksList');
    const todayTasksList = document.getElementById('todayTasksList');
    const tomorrowTasksList = document.getElementById('tomorrowTasksList');
    const next7DaysTasksList = document.getElementById('next7DaysTasksList');

    if(!overdueTasksList || !todayTasksList || !tomorrowTasksList || !next7DaysTasksList) return;

    overdueTasksList.innerHTML = '';
    todayTasksList.innerHTML = '';
    tomorrowTasksList.innerHTML = '';
    next7DaysTasksList.innerHTML = '';

    let overdueCount = 0, todayCount = 0, tomorrowCount = 0, next7Count = 0;

    allLeads.filter(lead => lead.proxima_tarefa_data && (lead.status_lead !== "Convertido" && lead.status_lead !== "Perdido" && lead.status_lead !== "Sem Interesse")).forEach(lead => {
        const taskDateStr = lead.proxima_tarefa_data;
        if (!taskDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(taskDateStr)) return;

        const [year, month, day] = taskDateStr.split('-').map(Number);
        const taskDate = new Date(year, month - 1, day);
        taskDate.setHours(0,0,0,0);


        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        let taskDescription = `Follow-up com ${lead.nome_empresa || 'Lead sem nome'}`;
        if(lead.observacoes_usuario){
            const nextActionMatch = lead.observacoes_usuario.match(/\[Próxima Ação Definida.*?\]:\s*(.*)/i);
            if(nextActionMatch && nextActionMatch[1]) {
                taskDescription = nextActionMatch[1].trim();
            } else if (lead.observacoes_usuario.length > 50) {
                taskDescription = lead.observacoes_usuario.substring(0, 50) + "...";
            } else if (lead.observacoes_usuario) {
                taskDescription = lead.observacoes_usuario;
            }
        }

        taskItem.innerHTML = `<strong>${lead.nome_empresa || 'Lead sem nome'}</strong>: ${taskDescription} <br><span class="due-date">Vence: ${taskDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>`;

        if (taskDate < today) {
            taskItem.classList.add('overdue');
            overdueTasksList.appendChild(taskItem);
            overdueCount++;
        } else if (taskDate.getTime() === today.getTime()) {
            todayTasksList.appendChild(taskItem);
            todayCount++;
        } else if (taskDate.getTime() === tomorrow.getTime()) {
            tomorrowTasksList.appendChild(taskItem);
            tomorrowCount++;
        } else if (taskDate > tomorrow && taskDate <= nextWeek) {
            next7DaysTasksList.appendChild(taskItem);
            next7Count++;
        }
    });

    if(overdueCount === 0) overdueTasksList.innerHTML = '<li class="text-sm text-[var(--text-muted)] p-2">Nenhuma tarefa atrasada.</li>';
    if(todayCount === 0) todayTasksList.innerHTML = '<li class="text-sm text-[var(--text-muted)] p-2">Nenhuma tarefa para hoje.</li>';
    if(tomorrowCount === 0) tomorrowTasksList.innerHTML = '<li class="text-sm text-[var(--text-muted)] p-2">Nenhuma tarefa para amanhã.</li>';
    if(next7Count === 0) next7DaysTasksList.innerHTML = '<li class="text-sm text-[var(--text-muted)] p-2">Nenhuma tarefa para os próximos 7 dias.</li>';
}

async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const statusFilter = document.getElementById('reportStatusFilter').value;
    const temperaturaFilter = DOM.reportTemperaturaFilter.value;
    const origemFilter = DOM.reportOrigemFilter.value;
    const reportContentArea = document.getElementById('reportContentArea');

    if(!reportContentArea) return;

    reportContentArea.textContent = "A gerar relatório...";
    showLoading(true);

    let filteredLeads = allLeads;
    if (startDate) {
        filteredLeads = filteredLeads.filter(lead => lead.data_criacao && lead.data_criacao >= startDate);
    }
    if (endDate) {
        filteredLeads = filteredLeads.filter(lead => lead.data_criacao && lead.data_criacao <= endDate);
    }
    if (statusFilter) {
        filteredLeads = filteredLeads.filter(lead => lead.status_lead === statusFilter);
    }
    if (temperaturaFilter) {
        filteredLeads = filteredLeads.filter(lead => lead.temperatura_lead === temperaturaFilter);
    }
    if (origemFilter) {
        filteredLeads = filteredLeads.filter(lead => lead.origem_lead === origemFilter);
    }

    if (filteredLeads.length === 0) {
        reportContentArea.textContent = "Nenhum lead encontrado para os critérios selecionados.";
        showLoading(false);
        return;
    }

    const leadsSummaryForPrompt = filteredLeads.map(lead => ({
        nome: lead.nome_empresa,
        status: lead.status_lead,
        origem: lead.origem_lead,
        temperatura: lead.temperatura_lead,
        data_criacao: lead.data_criacao,
        score: lead.lead_score || calculateLeadScore(lead)
    }));

    const prompt = `Você é um analista de CRM. Analise o seguinte conjunto de dados de leads e gere um relatório resumido em português do Brasil.
    Filtros aplicados: ${startDate ? `Data Início: ${startDate}` : ''}${endDate ? `, Data Fim: ${endDate}` : ''}${statusFilter ? `, Status: ${statusFilter}` : ''}${temperaturaFilter ? `, Temperatura: ${temperaturaFilter}` : ''}${origemFilter ? `, Origem: ${origemFilter}` : ''}.
    Dados dos Leads (amostra de até 50 leads):
    ${JSON.stringify(leadsSummaryForPrompt.slice(0, 50), null, 2)}
    ${leadsSummaryForPrompt.length > 50 ? `\n...(e mais ${leadsSummaryForPrompt.length - 50} leads)` : ''}

    O relatório deve incluir:
    1. Um resumo geral do período (se datas fornecidas) e dos filtros aplicados.
    2. Número total de leads no relatório.
    3. Distribuição de leads por status (contagem e percentagem do total do relatório).
    4. Distribuição de leads por origem (contagem e percentagem do total do relatório).
    5. Distribuição de leads por temperatura (contagem e percentagem do total do relatório).
    6. Média do Lead Score para os leads no relatório.
    7. Uma breve análise ou observação sobre os dados (ex: qual status é mais comum, qual origem tem melhor score médio, qual temperatura predomina, etc.).
    Seja conciso e apresente os dados de forma clara, usando markdown para formatação (listas, negrito).`;

    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = USER_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro da API (Relatório): ${errorData.error?.message || response.statusText}`); }
        const result = await response.json();

        if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
            reportContentArea.textContent = result.candidates[0].content.parts[0].text;
        } else { throw new Error("Resposta inesperada da API (Relatório). Verifique o console para detalhes."); console.error("Gemini API Response (Report):", result); }
    } catch (error) {
        console.error("Erro ao gerar relatório com Gemini:", error);
        reportContentArea.textContent = `Erro ao gerar relatório: ${error.message}. Tente novamente.`;
        showToast(`Erro ao gerar relatório: ${error.message}`, 5000, 'error');
    } finally {
        showLoading(false);
    }
}

function setupThemeToggle() {
    // Function to apply the current theme
    function applyTheme(darkMode) {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        if (DOM.themeIconSun && DOM.themeIconMoon) {
            DOM.themeIconSun.classList.toggle('hidden', darkMode);
            DOM.themeIconMoon.classList.toggle('hidden', !darkMode);
        }
        try {
            localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        } catch (e) {
            console.warn("LocalStorage não disponível para salvar tema.");
        }
    }

    // Initial theme setup
    let isDarkMode = localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(isDarkMode);

    // Event listener for the toggle button
    DOM.themeToggleBtn?.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        applyTheme(isDarkMode);
        // Re-render dashboard to apply new theme to chart colors if necessary
        updateDashboard(allLeads);
    });
}


function loadLeadsFromStorage() {
    try {
        const storedLeads = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedLeads) {
            allLeads = JSON.parse(storedLeads);
            allLeads.forEach(lead => {
                if (typeof lead.lead_score === 'undefined') {
                    lead.lead_score = calculateLeadScore(lead);
                }
                if (!lead.id) {
                    lead.id = generateUUID();
                }
            });
            allLeads.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
        }
    } catch (e) {
        console.error("Erro ao carregar leads do LocalStorage:", e);
        showToast("Erro ao carregar dados. Alguns dados podem estar ausentes.", 4000, 'error');
        allLeads = [];
    }
}

function saveLeadsToStorage() {
    try {
        allLeads.forEach(lead => lead.lead_score = calculateLeadScore(lead));
        allLeads.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allLeads));
    } catch (e) {
        console.error("Erro ao salvar leads no LocalStorage:", e);
        showToast("Erro ao salvar dados. Suas últimas alterações podem não ser persistidas.", 4000, 'error');
    }
}

function backupDataAsJson() {
    const dataStr = JSON.stringify(allLeads, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `crm_autoarremate_backup_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    localStorage.setItem('lastBackupTimestamp', Date.now().toString());
    checkBackupReminder();
    showToast("Backup JSON descarregado!", 2500);
}

function checkBackupReminder() {
    const lastBackup = localStorage.getItem('lastBackupTimestamp');
    const reminderEl = DOM.backupReminderEl;
    if (!reminderEl) return;

    if (lastBackup) {
        const lastBackupDate = new Date(parseInt(lastBackup));
        const daysSinceBackup = (Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup > 7) {
            reminderEl.textContent = `Último backup há ${Math.floor(daysSinceBackup)} dias!`;
            reminderEl.style.color = 'var(--accent-danger)';
        } else if (daysSinceBackup > 1) {
            reminderEl.textContent = `Último backup há ${Math.floor(daysSinceBackup)} dias.`;
            reminderEl.style.color = 'var(--accent-warning)';
        } else {
            reminderEl.textContent = `Backup recente.`;
            reminderEl.style.color = 'var(--text-muted)';
        }
    } else {
        reminderEl.textContent = "Nenhum backup feito!";
        reminderEl.style.color = 'var(--accent-danger)';
    }
}

function renderTable(leadsToRender) {
    if (!DOM.mainTableBody || !DOM.leadsTable) {
        console.error("Elemento da tabela ou tbody não encontrado.");
        return;
    }
    DOM.mainTableBody.innerHTML = '';

    if (leadsToRender.length === 0) {
        const row = DOM.mainTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 26; // Adjusted colspan
        cell.textContent = 'Nenhum lead encontrado com os filtros atuais.';
        cell.className = 'text-center p-8 text-lg text-[var(--text-muted)]';
        DOM.rowCountDisplay.textContent = "0 leads exibidos.";
        return;
    }

    leadsToRender.forEach(lead => {
        const row = DOM.mainTableBody.insertRow();
        row.dataset.leadId = lead.id;

        const scoreCell = row.insertCell();
        scoreCell.className = 'lead-score-wrapper p-1';
        const scoreSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        scoreSvg.setAttribute("viewBox", "0 0 36 36");
        scoreSvg.setAttribute("width", "32");
        scoreSvg.setAttribute("height", "32");
        const score = lead.lead_score || 0;
        let scoreClass = 'lead-score-medium'; // Default
        if (score < 40) scoreClass = 'lead-score-low';
        else if (score > 70) scoreClass = 'lead-score-high';
        scoreSvg.classList.add(scoreClass);

        const circumference = 2 * Math.PI * 15.9155;
        scoreSvg.innerHTML = `
            <circle class="lead-score-circle-bg" cx="18" cy="18" r="15.9155" fill="transparent" stroke-width="2.5"></circle>
            <circle class="lead-score-circle-fg" cx="18" cy="18" r="15.9155" fill="transparent" stroke-width="2.5"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - score / 100)}"
                    transform="rotate(-90 18 18)"></circle>
            <text x="18" y="18.5" class="lead-score-text">${score}</text>
        `;
        scoreCell.appendChild(scoreSvg);

        // Adjusted fields order and added PDV
        const fields = ['nome_empresa', 'pdv', 'marca', 'contato_nome', 'contato_cargo', 'endereco', 'telefone1', 'email', 'linkedin_contato', 'fez_contato', 'status_lead', 'temperatura_lead', 'reuniao_agendada', 'estado', 'cidade', 'data_criacao', 'origem_lead', 'data_tarefa', 'tipo_tarefa', 'resposta_tarefa', 'proxima_tarefa_data', 'observacoes_usuario', 'interacoes_ia', 'motivo_perda'];
        fields.forEach(field => {
            const cell = row.insertCell();
            let value = lead[field] || '---';
            if (field === 'pdv') {
                value = lead.pdv || 'N/A';
            }
            if (field === 'linkedin_contato' && value !== '---' && value !== 'http://') {
                cell.innerHTML = `<a href="${formatWebsite(value)}" target="_blank" class="text-[var(--accent-secondary)] hover:underline">Abrir</a>`;
            } else if (field === 'email' && value !== '---') {
                cell.innerHTML = `<a href="mailto:${value}" class="text-[var(--accent-secondary)] hover:underline">${value}</a>`;
            } else if (field === 'observacoes_usuario' && value.length > 30) {
                cell.textContent = value.substring(0, 30) + "...";
                cell.title = value;
            } else if (field === 'interacoes_ia' && Array.isArray(value) && value.length > 0) {
                cell.textContent = `${value.length} interaçõe(s)`;
                cell.title = value.map(interaction => `${interaction.role}: ${interaction.parts[0].text}`).join('\n---\n');
            } else if (field === 'interacoes_ia' && (!Array.isArray(value) || value.length === 0)) {
                cell.textContent = 'Nenhuma';
            }
            else {
                cell.textContent = value;
            }
        });

        const actionsCell = row.insertCell();
        actionsCell.className = "text-center whitespace-nowrap";

        const editBtn = document.createElement('button');
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3 10.537V13h2.462l7.976-8.024a1.75 1.75 0 0 0 0-2.463ZM4.75 12h-1.5v-1.5l7-7.025L11.75 5Z" /></svg>Editar`;
        editBtn.className = 'action-button edit-btn';
        editBtn.onclick = () => openEditLeadModal(lead.id);
        actionsCell.appendChild(editBtn);

        const scriptBtn = document.createElement('button');
        scriptBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path fill-rule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.163a.75.75 0 0 0 .19.505l3.008 3.438A2.5 2.5 0 0 0 7.157 11h1.686a2.5 2.5 0 0 0 1.96-1.644l3.007-3.438a.75.75 0 0 0 .19-.505V4.25A2.25 2.25 0 0 0 11.75 2h-7.5Zm.746 5.228L4.22 6.277A.25.25 0 0 1 4 6.063V4.25c0-.138.112-.25.25-.25h7.5a.25.25 0 0 1 .25.25v1.813a.25.25 0 0 1-.22.248l-.776.952-2.16 2.468a1 1 0 0 1-.784.356H7.157a1 1 0 0 1-.784-.356L5.093 8.872l-.097-.116Z" clip-rule="evenodd" /></svg>✨ Guião`;
        scriptBtn.className = 'action-button script-btn';
        scriptBtn.onclick = () => openScriptModal(lead.id);
        actionsCell.appendChild(scriptBtn);

        const emailBtn = document.createElement('button');
        emailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Zm9.47 4.47L8 10.062 4.03 7.47A.75.75 0 0 1 5.092 6.41l2.908 2.23L10.91 6.41a.75.75 0 1 1 1.062 1.06Z" /></svg>✨ Email`;
        emailBtn.className = 'action-button email-btn';
        emailBtn.onclick = () => openEmailModal(lead.id);
        actionsCell.appendChild(emailBtn);

        const enrichBtn = document.createElement('button');
        enrichBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" /></svg>✨ Enriquecer`;
        enrichBtn.className = 'action-button enrich-btn';
        enrichBtn.onclick = () => openEnrichModal(lead.id);
        actionsCell.appendChild(enrichBtn);

        const nextTaskBtn = document.createElement('button');
        nextTaskBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.586l-2.293-2.293a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06l2.293-2.293H2.75A.75.75 0 0 1 2 8Z" clip-rule="evenodd" /></svg>✨ Próx. Ação`;
        nextTaskBtn.className = 'action-button next-task-btn';
        nextTaskBtn.onclick = () => openNextTaskModal(lead.id);
        actionsCell.appendChild(nextTaskBtn);

        const interactionBtn = document.createElement('button');
        interactionBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1"><path fill-rule="evenodd" d="M11 2.75c0-.966-.784-1.75-1.75-1.75h-4.5C3.784 1 3 1.784 3 2.75V5h3.75c.966 0 1.75.784 1.75 1.75v1.5H13V6.75A1.75 1.75 0 0 0 11.25 5H11V2.75ZM5 6.75C5 5.784 5.784 5 6.75 5H8V2.75A.75.75 0 0 0 7.25 2h-4.5A.75.75 0 0 0 2 2.75v8.5A.75.75 0 0 0 2.75 12H5V6.75Zm3.75 7.5H13.5A.75.75 0 0 0 14 13.25v-4.5A.75.75 0 0 0 13.25 8H6.75a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75Z" clip-rule="evenodd" /></svg>✨ Interagir`;
        interactionBtn.className = 'action-button interaction-btn';
        interactionBtn.onclick = () => openInteractionModal(lead.id);
        actionsCell.appendChild(interactionBtn);

    });
    DOM.rowCountDisplay.textContent = `${leadsToRender.length} leads exibidos.`;
}

function applyFilters() {
    const nomeFilter = DOM.filterNomeInput.value.toLowerCase();
    const estadoFilter = DOM.filterEstadoSelect.value;
    const statusFilter = DOM.filterStatusSelect.value;

    const filteredLeads = allLeads.filter(lead => {
        const nomeMatch = !nomeFilter ||
            (lead.nome_empresa && lead.nome_empresa.toLowerCase().includes(nomeFilter)) ||
            (lead.marca && lead.marca.toLowerCase().includes(nomeFilter)) ||
            (lead.contato_nome && lead.contato_nome.toLowerCase().includes(nomeFilter));
        const estadoMatch = !estadoFilter || (lead.estado && lead.estado === estadoFilter);
        const statusMatch = !statusFilter || (lead.status_lead && lead.status_lead === statusFilter);
        return nomeMatch && estadoMatch && statusMatch;
    });
    renderTable(filteredLeads);
}

function updateDashboard(leads) {
    if (!DOM.dashboardElement) return;
    DOM.dashboardElement.innerHTML = '';

    const totalLeads = leads.length;
    const totalQualificados = leads.filter(l => l.status_lead === 'Qualificado').length;
    const totalAgendados = leads.filter(l => l.status_lead === 'Agendado').length;
    const totalConvertidos = leads.filter(l => l.status_lead === 'Convertido').length;
    const mediaLeadScore = totalLeads > 0 ? (leads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / totalLeads).toFixed(0) : 0;

    // Temperatura Média
    const temperaturaCounts = leads.reduce((acc, lead) => {
        if(lead.temperatura_lead) acc[lead.temperatura_lead] = (acc[lead.temperatura_lead] || 0) + 1;
        return acc;
    }, {});
    let temperaturaPredominante = "N/A";
    if (Object.keys(temperaturaCounts).length > 0) {
        temperaturaPredominante = Object.keys(temperaturaCounts).reduce((a, b) => temperaturaCounts[a] > temperaturaCounts[b] ? a : b);
    }
    const temperaturaEmoji = TEMPERATURA_LEAD_OPTIONS.find(t => t.value === temperaturaPredominante)?.text.split(' ')[1] || '';


    // Média de Interações
    const totalInteracoes = leads.reduce((sum, l) => sum + (Array.isArray(l.interacoes_ia) ? l.interacoes_ia.length : 0), 0);
    const mediaInteracoes = totalLeads > 0 ? (totalInteracoes / totalLeads).toFixed(1) : 0;


    const statusCounts = leads.reduce((acc, lead) => {
        acc[lead.status_lead] = (acc[lead.status_lead] || 0) + 1;
        return acc;
    }, {});
    const statusDataForChart = Object.entries(statusCounts)
        .map(([label, value]) => ({ label: STATUS_LEAD_OPTIONS.find(s => s.value === label)?.text || label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const origemCounts = leads.reduce((acc, lead) => {
        acc[lead.origem_lead] = (acc[lead.origem_lead] || 0) + 1;
        return acc;
    }, {});
    const origemDataForChart = Object.entries(origemCounts)
        .map(([label, value]) => ({ label: label || "Não especificado", value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);


    const cards = [
        { title: 'Total de Leads', value: totalLeads, color: 'var(--accent-primary)' },
        { title: 'Leads Qualificados', value: totalQualificados, color: 'var(--accent-secondary)' },
        { title: 'Reuniões Agendadas', value: totalAgendados, color: 'var(--accent-tertiary)' },
        { title: 'Leads Convertidos', value: totalConvertidos, color: 'var(--accent-purple)' },
        { title: 'Média Lead Score', value: `${mediaLeadScore}%`, color: 'var(--accent-info)' },
        { title: 'Temperatura Média', value: `${temperaturaPredominante} ${temperaturaEmoji}`, color: 'var(--accent-orange)' },
        { title: 'Média Interações/Lead', value: mediaInteracoes, color: 'var(--accent-teal)' },
        { title: 'Status dos Leads', chartData: statusDataForChart, type: 'barChart', color: 'var(--accent-warning)' },
        { title: 'Origem dos Leads', chartData: origemDataForChart, type: 'barChart', color: 'var(--accent-primary-darker)' },
    ];

    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'dashboard-card';
        cardEl.style.borderLeftColor = card.color;

        let content = `<div class="dashboard-card-title">${card.title}</div>`;
        if (card.value !== undefined) {
            content += `<div class="dashboard-card-value" style="color: ${card.color};">${card.value}</div>`;
        } else if (card.type === 'barChart' && card.chartData) {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'bar-chart-container';
            const maxValue = Math.max(...card.chartData.map(item => item.value), 0);

            card.chartData.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'bar-chart-item';
                const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                itemEl.innerHTML = `
                    <div class="bar-chart-label" title="${item.label}">${item.label}</div>
                    <div class="bar-chart-bar-wrapper">
                        <div class="bar-chart-bar" style="width: ${percentage}%; background-color: ${card.color || 'var(--accent-secondary)'};">
                           ${item.value}
                        </div>
                    </div>
                `;
                chartContainer.appendChild(itemEl);
            });
            content += chartContainer.outerHTML;
        }
        cardEl.innerHTML = content;
        DOM.dashboardElement.appendChild(cardEl);
    });
}
// --- Funções de Manipulação de Leads (Adicionar, Editar, Excluir) ---
function handleAddLeadSubmit(event) {
    event.preventDefault();
    const formData = new FormData(DOM.addLeadForm);
    const newLead = {};
    for (let [key, value] of formData.entries()) {
        if (key === 'telefone1') value = formatPhoneNumber(value);
        if (key === 'email') value = formatEmail(value);
        if (key === 'site' || key === 'linkedin_contato') value = formatWebsite(value);
        newLead[key] = value.trim();
    }
    newLead.id = generateUUID();
    newLead.data_criacao = new Date().toISOString().slice(0,10); // Ensure creation date is set
    newLead.status_lead = newLead.status_lead || FIRST_FUNNEL_STAGE; // Default status
    newLead.lead_score = calculateLeadScore(newLead);
    newLead.interacoes_ia = []; // Initialize IA interactions

    allLeads.unshift(newLead); // Add to the beginning for better visibility
    saveLeadsAndRefreshUI();
    DOM.addLeadForm.reset();
    DOM.addLeadModal.classList.add('hidden');
    showToast('Lead adicionado com sucesso!', 2000);
}

function openEditLeadModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado para edição.", 3000, "error");
        return;
    }
    currentLeadIdForEdit = leadId; // Store for IA functions

    DOM.editLeadForm.reset(); // Clear previous data
    DOM.leadHistorySummaryArea.textContent = 'Clique no botão acima para resumir o histórico.';
    DOM.leadInsightsArea.textContent = 'Clique no botão acima para obter insights.';
    DOM.leadSentimentArea.textContent = 'Clique no botão acima para analisar o sentimento.';
    DOM.generatedFollowUpArea.value = '';
    DOM.industryNewsArea.textContent = 'Clique no botão acima para ver notícias.';
    DOM.meetingPrepArea.textContent = 'Clique no botão acima para preparar a reunião.';
    DOM.competitorAnalysisArea.textContent = 'Clique no botão acima para análise competitiva.';
    DOM.nurturingSequenceArea.textContent = 'Clique no botão acima para sugestões de nurturing.';


    // Populate select options
    populateSelectWithOptions(DOM.editLeadForm.elements['marca'], CAR_BRANDS);
    populateSelectWithOptions(DOM.editLeadForm.elements['contato_cargo'], LEAD_POSITIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['fez_contato'], FEZ_CONTATO_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['status_lead'], STATUS_LEAD_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['motivo_perda'], MOTIVOS_PERDA_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['temperatura_lead'], TEMPERATURA_LEAD_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['reuniao_agendada'], REUNIAO_AGENDADA_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['estado'], KNOWN_STATES_LIST.map(s => ({value: s, text: s})));
    populateSelectWithOptions(DOM.editLeadForm.elements['origem_lead'], LEAD_ORIGIN_OPTIONS.map(o => ({value: o, text: o})));
    populateSelectWithOptions(DOM.editLeadForm.elements['tipo_tarefa'], TASK_TYPES_OPTIONS);
    populateSelectWithOptions(DOM.editLeadForm.elements['resposta_tarefa'], TASK_RESPONSES_OPTIONS);


    for (const key in lead) {
        if (DOM.editLeadForm.elements[key]) {
            DOM.editLeadForm.elements[key].value = lead[key] || '';
        }
    }
    // Handle special cases like readonly creation date
    if (DOM.editLeadForm.elements['data_criacao']) {
        DOM.editLeadForm.elements['data_criacao'].value = lead.data_criacao ? lead.data_criacao.split('T')[0] : '';
    }
    DOM.editLeadForm.elements['id'].value = lead.id; // Ensure ID is set

    // Show/hide motivo_perda based on current status
    const currentStatus = DOM.editLeadForm.elements['status_lead'].value;
    DOM.motivoPerdaContainer.classList.toggle('hidden', currentStatus !== 'Perdido' && currentStatus !== 'Não Qualificado' && currentStatus !== 'Sem Interesse');

    DOM.editLeadModal.classList.remove('hidden');
}


function handleEditLeadSubmit(event) {
    event.preventDefault();
    const formData = new FormData(DOM.editLeadForm);
    const leadId = formData.get('id');
    const leadIndex = allLeads.findIndex(l => l.id === leadId);

    if (leadIndex === -1) {
        showToast("Erro: Lead não encontrado para atualização.", 3000, "error");
        return;
    }

    const updatedLead = { ...allLeads[leadIndex] }; // Preserve existing fields not in form

    for (let [key, value] of formData.entries()) {
        if (key === 'id') continue; // Don't overwrite ID
        if (key === 'telefone1') value = formatPhoneNumber(value);
        if (key === 'email') value = formatEmail(value);
        if (key === 'site' || key === 'linkedin_contato') value = formatWebsite(value);
        updatedLead[key] = value.trim();
    }
    updatedLead.lead_score = calculateLeadScore(updatedLead);

    allLeads[leadIndex] = updatedLead;
    saveLeadsAndRefreshUI();
    DOM.editLeadModal.classList.add('hidden');
    showToast('Lead atualizado com sucesso!', 2000);
    currentLeadIdForEdit = null;
}

function handleDeleteLead(leadId) {
    allLeads = allLeads.filter(l => l.id !== leadId);
    saveLeadsAndRefreshUI();
    showToast('Lead excluído com sucesso!', 2000);
    DOM.editLeadModal.classList.add('hidden'); // Close edit modal if open
    DOM.confirmationModal.classList.add('hidden'); // Close confirmation
    currentLeadIdForEdit = null;
    leadToDeleteId = null;
}


// --- Funções de Modal (Script, Email, Next Task, Enrich, Interaction) ---
function openScriptModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }
    currentLeadIdForScript = leadId; // Store for customization
    DOM.scriptModalInfo.textContent = `Guião para: ${lead.nome_empresa || 'Lead Desconhecido'}`;
    DOM.leadPainPointsInput.value = ''; // Clear previous customization
    DOM.customizedScriptArea.textContent = ''; // Clear previous customization

    const prompt = `Você é um assistente de vendas da Auto Arremate, uma empresa que oferece soluções de software para concessionárias de veículos.
    Gere um guião de contato inicial conciso e amigável para o lead "${lead.nome_empresa || 'esta concessionária'}" (Contato: ${lead.contato_nome || 'Responsável pelas Vendas/Marketing'}, Cargo: ${lead.contato_cargo || 'não especificado'}).
    O objetivo é apresentar a Auto Arremate e identificar se há interesse em conhecer melhor nossas soluções para otimizar a gestão de vendas e estoque de veículos.
    Destaque brevemente que a Auto Arremate ajuda a aumentar a eficiência e lucratividade.
    Termine com uma pergunta aberta para iniciar uma conversa, como "Como vocês gerenciam o fluxo de leads e o inventário de veículos atualmente?" ou "Quais são os maiores desafios que vocês enfrentam na gestão da concessionária hoje em dia?".
    Seja profissional, mas acessível. O guião deve estar em português do Brasil.`;

    generateGeminiContent(prompt, DOM.scriptModalContent, 'script');
    DOM.scriptModal.classList.remove('hidden');
}

function openEmailModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }
    DOM.emailModalInfo.textContent = `Minuta para: ${lead.nome_empresa || 'Lead Desconhecido'} (Email: ${lead.email || 'Não informado'})`;

    const prompt = `Você é um assistente de vendas da Auto Arremate.
    Gere uma minuta de email de apresentação concisa e profissional para o lead "${lead.nome_empresa}" (Contato: ${lead.contato_nome || 'Prezado(a) Responsável'}).
    Assunto: Otimizando a Gestão da Sua Concessionária com Auto Arremate
    Corpo do Email:
    - Apresente a Auto Arremate como fornecedora de soluções de software para concessionárias.
    - Mencione brevemente que o software ajuda a melhorar a eficiência em vendas, gestão de estoque e relacionamento com clientes.
    - Sugira uma breve conversa para explorar como a Auto Arremate pode ajudar especificamente a "${lead.nome_empresa}".
    - Inclua um call-to-action claro, como "Você teria 15 minutos para uma rápida conversa na próxima semana?".
    - Use um tom profissional e cordial. O email deve estar em português do Brasil.`;

    generateGeminiContent(prompt, DOM.emailModalContent, 'email');
    DOM.emailModal.classList.remove('hidden');
}

function openNextTaskModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }
    currentLeadIdForNextTask = leadId;
    DOM.nextTaskModalInfoFor.textContent = `Próxima Ação para: ${lead.nome_empresa || 'Lead Desconhecido'}`;
    DOM.refinedNextTaskDescription.value = '';
    DOM.refinedNextTaskDate.value = '';

    let lastInteractionSummary = "Nenhuma interação registrada.";
    if (lead.interacoes_ia && lead.interacoes_ia.length > 0) {
        const lastIaInteraction = lead.interacoes_ia[lead.interacoes_ia.length - 1];
        lastInteractionSummary = `Última interação com IA (${lastIaInteraction.role}): ${lastIaInteraction.parts[0].text.substring(0, 150)}...`;
    } else if (lead.observacoes_usuario) {
        lastInteractionSummary = `Última observação manual: ${lead.observacoes_usuario.substring(0,150)}...`;
    }


    const prompt = `Você é um assistente de CRM inteligente. Para o lead "${lead.nome_empresa}" (Status atual: ${lead.status_lead || 'Não definido'}), com base na última informação: "${lastInteractionSummary}", sugira uma próxima ação concreta e uma data para essa ação (por exemplo, "Follow-up para verificar interesse", "Ligar para agendar demonstração").
    A data sugerida deve ser realista (ex: 2-3 dias úteis a partir de hoje, ${new Date().toLocaleDateString('pt-BR')}).
    Formato da resposta:
    Ação: [Descrição da ação]
    Data Sugerida: [DD/MM/AAAA]`;

    generateGeminiContent(prompt, DOM.originalNextTaskSuggestion, 'nextTask', (suggestionText) => {
        const actionMatch = suggestionText.match(/Ação:\s*(.*)/i);
        const dateMatch = suggestionText.match(/Data Sugerida:\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (actionMatch && actionMatch[1]) {
            DOM.refinedNextTaskDescription.value = actionMatch[1].trim();
        }
        if (dateMatch && dateMatch[1]) {
            const [day, month, year] = dateMatch[1].split('/');
            DOM.refinedNextTaskDate.value = `${year}-${month}-${day}`;
        }
    });
    DOM.nextTaskModal.classList.remove('hidden');
}

function applyRefinedNextTask() {
    if (!currentLeadIdForNextTask) {
        showToast("Nenhum lead selecionado para aplicar a tarefa.", 3000, "warning");
        return;
    }
    const leadIndex = allLeads.findIndex(l => l.id === currentLeadIdForNextTask);
    if (leadIndex === -1) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }

    const taskDescription = DOM.refinedNextTaskDescription.value.trim();
    const taskDate = DOM.refinedNextTaskDate.value;

    if (!taskDescription || !taskDate) {
        showToast("Descrição e data da tarefa são obrigatórias.", 3000, "warning");
        return;
    }

    allLeads[leadIndex].proxima_tarefa_data = taskDate;
    // Add a more structured way to store task descriptions if needed later
    // For now, appending to observacoes_usuario
    const taskLog = `[Próxima Ação Definida em ${new Date().toLocaleDateString('pt-BR')}]: ${taskDescription}`;
    allLeads[leadIndex].observacoes_usuario = (allLeads[leadIndex].observacoes_usuario ? allLeads[leadIndex].observacoes_usuario + "\n" : "") + taskLog;

    saveLeadsAndRefreshUI();
    DOM.nextTaskModal.classList.add('hidden');
    showToast(`Próxima tarefa para "${allLeads[leadIndex].nome_empresa}" atualizada!`, 2500);
    currentLeadIdForNextTask = null;
}


function openEnrichModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }
    currentLeadIdToEnrich = leadId;
    DOM.enrichModalInfo.textContent = `Enriquecer: ${lead.nome_empresa || 'Lead Desconhecido'}`;
    DOM.enrichModalRawContent.textContent = 'Aguardando pesquisa...';
    // Clear previous fields
    ['enrichLeadTelefoneInput', 'enrichLeadEmailInput', 'enrichLeadWebsiteInput', 'enrichLeadContatoNomeInput', 'enrichLeadContatoCargoInput', 'enrichLeadLinkedInInput', 'enrichLeadObservacoesInput', 'enrichLeadObservacoesApiInput', 'enrichLeadCepInput', 'enrichLeadLogradouroInput', 'enrichLeadBairroInput', 'enrichLeadCidadeInput', 'enrichLeadEstadoInput'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });


    const prompt = `Você é um assistente de pesquisa de dados. Encontre informações publicamente disponíveis sobre a empresa "${lead.nome_empresa}" (localizada em ${lead.cidade || 'cidade não informada'}, ${lead.estado || 'estado não informado'}).
    Procure por:
    - Telefone principal
    - Email de contato geral ou de vendas
    - Website oficial
    - Nome de um contato chave (ex: proprietário, gerente de vendas, diretor) e seu cargo
    - URL do perfil da empresa no LinkedIn (se houver) ou do contato chave
    - Breves observações relevantes (ex: especialidade da concessionária, notícias recentes, tamanho aproximado).
    Responda em formato JSON com as chaves: "telefone", "email", "website", "contato_nome", "contato_cargo", "linkedin_url", "observacoes_api". Se alguma informação não for encontrada, deixe o valor como string vazia.`;

    generateGeminiContent(prompt, DOM.enrichModalRawContent, 'enrich', (apiResponse) => {
        try {
            const jsonData = JSON.parse(apiResponse);
            DOM.enrichLeadTelefoneInput.value = jsonData.telefone || '';
            DOM.enrichLeadEmailInput.value = jsonData.email || '';
            DOM.enrichLeadWebsiteInput.value = formatWebsite(jsonData.website || '');
            DOM.enrichLeadContatoNomeInput.value = jsonData.contato_nome || '';
            DOM.enrichLeadContatoCargoInput.value = jsonData.contato_cargo || '';
            DOM.enrichLeadLinkedInInput.value = formatWebsite(jsonData.linkedin_url || '');
            DOM.enrichLeadObservacoesApiInput.value = jsonData.observacoes_api || '';
        } catch (e) {
            console.error("Erro ao parsear JSON da API de enriquecimento:", e);
            DOM.enrichLeadObservacoesApiInput.value = "Erro ao processar dados da API. Resposta original:\n" + apiResponse;
            showToast("Erro ao processar dados de enriquecimento.", 3000, "error");
        }
    }, true); // Pass true for structuredResponse
    DOM.enrichModal.classList.remove('hidden');
}

async function fetchAddressFromViaCEP(cep) {
    if (!cep) {
        showToast("Por favor, insira um CEP.", 3000, "warning");
        return;
    }
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
        showToast("CEP inválido. Deve conter 8 dígitos.", 3000, "warning");
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar CEP: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.erro) {
            showToast("CEP não encontrado.", 3000, "warning");
            DOM.enrichLeadLogradouroInput.value = '';
            DOM.enrichLeadBairroInput.value = '';
            DOM.enrichLeadCidadeInput.value = '';
            DOM.enrichLeadEstadoInput.value = '';
        } else {
            DOM.enrichLeadLogradouroInput.value = data.logradouro || '';
            DOM.enrichLeadBairroInput.value = data.bairro || '';
            DOM.enrichLeadCidadeInput.value = data.localidade || '';
            DOM.enrichLeadEstadoInput.value = data.uf || '';
            showToast("Endereço preenchido pelo CEP!", 2000);
        }
    } catch (error) {
        console.error("Erro na API ViaCEP:", error);
        showToast(`Erro ao buscar endereço: ${error.message}`, 4000, "error");
    } finally {
        showLoading(false);
    }
}


function applyEnrichedData() {
    if (!currentLeadIdToEnrich) {
        showToast("Nenhum lead selecionado para aplicar dados.", 3000, "warning");
        return;
    }
    const leadIndex = allLeads.findIndex(l => l.id === currentLeadIdToEnrich);
    if (leadIndex === -1) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }

    const lead = allLeads[leadIndex];
    // Update only if new data is provided and different from existing (or if existing is empty)
    const newTelefone = formatPhoneNumber(DOM.enrichLeadTelefoneInput.value.trim());
    if (newTelefone && newTelefone !== lead.telefone1) lead.telefone1 = newTelefone;

    const newEmail = formatEmail(DOM.enrichLeadEmailInput.value.trim());
    if (newEmail && newEmail !== lead.email) lead.email = newEmail;

    const newWebsite = formatWebsite(DOM.enrichLeadWebsiteInput.value.trim());
    if (newWebsite && newWebsite !== lead.site && newWebsite !== 'http://') lead.site = newWebsite;

    const newContatoNome = DOM.enrichLeadContatoNomeInput.value.trim();
    if (newContatoNome && newContatoNome !== lead.contato_nome) lead.contato_nome = newContatoNome;

    const newContatoCargo = DOM.enrichLeadContatoCargoInput.value.trim();
    if (newContatoCargo && newContatoCargo !== lead.contato_cargo) lead.contato_cargo = newContatoCargo;

    const newLinkedIn = formatWebsite(DOM.enrichLeadLinkedInInput.value.trim());
    if (newLinkedIn && newLinkedIn !== lead.linkedin_contato && newLinkedIn !== 'http://') lead.linkedin_contato = newLinkedIn;

    const newObservacoes = DOM.enrichLeadObservacoesInput.value.trim();
    if (newObservacoes) {
        lead.observacoes_usuario = (lead.observacoes_usuario ? lead.observacoes_usuario + "\n" : "") + `[Enriquecimento Manual ${new Date().toLocaleDateString('pt-BR')}]: ${newObservacoes}`;
    }
    const apiObservacoes = DOM.enrichLeadObservacoesApiInput.value.trim();
     if (apiObservacoes && !apiObservacoes.startsWith("Erro")) {
        lead.observacoes_usuario = (lead.observacoes_usuario ? lead.observacoes_usuario + "\n" : "") + `[Enriquecimento API ${new Date().toLocaleDateString('pt-BR')}]: ${apiObservacoes}`;
    }

    const newLogradouro = DOM.enrichLeadLogradouroInput.value.trim();
    const newBairro = DOM.enrichLeadBairroInput.value.trim();
    const newCidade = DOM.enrichLeadCidadeInput.value.trim();
    const newEstado = DOM.enrichLeadEstadoInput.value.trim().toUpperCase();

    let addressParts = [];
    if (newLogradouro) addressParts.push(newLogradouro);
    if (newBairro) addressParts.push(newBairro);
    const newFullAddress = addressParts.join(', ');

    if (newFullAddress && newFullAddress !== lead.endereco) lead.endereco = newFullAddress;
    if (newCidade && newCidade !== lead.cidade) lead.cidade = newCidade;
    if (newEstado && KNOWN_STATES_LIST.includes(newEstado) && newEstado !== lead.estado) lead.estado = newEstado;


    lead.lead_score = calculateLeadScore(lead); // Recalculate score
    saveLeadsAndRefreshUI();
    DOM.enrichModal.classList.add('hidden');
    showToast(`Dados para "${lead.nome_empresa}" atualizados!`, 2500);
    currentLeadIdToEnrich = null;
}

function openInteractionModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado.", 3000, "error");
        return;
    }
    currentLeadIdForInteraction = leadId;
    interactionHistory = [...(lead.interacoes_ia || [])]; // Load existing history

    DOM.interactionModalLeadInfo.textContent = `Interagindo com: ${lead.nome_empresa || 'Lead Desconhecido'}`;
    DOM.userInputResponse.value = ''; // Clear previous user input

    let initialPromptContext = `Lead: ${lead.nome_empresa}, Status: ${lead.status_lead}.`;
    if (interactionHistory.length > 0) {
        const lastMsg = interactionHistory[interactionHistory.length - 1];
        initialPromptContext += ` Última mensagem (${lastMsg.role}): ${lastMsg.parts[0].text.substring(0,100)}...`;
    } else {
        initialPromptContext += " Nenhuma interação anterior registrada com IA.";
    }

    const prompt = `Você é um assistente de vendas da Auto Arremate. Inicie (ou continue) uma conversa com o lead.
    Contexto: ${initialPromptContext}
    Seu objetivo é qualificar o lead e, se apropriado, tentar agendar uma demonstração do software.
    Faça uma pergunta aberta ou um comentário relevante para engajar o lead.
    Mantenha a resposta curta e focada.`;

    generateGeminiContent(prompt, DOM.iaSuggestionArea, 'interaction_start', (suggestion) => {
        interactionHistory.push({ role: "model", parts: [{ text: suggestion }] });
    });
    DOM.interactionModal.classList.remove('hidden');
}

function handleUserResponse() {
    if (!currentLeadIdForInteraction) return;
    const userResponseText = DOM.userInputResponse.value.trim();
    if (!userResponseText) {
        showToast("Por favor, insira a resposta do lead.", 3000, "warning");
        return;
    }
    interactionHistory.push({ role: "user", parts: [{ text: userResponseText }] });
    DOM.userInputResponse.value = ''; // Clear input

    const lead = allLeads.find(l => l.id === currentLeadIdForInteraction);
    const prompt = `Você é um assistente de vendas da Auto Arremate. Continue a conversa com o lead "${lead.nome_empresa}".
    Histórico da conversa até agora (últimas 5 trocas):
    ${interactionHistory.slice(-5).map(msg => `${msg.role === 'user' ? 'Lead' : 'Você'}: ${msg.parts[0].text}`).join('\n')}

    Resposta do Lead: "${userResponseText}"
    Responda ao lead de forma apropriada, tentando avançar na qualificação ou agendamento. Mantenha a resposta curta.`;

    generateGeminiContent(prompt, DOM.iaSuggestionArea, 'interaction_continue', (suggestion) => {
        interactionHistory.push({ role: "model", parts: [{ text: suggestion }] });
        updateLeadInteractions(currentLeadIdForInteraction, interactionHistory);
    });
}

function handleObjection() {
    if (!currentLeadIdForInteraction) return;
    const objectionText = DOM.userInputResponse.value.trim();
    if (!objectionText) {
        showToast("Por favor, insira a objeção do lead.", 3000, "warning");
        return;
    }
    interactionHistory.push({ role: "user", parts: [{ text: `OBJEÇÃO: ${objectionText}` }] });
    DOM.userInputResponse.value = '';

    const lead = allLeads.find(l => l.id === currentLeadIdForInteraction);
    const prompt = `Você é um especialista em contornar objeções de vendas da Auto Arremate. O lead "${lead.nome_empresa}" apresentou a seguinte objeção: "${objectionText}".
    Histórico da conversa (últimas 5 trocas):
    ${interactionHistory.slice(-6, -1).map(msg => `${msg.role === 'user' ? 'Lead' : 'Você'}: ${msg.parts[0].text}`).join('\n')}
    Forneça uma sugestão curta e eficaz para contornar essa objeção e manter a conversa produtiva.`;

    generateGeminiContent(prompt, DOM.iaSuggestionArea, 'interaction_objection', (suggestion) => {
        interactionHistory.push({ role: "model", parts: [{ text: suggestion }] });
        updateLeadInteractions(currentLeadIdForInteraction, interactionHistory);
    });
}

function attemptScheduling() {
    if (!currentLeadIdForInteraction) return;
    const lead = allLeads.find(l => l.id === currentLeadIdForInteraction);
    interactionHistory.push({ role: "user", parts: [{ text: "Tentativa de agendamento iniciada pelo vendedor."}] });

    const prompt = `Você é um assistente de vendas da Auto Arremate. O vendedor quer tentar agendar uma reunião/demonstração com o lead "${lead.nome_empresa}".
    Histórico da conversa (últimas 5 trocas):
    ${interactionHistory.slice(-6, -1).map(msg => `${msg.role === 'user' ? 'Lead' : 'Você'}: ${msg.parts[0].text}`).join('\n')}
    Sugira uma forma educada e direta de propor o agendamento. Ofereça flexibilidade. Ex: "Com base no que conversamos, acredito que uma breve demonstração de 15-20 minutos seria muito útil. Você teria disponibilidade na próxima terça ou quinta à tarde?"`;

    generateGeminiContent(prompt, DOM.iaSuggestionArea, 'interaction_schedule', (suggestion) => {
        interactionHistory.push({ role: "model", parts: [{ text: suggestion }] });
        updateLeadInteractions(currentLeadIdForInteraction, interactionHistory);
        // Optionally, directly open the "Next Task" modal pre-filled for scheduling
        // openNextTaskModal(currentLeadIdForInteraction);
        // DOM.refinedNextTaskDescription.value = `Agendar demonstração com ${lead.nome_empresa}`;
    });
}


function updateLeadInteractions(leadId, history) {
    const leadIndex = allLeads.findIndex(l => l.id === leadId);
    if (leadIndex !== -1) {
        allLeads[leadIndex].interacoes_ia = [...history]; // Save a copy
        saveLeadsToStorage(); // Persist changes
        // No full UI refresh here to keep modal open and flow smooth
        // Only refresh table if modal is closed later or on explicit save
    }
}

// --- Funções de Geração de Conteúdo com Gemini (Refatorada) ---
async function generateGeminiContent(promptText, targetElement, type, callback, structuredResponse = false) {
    if (!targetElement) {
        console.error(`Elemento alvo para ${type} não encontrado.`);
        return;
    }
    targetElement.textContent = 'Aguarde, a IA está a pensar... 🧠';
    showLoading(true);

    try {
        let chatHistory = [{ role: "user", parts: [{ text: promptText }] }];
        const payload = { contents: chatHistory };

        if (structuredResponse && type === 'enrich') { // Specific schema for enrichment
            payload.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "telefone": { "type": "STRING" },
                        "email": { "type": "STRING" },
                        "website": { "type": "STRING" },
                        "contato_nome": { "type": "STRING" },
                        "contato_cargo": { "type": "STRING" },
                        "linkedin_url": { "type": "STRING" },
                        "observacoes_api": { "type": "STRING" }
                    }
                }
            };
        } else if (structuredResponse && type === 'extract_data') {
             payload.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "nome_empresa": { "type": "STRING", "description": "Nome da empresa ou grupo." },
                        "contato_nome": { "type": "STRING", "description": "Nome da pessoa de contato." },
                        "contato_cargo": { "type": "STRING", "description": "Cargo da pessoa de contato." },
                        "telefone1": { "type": "STRING", "description": "Telefone principal." },
                        "email": { "type": "STRING", "description": "Endereço de e-mail." },
                        "linkedin_contato": { "type": "STRING", "description": "URL do perfil do LinkedIn do contato ou empresa." },
                        "site": { "type": "STRING", "description": "Website da empresa." },
                        "endereco": { "type": "STRING", "description": "Endereço completo (rua, número, bairro)." },
                        "cidade": { "type": "STRING", "description": "Cidade." },
                        "estado": { "type": "STRING", "description": "Estado (sigla UF)." }
                    }
                }
            };
        }


        const apiKey = USER_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Gemini API Error (${type}):`, errorData);
            throw new Error(`Erro da API (${type}): ${errorData.error?.message || response.statusText}`);
        }

        const result = await response.json();

        if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
            const generatedText = result.candidates[0].content.parts[0].text;
            if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
                 targetElement.value = generatedText;
            } else {
                targetElement.textContent = generatedText;
            }

            if (callback) {
                callback(generatedText);
            }
        } else {
            console.error("Resposta inesperada da API Gemini:", result);
            throw new Error(`Resposta inesperada da API (${type}). Verifique o console.`);
        }

    } catch (error) {
        console.error(`Erro ao gerar conteúdo (${type}):`, error);
        const errorMessage = `Erro ao gerar conteúdo (${type}): ${error.message}. Tente novamente.`;
         if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
             targetElement.value = errorMessage;
        } else {
            targetElement.textContent = errorMessage;
        }
        showToast(errorMessage, 5000, 'error');
    } finally {
        showLoading(false);
    }
}

// --- Sales Funnel Functions ---
function renderSalesFunnel(leads) {
    if (!DOM.salesFunnelElement) return;
    DOM.salesFunnelElement.innerHTML = '';

    FUNNEL_STAGES.forEach(stage => {
        const column = document.createElement('div');
        column.className = 'funnel-column';
        column.dataset.stage = stage.value;
        column.innerHTML = `<h4>${stage.text} (<span class="lead-count">0</span>)</h4><div class="funnel-column-content"></div>`;
        DOM.salesFunnelElement.appendChild(column);

        // Make column a drop target
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
    });

    leads.filter(lead => lead.status_lead && lead.status_lead !== "Convertido" && lead.status_lead !== "Perdido").forEach(lead => {
        const columnContent = DOM.salesFunnelElement.querySelector(`.funnel-column[data-stage="${lead.status_lead}"] .funnel-column-content`);
        if (columnContent) {
            const leadCard = createLeadCard(lead);
            columnContent.appendChild(leadCard);
        }
    });
    updateFunnelCounts();
}

function createLeadCard(lead) {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.draggable = true;
    card.dataset.leadId = lead.id;
    card.innerHTML = `
        <h5>${lead.nome_empresa || 'Lead sem nome'}</h5>
        <p>${lead.contato_nome || 'Sem contato'}</p>
        <p class="lead-score-funnel">Score: ${lead.lead_score || calculateLeadScore(lead)}%</p>
    `;
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('click', () => openEditLeadModal(lead.id)); // Open edit modal on click
    return card;
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.leadId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    const targetColumn = e.target.closest('.funnel-column');
    if (!targetColumn) return;

    const newStage = targetColumn.dataset.stage;
    const lead = allLeads.find(l => l.id === leadId);

    if (lead && lead.status_lead !== newStage) {
        lead.status_lead = newStage;
        // If moved to a "lost" or "not qualified" stage from funnel, update motivo_perda if needed
        if (newStage === "Não Qualificado" || newStage === "Sem Interesse" || newStage === "Perdido") {
            // Optionally prompt for reason or open edit modal
            openEditLeadModal(leadId); // Open edit to allow setting reason
        }

        saveLeadsAndRefreshUI(); // This will re-render table, dashboard, and funnel
        showToast(`Lead "${lead.nome_empresa}" movido para ${newStage}.`, 2000);
    }
}

function updateFunnelCounts() {
    DOM.salesFunnelElement.querySelectorAll('.funnel-column').forEach(column => {
        const count = column.querySelectorAll('.lead-card').length;
        const countSpan = column.querySelector('.lead-count');
        if(countSpan) countSpan.textContent = count;
    });
}

function saveLeadsAndRefreshUI() {
    saveLeadsToStorage();
    applyFilters(); // This re-renders the table with current filters
    updateDashboard(allLeads);
    renderSalesFunnel(allLeads);
    renderTaskReminders(); // Update reminders if tasks changed
}

// --- Gemini API for Lead Data Extraction ---
async function extractLeadDataFromText(textAreaId, formId) {
    const pasteArea = document.getElementById(textAreaId);
    const form = document.getElementById(formId);
    if (!pasteArea || !form) {
        showToast("Erro: Elementos do formulário não encontrados para extração.", 3000, "error");
        return;
    }
    const textToExtract = pasteArea.value.trim();
    if (!textToExtract) {
        showToast("Por favor, cole algum texto para extrair.", 3000, "warning");
        return;
    }

    const prompt = `Analise o seguinte texto e extraia as informações de contato e da empresa em formato JSON.
    As chaves JSON devem ser: "nome_empresa", "contato_nome", "contato_cargo", "telefone1", "email", "linkedin_contato", "site", "endereco", "cidade", "estado".
    Se uma informação não estiver presente, use uma string vazia para o valor. Formate o telefone para o padrão brasileiro se possível.
    Para o estado, use a sigla UF (ex: SP, RJ, MG).
    Texto para análise:
    ---
    ${textToExtract}
    ---`;

    showLoading(true);
    DOM.addLeadExtractBtn.disabled = true;
    DOM.editLeadExtractBtn.disabled = true;

    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "nome_empresa": { "type": "STRING", "description": "Nome da empresa ou grupo." },
                        "contato_nome": { "type": "STRING", "description": "Nome da pessoa de contato." },
                        "contato_cargo": { "type": "STRING", "description": "Cargo da pessoa de contato." },
                        "telefone1": { "type": "STRING", "description": "Telefone principal." },
                        "email": { "type": "STRING", "description": "Endereço de e-mail." },
                        "linkedin_contato": { "type": "STRING", "description": "URL do perfil do LinkedIn do contato ou empresa." },
                        "site": { "type": "STRING", "description": "Website da empresa." },
                        "endereco": { "type": "STRING", "description": "Endereço completo (rua, número, bairro)." },
                        "cidade": { "type": "STRING", "description": "Cidade." },
                        "estado": { "type": "STRING", "description": "Estado (sigla UF)." }
                    }
                }
            }
        };
        const apiKey = USER_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro da API (Extração): ${errorData.error?.message || response.statusText}`); }
        const result = await response.json();

        if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
            const extractedJsonString = result.candidates[0].content.parts[0].text;
            try {
                const extractedData = JSON.parse(extractedJsonString);
                // Populate form fields
                for (const key in extractedData) {
                    const formFieldKey = formId === 'addLeadForm' ? `newLead${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, '')}` : `editLead${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, '')}`;
                    // Special handling for fields that might not directly map or need select population
                    if (key === "nome_empresa" && form.elements[formId === 'addLeadForm' ? 'newLeadEmpresa' : 'editLeadNomeEmpresa']) form.elements[formId === 'addLeadForm' ? 'newLeadEmpresa' : 'editLeadNomeEmpresa'].value = extractedData[key] || '';
                    else if (key === "contato_nome" && form.elements[formId === 'addLeadForm' ? 'newLeadContatoNome' : 'editLeadContatoNome']) form.elements[formId === 'addLeadForm' ? 'newLeadContatoNome' : 'editLeadContatoNome'].value = extractedData[key] || '';
                    else if (key === "contato_cargo" && form.elements[formId === 'addLeadForm' ? 'newLeadContatoCargo' : 'editLeadContatoCargo']) {
                        const cargoSelect = form.elements[formId === 'addLeadForm' ? 'newLeadContatoCargo' : 'editLeadContatoCargo'];
                        const cargoValue = extractedData[key] || '';
                        let found = false;
                        for(let i=0; i < cargoSelect.options.length; i++){
                            if(cargoSelect.options[i].text.toLowerCase() === cargoValue.toLowerCase() || cargoSelect.options[i].value.toLowerCase() === cargoValue.toLowerCase()){
                                cargoSelect.value = cargoSelect.options[i].value;
                                found = true;
                                break;
                            }
                        }
                        if(!found && cargoValue) { // If not found, add as "Outro" or select "Outro" and fill a text field if available
                           const outroOption = Array.from(cargoSelect.options).find(opt => opt.value.toLowerCase() === 'outro');
                           if (outroOption) cargoSelect.value = outroOption.value;
                           // Consider adding a free text field for "Outro Cargo" if this is common
                        }
                    }
                    else if (key === "telefone1" && form.elements[formId === 'addLeadForm' ? 'newLeadTelefone1' : 'editLeadTelefone1']) form.elements[formId === 'addLeadForm' ? 'newLeadTelefone1' : 'editLeadTelefone1'].value = formatPhoneNumber(extractedData[key] || '');
                    else if (key === "email" && form.elements[formId === 'addLeadForm' ? 'newLeadEmail' : 'editLeadEmail']) form.elements[formId === 'addLeadForm' ? 'newLeadEmail' : 'editLeadEmail'].value = formatEmail(extractedData[key] || '');
                    else if (key === "linkedin_contato" && form.elements[formId === 'addLeadForm' ? 'newLeadLinkedIn' : 'editLeadLinkedIn']) form.elements[formId === 'addLeadForm' ? 'newLeadLinkedIn' : 'editLeadLinkedIn'].value = formatWebsite(extractedData[key] || '');
                    else if (key === "site" && form.elements[formId === 'addLeadForm' ? 'newLeadSite' : 'editLeadSite']) form.elements[formId === 'addLeadForm' ? 'newLeadSite' : 'editLeadSite'].value = formatWebsite(extractedData[key] || '');
                    else if (key === "endereco" && form.elements[formId === 'addLeadForm' ? 'newLeadEndereco' : 'editLeadEndereco']) form.elements[formId === 'addLeadForm' ? 'newLeadEndereco' : 'editLeadEndereco'].value = extractedData[key] || '';
                    else if (key === "cidade" && form.elements[formId === 'addLeadForm' ? 'newLeadCidade' : 'editLeadCidade']) form.elements[formId === 'addLeadForm' ? 'newLeadCidade' : 'editLeadCidade'].value = extractedData[key] || '';
                    else if (key === "estado" && form.elements[formId === 'addLeadForm' ? 'newLeadEstado' : 'editLeadEstado']) {
                        const estadoSelect = form.elements[formId === 'addLeadForm' ? 'newLeadEstado' : 'editLeadEstado'];
                        const estadoValue = (extractedData[key] || '').toUpperCase();
                        if (KNOWN_STATES_LIST.includes(estadoValue)) {
                            estadoSelect.value = estadoValue;
                        }
                    }
                }
                showToast("Dados extraídos e preenchidos no formulário!", 2500);
                pasteArea.value = ''; // Clear paste area
            } catch (parseError) {
                console.error("Erro ao parsear JSON da extração:", parseError, "\nString JSON recebida:", extractedJsonString);
                showToast("Erro ao processar dados extraídos. Verifique o console.", 4000, "error");
            }
        } else { throw new Error("Resposta inesperada da API (Extração). Verifique o console para detalhes."); console.error("Gemini API Response (Extraction):", result); }
    } catch (error) {
        console.error("Erro ao extrair dados com Gemini:", error);
        showToast(`Erro na extração: ${error.message}`, 5000, 'error');
    } finally {
        showLoading(false);
        DOM.addLeadExtractBtn.disabled = false;
        DOM.editLeadExtractBtn.disabled = false;
    }
}

// --- Funções Adicionais de IA para Edição de Lead ---
async function getLeadQualificationInsights(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        showToast("Lead não encontrado para insights.", 3000, "error");
        DOM.leadInsightsArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    const leadDataSummary = `Empresa: ${lead.nome_empresa}, Contato: ${lead.contato_nome || 'N/A'} (${lead.contato_cargo || 'N/A'}), Status: ${lead.status_lead}, Score: ${lead.lead_score}, PDVs: ${lead.pdv || 'N/A'}, Origem: ${lead.origem_lead || 'N/A'}, Temperatura: ${lead.temperatura_lead || 'N/A'}. Observações: ${lead.observacoes_usuario ? lead.observacoes_usuario.slice(-200) + "..." : "Nenhuma"}. Histórico de Interações IA (última): ${lead.interacoes_ia && lead.interacoes_ia.length > 0 ? lead.interacoes_ia[lead.interacoes_ia.length -1].parts[0].text.slice(0,100) + "..." : "Nenhuma"}`;

    const prompt = `Você é um analista de vendas experiente. Analise os seguintes dados do lead e forneça insights de qualificação em português do Brasil:
    ${leadDataSummary}
    Forneça:
    1.  Pontos Fortes: (Ex: bom score, cargo de decisão, interesse demonstrado).
    2.  Pontos de Atenção/Riscos: (Ex: status "Sem Interesse", baixa temperatura, poucas interações).
    3.  Sugestão de Próximo Passo Estratégico: (Ex: "Tentar agendar demonstração focado em X", "Enviar material sobre Y e fazer follow-up", "Considerar desqualificar se Z").
    Seja conciso e direto ao ponto. Use markdown para formatação.`;

    generateGeminiContent(prompt, DOM.leadInsightsArea, 'lead_insights');
}

async function getLeadHistorySummary(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.leadHistorySummaryArea.textContent = "Erro: Lead não encontrado.";
        return;
    }

    let historyText = `Resumo do Lead: ${lead.nome_empresa}, Status: ${lead.status_lead}, Score: ${lead.lead_score}.\n`;
    historyText += `Observações do Usuário:\n${lead.observacoes_usuario || "Nenhuma"}\n\n`;
    historyText += `Histórico de Interações com IA:\n`;
    if (lead.interacoes_ia && lead.interacoes_ia.length > 0) {
        lead.interacoes_ia.forEach(interaction => {
            historyText += `- ${interaction.role === 'user' ? 'Lead' : 'Assistente IA'}: ${interaction.parts[0].text}\n`;
        });
    } else {
        historyText += "Nenhuma interação registrada.\n";
    }
    historyText += `\nData Criação: ${lead.data_criacao || 'N/A'}. Última Tarefa: ${lead.tipo_tarefa || 'N/A'} em ${lead.data_tarefa || 'N/A'} (Resposta: ${lead.resposta_tarefa || 'N/A'}). Próxima Tarefa: ${lead.proxima_tarefa_data || 'N/A'}.`;


    const prompt = `Você é um assistente de CRM. Analise o seguinte histórico de um lead e forneça um resumo conciso (máximo 3-4 frases) dos pontos mais importantes e da evolução do lead.
    Histórico:
    ${historyText}
    ---
    Foque nos principais eventos, mudanças de status, e o sentimento geral das interações. O resumo deve estar em português do Brasil.`;
    generateGeminiContent(prompt, DOM.leadHistorySummaryArea, 'history_summary');
}

async function customizeSalesPitch(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    const originalPitch = DOM.scriptModalContent.textContent;
    const painPoints = DOM.leadPainPointsInput.value.trim();

    if (!lead || !originalPitch || originalPitch.startsWith("Aguarde") || originalPitch.startsWith("Erro")) {
        DOM.customizedScriptArea.textContent = "Erro: Guião original ou lead não encontrado para personalização.";
        return;
    }
    if (!painPoints) {
        DOM.customizedScriptArea.textContent = "Por favor, insira os pontos de dor ou interesses do lead para personalizar.";
        return;
    }

    const prompt = `Você é um especialista em vendas. Personalize o seguinte guião de contato para o lead "${lead.nome_empresa}", incorporando os seguintes pontos de dor/interesses específicos mencionados: "${painPoints}".
    Guião Original:
    ---
    ${originalPitch}
    ---
    Mantenha o tom e o objetivo do guião original, mas ajuste a argumentação para ressoar com os pontos fornecidos. O guião personalizado deve estar em português do Brasil.`;

    generateGeminiContent(prompt, DOM.customizedScriptArea, 'customize_pitch');
}

async function getSentimentAnalysis(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.leadSentimentArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    let lastMeaningfulInteraction = "Nenhuma interação recente para análise.";

    if (lead.interacoes_ia && lead.interacoes_ia.length > 0) {
        // Find the last user (lead) message
        for (let i = lead.interacoes_ia.length - 1; i >= 0; i--) {
            if (lead.interacoes_ia[i].role === 'user') {
                lastMeaningfulInteraction = lead.interacoes_ia[i].parts[0].text;
                break;
            }
        }
    } else if (lead.resposta_tarefa && lead.resposta_tarefa !== "---" && lead.resposta_tarefa !== "OUTRO") {
         lastMeaningfulInteraction = `Resposta à última tarefa: ${lead.resposta_tarefa}`;
    } else if (lead.observacoes_usuario) {
        // Try to get a snippet from user observations if it seems like a direct quote or summary of interaction
        const obsMatch = lead.observacoes_usuario.match(/Lead disse: "(.*?)"/i) || lead.observacoes_usuario.match(/Resposta do lead: (.*?)\n/i);
        if (obsMatch && obsMatch[1]) {
            lastMeaningfulInteraction = obsMatch[1];
        } else {
             lastMeaningfulInteraction = lead.observacoes_usuario.split('\n').pop().trim().slice(0,250); // Last line as a fallback
        }
    }


    if (lastMeaningfulInteraction === "Nenhuma interação recente para análise." || lastMeaningfulInteraction.length < 10) { // Too short to analyze
        DOM.leadSentimentArea.textContent = "Não há texto suficiente da última interação para uma análise de sentimento confiável.";
        return;
    }

    const prompt = `Analise o sentimento predominante na seguinte interação com um lead:
    "${lastMeaningfulInteraction}"
    Responda com uma única palavra ou frase curta (ex: Positivo, Negativo, Neutro, Interessado, Cético, Frustrado) e uma breve justificativa (1 frase). Em português do Brasil.`;
    generateGeminiContent(prompt, DOM.leadSentimentArea, 'sentiment_analysis');
}

async function generatePersonalizedFollowUp(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.generatedFollowUpArea.value = "Erro: Lead não encontrado.";
        return;
    }
    let context = `Lead: ${lead.nome_empresa}, Status: ${lead.status_lead}. `;
    if (lead.interacoes_ia && lead.interacoes_ia.length > 0) {
        const lastInteraction = lead.interacoes_ia[lead.interacoes_ia.length - 1];
        context += `Última interação IA (${lastInteraction.role}): "${lastInteraction.parts[0].text.slice(0,150)}...". `;
    }
    if (lead.observacoes_usuario) {
        context += `Observações recentes: "${lead.observacoes_usuario.slice(-150)}...". `;
    }
    if (lead.proxima_tarefa_data) {
        context += `Próxima tarefa agendada para: ${lead.proxima_tarefa_data}. `;
    }

    const prompt = `Você é um especialista em comunicação de vendas. Com base no seguinte contexto do lead, gere uma sugestão de mensagem de follow-up (email ou mensagem curta) para reengajar ou avançar a conversa.
    Contexto: ${context}
    A mensagem deve ser personalizada, relevante e ter um call-to-action claro, se apropriado. Formato: Email ou Mensagem Curta. Em português do Brasil.`;
    generateGeminiContent(prompt, DOM.generatedFollowUpArea, 'follow_up_generation');
}

async function getIndustryNews(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.industryNewsArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    // Assume the industry is "concessionárias de veículos" or "setor automotivo"
    const industry = "concessionárias de veículos no Brasil";

    const prompt = `Pesquise brevemente por 2-3 notícias recentes ou tópicos de discussão relevantes para ${industry}.
    Apresente cada um como um título curto seguido de uma frase de resumo.
    Essas informações podem ser usadas para iniciar conversas ou demonstrar conhecimento do setor ao falar com o lead ${lead.nome_empresa}. Em português do Brasil.`;
    generateGeminiContent(prompt, DOM.industryNewsArea, 'industry_news');
}

async function getMeetingPrepGuide(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.meetingPrepArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    let context = `Preparando para reunião com ${lead.nome_empresa} (Contato: ${lead.contato_nome || 'N/A'}, Cargo: ${lead.contato_cargo || 'N/A'}).
    Status atual: ${lead.status_lead}. Score: ${lead.lead_score}.
    Observações: ${lead.observacoes_usuario || "Nenhuma"}.
    Última interação IA: ${lead.interacoes_ia && lead.interacoes_ia.length > 0 ? lead.interacoes_ia[lead.interacoes_ia.length -1].parts[0].text.slice(0,100)+"..." : "Nenhuma"}.`;

    const prompt = `Você é um coach de vendas. Para uma próxima reunião com o lead descrito abaixo, forneça um breve guia de preparação:
    ${context}
    O guia deve incluir:
    1.  Objetivo Principal da Reunião (sugira um com base no status).
    2.  3 Pontos Chave para Abordar (relacionados aos benefícios da Auto Arremate para concessionárias).
    3.  2-3 Perguntas Inteligentes para Fazer ao Lead (para entender melhor suas necessidades).
    4.  Possível Objeção e como Contorná-la (sugira uma objeção comum e uma resposta).
    Seja prático e conciso. Em português do Brasil. Use markdown para formatação.`;
    generateGeminiContent(prompt, DOM.meetingPrepArea, 'meeting_prep');
}

async function getCompetitorAnalysis(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.competitorAnalysisArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    const prompt = `Para uma empresa como a Auto Arremate, que vende software para concessionárias de veículos, quais seriam 2-3 tipos de concorrentes comuns ou soluções alternativas que o lead "${lead.nome_empresa}" poderia estar usando ou considerando?
    Para cada um, mencione um breve ponto forte da Auto Arremate em comparação.
    Exemplo de Concorrente: Planilhas manuais. Ponto Forte Auto Arremate: Automação e redução de erros.
    Seja breve e direto. Em português do Brasil.`;
    generateGeminiContent(prompt, DOM.competitorAnalysisArea, 'competitor_analysis');
}

async function getNurturingSequence(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) {
        DOM.nurturingSequenceArea.textContent = "Erro: Lead não encontrado.";
        return;
    }
    let context = `Lead: ${lead.nome_empresa}. Status: ${lead.status_lead}. Interesses/Dores conhecidas (se houver): ${lead.observacoes_usuario ? lead.observacoes_usuario.slice(-100) : "Não especificado"}.`;
    if (lead.status_lead === "A Contatar" || lead.status_lead === "Contato Feito" || lead.temperatura_lead === "Frio" || lead.temperatura_lead === "Morno") {
        const prompt = `Sugira uma sequência de nurturing de 3 passos (curta) para o lead abaixo, que ainda não está pronto para comprar.
        Contexto: ${context}
        Cada passo deve ser uma ação ou tipo de conteúdo a ser enviado/realizado em intervalos (ex: 1 semana, 2 semanas).
        Exemplo de Passo: "Enviar um case de estudo relevante sobre X." ou "Convidar para um webinar sobre Y."
        O objetivo é manter o lead engajado e educá-lo sobre os benefícios da Auto Arremate. Em português do Brasil.`;
        generateGeminiContent(prompt, DOM.nurturingSequenceArea, 'nurturing_sequence');
    } else {
        DOM.nurturingSequenceArea.textContent = `O status atual do lead (${lead.status_lead}) pode não ser o ideal para uma sequência de nurturing padrão. Considere ações mais diretas ou personalizadas.`;
    }
}


// --- Confirmation Modal ---
function openConfirmationModal(title, message, onConfirmCallback) {
    document.getElementById('confirmationModalTitle').textContent = title;
    document.getElementById('confirmationModalMessage').textContent = message;

    const confirmBtn = DOM.confirmActionBtn;
    // Clone and replace to remove previous listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    DOM.confirmActionBtn = newConfirmBtn; // Update DOM cache

    DOM.confirmActionBtn.onclick = () => {
        onConfirmCallback();
        DOM.confirmationModal.classList.add('hidden');
    };
    // Customize button text/color if needed for delete
    if (title.toLowerCase().includes('excluir') || message.toLowerCase().includes('excluir')) {
        DOM.confirmActionBtn.className = 'action-button delete-lead-btn'; // Use delete style
        DOM.confirmActionBtn.textContent = 'Confirmar Exclusão';
    } else {
        DOM.confirmActionBtn.className = 'action-button bg-blue-500 hover:bg-blue-600'; // Default confirm style
        DOM.confirmActionBtn.textContent = 'Confirmar';
    }


    DOM.confirmationModal.classList.remove('hidden');
    DOM.confirmationModal.style.display = 'flex'; // Ensure it's flex for centering
}
