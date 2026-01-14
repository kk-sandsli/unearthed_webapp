// map-and-location.js
// Handles Leaflet map + geolocation + keeping #location in sync.

(function (global) {
  let map = null;
  let marker = null;
  let lastLatLon = null;
  let lastAddressData = null; // Store address data from Geonorge API

  // Geonorge API endpoint for point search
  const GEONORGE_API_URL = "https://ws.geonorge.no/adresser/v1/punktsok";

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

      const response = await fetch(`${GEONORGE_API_URL}?${params}`, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        console.warn("Geonorge API request failed:", response.status);
        return null;
      }

      const data = await response.json();

      if (data.adresser && data.adresser.length > 0) {
        const addr = data.adresser[0]; // Closest address (ordered by distance)
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

      return null; // No addresses found within radius
    } catch (err) {
      console.warn("Geonorge API lookup failed:", err);
      return null;
    }
  }

  function updateLocationField(lat, lon) {
    const input = document.getElementById("location");
    if (input) {
      input.value = formatLatLon(lat, lon);
    }
    lastLatLon = { lat, lon };

    // Fetch address data from Geonorge API (async, best-effort)
    fetchAddressFromGeonorge(lat, lon).then((addressData) => {
      lastAddressData = addressData;
      if (addressData) {
        console.log("Geonorge address found:", addressData);
        // Update owner fields with address data
        updateOwnerFieldsFromAddress(addressData);
      } else {
        // No address found - clear the fields
        console.log("No address found within radius - clearing fields");
        clearOwnerFields();
      }
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

