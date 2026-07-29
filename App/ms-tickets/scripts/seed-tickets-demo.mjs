// Demo de cache Redis para ms-tickets (ParkingApp).
//
// Crea personas, vehiculos, una zona y espacios, y luego crea tickets:
//   - 1ra pasada  -> Cache MISS de persona/vehiculo (se consulta a los MS y se cachea)
//   - 2da pasada  -> Cache HIT (se sirve desde Redis, mucho mas rapido)
//
// Uso:
//   npm run seed:tickets -- --count=20
//
// Revisa luego:
//   docker compose logs -f ms-tickets      (veras Cache HIT / MISS / SET)
//   docker exec -it redis-ticket redis-cli KEYS "*"
//   docker exec -it redis-ticket redis-cli DBSIZE

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};

const COUNT = parseInt(arg('count', '10'), 10);

const USUARIOS = process.env.MS_USUARIOS || 'http://localhost:8080';
const ZONAS = process.env.MS_ZONAS || 'http://localhost:8082';
const VEHICULOS = process.env.MS_VEHICULOS || 'http://localhost:3001';
const TICKETS = process.env.MS_TICKETS || 'http://localhost:3002';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letra = (n) => LETRAS[n % 26];
// Placa de auto valida: ^[A-Z]{3}-\d{4}$
const placaDe = (i) => `${letra(i)}${letra(Math.floor(i / 26) + 1)}A-${String(1000 + i).slice(-4)}`;
const dniDe = (i) => String(1700000000 + i);            // 10 digitos
const nombreDe = (i) => `Cliente ${letra(i)}${letra(Math.floor(i / 26))}`; // solo letras

let TOKEN = '';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
});

async function jsonOrText(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

async function login() {
  const res = await fetch(`${USUARIOS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (!res.ok) throw new Error(`Login admin fallo: HTTP ${res.status}`);
  TOKEN = (await res.json()).token;
}

async function ping() {
  const res = await fetch(`${ZONAS}/api/zonas`);
  const data = await jsonOrText(res);
  const n = Array.isArray(data) ? data.length : '?';
  console.log(`  ping GET /api/zonas ${res.ok ? 'OK' : 'FAIL'} (${n} zonas)`);
}

async function crearPersonas() {
  console.log('Creando personas...');
  let ok = 0;
  for (let i = 0; i < COUNT; i++) {
    const dni = dniDe(i);
    const res = await fetch(`${USUARIOS}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni,
        firstName: nombreDe(i),
        middleName: 'Demo',
        lastName: 'Cliente',
        email: `cliente${i}@demo.espe.edu.ec`,
        phone: `09${String(10000000 + i).slice(-8)}`,
        address: 'Sangolqui',
        nationality: 'Ecuatoriana',
        password: 'secret123',
      }),
    });
    if (res.ok) ok++;
    if ((i + 1) % 10 === 0 || i === COUNT - 1) console.log(`  personas: ${i + 1}/${COUNT} (ok~${ok})`);
  }
  console.log(`  personas listas: ~${ok}/${COUNT}`);
}

async function crearVehiculos() {
  console.log('Creando vehiculos...');
  const placas = [];
  let ok = 0;
  for (let i = 0; i < COUNT; i++) {
    const placa = placaDe(i);
    placas.push(placa);
    const res = await fetch(`${VEHICULOS}/vehiculos`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        tipo: 'Auto',
        datos: {
          marca: 'Toyota',
          placa,
          modelo: 'Corolla',
          color: 'Rojo',
          anio: 2020,
          numeroPuertas: 4,
          capacidadMaletero: 5,
        },
      }),
    });
    if (res.ok) ok++;
    if ((i + 1) % 10 === 0 || i === COUNT - 1) console.log(`  vehiculos: ${i + 1}/${COUNT} (ok~${ok})`);
  }
  console.log(`  vehiculos listos: ~${ok}/${COUNT}`);
  return placas;
}

async function crearZonaYEspacios() {
  console.log('Creando/obteniendo zona demo...');
  const sufijo = Math.random().toString(16).slice(2, 10);
  const nombreZona = `Zona Redis ${sufijo}`;
  const resZona = await fetch(`${ZONAS}/api/zonas`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ nombre: nombreZona, capacidad: Math.max(COUNT, 1), tipo: 'GENERAL' }),
  });
  const zona = await jsonOrText(resZona);
  if (!resZona.ok) throw new Error(`No se pudo crear la zona: ${JSON.stringify(zona)}`);
  console.log(`  zona creada: ${zona.nombre} (${zona.id})`);
  console.log(`Zona: ${zona.nombre} (${zona.id})`);

  const espacios = [];
  for (let i = 0; i < COUNT; i++) {
    const res = await fetch(`${ZONAS}/api/espacios`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nombre: `E-${i}`, tipo: 'AUTO', idZona: zona.id }),
    });
    const esp = await jsonOrText(res);
    if (res.ok) espacios.push(esp);
    if ((i + 1) % 10 === 0 || i === COUNT - 1) console.log(`  espacios: ${i + 1}/${COUNT}`);
  }
  console.log(`Espacios disponibles: ${espacios.length}`);
  return { nombreZona: zona.nombre, espacios };
}

async function crearTicket(placa, dni, idEspacio, nombreZona) {
  const t0 = Date.now();
  const res = await fetch(`${TICKETS}/tickets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ placa, dni, idEspacio, nombreZona }),
  });
  const body = await jsonOrText(res);
  const ms = Date.now() - t0;
  const msg = res.ok ? (body.id ? `ticket ${body.id.slice(0, 8)} OCUPADO` : 'ticket creado') : (body.message || `HTTP ${res.status}`);
  return { ok: res.ok, ms, msg, id: body?.id };
}

async function main() {
  console.log(`\nSeed tickets/Redis demo — count=${COUNT}\n`);
  console.log(`MS_ZONAS = ${ZONAS}/api`);
  await login();
  await ping();
  console.log('');

  await crearPersonas();
  const placas = await crearVehiculos();
  const { nombreZona, espacios } = await crearZonaYEspacios();
  console.log('');

  const n = Math.min(COUNT, placas.length, espacios.length);

  console.log('Creando tickets (1ra pasada = MISS, se cachea persona/vehiculo)...');
  const creados = [];
  for (let i = 0; i < n; i++) {
    const r = await crearTicket(placas[i], dniDe(i), espacios[i].id, nombreZona);
    if (r.ok && r.id) creados.push(r.id);
    console.log(`  #${i} create1 ${r.ms}ms -> ${r.msg}`);
  }

  console.log('\nCerrando tickets y recreando (debe haber HIT de persona/vehiculo)...');
  for (const id of creados) {
    await fetch(`${TICKETS}/tickets/${id}`, { method: 'PATCH', headers: authHeaders(), body: '{}' });
  }
  for (let i = 0; i < n; i++) {
    const r = await crearTicket(placas[i], dniDe(i), espacios[i].id, nombreZona);
    console.log(`  retry #${i} ${r.ms}ms -> ${r.msg}`);
  }

  console.log('\nListo. Revisa:');
  console.log('  - Logs Nest:  docker compose logs -f ms-tickets   (Cache HIT / MISS / SET)');
  console.log('  - docker exec -it redis-ticket redis-cli KEYS "*"');
  console.log('  - docker exec -it redis-ticket redis-cli DBSIZE');
}

main().catch((e) => {
  console.error('\nError en el seed:', e.message);
  process.exit(1);
});
