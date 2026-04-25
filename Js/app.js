'use strict';

const API_URL = 'https://media2.edu.metropolia.fi/restaurant/api/v1';

const restaurantList = document.querySelector('#restaurantList');
const message = document.querySelector('#message');

let restaurants = [];

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

        restaurantList.appendChild(card);
    });
}

fetchRestaurants();