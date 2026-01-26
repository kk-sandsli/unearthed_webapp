// i18n.js
(function (global) {
  try {
  if (typeof window.dbg === "function") window.dbg("i18n.js IIFE running");
  
  var STORAGE_KEY = "unearthed-lang";

  var MESSAGES = {
    en: {
      appName: "Unearthed",
      appTagline: "Find reporting for detectorists - A prototype webapp by Kodeklubben Sandsli",
      pageHeading: "Report a find",
      pageSub: "Fill in the details below. Your GPS will be used, and the official PDF will be filled automatically.",

      finderTitle: "Finder",
      ownerTitle: "Land owner",

      labelName: "Name",
      labelAddress: "Address",
      labelPhone: "Telephone",
      labelEmail: "Email",

      phName: "Your full name",
      phAddress: "Street, no., postcode, place",
      phPhone: "+47 ...",
      phEmail: "you@example.com",
      phOwnerName: "Name of land owner",

      labelObjectName: "Object name",
      phObjectName: "e.g. Bronze brooch",
      labelObjectType: "Type of object",

      optTool: "Tool",
      optWeapon: "Weapon",
      optJewelry: "Jewelry",
      optPottery: "Pottery",
      optOther: "Other",

      labelMaterial: "Assumed material",
      phMaterial: "e.g. bronze, copper, iron",
      labelAge: "Estimated age",
      phAge: "e.g. Viking age, 17th c.",

      labelAreaType: "Area type",
      optArealAker: "Field",
      optArealBeite: "Pasture",
      optArealHage: "Garden",
      optArealSkog: "Forest",
      optArealFjell: "Mountain",
      optArealStrand: "Beach",
      optArealVann: "Water",

      labelDepth: "Find depth (cm)",
      phDepth: "e.g. 25",

      labelLocation: "Location",
      phLocation: "Will be filled from GPS",

      labelPhoto: "Upload photo",
      labelNotes: "Notes",
      phNotes: "Context, associated finds, depth, etc.",

      btnUseLocation: "Use current location",
      btnDownload: "Download official form (filled)",
      btnReset: "Reset",

      pdfEditHint: "Note: The PDF may not be editable on phones, but will be on a computer.",
      locationSaved: "Location saved ✔",
      labelkommune: "Municipality",
      phkommune: "Auto-filled from GPS",
      labelgnr: "Farm no. (Gnr)",
      phgnr: "Auto-filled from GPS",
      labelbnr: "Holding no. (Bnr)",
      phbnr: "Auto-filled from GPS"
    },
    no: {
      appName: "Unearthed",
      appTagline: "Registrering av funn for metallsøkere - En prototype webapp fra Kodeklubben Sandsli",
      pageHeading: "Registrer funn",
      pageSub: "Fyll ut feltene nedenfor. GPS-posisjonen din brukes, og det offisielle skjemaet fylles ut automatisk.",

      finderTitle: "Finner",
      ownerTitle: "Grunneier",

      labelName: "Navn",
      labelAddress: "Adresse",
      labelPhone: "Telefon",
      labelEmail: "E-post",

      phName: "Ditt fulle navn",
      phAddress: "Gate, nr., postnr., sted",
      phPhone: "+47 ...",
      phEmail: "deg@example.com",
      phOwnerName: "Navn på grunneier",

      labelObjectName: "Gjenstand",
      phObjectName: "f.eks. bronseknapp",
      labelObjectType: "Type gjenstand",

      optTool: "Redskap",
      optWeapon: "Våpen",
      optJewelry: "Smykke",
      optPottery: "Keramikk",
      optOther: "Annet",

      labelMaterial: "Antatt materiale",
      phMaterial: "f.eks. bronse, kobber, jern",
      labelAge: "Antatt alder",
      phAge: "f.eks. vikingtid, 1600-tall",

      labelAreaType: "Arealtype",
      optArealAker: "Åker",
      optArealBeite: "Beite",
      optArealHage: "Hage",
      optArealSkog: "Skog",
      optArealFjell: "Fjell",
      optArealStrand: "Strand",
      optArealVann: "Vann",

      labelDepth: "Funndybde (cm)",
      phDepth: "f.eks. 25",

      labelLocation: "Posisjon (GPS)",
      phLocation: "Hentes fra GPS",

      labelPhoto: "Last opp bilde",
      labelNotes: "Notater",
      phNotes: "Kontekst, tilknyttede funn, dybde osv.",

      btnUseLocation: "Bruk nåværende posisjon",
      btnDownload: "Last ned utfylt skjema",
      btnReset: "Nullstill",

      pdfEditHint: "Merk: PDF-en kan ikke redigeres på telefon, men fungerer på datamaskin.",
      locationSaved: "Posisjon lagret ✔",
      labelkommune: "Kommune",
      phkommune: "Hentes fra GPS",
      labelgnr: "Gårdsnummer (Gnr)",
      phgnr: "Hentes fra GPS",
      labelbnr: "Bruksnummer (Bnr)",
      phbnr: "Hentes fra GPS"
    },
    es: {
      appName: "Unearthed",
      appTagline: "Registro de hallazgos para detectoristas - Un prototipo de aplicación web de Kodeklubben Sandsli",
      pageHeading: "Registrar hallazgo",
      pageSub: "Rellena los datos. Se usará tu GPS y se completará el PDF oficial automáticamente.",

      finderTitle: "Descubridor",
      ownerTitle: "Propietario del terreno",

      labelName: "Nombre",
      labelAddress: "Dirección",
      labelPhone: "Teléfono",
      labelEmail: "Correo",

      phName: "Tu nombre completo",
      phAddress: "Calle, nº, código postal, ciudad",
      phPhone: "+34 ...",
      phEmail: "tú@example.com",
      phOwnerName: "Nombre del propietario",

      labelObjectName: "Nombre del objeto",
      phObjectName: "p. ej. broche de bronce",
      labelObjectType: "Tipo de objeto",

      optTool: "Herramienta",
      optWeapon: "Arma",
      optJewelry: "Joyería",
      optPottery: "Cerámica",
      optOther: "Otro",

      labelMaterial: "Material supuesto",
      phMaterial: "p. ej. bronce, cobre, hierro",
      labelAge: "Edad estimada",
      phAge: "p. ej. época vikinga, s. XVII",

      labelAreaType: "Tipo de zona",
      optArealAker: "Campo",
      optArealBeite: "Pastoreo",
      optArealHage: "Jardín",
      optArealSkog: "Bosque",
      optArealFjell: "Montaña",
      optArealStrand: "Playa",
      optArealVann: "Agua",

      labelDepth: "Profundidad (cm)",
      phDepth: "p. ej. 25",

      labelLocation: "Ubicación (GPS)",
      phLocation: "Se rellenará con el GPS",

      labelPhoto: "Subir foto",
      labelNotes: "Notas",
      phNotes: "Contexto, hallazgos asociados, profundidad, etc.",

      btnUseLocation: "Usar ubicación actual",
      btnDownload: "Descargar formulario oficial (relleno)",
      btnReset: "Restablecer",

      pdfEditHint: "Nota: El PDF puede no ser editable en teléfonos, pero funcionará en un ordenador.",
      locationSaved: "Ubicación guardada ✔",
      labelkommune: "Municipio",
      phkommune: "Se rellena desde GPS",
      labelgnr: "Nº de finca (Gnr)",
      phgnr: "Se rellena desde GPS",
      labelbnr: "Nº de parcela (Bnr)",
      phbnr: "Se rellena desde GPS"
    }
  };

  function applyTranslations(lang) {
    var dict = MESSAGES[lang] || MESSAGES.en;

    // elements that just need text
    var i18nEls = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < i18nEls.length; i++) {
      var el = i18nEls[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      var text = dict[key];
      if (typeof text === "string") {
        el.textContent = text;
      }
    }

    // placeholders
    var phEls = document.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < phEls.length; j++) {
      var phEl = phEls[j];
      var phKey = phEl.getAttribute("data-i18n-placeholder");
      if (!phKey) continue;
      var phText = dict[phKey];
      if (typeof phText === "string") {
        phEl.placeholder = phText;
      }
    }

    // Safari iOS fallback: directly translate by ID for problematic labels
    var directTranslations = [
      { id: "labelKommuneEl", key: "labelkommune" },
      { id: "labelGnrEl", key: "labelgnr" },
      { id: "labelBnrEl", key: "labelbnr" }
    ];
    for (var k = 0; k < directTranslations.length; k++) {
      var item = directTranslations[k];
      var el = document.getElementById(item.id);
      if (el && dict[item.key]) {
        el.textContent = dict[item.key];
      }
    }

    // top-right label
    var label = document.getElementById("langLabel");
    if (label) label.textContent = (lang || "en").toUpperCase();

    // set html lang
    document.documentElement.lang = lang;
  }

  function setLanguage(lang) {
    if (!MESSAGES[lang]) lang = "en";
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
  }

  function initLanguage() {
    var dbg = window.dbg || function(){};
    dbg("[i18n] initLanguage called");
    try {
      var saved = localStorage.getItem(STORAGE_KEY) || "no";
      dbg("[i18n] lang: " + saved);
      setLanguage(saved);
      dbg("[i18n] initLanguage done");
    } catch(e) {
      dbg("[i18n] initLanguage ERROR: " + e.message);
    }
  }

  // expose
  global.setLanguage = setLanguage;

  // Expose translations for other modules
  global.AppI18n = {
    setLanguage: setLanguage,
    translations: MESSAGES
  };

  // Use multiple strategies to ensure translations apply on Safari iOS
  // 1. DOMContentLoaded for most browsers
  // 2. Additional setTimeout fallback for Safari iOS timing issues
  function safeInitLanguage() {
    initLanguage();
    // Re-apply after a short delay to catch any elements Safari iOS missed
    setTimeout(function() {
      var dbg = window.dbg || function(){};
      dbg("[i18n] Safari fallback re-apply");
      var saved = localStorage.getItem(STORAGE_KEY) || "no";
      applyTranslations(saved);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInitLanguage);
  } else {
    // DOM already loaded (script loaded async or deferred)
    safeInitLanguage();
  }
  
  if (typeof window.dbg === "function") window.dbg("i18n.js IIFE completed OK");
  } catch(e) {
    if (typeof window.dbg === "function") {
      window.dbg("i18n.js ERROR: " + e.message);
    }
  }
})(window);

