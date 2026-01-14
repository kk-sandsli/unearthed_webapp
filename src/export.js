// export.js
// fill official form + summary pages + multiple photos (half page each)
// summary is localized based on localStorage("unearthed-lang")

(function (global) {
  const PDF_TEMPLATE_URL = "/unearthed/Funnskjema-unlocked.pdf";
  const PDF_LIB_URL = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  const LANG_STORAGE_KEY = "unearthed-lang";
  const FINDER_STORAGE_KEY = "unearthed-finder";

  // Save finder info to localStorage
  function saveFinderInfo(finder) {
    try {
      localStorage.setItem(FINDER_STORAGE_KEY, JSON.stringify(finder));
    } catch (e) {
      console.warn("Could not save finder info:", e);
    }
  }

  // Load finder info from localStorage
  function loadFinderInfo() {
    try {
      const stored = localStorage.getItem(FINDER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn("Could not load finder info:", e);
      return null;
    }
  }

  // Pre-fill finder fields on page load
  function prefillFinderFields() {
    const finder = loadFinderInfo();
    if (!finder) return;

    const fields = {
      finderName: finder.name,
      finderAddress: finder.address,
      finderPhone: finder.phone,
      finderEmail: finder.email,
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el && value) {
        el.value = value;
      }
    }
  }

  // exact arealtype -> checkbox names from your unlocked PDF  (we keep this) :contentReference[oaicite:0]{index=0}
  const AREALTYPE_TO_CHECKBOX = {
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
  const SUMMARY_TEXT = {
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
    const m = /Lat:\s*([-0-9.]+)\s*,\s*Lon:\s*([-0-9.]+)/i.exec(str);
    if (!m) return null;
    return { lat: Number(m[1]), lon: Number(m[2]) };
  }

  /**
   * Fetch kommune and fylke info from Kartverket API based on coordinates.
   * Returns { fylkesnavn, fylkesnummer, kommunenavn, kommunenummer } or null.
   */
  async function fetchKommuneInfo(lat, lon) {
    try {
      const params = new URLSearchParams({
        nord: lat.toString(),
        ost: lon.toString(),
        koordsys: "4258", // ETRS89, compatible with WGS84
      });
      const response = await fetch(
        `https://api.kartverket.no/kommuneinfo/v1/punkt?${params}`,
        { headers: { accept: "application/json" } }
      );
      if (!response.ok) {
        console.warn("Kartverket API request failed:", response.status);
        return null;
      }
      return await response.json();
    } catch (err) {
      console.warn("Kartverket API lookup failed:", err);
      return null;
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function dataURLToUint8Array(dataURL) {
    const base64 = dataURL.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // safe Uint8Array -> base64 (no spread → no RangeError)
  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function ensurePdfLib() {
    if (global.PDFLib) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PDF_LIB_URL;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Helper function to safely check a checkbox with proper appearance
  function safeCheckBox(form, fieldName) {
    try {
      const checkbox = form.getCheckBox(fieldName);
      // Uncheck first to reset state, then check
      checkbox.uncheck();
      checkbox.check();
    } catch (e) {
      console.warn(`Could not check checkbox "${fieldName}":`, e);
    }
  }

  async function saveAsPDF() {
    try {
      await ensurePdfLib();
      const { PDFDocument, rgb } = global.PDFLib;

      // current UI language
      const lang =
        localStorage.getItem(LANG_STORAGE_KEY) && SUMMARY_TEXT[localStorage.getItem(LANG_STORAGE_KEY)]
          ? localStorage.getItem(LANG_STORAGE_KEY)
          : "no";
      const L = SUMMARY_TEXT[lang] || SUMMARY_TEXT.no;

      // 1. read DOM values
      const finder = {
        name: $("finderName")?.value || "",
        address: $("finderAddress")?.value || "",
        phone: $("finderPhone")?.value || "",
        email: $("finderEmail")?.value || "",
      };

      // Save finder info for next visit
      saveFinderInfo(finder);

      const owner = {
        name: $("ownerName")?.value || "",
        address: $("ownerAddress")?.value || "",
        phone: $("ownerPhone")?.value || "",
        email: $("ownerEmail")?.value || "",
        kommune: $("ownerKommune")?.value || "",
        gnr: $("ownerGnr")?.value || "",
        bnr: $("ownerBnr")?.value || "",
      };
      const objName = $("objectName")?.value || "";
      const objType = $("objectType")?.value || "";
      const material = $("material")?.value || "";
      const age = $("age")?.value || "";
      const arealtype = $("arealtype")?.value || "";
      const depth = $("findDepth")?.value || "";
      const locationStr = $("location")?.value || "";
      const notes = $("notes")?.value || "";
      const emailFinder = $("emailFinder")?.checked || false;
      const emailOwner = $("emailOwner")?.checked || false;

      // 2. read ALL photos (now multiple)
      const photoInput = $("photo");
      const photoFiles = photoInput?.files ? Array.from(photoInput.files) : [];
      const photoDataURLs = await Promise.all(
        photoFiles.map((file) => readFileAsDataURL(file))
      );

      // 3. load PDF template
      const resp = await fetch(PDF_TEMPLATE_URL);
      if (!resp.ok) {
        throw new Error("Could not fetch " + PDF_TEMPLATE_URL);
      }
      const existingPdfBytes = await resp.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes, {
        ignoreEncryption: true,
      });

      const form = pdfDoc.getForm();

      // 4. fill main form (real names)
      // Parse finder address into components: "Street 123, 5073 PLACE"
      let finderStreet = "";
      let finderPostnummer = "";
      let finderSted = "";

      if (finder.address) {
        const commaIdx = finder.address.lastIndexOf(",");
        if (commaIdx > -1) {
          finderStreet = finder.address.substring(0, commaIdx).trim();
          const postcodePlace = finder.address.substring(commaIdx + 1).trim();
          // Split "5073 BERGEN" into postcode and place
          const spaceIdx = postcodePlace.indexOf(" ");
          if (spaceIdx > -1) {
            finderPostnummer = postcodePlace.substring(0, spaceIdx).trim();
            finderSted = postcodePlace.substring(spaceIdx + 1).trim();
          } else {
            // Might be just postcode or just place
            if (/^\d+$/.test(postcodePlace)) {
              finderPostnummer = postcodePlace;
            } else {
              finderSted = postcodePlace;
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
      const parsed = parseLatLon(locationStr);
      if (parsed) {
        form.getTextField("GPS-nord").setText(parsed.lat.toFixed(6));
        form.getTextField("GPS-øst").setText(parsed.lon.toFixed(6));
      }
      form.getTextField("Datum/projeksjon").setText("WGS84 (EPSG:4326)");

      // Fetch kommune/fylke info from Kartverket API (best-effort)
      let kommuneInfo = null;
      if (parsed) {
        kommuneInfo = await fetchKommuneInfo(parsed.lat, parsed.lon);
        if (kommuneInfo) {
          console.log("Kartverket kommune info:", kommuneInfo);
        }
      }

      // Fill Fylke field
      if (kommuneInfo?.fylkesnavn) {
        try {
          form.getTextField("Fylke").setText(kommuneInfo.fylkesnavn);
        } catch (e) {
          console.warn("Could not set Fylke field:", e);
        }
      }

      // Address data from Geonorge API (best-effort, may be null)
      const addressData = global.AppMap?.getLastAddressData?.() || null;

      // Parse owner address into components for PDF fields
      // If we have API data, use it directly; otherwise try to parse the combined address
      let ownerStreet = "";
      let ownerPostnummer = "";
      let ownerSted = "";

      if (addressData) {
        // Use raw API data (most reliable)
        ownerStreet = addressData.adressetekst || "";
        ownerPostnummer = addressData.postnummer || "";
        ownerSted = addressData.poststed || "";
      } else if (owner.address) {
        // Try to parse combined address: "Street 123, 5073 PLACE"
        const commaIdx = owner.address.lastIndexOf(",");
        if (commaIdx > -1) {
          ownerStreet = owner.address.substring(0, commaIdx).trim();
          const postcodePlace = owner.address.substring(commaIdx + 1).trim();
          // Split "5073 BERGEN" into postcode and place
          const spaceIdx = postcodePlace.indexOf(" ");
          if (spaceIdx > -1) {
            ownerPostnummer = postcodePlace.substring(0, spaceIdx).trim();
            ownerSted = postcodePlace.substring(spaceIdx + 1).trim();
          } else {
            // Might be just postcode or just place
            if (/^\d+$/.test(postcodePlace)) {
              ownerPostnummer = postcodePlace;
            } else {
              ownerSted = postcodePlace;
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
      const kommune = owner.kommune || (addressData?.kommunenavn || "");
      const gnr = owner.gnr || (addressData?.gardsnummer ? String(addressData.gardsnummer) : "");
      const bnr = owner.bnr || (addressData?.bruksnummer ? String(addressData.bruksnummer) : "");

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
        const gbnrText = gnr && bnr ? `${gnr}/${bnr}` : (gnr || bnr);
        try {
          form.getTextField("Funnsted").setText(gbnrText);
          console.log(`Successfully set field "Funnsted" to "${gbnrText}"`);
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
      const extra = [];
      if (material) extra.push((L.material || "Material") + ": " + material);
      if (age) extra.push((L.age || "Age") + ": " + age);
      if (notes) extra.push(notes);
      form.getTextField("Andre opplysninger").setText(extra.join("\n"));

      // Målemetode -> Mobiltelefon
      safeCheckBox(form, "Check Box12");

      // Arealtype
      if (arealtype) {
        const key = arealtype.trim().toLowerCase();
        const fieldName =
          AREALTYPE_TO_CHECKBOX[key] ||
          AREALTYPE_TO_CHECKBOX[key.replace("å", "a")];
        if (fieldName) {
          safeCheckBox(form, fieldName);
        }
      }

      // 5. first summary page (with big photo)
      const summaryPage = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      const { width, height } = summaryPage.getSize();
      let y = height - 50;
      const left = 40;
      const line = 16;

      function drawLine(label, value) {
        summaryPage.drawText(label + ": " + (value || ""), {
          x: left,
          y,
          size: 11,
        });
        y -= line;
      }

      // title
      summaryPage.drawText(L.title || "Find – summary", {
        x: left,
        y,
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
        summaryPage.drawText(L.notes + ":", { x: left, y, size: 11 });
        y -= line;
        const words = notes.split(/\s+/);
        let lineText = "";
        const maxChars = 85;
        words.forEach((w) => {
          const test = lineText + w + " ";
          if (test.length > maxChars) {
            summaryPage.drawText(lineText, { x: left, y, size: 10 });
            y -= 14;
            lineText = w + " ";
          } else {
            lineText = test;
          }
        });
        if (lineText) {
          summaryPage.drawText(lineText, { x: left, y, size: 10 });
          y -= 14;
        }
      }

      // BIG photo on FIRST summary page (about half page)
      if (photoDataURLs.length > 0) {
        const firstPhoto = photoDataURLs[0];
        const imgBytes = dataURLToUint8Array(firstPhoto);
        let img;
        if (firstPhoto.startsWith("data:image/png")) {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }
        // target width ~ half page (a bit less than full width)
        const targetWidth = width - 80; // 40 margins left/right
        const factor = targetWidth / img.width;
        const targetHeight = img.height * factor;
        const imgX = left;
        // put image lower, so text stays top
        const imgY = 80; // leave bottom margin
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
        for (let i = 1; i < photoDataURLs.length; i++) {
          const pData = photoDataURLs[i];
          const imgBytes = dataURLToUint8Array(pData);
          const page = pdfDoc.addPage([595.28, 841.89]);
          const { width: pw, height: ph } = page.getSize();

          let img;
          if (pData.startsWith("data:image/png")) {
            img = await pdfDoc.embedPng(imgBytes);
          } else {
            img = await pdfDoc.embedJpg(imgBytes);
          }

          // half page (big)
          const targetWidth = pw - 80; // 40 margins
          const factor = targetWidth / img.width;
          const targetHeight = img.height * factor;
          const imgX = 40;
          const imgY = (ph - targetHeight) / 2; // center vertically a bit

          page.drawImage(img, {
            x: imgX,
            y: imgY,
            width: targetWidth,
            height: targetHeight,
          });

          page.drawText(`${L.photo || "Photo"} ${i + 1}`, {
            x: imgX,
            y: imgY - 14,
            size: 10,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      }

      // update form appearances
      form.updateFieldAppearances();

      // 6. save & download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "funnskjema-utfylt.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      // 7. email hook (needs server)
      if (emailFinder || emailOwner) {
        const pdfBase64 = bytesToBase64(new Uint8Array(pdfBytes));
        const payload = {
          lang,
          finder,
          owner,
          object: {
            name: objName,
            type: objType,
            material,
            age,
          },
          arealtype,
          depth,
          location: locationStr,
          notes,
          wants: {
            finder: emailFinder,
            owner: emailOwner,
          },
          pdfBase64,
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
  document.addEventListener("DOMContentLoaded", prefillFinderFields);

  // expose
  global.saveAsPDF = saveAsPDF;
  global.AppExport = {
    saveAsPDF,
  };
})(window);

