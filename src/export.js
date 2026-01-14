// export.js
// fill official form + summary pages + multiple photos (half page each)
// summary is localized based on localStorage("unearthed-lang")

(function (global) {
  var PDF_TEMPLATE_URL = "/unearthed/Funnskjema-unlocked.pdf";
  var PDF_LIB_URL = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  var LANG_STORAGE_KEY = "unearthed-lang";
  var FINDER_STORAGE_KEY = "unearthed-finder";

  // Debug helper
  function dbgLog(msg) {
    if (typeof window.dbg === "function") {
      window.dbg("[export] " + msg);
    }
    if (typeof console !== "undefined") {
      console.log("[export] " + msg);
    }
  }

  // Check if localStorage is available
  function isLocalStorageAvailable() {
    try {
      var test = "__storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Save finder info to localStorage
  function saveFinderInfo(finder) {
    if (!isLocalStorageAvailable()) {
      dbgLog("localStorage not available for save");
      return;
    }
    try {
      var json = JSON.stringify(finder);
      localStorage.setItem(FINDER_STORAGE_KEY, json);
      dbgLog("Finder info saved: " + json.substring(0, 50));
    } catch (e) {
      dbgLog("Save finder error: " + e.message);
    }
  }

  // Load finder info from localStorage
  function loadFinderInfo() {
    if (!isLocalStorageAvailable()) {
      dbgLog("localStorage not available for load");
      return null;
    }
    try {
      var stored = localStorage.getItem(FINDER_STORAGE_KEY);
      dbgLog("Loaded from storage: " + (stored ? stored.substring(0, 50) : "null"));
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      dbgLog("Load finder error: " + e.message);
      return null;
    }
  }

  // Pre-fill finder fields on page load
  function prefillFinderFields() {
    dbgLog("prefillFinderFields called");
    var finder = loadFinderInfo();
    if (!finder) {
      dbgLog("No finder info to prefill");
      return;
    }

    dbgLog("Prefilling with: " + finder.name);
    var fieldIds = ["finderName", "finderAddress", "finderPhone", "finderEmail"];
    var fieldValues = [finder.name, finder.address, finder.phone, finder.email];

    for (var i = 0; i < fieldIds.length; i++) {
      var el = document.getElementById(fieldIds[i]);
      if (el && fieldValues[i]) {
        el.value = fieldValues[i];
        dbgLog("Set " + fieldIds[i] + " = " + fieldValues[i]);
      }
    }
  }

  // exact arealtype -> checkbox names from your unlocked PDF
  var AREALTYPE_TO_CHECKBOX = {
    "åker": "Check Box9",
    "aker": "Check Box9",
    "beite": "Check Box4",
    "hage": "Check Box11",
    "skog": "Check Box5",
    "fjell": "Check Box6",
    "strand": "Check Box7",
    "vann": "Check Box10",
  };

  // localized summary labels
  var SUMMARY_TEXT = {
    en: {
      title: "Find – summary",
      object: "Object",
      type: "Type",
      material: "Assumed material",
      age: "Estimated age",
      area: "Area type",
      depth: "Find depth",
      location: "Location (GPS)",
      finder: "Finder",
      finderEmail: "Finder email",
      owner: "Land owner",
      ownerEmail: "Owner email",
      notes: "Notes",
      photo: "Photo",
      page: "Page",
    },
    no: {
      title: "Funn – sammendrag",
      object: "Gjenstand",
      type: "Type",
      material: "Antatt materiale",
      age: "Antatt alder",
      area: "Arealtype",
      depth: "Funndybde",
      location: "Posisjon (GPS)",
      finder: "Finner",
      finderEmail: "Finner e-post",
      owner: "Grunneier",
      ownerEmail: "Grunneier e-post",
      notes: "Notater",
      photo: "Foto",
      page: "Side",
    },
    es: {
      title: "Hallazgo – resumen",
      object: "Objeto",
      type: "Tipo",
      material: "Material supuesto",
      age: "Edad estimada",
      area: "Tipo de zona",
      depth: "Profundidad",
      location: "Ubicación (GPS)",
      finder: "Descubridor",
      finderEmail: "Correo del descubridor",
      owner: "Propietario",
      ownerEmail: "Correo del propietario",
      notes: "Notas",
      photo: "Foto",
      page: "Página",
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function parseLatLon(str) {
    if (!str) return null;
    var m = /Lat:\s*([-0-9.]+)\s*,\s*Lon:\s*([-0-9.]+)/i.exec(str);
    if (!m) return null;
    return { lat: Number(m[1]), lon: Number(m[2]) };
  }

  /**
   * Fetch kommune and fylke info from Kartverket API based on coordinates.
   * Returns Promise resolving to { fylkesnavn, fylkesnummer, kommunenavn, kommunenummer } or null.
   */
  function fetchKommuneInfo(lat, lon) {
    return new Promise(function(resolve) {
      try {
        var url = "https://api.kartverket.no/kommuneinfo/v1/punkt?" +
          "nord=" + encodeURIComponent(lat) + 
          "&ost=" + encodeURIComponent(lon) + 
          "&koordsys=4258";
        
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                var data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (e) {
                console.warn("Kartverket API parse error:", e);
                resolve(null);
              }
            } else {
              console.warn("Kartverket API request failed:", xhr.status);
              resolve(null);
            }
          }
        };
        xhr.onerror = function() {
          console.warn("Kartverket API network error");
          resolve(null);
        };
        xhr.send();
      } catch (err) {
        console.warn("Kartverket API lookup failed:", err);
        resolve(null);
      }
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function(resolve, reject) {
      var r = new FileReader();
      r.onload = function() { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function dataURLToUint8Array(dataURL) {
    var base64 = dataURL.split(",")[1];
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // safe Uint8Array -> base64 (no spread → no RangeError)
  function bytesToBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function ensurePdfLib() {
    if (global.PDFLib) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var s = document.createElement("script");
      s.src = PDF_LIB_URL;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Helper function to safely check a checkbox with proper appearance
  function safeCheckBox(form, fieldName) {
    try {
      var checkbox = form.getCheckBox(fieldName);
      // Uncheck first to reset state, then check
      checkbox.uncheck();
      checkbox.check();
    } catch (e) {
      console.warn("Could not check checkbox " + fieldName + ":", e);
    }
  }

  // Helper to safely get element value
  function getVal(id) {
    var el = document.getElementById(id);
    return el ? (el.value || "") : "";
  }

  function getChecked(id) {
    var el = document.getElementById(id);
    return el ? !!el.checked : false;
  }

  async function saveAsPDF() {
    try {
      await ensurePdfLib();
      var PDFDocument = global.PDFLib.PDFDocument;
      var rgb = global.PDFLib.rgb;

      // current UI language
      var storedLang = localStorage.getItem(LANG_STORAGE_KEY);
      var lang = (storedLang && SUMMARY_TEXT[storedLang]) ? storedLang : "no";
      var L = SUMMARY_TEXT[lang] || SUMMARY_TEXT.no;

      // 1. read DOM values
      var finder = {
        name: getVal("finderName"),
        address: getVal("finderAddress"),
        phone: getVal("finderPhone"),
        email: getVal("finderEmail"),
      };

      // Save finder info for next visit
      saveFinderInfo(finder);

      var owner = {
        name: getVal("ownerName"),
        address: getVal("ownerAddress"),
        phone: getVal("ownerPhone"),
        email: getVal("ownerEmail"),
        kommune: getVal("ownerKommune"),
        gnr: getVal("ownerGnr"),
        bnr: getVal("ownerBnr"),
      };
      var objName = getVal("objectName");
      var objType = getVal("objectType");
      var material = getVal("material");
      var age = getVal("age");
      var arealtype = getVal("arealtype");
      var depth = getVal("findDepth");
      var locationStr = getVal("location");
      var notes = getVal("notes");
      var emailFinder = getChecked("emailFinder");
      var emailOwner = getChecked("emailOwner");

      // 2. read ALL photos (now multiple)
      var photoInput = $("photo");
      var photoFiles = [];
      if (photoInput && photoInput.files) {
        for (var pf = 0; pf < photoInput.files.length; pf++) {
          photoFiles.push(photoInput.files[pf]);
        }
      }
      
      var photoPromises = [];
      for (var pi = 0; pi < photoFiles.length; pi++) {
        photoPromises.push(readFileAsDataURL(photoFiles[pi]));
      }
      var photoDataURLs = await Promise.all(photoPromises);

      // 3. load PDF template
      var resp = await fetch(PDF_TEMPLATE_URL);
      if (!resp.ok) {
        throw new Error("Could not fetch " + PDF_TEMPLATE_URL);
      }
      var existingPdfBytes = await resp.arrayBuffer();
      var pdfDoc = await PDFDocument.load(existingPdfBytes, {
        ignoreEncryption: true,
      });

      var form = pdfDoc.getForm();

      // 4. fill main form (real names)
      // Parse finder address into components: "Street 123, 5073 PLACE"
      var finderStreet = "";
      var finderPostnummer = "";
      var finderSted = "";

      if (finder.address) {
        var fcommaIdx = finder.address.lastIndexOf(",");
        if (fcommaIdx > -1) {
          finderStreet = finder.address.substring(0, fcommaIdx).trim();
          var fpostcodePlace = finder.address.substring(fcommaIdx + 1).trim();
          // Split "5073 BERGEN" into postcode and place
          var fspaceIdx = fpostcodePlace.indexOf(" ");
          if (fspaceIdx > -1) {
            finderPostnummer = fpostcodePlace.substring(0, fspaceIdx).trim();
            finderSted = fpostcodePlace.substring(fspaceIdx + 1).trim();
          } else {
            // Might be just postcode or just place
            if (/^\d+$/.test(fpostcodePlace)) {
              finderPostnummer = fpostcodePlace;
            } else {
              finderSted = fpostcodePlace;
            }
          }
        } else {
          // No comma, just use as street
          finderStreet = finder.address;
        }
      }

      form.getTextField("Navn finner").setText(finder.name);
      form.getTextField("Adresse finner").setText(finderStreet);
      form.getTextField("Postnummer finner").setText(finderPostnummer);
      form.getTextField("Sted finner").setText(finderSted);
      form.getTextField("Telefonnummer finner").setText(finder.phone);
      form.getTextField("E-post finner").setText(finder.email);

      // Note: addressData is fetched later, owner address parsing happens after GPS section
      form.getTextField("Grunneier").setText(owner.name);
      form.getTextField("Telefonnummer grunneier").setText(owner.phone);
      form.getTextField("E-post grunneier").setText(owner.email);

      // permission - only check if owner name is provided
      if (owner.name && owner.name.trim() !== "") {
        safeCheckBox(form, "Grunneier har gitt tillatelse _y87rRhfj6A5hS8oITp7knw");
      }

      // object
      form.getTextField("Gjenstand").setText(objName);

      // depth -> Dybde
      if (depth) {
        try {
          form.getTextField("Dybde").setText(depth + " cm");
        } catch (e) {
          console.warn("Could not set Dybde:", e);
        }
      }

      // GPS
      var parsed = parseLatLon(locationStr);
      if (parsed) {
        form.getTextField("GPS-nord").setText(parsed.lat.toFixed(6));
        form.getTextField("GPS-øst").setText(parsed.lon.toFixed(6));
      }
      form.getTextField("Datum/projeksjon").setText("WGS84 (EPSG:4326)");

      // Fetch kommune/fylke info from Kartverket API (best-effort)
      var kommuneInfo = null;
      if (parsed) {
        kommuneInfo = await fetchKommuneInfo(parsed.lat, parsed.lon);
        if (kommuneInfo) {
          console.log("Kartverket kommune info:", kommuneInfo);
        }
      }

      // Fill Fylke field
      if (kommuneInfo && kommuneInfo.fylkesnavn) {
        try {
          form.getTextField("Fylke").setText(kommuneInfo.fylkesnavn);
        } catch (e) {
          console.warn("Could not set Fylke field:", e);
        }
      }

      // Address data from Geonorge API (best-effort, may be null)
      var addressData = (global.AppMap && global.AppMap.getLastAddressData) 
        ? global.AppMap.getLastAddressData() 
        : null;

      // Parse owner address into components for PDF fields
      // If we have API data, use it directly; otherwise try to parse the combined address
      var ownerStreet = "";
      var ownerPostnummer = "";
      var ownerSted = "";

      if (addressData) {
        // Use raw API data (most reliable)
        ownerStreet = addressData.adressetekst || "";
        ownerPostnummer = addressData.postnummer || "";
        ownerSted = addressData.poststed || "";
      } else if (owner.address) {
        // Try to parse combined address: "Street 123, 5073 PLACE"
        var ocommaIdx = owner.address.lastIndexOf(",");
        if (ocommaIdx > -1) {
          ownerStreet = owner.address.substring(0, ocommaIdx).trim();
          var opostcodePlace = owner.address.substring(ocommaIdx + 1).trim();
          // Split "5073 BERGEN" into postcode and place
          var ospaceIdx = opostcodePlace.indexOf(" ");
          if (ospaceIdx > -1) {
            ownerPostnummer = opostcodePlace.substring(0, ospaceIdx).trim();
            ownerSted = opostcodePlace.substring(ospaceIdx + 1).trim();
          } else {
            // Might be just postcode or just place
            if (/^\d+$/.test(opostcodePlace)) {
              ownerPostnummer = opostcodePlace;
            } else {
              ownerSted = opostcodePlace;
            }
          }
        } else {
          // No comma, just use as street
          ownerStreet = owner.address;
        }
      }

      // Fill owner address fields in PDF
      form.getTextField("Adresse grunneier").setText(ownerStreet);
      form.getTextField("Postnummer grunneier").setText(ownerPostnummer);
      form.getTextField("Sted grunneier").setText(ownerSted);

      // Address data - prefer form fields (user may have edited), fallback to API data
      var kommune = owner.kommune || (addressData && addressData.kommunenavn ? addressData.kommunenavn : "");
      var gnr = owner.gnr || (addressData && addressData.gardsnummer ? String(addressData.gardsnummer) : "");
      var bnr = owner.bnr || (addressData && addressData.bruksnummer ? String(addressData.bruksnummer) : "");

      // Fill Kommune field
      if (kommune) {
        try {
          form.getTextField("Kommune").setText(kommune);
        } catch (e) {
          console.warn("Could not set Kommune field:", e);
        }
      }

      // Fill "Funnsted" field with gnr/bnr info
      if (gnr || bnr) {
        var gbnrText = (gnr && bnr) ? (gnr + "/" + bnr) : (gnr || bnr);
        try {
          form.getTextField("Funnsted").setText(gbnrText);
          console.log("Successfully set field Funnsted to " + gbnrText);
        } catch (e) {
          console.warn("Could not set Funnsted field:", e);
        }
      }

      // date
      try {
        form
          .getTextField("Funndato")
          .setText(new Date().toISOString().slice(0, 10));
      } catch (_) {}

      // extra info – material, age, and notes only
      var extra = [];
      if (material) extra.push((L.material || "Material") + ": " + material);
      if (age) extra.push((L.age || "Age") + ": " + age);
      if (notes) extra.push(notes);
      form.getTextField("Andre opplysninger").setText(extra.join("\n"));

      // Målemetode -> Mobiltelefon
      safeCheckBox(form, "Check Box12");

      // Arealtype
      if (arealtype) {
        var akey = arealtype.trim().toLowerCase();
        var afieldName =
          AREALTYPE_TO_CHECKBOX[akey] ||
          AREALTYPE_TO_CHECKBOX[akey.replace("å", "a")];
        if (afieldName) {
          safeCheckBox(form, afieldName);
        }
      }

      // 5. first summary page (with big photo)
      var summaryPage = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      var pageSize = summaryPage.getSize();
      var width = pageSize.width;
      var height = pageSize.height;
      var y = height - 50;
      var left = 40;
      var lineHeight = 16;

      function drawLine(label, value) {
        summaryPage.drawText(label + ": " + (value || ""), {
          x: left,
          y: y,
          size: 11,
        });
        y -= lineHeight;
      }

      // title
      summaryPage.drawText(L.title || "Find – summary", {
        x: left,
        y: y,
        size: 14,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 26;

      drawLine(L.object, objName);
      drawLine(L.type, objType);
      drawLine(L.material, material);
      drawLine(L.age, age);
      drawLine(L.area, arealtype);
      drawLine(L.depth, depth ? depth + " cm" : "");
      drawLine(L.location, locationStr);
      drawLine(L.finder, finder.name);
      drawLine(L.finderEmail, finder.email);
      drawLine(L.owner, owner.name);
      drawLine(L.ownerEmail, owner.email);

      // notes
      if (notes) {
        y -= 6;
        summaryPage.drawText(L.notes + ":", { x: left, y: y, size: 11 });
        y -= lineHeight;
        var words = notes.split(/\s+/);
        var lineText = "";
        var maxChars = 85;
        for (var wi = 0; wi < words.length; wi++) {
          var w = words[wi];
          var test = lineText + w + " ";
          if (test.length > maxChars) {
            summaryPage.drawText(lineText, { x: left, y: y, size: 10 });
            y -= 14;
            lineText = w + " ";
          } else {
            lineText = test;
          }
        }
        if (lineText) {
          summaryPage.drawText(lineText, { x: left, y: y, size: 10 });
          y -= 14;
        }
      }

      // BIG photo on FIRST summary page (about half page)
      if (photoDataURLs.length > 0) {
        var firstPhoto = photoDataURLs[0];
        var imgBytes = dataURLToUint8Array(firstPhoto);
        var img;
        if (firstPhoto.startsWith("data:image/png")) {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }
        // target width ~ half page (a bit less than full width)
        var targetWidth = width - 80; // 40 margins left/right
        var factor = targetWidth / img.width;
        var targetHeight = img.height * factor;
        var imgX = left;
        // put image lower, so text stays top
        var imgY = 80; // leave bottom margin
        summaryPage.drawImage(img, {
          x: imgX,
          y: imgY,
          width: targetWidth,
          height: targetHeight,
        });
        // small caption
        summaryPage.drawText((L.photo || "Photo") + " 1", {
          x: left,
          y: imgY - 12,
          size: 9,
          color: rgb(0.2, 0.2, 0.2),
        });
      }

      // OTHER photos → each gets its own page
      if (photoDataURLs.length > 1) {
        for (var photoIdx = 1; photoIdx < photoDataURLs.length; photoIdx++) {
          var pData = photoDataURLs[photoIdx];
          var pimgBytes = dataURLToUint8Array(pData);
          var page = pdfDoc.addPage([595.28, 841.89]);
          var psize = page.getSize();
          var pw = psize.width;
          var ph = psize.height;

          var pimg;
          if (pData.startsWith("data:image/png")) {
            pimg = await pdfDoc.embedPng(pimgBytes);
          } else {
            pimg = await pdfDoc.embedJpg(pimgBytes);
          }

          // half page (big)
          var ptargetWidth = pw - 80; // 40 margins
          var pfactor = ptargetWidth / pimg.width;
          var ptargetHeight = pimg.height * pfactor;
          var pimgX = 40;
          var pimgY = (ph - ptargetHeight) / 2; // center vertically a bit

          page.drawImage(pimg, {
            x: pimgX,
            y: pimgY,
            width: ptargetWidth,
            height: ptargetHeight,
          });

          page.drawText((L.photo || "Photo") + " " + (photoIdx + 1), {
            x: pimgX,
            y: pimgY - 14,
            size: 10,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      }

      // update form appearances
      form.updateFieldAppearances();

      // 6. save & download
      var pdfBytes = await pdfDoc.save();
      var blob = new Blob([pdfBytes], { type: "application/pdf" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "funnskjema-utfylt.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      // 7. email hook (needs server)
      if (emailFinder || emailOwner) {
        var pdfBase64 = bytesToBase64(new Uint8Array(pdfBytes));
        var payload = {
          lang: lang,
          finder: finder,
          owner: owner,
          object: {
            name: objName,
            type: objType,
            material: material,
            age: age,
          },
          arealtype: arealtype,
          depth: depth,
          location: locationStr,
          notes: notes,
          wants: {
            finder: emailFinder,
            owner: emailOwner,
          },
          pdfBase64: pdfBase64,
          filename: "funnskjema-utfylt.pdf",
        };
        console.log(
          "Email requested – send this payload to your server:",
          payload
        );
      }
    } catch (err) {
      console.error("Could not create filled PDF:", err);
      alert(
        "Could not create the filled PDF. See console for details.\n" +
          (err && err.message ? err.message : "")
      );
    }
  }

  // Pre-fill finder fields when page loads
  // Handle case where DOMContentLoaded already fired
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prefillFinderFields);
  } else {
    setTimeout(prefillFinderFields, 0);
  }

  // expose
  global.saveAsPDF = saveAsPDF;
  global.AppExport = {
    saveAsPDF: saveAsPDF
  };
})(window);

