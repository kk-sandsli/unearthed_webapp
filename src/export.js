// export.js
// fill official form + summary pages + multiple photos (half page each)
// summary is localized based on localStorage("unearthed-lang")

// Immediate test - before anything else
try { window.dbg && window.dbg("export.js FILE START"); } catch(e) {}

(function (global) {
  try {
  window.dbg && window.dbg("export.js IIFE running");
  
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

  // Save finder info to localStorage (used during PDF export)
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

  // exact arealtype -> checkbox names from your unlocked PDF
  var AREALTYPE_TO_CHECKBOX = {
    "åker": "Check Box9",
    "aker": "Check Box9",
    "beite": "Check Box4",
    "hage": "Check Box11",
    "skog": "Check Box5",
    "fjell": "Check Box6",
    "strand": "Check Box7",
    "vann": "Check Box10"
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
      page: "Page"
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
      page: "Side"
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
      page: "Página"
    }
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
  function safeCheckBox(form, fieldName, shouldCheck) {
    var dbg = window.dbg || function(){};
    // Default to checking if not specified
    if (shouldCheck === undefined) shouldCheck = true;
    try {
      var checkbox = form.getCheckBox(fieldName);
      if (shouldCheck) {
        checkbox.check();
        dbg("[export] Checked: " + fieldName);
      } else {
        checkbox.uncheck();
        dbg("[export] Unchecked: " + fieldName);
      }
    } catch (e) {
      dbg("[export] Checkbox error " + fieldName + ": " + e.message);
    }
  }
  
  // Uncheck specific known checkboxes - only the ones we might want to set
  function resetKnownCheckboxes(form) {
    var dbg = window.dbg || function(){};
    // Arealtype checkboxes (Check Box 4-11 based on mapping)
    var arealtypeBoxes = ["Check Box4", "Check Box5", "Check Box6", "Check Box7", "Check Box9", "Check Box10", "Check Box11"];
    // Measuring method checkboxes (Check Box 1, 2, 3, 12, 13, etc.)
    var methodBoxes = ["Check Box1", "Check Box2", "Check Box3", "Check Box8", "Check Box12", "Check Box13", "Check Box14", "Check Box15"];
    // Permission checkbox  
    var permissionBox = "Grunneier har gitt tillatelse _y87rRhfj6A5hS8oITp7knw";
    
    // Uncheck arealtype boxes
    for (var i = 0; i < arealtypeBoxes.length; i++) {
      try {
        form.getCheckBox(arealtypeBoxes[i]).uncheck();
      } catch(e) {}
    }
    
    // Uncheck method boxes
    for (var j = 0; j < methodBoxes.length; j++) {
      try {
        form.getCheckBox(methodBoxes[j]).uncheck();
      } catch(e) {}
    }
    
    // Uncheck permission box
    try {
      form.getCheckBox(permissionBox).uncheck();
    } catch(e) {}
    
    dbg("[export] Reset known checkboxes");
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

  // Helper to embed image (returns Promise)
  function embedImage(pdfDoc, dataURL) {
    var imgBytes = dataURLToUint8Array(dataURL);
    if (dataURL.indexOf("data:image/png") === 0) {
      return pdfDoc.embedPng(imgBytes);
    } else {
      return pdfDoc.embedJpg(imgBytes);
    }
  }

  function saveAsPDF() {
    var dbg = window.dbg || function(){};
    dbg("[export] saveAsPDF called");
    
    // Collect all form data first (synchronous)
    var storedLang = localStorage.getItem(LANG_STORAGE_KEY);
    var lang = (storedLang && SUMMARY_TEXT[storedLang]) ? storedLang : "no";
    var L = SUMMARY_TEXT[lang] || SUMMARY_TEXT.no;

    var finder = {
      name: getVal("finderName"),
      address: getVal("finderAddress"),
      phone: getVal("finderPhone"),
      email: getVal("finderEmail")
    };
    saveFinderInfo(finder);

    var owner = {
      name: getVal("ownerName"),
      address: getVal("ownerAddress"),
      phone: getVal("ownerPhone"),
      email: getVal("ownerEmail"),
      kommune: getVal("ownerKommune"),
      gnr: getVal("ownerGnr"),
      bnr: getVal("ownerBnr")
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

    // Read photo files
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

    // Parse location for GPS
    var parsed = parseLatLon(locationStr);

    // Parse finder address
    var finderStreet = "";
    var finderPostnummer = "";
    var finderSted = "";
    if (finder.address) {
      var fcommaIdx = finder.address.lastIndexOf(",");
      if (fcommaIdx > -1) {
        finderStreet = finder.address.substring(0, fcommaIdx).trim();
        var fpostcodePlace = finder.address.substring(fcommaIdx + 1).trim();
        var fspaceIdx = fpostcodePlace.indexOf(" ");
        if (fspaceIdx > -1) {
          finderPostnummer = fpostcodePlace.substring(0, fspaceIdx).trim();
          finderSted = fpostcodePlace.substring(fspaceIdx + 1).trim();
        } else {
          if (/^\d+$/.test(fpostcodePlace)) {
            finderPostnummer = fpostcodePlace;
          } else {
            finderSted = fpostcodePlace;
          }
        }
      } else {
        finderStreet = finder.address;
      }
    }

    // Start the Promise chain
    dbg("[export] Starting PDF generation...");
    
    ensurePdfLib()
      .then(function() {
        dbg("[export] pdf-lib loaded");
        return Promise.all(photoPromises);
      })
      .then(function(photoDataURLs) {
        dbg("[export] Photos read: " + photoDataURLs.length);
        
        // Fetch PDF template using XMLHttpRequest for Safari compatibility
        return new Promise(function(resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", PDF_TEMPLATE_URL, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = function() {
            if (xhr.status === 200) {
              resolve({ pdfBytes: xhr.response, photos: photoDataURLs });
            } else {
              reject(new Error("Could not fetch " + PDF_TEMPLATE_URL));
            }
          };
          xhr.onerror = function() {
            reject(new Error("Network error fetching PDF template"));
          };
          xhr.send();
        });
      })
      .then(function(data) {
        dbg("[export] PDF template loaded");
        var PDFDocument = global.PDFLib.PDFDocument;
        var rgb = global.PDFLib.rgb;
        var photoDataURLs = data.photos;
        
        return PDFDocument.load(data.pdfBytes, { ignoreEncryption: true })
          .then(function(pdfDoc) {
            return { pdfDoc: pdfDoc, rgb: rgb, photos: photoDataURLs };
          });
      })
      .then(function(ctx) {
        dbg("[export] PDF document loaded");
        var pdfDoc = ctx.pdfDoc;
        var rgb = ctx.rgb;
        var photoDataURLs = ctx.photos;
        var form = pdfDoc.getForm();

        // Fill finder fields
        form.getTextField("Navn finner").setText(finder.name);
        form.getTextField("Adresse finner").setText(finderStreet);
        form.getTextField("Postnummer finner").setText(finderPostnummer);
        form.getTextField("Sted finner").setText(finderSted);
        form.getTextField("Telefonnummer finner").setText(finder.phone);
        form.getTextField("E-post finner").setText(finder.email);

        // Fill owner fields
        form.getTextField("Grunneier").setText(owner.name);
        form.getTextField("Telefonnummer grunneier").setText(owner.phone);
        form.getTextField("E-post grunneier").setText(owner.email);

        if (owner.name && owner.name.trim() !== "") {
          safeCheckBox(form, "Grunneier har gitt tillatelse _y87rRhfj6A5hS8oITp7knw");
        }

        form.getTextField("Gjenstand").setText(objName);

        if (depth) {
          try {
            form.getTextField("Dybde").setText(depth + " cm");
          } catch (e) {
            console.warn("Could not set Dybde:", e);
          }
        }

        // GPS
        if (parsed) {
          form.getTextField("GPS-nord").setText(parsed.lat.toFixed(6));
          form.getTextField("GPS-øst").setText(parsed.lon.toFixed(6));
        }
        form.getTextField("Datum/projeksjon").setText("WGS84 (EPSG:4326)");

        // Fetch kommune info (returns Promise)
        var kommunePromise = parsed ? fetchKommuneInfo(parsed.lat, parsed.lon) : Promise.resolve(null);
        
        return kommunePromise.then(function(kommuneInfo) {
          dbg("[export] kommuneInfo: " + (kommuneInfo ? JSON.stringify(kommuneInfo) : "null"));
          
          // Reset only the checkboxes we control
          resetKnownCheckboxes(form);
          
          if (kommuneInfo && kommuneInfo.fylkesnavn) {
            try {
              form.getTextField("Fylke").setText(kommuneInfo.fylkesnavn);
              dbg("[export] Set Fylke: " + kommuneInfo.fylkesnavn);
            } catch (e) {
              dbg("[export] Could not set Fylke: " + e.message);
            }
          }

          // Address data from Geonorge API
          var addressData = (global.AppMap && global.AppMap.getLastAddressData) 
            ? global.AppMap.getLastAddressData() 
            : null;
          
          dbg("[export] addressData: " + (addressData ? JSON.stringify(addressData).substring(0, 100) : "null"));
          dbg("[export] owner.address: " + owner.address);
          dbg("[export] owner.kommune: " + owner.kommune);

          // Parse owner address
          var ownerStreet = "";
          var ownerPostnummer = "";
          var ownerSted = "";

          if (addressData) {
            ownerStreet = addressData.adressetekst || "";
            ownerPostnummer = addressData.postnummer || "";
            ownerSted = addressData.poststed || "";
          } else if (owner.address) {
            var ocommaIdx = owner.address.lastIndexOf(",");
            if (ocommaIdx > -1) {
              ownerStreet = owner.address.substring(0, ocommaIdx).trim();
              var opostcodePlace = owner.address.substring(ocommaIdx + 1).trim();
              var ospaceIdx = opostcodePlace.indexOf(" ");
              if (ospaceIdx > -1) {
                ownerPostnummer = opostcodePlace.substring(0, ospaceIdx).trim();
                ownerSted = opostcodePlace.substring(ospaceIdx + 1).trim();
              } else {
                if (/^\d+$/.test(opostcodePlace)) {
                  ownerPostnummer = opostcodePlace;
                } else {
                  ownerSted = opostcodePlace;
                }
              }
            } else {
              ownerStreet = owner.address;
            }
          }

          dbg("[export] Owner parsed: street='" + ownerStreet + "' post='" + ownerPostnummer + "' sted='" + ownerSted + "'");
          
          form.getTextField("Adresse grunneier").setText(ownerStreet);
          form.getTextField("Postnummer grunneier").setText(ownerPostnummer);
          form.getTextField("Sted grunneier").setText(ownerSted);

          // Kommune: prefer form field, then Kartverket API, then Geonorge API
          var kommune = owner.kommune || 
            (kommuneInfo && kommuneInfo.kommunenavn ? kommuneInfo.kommunenavn : "") ||
            (addressData && addressData.kommunenavn ? addressData.kommunenavn : "");
          var gnr = owner.gnr || (addressData && addressData.gardsnummer ? String(addressData.gardsnummer) : "");
          var bnr = owner.bnr || (addressData && addressData.bruksnummer ? String(addressData.bruksnummer) : "");
          
          dbg("[export] Kommune: '" + kommune + "', gnr: '" + gnr + "', bnr: '" + bnr + "'");

          if (kommune) {
            try {
              form.getTextField("Kommune").setText(kommune);
              dbg("[export] Set Kommune field");
            } catch (e) {
              dbg("[export] Could not set Kommune: " + e.message);
            }
          }

          if (gnr || bnr) {
            var gbnrText = (gnr && bnr) ? (gnr + "/" + bnr) : (gnr || bnr);
            try {
              form.getTextField("Funnsted").setText(gbnrText);
            } catch (e) {
              console.warn("Could not set Funnsted field:", e);
            }
          }

          try {
            form.getTextField("Funndato").setText(new Date().toISOString().slice(0, 10));
          } catch (_) {}

          var extra = [];
          if (material) extra.push((L.material || "Material") + ": " + material);
          if (age) extra.push((L.age || "Age") + ": " + age);
          if (notes) extra.push(notes);
          form.getTextField("Andre opplysninger").setText(extra.join("\n"));

          safeCheckBox(form, "Check Box12");

          if (arealtype) {
            var akey = arealtype.trim().toLowerCase();
            var afieldName = AREALTYPE_TO_CHECKBOX[akey] || AREALTYPE_TO_CHECKBOX[akey.replace("å", "a")];
            if (afieldName) {
              safeCheckBox(form, afieldName);
            }
          }

          return { pdfDoc: pdfDoc, rgb: rgb, form: form, photos: photoDataURLs, L: L };
        });
      })
      .then(function(ctx) {
        dbg("[export] Form fields filled, adding summary page");
        var pdfDoc = ctx.pdfDoc;
        var rgb = ctx.rgb;
        var photoDataURLs = ctx.photos;
        var L = ctx.L;

        // Add summary page
        var summaryPage = pdfDoc.addPage([595.28, 841.89]);
        var pageSize = summaryPage.getSize();
        var width = pageSize.width;
        var height = pageSize.height;
        var y = height - 50;
        var left = 40;
        var lineHeight = 16;

        function drawLine(label, value) {
          summaryPage.drawText(label + ": " + (value || ""), { x: left, y: y, size: 11 });
          y -= lineHeight;
        }

        summaryPage.drawText(L.title || "Find – summary", {
          x: left, y: y, size: 14, color: rgb(0.2, 0.2, 0.2)
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

        // Embed photos sequentially
        var photoChain = Promise.resolve();
        
        // First photo on summary page
        if (photoDataURLs.length > 0) {
          photoChain = embedImage(pdfDoc, photoDataURLs[0]).then(function(img) {
            var targetWidth = width - 80;
            var factor = targetWidth / img.width;
            var targetHeight = img.height * factor;
            var imgY = 80;
            summaryPage.drawImage(img, {
              x: left, y: imgY, width: targetWidth, height: targetHeight
            });
            summaryPage.drawText((L.photo || "Photo") + " 1", {
              x: left, y: imgY - 12, size: 9, color: rgb(0.2, 0.2, 0.2)
            });
          });
        }

        // Additional photos on separate pages
        for (var photoIdx = 1; photoIdx < photoDataURLs.length; photoIdx++) {
          (function(idx) {
            photoChain = photoChain.then(function() {
              return embedImage(pdfDoc, photoDataURLs[idx]).then(function(pimg) {
                var page = pdfDoc.addPage([595.28, 841.89]);
                var psize = page.getSize();
                var pw = psize.width;
                var ph = psize.height;
                var ptargetWidth = pw - 80;
                var pfactor = ptargetWidth / pimg.width;
                var ptargetHeight = pimg.height * pfactor;
                var pimgY = (ph - ptargetHeight) / 2;
                page.drawImage(pimg, {
                  x: 40, y: pimgY, width: ptargetWidth, height: ptargetHeight
                });
                page.drawText((L.photo || "Photo") + " " + (idx + 1), {
                  x: 40, y: pimgY - 14, size: 10, color: rgb(0.2, 0.2, 0.2)
                });
              });
            });
          })(photoIdx);
        }

        return photoChain.then(function() {
          return { pdfDoc: pdfDoc, form: ctx.form };
        });
      })
      .then(function(ctx) {
        dbg("[export] Updating form appearances");
        ctx.form.updateFieldAppearances();
        return ctx.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        dbg("[export] PDF saved, initiating download");
        var blob = new Blob([pdfBytes], { type: "application/pdf" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "funnskjema-utfylt.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);

        // Email hook
        if (emailFinder || emailOwner) {
          var pdfBase64 = bytesToBase64(new Uint8Array(pdfBytes));
          var payload = {
            lang: lang,
            finder: finder,
            owner: owner,
            object: { name: objName, type: objType, material: material, age: age },
            arealtype: arealtype,
            depth: depth,
            location: locationStr,
            notes: notes,
            wants: { finder: emailFinder, owner: emailOwner },
            pdfBase64: pdfBase64,
            filename: "funnskjema-utfylt.pdf"
          };
          console.log("Email requested – send this payload to your server:", payload);
        }
        
        dbg("[export] PDF generation complete");
      })
      .catch(function(err) {
        console.error("Could not create filled PDF:", err);
        alert("Could not create the filled PDF. See console for details.\n" + (err && err.message ? err.message : ""));
      });
  }

  // expose
  global.saveAsPDF = saveAsPDF;
  global.AppExport = {
    saveAsPDF: saveAsPDF
  };
  
  if (typeof window.dbg === "function") window.dbg("export.js IIFE completed OK");
  } catch(e) {
    if (typeof window.dbg === "function") {
      window.dbg("export.js ERROR: " + e.message);
    }
  }
})(window);

