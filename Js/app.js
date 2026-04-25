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

let restaurants = [];
let selectedRestaurant = null;

let map;
let markers = [];

function initMap() {
    map = L.map('map').setView([60.1699, 24.9384], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
}

async function fetchRestaurants() {
    try {
        const response = await fetch(`${API_URL}/restaurants`);

        if (!response.ok) {
            throw new Error('Ravintoloiden lataaminen epäonnistui');
        }

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

function createFilters(restaurantsData) {
    const cities = [...new Set(restaurantsData.map((restaurant) => restaurant.city).filter(Boolean))];
    const providers = [...new Set(restaurantsData.map((restaurant) => restaurant.company).filter(Boolean))];

    cities.sort();
    providers.sort();

    cities.forEach((city) => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });

    providers.forEach((provider) => {
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = provider;
        providerFilter.appendChild(option);
    });
}

function filterRestaurants() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCity = cityFilter.value;
    const selectedProvider = providerFilter.value;

    const filteredRestaurants = restaurants.filter((restaurant) => {
        const matchesSearch =
            restaurant.name.toLowerCase().includes(searchTerm) ||
            (restaurant.address || '').toLowerCase().includes(searchTerm) ||
            (restaurant.city || '').toLowerCase().includes(searchTerm) ||
            (restaurant.company || '').toLowerCase().includes(searchTerm);

        const matchesCity = selectedCity === 'all' || restaurant.city === selectedCity;
        const matchesProvider = selectedProvider === 'all' || restaurant.company === selectedProvider;

        return matchesSearch && matchesCity && matchesProvider;
    });

    renderRestaurants(filteredRestaurants);
    updateMapMarkers(filteredRestaurants);
}

function renderRestaurants(restaurantsToRender) {
    restaurantList.innerHTML = '';

    if (restaurantsToRender.length === 0) {
        restaurantList.innerHTML = '<p>Ravintoloita ei löytynyt.</p>';
        return;
    }

    restaurantsToRender.forEach((restaurant) => {
        const card = document.createElement('article');
        card.className = 'restaurant-card';

        card.innerHTML = `
      <h3>${restaurant.name}</h3>
      <p>${restaurant.address || ''}</p>
      <p>${restaurant.city || ''}</p>
      <p>${restaurant.company || ''}</p>
    `;

        card.addEventListener('click', () => {
            selectRestaurant(restaurant);
        });

        restaurantList.appendChild(card);
    });
}

function selectRestaurant(restaurant) {
    selectedRestaurant = restaurant;
    selectedRestaurantName.textContent = restaurant.name;
    dailyButton.disabled = false;
    weeklyButton.disabled = false;
    fetchDailyMenu(restaurant._id);
}

function updateMapMarkers(restaurantsToShow) {
    markers.forEach((marker) => marker.remove());
    markers = [];

    restaurantsToShow.forEach((restaurant) => {
        if (!restaurant.location?.coordinates) return;

        const [longitude, latitude] = restaurant.location.coordinates;

        const marker = L.marker([latitude, longitude])
            .addTo(map)
            .bindPopup(`<strong>${restaurant.name}</strong><br>${restaurant.address || ''}`);

        marker.on('click', () => {
            selectRestaurant(restaurant);
        });

        markers.push(marker);
    });
}

async function fetchDailyMenu(restaurantId) {
    menuContent.innerHTML = '<p>Ladataan päivän ruokalistaa...</p>';

    try {
        const response = await fetch(`${API_URL}/restaurants/daily/${restaurantId}/fi`);

        if (!response.ok) {
            throw new Error('Ruokalistan lataaminen epäonnistui');
        }

        const menu = await response.json();
        renderDailyMenu(menu);
    } catch (error) {
        console.error(error);
        menuContent.innerHTML = '<p>Päivän ruokalistaa ei voitu ladata.</p>';
    }
}

function renderDailyMenu(menu) {
    menuContent.innerHTML = '';

    if (!menu.courses || menu.courses.length === 0) {
        menuContent.innerHTML = '<p>Ruokalistaa ei ole saatavilla tälle päivälle.</p>';
        return;
    }

    menu.courses.forEach((course) => {
        const meal = document.createElement('div');
        meal.className = 'meal';

        meal.innerHTML = `
      <h3>${course.name || 'Ei nimeä'}</h3>
      <p>${course.price || ''}</p>
      <p>${course.diets || ''}</p>
    `;

        menuContent.appendChild(meal);
    });
}

async function fetchWeeklyMenu(restaurantId) {
    menuContent.innerHTML = '<p>Ladataan viikon ruokalistaa...</p>';

    try {
        const response = await fetch(`${API_URL}/restaurants/weekly/${restaurantId}/fi`);

        if (!response.ok) {
            throw new Error('Viikon ruokalistan lataaminen epäonnistui');
        }

        const weeklyMenu = await response.json();
        renderWeeklyMenu(weeklyMenu);
    } catch (error) {
        console.error(error);
        menuContent.innerHTML = '<p>Viikon ruokalistaa ei voitu ladata.</p>';
    }
}

function renderWeeklyMenu(weeklyMenu) {
    menuContent.innerHTML = '';

    if (!weeklyMenu.days || weeklyMenu.days.length === 0) {
        menuContent.innerHTML = '<p>Viikon ruokalistaa ei ole saatavilla.</p>';
        return;
    }

    weeklyMenu.days.forEach((day) => {
        const dayElement = document.createElement('section');
        dayElement.className = 'menu-day';

        const coursesHtml = day.courses.map((course) => `
      <div class="meal">
        <h3>${course.name || 'Ei nimeä'}</h3>
        <p>${course.price || ''}</p>
        <p>${course.diets || ''}</p>
      </div>
    `).join('');

        dayElement.innerHTML = `
      <h3>${day.date}</h3>
      ${coursesHtml}
    `;

        menuContent.appendChild(dayElement);
    });
}

searchInput.addEventListener('input', filterRestaurants);
cityFilter.addEventListener('change', filterRestaurants);
providerFilter.addEventListener('change', filterRestaurants);

dailyButton.addEventListener('click', () => {
    if (selectedRestaurant) {
        fetchDailyMenu(selectedRestaurant._id);
    }
});

weeklyButton.addEventListener('click', () => {
    if (selectedRestaurant) {
        fetchWeeklyMenu(selectedRestaurant._id);
    }
});

initMap();
fetchRestaurants();