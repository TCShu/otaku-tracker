const USER_ID = 1;

// ─── Card data store (avoids encoding JSON in HTML attributes) ────────────────
const cardStore = {};
let cardStoreIdx = 0;

function storeCard(data) {
    const key = `c${cardStoreIdx++}`;
    cardStore[key] = data;
    return key;
}

// ─── Browse state ─────────────────────────────────────────────────────────────
let browseTimer  = null;
let topPage      = { anime: 1, manga: 1 };
let topExhausted = { anime: false, manga: false };
let browseMode   = 'default';
let currentLibFilter = 'All';

// ─── Detail page state ────────────────────────────────────────────────────────
let detailSeries   = null;
let detailMode     = 'add';    // 'add' | 'edit'
let detailProgress = 0;
let detailStatus   = 'Watching';
let detailRating   = null;
let detailBackView = 'add-series';

// ─── View management ─────────────────────────────────────────────────────────

function showView(name) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('view-hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + name).classList.remove('view-hidden');
    const navEl = document.getElementById('nav-' + name);
    if (navEl) navEl.classList.add('active');

    if (name === 'library')         loadLibrary('All');
    if (name === 'add-series')      initBrowse();
    if (name === 'recommendations') loadRecommendationsPage();
}

function goBack() {
    showView(detailBackView);
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────

async function loadStats() {
    try {
        const stats = await fetchJSON(`/library-stats/${USER_ID}`);
        document.getElementById('watching').textContent  = stats.watching;
        document.getElementById('completed').textContent = stats.completed;
        document.getElementById('planned').textContent   = stats.planned;
        document.getElementById('total').textContent     = stats.total;
    } catch (_) {}
    loadContinue();
}

async function loadContinue() {
    try {
        const all = await fetchJSON(`/library/${USER_ID}?status=Watching`);

        const watching = all.filter(i => i.type === 'anime');
        const reading  = all.filter(i => i.type !== 'anime');

        renderContinueList('continue-watching', watching, 'anime');
        renderContinueList('continue-reading',  reading,  'other');
    } catch (_) {}
}

function renderContinueList(containerId, items, kind) {
    const el = document.getElementById(containerId);
    if (!items.length) {
        const label = kind === 'anime' ? 'watching' : 'reading';
        el.innerHTML = `<p class="continue-empty">Nothing ${label} right now. <span class="continue-add" onclick="showView('add-series')">Add a series →</span></p>`;
        return;
    }
    el.innerHTML = items.map(item => {
        const total = item.total_episodes || item.total_chapters || null;
        const prog  = item.progress || 0;
        const pct   = total ? Math.min(100, Math.round((prog / total) * 100)) : 0;
        const unit  = item.type === 'anime' ? 'ep' : 'ch';
        const progressLine = total ? `${prog} / ${total} ${unit}` : `${prog} ${unit}`;
        return `
            <div class="continue-card" onclick="openLibraryDetail(${item.series_id})">
                ${coverImg(item.cover_image_url, 64, 64)}
                <div class="continue-info">
                    <div class="continue-top">
                        <span class="continue-title">${item.title}</span>
                        <span class="continue-pct">${total ? pct + '%' : ''}</span>
                    </div>
                    <span class="continue-type">${cap(item.type)}</span>
                    <div class="continue-progress-wrap">
                        <span class="continue-prog-text">${progressLine}</span>
                    </div>
                    <div class="continue-bar-bg">
                        <div class="continue-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ─── Dashboard recommendations ───────────────────────────────────────────────

async function getRecommendations() {
    const mood = document.getElementById('mood').value;
    const type = document.getElementById('type').value;
    const sort = document.getElementById('sort').value;
    let url = `/recommendations?mood=${enc(mood)}&user_id=${USER_ID}`;
    if (type) url += `&type=${enc(type)}`;
    if (sort) url += `&sort=${enc(sort)}`;

    const container = document.getElementById('results');
    container.innerHTML = '<p class="empty-msg">Loading…</p>';
    const data = await fetchJSON(url);
    container.innerHTML = '<h2 class="section-title">Recommendations</h2>';
    if (!data.length) { container.innerHTML += '<p class="empty-msg">No results found.</p>'; return; }
    data.forEach(item => {
        const d = document.createElement('div');
        d.className = 'result-card';
        d.innerHTML = `<div class="result-card-inner">${coverImg(item.cover_image_url,48,64)}<div><h3>${item.title}</h3><p>${cap(item.type)} · Score: ${Number(item.recommendation_score).toFixed(1)}</p></div></div>`;
        container.appendChild(d);
    });
}

// ─── Library ─────────────────────────────────────────────────────────────────

async function loadLibrary(statusFilter = 'All') {
    currentLibFilter = statusFilter;
    const sort = document.getElementById('library-sort')?.value || 'recent';

    const [stats, data] = await Promise.all([
        fetchJSON(`/library-stats/${USER_ID}`),
        fetchJSON(`/library/${USER_ID}?sort=${sort}${statusFilter !== 'All' ? '&status=' + statusFilter : ''}`)
    ]);

    document.getElementById('tab-all').textContent       = stats.total;
    document.getElementById('tab-watching').textContent  = stats.watching;
    document.getElementById('tab-completed').textContent = stats.completed;
    document.getElementById('tab-planned').textContent   = stats.planned;
    document.getElementById('tab-dropped').textContent   = stats.dropped;
    document.getElementById('watching').textContent  = stats.watching;
    document.getElementById('completed').textContent = stats.completed;
    document.getElementById('planned').textContent   = stats.planned;
    document.getElementById('total').textContent     = stats.total;

    const content = document.getElementById('library-content');
    if (!data.length) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                <p class="empty-title">No series in your library yet</p>
                <button class="btn-primary" onclick="showView('add-series')">Add Your First Series</button>
            </div>`;
        return;
    }

    content.innerHTML = data.map(item => {
        const count  = item.total_episodes ? `${item.total_episodes} ep` : item.total_chapters ? `${item.total_chapters} ch` : '';
        const genres = (item.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${g}</span>`).join('');
        return `
            <div class="library-row" onclick="openLibraryDetail(${item.series_id})">
                ${coverImg(item.cover_image_url, 56, 72)}
                <div class="lib-info">
                    <h3>${item.title}</h3>
                    <p class="lib-meta">${cap(item.type)} · ${item.year||''} · ${item.series_status}</p>
                    ${count?`<p class="lib-eps">${count}</p>`:''}
                    <div class="genre-tags">${genres}</div>
                </div>
                <div class="lib-status">
                    <span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span>
                    ${item.rating?`<span class="lib-rating">★ ${item.rating}</span>`:''}
                    <svg class="lib-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            </div>`;
    }).join('');
}

function filterLibrary(status, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadLibrary(status);
}

function reloadLibrary() {
    loadLibrary(currentLibFilter);
}

// ─── Open detail from library (edit mode) ────────────────────────────────────

async function openLibraryDetail(seriesId) {
    // Find the series data from the already-loaded library rows
    const res  = await fetchJSON(`/library/${USER_ID}`);
    const item = res.find(r => r.series_id === seriesId);
    if (!item) return;

    detailBackView = 'library';
    detailMode     = 'edit';
    detailSeries   = item;
    detailProgress = item.progress || 0;
    detailStatus   = item.status   || 'Watching';
    detailRating   = item.rating   || null;

    renderDetailPage();
}

// ─── Open detail from browse (add mode) ──────────────────────────────────────

function openAddDetail(storeKey) {
    const item = cardStore[storeKey];
    if (!item) { console.error('Card data not found for key:', storeKey); return; }
    detailSeries   = item;
    detailMode     = 'add';
    detailBackView = 'add-series';
    detailProgress = 0;
    detailStatus   = 'Watching';
    detailRating   = null;

    renderDetailPage();
}

// ─── Render detail page ───────────────────────────────────────────────────────

function renderDetailPage() {
    const s = detailSeries;
    const isAnime = s.type === 'anime';
    const total   = s.total_episodes || s.total_chapters || null;
    const unit    = isAnime ? 'episodes' : 'chapters';

    // Back label
    document.getElementById('detail-back-btn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to ${detailBackView === 'library' ? 'Library' : 'Browse'}`;

    // Cover
    document.getElementById('detail-cover-wrap').innerHTML =
        coverImg(s.cover_image_url || s.cover_url, '100%', 260);

    // Title & badges
    document.getElementById('detail-title').textContent = s.title;
    document.getElementById('detail-badges').innerHTML = [
        s.type   ? `<span class="badge">${cap(s.type)}</span>` : '',
        s.year   ? `<span class="badge">${s.year}</span>` : '',
        s.status ? `<span class="badge">${s.status}</span>` : ''
    ].join('');

    // Description
    const desc = s.description || s.synopsis || '';
    document.getElementById('detail-desc').textContent = desc ? desc.slice(0, 200) + (desc.length > 200 ? '…' : '') : '';

    // Stats
    const dur = s.avg_episode_duration ? `<p><strong>Length:</strong> ~${s.avg_episode_duration} minutes each</p>` : '';
    const totalLine = total ? `<p><strong>Total:</strong> ${total} ${unit}</p>` : '';
    const genres = (s.genres||[]).join(', ');
    document.getElementById('detail-stats').innerHTML =
        totalLine + dur + (genres ? `<p><strong>Genres:</strong> ${genres}</p>` : '');

    // Progress
    document.getElementById('progress-unit').textContent = `${unit} completed`;
    updateProgressDisplay(total);

    // Status buttons
    ['Watching','Completed','Planned','Dropped'].forEach(st => {
        const btn = document.getElementById(`dstatus-${st}`);
        btn.classList.toggle('active', st === detailStatus);
    });

    // Rating buttons
    updateRatingDisplay();

    // Save / Remove buttons
    const saveBtn   = document.getElementById('detail-save-btn');
    const removeBtn = document.getElementById('detail-remove-btn');
    saveBtn.disabled = false;
    saveBtn.textContent = detailMode === 'edit' ? 'Save Changes' : 'Add to Library';
    removeBtn.style.display = detailMode === 'edit' ? 'flex' : 'none';

    showView('detail');
}

function updateProgressDisplay(total) {
    const num = detailProgress;
    document.getElementById('progress-num').textContent = num;
    if (total) {
        const pct = Math.min(100, Math.round((num / total) * 100));
        document.getElementById('progress-label').textContent = `${num} / ${total} ${document.getElementById('progress-unit').textContent.replace(' completed','')}`;
        document.getElementById('progress-pct').textContent   = `${pct}%`;
        document.getElementById('progress-fill').style.width  = `${pct}%`;
    } else {
        document.getElementById('progress-label').textContent = `${num} completed`;
        document.getElementById('progress-pct').textContent   = '';
        document.getElementById('progress-fill').style.width  = '0%';
    }
}

function changeProgress(delta) {
    const total = detailSeries.total_episodes || detailSeries.total_chapters || null;
    detailProgress = Math.max(0, detailProgress + delta);
    if (total) detailProgress = Math.min(detailProgress, total);
    updateProgressDisplay(total);
}

function setDetailStatus(status) {
    detailStatus = status;
    ['Watching','Completed','Planned','Dropped'].forEach(st => {
        document.getElementById(`dstatus-${st}`).classList.toggle('active', st === status);
    });
}

function setDetailRating(n) {
    detailRating = n;
    updateRatingDisplay();
}

function updateRatingDisplay() {
    document.querySelectorAll('#rating-selector button').forEach((btn, i) => {
        btn.classList.toggle('active', i + 1 === detailRating);
    });
    document.getElementById('rating-label').textContent =
        detailRating ? `★ You rated this ${detailRating}/10` : '';
}

// ─── Save / Remove ────────────────────────────────────────────────────────────

async function saveDetail() {
    const btn = document.getElementById('detail-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        let seriesId = detailSeries.series_id || null;

        if (detailMode === 'add') {
            // Series already in local DB → use its id directly
            // Series from external API → import first to get a local id
            if (!seriesId) {
                const imp = await fetchJSON('/series/import', 'POST', detailSeries);
                seriesId = imp.series_id;
            }

            await fetchJSON('/library/add', 'POST', {
                user_id: USER_ID, series_id: seriesId, status: detailStatus
            });
        }

        // Update progress / rating (works for both add and edit)
        await fetchJSON('/library/update', 'PUT', {
            user_id: USER_ID, series_id: seriesId,
            status: detailStatus, progress: detailProgress, rating: detailRating
        });

        await loadStats();
        goBack();

    } catch (err) {
        console.error('Save failed:', err);
        btn.disabled = false;
        btn.textContent = detailMode === 'edit' ? 'Save Changes' : 'Add to Library';
    }
}

async function removeDetail() {
    if (!confirm(`Remove "${detailSeries.title}" from your library?`)) return;
    await fetchJSON('/library/remove', 'DELETE', {
        user_id: USER_ID, series_id: detailSeries.series_id
    });
    await loadStats();
    goBack();
}

// ─── Browse / Add Series ──────────────────────────────────────────────────────

async function initBrowse() {
    document.getElementById('browse-search').value = '';
    document.getElementById('browse-type').value   = '';
    document.getElementById('browse-sort').value   = 'score';
    topPage      = { anime: 1, manga: 1 };
    topExhausted = { anime: false, manga: false };
    browseMode   = 'default';

    const grid   = document.getElementById('browse-grid');
    const footer = document.getElementById('browse-footer');
    grid.innerHTML   = '';
    footer.innerHTML = '';
    renderLoadMoreFooter();

    try {
        const data = await fetchJSON(`/series-browse?user_id=${USER_ID}&sort=score`);
        if (data.length) {
            const existing = grid.innerHTML;
            grid.innerHTML = data.map((item, i) => seriesCardHTML(item, `db-${i}`)).join('') + existing;
        }
    } catch (e) { console.error('DB browse failed:', e); }
}

function renderLoadMoreFooter() {
    const footer = document.getElementById('browse-footer');
    const a = topExhausted.anime ? '' : `<button class="btn-load-more" id="load-more-anime" onclick="loadTopSeries('anime')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Load More Anime</button>`;
    const m = topExhausted.manga ? '' : `<button class="btn-load-more" id="load-more-manga" onclick="loadTopSeries('manga')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Load More Manga</button>`;
    footer.innerHTML = (a||m) ? `<div class="load-more-row">${a}${m}</div>` : '<p class="empty-msg" style="text-align:center;margin:16px 0">All results loaded.</p>';
}

async function loadTopSeries(type) {
    const btn = document.getElementById(`load-more-${type}`);
    if (btn) { btn.disabled = true; btn.innerHTML = 'Loading…'; }
    const { results, has_next } = await fetchJSON(`/browse/top?type=${type}&page=${topPage[type]}`);
    const grid = document.getElementById('browse-grid');
    results.forEach((item, i) => { grid.innerHTML += seriesCardHTML(item, `top-${type}-${topPage[type]}-${i}`); });
    topPage[type]++;
    topExhausted[type] = !has_next;
    renderLoadMoreFooter();
}

function onSearchInput() {
    const q = document.getElementById('browse-search').value.trim();
    if (!q && browseMode !== 'default') initBrowse();
}

function loadBrowse() { runSearch(); }

async function runSearch() {
    const q    = document.getElementById('browse-search').value.trim();
    const type = document.getElementById('browse-type').value;
    const sort = document.getElementById('browse-sort').value;
    if (!q) { initBrowse(); return; }

    browseMode = 'search';
    const grid   = document.getElementById('browse-grid');
    const footer = document.getElementById('browse-footer');
    grid.innerHTML   = '<p class="loading-msg">Searching…</p>';
    footer.innerHTML = '';

    let url = `/search?q=${enc(q)}`;
    if (type) url += `&type=${enc(type)}`;

    const data = await fetchJSON(url);
    if (!data.length) { grid.innerHTML = '<p class="loading-msg">No results found.</p>'; return; }

    const sorted = [...data].sort((a,b) => {
        if (sort==='alphabetical') return (a.title||'').localeCompare(b.title||'');
        if (sort==='year') return (b.year||0)-(a.year||0);
        return (b.average_score||0)-(a.average_score||0);
    });
    grid.innerHTML = sorted.map((item,i) => seriesCardHTML(item, `s-${i}`)).join('');
}

function seriesCardHTML(item, _key) {
    const storeKey = storeCard(item);
    const count  = item.total_episodes ? `${item.total_episodes} ep` : item.total_chapters ? `${item.total_chapters} ch` : '';
    const score  = item.average_score  ? `⭐ ${item.average_score}` : '';
    const meta   = [cap(item.type), item.year, item.status].filter(Boolean).join(' · ');
    const genres = (item.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${g}</span>`).join('');
    const desc   = (item.description||'').slice(0,100) + ((item.description||'').length>100?'…':'');
    return `
        <div class="series-card">
            ${coverImg(item.cover_image_url,'100%',180)}
            <div class="series-card-body">
                <h3>${item.title}</h3>
                <p class="series-meta">${meta}</p>
                ${(count||score)?`<p class="series-eps">${[count,score].filter(Boolean).join(' · ')}</p>`:''}
                ${desc?`<p class="series-desc">${desc}</p>`:''}
                <div class="genre-tags">${genres}</div>
                <button class="btn-add-library" onclick="openAddDetail('${storeKey}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add to Library
                </button>
            </div>
        </div>`;
}

// ─── Recommendations page ────────────────────────────────────────────────────

let selectedMood       = null;
let selectedCommitment = 'Medium';

function selectMood(btn) {
    document.querySelectorAll('.mood-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMood = btn.dataset.mood;
}

function selectCommitment(btn) {
    document.querySelectorAll('.commitment-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCommitment = btn.dataset.commitment;
}

function updateTimeLabel() {
    const val = document.getElementById('time-slider').value;
    const label = document.getElementById('time-label');
    label.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${val} min`;
}

async function loadRecommendationsPage() {
    const mood   = selectedMood;
    const maxMin = document.getElementById('time-slider')?.value || 30;

    const container = document.getElementById('rec-results');

    if (!mood) {
        container.innerHTML = '<p class="rec-no-mood">Please select a mood first.</p>';
        return;
    }

    container.innerHTML = '<p class="empty-msg" style="margin:32px">Finding recommendations…</p>';

    const url  = `/recommendations/smart?mood=${enc(mood)}&commitment=${enc(selectedCommitment)}&max_min=${maxMin}`;
    const data = await fetchJSON(url);

    if (!data.length) {
        container.innerHTML = '<p class="empty-msg" style="margin:32px">No results found. Try a different mood or commitment level.</p>';
        return;
    }

    container.innerHTML = `
        <h2 class="rec-results-title">${data.length} recommendations for <span style="color:var(--purple-light)">${mood}</span></h2>
        <div class="series-grid" style="margin:0 32px 40px">
            ${data.map((item,i) => seriesCardHTML(item, `rec-${i}`)).join('')}
        </div>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function fetchJSON(url, method='GET', body=null) {
    const opts = { method, headers: {'Content-Type':'application/json'} };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json();
}

function coverImg(url, width, height) {
    const w = typeof width==='number' ? `${width}px` : width;
    const h = typeof height==='number' ? `${height}px` : height;
    if (url) return `<img src="${url}" alt="cover" style="width:${w};height:${h};object-fit:cover;border-radius:8px;flex-shrink:0;display:block;">`;
    return `<div style="width:${w};height:${h};border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#4c1d95,#7c3aed 50%,#db2777);display:block;"></div>`;
}

function cap(str) {
    if (!str) return '';
    return str.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function enc(s) { return encodeURIComponent(s); }

// ─── Init ─────────────────────────────────────────────────────────────────────
loadStats();
