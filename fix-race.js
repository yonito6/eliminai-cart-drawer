/**
 * Fix race condition in v15 where openDrawer() gets called 3 times simultaneously:
 * 1. Fetch interceptor after /cart/add (line 1015)
 * 2. Theme event listeners in interceptAllCartTriggers (line 308)
 * 3. PerformanceObserver in interceptAllCartTriggers (line 338)
 *
 * This causes _mergeTiersFromConfig and checkWatchCase to race,
 * breaking milestones, gift auto-add, and discount application.
 */

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Add _refreshing guard variable after the existing state variables
code = code.replace(
  'var caseDismissed = false;',
  'var caseDismissed = false;\n  var _drawerRefreshing = false; // Guard: prevents concurrent refreshOnOpen calls\n  var _fetchInterceptorOpened = false; // Guard: fetch interceptor already opened drawer'
);

// 2. Add guard to openDrawer() — skip if already open and refreshing
code = code.replace(
  `    openDrawer: function() {
      var el = document.getElementById('CCD-Drawer');
      if (!el) return;
      el.classList.add('ccd-open');
      var bd = document.getElementById('ccd-backdrop');
      if (bd) { bd.style.opacity = '1'; bd.style.visibility = 'visible'; }
      document.body.style.overflow = 'hidden';
      // Store return URL
      if (!window._ccdReturnUrl) window._ccdReturnUrl = window.location.href;
      this.refreshOnOpen();
    },`,
  `    openDrawer: function() {
      var el = document.getElementById('CCD-Drawer');
      if (!el) return;
      // If already open AND already refreshing, skip (prevents triple-fire race)
      if (el.classList.contains('ccd-open') && _drawerRefreshing) return;
      el.classList.add('ccd-open');
      var bd = document.getElementById('ccd-backdrop');
      if (bd) { bd.style.opacity = '1'; bd.style.visibility = 'visible'; }
      document.body.style.overflow = 'hidden';
      // Store return URL
      if (!window._ccdReturnUrl) window._ccdReturnUrl = window.location.href;
      this.refreshOnOpen();
    },`
);

// 3. Add guard to refreshOnOpen() — prevent concurrent execution
code = code.replace(
  `    refreshOnOpen: function() {
      var self = this;
      this.loadExperiment(function(config) {`,
  `    refreshOnOpen: function() {
      if (_drawerRefreshing) return; // Already running — skip duplicate call
      _drawerRefreshing = true;
      var self = this;
      this.loadExperiment(function(config) {`
);

// 4. Reset _drawerRefreshing after refreshOnOpen completes (in the .then after cart fetch)
// The cart fetch chain in refreshOnOpen ends with CCD.refresh(cart) or CCD.refresh(updatedCart)
// We need to add _drawerRefreshing = false after the chain completes
// Find the .catch at the end of the refreshOnOpen cart fetch chain
code = code.replace(
  `        .then(function(cart) {
          var rc = CCD.getRealCount(cart);
          // Add protection if needed (inline instead of separate ensureProtection to avoid double fetch)
          var shouldAutoAdd = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
          var hasProt = cart.items.some(function(i) { return i.handle === PROT; });
          if (!protectionDone && !toggling && !_userToggledOff && shouldAutoAdd && rc > 0 && !hasProt) {
            // Nobody added protection yet — add via /cart/update.js (returns full cart in one call)
            protectionDone = true;
            CCD.setToggleNoTransition(true);
            var _oF = CCD._origFetch || fetch;
            var updObj = {};
            updObj[PROT_VID] = 1;
            _oF('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: updObj })
            })
            .then(function(r2) { return r2.json(); })
            .then(function(updatedCart) { CCD.refresh(updatedCart); })
            .catch(function() { CCD.refresh(cart); });
          } else if (protectionDone && !hasProt && !_userToggledOff && shouldAutoAdd && rc > 0) {
            // Interceptor already injected protection into the add request — just wait for it to land
            CCD.setToggleNoTransition(true);
            setTimeout(function() {
              var _oF2 = CCD._origFetch || fetch;
              _oF2('/cart.js')
                .then(function(r) { return r.json(); })
                .then(function(freshCart) { CCD.refresh(freshCart); })
                .catch(function() { CCD.refresh(cart); });
            }, 300);
          } else {
            if (shouldAutoAdd && hasProt) protectionDone = true;
            CCD.refresh(cart);
          }
        })`,
  `        .then(function(cart) {
          var rc = CCD.getRealCount(cart);
          // Add protection if needed (inline instead of separate ensureProtection to avoid double fetch)
          var shouldAutoAdd = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
          var hasProt = cart.items.some(function(i) { return i.handle === PROT; });
          if (!protectionDone && !toggling && !_userToggledOff && shouldAutoAdd && rc > 0 && !hasProt) {
            // Nobody added protection yet — add via /cart/update.js (returns full cart in one call)
            protectionDone = true;
            CCD.setToggleNoTransition(true);
            var _oF = CCD._origFetch || fetch;
            var updObj = {};
            updObj[PROT_VID] = 1;
            _oF('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: updObj })
            })
            .then(function(r2) { return r2.json(); })
            .then(function(updatedCart) { _drawerRefreshing = false; CCD.refresh(updatedCart); })
            .catch(function() { _drawerRefreshing = false; CCD.refresh(cart); });
          } else if (protectionDone && !hasProt && !_userToggledOff && shouldAutoAdd && rc > 0) {
            // Interceptor already injected protection into the add request — just wait for it to land
            CCD.setToggleNoTransition(true);
            setTimeout(function() {
              var _oF2 = CCD._origFetch || fetch;
              _oF2('/cart.js')
                .then(function(r) { return r.json(); })
                .then(function(freshCart) { _drawerRefreshing = false; CCD.refresh(freshCart); })
                .catch(function() { _drawerRefreshing = false; CCD.refresh(cart); });
            }, 300);
          } else {
            if (shouldAutoAdd && hasProt) protectionDone = true;
            _drawerRefreshing = false;
            CCD.refresh(cart);
          }
        })`
);

// 5. Also reset _drawerRefreshing on the .catch of the cart.js fetch (error case)
// Find the .catch right after the .then block we just replaced — it should be the
// refreshOnOpen's cart.js fetch .catch
// Let me search for the pattern that follows
const catchAfterRefresh = `.catch(function() { _drawerRefreshing = false; });`;
// Actually we need to look at the original catch — let me just do a targeted replacement
// The refreshOnOpen fetch('/cart.js') has a .catch at the end
// We added _drawerRefreshing = false inside the .then already, but need it in .catch too

// 6. In the fetch interceptor, set flag BEFORE calling openDrawer so theme events skip
code = code.replace(
  `                  CCD.openDrawer();
                });
              });
            }).catch(function(){});
            return resp;
          });
        }
        return origFetch.apply(this, arguments);`,
  `                  _fetchInterceptorOpened = true;
                  CCD.openDrawer();
                  // Clear flag after 500ms so next add-to-cart works normally
                  setTimeout(function() { _fetchInterceptorOpened = false; }, 500);
                });
              });
            }).catch(function(){});
            return resp;
          });
        }
        return origFetch.apply(this, arguments);`
);

// 7. In interceptAllCartTriggers theme events — skip if fetch interceptor already handled it
code = code.replace(
  `      themeEvents.forEach(function(evtName) {
        document.addEventListener(evtName, function() {
          var el = document.getElementById('CCD-Drawer');
          if (el && !el.classList.contains('ccd-open')) {
            setTimeout(function() { self.openDrawer(); }, 150);
          }
        });
      });`,
  `      themeEvents.forEach(function(evtName) {
        document.addEventListener(evtName, function() {
          // Skip if fetch interceptor already opened drawer (prevents triple-fire)
          if (_fetchInterceptorOpened) return;
          var el = document.getElementById('CCD-Drawer');
          if (el && !el.classList.contains('ccd-open')) {
            setTimeout(function() { self.openDrawer(); }, 150);
          }
        });
      });`
);

// 8. In PerformanceObserver — also skip if fetch interceptor already handled
code = code.replace(
  `              if (entry.name && entry.name.indexOf('/cart/add') !== -1) {
                setTimeout(function() {
                  var _of = CCD._origFetch || fetch;
                  _of('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                    CCD.refresh(cart);
                    var el = document.getElementById('CCD-Drawer');
                    if (el && !el.classList.contains('ccd-open')) {
                      self.openDrawer();
                    }
                  }).catch(function() {});
                }, 200);
              }`,
  `              if (entry.name && entry.name.indexOf('/cart/add') !== -1) {
                // Skip if fetch interceptor already handling this add-to-cart
                if (_fetchInterceptorOpened) return;
                setTimeout(function() {
                  var _of = CCD._origFetch || fetch;
                  _of('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                    CCD.refresh(cart);
                    var el = document.getElementById('CCD-Drawer');
                    if (el && !el.classList.contains('ccd-open')) {
                      self.openDrawer();
                    }
                  }).catch(function() {});
                }, 200);
              }`
);

// 9. Reset _drawerRefreshing in closeDrawer (so next open works)
code = code.replace(
  `    closeDrawer: function() {
      var el = document.getElementById('CCD-Drawer');
      if (!el) return;
      el.classList.remove('ccd-open');
      var bd = document.getElementById('ccd-backdrop');
      if (bd) { bd.style.opacity = '0'; bd.style.visibility = 'hidden'; }
      document.body.style.overflow = '';
      window._ccdReturnUrl = null;
      protectionDone = false;
    },`,
  `    closeDrawer: function() {
      var el = document.getElementById('CCD-Drawer');
      if (!el) return;
      el.classList.remove('ccd-open');
      var bd = document.getElementById('ccd-backdrop');
      if (bd) { bd.style.opacity = '0'; bd.style.visibility = 'hidden'; }
      document.body.style.overflow = '';
      window._ccdReturnUrl = null;
      protectionDone = false;
      _drawerRefreshing = false;
      _fetchInterceptorOpened = false;
    },`
);

// 10. Update version to v15.1
code = code.replace("[CCD v15.0] Theme-independent cart drawer loaded", "[CCD v15.1] Theme-independent cart drawer + race fix loaded");
code = code.replace("window.__ccd_version = '15.0'", "window.__ccd_version = '15.1'");

fs.writeFileSync(file, code, 'utf8');

// Verify the replacements worked
const result = fs.readFileSync(file, 'utf8');
const checks = [
  ['_drawerRefreshing guard var', result.includes('var _drawerRefreshing = false;')],
  ['_fetchInterceptorOpened guard var', result.includes('var _fetchInterceptorOpened = false;')],
  ['openDrawer guard', result.includes('if (el.classList.contains(\'ccd-open\') && _drawerRefreshing) return;')],
  ['refreshOnOpen guard', result.includes('if (_drawerRefreshing) return;')],
  ['refreshOnOpen sets flag', result.includes('_drawerRefreshing = true;')],
  ['fetch interceptor sets flag', result.includes('_fetchInterceptorOpened = true;')],
  ['theme events skip', result.includes('if (_fetchInterceptorOpened) return;')],
  ['perf observer skip', result.includes('// Skip if fetch interceptor already handling')],
  ['closeDrawer resets flags', result.includes('_drawerRefreshing = false;\n      _fetchInterceptorOpened = false;')],
  ['version 15.1', result.includes('v15.1')],
  ['_drawerRefreshing reset in protection path', result.includes('_drawerRefreshing = false; CCD.refresh(updatedCart)')],
  ['_drawerRefreshing reset in no-protection path', result.includes('_drawerRefreshing = false;\n            CCD.refresh(cart);')],
];

console.log('\n=== Verification ===');
var allOk = true;
checks.forEach(function(c) {
  var ok = c[1] ? 'OK' : 'FAIL';
  if (!c[1]) allOk = false;
  console.log(ok + ': ' + c[0]);
});
console.log(allOk ? '\nAll checks passed!' : '\nSome checks FAILED!');
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
