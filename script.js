// =========================================================
// 설정 및 상태 (State & Config)
// =========================================================
const AppState = {
  langMode: 0, // 0: 한글, 1: 영문, 2: 안보임
  is12Hour: true,
  currentFontIndex: 0,
  weatherData: null,
  aqiData: null,
  currentPassword: ""
};

const Config = {
  fonts: [
    { family: "'Anton', sans-serif", spacing: "0.05em", gap: "0.02em", size: "65vh" },
    { family: "'Bebas Neue', sans-serif", spacing: "0.05em", gap: "0.02em", size: "65vh" },
    { family: "'Orbitron', sans-serif", spacing: "0em", gap: "0.02em", size: "60vh" }
  ],
  timeColors: [
    "#FF80AB", "#EA80FC", "#8C9EFF", "#80D8FF",
    "#A7FFEB", "#CCFF90", "#FFFF8D", "#FFD180"
  ]
};

// =========================================================
// DOM 엘리먼트 (DOM Elements)
// =========================================================
const DOM = {
  timeContainer: document.getElementById('timeContainer'),
  hours: document.getElementById('hours'),
  minutes: document.getElementById('minutes'),
  weatherDisplay: document.getElementById('weatherDisplay'),
  aqiDisplay: document.getElementById('aqiDisplay'),
  statusDisplay: document.getElementById('statusDisplay'),
  passwordPad: document.getElementById('passwordPad'),
  padDisplay: document.getElementById('padDisplay'),
  gifOverlay: document.getElementById('gifOverlay'),
  fartOverlay: document.getElementById('fartOverlay'),
  successSound: document.getElementById('successSound')
};

// =========================================================
// 시계 로직 (Clock Logic)
// =========================================================
const updateClock = () => {
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  let s = now.getSeconds();

  // 1초마다 색상 변화 (포인트 컬러)
  if (DOM.timeContainer) {
    DOM.timeContainer.style.color = Config.timeColors[s % Config.timeColors.length];
  }

  // 12시간제 처리
  if (AppState.is12Hour) {
    h = h % 12 || 12;
  }

  // DOM 업데이트
  if (DOM.hours) DOM.hours.textContent = h.toString().padStart(2, '0');
  if (DOM.minutes) DOM.minutes.textContent = m.toString().padStart(2, '0');
};

const startClock = () => {
  updateClock();
  const msToNextSecond = 1000 - new Date().getMilliseconds();
  setTimeout(startClock, msToNextSecond);
};

// =========================================================
// 날씨 및 미세먼지 API 로직 (API Fetching)
// =========================================================
const getWeatherIcon = (wmoCode) => {
  if (wmoCode === 0) return "☀️";
  if (wmoCode <= 3) return "⛅";
  if ([45, 48].includes(wmoCode)) return "🌫️";
  if (wmoCode >= 51 && wmoCode <= 67) return "🌧️";
  if (wmoCode >= 71 && wmoCode <= 77) return "❄️";
  if (wmoCode >= 80 && wmoCode <= 82) return "🌦️";
  if (wmoCode >= 85 && wmoCode <= 86) return "🌨️";
  if (wmoCode >= 95 && wmoCode <= 99) return "⛈️";
  return "☁️";
};

const renderEnvironmentalInfo = () => {
  if (AppState.langMode === 2) {
    DOM.weatherDisplay.style.visibility = "hidden";
    DOM.aqiDisplay.style.visibility = "hidden";
    DOM.statusDisplay.style.visibility = "hidden";
    return;
  } else {
    DOM.weatherDisplay.style.visibility = "visible";
    DOM.aqiDisplay.style.visibility = "visible";
    DOM.statusDisplay.style.visibility = "visible";
  }

  // 날씨 렌더링
  if (AppState.weatherData && !AppState.weatherData.error) {
    const { icon, temp } = AppState.weatherData.current;
    DOM.weatherDisplay.textContent = `${icon} ${temp}°C`;
  } else if (AppState.weatherData?.error) {
      DOM.statusDisplay.textContent = AppState.langMode === 0 ? AppState.weatherData.error.ko : AppState.weatherData.error.en;
  }

  // 미세먼지 렌더링
  if (AppState.aqiData && !AppState.aqiData.error) {
    const { current, todayMax } = AppState.aqiData;
    let aqiIcon = "😄";
    if (todayMax > 40) aqiIcon = "😷";
    if (todayMax > 80) aqiIcon = "🤢";
    if (todayMax > 100) aqiIcon = "👿";
    
    // 요구사항: 현재 미세먼지, 오늘 최고 미세먼지
    DOM.aqiDisplay.innerHTML = `PM2.5: ${current} <span style="opacity:0.6; font-size:0.8em;">MAX: ${todayMax}</span> ${aqiIcon}`;
    DOM.statusDisplay.textContent = "";
  } else if (AppState.aqiData?.error) {
    DOM.statusDisplay.textContent = AppState.langMode === 0 ? AppState.aqiData.error.ko : AppState.aqiData.error.en;
  }
};

const fetchWeather = async (lat, lon) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=1&forecast_days=2`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather HTTP Error");
    const response = await res.json();
    AppState.weatherData = {
      current: {
        icon: getWeatherIcon(response.current_weather.weathercode),
        temp: response.current_weather.temperature
      }
    };
  } catch (e) {
    AppState.weatherData = { error: { ko: "날씨 수신 오류", en: "Weather Error" } };
  }
  renderEnvironmentalInfo();
};

const updateLocationAndWeather = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        AppState.weatherData = { error: { ko: "위치 권한 필요", en: "Location Permission Req" } };
        renderEnvironmentalInfo();
      }
    );
  } else {
    AppState.weatherData = { error: { ko: "위치 미지원", en: "Location Unsupported" } };
    renderEnvironmentalInfo();
  }
};

const updateAQI = async () => {
  const token = "c1611aa54ac7de2320cc3105b7b42a0ba2b26447";
  const url = `https://api.waqi.info/feed/here/?token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("AQI HTTP Error");
    const response = await res.json();
    if (response.status === "ok") {
      let todayMax = "-";
      if (response.data.forecast?.daily?.pm25) {
        const todayStr = new Date().toISOString().split('T')[0];
        const forecast = response.data.forecast.daily.pm25.find(f => f.day === todayStr);
        if (forecast) todayMax = forecast.max;
      }
      AppState.aqiData = { current: response.data.aqi, todayMax };
    }
  } catch (e) {
    AppState.aqiData = { error: { ko: "미세먼지 오류", en: "AQI Error" } };
  }
  renderEnvironmentalInfo();
};

// =========================================================
// 숫자 패드 로직 (Number Pad Logic)
// =========================================================
const togglePad = (show) => {
  if (!DOM.passwordPad) return;
  DOM.passwordPad.style.display = show ? 'flex' : 'none';
  if (show) {
    AppState.currentPassword = "";
    updatePadDisplay();
  }
};

const updatePadDisplay = () => {
  if (DOM.padDisplay) DOM.padDisplay.textContent = "•".repeat(AppState.currentPassword.length);
};

const inputPad = (num) => {
  if (AppState.currentPassword.length < 4) {
    AppState.currentPassword += num;
    updatePadDisplay();
    if (AppState.currentPassword.length === 4) submitPad();
  }
};

const submitPad = () => {
  if (AppState.currentPassword === "1402") {
    DOM.gifOverlay.style.display = 'flex';
    if (DOM.successSound) {
      DOM.successSound.currentTime = 0;
      DOM.successSound.play().catch(e => console.log('Audio error:', e));
    }
    togglePad(false);
    setTimeout(() => DOM.gifOverlay.style.display = 'none', 5000);
  } else {
    DOM.passwordPad.classList.add('pad-error');
    DOM.fartOverlay.style.display = 'flex';
    setTimeout(() => {
      DOM.passwordPad.classList.remove('pad-error');
      DOM.fartOverlay.style.display = 'none';
    }, 1500); 
    AppState.currentPassword = "";
    updatePadDisplay();
  }
};

// =========================================================
// 이벤트 리스너 및 초기화 (Events & Init)
// =========================================================

// 시계 형식 전환 (시 클릭)
if (DOM.hours) {
  DOM.hours.addEventListener('click', (e) => {
    e.stopPropagation();
    AppState.is12Hour = !AppState.is12Hour;
    updateClock();
  });
}

// 폰트 전환 (분 클릭)
if (DOM.minutes) {
  DOM.minutes.addEventListener('click', (e) => {
    e.stopPropagation();
    AppState.currentFontIndex = (AppState.currentFontIndex + 1) % Config.fonts.length;
    const font = Config.fonts[AppState.currentFontIndex];
    DOM.timeContainer.style.fontFamily = font.family;
    DOM.timeContainer.style.letterSpacing = font.spacing;
    DOM.timeContainer.style.gap = font.gap;
    DOM.timeContainer.style.fontSize = font.size;
  });
}

// 언어/숨김 전환
const langBtn = document.getElementById('langBtn');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    AppState.langMode = (AppState.langMode + 1) % 3;
    renderEnvironmentalInfo();
  });
}

// 잠금 패드 열기
const lockBtn = document.getElementById('lockBtn');
if (lockBtn) {
  lockBtn.addEventListener('click', () => togglePad(true));
}

// 패드 버튼 이벤트
document.querySelectorAll('.pad-btn[data-num]').forEach(btn => {
  btn.addEventListener('click', (e) => inputPad(e.currentTarget.dataset.num));
});

if (document.getElementById('padClear')) {
  document.getElementById('padClear').addEventListener('click', () => {
    AppState.currentPassword = "";
    updatePadDisplay();
  });
}

if (document.getElementById('padSubmit')) {
  document.getElementById('padSubmit').addEventListener('click', submitPad);
}

if (document.getElementById('padClose')) {
  document.getElementById('padClose').addEventListener('click', () => togglePad(false));
}

// Wake Lock
let wakeLock = null;
const requestWakeLock = async () => {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      document.addEventListener("visibilitychange", async () => {
        if (wakeLock !== null && document.visibilityState === "visible") {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      });
    } catch (err) {}
  }
};

// 앱 초기 구동
const initApp = () => {
  startClock();
  requestWakeLock();
  updateLocationAndWeather();
  updateAQI();
  setInterval(() => {
    updateLocationAndWeather();
    updateAQI();
  }, 1800000); // 30분 마다 갱신
};

window.addEventListener('DOMContentLoaded', initApp);
