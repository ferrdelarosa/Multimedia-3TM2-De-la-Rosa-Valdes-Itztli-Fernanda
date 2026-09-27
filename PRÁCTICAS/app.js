// ======== Referencias UI (Interfaz de Usuario) ========
const chatEl   = document.getElementById('chat');
const statusEl = document.getElementById('status');
const hintEl   = document.getElementById('hint');
const micBtn   = document.getElementById('listen-button');
let esperandoTareaInformatica = false; // Variable de estado para esperar la respuesta 
// de qué tarea de informática necesita el usuario
// ======== Utilidades de UI (chat) ========
function appendMessage(side, text) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${side}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = side === 'user' ? 'Tú' : 'Sistema';
  wrap.appendChild(bubble); wrap.appendChild(meta);
  chatEl.appendChild(wrap);
  chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
}
const setHeardText = (t) => hintEl.textContent = t || 'Listo para escuchar…';
const setStatus = (t) => statusEl.textContent = t;

/*
Normalizamos el texto para facilitar la detección de palabras clave.
Convierte el texto a minúsculas y le quita acentos (diacríticos).
Uso de try/catch por compatibilidad: 
si el motor JS no soporta la clase  Unicode 
\p{Diacritic}, aplicamos un fallback clásico con rango Unicode.
*/

function normalizeSafe(s='') {
  const lower = s.toLowerCase().normalize('NFD');
  try { return lower.replace(/\p{Diacritic}/gu, '').trim(); }
  catch { return lower.replace(/[\u0300-\u036f]/g, '').trim(); }
}

// ======== Definimos AREAS y NECESIDADES
// Con esto Dividimos las distintas areas que van ligadas a una necesidad ========
const AREAS = {
  electronica: ['electronica','electrica','circuitos'],
  informatica: ['informatica','sistemas','computacion','programacion'],
  comunicaciones: ['comunicaciones','redes','telecomunicaciones'],
};
const NEEDS = ['tarea','practica','proyecto','examen','investigacion'];

// ======== Estado conversacional ========
const STATES = { IDLE:'IDLE', AWAKE:'AWAKE', AREA:'AREA' };
let state = STATES.IDLE;
let selectedArea = null;

// ======== Reconocimiento ========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function ensureRecognition() {
  if (!SpeechRecognition) {
    appendMessage('bot', 'Tu navegador no soporta reconocimiento de voz. Usa Chrome sobre HTTPS o localhost.');
    return null;
  }
  const rec = new SpeechRecognition();
  rec.lang = 'es-MX';
  rec.continuous = false;
  rec.interimResults = false;
  return rec;
}

function startListenOnce() {
  recognition = ensureRecognition();
  if (!recognition) return;

  setStatus(state === STATES.IDLE ? 'Escuchando (di “Escuela”)' : 'Escuchando…');
  setHeardText('Escuchando… habla ahora');
  micBtn.classList.add('listening');

  let huboResultado = false;

  recognition.onresult = (ev) => {
    huboResultado = true;
    const last = ev.results.length - 1;
    const transcript = ev.results[last][0].transcript || '';
    const norm = normalizeSafe(transcript);

    appendMessage('user', transcript);
    setHeardText(`Reconocido: "${transcript}"`);
    handleUtterance(norm);
  };

  recognition.onnomatch = () => {
    if (!huboResultado) appendMessage('bot','No entendí lo que dijiste.');
  };

  recognition.onerror = (e) => {
    console.warn('Speech error:', e);
    const map = {
      'no-speech':'No se detectó voz.',
      'audio-capture':'No hay audio o micrófono.',
      'not-allowed':'Permiso de micrófono denegado.',
      'aborted':'Reconocimiento cancelado.',
      'network':'Error de red del servicio de voz.'
    };
    appendMessage('bot', map[e.error] || `Error de reconocimiento: ${e.error}`);
    setStatus('Error / Pausado');
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
    if (!huboResultado && hintEl.textContent.includes('Escuchando…')) {
      appendMessage('bot','Voz no detectada.');
    }
    setHeardText('Listo para escuchar…');
    setStatus('Inactivo — di “Escuela”');
  };

  try { recognition.start(); } catch(e) { console.warn('start() ya fue llamado', e); }
}

// ======== Lógica conversacional ========
function detectArea(norm) {
  for (const [area, variants] of Object.entries(AREAS)) {
    if (variants.some(v => norm.includes(v))) return area;
  }
  return null;
}
function detectNeed(norm) {
  return NEEDS.find(w => norm.includes(w)) || null;
}

function handleUtterance(norm) {

// =======================
//  SEGUNDA RESPUESTA
// =======================
if (esperandoTareaInformatica) {

    if (norm.includes('programacion')) {
        const respuesta = 'Programación es el proceso de crear instrucciones para que una computadora ejecute tareas. Suelen usarse lenguajes como C, Python o Java.';
        appendMessage('bot', respuesta);
        speakOut(respuesta);
    }

    else if (norm.includes('redes')) {
        const respuesta = 'Las redes se encargan de conectar computadoras para compartir información. Involucran protocolos como TCP/IP y equipos como routers.';
        appendMessage('bot', respuesta);
        speakOut(respuesta);
    }

    else if (norm.includes('bases de datos') || norm.includes('bd')) {
        const respuesta = 'Una base de datos es un sistema que almacena y organiza información. Se maneja con SQL para realizar consultas y administración de datos.';
        appendMessage('bot', respuesta);
        speakOut(respuesta);
    }

    else {
        const respuesta = 'No entendí tu tipo de tarea. Prueba con: programación, redes o bases de datos.';
        appendMessage('bot', respuesta);
        speakOut(respuesta);
        
        // O puedes NO limpiar la variable para seguir preguntando.
    }

    // Limpiamos la espera para no repetir
    esperandoTareaInformatica = false;
    return; // <- muy importante regresar a la función principal 
    // para no procesar más lógica de estado en esta iteración
}

  // Comandos globales
  if (norm.includes('cancelar') || norm.includes('terminar') || norm.includes('salir')) {
    state = STATES.IDLE; selectedArea = null;
    appendMessage('bot','De acuerdo, finalizamos. Di “Escuela” para volver a empezar.');
     speakOut('De acuerdo, finalizamos. Di “Escuela” para volver a empezar.');
    return;
  }

  if (state === STATES.IDLE) {
    if (norm.includes('escuela')) {
      state = STATES.AWAKE;
      const text = '¿En qué área ocupas ayuda? (electrónica o informática)';
      appendMessage('bot', text);
      speakOut(text);
      setStatus('Activo — esperando área');
    } else {
      const text = 'Di “Escuela” para activar.';
      appendMessage('bot', text);
      speakOut(text);
    }
    return;
  }

  if (state === STATES.AWAKE) {
    const area = detectArea(norm);
    if (area) {
      selectedArea = area;
      state = STATES.AREA;
      const text = `Área ${area} seleccionada. ¿Qué necesitas? (tarea, práctica o proyecto)`;
      appendMessage('bot', text);
      speakOut(text);
      setStatus(`Área: ${area} — esperando necesidad`);
    } else {
      const text = 'No detecté el área. Opciones: electrónica , informática, comunicaciones.';
      appendMessage('bot', text);
      speakOut(text);
    }
    return;
  }

  if (state === STATES.AREA) {
    const need = detectNeed(norm);
    if (need) {
      const text = `Perfecto. Preparando recursos de ${selectedArea} para tu ${need}.`;
      appendMessage('bot', text);
      speakOut(text);
              // ======== RESPUESTAS POR ÁREA + NECESIDAD:
              //  Aqui codificamos las respuestas
              // -BDs, URL, Respuesta Texto, etc========
     
      //Tareas
       if (selectedArea === 'informatica' && need === 'tarea'){
            const msg = '¿Que tarea necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
        //Cambiamos el estado para esperar la respuesta de qué tarea de informática necesita el usuario
            esperandoTareaInformatica = true;
            return;
       }


       if (selectedArea === 'comunicaciones' && need === 'tarea'){
            const msg = '¿Que tarea necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
        if (selectedArea === 'electronica' && need === 'tarea'){
            const msg = '¿Que tarea necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
        }
        // Practicas.
      if (selectedArea === 'informatica' && need === 'practica'){
            const msg = '¿Que práctica necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
      }
       if (selectedArea === 'comunicaciones' && need === 'practica'){
            const msg = '¿Que práctica necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
        if (selectedArea === 'electronica' && need === 'practica') {
            const msg = '¿Que práctica necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
        //Proyectos
      if (selectedArea === 'informatica' && need === 'proyecto'){
            const msg = '¿Que proyecto necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
       if (selectedArea === 'comunicaciones' && need === 'proyecto'){
            const msg = '¿Que proyecto necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
        if (selectedArea === 'electronica' && need === 'proyecto'){
            const msg = '¿Que proyecto necesitas?';
            appendMessage('bot', msg);
            speakOut(msg);
       }
     
     
        setTimeout(() => {
        const done = 'Listo. Si ocupas algo más, di “Escuela” para volver a activar.';
        appendMessage('bot', done);
       speakOut(done);
        state = STATES.IDLE; selectedArea = null; setStatus('Inactivo — di “Escuela”');
      }, 900);
    } else {
      const text = '¿Es una tarea, práctica o proyecto?';
      appendMessage('bot', text);
      speakOut(text);
    }
    return;
  }
}

// ======== (Opcional) Hablar en voz alta ========
function speakOut(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-MX';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ======== Eventos ========
micBtn.addEventListener('click', startListenOnce);