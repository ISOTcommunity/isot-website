/* Turin weather for the Home page — "Today in Turin".
 *
 * Open-Meteo: free, no key, CORS-enabled, so the phone asks it directly and no ISOT
 * server sits in between. One request covers today and tomorrow, hourly.
 *
 * Cached for 30 minutes in localStorage. That is a per-phone convenience (the home page
 * is opened many times a day), not data anyone else needs, and the card still renders
 * without it.
 *
 * The notices are the point, not the numbers: "take an umbrella" and "take a jacket if
 * you stay out" are what a student actually needs from a forecast at 9 in the morning.
 * After 21:00 the advice is about tomorrow, because today is over.
 */
const TURIN = { lat: 45.0703, lng: 7.6869 };
const WEATHER_CACHE_KEY = 'isot_weather_v1';
const WEATHER_TTL_MS = 30 * 60 * 1000;

// WMO weather codes → icon + words
function weatherLook(code) {
  if (code === 0) return { icon: 'fa-sun', label: 'Clear', color: '#E69321' };
  if (code === 1 || code === 2) return { icon: 'fa-cloud-sun', label: 'Partly cloudy', color: '#E69321' };
  if (code === 3) return { icon: 'fa-cloud', label: 'Cloudy', color: '#B9BFCB' };
  if (code === 45 || code === 48) return { icon: 'fa-smog', label: 'Fog', color: '#B9BFCB' };
  if (code >= 51 && code <= 57) return { icon: 'fa-cloud-rain', label: 'Drizzle', color: '#5787EA' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: 'fa-cloud-showers-heavy', label: 'Rain', color: '#5787EA' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'fa-snowflake', label: 'Snow', color: '#BBC1F9' };
  if (code >= 95) return { icon: 'fa-cloud-bolt', label: 'Thunderstorm', color: '#D45AE8' };
  return { icon: 'fa-cloud', label: 'Cloudy', color: '#B9BFCB' };
}
const isSnowCode = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isStormCode = c => c >= 95;

async function loadTurinWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < WEATHER_TTL_MS) return cached.data;
  } catch (_) {}

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${TURIN.lat}&longitude=${TURIN.lng}`
    + '&current=temperature_2m,weather_code'
    + '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=Europe%2FRome&forecast_days=2';
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  const data = await res.json();
  try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (_) {}
  return data;
}

// Hours of one day as objects: { hour, temp, prob, mm, code }
function hoursOf(data, dayIndex) {
  const h = data.hourly;
  const day = data.daily.time[dayIndex];
  const out = [];
  h.time.forEach((t, i) => {
    if (t.slice(0, 10) !== day) return;
    out.push({
      hour: Number(t.slice(11, 13)),
      temp: h.temperature_2m[i],
      prob: h.precipitation_probability[i] ?? 0,
      mm: h.precipitation[i] ?? 0,
      code: h.weather_code[i]
    });
  });
  return out;
}

/* The advice. Returns [{ kind, icon, text }], most important first.
 * `nowHour` is Turin local time, 0-23. */
function weatherTips(data, nowHour) {
  const tomorrow = nowHour >= 21;
  const dayIndex = tomorrow ? 1 : 0;
  const when = tomorrow ? 'tomorrow' : 'today';
  const hours = hoursOf(data, dayIndex);
  // What is still ahead: the rest of today, or tomorrow from 7:00
  const ahead = hours.filter(h => tomorrow ? h.hour >= 7 : h.hour >= nowHour);
  if (!ahead.length) return [];

  const tips = [];
  const hh = n => `${String(n).padStart(2, '0')}:00`;

  // 1. Rain, snow or storms
  const wet = ahead.find(h => h.prob >= 50 || h.mm >= 0.5 || isStormCode(h.code));
  if (wet) {
    const snow = ahead.some(h => isSnowCode(h.code) && (h.prob >= 40 || h.mm > 0));
    const storm = ahead.some(h => isStormCode(h.code));
    const from = wet.hour <= (tomorrow ? 8 : nowHour + 1) ? (tomorrow ? 'in the morning' : 'soon') : `from ${hh(wet.hour)}`;
    if (snow) {
      tips.push({ kind: 'snow', icon: 'fa-snowflake', text: `Snow expected ${from}. Dress warm and wear good shoes ${when}.` });
    } else {
      tips.push({
        kind: 'rain', icon: storm ? 'fa-cloud-bolt' : 'fa-umbrella',
        text: `${storm ? 'Storms' : 'Rain'} likely ${from}. Don't forget your umbrella ${when}.`
      });
    }
  }

  // 2. Warm afternoon, cool night: the jacket people forget
  const afternoon = hours.filter(h => h.hour >= 12 && h.hour <= 17);
  const night = hours.filter(h => h.hour >= 20 && h.hour <= 23);
  if (afternoon.length && night.length) {
    const aftMax = Math.round(Math.max(...afternoon.map(h => h.temp)));
    const nightMin = Math.round(Math.min(...night.map(h => h.temp)));
    if (nightMin <= 16 && aftMax - nightMin >= 7) {
      const afternoonAhead = tomorrow || nowHour < 15;
      tips.push({
        kind: 'jacket', icon: 'fa-shirt',
        text: afternoonAhead
          ? (tomorrow
              ? `Warm tomorrow afternoon (${aftMax}°) but ${nightMin}° in the evening. Take a jacket if you stay out.`
              : `Warm in the afternoon (${aftMax}°) but ${nightMin}° tonight. Take a jacket if you stay out.`)
          : `It drops to ${nightMin}° tonight. Take a jacket if you stay out.`
      });
    }
  }

  // 3. Extremes
  const dayMax = Math.round(data.daily.temperature_2m_max[dayIndex]);
  const dayMin = Math.round(data.daily.temperature_2m_min[dayIndex]);
  if (dayMax >= 32) {
    tips.push({ kind: 'hot', icon: 'fa-temperature-high', text: `Very hot ${when} (${dayMax}°). Carry water and look for shade.` });
  } else if (dayMin <= 3) {
    tips.push({ kind: 'cold', icon: 'fa-temperature-low', text: `Cold ${when}, down to ${dayMin}°. Coat, scarf and gloves.` });
  }

  return tips;
}

function turinHourNow() {
  // The phone may not be on Rome time (a visitor, a VPN); the forecast is.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).formatToParts(new Date());
  return Number(parts.find(p => p.type === 'hour').value) % 24;
}

// Report + notices as HTML for the Today in Turin card
function renderWeatherHtml(data, nowHour = turinHourNow()) {
  const look = weatherLook(data.current.weather_code);
  const hi = Math.round(data.daily.temperature_2m_max[0]);
  const lo = Math.round(data.daily.temperature_2m_min[0]);
  const rain = data.daily.precipitation_probability_max[0] ?? 0;
  const tips = weatherTips(data, nowHour);
  return `
    <div class="tit-weather">
      <div class="tit-wicon" style="color:${look.color}"><i class="fa-solid ${look.icon}"></i></div>
      <div style="flex:1;min-width:0">
        <div class="tit-temp">${Math.round(data.current.temperature_2m)}° <span>${look.label}</span></div>
        <div class="tit-meta">High ${hi}° · Low ${lo}° · Rain ${rain}%</div>
      </div>
    </div>
    ${tips.map(t => `
      <div class="tit-tip tit-tip-${t.kind}">
        <i class="fa-solid ${t.icon}"></i><span>${t.text}</span>
      </div>`).join('')}`;
}
