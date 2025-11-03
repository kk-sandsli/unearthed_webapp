// map-and-location.js
// Handles Leaflet map + geolocation + keeping #location in sync.

(function (global) {
  let map = null;
  let marker = null;
  let lastLatLon = null;

  // You already load Leaflet CSS in your HTML; make sure you also load the JS:
  // <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  function formatLatLon(lat, lon) {
    return `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
  }

  function updateLocationField(lat, lon) {
    const input = document.getElementById("location");
    if (input) {
      input.value = formatLatLon(lat, lon);
    }
    lastLatLon = { lat, lon };

    // small status line
    let status = document.getElementById("locationStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "locationStatus";
      status.style.fontSize = "0.8rem";
      status.style.marginTop = "0.3rem";
      const locInput = document.getElementById("location");
      if (locInput && locInput.parentNode) {
        locInput.parentNode.insertBefore(status, locInput.nextSibling);
      } else {
        document.body.appendChild(status);
      }
    }
    const lang = (global.AppI18n && localStorage.getItem("app.lang")) || "en";
    const t =
      (global.AppI18n &&
        global.AppI18n.translations[lang] &&
        global.AppI18n.translations[lang].locationSaved) ||
      "Location saved ✔";
    status.textContent = t;
  }

  function setMarker(lat, lon) {
    if (!map) return;
    if (marker) {
      marker.setLatLng([lat, lon]);
    } else {
      marker = L.marker([lat, lon]).addTo(map);
    }
  }

  function initMapAndLocation() {
    const mapEl = document.getElementById("map");
    if (!mapEl || !global.L) {
      console.warn("Leaflet or #map missing – skipping map init.");
      return;
    }

    map = L.map("map").setView([60.0, 10.0], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", function (e) {
      const { lat, lng } = e.latlng;
      setMarker(lat, lng);
      updateLocationField(lat, lng);
    });

    // try to auto-locate
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          map.setView([lat, lon], 15);
          setMarker(lat, lon);
          updateLocationField(lat, lon);
        },
        (err) => {
          console.warn("Geolocation failed:", err);
        }
      );
    }
  }

  // called by the existing HTML button
  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (map) {
          map.setView([lat, lon], 15);
          setMarker(lat, lon);
        }
        updateLocationField(lat, lon);
      },
      (err) => {
        console.warn("Could not get location:", err);
        alert("Could not get your location.");
      }
    );
  }

  // for other modules
  function getLastLatLon() {
    return lastLatLon;
  }

  document.addEventListener("DOMContentLoaded", initMapAndLocation);

  global.useCurrentLocation = useCurrentLocation;
  global.AppMap = {
    initMapAndLocation,
    useCurrentLocation,
    getLastLatLon,
  };
})(window);

