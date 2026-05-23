let records = JSON.parse(localStorage.getItem('budgetbuddy_data')) || [];
let currentFilter = 'All';
let currentSearchQuery = '';
let currentCategoryFilter = 'All';

const transactionForm      = document.getElementById('transactionForm');
const amountInput          = document.getElementById('amount');
const dateInput            = document.getElementById('date');
const descriptionInput     = document.getElementById('description');
const categorySelect       = document.getElementById('category');
const categoryGroup        = document.getElementById('categoryGroup');
const searchBar            = document.getElementById('searchBar');
const categoryFilter       = document.getElementById('categoryFilter');
const themeToggleBtn       = document.getElementById('themeToggle');
const accountBalanceEl     = document.getElementById('accountBalance');
const totalIncomeEl        = document.getElementById('totalIncome');
const totalExpenseEl       = document.getElementById('totalExpense');
const avgTransactionEl     = document.getElementById('avgTransaction');
const savingsRateEl        = document.getElementById('savingsRate');
const transactionsBody     = document.getElementById('transactionsBody');
const noTransactionsMessage= document.getElementById('noTransactionsMessage');
const donutSegment         = document.getElementById('donutSegment');
const highestExpensePctEl  = document.getElementById('highestExpensePct');
const highestExpenseNameEl = document.getElementById('highestExpenseName');

const errorLogs = {
    amount:      document.getElementById('amountError'),
    date:        document.getElementById('dateError'),
    description: document.getElementById('descriptionError'),
    category:    document.getElementById('categoryError')
};

const CATEGORY_META = {
    Food:     { icon: '🍔', label: 'Food & Dining' },
    Travel:   { icon: '🚗', label: 'Travel & Fuel' },
    Shopping: { icon: '🛍️', label: 'Shopping & Clothes' },
    Bills:    { icon: '🏠', label: 'Bills & Rent' },
    Others:   { icon: '📦', label: 'Others' },
    Income:   { icon: '💰', label: 'Income' }
};

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-exit'); toast.addEventListener('animationend', () => toast.remove(), { once: true }); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeThemeEngine();
    if (dateInput) setDefaultDateToToday();
    setupUserInteractionEvents();
    calculateAndRefreshSummary();
    if (transactionsBody) renderHistoryTable();
    renderRecentTransactions();
    updateNavBadge();
    if (!document.getElementById('bg-aura')) { const aura = document.createElement('div'); aura.id = 'bg-aura'; document.body.prepend(aura); }
});

function initializeThemeEngine() {
    const savedTheme = localStorage.getItem('budgetbuddy_theme');
    if (savedTheme) { document.documentElement.setAttribute('data-theme', savedTheme); }
    else { document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
}

function toggleApplicationTheme() {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('budgetbuddy_theme', t);
}

function setDefaultDateToToday() {
    const today = new Date().toLocaleDateString('en-CA');
    if (dateInput) { dateInput.max = today; dateInput.value = today; }
}

function setupUserInteractionEvents() {
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleApplicationTheme);
    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (categoryGroup && categorySelect) {
                if (e.target.value === 'Income') { categoryGroup.classList.add('hidden'); categorySelect.required = false; categorySelect.value = ''; }
                else { categoryGroup.classList.remove('hidden'); categorySelect.required = true; }
            }
            clearFormWarnings();
        });
    });
    if (transactionsBody) { transactionsBody.addEventListener('click', (e) => { if (e.target.classList.contains('btn-delete-row')) deleteItem(parseInt(e.target.dataset.id, 10)); }); }
    if (searchBar) { searchBar.addEventListener('input', (e) => { currentSearchQuery = e.target.value.toLowerCase().trim(); renderHistoryTable(); }); }
    if (categoryFilter) { categoryFilter.addEventListener('change', (e) => { currentCategoryFilter = e.target.value; renderHistoryTable(); }); }
    const filterGroup = document.querySelector('.filter-buttons-group');
    if (filterGroup) {
        filterGroup.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-tab')) {
                document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                renderHistoryTable();
            }
        });
    }
    const btnReset = document.getElementById('btnReset');
    if (btnReset) btnReset.addEventListener('click', clearAllStoredData);
    const btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.addEventListener('click', downloadBackupAsSpreadsheet);
}

function clearFormWarnings() { Object.values(errorLogs).forEach(el => { if (el) el.textContent = ''; }); }

function checkFormErrors() {
    clearFormWarnings();
    let isValid = true;
    if (amountInput) { const v = parseFloat(amountInput.value); if (isNaN(v) || v <= 0) { if (errorLogs.amount) errorLogs.amount.textContent = 'Please enter a valid amount greater than 0.'; isValid = false; } }
    if (dateInput && !dateInput.value) { if (errorLogs.date) errorLogs.date.textContent = 'Please select a date.'; isValid = false; }
    if (descriptionInput && !descriptionInput.value.trim()) { if (errorLogs.description) errorLogs.description.textContent = 'Please type a short description.'; isValid = false; }
    const checkedType = document.querySelector('input[name="type"]:checked');
    if ((!checkedType || checkedType.value === 'Expense') && categorySelect && !categorySelect.value) { if (errorLogs.category) errorLogs.category.textContent = 'Please pick a category.'; isValid = false; }
    return isValid;
}

if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!checkFormErrors()) return;
        const selectedType = (document.querySelector('input[name="type"]:checked') || {}).value || 'Expense';
        const newRecord = {
            id: Date.now(),
            amount: amountInput ? parseFloat(amountInput.value) : 0,
            date: dateInput ? dateInput.value : new Date().toLocaleDateString('en-CA'),
            type: selectedType,
            category: selectedType === 'Expense' ? (categorySelect ? categorySelect.value : 'Others') : 'Income Stream',
            description: descriptionInput ? descriptionInput.value.trim() : ''
        };
        records.push(newRecord);
        saveAndReload();
        if (amountInput) amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (categorySelect) categorySelect.value = '';
        setDefaultDateToToday();
        showToast(`${selectedType} added successfully!`, 'success');
    });
}

function deleteItem(id) { records = records.filter(item => item.id !== id); saveAndReload(); showToast('Entry deleted.', 'info'); }

function saveAndReload() {
    localStorage.setItem('budgetbuddy_data', JSON.stringify(records));
    calculateAndRefreshSummary();
    renderRecentTransactions();
    updateNavBadge();
}

function calculateAndRefreshSummary() {
    let earnedTotal = 0, spentTotal = 0;
    const categoryTotals = { Food: 0, Travel: 0, Shopping: 0, Bills: 0, Others: 0 };
    records.forEach(item => {
        if (item.type === 'Income') { earnedTotal += item.amount; }
        else { spentTotal += item.amount; if (Object.prototype.hasOwnProperty.call(categoryTotals, item.category)) categoryTotals[item.category] += item.amount; }
    });
    const currentBalance = earnedTotal - spentTotal;
    const avgAmount = records.length ? (records.reduce((s, i) => s + i.amount, 0) / records.length) : 0;
    const savingsPct = earnedTotal > 0 ? Math.max(0, (currentBalance / earnedTotal) * 100) : 0;
    const fmt = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
    if (accountBalanceEl) { accountBalanceEl.textContent = fmt(currentBalance); accountBalanceEl.className = `stat-number ${currentBalance >= 0 ? 'text-green' : 'text-red'}`; }
    if (totalIncomeEl) totalIncomeEl.textContent = fmt(earnedTotal);
    if (totalExpenseEl) totalExpenseEl.textContent = fmt(spentTotal);
    if (avgTransactionEl) avgTransactionEl.textContent = fmt(avgAmount);
    if (savingsRateEl) savingsRateEl.textContent = `${savingsPct.toFixed(1)}%`;
    let topLabel = 'None', topSum = 0;
    Object.entries(categoryTotals).forEach(([cat, total]) => {
        const vn = document.getElementById(`cat-${cat}`); if (vn) vn.textContent = fmt(total);
        const ratio = spentTotal > 0 ? (total / spentTotal) * 100 : 0;
        const fill = document.querySelector(`.progress-bar-item[data-category="${cat}"] .progress-fill`); if (fill) fill.style.width = `${ratio}%`;
        if (total > topSum) { topSum = total; topLabel = cat; }
    });
    const topPct = spentTotal > 0 ? Math.round((topSum / spentTotal) * 100) : 0;
    if (highestExpensePctEl) highestExpensePctEl.textContent = `${topPct}%`;
    if (highestExpenseNameEl) highestExpenseNameEl.textContent = topLabel === 'None' ? 'Top Category' : topLabel;
    if (donutSegment) donutSegment.style.strokeDasharray = `${topPct} ${100 - topPct}`;
    renderHistoryTable();
}

function renderRecentTransactions() {
    const container = document.getElementById('recentList');
    if (!container) return;
    const recent = [...records].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id).slice(0, 5);
    if (!recent.length) { container.innerHTML = '<div class="recent-empty">No transactions yet. Add your first entry above!</div>'; return; }
    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    container.innerHTML = recent.map(item => {
        const isIncome = item.type === 'Income';
        const catKey = isIncome ? 'Income' : (item.category || 'Others');
        const meta = CATEGORY_META[catKey] || CATEGORY_META.Others;
        let dateLabel = item.date;
        if (item.date && item.date.includes('-')) { const [y,m,d] = item.date.split('-'); dateLabel = new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'numeric',month:'short'}); }
        return `<div class="recent-item"><div class="recent-icon ${isIncome?'inc':'exp'}">${meta.icon}</div><div class="recent-meta"><div class="recent-desc">${escapeScriptPayloads(item.description||'')}</div><div class="recent-sub">${dateLabel} · <span class="cat-badge cat-${catKey}">${meta.label}</span></div></div><div class="recent-amount ${isIncome?'inc':'exp'}">${isIncome?'+':'−'}${fmt(item.amount)}</div></div>`;
    }).join('');
}

function renderHistoryTable() {
    if (!transactionsBody) return;
    const matched = records.filter(item => {
        const mf = currentFilter === 'All' || item.type === currentFilter;
        const mc = currentCategoryFilter === 'All' || item.category === currentCategoryFilter || (currentCategoryFilter === 'Income' && item.type === 'Income');
        const ms = (item.description||'').toLowerCase().includes(currentSearchQuery) || (item.category||'').toLowerCase().includes(currentSearchQuery);
        return mf && mc && ms;
    });
    const countEl = document.getElementById('resultsCount');
    if (countEl) countEl.innerHTML = matched.length === records.length ? `Showing <strong>${records.length}</strong> transaction${records.length !== 1 ? 's' : ''}` : `Showing <strong>${matched.length}</strong> of <strong>${records.length}</strong> transactions`;
    if (!matched.length) { transactionsBody.innerHTML = ''; if (noTransactionsMessage) noTransactionsMessage.style.display = 'block'; return; }
    if (noTransactionsMessage) noTransactionsMessage.style.display = 'none';
    const sorted = [...matched].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    transactionsBody.innerHTML = sorted.map(item => {
        let dateLabel = item.date;
        if (item.date && item.date.includes('-')) { const [y,m,d] = item.date.split('-'); dateLabel = new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
        const isIncome = item.type === 'Income';
        const catKey = isIncome ? 'Income' : (item.category || 'Others');
        const meta = CATEGORY_META[catKey] || CATEGORY_META.Others;
        return `<tr><td data-label="Date">${dateLabel}</td><td data-label="Description">${escapeScriptPayloads(item.description||'')}</td><td data-label="Category"><span class="cat-badge cat-${catKey}">${meta.icon} ${meta.label}</span></td><td data-label="Amount" class="${isIncome?'row-inc':'row-exp'}" style="text-align:right;">${isIncome?'+ ':'− '}${fmt(item.amount)}</td><td data-label="Action"><button class="btn-delete-row" data-id="${item.id}">Delete</button></td></tr>`;
    }).join('');
}

function updateNavBadge() { document.querySelectorAll('.nav-badge[data-badge="count"]').forEach(b => { b.textContent = records.length; }); }
function escapeScriptPayloads(text) { return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function clearAllStoredData() {
    if (confirm('Are you completely sure you want to delete all entries? This cannot be undone.')) {
        records = []; saveAndReload(); showToast('All data has been cleared.', 'error');
    }
}

function downloadBackupAsSpreadsheet() {
    const current = JSON.parse(localStorage.getItem('budgetbuddy_data')) || [];
    if (!current.length) { showToast('No data to backup yet!', 'info'); return; }
    const csv = [['Date','Type','Category','Description','Amount'].join(','), ...current.map(item => [item.date, item.type, item.category, `"${String(item.description||'').replace(/"/g,'""')}"`, item.amount].join(', **...**

_This response is too long to display in full._
