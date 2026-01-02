// Configuração do Supabase
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

// Inicializar data atual
document.getElementById('date').valueAsDate = new Date();

// Carregar configurações e transações
let transactions = [];

// Carregar configuração salva
function loadConfig() {
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    
    if (savedUrl && savedKey) {
        SUPABASE_URL = savedUrl;
        SUPABASE_KEY = savedKey;
        document.getElementById('supabaseUrl').value = savedUrl;
        document.getElementById('supabaseKey').value = savedKey;
        initSupabase();
    }
}

// Salvar configuração
function saveConfig() {
    SUPABASE_URL = document.getElementById('supabaseUrl').value.trim();
    SUPABASE_KEY = document.getElementById('supabaseKey').value.trim();
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        alert('Por favor, preencha ambos os campos de configuração.');
        return;
    }
    
    localStorage.setItem('supabaseUrl', SUPABASE_URL);
    localStorage.setItem('supabaseKey', SUPABASE_KEY);
    
    alert('Configuração salva com sucesso!');
    initSupabase();
}

// Inicializar Supabase
function initSupabase() {
    // Carregar biblioteca do Supabase se não estiver carregada
    if (!window.supabase) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.onload = function() {
            setupSupabase();
        };
        document.head.appendChild(script);
    } else {
        setupSupabase();
    }
}

function setupSupabase() {
    try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase configurado com sucesso!');
        loadTransactions();
    } catch (error) {
        console.error('Erro ao configurar Supabase:', error);
        alert('Erro na configuração do Supabase. Verifique as credenciais.');
    }
}

// Carregar transações
async function loadTransactions() {
    if (!window.supabaseClient) {
        console.log('Supabase não configurado, usando localStorage');
        transactions = JSON.parse(localStorage.getItem('uberTransactions')) || [];
        updateUI();
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('transacoes')
            .select('*')
            .order('data', { ascending: false });
        
        if (error) throw error;
        
        transactions = data || [];
        updateUI();
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        // Fallback para localStorage
        transactions = JSON.parse(localStorage.getItem('uberTransactions')) || [];
        updateUI();
    }
}

// Salvar transação
async function saveTransaction(transaction) {
    // Primeiro salvar localmente
    transaction.id = Date.now();
    transactions.unshift(transaction);
    localStorage.setItem('uberTransactions', JSON.stringify(transactions));
    updateUI();
    
    // Tentar salvar no Supabase se configurado
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('transacoes')
                .insert([{
                    tipo: transaction.type,
                    categoria: transaction.category,
                    descricao: transaction.description,
                    valor: transaction.amount,
                    data: transaction.date
                }]);
            
            if (error) throw error;
            console.log('Salvo no Supabase também');
        } catch (error) {
            console.error('Erro ao salvar no Supabase:', error);
        }
    }
}

// Excluir transação
async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    
    // Remover localmente
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('uberTransactions', JSON.stringify(transactions));
    
    // Tentar remover do Supabase
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('transacoes')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
        } catch (error) {
            console.error('Erro ao excluir do Supabase:', error);
        }
    }
    
    updateUI();
}

// Manipular formulário
document.getElementById('transactionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;
    
    if (!type || !category || !amount || !date) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    const transaction = {
        type: type,
        category: category,
        description: description,
        amount: amount,
        date: date
    };
    
    saveTransaction(transaction);
    
    // Limpar formulário
    document.getElementById('transactionForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    
    alert('Transação adicionada com sucesso!');
});

// Atualizar interface
function updateUI() {
    // Calcular totais
    let totalEntradas = 0;
    let totalSaidas = 0;
    
    transactions.forEach(t => {
        if (t.tipo === 'entrada' || t.type === 'entrada') {
            totalEntradas += t.valor || t.amount;
        } else {
            totalSaidas += t.valor || t.amount;
        }
    });
    
    const saldoTotal = totalEntradas - totalSaidas;
    
    // Atualizar totais
    document.getElementById('saldoTotal').textContent = `R$ ${saldoTotal.toFixed(2)}`;
    document.getElementById('totalEntradas').textContent = `R$ ${totalEntradas.toFixed(2)}`;
    document.getElementById('totalSaidas').textContent = `R$ ${totalSaidas.toFixed(2)}`;
    
    // Cor do saldo
    const saldoElement = document.getElementById('saldoTotal');
    saldoElement.className = 'resumo-valor';
    saldoTotal > 0 ? saldoElement.classList.add('positivo') : 
    saldoTotal < 0 ? saldoElement.classList.add('negativo') : '';
    
    // Listar transações
    const transactionsList = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>Nenhuma transação registrada ainda.</p>
                <p>Adicione sua primeira transação usando o formulário ao lado.</p>
            </div>
        `;
        return;
    }
    
    let transactionsHTML = '';
    const categoryNames = {
        'corrida': 'Corrida',
        'combustivel': 'Combustível',
        'manutencao': 'Manutenção',
        'alimentacao': 'Alimentação',
        'estacionamento': 'Estacionamento',
        'lavagem': 'Lavagem',
        'outros': 'Outros'
    };
    
    transactions.forEach(t => {
        const tipo = t.tipo || t.type;
        const categoria = t.categoria || t.category;
        const descricao = t.descricao || t.description || 'Sem descrição';
        const valor = t.valor || t.amount;
        const data = t.data || t.date;
        const id = t.id;
        
        const formattedDate = new Date(data).toLocaleDateString('pt-BR');
        const formattedAmount = valor.toFixed(2);
        
        transactionsHTML += `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-categoria">${categoryNames[categoria] || categoria}</div>
                    <div class="transaction-descricao">${descricao}</div>
                    <div class="transaction-data">${formattedDate}</div>
                </div>
                <div class="transaction-valor ${tipo === 'entrada' ? 'transaction-entrada' : 'transaction-saida'}">
                    ${tipo === 'entrada' ? '+' : '-'} R$ ${formattedAmount}
                </div>
                <button class="delete-btn" onclick="handleDelete(${id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    transactionsList.innerHTML = transactionsHTML;
}

// Inicializar
loadConfig();