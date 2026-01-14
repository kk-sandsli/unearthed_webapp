// map-and-location.js
// Handles Leaflet map + geolocation + keeping #location in sync.

(function (global) {
  // Immediate log to confirm script execution
  if (typeof window.dbg === "function") {
    window.dbg("map-and-location IIFE running");
  }

  var map = null;
  var marker = null;
  var lastLatLon = null;
  var lastAddressData = null; // Store address data from Geonorge API

  // Geonorge API endpoint for point search
  var GEONORGE_API_URL = "https://ws.geonorge.no/adresser/v1/punktsok";

  // Simple debug helper - uses global dbg() from index.html
  function log(msg) {
    if (typeof window.dbg === "function") {
      window.dbg(msg);
    } else if (typeof console !== "undefined") {
      console.log(msg);
    }
  }

  // You already load Leaflet CSS in your HTML; make sure you also load the JS:
  // <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

  function formatLatLon(lat, lon) {
    return "Lat: " + lat.toFixed(6) + ", Lon: " + lon.toFixed(6);
  }

  /**
   * Update landowner form fields with address data from Geonorge.
   */
  function updateOwnerFieldsFromAddress(addressData) {
    if (!addressData) return;
    log("updateOwnerFieldsFromAddress called");

    // Build full address string from components
    var streetPart = addressData.adressetekst || "";
    var postPart = "";
    if (addressData.postnummer && addressData.poststed) {
      postPart = addressData.postnummer + " " + addressData.poststed;
    }
    var fullAddress = streetPart;
    if (postPart) {
      fullAddress = streetPart ? (streetPart + ", " + postPart) : postPart;
    }

    // Update address field
    var addrInput = document.getElementById("ownerAddress");
    if (addrInput) {
      addrInput.value = fullAddress;
    }

    // Update kommune field
    var kommuneInput = document.getElementById("ownerKommune");
    if (kommuneInput) {
      kommuneInput.value = addressData.kommunenavn || "";
    }

    // Update gårdsnummer field
    var gnrInput = document.getElementById("ownerGnr");
    if (gnrInput) {
      gnrInput.value = addressData.gardsnummer ? String(addressData.gardsnummer) : "";
    }

    // Update bruksnummer field
    var bnrInput = document.getElementById("ownerBnr");
    if (bnrInput) {
      bnrInput.value = addressData.bruksnummer ? String(addressData.bruksnummer) : "";
    }
    log("Owner fields updated");
  }

  /**
   * Clear all owner address fields (when no address is found).
   */
  function clearOwnerFields() {
    log("clearOwnerFields called");
    var fields = ["ownerAddress", "ownerKommune", "ownerGnr", "ownerBnr"];
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (el) el.value = "";
    }
  }

  /**
   * Fetch address data from Geonorge API based on coordinates.
   * Uses XMLHttpRequest for better Safari compatibility.
   */
  function fetchAddressFromGeonorge(lat, lon, callback) {
    log("fetchAddressFromGeonorge starting");
    log("Coords: " + lat.toFixed(4) + ", " + lon.toFixed(4));
    
    var url = GEONORGE_API_URL + 
      "?lat=" + encodeURIComponent(lat) +
      "&lon=" + encodeURIComponent(lon) +
      "&radius=10000" +
      "&koordsys=4258" +
      "&utkoordsys=4258" +
      "&treffPerSide=5" +
      "&side=0" +
      "&asciiKompatibel=true";

    log("URL built, creating XHR");

    var xhr;
    try {
      xhr = new XMLHttpRequest();
    } catch (e) {
      log("XHR create failed: " + e.message);
      callback(null);
      return;
    }

    var callbackCalled = false;
    function safeCallback(result) {
      if (callbackCalled) return;
      callbackCalled = true;
      log("Calling callback with: " + (result ? "data" : "null"));
      callback(result);
    }

    try {
      xhr.open("GET", url, true);
      log("XHR opened");
    } catch (e) {
      log("XHR open failed: " + e.message);
      safeCallback(null);
      return;
    }
    
    // Note: Some Safari versions have issues with setRequestHeader
    try {
      xhr.setRequestHeader("Accept", "application/json");
    } catch (e) {
      log("setRequestHeader failed (continuing): " + e.message);
    }

    xhr.onload = function() {
      log("XHR onload, status: " + xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var responseText = xhr.responseText;
          log("Response length: " + responseText.length);
          var data = JSON.parse(responseText);
          log("Parsed OK, addresses: " + (data.adresser ? data.adresser.length : 0));
          
          if (data.adresser && data.adresser.length > 0) {
            var addr = data.adresser[0];
            log("Address: " + (addr.adressetekst || "(none)"));
            safeCallback({
              adressetekst: addr.adressetekst || "",
              kommunenavn: addr.kommunenavn || "",
              kommunenummer: addr.kommunenummer || "",
              gardsnummer: addr.gardsnummer || "",
              bruksnummer: addr.bruksnummer || "",
              postnummer: addr.postnummer || "",
              poststed: addr.poststed || "",
              distanse: addr.meterDistanseTilPunkt || null
            });
          } else {
            log("No addresses in response");
            safeCallback(null);
          }
        } catch (e) {
          log("Parse error: " + e.message);
          safeCallback(null);
        }
      } else {
        log("HTTP error: " + xhr.status);
        safeCallback(null);
      }
    };
    
    xhr.onerror = function() {
      log("XHR onerror event");
      safeCallback(null);
    };

    xhr.ontimeout = function() {
      log("XHR timeout");
      safeCallback(null);
    };

    // Set timeout for slow networks
    try {
      xhr.timeout = 15000;
    } catch (e) {
      log("timeout not supported");
    }
    
    log("Sending XHR request");
    try {
      xhr.send();
      log("XHR send() completed");
    } catch (e) {
      log("XHR send error: " + e.message);
      safeCallback(null);
    }
  }

  function updateLocationField(lat, lon) {
    log("updateLocationField(" + lat.toFixed(4) + ", " + lon.toFixed(4) + ")");
    var input = document.getElementById("location");
    if (input) {
      input.value = formatLatLon(lat, lon);
      log("Location field updated");
    } else {
      log("ERROR: #location input not found!");
    }
    lastLatLon = { lat: lat, lon: lon };

    // Fetch address data from Geonorge API (async, best-effort)
    fetchAddressFromGeonorge(lat, lon, function(addressData) {
      log("fetchAddressFromGeonorge callback called");
      lastAddressData = addressData;
      if (addressData) {
        log("Address data received, updating fields");
        updateOwnerFieldsFromAddress(addressData);
      } else {
        log("No address data - clearing fields");
        clearOwnerFields();
      }
    });

    // small status line
    var status = document.getElementById("locationStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "locationStatus";
      status.style.fontSize = "0.8rem";
      status.style.marginTop = "0.3rem";
      var locInput = document.getElementById("location");
      if (locInput && locInput.parentNode) {
        locInput.parentNode.insertBefore(status, locInput.nextSibling);
      } else {
        document.body.appendChild(status);
      }
    }
    // Use correct storage key matching i18n.js
    var lang = localStorage.getItem("unearthed-lang") || "no";
    var t = "Posisjon lagret ✔";
    if (global.AppI18n && global.AppI18n.translations && 
        global.AppI18n.translations[lang] && 
        global.AppI18n.translations[lang].locationSaved) {
      t = global.AppI18n.translations[lang].locationSaved;
    }
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
    log("initMapAndLocation called");
    var mapEl = document.getElementById("map");
    if (!mapEl || !global.L) {
      log("Leaflet or #map missing – skipping map init.");
      return;
    }

    map = L.map("map").setView([60.0, 10.0], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    map.on("click", function (e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      log("Map clicked at " + lat.toFixed(4) + ", " + lng.toFixed(4));
      setMarker(lat, lng);
      updateLocationField(lat, lng);
    });

    // try to auto-locate
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          log("Geolocation success: " + lat.toFixed(4) + ", " + lon.toFixed(4));
          map.setView([lat, lon], 15);
          setMarker(lat, lon);
          updateLocationField(lat, lon);
        },
        function(err) {
          log("Geolocation failed: " + err.message);
        }
      );
    }
  }

  // called by the existing HTML button
  function useCurrentLocation() {
    log("useCurrentLocation called");
    if (!navigator.geolocation) {
      alert("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        log("GPS position: " + lat.toFixed(4) + ", " + lon.toFixed(4));
        if (map) {
          map.setView([lat, lon], 15);
          setMarker(lat, lon);
        }
        updateLocationField(lat, lon);
      },
      function(err) {
        log("GPS error: " + err.message);
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

  // Initialize - handle case where DOMContentLoaded already fired
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMapAndLocation);
  } else {
    // DOM already ready, init immediately but with slight delay to ensure dbg exists
    setTimeout(initMapAndLocation, 0);
  }

  global.useCurrentLocation = useCurrentLocation;
  global.AppMap = {
    initMapAndLocation: initMapAndLocation,
    useCurrentLocation: useCurrentLocation,
    getLastLatLon: getLastLatLon,
    getLastAddressData: getLastAddressData
  };
})(window);

