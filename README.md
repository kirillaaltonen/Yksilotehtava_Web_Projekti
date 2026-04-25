# Opiskelijaravintolat

Vanilla JavaScript web application for browsing Finnish student restaurants and their daily or weekly menus.

## Features

- Restaurant list fetched from REST API (demo fallback if unavailable)
- Daily and weekly menus
- Search by name, city, provider or address
- City and provider dropdown filters
- Favorite restaurants saved to `localStorage`
- Interactive map (Leaflet + OpenStreetMap) showing all restaurants
- Geolocation: find and highlight the nearest restaurant
- Responsive layout – works on mobile and desktop
- No frameworks, no Bootstrap, pure vanilla JS / CSS

## Technologies

- HTML5 (semantic elements, ARIA labels)
- CSS3 (custom properties, grid, responsive media queries)
- Vanilla JavaScript ES6+ (async/await, optional chaining, destructuring)
- [Leaflet](https://leafletjs.com/) – open-source map library (loaded via CDN)
- REST API: `https://media2.edu.metropolia.fi/restaurant/api/v1`

## API endpoints used

```
GET /restaurants
GET /restaurants/daily/{id}/fi
GET /restaurants/weekly/{id}/fi
```

## How to run

Open `index.html` in a browser, or use VS Code Live Server / any local HTTP server.

> Note: geolocation requires HTTPS or localhost.

## Author

Student project – Web Application Development, Metropolia UAS.
