# Weather Forecast
Weather Forecast automatically detects your location and displays real-time weather conditions.
<img width="477" height="359" alt="image" src="https://github.com/user-attachments/assets/fc7a310d-c88f-436d-9b10-2bc2d6decc20" />

## Functions
- Automatic geolocation via browser;
- Current weather (temperature, feels-like temperature, humidity, pressure, wind, precipitation) and refresh button;
- Temperature chart for the next 12 hours;
- 7-day forecast with a visual bar showing the temperature range;
- Neighborhood/city name via reverse geocoding;
- Responsive in mobile and desktop;

<img width="883" height="400" alt="image" src="https://github.com/user-attachments/assets/7320ab43-833f-414f-a40c-6dab571793c4" />


## Stack/Tech
- **Backend:** Node.js + Express (STATIC FILES)
- **Frontend:** HTML+CSS+JS (NO FRAMEWORK)
- **APIs:** Open-Meteo (FREE, NO API KEY) + Nominatim (REVERSE GEOCODING)

## APIs used (free)

| API                           | Usage                                    |
| ----------------------------- | -------------------------------------- |
| `api.open-meteo.com`          | Current weather + forecast                 |
| `nominatim.openstreetmap.org` | Convert coordinates to place names |

## Folder structure
```
WeatherForecast/
├── server.js          ← Node/Express — serve /front
├── package.json
├── package-lock.json
└── front/
    ├── index.html
    ├── style.css 
    └── run.js  
```

## Running now in:
```
Production Link-> https://weather-forecast-blush-gamma.vercel.app/
```

### github.com/devheron
