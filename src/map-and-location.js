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
      input.value = formatLatLon(lat, lon);
      dbg("[updateLoc] location field set");
    } else {
      dbg("[updateLoc] ERROR: no #location");
    }
    lastLatLon = { lat: lat, lon: lon };

    // Fetch address data from Geonorge API (async, best-effort)
    dbg("[updateLoc] calling fetchAddressFromGeonorge");
    fetchAddressFromGeonorge(lat, lon, function(addressData) {
      dbg("[updateLoc] fetch callback, data: " + (addressData ? "yes" : "no"));
      lastAddressData = addressData;
      if (addressData) {
        dbg("[updateLoc] updating owner fields");
        updateOwnerFieldsFromAddress(addressData);
      } else {
        dbg("[updateLoc] clearing owner fields");
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
    log("initMapAndLocation called");
    
    if (mapInitialized) {
      log("Already initialized, skipping");
      return;
    }
    
    var mapEl = document.getElementById("map");
    log("mapEl: " + (mapEl ? "found" : "NOT FOUND"));
    log("L: " + (typeof global.L));
    
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
  
  // Build AppMap object step by step for Safari compatibility
  var appMapObj = {};
  appMapObj.initMapAndLocation = initMapAndLocation;
  appMapObj.useCurrentLocation = useCurrentLocation;
  appMapObj.getLastLatLon = getLastLatLon;
  appMapObj.getLastAddressData = getLastAddressData;
  global.AppMap = appMapObj;
})(window);

