// map-and-location.js
// Handles Leaflet map + geolocation + keeping #location in sync.

(function (global) {
  let map = null;
  let marker = null;
  let lastLatLon = null;
  let lastAddressData = null; // Store address data from Geonorge API

  // Geonorge API endpoint for point search
  const GEONORGE_API_URL = "https://ws.geonorge.no/adresser/v1/punktsok";

  // ========== DEBUG OVERLAY ==========
  let debugPanel = null;
  let debugBtn = null;
  let debugLogs = [];

  function initDebugOverlay() {
    // Create toggle button
    debugBtn = document.createElement("button");
    debugBtn.textContent = "📋";
    debugBtn.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      z-index: 10000;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: #4e6c50;
      color: white;
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    debugBtn.addEventListener("click", toggleDebugPanel);
    document.body.appendChild(debugBtn);

    // Create panel (hidden initially)
    debugPanel = document.createElement("div");
    debugPanel.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 10px;
      left: 10px;
      max-height: 50vh;
      z-index: 9999;
      background: rgba(0,0,0,0.9);
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      padding: 10px;
      border-radius: 8px;
      overflow-y: auto;
      display: none;
      white-space: pre-wrap;
      word-break: break-all;
    `;
    document.body.appendChild(debugPanel);
  }

  function toggleDebugPanel() {
    if (debugPanel.style.display === "none") {
      debugPanel.style.display = "block";
      renderDebugLogs();
    } else {
      debugPanel.style.display = "none";
    }
  }

  function debugLog(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    debugLogs.push(entry);
    // Keep last 50 entries
    if (debugLogs.length > 50) debugLogs.shift();
    console.log(entry);
    renderDebugLogs();
  }

  function renderDebugLogs() {
    if (debugPanel && debugPanel.style.display !== "none") {
      debugPanel.textContent = debugLogs.join("\n");
      debugPanel.scrollTop = debugPanel.scrollHeight;
    }
  }

  // Initialize debug overlay when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDebugOverlay);
  } else {
    initDebugOverlay();
  }
  // ========== END DEBUG OVERLAY ==========

  // You already load Leaflet CSS in your HTML; make sure you also load the JS:
  // <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  function formatLatLon(lat, lon) {
    return `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
  }

  /**
   * Update landowner form fields with address data from Geonorge.
   * Only updates fields that are empty or were previously auto-filled.
   */
  function updateOwnerFieldsFromAddress(addressData) {
    if (!addressData) return;
    debugLog("updateOwnerFieldsFromAddress called");

    // Build full address string from components
    const fullAddress = [
      addressData.adressetekst,
      addressData.postnummer && addressData.poststed
        ? `${addressData.postnummer} ${addressData.poststed}`
        : "",
    ]
      .filter(Boolean)
      .join(", ");

    // Update address field
    const addrInput = document.getElementById("ownerAddress");
    if (addrInput) {
      addrInput.value = fullAddress;
    }

    // Update kommune field
    const kommuneInput = document.getElementById("ownerKommune");
    if (kommuneInput) {
      kommuneInput.value = addressData.kommunenavn || "";
    }

    // Update gårdsnummer field
    const gnrInput = document.getElementById("ownerGnr");
    if (gnrInput) {
      gnrInput.value = addressData.gardsnummer ? String(addressData.gardsnummer) : "";
    }

    // Update bruksnummer field
    const bnrInput = document.getElementById("ownerBnr");
    if (bnrInput) {
      bnrInput.value = addressData.bruksnummer ? String(addressData.bruksnummer) : "";
    }
  }

  /**
   * Clear all owner address fields (when no address is found).
   */
  function clearOwnerFields() {
    debugLog("clearOwnerFields called");
    const fields = ["ownerAddress", "ownerKommune", "ownerGnr", "ownerBnr"];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  /**
   * Fetch address data from Geonorge API based on coordinates.
   * Silent failure - returns null if lookup fails.
   */
  async function fetchAddressFromGeonorge(lat, lon) {
    debugLog(`fetchAddressFromGeonorge(${lat}, ${lon}) starting...`);
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        radius: "10000", // 10km radius for rural areas
        koordsys: "4258", // ETRS89 (compatible with WGS84)
        utkoordsys: "4258",
        treffPerSide: "5", // Get top 5 nearest
        side: "0",
        asciiKompatibel: "true",
      });

      debugLog("Fetching: " + GEONORGE_API_URL + "?" + params.toString().substring(0, 50) + "...");
      const response = await fetch(`${GEONORGE_API_URL}?${params}`, {
        headers: { accept: "application/json" },
      });

      debugLog(`Fetch response status: ${response.status}`);
      if (!response.ok) {
        debugLog("API request failed: " + response.status);
        return null;
      }

      const data = await response.json();
      debugLog(`API returned ${data.adresser ? data.adresser.length : 0} addresses`);

      if (data.adresser && data.adresser.length > 0) {
        const addr = data.adresser[0]; // Closest address (ordered by distance)
        debugLog("Using address: " + addr.adressetekst);
        return {
          adressetekst: addr.adressetekst || "",
          kommunenavn: addr.kommunenavn || "",
          kommunenummer: addr.kommunenummer || "",
          gardsnummer: addr.gardsnummer || "",
          bruksnummer: addr.bruksnummer || "",
          postnummer: addr.postnummer || "",
          poststed: addr.poststed || "",
          distanse: addr.meterDistanseTilPunkt || null,
        };
      }

      debugLog("No addresses found within radius");
      debugLog("No addresses found within radius");
      return null; // No addresses found within radius
    } catch (err) {
      debugLog("API ERROR: " + (err.message || err));
      console.warn("Geonorge API lookup failed:", err);
      return null;
    }
  }

  function updateLocationField(lat, lon) {
    debugLog(`updateLocationField(${lat.toFixed(4)}, ${lon.toFixed(4)})`);
    const input = document.getElementById("location");
    if (input) {
      input.value = formatLatLon(lat, lon);
      debugLog("Location field updated");
    } else {
      debugLog("ERROR: #location input not found!");
    }
    lastLatLon = { lat, lon };

    // Fetch address data from Geonorge API (async, best-effort)
    fetchAddressFromGeonorge(lat, lon).then((addressData) => {
      debugLog("fetchAddressFromGeonorge .then() called");
      lastAddressData = addressData;
      if (addressData) {
        debugLog("Address data received, updating fields");
        // Update owner fields with address data
        updateOwnerFieldsFromAddress(addressData);
      } else {
        // No address found - clear the fields
        debugLog("No address data - clearing fields");
        clearOwnerFields();
      }
    }).catch((err) => {
      debugLog("Promise CATCH: " + (err.message || err));
    });

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
    // Use correct storage key matching i18n.js
    const lang = localStorage.getItem("unearthed-lang") || "no";
    const t =
      (global.AppI18n &&
        global.AppI18n.translations &&
        global.AppI18n.translations[lang] &&
        global.AppI18n.translations[lang].locationSaved) ||
      "Posisjon lagret ✔";
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

  function getLastAddressData() {
    return lastAddressData;
  }

  document.addEventListener("DOMContentLoaded", initMapAndLocation);

  global.useCurrentLocation = useCurrentLocation;
  global.AppMap = {
    initMapAndLocation,
    useCurrentLocation,
    getLastLatLon,
    getLastAddressData,
  };
})(window);

