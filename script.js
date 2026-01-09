// Configuration
const CONFIG = {
    updateInterval: 5000, // 5 seconds - reduced frequency to ease load on miners
    maxDataPoints: 20,
    requestTimeout: 20000, // 20 second timeout per request
    maxRetries: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // 1 second delay between retries
    staggerDelay: 500 // 500ms delay between each miner update
};

// Data storage
let miners = [];
let updateIntervalId = null; // Track interval to prevent duplicates
let totalChartData = {
    labels: [],
    datasets: []
};

// Dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    const toggle = document.getElementById('dark-mode-toggle');
    const icon = toggle.querySelector('i');
    const text = toggle.querySelector('span');
    
    if (isDark) {
        icon.className = 'bi-sun-fill';
        text.textContent = 'Light';
    } else {
        icon.className = 'bi-moon-stars-fill';
        text.textContent = 'Dark';
    }
}

// Load dark mode preference on page load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            const icon = toggle.querySelector('i');
            const text = toggle.querySelector('span');
            icon.className = 'bi-sun-fill';
            text.textContent = 'Light';
        }
    }
});

let totalChartInstance = null;
let minerCharts = {};
let isHistoryMode = false;
let currentTimeRange = 'live';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeCharts();
    loadSavedMiners();
    startAutoUpdate();
});

// Event Listeners
function initializeEventListeners() {
    document.getElementById('add-miner').addEventListener('click', addMiner);
    document.getElementById('sort-miners').addEventListener('change', sortMiners);
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
    
    // History time range selector
    document.querySelectorAll('input[name="timeRange"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentTimeRange = e.target.value;
            handleTimeRangeChange(e.target.value);
        });
    });
    
    // Allow Enter key to add miner
    document.getElementById('miner-ip').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addMiner();
    });
}

// Miner Management
function addMiner() {
    const ip = document.getElementById('miner-ip').value.trim();
    const name = document.getElementById('miner-name').value.trim() || `Miner-${ip}`;
    
    if (!ip) {
        alert('Please enter a miner IP address');
        return;
    }
    
    if (!isValidIP(ip)) {
        alert('Please enter a valid IP address');
        return;
    }
    
    if (miners.find(m => m.ip === ip)) {
        alert('This miner is already added');
        return;
    }
    
    const miner = {
        id: Date.now(),
        ip: ip,
        name: name,
        status: 'online',
        hashrate: 0,
        shares: 0,
        acceptedShares: 0,
        bestDifficulty: 0,
        lastShare: null,
        uptime: 0,
        temperature: 0,
        addedAt: new Date().toISOString(),        consecutiveFailures: 0,
        lastSuccessTime: null,
        nextRetryTime: 0,        history: {
            labels: [],
            hashrate: []
        }
    };
    
    miners.push(miner);
    renderMiner(miner);
    saveMiners();
    updateTotalStats();
    
    // Clear inputs
    document.getElementById('miner-ip').value = '';
    document.getElementById('miner-name').value = '';
}

function removeMiner(id) {
    if (!confirm('Are you sure you want to remove this miner?')) return;
    
    miners = miners.filter(m => m.id !== id);
    document.getElementById(`miner-${id}`).remove();
    
    // Destroy chart if exists
    if (minerCharts[id]) {
        minerCharts[id].destroy();
        delete minerCharts[id];
    }
    
    saveMiners();
    updateTotalStats();
}

function renderMiner(miner) {
    const container = document.getElementById('miners-container');
    const minerCard = document.createElement('div');
    minerCard.className = 'col-md-6 col-lg-4';
    minerCard.id = `miner-${miner.id}`;
    
    const addedDate = new Date(miner.addedAt).toLocaleString();
    
    minerCard.innerHTML = `
        <div class="miner-card ${miner.status}">
            <div class="miner-header">
                <div>
                    <h3 class="miner-name">${miner.name}</h3>
                    <div class="miner-ip">${miner.ip}</div>
                    <div class="miner-added"><i class="bi-calendar-plus"></i> Added: ${addedDate}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="status-badge ${miner.status}">
                        <span class="status-indicator ${miner.status}"></span>
                        ${miner.status}
                    </span>
                    <button class="remove-miner" onclick="removeMiner(${miner.id})">
                        <i class="bi-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="miner-stats">
                <div class="stat-item">
                    <div class="stat-label">Hashrate</div>
                    <div class="stat-value" id="miner-${miner.id}-hashrate">0 KH/s</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Accepted Shares</div>
                    <div class="stat-value" id="miner-${miner.id}-accepted">0</div>
                </div>
            </div>
            
            <div class="miner-chart">
                <canvas id="chart-${miner.id}"></canvas>
            </div>
        </div>
    `;
    
    container.appendChild(minerCard);
    initializeMinerChart(miner.id);
}

// Chart Management
function initializeCharts() {
    const totalCtx = document.getElementById('total-chart');
    if (totalCtx) {
        totalChartInstance = new Chart(totalCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Hashrate (H/s)',
                    data: [],
                    borderColor: '#00844B',
                    backgroundColor: 'rgba(0, 132, 75, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: getChartOptions('Total Hashrate Over Time')
        });
    }
}

function initializeMinerChart(minerId) {
    const ctx = document.getElementById(`chart-${minerId}`);
    if (!ctx) return;
    
    minerCharts[minerId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Hashrate (H/s)',
                data: [],
                borderColor: '#0361BF',
                backgroundColor: 'rgba(3, 97, 191, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Hashrate', false)
    });
}

function getChartOptions(title, showLegend = true) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: showLegend,
                position: 'top'
            },
            title: {
                display: true,
                text: title,
                font: {
                    size: 14,
                    weight: 600
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value + ' KH/s';
                    }
                }
            },
            x: {
                display: true,
                ticks: {
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };
}

function updateMinerChart(minerId, miner) {
    const chart = minerCharts[minerId];
    if (!chart) return;
    
    const now = new Date().toLocaleTimeString();
    
    // Add new data point
    if (miner.history.labels.length >= CONFIG.maxDataPoints) {
        miner.history.labels.shift();
        miner.history.hashrate.shift();
    }
    
    miner.history.labels.push(now);
    miner.history.hashrate.push(miner.hashrate);
    
    chart.data.labels = miner.history.labels;
    chart.data.datasets[0].data = miner.history.hashrate;
    chart.update('none'); // Update without animation for smooth updates
}

function updateTotalChart() {
    if (!totalChartInstance) return;
    
    const now = new Date().toLocaleTimeString();
    const totalHashrate = miners.reduce((sum, m) => sum + (m.status === 'online' ? m.hashrate : 0), 0);
    
    if (totalChartData.labels.length >= CONFIG.maxDataPoints) {
        totalChartData.labels.shift();
        totalChartData.datasets[0]?.data.shift();
    }
    
    totalChartData.labels.push(now);
    if (!totalChartData.datasets[0]) {
        totalChartData.datasets[0] = { data: [] };
    }
    totalChartData.datasets[0].data.push(totalHashrate);
    
    totalChartInstance.data.labels = totalChartData.labels;
    totalChartInstance.data.datasets[0].data = totalChartData.datasets[0].data;
    totalChartInstance.update('none');
}

// Data Fetching and Updates
async function fetchMinerData(miner, retryCount = 0) {
    try {
        // Fetch the main page and scrape it
        const proxyUrl = `/proxy?url=${encodeURIComponent(`http://${miner.ip}/`)}`;
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            cache: 'no-cache',
            signal: AbortSignal.timeout(CONFIG.requestTimeout)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ ${miner.name} (${miner.ip}) - Scraped data:`, data);
        
        // Reset failure counter on success
        miner.consecutiveFailures = 0;
        miner.lastSuccessTime = Date.now();
        miner.nextRetryTime = 0;
        
        // Return parsed data
        return {
            status: 'online',
            hashrate: parseFloat(data.hashrate || 0),
            shares: parseInt(data.shares || 0),
            acceptedShares: parseInt(data.acceptedShares || data.valids || Math.floor((data.shares || 0) * 0.95)),
            bestDifficulty: parseFloat(data.bestDiff || 0),
            temperature: parseInt(data.temp || 0),
            lastShare: null,
            uptime: parseInt(data.uptime || 0)
        };
    } catch (error) {
        // Retry logic with exponential backoff
        if (retryCount < CONFIG.maxRetries) {
            const delay = CONFIG.retryDelay * Math.pow(2, retryCount); // Exponential backoff
            console.warn(`⚠️ ${miner.name} (${miner.ip}) - Retry ${retryCount + 1}/${CONFIG.maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchMinerData(miner, retryCount + 1);
        }
        
        console.error(`❌ ${miner.name} (${miner.ip}) - Failed after ${retryCount} retries:`, error.message);
        
        // Track consecutive failures for exponential backoff
        miner.consecutiveFailures++;
        const backoffMinutes = Math.min(miner.consecutiveFailures, 5); // Max 5 minute backoff
        miner.nextRetryTime = Date.now() + (backoffMinutes * 60 * 1000);
        
        return {
            status: 'offline',
            hashrate: 0,
            shares: 0,
            acceptedShares: 0,
            bestDifficulty: 0,
            temperature: 0,
            lastShare: null,
            uptime: 0
        };
    }
}


async function updateMinerData(miner) {
    let data;
    try {
        data = await fetchMinerData(miner);
    } catch (error) {
        console.error(`Error fetching data for ${miner.name}:`, error);
        // Return current data as offline
        data = {
            status: 'offline',
            hashrate: 0,
            shares: miner.shares || 0,
            acceptedShares: miner.acceptedShares || 0,
            bestDifficulty: miner.bestDifficulty || 0,
            temperature: 0,
            lastShare: null,
            uptime: 0
        };
    }
    
    // Update miner object
    miner.status = data.status;
    miner.hashrate = data.hashrate;
    miner.shares = data.shares;
    miner.acceptedShares = data.acceptedShares;
    miner.bestDifficulty = data.bestDifficulty;
    miner.temperature = data.temperature;
    miner.lastShare = data.lastShare;
    miner.uptime = data.uptime;
    
    // Save to database
    saveMinerToDatabase(miner, data);
    
    // Update UI
    const minerCard = document.getElementById(`miner-${miner.id}`);
    if (minerCard) {
        const card = minerCard.querySelector('.miner-card');
        card.className = `miner-card ${miner.status}`;
        
        const statusBadge = minerCard.querySelector('.status-badge');
        statusBadge.className = `status-badge ${miner.status}`;
        statusBadge.innerHTML = `
            <span class="status-indicator ${miner.status}"></span>
            ${miner.status}
        `;
        
        document.getElementById(`miner-${miner.id}-hashrate`).textContent = `${miner.hashrate.toFixed(2)} H/s`;
        document.getElementById(`miner-${miner.id}-accepted`).textContent = miner.acceptedShares;
        document.getElementById(`miner-${miner.id}-shares`).textContent = miner.shares;
        document.getElementById(`miner-${miner.id}-diff`).textContent = miner.bestDifficulty.toFixed(3);
        document.getElementById(`miner-${miner.id}-temp`).textContent = `${miner.temperature}°C`;
    }
    
    // Update chart
    updateMinerChart(miner.id, miner);
}

function updateTotalStats() {
    const total = miners.length;
    const active = miners.filter(m => m.status === 'online').length;
    const offline = total - active;
    const totalHashrate = miners.reduce((sum, m) => sum + (m.status === 'online' ? m.hashrate : 0), 0);
    const totalAccepted = miners.reduce((sum, m) => sum + (m.acceptedShares || 0), 0);
    
    document.getElementById('total-miners').textContent = total;
    document.getElementById('active-miners').textContent = active;
    document.getElementById('offline-miners').textContent = offline;
    document.getElementById('total-hashrate').textContent = `${totalHashrate.toFixed(2)} H/s`;
    document.getElementById('total-accepted').textContent = totalAccepted;
    
    updateTotalChart();
}

async function updateAllMiners() {
    // Stagger updates to avoid overwhelming the network
    for (let i = 0; i < miners.length; i++) {
        const miner = miners[i];
        
        // Skip if in exponential backoff period
        if (miner.nextRetryTime && Date.now() < miner.nextRetryTime) {
            const waitMinutes = Math.ceil((miner.nextRetryTime - Date.now()) / 60000);
            console.log(`⏳ ${miner.name} - Skipping (backoff: ${waitMinutes}m remaining)`);
            continue;
        }
        
        // Update miner
        try {
            await updateMinerData(miner);
        } catch (err) {
            console.error(`Failed to update ${miner.name}:`, err);
        }
        
        // Add delay between miners
        if (i < miners.length - 1) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.staggerDelay));
        }
    }
    
    updateTotalStats();
    saveMiners();
}

function startAutoUpdate() {
    // Clear any existing interval
    if (updateIntervalId) {
        console.log('⚠️ Clearing existing update interval to prevent duplicates');
        clearInterval(updateIntervalId);
    }
    
    // Only start updates if not in history mode
    if (isHistoryMode) {
        console.log('📊 History mode active - live updates paused');
        return;
    }
    
    console.log(`✅ Starting auto-update every ${CONFIG.updateInterval / 1000}s (staggered with ${CONFIG.staggerDelay}ms delays)`);
    console.log(`⚙️ Request timeout: ${CONFIG.requestTimeout / 1000}s, Max retries: ${CONFIG.maxRetries}`);
    
    // Initial update
    updateAllMiners();
    
    // Set up interval
    updateIntervalId = setInterval(() => {
        updateAllMiners();
    }, CONFIG.updateInterval);
}

// Handle time range change
async function handleTimeRangeChange(range) {
    const statusEl = document.getElementById('history-status');
    
    if (range === 'live') {
        // Switch back to live mode
        isHistoryMode = false;
        statusEl.textContent = 'Showing live data - updates every 5 seconds';
        statusEl.className = 'text-muted mt-2';
        
        // Resume live updates
        startAutoUpdate();
    } else {
        // Switch to history mode
        isHistoryMode = true;
        
        // Stop live updates
        if (updateIntervalId) {
            clearInterval(updateIntervalId);
        }
        
        // Parse hours from range value
        const hours = parseInt(range);
        
        // Update status
        statusEl.innerHTML = '<i class="bi bi-hourglass-split"></i> Loading historical data...';
        statusEl.className = 'text-warning mt-2';
        
        try {
            // Load historical data
            await loadHistoricalData(hours);
            
            // Update status on success
            const rangeText = hours < 24 ? `${hours}h` : `${hours/24}d`;
            statusEl.innerHTML = `<i class="bi bi-clock-history"></i> Showing ${rangeText} of historical data`;
            statusEl.className = 'text-info mt-2';
        } catch (error) {
            console.error('Error loading historical data:', error);
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error loading historical data';
            statusEl.className = 'text-danger mt-2';
        }
    }
}

// Load historical data
async function loadHistoricalData(hours) {
    try {
        // Load total stats history
        const totalHistory = await loadTotalHistory(hours);
        
        // Update total chart with historical data
        if (totalHistory && totalHistory.length > 0) {
            updateTotalChartWithHistory(totalHistory);
        }
        
        // Load individual miner history
        const miners = JSON.parse(localStorage.getItem('miners') || '[]');
        for (const miner of miners) {
            const minerHistory = await loadMinerHistory(miner.ip, hours);
            if (minerHistory && minerHistory.length > 0) {
                updateMinerChartWithHistory(miner.ip, minerHistory);
            }
        }
    } catch (error) {
        console.error('Error in loadHistoricalData:', error);
        throw error;
    }
}

// Update total chart with historical data
function updateTotalChartWithHistory(historyData) {
    if (!totalChartInstance) return;
    
    if (!historyData || historyData.length === 0) {
        // No data - show empty chart
        totalChartInstance.data.labels = ['No data'];
        totalChartInstance.data.datasets[0].data = [0];
        totalChartInstance.update();
        return;
    }
    
    // Extract timestamps and values
    const labels = historyData.map(point => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    });
    
    const hashrates = historyData.map(point => point.total_hashrate || 0);
    
    // Update chart
    totalChartInstance.data.labels = labels;
    totalChartInstance.data.datasets[0].data = hashrates;
    totalChartInstance.update();
}

// Update individual miner chart with historical data
function updateMinerChartWithHistory(minerIp, historyData) {
    const chartInstance = minerCharts[minerIp];
    if (!chartInstance) return;
    
    if (!historyData || historyData.length === 0) {
        // No data - show empty chart
        chartInstance.data.labels = ['No data'];
        chartInstance.data.datasets[0].data = [0];
        chartInstance.update();
        return;
    }
    
    // Extract timestamps and values
    const labels = historyData.map(point => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    });
    
    const hashrates = historyData.map(point => point.hashrate || 0);
    
    // Update chart
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = hashrates;
    chartInstance.update();
}

// Local Storage
function saveMiners() {
    try {
        const minersData = miners.map(m => ({
            id: m.id,
            ip: m.ip,
            name: m.name,
            status: m.status,
            hashrate: m.hashrate,
            shares: m.shares,
            acceptedShares: m.acceptedShares,
            bestDifficulty: m.bestDifficulty,
            temperature: m.temperature,
            lastShare: m.lastShare,
            uptime: m.uptime,
            addedAt: m.addedAt,
            consecutiveFailures: m.consecutiveFailures || 0,
            lastSuccessTime: m.lastSuccessTime,
            nextRetryTime: m.nextRetryTime || 0
        }));
        localStorage.setItem('nerdminer-miners', JSON.stringify(minersData));
    } catch (error) {
        console.error('Error saving miners:', error);
    }
}

function loadSavedMiners() {
    try {
        const saved = localStorage.getItem('nerdminer-miners');
        if (saved) {
            const minersData = JSON.parse(saved);
            minersData.forEach(minerData => {
                const miner = {
                    ...minerData,
                    consecutiveFailures: minerData.consecutiveFailures || 0,
                    lastSuccessTime: minerData.lastSuccessTime || null,
                    nextRetryTime: minerData.nextRetryTime || 0,
                    history: {
                        labels: [],
                        hashrate: []
                    }
                };
                miners.push(miner);
                renderMiner(miner);
            });
            updateTotalStats();
        }
    } catch (error) {
        console.error('Error loading miners:', error);
    }
}

// Utility Functions
function isValidIP(ip) {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
    });
}

function generateMockHistory(points) {
    const history = [];
    const now = new Date();
    
    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now - i * 60000); // 1 minute intervals
        history.push({
            time: time.toLocaleTimeString(),
            hashrate: parseFloat((Math.random() * 1000).toFixed(2))
        });
    }
    
    return history;
}

// Sorting function
function sortMiners() {
    const sortBy = document.getElementById('sort-miners').value;
    const container = document.getElementById('miners-container');
    
    miners.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'ip':
                return a.ip.localeCompare(b.ip, undefined, { numeric: true });
            case 'hashrate':
                return b.hashrate - a.hashrate; // Descending
            case 'status':
                return b.status.localeCompare(a.status); // Online first
            case 'added':
                return new Date(b.addedAt) - new Date(a.addedAt); // Newest first
            default:
                return 0;
        }
    });
    
    // Clear and re-render
    container.innerHTML = '';
    miners.forEach(miner => renderMiner(miner));
}

// Database functions
async function saveMinerToDatabase(miner, data) {
    try {
        await fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: miner.ip,
                name: miner.name,
                data: {
                    status: data.status,
                    hashrate: data.hashrate,
                    shares: data.shares,
                    acceptedShares: data.acceptedShares,
                    bestDiff: data.bestDifficulty,
                    temp: data.temperature,
                    uptime: data.uptime
                }
            })
        });
    } catch (error) {
        console.error('Failed to save to database:', error);
    }
}

async function loadMinerHistory(minerIp, hours = 24) {
    try {
        const response = await fetch(`/history/miner?ip=${encodeURIComponent(minerIp)}&hours=${hours}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to load history:', error);
        return [];
    }
}

async function loadTotalHistory(hours = 24) {
    try {
        const response = await fetch(`/history/total?hours=${hours}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to load total history:', error);
        return [];
    }
}

async function getDatabaseStats() {
    try {
        const response = await fetch('/db/stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const stats = await response.json();
        console.log('📊 Database Stats:', stats);
        return stats;
    } catch (error) {
        console.error('Failed to get database stats:', error);
        return null;
    }
}

// Make functions available globally
window.removeMiner = removeMiner;
