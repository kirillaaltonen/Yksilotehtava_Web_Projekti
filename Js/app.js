'use strict';

const API_URL = 'https://media2.edu.metropolia.fi/restaurant/api/v1';

const restaurantList = document.querySelector('#restaurantList');
const message = document.querySelector('#message');
const selectedRestaurantName = document.querySelector('#selectedRestaurantName');
const dailyButton = document.querySelector('#dailyButton');
const menuContent = document.querySelector('#menuContent');

let restaurants = [];
let selectedRestaurant = null;

async function fetchRestaurants() {
    try {
        const response = await fetch(`${API_URL}/restaurants`);

        if (!response.ok) {
            throw new Error('Ravintoloiden lataaminen epäonnistui');
        }

        restaurants = await response.json();
        renderRestaurants(restaurants);
        message.textContent = '';
    } catch (error) {
        console.error(error);
        message.textContent = 'Ravintoloita ei voitu ladata.';
    }
}

function renderRestaurants(restaurantsToRender) {
    restaurantList.innerHTML = '';

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
            selectedRestaurant = restaurant;
            selectedRestaurantName.textContent = restaurant.name;
            dailyButton.disabled = false;
            fetchDailyMenu(restaurant._id);
        });

        restaurantList.appendChild(card);
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

dailyButton.addEventListener('click', () => {
    if (selectedRestaurant) {
        fetchDailyMenu(selectedRestaurant._id);
    }
});

fetchRestaurants();