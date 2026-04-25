'use strict';

const API_URL = 'https://media2.edu.metropolia.fi/restaurant/api/v1';

const restaurantList = document.querySelector('#restaurantList');
const message = document.querySelector('#message');
const selectedRestaurantName = document.querySelector('#selectedRestaurantName');
const dailyButton = document.querySelector('#dailyButton');
const weeklyButton = document.querySelector('#weeklyButton');
const menuContent = document.querySelector('#menuContent');

const searchInput = document.querySelector('#searchInput');
const cityFilter = document.querySelector('#cityFilter');
const providerFilter = document.querySelector('#providerFilter');
const locateButton = document.querySelector('#locateButton');

let restaurants = [];
let selectedRestaurant = null;

let map;
let markers = [];
let userMarker = null;
let nearestRestaurantId = null;

function initMap() {
    map = L.map('map').setView([60.1699, 24.9384], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
}

async function fetchRestaurants() {
    try {
        const response = await fetch(`${API_URL}/restaurants`);

        if (!response.ok) throw new Error();

        restaurants = await response.json();

        createFilters(restaurants);
        renderRestaurants(restaurants);
        updateMapMarkers(restaurants);

        message.textContent = '';
    } catch (error) {
        console.error(error);
        message.textContent = 'Ravintoloita ei voitu ladata.';
    }
}

function createFilters(data) {
    const cities = [...new Set(data.map(r => r.city).filter(Boolean))];
    const providers = [...new Set(data.map(r => r.company).filter(Boolean))];

    cities.sort().forEach(city => {
        cityFilter.innerHTML += `<option value="${city}">${city}</option>`;
    });

    providers.sort().forEach(p => {
        providerFilter.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

function filterRestaurants() {
    const term = searchInput.value.toLowerCase();
    const city = cityFilter.value;
    const provider = providerFilter.value;

    const filtered = restaurants.filter(r => {
        const matchSearch =
            r.name.toLowerCase().includes(term) ||
            (r.address || '').toLowerCase().includes(term) ||
            (r.city || '').toLowerCase().includes(term) ||
            (r.company || '').toLowerCase().includes(term);

        const matchCity = city === 'all' || r.city === city;
        const matchProvider = provider === 'all' || r.company === provider;

        return matchSearch && matchCity && matchProvider;
    });

    renderRestaurants(filtered);
    updateMapMarkers(filtered);
}

function renderRestaurants(data) {
    restaurantList.innerHTML = '';

    data.forEach(r => {
        const card = document.createElement('article');
        card.className = 'restaurant-card';

        if (r._id === nearestRestaurantId) {
            card.classList.add('nearest');
        }

        card.innerHTML = `
      ${r._id === nearestRestaurantId ? '<div class="nearest-badge">Nearest</div>' : ''}
      <h3>${r.name}</h3>
      <p>${r.city || ''}</p>
    `;

        card.onclick = () => selectRestaurant(r);

        restaurantList.appendChild(card);
    });
}

function selectRestaurant(r) {
    selectedRestaurant = r;
    selectedRestaurantName.textContent = r.name;
    dailyButton.disabled = false;
    weeklyButton.disabled = false;
    fetchDailyMenu(r._id);
}

function updateMapMarkers(data) {
    markers.forEach(m => m.remove());
    markers = [];

    data.forEach(r => {
        if (!r.location?.coordinates) return;

        const [lon, lat] = r.location.coordinates;

        const marker = L.marker([lat, lon]).addTo(map)
            .bindPopup(r.name);

        marker.on('click', () => selectRestaurant(r));

        markers.push(marker);
    });
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findNearest(userLat, userLon) {
    let min = Infinity;
    let nearest = null;

    restaurants.forEach(r => {
        if (!r.location?.coordinates) return;

        const [lon, lat] = r.location.coordinates;
        const d = getDistance(userLat, userLon, lat, lon);

        if (d < min) {
            min = d;
            nearest = r;
        }
    });

    if (nearest) {
        nearestRestaurantId = nearest._id;
        renderRestaurants(restaurants);
        map.setView([userLat, userLon], 13);
    }
}

locateButton.addEventListener('click', () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((pos) => {
        const {latitude, longitude} = pos.coords;

        if (userMarker) userMarker.remove();

        userMarker = L.marker([latitude, longitude]).addTo(map)
            .bindPopup('You are here')
            .openPopup();

        findNearest(latitude, longitude);
    });
});

async function fetchDailyMenu(id) {
    menuContent.innerHTML = 'Loading...';
    const res = await fetch(`${API_URL}/restaurants/daily/${id}/fi`);
    const data = await res.json();

    menuContent.innerHTML = data.courses.map(c =>
        `<div class="meal">${c.name}</div>`
    ).join('');
}

async function fetchWeeklyMenu(id) {
    menuContent.innerHTML = 'Loading...';
    const res = await fetch(`${API_URL}/restaurants/weekly/${id}/fi`);
    const data = await res.json();

    menuContent.innerHTML = data.days.map(d =>
        `<div class="menu-day">
      <h3>${d.date}</h3>
      ${d.courses.map(c => `<div class="meal">${c.name}</div>`).join('')}
    </div>`
    ).join('');
}

dailyButton.onclick = () => fetchDailyMenu(selectedRestaurant._id);
weeklyButton.onclick = () => fetchWeeklyMenu(selectedRestaurant._id);

searchInput.oninput = filterRestaurants;
cityFilter.onchange = filterRestaurants;
providerFilter.onchange = filterRestaurants;

initMap();
fetchRestaurants();