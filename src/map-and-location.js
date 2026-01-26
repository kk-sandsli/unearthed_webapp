// map-and-location.js
// Handles Leaflet map + geolocation + keeping #location in sync.

(function (global) {
  try {
  // Immediate log to confirm script execution
  if (typeof window.dbg === "function") {
    window.dbg("map-and-location IIFE running");
  }

  var map = null;
  var marker = null;
  var lastLatLon = null;
  var lastAddressData = null; // Store address data from Geonorge API

  // Address marker and circle (shows nearest address location)
  var addressMarker = null;
  var addressCircle = null;
  
  // Feature flag: set to false to disable address marker/circle display
  var SHOW_ADDRESS_MARKER = true;

  // Coordinate system: "utm32" or "wgs84"
  var COORD_STORAGE_KEY = "unearthed-coord-system";
  var coordSystem = "utm32"; // Default to UTM32

  // UTM Zone 32N bounds (longitude 3°E to 12°E)
  var UTM32_LON_MIN = 3;
  var UTM32_LON_MAX = 12;

  // Geonorge API endpoint for point search
  var GEONORGE_API_URL = "https://ws.geonorge.no/adresser/v1/punktsok";

  /**
   * Dispatch a change event on an element (ES5 compatible).
   * Used to notify clear buttons when fields are programmatically updated.
   */
  function dispatchChange(el) {
    if (!el) return;
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent("change", true, false);
    el.dispatchEvent(evt);
  }

  /**
   * Convert WGS84 (lat, lon) to UTM Zone 32N (EPSG:25832)
   * Returns { easting, northing } in meters
   */
  function wgs84ToUtm32(lat, lon) {
    // WGS84 ellipsoid parameters
    var a = 6378137.0; // semi-major axis
    var f = 1 / 298.257223563; // flattening
    var k0 = 0.9996; // scale factor
    var lon0 = 9; // central meridian for zone 32

    var e2 = 2 * f - f * f; // eccentricity squared
    var e4 = e2 * e2;
    var e6 = e4 * e2;
    var ep2 = e2 / (1 - e2); // second eccentricity squared

    var latRad = lat * Math.PI / 180;
    var lonRad = lon * Math.PI / 180;
    var lon0Rad = lon0 * Math.PI / 180;

    var N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    var T = Math.tan(latRad) * Math.tan(latRad);
    var C = ep2 * Math.cos(latRad) * Math.cos(latRad);
    var A = (lonRad - lon0Rad) * Math.cos(latRad);

    // Meridional arc
    var M = a * (
      (1 - e2/4 - 3*e4/64 - 5*e6/256) * latRad -
      (3*e2/8 + 3*e4/32 + 45*e6/1024) * Math.sin(2*latRad) +
      (15*e4/256 + 45*e6/1024) * Math.sin(4*latRad) -
      (35*e6/3072) * Math.sin(6*latRad)
    );

    var A2 = A * A;
    var A3 = A2 * A;
    var A4 = A3 * A;
    var A5 = A4 * A;
    var A6 = A5 * A;
    var T2 = T * T;

    var easting = k0 * N * (
      A + 
      (1 - T + C) * A3 / 6 + 
      (5 - 18*T + T2 + 72*C - 58*ep2) * A5 / 120
    ) + 500000; // False easting

    var northing = k0 * (
      M + N * Math.tan(latRad) * (
        A2 / 2 + 
        (5 - T + 9*C + 4*C*C) * A4 / 24 + 
        (61 - 58*T + T2 + 600*C - 330*ep2) * A6 / 720
      )
    );

    return { easting: easting, northing: northing };
  }

  /**
   * Check if coordinates are within UTM Zone 32 bounds
   */
  function isInUtm32Zone(lon) {
    return lon >= UTM32_LON_MIN && lon <= UTM32_LON_MAX;
  }

  /**
   * Get effective coordinate system (falls back to WGS84 if outside UTM32 zone)
   */
  function getEffectiveCoordSystem(lon) {
    if (coordSystem === "utm32" && !isInUtm32Zone(lon)) {
      return "wgs84";
    }
    return coordSystem;
  }

  /**
   * Load coordinate system preference from localStorage
   */
  function loadCoordSystemPreference() {
    try {
      var stored = localStorage.getItem(COORD_STORAGE_KEY);
      if (stored === "wgs84" || stored === "utm32") {
        coordSystem = stored;
      }
    } catch (e) {
      // localStorage not available, use default
    }
  }

  /**
   * Save coordinate system preference to localStorage
   */
  function saveCoordSystemPreference() {
    try {
      localStorage.setItem(COORD_STORAGE_KEY, coordSystem);
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Toggle coordinate system and update display
   */
  function toggleCoordSystem() {
    coordSystem = (coordSystem === "utm32") ? "wgs84" : "utm32";
    saveCoordSystemPreference();
    updateToggleButton();
    
    // Re-format current coordinates if we have them
    if (lastLatLon) {
      var input = document.getElementById("location");
      if (input) {
        input.value = formatCoordinates(lastLatLon.lat, lastLatLon.lon);
      }
    }
    
    log("Coordinate system toggled to: " + coordSystem);
  }

  /**
   * Update the toggle button text to reflect current system
   */
  function updateToggleButton() {
    var btn = document.getElementById("coordToggle");
    if (!btn) return;
    
    var effectiveSys = coordSystem;
    if (lastLatLon && coordSystem === "utm32" && !isInUtm32Zone(lastLatLon.lon)) {
      effectiveSys = "wgs84";
      btn.textContent = "WGS84*"; // Asterisk indicates fallback
      btn.title = "Outside UTM32 zone - using WGS84";
    } else {
      btn.textContent = coordSystem.toUpperCase();
      btn.title = "Click to toggle coordinate system";
    }
  }

  // Load preference on init
  loadCoordSystemPreference();

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

  /**
   * Format coordinates based on current coordinate system preference
   */
  function formatCoordinates(lat, lon) {
    var effectiveSys = getEffectiveCoordSystem(lon);
    
    if (effectiveSys === "utm32") {
      var utm = wgs84ToUtm32(lat, lon);
      return "N: " + Math.round(utm.northing) + ", E: " + Math.round(utm.easting);
    }
    return "Lat: " + lat.toFixed(6) + ", Lon: " + lon.toFixed(6);
  }

  // Keep old function name for compatibility
  function formatLatLon(lat, lon) {
    return formatCoordinates(lat, lon);
  }

  /**
   * Update landowner form fields with address data from Geonorge.
   */
  function updateOwnerFieldsFromAddress(addressData) {
    if (!addressData) return;
    
    // Check if auto-fill is enabled
    var autoFillCheckbox = document.getElementById("autoFillAddress");
    if (autoFillCheckbox && !autoFillCheckbox.checked) {
      log("updateOwnerFieldsFromAddress skipped - auto-fill disabled");
      return;
    }
    
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
      dispatchChange(addrInput);
    }

    // Update kommune field
    var kommuneInput = document.getElementById("ownerKommune");
    if (kommuneInput) {
      kommuneInput.value = addressData.kommunenavn || "";
      dispatchChange(kommuneInput);
    }

    // Update gårdsnummer field
    var gnrInput = document.getElementById("ownerGnr");
    if (gnrInput) {
      gnrInput.value = addressData.gardsnummer ? String(addressData.gardsnummer) : "";
      dispatchChange(gnrInput);
    }

    // Update bruksnummer field
    var bnrInput = document.getElementById("ownerBnr");
    if (bnrInput) {
      bnrInput.value = addressData.bruksnummer ? String(addressData.bruksnummer) : "";
      dispatchChange(bnrInput);
    }
    log("Owner fields updated");
  }

  /**
   * Clear all owner address fields (when no address is found).
   */
  function clearOwnerFields() {
    // Check if auto-fill is enabled
    var autoFillCheckbox = document.getElementById("autoFillAddress");
    if (autoFillCheckbox && !autoFillCheckbox.checked) {
      log("clearOwnerFields skipped - auto-fill disabled");
      return;
    }
    
    log("clearOwnerFields called");
    var fields = ["ownerAddress", "ownerKommune", "ownerGnr", "ownerBnr"];
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (el) {
        el.value = "";
        dispatchChange(el);
      }
    }
  }

  /**
   * Create custom address marker icon (green dot)
   */
  function createAddressIcon() {
    if (!global.L) return null;
    return L.divIcon({
      className: 'address-marker',
      html: '<div style="background:#4CAF50;width:14px;height:14px;border-radius:50%;border:3px solid #2E7D32;box-shadow:0 0 8px rgba(76,175,80,0.5);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  /**
   * Update the address marker and distance circle on the map.
   * Shows the location of the nearest address and a circle indicating the distance.
   * Can be disabled by setting SHOW_ADDRESS_MARKER = false.
   */
  function updateAddressMarker(addressData) {
    var dbg = window.dbg || function(){};
    
    // Remove existing marker and circle
    if (addressMarker && map) {
      map.removeLayer(addressMarker);
      addressMarker = null;
    }
    if (addressCircle && map) {
      map.removeLayer(addressCircle);
      addressCircle = null;
    }
    
    // Check if auto-fill is enabled
    var autoFillCheckbox = document.getElementById("autoFillAddress");
    if (autoFillCheckbox && !autoFillCheckbox.checked) {
      dbg("[addrMarker] Auto-fill disabled - not showing marker");
      return;
    }
    
    // Check if feature is enabled and we have valid data
    if (!SHOW_ADDRESS_MARKER || !map || !global.L) {
      dbg("[addrMarker] Feature disabled or no map");
      return;
    }
    
    if (!addressData || !addressData.adresseLat || !addressData.adresseLon) {
      dbg("[addrMarker] No address coordinates available");
      return;
    }
    
    var addrLat = addressData.adresseLat;
    var addrLon = addressData.adresseLon;
    var distance = addressData.distanse;
    
    dbg("[addrMarker] Adding marker at " + addrLat.toFixed(4) + ", " + addrLon.toFixed(4));
    
    // Create the distance circle (dashed green)
    if (distance && distance > 0) {
      addressCircle = L.circle([addrLat, addrLon], {
        radius: distance,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(map);
      dbg("[addrMarker] Circle added, radius: " + distance.toFixed(0) + "m");
    }
    
    // Build popup content (compact for mobile)
    var popupContent = '<div style="font-size:13px;max-width:200px;">';
    popupContent += '<strong style="color:#2E7D32;">Nearest address</strong><br>';
    popupContent += addressData.adressetekst || "";
    if (addressData.postnummer || addressData.poststed) {
      popupContent += '<br>' + (addressData.postnummer || "") + ' ' + (addressData.poststed || "");
    }
    if (addressData.kommunenavn) {
      popupContent += '<br><span style="color:#666;">' + addressData.kommunenavn + '</span>';
    }
    if (addressData.gardsnummer || addressData.bruksnummer) {
      popupContent += '<br><span style="color:#888;font-size:11px;">Gnr/Bnr: ' + 
        (addressData.gardsnummer || "-") + '/' + (addressData.bruksnummer || "-") + '</span>';
    }
    if (distance) {
      popupContent += '<br><span style="color:#888;font-size:11px;">Distance: ' + 
        Math.round(distance) + ' m</span>';
    }
    popupContent += '</div>';
    
    // Create address marker with popup
    var addrIcon = createAddressIcon();
    if (addrIcon) {
      addressMarker = L.marker([addrLat, addrLon], { icon: addrIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          maxWidth: 220,
          closeButton: true,
          autoClose: true
        });
      dbg("[addrMarker] Marker added");
    }
  }

  /**
   * Clear the address marker and circle from the map.
   */
  function clearAddressMarker() {
    if (addressMarker && map) {
      map.removeLayer(addressMarker);
      addressMarker = null;
    }
    if (addressCircle && map) {
      map.removeLayer(addressCircle);
      addressCircle = null;
    }
  }

  /**
   * Fetch address data from Geonorge API based on coordinates.
   * Uses XMLHttpRequest for better Safari compatibility.
   */
  function fetchAddressFromGeonorge(lat, lon, callback) {
    // Use window.dbg directly for Safari debugging
    var dbg = window.dbg || function(){};
    dbg("[fetch] starting for " + lat.toFixed(4) + ", " + lon.toFixed(4));
    
    var url = GEONORGE_API_URL + 
      "?lat=" + encodeURIComponent(lat) +
      "&lon=" + encodeURIComponent(lon) +
      "&radius=10000" +
      "&koordsys=4258" +
      "&utkoordsys=4258" +
      "&treffPerSide=5" +
      "&side=0" +
      "&asciiKompatibel=true";

    dbg("[fetch] URL ready");

    var xhr;
    try {
      xhr = new XMLHttpRequest();
      dbg("[fetch] XHR created");
    } catch (e) {
      dbg("[fetch] XHR create error: " + e.message);
      callback(null);
      return;
    }

    var callbackCalled = false;
    function safeCallback(result) {
      if (callbackCalled) return;
      callbackCalled = true;
      dbg("[fetch] callback with: " + (result ? "data" : "null"));
      callback(result);
    }

    try {
      xhr.open("GET", url, true);
      dbg("[fetch] XHR opened");
    } catch (e) {
      dbg("[fetch] open error: " + e.message);
      safeCallback(null);
      return;
    }
    
    xhr.onload = function() {
      dbg("[fetch] onload status: " + xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var responseText = xhr.responseText;
          dbg("[fetch] response len: " + responseText.length);
          var data = JSON.parse(responseText);
          dbg("[fetch] addresses: " + (data.adresser ? data.adresser.length : 0));
          
          if (data.adresser && data.adresser.length > 0) {
            var addr = data.adresser[0];
            dbg("[fetch] got: " + (addr.adressetekst || "(none)"));
            // Extract address coordinates from representasjonspunkt
            var addrLat = null;
            var addrLon = null;
            if (addr.representasjonspunkt) {
              addrLat = addr.representasjonspunkt.lat || null;
              addrLon = addr.representasjonspunkt.lon || null;
            }
            safeCallback({
              adressetekst: addr.adressetekst || "",
              kommunenavn: addr.kommunenavn || "",
              kommunenummer: addr.kommunenummer || "",
              gardsnummer: addr.gardsnummer || "",
              bruksnummer: addr.bruksnummer || "",
              postnummer: addr.postnummer || "",
              poststed: addr.poststed || "",
              distanse: addr.meterDistanseTilPunkt || null,
              adresseLat: addrLat,
              adresseLon: addrLon
            });
          } else {
            dbg("[fetch] no addresses");
            safeCallback(null);
          }
        } catch (e) {
          dbg("[fetch] parse error: " + e.message);
          safeCallback(null);
        }
      } else {
        dbg("[fetch] HTTP error: " + xhr.status);
        safeCallback(null);
      }
    };
    
    xhr.onerror = function() {
      dbg("[fetch] onerror event");
      safeCallback(null);
    };

    xhr.ontimeout = function() {
      dbg("[fetch] timeout");
      safeCallback(null);
    };

    // Set timeout for slow networks
    try {
      xhr.timeout = 15000;
    } catch (e) {
      // timeout not supported, ignore
    }
    
    dbg("[fetch] sending...");
    try {
      xhr.send();
      dbg("[fetch] send() done");
    } catch (e) {
      dbg("[fetch] send error: " + e.message);
      safeCallback(null);
    }
  }

  function updateLocationField(lat, lon) {
    var dbg = window.dbg || function(){};
    dbg("[updateLoc] " + lat.toFixed(4) + ", " + lon.toFixed(4));
    
    var input = document.getElementById("location");
    if (input) {
      input.value = formatCoordinates(lat, lon);
      dbg("[updateLoc] location field set");
    } else {
      dbg("[updateLoc] ERROR: no #location");
    }
    lastLatLon = { lat: lat, lon: lon };

    // Update toggle button to reflect effective coordinate system
    updateToggleButton();

    // Fetch address data from Geonorge API (async, best-effort)
    dbg("[updateLoc] calling fetchAddressFromGeonorge");
    fetchAddressFromGeonorge(lat, lon, function(addressData) {
      dbg("[updateLoc] fetch callback, data: " + (addressData ? "yes" : "no"));
      lastAddressData = addressData;
      if (addressData) {
        dbg("[updateLoc] updating owner fields");
        updateOwnerFieldsFromAddress(addressData);
        // Show address marker and distance circle on map
        updateAddressMarker(addressData);
      } else {
        dbg("[updateLoc] clearing owner fields");
        clearOwnerFields();
        // Clear address marker when no address found
        clearAddressMarker();
      }
    });
  }

  function setMarker(lat, lon) {
    log("setMarker called");
    if (!map) {
      log("setMarker: no map!");
      return;
    }
    if (marker) {
      marker.setLatLng([lat, lon]);
    } else {
      marker = L.marker([lat, lon]).addTo(map);
    }
    log("Marker set");
  }

  var mapInitialized = false;
  
  function initMapAndLocation() {
    var dbg = window.dbg || function(){};
    dbg("[initMap] called");
    
    try {
      if (mapInitialized) {
        dbg("[initMap] Already initialized");
        return;
      }
      
      var mapEl = document.getElementById("map");
      dbg("[initMap] mapEl: " + (mapEl ? "found" : "NOT FOUND"));
      dbg("[initMap] L: " + (typeof global.L));
    
    if (!mapEl || !global.L) {
      log("Leaflet or #map missing – skipping map init.");
      return;
    }

    try {
      log("Creating Leaflet map...");
      map = L.map("map").setView([60.0, 10.0], 6);
      log("Map created: " + (map ? "yes" : "no"));

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      log("Tile layer added");

      map.on("click", function (e) {
        log("Leaflet click event!");
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
        log("Map clicked at " + lat.toFixed(4) + ", " + lng.toFixed(4));
        setMarker(lat, lng);
        updateLocationField(lat, lng);
      });
      log("Click handler attached");
      
      mapInitialized = true;
      log("Map init complete");
    } catch (e) {
      log("Map init ERROR: " + e.message);
    }

    // try to auto-locate
    if (navigator.geolocation) {
      log("Requesting geolocation...");
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          dbg("[initMap] Geolocation: " + lat.toFixed(4) + ", " + lon.toFixed(4));
          map.setView([lat, lon], 15);
          setMarker(lat, lon);
          updateLocationField(lat, lon);
        },
        function(err) {
          dbg("[initMap] Geolocation err: " + err.message);
        }
      );
    }
    
    // Initialize toggle button text
    updateToggleButton();
    
    dbg("[initMap] done");
    } catch(e) {
      dbg("[initMap] ERROR: " + e.message);
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
  
  // Build AppMap object step by step for Safari compatibility
  var appMapObj = {};
  appMapObj.initMapAndLocation = initMapAndLocation;
  appMapObj.useCurrentLocation = useCurrentLocation;
  appMapObj.getLastLatLon = getLastLatLon;
  appMapObj.getLastAddressData = getLastAddressData;
  appMapObj.getCoordSystem = function() { return coordSystem; };
  appMapObj.getEffectiveCoordSystem = function() {
    return lastLatLon ? getEffectiveCoordSystem(lastLatLon.lon) : coordSystem;
  };
  appMapObj.wgs84ToUtm32 = wgs84ToUtm32;
  appMapObj.toggleCoordSystem = toggleCoordSystem;
  global.AppMap = appMapObj;
  
  // Expose toggle function globally for onclick handler
  global.toggleCoordSystem = toggleCoordSystem;
  
  if (typeof window.dbg === "function") {
    window.dbg("map-and-location IIFE completed OK");
  }
  } catch(e) {
    if (typeof window.dbg === "function") {
      window.dbg("map-and-location ERROR: " + e.message + " at line " + (e.line || e.lineNumber || "?"));
    }
  }
})(window);

