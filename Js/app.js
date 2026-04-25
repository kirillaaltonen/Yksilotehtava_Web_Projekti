'use strict';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = 'https://media2.edu.metropolia.fi/restaurant/api/v1';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const el = {
    restaurantList:       document.querySelector('#restaurantList'),
    restaurantCount:      document.querySelector('#restaurantCount'),
    restaurantName:       document.querySelector('#selectedRestaurantName'),
    menuContent:          document.querySelector('#menuContent'),
    message:              document.querySelector('#message'),
    demoBanner:           document.querySelector('#demoBanner'),
    dailyButton:          document.querySelector('#dailyButton'),
    weeklyButton:         document.querySelector('#weeklyButton'),
    favoriteButton:       document.querySelector('#favoriteButton'),
    searchInput:          document.querySelector('#searchInput'),
    cityFilter:           document.querySelector('#cityFilter'),
    providerFilter:       document.querySelector('#providerFilter'),
    locateButton:         document.querySelector('#locateButton'),
};

// ── State ─────────────────────────────────────────────────────────────────────
let allRestaurants   = [];
let activeRestaurant = null;
let nearestId        = null;
let activeMenuType   = 'daily';
let favorites        = JSON.parse(localStorage.getItem('favorites') || '[]');
let usingDemoData    = false;

// ── Map state ─────────────────────────────────────────────────────────────────
let map     = null;
let markers = {};

// ── Demo fallback ─────────────────────────────────────────────────────────────
const DEMO_RESTAURANTS = [
    {
        _id: 'demo-1',
        name: 'Metropolia Myllypuro',
        city: 'Helsinki',
        company: 'Sodexo',
        address: 'Myllypurontie 1',
        location: { type: 'Point', coordinates: [25.0776, 60.2232] },
    },
    {
        _id: 'demo-2',
        name: 'Metropolia Myyrmäki',
        city: 'Vantaa',
        company: 'Sodexo',
        address: 'Leiritie 1',
        location: { type: 'Point', coordinates: [24.8545, 60.3020] },
    },
    {
        _id: 'demo-3',
        name: 'Metropolia Karamalmi',
        city: 'Espoo',
        company: 'Food & Co',
        address: 'Karaportti 2',
        location: { type: 'Point', coordinates: [24.7318, 60.2244] },
    },
];

const DEMO_DAILY = {
    courses: [
        { name: 'Kasvispasta',    price: '3,20 €', diets: 'G, M'  },
        { name: 'Kana ja riisi',  price: '3,20 €', diets: 'L'     },
        { name: 'Salaattibuffet', price: '3,20 €', diets: 'Vegan' },
    ],
};

const DEMO_WEEKLY = {
    days: [
        { date: 'Maanantai', courses: [{ name: 'Lihakeitto',    price: '3,20 €', diets: 'L' },   { name: 'Kasvissosekeitto', price: '3,20 €', diets: 'Vegan' }] },
        { date: 'Tiistai',   courses: [{ name: 'Broilerpasta',  price: '3,20 €', diets: 'L' },   { name: 'Linssikastike',    price: '3,20 €', diets: 'Vegan, G' }] },
        { date: 'Keskiviikko', courses: [{ name: 'Lohikeitto',  price: '3,20 €', diets: 'L' },   { name: 'Kasvisrisotto',    price: '3,20 €', diets: 'Vegan' }] },
        { date: 'Torstai',   courses: [{ name: 'Jauhelihapihvi',price: '3,20 €', diets: 'L' },   { name: 'Täytetty paprika', price: '3,20 €', diets: 'Vegan, G' }] },
        { date: 'Perjantai', courses: [{ name: 'Kalakeitto',    price: '3,20 €', diets: 'L, G' },{ name: 'Kasvispizza',      price: '3,20 €', diets: 'Vegan' }] },
    ],
};

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return res.json();
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
    map = L.map('map', { zoomControl: true }).setView([60.25, 24.9], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);
}

function buildMarkerIcon(color, size) {
    return L.divIcon({
        className: '',
        html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      cursor:pointer;
    "></div>`,
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor:[0, -(size / 2)],
    });
}

function updateMapMarkers() {
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};

    const filtered = getFiltered();
    const bounds   = [];

    filtered.forEach((r) => {
        const coords = r.location?.coordinates;   // [lng, lat]
        if (!Array.isArray(coords) || coords.length < 2) return;

        const [lng, lat] = coords;
        const isActive   = activeRestaurant?._id === r._id;
        const isNearest  = r._id === nearestId;

        const color = isActive   ? '#FF5000'
            : isNearest  ? '#008F5D'
                :              '#1A1A1A';
        const size  = isActive || isNearest ? 14 : 10;

        const marker = L.marker([lat, lng], { icon: buildMarkerIcon(color, size) })
            .addTo(map)
            .bindPopup(`<strong>${r.name}</strong><br>${r.city || ''}`);

        marker.on('click', () => chooseRestaurant(r));
        markers[r._id] = marker;
        bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
}

// ── Geolocation ───────────────────────────────────────────────────────────────
function haversineKm([lng1, lat1], [lng2, lat2]) {
    const R    = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locateUser() {
    if (!navigator.geolocation) { alert('Selaimesi ei tue paikannusta.'); return; }

    el.locateButton.disabled    = true;
    el.locateButton.textContent = '⏳ Paikannetaan…';

    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            el.locateButton.disabled    = false;
            el.locateButton.textContent = '📍 Lähin';

            const userCoords = [coords.longitude, coords.latitude];
            let minDist = Infinity;
            let nearest = null;

            allRestaurants.forEach((r) => {
                const c = r.location?.coordinates;
                if (!c) return;
                const d = haversineKm(userCoords, c);
                if (d < minDist) { minDist = d; nearest = r; }
            });

            if (!nearest) { alert('Ei ravintoloita kartalla.'); return; }

            nearestId = nearest._id;
            renderRestaurants();
            updateMapMarkers();
            chooseRestaurant(nearest);

            // User pin
            map.setView([coords.latitude, coords.longitude], 13);
            L.marker([coords.latitude, coords.longitude], {
                icon: buildMarkerIcon('#F59E0B', 14),
            }).addTo(map).bindPopup('Sijaintisi').openPopup();
        },
        () => {
            el.locateButton.disabled    = false;
            el.locateButton.textContent = '📍 Lähin';
            alert('Paikannus epäonnistui. Tarkista selaimen luvat.');
        },
        { timeout: 8000 }
    );
}

// ── Restaurants ───────────────────────────────────────────────────────────────
async function loadRestaurants() {
    try {
        allRestaurants = await fetchJson(`${API_BASE}/restaurants`);
        usingDemoData  = false;
        el.demoBanner.classList.remove('visible');
        showMessage('Valitse ravintola listasta.');
    } catch (err) {
        console.warn('API unavailable, using demo data:', err);
        allRestaurants = DEMO_RESTAURANTS;
        usingDemoData  = true;
        el.demoBanner.classList.add('visible');
        showMessage('');
    }

    allRestaurants.sort((a, b) => a.name.localeCompare(b.name, 'fi'));
    fillFilters();
    renderRestaurants();
    updateMapMarkers();
}

function uniqueValues(key) {
    return [...new Set(allRestaurants.map((r) => r[key]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'fi')
    );
}

function fillSelect(select, values, placeholder) {
    select.innerHTML = `<option value="all">${placeholder}</option>`;
    values.forEach((v) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        select.appendChild(o);
    });
}

function fillFilters() {
    fillSelect(el.cityFilter,     uniqueValues('city'),    'Kaikki kaupungit');
    fillSelect(el.providerFilter, uniqueValues('company'), 'Kaikki tarjoajat');
}

function getFiltered() {
    const q        = el.searchInput.value.toLowerCase().trim();
    const city     = el.cityFilter.value;
    const provider = el.providerFilter.value;

    return allRestaurants.filter((r) => {
        const text = `${r.name} ${r.city || ''} ${r.company || ''} ${r.address || ''}`.toLowerCase();
        return (
            text.includes(q) &&
            (city     === 'all' || r.city    === city) &&
            (provider === 'all' || r.company === provider)
        );
    });
}

function renderRestaurants() {
    const filtered = getFiltered();
    el.restaurantCount.textContent = filtered.length;
    el.restaurantList.innerHTML    = '';

    if (filtered.length === 0) {
        el.restaurantList.innerHTML = '<p class="message">Ei tuloksia.</p>';
        return;
    }

    filtered.forEach((r) => {
        const isActive   = activeRestaurant?._id === r._id;
        const isNearest  = r._id === nearestId;
        const isFavorite = favorites.includes(r._id);

        const card = document.createElement('article');
        card.className = ['restaurant-card', isActive ? 'active' : '', isNearest ? 'nearest' : '']
            .filter(Boolean).join(' ');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        card.innerHTML = `
      ${isNearest ? '<div class="nearest-badge">📍 Lähin</div>' : ''}
      <h3>${isFavorite ? '<span class="fav-star">★</span> ' : ''}${r.name}</h3>
      <div class="card-meta">
        ${r.city || '–'} · ${r.company || '–'}<br>
        ${r.address || ''}
      </div>
    `;

        card.addEventListener('click',   () => chooseRestaurant(r));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') chooseRestaurant(r); });
        el.restaurantList.appendChild(card);
    });
}

function chooseRestaurant(restaurant) {
    activeRestaurant = restaurant;
    el.restaurantName.textContent    = restaurant.name;
    el.dailyButton.disabled          = false;
    el.weeklyButton.disabled         = false;
    el.favoriteButton.disabled       = false;
    updateFavButton();
    renderRestaurants();
    updateMapMarkers();
    setMenuType('daily');

    // Pan to restaurant on map
    const coords = restaurant.location?.coordinates;
    if (coords && map) {
        map.setView([coords[1], coords[0]], 14);
        markers[restaurant._id]?.openPopup();
    }
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function updateFavButton() {
    const isFav = favorites.includes(activeRestaurant._id);
    el.favoriteButton.textContent = isFav ? '★ Suosikki' : '☆ Suosikki';
    el.favoriteButton.classList.toggle('btn-active', isFav);
}

function toggleFavorite() {
    if (!activeRestaurant) return;
    if (favorites.includes(activeRestaurant._id)) {
        favorites = favorites.filter((id) => id !== activeRestaurant._id);
    } else {
        favorites.push(activeRestaurant._id);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavButton();
    renderRestaurants();
}

// ── Menu ──────────────────────────────────────────────────────────────────────

/** Update which menu-type button looks "active" */
function setMenuType(type) {
    activeMenuType = type;
    el.dailyButton.classList.toggle ('btn-active', type === 'daily');
    el.weeklyButton.classList.toggle('btn-active', type === 'weekly');
    el.dailyButton.classList.toggle ('btn-primary', false);
    el.weeklyButton.classList.toggle('btn-primary', false);
    loadMenu(type);
}

async function loadMenu(type) {
    if (!activeRestaurant) return;
    el.menuContent.innerHTML = '';
    showMessage('Ladataan ruokalistaa…');

    try {
        let data;

        if (usingDemoData) {
            // Demo fallback
            data = type === 'weekly' ? DEMO_WEEKLY : DEMO_DAILY;
        } else {
            // Real API: /daily/{id}/fi  or  /weekly/{id}/fi
            const endpoint = type === 'weekly' ? 'weekly' : 'daily';
            data = await fetchJson(`${API_BASE}/restaurants/${endpoint}/${activeRestaurant._id}/fi`);
        }

        renderMenu(data, type);
    } catch (err) {
        console.warn('Menu fetch error:', err);
        showMessage('Ruokalistaa ei löytynyt tälle ravintolalle.');
    }
}

function renderMenu(data, type) {
    showMessage('');

    // Normalise: weekly API returns { days: [...] }, daily returns { courses: [...] }
    // Some restaurants return weekly data even for daily endpoint – handle both shapes.
    let days;

    if (type === 'weekly') {
        if (Array.isArray(data.days)) {
            days = data.days;
        } else if (Array.isArray(data)) {
            days = data;
        } else {
            // Unexpected shape – wrap it
            days = [data];
        }
    } else {
        // Daily – always a single-day view
        days = [data];
    }

    if (days.length === 0) {
        showMessage('Ei ruokalistatietoja.');
        return;
    }

    days.forEach((day, idx) => {
        const courses = day.courses || [];
        const title   = day.date
            || day.name
            || (type === 'weekly' ? `Päivä ${idx + 1}` : 'Tänään');

        const section = document.createElement('section');
        section.className = 'menu-day';
        section.innerHTML = `<div class="menu-day-header">${title}</div>`;

        if (courses.length === 0) {
            section.innerHTML += '<div class="meal"><span class="meal-name" style="color:var(--grey-400)">Ei ruokalistatietoja.</span></div>';
        } else {
            courses.forEach((course) => {
                const meal = document.createElement('div');
                meal.className = 'meal';

                const diets = course.diets
                    ? `<span class="meal-diets">${course.diets}</span>`
                    : '';

                meal.innerHTML = `
          <span class="meal-name">${course.name || 'Nimetön'}</span>
          <span class="meal-meta">
            ${course.price || ''}
            ${diets}
          </span>
        `;
                section.appendChild(meal);
            });
        }

        el.menuContent.appendChild(section);
    });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function showMessage(text) {
    el.message.textContent = text;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
el.searchInput.addEventListener('input', () => { renderRestaurants(); updateMapMarkers(); });
el.cityFilter.addEventListener('change',    () => { renderRestaurants(); updateMapMarkers(); });
el.providerFilter.addEventListener('change',() => { renderRestaurants(); updateMapMarkers(); });
el.dailyButton.addEventListener('click',    () => setMenuType('daily'));
el.weeklyButton.addEventListener('click',   () => setMenuType('weekly'));
el.favoriteButton.addEventListener('click', toggleFavorite);
el.locateButton.addEventListener('click',   locateUser);

// ── Boot ──────────────────────────────────────────────────────────────────────
initMap();
loadRestaurants();
