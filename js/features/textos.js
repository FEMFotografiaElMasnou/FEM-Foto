// ═══════════════════════════════════
// TEXTOS — pantalla d'Admin per editar el diccionari i18n en calent (Fase 3)
// ═══════════════════════════════════
// No passa per l'editor de taules de Supabase (el camp JSON supera els 10.000
// caràcters i l'editor avisa de possibles problemes de rendiment): aquesta
// pantalla llegeix/escriu la taula app_texts directament amb el client JS,
// que no té aquesta limitació.
import { TRANSLATIONS, t, mergeTranslations, applyTranslations } from '../core/i18n.js';
import { sb, _dbMode, getClientForMode } from '../core/config.js';
import { showToast } from '../ui/toast.js';

let _textsSearchTerm = '';

// Unió de claus ca+es (per si alguna encara no existeix a un dels dos costats)
function _allKeys() {
  const set = new Set([...Object.keys(TRANSLATIONS.ca), ...Object.keys(TRANSLATIONS.es)]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function _escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderTextsList() {
  const el = document.getElementById('texts-list');
  if (!el) return;

  const all  = _allKeys();
  const term = _textsSearchTerm.trim().toLowerCase();
  const keys = term
    ? all.filter(k =>
        k.toLowerCase().includes(term) ||
        (TRANSLATIONS.ca[k] || '').toLowerCase().includes(term) ||
        (TRANSLATIONS.es[k] || '').toLowerCase().includes(term))
    : all;

  // El comptador només aporta informació quan hi ha un filtre actiu; sense
  // cerca, mostrar "336/336" és soroll que no diu res nou.
  const countEl = document.getElementById('texts-count');
  if (countEl) countEl.textContent = term ? `${keys.length} / ${all.length}` : '';

  if (keys.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>${t('no_texts_found')}</p></div>`;
    return;
  }

  el.innerHTML = keys.map(k => `
    <div class="text-row" data-key="${_escape(k)}" style="display:flex;gap:12px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--border);">
      <div class="text-key" title="${_escape(k)}" style="width:200px;flex-shrink:0;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);word-break:break-all;padding-top:9px;">${_escape(k)}</div>
      <textarea class="text-val" data-lang="ca" rows="1" style="flex:1;background:rgba(4,9,30,0.6);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-family:var(--font-body);font-size:13px;resize:vertical;min-height:34px;">${_escape(TRANSLATIONS.ca[k] || '')}</textarea>
      <textarea class="text-val" data-lang="es" rows="1" style="flex:1;background:rgba(4,9,30,0.6);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-family:var(--font-body);font-size:13px;resize:vertical;min-height:34px;">${_escape(TRANSLATIONS.es[k] || '')}</textarea>
    </div>
  `).join('');
}

export function filterTexts(term) {
  _textsSearchTerm = term || '';
  renderTextsList();
}

// Llegeix NOMÉS els camps CA/ES pintats en aquest moment a pantalla — un
// "diff" (clau→valor editat), no el diccionari sencer. Cada botó de desar
// l'aplica per sobre d'una lectura FRESCA de la BD (no de la còpia en
// memòria), perquè un canvi fet per algú altre entre la càrrega de la
// pàgina i aquest instant no es perdi.
function _collectEditedPairs() {
  const rows = document.querySelectorAll('#texts-list .text-row');
  const ca = {};
  const es = {};
  rows.forEach(row => {
    const key = row.getAttribute('data-key');
    const caInput = row.querySelector('[data-lang="ca"]');
    const esInput = row.querySelector('[data-lang="es"]');
    if (caInput) ca[key] = caInput.value;
    if (esInput) es[key] = esInput.value;
  });
  return { ca, es, count: rows.length };
}

// Llegeix el contingut ACTUAL (les 2 files) d'un client Supabase concret.
// Retorna null si falla (el crida ho interpreta com "no hi ha lectura fresca
// disponible, usa la còpia en memòria com a base").
async function _fetchAppTexts(client) {
  try {
    const { data, error } = await client.from('app_texts').select('lang,content');
    if (error || !data) return null;
    const out = {};
    data.forEach(row => { out[row.lang] = row.content || {}; });
    return out; // { ca: {...}, es: {...} }
  } catch (e) {
    return null;
  }
}

// Aplica el resultat localment (perquè es vegi a l'acte, sense recarregar)
function _applyLocally(caObj, esObj) {
  mergeTranslations('ca', caObj);
  mergeTranslations('es', esObj);
  applyTranslations();
  renderTextsList();
}

// ── Desar només a l'entorn actiu (Normal o Test, el que hi hagi triat ara) ──
export async function saveAllTexts() {
  const { ca: caEdits, es: esEdits, count } = _collectEditedPairs();
  if (count === 0) return; // res pintat (per ex. filtre buit): no hi ha res per desar

  const btn = document.getElementById('btn-save-texts');
  const originalLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = t('saving_generic'); }

  try {
    // Lectura fresca de l'entorn actiu just abans d'escriure (redueix la
    // finestra d'un possible xoc amb un altre canvi fet mentre teníem la
    // pàgina oberta, en lloc d'arrossegar la còpia carregada fa estona).
    const fresh  = await _fetchAppTexts(sb);
    const caBase = (fresh && fresh.ca) || TRANSLATIONS.ca;
    const esBase = (fresh && fresh.es) || TRANSLATIONS.es;
    const caObj  = { ...caBase, ...caEdits };
    const esObj  = { ...esBase, ...esEdits };

    const nowIso = new Date().toISOString();
    const [r1, r2] = await Promise.all([
      sb.from('app_texts').update({ content: caObj, updated_at: nowIso }).eq('lang', 'ca'),
      sb.from('app_texts').update({ content: esObj, updated_at: nowIso }).eq('lang', 'es'),
    ]);
    if (r1.error || r2.error) {
      console.error('saveAllTexts error:', r1.error || r2.error);
      showToast(t('texts_save_error'), 'error');
      return;
    }
    _applyLocally(caObj, esObj);
    showToast(t('texts_saved'), 'success');
  } catch (e) {
    console.error('saveAllTexts exception:', e);
    showToast(t('texts_save_error'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel || t('save_all_texts_btn'); }
  }
}

// ── Desar a Normal I Test alhora, siga quin siga l'entorn actiu ─────────────
// Llegeix el contingut REAL de cada entorn (l'actiu i el que no ho és) just
// abans d'escriure, i només hi aplica per sobre els teus canvis d'aquesta
// sessió. Així mai s'esborra una diferència que Normal i Test ja tinguessin
// entre ells en claus que no has tocat ara — ni per concurrència amb algú
// altre, ni per haver-la creat tu mateix en una sessió anterior.
export async function saveAllTextsToBoth() {
  const { ca: caEdits, es: esEdits, count } = _collectEditedPairs();
  if (count === 0) return;

  const btn = document.getElementById('btn-save-texts-both');
  const originalLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = t('saving_generic'); }

  try {
    const otherMode   = _dbMode === 'test' ? 'normal' : 'test';
    const otherClient = getClientForMode(otherMode);

    const [activeFresh, otherFresh] = await Promise.all([
      _fetchAppTexts(sb),
      otherClient ? _fetchAppTexts(otherClient) : Promise.resolve(null),
    ]);

    const activeCaObj = { ...((activeFresh && activeFresh.ca) || TRANSLATIONS.ca), ...caEdits };
    const activeEsObj = { ...((activeFresh && activeFresh.es) || TRANSLATIONS.es), ...esEdits };
    const otherCaObj  = { ...((otherFresh  && otherFresh.ca)  || TRANSLATIONS.ca), ...caEdits };
    const otherEsObj  = { ...((otherFresh  && otherFresh.es)  || TRANSLATIONS.es), ...esEdits };

    const nowIso = new Date().toISOString();
    const tasks = [
      sb.from('app_texts').update({ content: activeCaObj, updated_at: nowIso }).eq('lang', 'ca'),
      sb.from('app_texts').update({ content: activeEsObj, updated_at: nowIso }).eq('lang', 'es'),
    ];
    if (otherClient) {
      tasks.push(
        otherClient.from('app_texts').update({ content: otherCaObj, updated_at: nowIso }).eq('lang', 'ca'),
        otherClient.from('app_texts').update({ content: otherEsObj, updated_at: nowIso }).eq('lang', 'es'),
      );
    }

    const results  = await Promise.all(tasks);
    const anyError = results.find(r => r.error);
    if (anyError) {
      console.error('saveAllTextsToBoth error:', anyError.error);
      showToast(t('texts_save_error'), 'error');
      return;
    }
    // La sessió local reflecteix l'entorn actiu (no el "no actiu", que no s'hi veu ara)
    _applyLocally(activeCaObj, activeEsObj);
    showToast(t('texts_saved_both'), 'success');
  } catch (e) {
    console.error('saveAllTextsToBoth exception:', e);
    showToast(t('texts_save_error'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel || t('save_all_texts_both_btn'); }
  }
}

// Exponer en window las funciones usadas desde onclick del HTML
window.renderTextsList    = renderTextsList;
window.filterTexts        = filterTexts;
window.saveAllTexts       = saveAllTexts;
window.saveAllTextsToBoth = saveAllTextsToBoth;
