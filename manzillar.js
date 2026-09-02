/* Manzillar — the two Aurum Tabac shops on a Yandex map.
 *
 * Exposes window.__aurumManzillar, which main.js's page map drives through
 * create()/destroy() so the module also works on SPA navigation, not just a
 * cold load. Same pattern as the existing window.__aurumInitScrub.
 *
 * The map is enhancement. The address list is plain HTML and carries the page
 * on its own, so a missing key or a blocked API degrades to a working page
 * rather than a broken one.
 */
(function () {
  "use strict";

  /* Yandex JS API v3 requires a key on the script URL. It ships in page source
   * and is therefore public — restrict it to the aurum-tabac.uz referrer in the
   * Yandex console, or it will be scraped and spent against the quota.
   * Empty string = map skipped, list still renders. */
  var YANDEX_API_KEY = "b2a82b82-f5ce-4b75-a1e9-839c842cf22f";

  /* Yandex takes coordinates as [longitude, latitude] — the reverse of Google's
   * [lat, lng]. These two shops differ about 10x more in latitude than in
   * longitude, so a transposition would place both pins plausibly but wrongly.
   * Coordinates are therefore held in named fields and converted at the single
   * point of use (toYandex), never passed around as bare pairs. */
  var STORES = [
    {
      street: "Sh. Rashidov koʻchasi",
      locality: "Yangiyer, Sirdaryo viloyati",
      phone: "+998 90 255 27 76",
      hours: "Har kuni 7:00 dan 23:00 gacha",
      lat: 40.270080,
      lng: 68.816300
    },
    {
      street: "Gulshan koʻchasi",
      locality: "Yangiyer, Sirdaryo viloyati",
      phone: "+998 90 255 27 76",
      hours: "Har kuni 7:00 dan 23:00 gacha",
      lat: 40.272420,
      lng: 68.816341
    }
  ];

  /* Midpoint of the two shops. They sit ~260 m apart, so a fixed centre and
   * zoom frames both without needing bounds arithmetic (whose corner order is
   * its own footgun). */
  var CENTRE = { lat: 40.271250, lng: 68.816320 };
  var ZOOM = 16;

  var SCRIPT_ID = "yandex-maps-v3";
  var map = null;
  var openPin = null;

  function toYandex(store) {
    return [store.lng, store.lat];
  }

  /* rtext uses lat,lng — the opposite order to the ll= param on the same
   * domain. The two really do disagree. */
  function directionsUrl(store) {
    return "https://yandex.uz/maps/?rtext=~" + store.lat + "," + store.lng + "&rtt=auto";
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* Reuses the info-window classes already styled in the page CSS, so this
   * inherits the site's typography and black ground without new rules. */
  function buildInfowindow(store) {
    var box = el("div", "retailers__map__infowindow");

    box.appendChild(el("div", "retailers__map__infowindow__close"));
    box.appendChild(el("h2", "retailers__map__infowindow__name", store.street));
    box.appendChild(el("div", "retailers__map__infowindow__address", store.locality));

    var bottom = el("div", "retailers__map__infowindow__bottom");

    var phoneWrap = el("div", "retailers__map__infowindow__phone");
    var phone = el("a", "retailers__map__infowindow__phone__text", store.phone);
    phone.href = "tel:" + store.phone.replace(/\s/g, "");
    phoneWrap.appendChild(phone);
    bottom.appendChild(phoneWrap);

    var dirWrap = el("div", "retailers__map__infowindow__directions");
    var dir = el("a", "retailers__map__infowindow__directions__text", "Yoʻl koʻrsatish");
    dir.href = directionsUrl(store);
    dir.target = "_blank";
    dir.rel = "noopener";
    dirWrap.appendChild(dir);
    bottom.appendChild(dirWrap);

    box.appendChild(bottom);
    box.appendChild(el("div", "retailers__map__infowindow__arrow"));
    return box;
  }

  function closeOpen() {
    if (openPin) {
      openPin.classList.remove("mnz__pin--open");
      openPin = null;
    }
  }

  function buildPin(store) {
    var pin = el("div", "mnz__pin");
    pin.appendChild(el("span", "mnz__pin__dot"));

    var info = buildInfowindow(store);
    pin.appendChild(info);

    pin.addEventListener("click", function (event) {
      var closing = event.target.closest(".retailers__map__infowindow__close");
      var link = event.target.closest("a");
      if (link) return;               // let phone / directions through
      event.stopPropagation();
      var wasOpen = pin.classList.contains("mnz__pin--open");
      closeOpen();
      if (!wasOpen && !closing) {
        pin.classList.add("mnz__pin--open");
        openPin = pin;
      }
    });

    return pin;
  }

  function hideMapPanel() {
    var panel = document.querySelector(".retailers__map");
    if (panel) panel.style.display = "none";
  }

  /* The page starts at opacity 0 in CSS and is revealed by the page class that
   * main.js instantiates. This page has no such class, so the reveal happens
   * here — otherwise the page renders blank. */
  function reveal() {
    var heading = document.querySelector(".retailers__top h1");
    var inner = document.querySelector(".retailers__map__inner");
    var g = window.gsap;

    if (!g) {
      if (heading) {
        heading.style.opacity = "1";
        heading.style.transform = "none";
      }
      if (inner) inner.style.opacity = "1";
      return;
    }

    if (heading) {
      g.to(heading, { opacity: 1, y: 0, duration: 0.5, ease: "power2.inOut" });
    }
    if (inner) {
      g.to(inner, { opacity: 1, duration: 1, delay: 0.3 });
    }
  }

  function bindListToPins(pins) {
    var rows = document.querySelectorAll(".retailers__retailers .r__r");
    Array.prototype.forEach.call(rows, function (row) {
      row.addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        var pin = pins[Number(row.getAttribute("data-store"))];
        if (!pin) return;
        closeOpen();
        pin.classList.add("mnz__pin--open");
        openPin = pin;
      });
    });
  }

  function buildMap(container) {
    return window.ymaps3.ready.then(function () {
      var y = window.ymaps3;
      map = new y.YMap(container, {
        location: { center: toYandex(CENTRE), zoom: ZOOM }
      });
      map.addChild(new y.YMapDefaultSchemeLayer({ theme: "dark" }));
      map.addChild(new y.YMapDefaultFeaturesLayer());

      var pins = STORES.map(function (store) {
        var pin = buildPin(store);
        map.addChild(new y.YMapMarker({ coordinates: toYandex(store) }, pin));
        return pin;
      });

      bindListToPins(pins);
    });
  }

  /* Module-scoped so repeat SPA visits reuse the one load instead of appending
   * another script tag. */
  var scriptPromise = null;

  function loadScript() {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://api-maps.yandex.ru/v3/?apikey=" +
        encodeURIComponent(YANDEX_API_KEY) + "&lang=uz_UZ";
      s.onload = function () { resolve(); };
      s.onerror = function () {
        scriptPromise = null;
        reject(new Error("yandex maps failed to load"));
      };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  window.__aurumManzillar = {
    create: function () {
      var container = document.querySelector(".retailers__map__inner__wrapper");
      reveal();

      if (!container) return;

      if (!YANDEX_API_KEY) {
        // No key yet: the list is the page, so collapse the empty black panel
        // rather than reveal a void.
        hideMapPanel();
        return;
      }

      loadScript()
        .then(function () { return buildMap(container); })
        .catch(function (err) {
          if (window.console) console.warn("[manzillar]", err.message);
          hideMapPanel();
        });
    },

    destroy: function () {
      closeOpen();
      if (map && typeof map.destroy === "function") map.destroy();
      map = null;
    },

    show: function () {}
  };
})();
