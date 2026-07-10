const API_ESPACIOS = "http://localhost:8082/api/espacios";
const SSE_TICKETS_URL = "http://localhost:3002/sse/eventos";
const SSE_ZONAS_URL = "http://localhost:8082/api/espacios/sse";

// DOM Elements
const container = document.getElementById('espaciosContainer');
const totalSpan = document.getElementById('totalEspacios');
const lastUpdateSpan = document.getElementById('lastUpdate');
const btnRefresh = document.getElementById('btnRefresh');

// Connection DOM elements - Tickets
const statusTextTickets = document.getElementById('statusTextTickets');
const indPulseTickets = document.getElementById('indPulseTickets');
const indColorTickets = document.getElementById('indColorTickets');
const ticketsLog = document.getElementById('ticketsEventLog');
const btnClearTickets = document.getElementById('clearTicketsLog');

// Connection DOM elements - Zonas
const statusTextZonas = document.getElementById('statusTextZonas');
const indPulseZonas = document.getElementById('indPulseZonas');
const indColorZonas = document.getElementById('indColorZonas');
const zonasLog = document.getElementById('zonasEventLog');
const btnClearZonas = document.getElementById('clearZonasLog');

// Helper to format date
const formatTime = (date = new Date()) => {
    return date.toLocaleTimeString('es-ES', { hour12: false });
};

// Set Connection status helpers
const setConnectionStatus = (service, connected) => {
    const pulse = service === 'tickets' ? indPulseTickets : indPulseZonas;
    const color = service === 'tickets' ? indColorTickets : indColorZonas;
    const text = service === 'tickets' ? statusTextTickets : statusTextZonas;

    if (connected) {
        pulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
        color.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 pulse-green';
        text.textContent = 'Conectado';
        text.className = 'text-xs font-semibold text-emerald-400';
    } else {
        pulse.className = 'absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-0';
        color.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500';
        text.textContent = 'Desconectado';
        text.className = 'text-xs font-medium text-slate-400';
    }
};

// Log logger helpers
const addLogEntry = (container, serviceName, eventName, data) => {
    // If it's the default placeholder, clear it
    if (container.querySelector('.italic')) {
        container.innerHTML = '';
    }

    const time = formatTime();
    const entry = document.createElement('div');
    entry.className = 'log-entry p-2 bg-slate-900/60 rounded border border-slate-800 flex flex-col gap-1';
    
    let badgeColor = 'bg-blue-900/40 text-blue-300 border-blue-800/50';
    if (serviceName === 'ms-zonas') {
        badgeColor = 'bg-purple-900/40 text-purple-300 border-purple-800/50';
    }
    if (eventName === 'Error' || eventName === 'Desconectado') {
        badgeColor = 'bg-red-900/40 text-red-300 border-red-800/50';
    } else if (eventName === 'INIT' || eventName === 'Conectado') {
        badgeColor = 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50';
    }

    let payloadString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Create clean readable description if possible
    let detailMsg = '';
    if (data.idEspacio || data.id) {
        const id = (data.idEspacio || data.id).slice(0, 8);
        const estado = data.estado || 'N/A';
        const nombre = data.nombre || '';
        detailMsg = `<span class="text-slate-400">Espacio:</span> <strong class="text-slate-200">${nombre || id}</strong> | <span class="text-slate-400">Estado:</span> <span class="px-1.5 py-0.2 text-[10px] font-semibold rounded ${estado === 'DISPONIBLE' ? 'bg-emerald-950 text-emerald-400' : estado === 'OCUPADO' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}">${estado}</span>`;
    } else {
        detailMsg = `<span class="text-slate-300">${payloadString}</span>`;
    }

    entry.innerHTML = `
        <div class="flex justify-between items-center text-[10px]">
            <span class="px-1.5 py-0.5 rounded border ${badgeColor} font-semibold">${eventName}</span>
            <span class="text-slate-500">${time}</span>
        </div>
        <div class="text-[11px] mt-1 text-slate-300">${detailMsg}</div>
    `;

    container.appendChild(entry);
    
    // Limit to last 50 entries
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
    
    // Auto Scroll to bottom
    container.scrollTop = container.scrollHeight;
};

// Fetch API espaces
const fetchEspacios = async () => {
    try {
        const response = await fetch(API_ESPACIOS);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error al obtener espacios:', error);
        return null;
    }
};

// Render espaces cards
const renderizarEspacios = (espacios) => {
    if (!espacios || espacios.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-slate-900/20 rounded-xl border border-slate-800">
                <span class="text-3xl">📭</span>
                <p class="text-slate-400 mt-2">No hay espacios de estacionamiento disponibles</p>
            </div>
        `;
        totalSpan.textContent = '0 espacios';
        return;
    }

    const html = espacios.map((esp) => {
        const estadoClass = esp.estado.toLowerCase(); // disponible, ocupado, reservado
        
        let statusBadge = '';
        if (esp.estado === 'DISPONIBLE') {
            statusBadge = 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40';
        } else if (esp.estado === 'OCUPADO') {
            statusBadge = 'bg-red-900/40 text-red-300 border border-red-800/40';
        } else {
            statusBadge = 'bg-amber-900/40 text-amber-300 border border-amber-800/40';
        }

        return `
            <div class="espacio-card ${estadoClass} rounded-xl p-5 flex flex-col justify-between h-[135px]">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-extrabold text-base text-slate-100 tracking-tight">${esp.nombre || 'Sin nombre'}</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Zona: ${esp.nombreZona || 'N/A'}</p>
                    </div>
                    <span class="text-xs text-slate-500 font-mono">#${esp.id.slice(0, 5)}</span>
                </div>
                
                <div class="flex justify-between items-center mt-4">
                    <span class="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${statusBadge}">
                        ${esp.estado}
                    </span>
                    <span class="text-[10px] text-slate-400 font-semibold bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                        🚗 ${esp.tipo || 'N/A'}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    totalSpan.textContent = `${espacios.length} espacios`;
    lastUpdateSpan.textContent = `${formatTime()}`;
};

// Main Load call
const cargarEspacios = async () => {
    const data = await fetchEspacios();
    if (data) {
        renderizarEspacios(data);
    }
};

// SSE Connection to ms-tickets
const conectarSseTickets = () => {
    const eventSource = new EventSource(SSE_TICKETS_URL);

    eventSource.onopen = () => {
        console.log('SSE ms-tickets: conectado');
        setConnectionStatus('tickets', true);
        addLogEntry(ticketsLog, 'ms-tickets', 'Conectado', 'Conexión establecida con ms-tickets');
    };

    // Generic messages
    eventSource.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('SSE ms-tickets recibido:', payload);
            addLogEntry(ticketsLog, 'ms-tickets', payload.type || 'message', payload.data || payload);
            cargarEspacios();
        } catch (e) {
            console.error('Error parseando SSE ms-tickets:', e);
        }
    };

    // Custom named event mapping
    eventSource.addEventListener('espacio_actualizado', (event) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('SSE ms-tickets (espacio_actualizado):', payload);
            addLogEntry(ticketsLog, 'ms-tickets', 'espacio_actualizado', payload.data || payload);
            cargarEspacios();
        } catch (e) {
            console.error('Error parseando espacio_actualizado:', e);
        }
    });

    eventSource.onerror = (error) => {
        console.error('SSE ms-tickets error:', error);
        setConnectionStatus('tickets', false);
        addLogEntry(ticketsLog, 'ms-tickets', 'Error', 'Fallo de conexión. Reintentando...');
        eventSource.close();
        setTimeout(conectarSseTickets, 5000);
    };

    return eventSource;
};

// SSE Connection to ms-zonas-espacios
const conectarSseZonas = () => {
    const eventSource = new EventSource(SSE_ZONAS_URL);

    eventSource.onopen = () => {
        console.log('SSE ms-zonas-espacios: conectado');
        setConnectionStatus('zonas', true);
        addLogEntry(zonasLog, 'ms-zonas', 'Conectado', 'Conexión establecida con ms-zonas-espacios');
    };

    // Listen to space status change event
    eventSource.addEventListener('espacio_cambiado', (event) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('SSE ms-zonas (espacio_cambiado):', payload);
            addLogEntry(zonasLog, 'ms-zonas', 'espacio_cambiado', payload);
            cargarEspacios();
        } catch (e) {
            console.error('Error parseando espacio_cambiado:', e);
        }
    });

    // Listen to initial connection welcome event
    eventSource.addEventListener('INIT', (event) => {
        console.log('SSE ms-zonas (INIT):', event.data);
        addLogEntry(zonasLog, 'ms-zonas', 'INIT', event.data);
    });

    eventSource.onerror = (error) => {
        console.error('SSE ms-zonas error:', error);
        setConnectionStatus('zonas', false);
        addLogEntry(zonasLog, 'ms-zonas', 'Error', 'Fallo de conexión. Reintentando...');
        eventSource.close();
        setTimeout(conectarSseZonas, 5000);
    };

    return eventSource;
};

// Setup log cleaners and refresh button
btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    btnRefresh.classList.add('opacity-50');
    await cargarEspacios();
    btnRefresh.disabled = false;
    btnRefresh.classList.remove('opacity-50');
});

btnClearTickets.addEventListener('click', () => {
    ticketsLog.innerHTML = '<div class="text-slate-500 italic text-center py-4">Esperando eventos...</div>';
});

btnClearZonas.addEventListener('click', () => {
    zonasLog.innerHTML = '<div class="text-slate-500 italic text-center py-4">Esperando eventos...</div>';
});

// App Entry Point
(async () => {
    // Initial fetch of spaces
    await cargarEspacios();

    // Connect to both SSE Streams
    conectarSseTickets();
    conectarSseZonas();

    // Polling backup every 30s in case SSE is fully down
    setInterval(cargarEspacios, 30000);
})();
