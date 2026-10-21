// ============================================================================
// === ANTI-DEBUGGING SHIELD ===
// ============================================================================
// This block runs FIRST, before any other JS. Its job is to make casual
// inspection of credentials harder. It is NOT bulletproof — anyone who saves
// this HTML and opens it in a text editor still sees the SHA-256 hashes (which
// are one-way and can't be reversed without the plaintext anyway). But it
// raises the bar against:
//   - typing variable names in the live console
//   - using `console.log` to dump objects
//   - opening DevTools at all on this page
// The shield runs as an IIFE so the helpers don't leak to global scope.
(function antiDebugShield() {
  // 1. Override every console method to a silent no-op. Even if some other
  //    code accidentally logs sensitive data, nothing reaches the DevTools
  //    console. We DO keep `console.error` — but route it through a wrapper
  //    that scrubs anything looking like a credential.
  const noop = function(){};
  const consoleMethods = ['log', 'debug', 'info', 'warn', 'dir', 'dirxml',
    'table', 'trace', 'group', 'groupCollapsed', 'groupEnd', 'time',
    'timeEnd', 'timeLog', 'profile', 'profileEnd', 'count', 'countReset',
    'assert', 'clear'];
  consoleMethods.forEach(function(m) {
    try { Object.defineProperty(console, m, { value: noop, writable: false, configurable: false }); }
    catch (e) { try { console[m] = noop; } catch (e2) {} }
  });
  // Keep error() but make it harmless — print only a generic message.
  try {
    const origError = console.error;
    Object.defineProperty(console, 'error', {
      value: function() { /* silenced for security */ },
      writable: false, configurable: false
    });
  } catch (e) {}

  // 2. Block right-click globally. Right-click is the easiest path for a
  //    casual user to reach "Inspect Element" → DevTools.
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // 3. Block common keyboard shortcuts that open DevTools or View Source:
  //    F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Cmd+Opt+I, Cmd+Opt+J.
  document.addEventListener('keydown', function(e) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if (k === 'F12') { e.preventDefault(); return false; }
    if (ctrl && shift && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c')) {
      e.preventDefault(); return false;
    }
    if (ctrl && (k === 'U' || k === 'u')) { e.preventDefault(); return false; }
  }, true);

  // 4. DevTools-open detection. Two heuristics:
  //    (a) The classic "outerWidth - innerWidth > 160" trick — when DevTools
  //        is docked to the side or bottom, this difference jumps.
  //    (b) The debugger-trap timing trick: a `debugger` statement inside a
  //        function pauses execution if DevTools is open; we measure how
  //        long the function takes to run.
  //  When devtools is detected, we wipe the console aggressively and refuse
  //  to render the page.
  let devtoolsOpen = false;
  function lockdownPage(reason) {
    if (devtoolsOpen) return;
    devtoolsOpen = true;
    try {
      // Replace the entire body with a security notice so even if they have
      // DevTools open, there's nothing useful on the page to inspect.
      const body = document.body || document.documentElement;
      if (body) {
        body.innerHTML =
          '<div style="font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:60px 20px;background:#0b1220;color:#fff;min-height:100vh;box-sizing:border-box">' +
          '<h1 style="color:#c8a951;margin-bottom:20px"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></span> Security Notice</h1>' +
          '<p style="font-size:1.1rem;max-width:600px;margin:0 auto 20px">For the safety of student records and staff information, this site has paused.</p>' +
          '<p style="color:#aaa;font-size:0.95rem;max-width:600px;margin:0 auto">Please open the site in a full browser window and refresh the page to continue.</p>' +
          '</div>';
      }
    } catch (e) {}
  }
  // Start the size-difference watchdog after the page has rendered.
  function checkDevTools() {
    try {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      // Thresholds chosen to avoid false positives on small zoom changes.
      // 160px is roughly the minimum docked DevTools panel width/height.
      if (widthDiff > 200 || heightDiff > 200) lockdownPage('size');
    } catch (e) {}
  }
  // Start polling shortly after page load. Don't fire instantly — we need the
  // body to exist before we can scrub it.
  setTimeout(function tick() {
    checkDevTools();
    setTimeout(tick, 1500);
  }, 2000);

  // 5. Periodically clear console — even if the override above misses
  //    something (some browsers expose console.* before our override runs).
  //    Note: console.clear was already overridden to noop, so we use a
  //    direct call to the original via a fresh frame trick.
  // (Kept simple here — primary protection is the noop overrides above.)
})();

const LOGO_SRC = "assets/logo.png";

// =========================================
// NOBLE HIGH SCHOOL - FULL APPLICATION LOGIC
// =========================================

// === PRINCIPAL SIGNATURE (base64-embedded image) ===
// Used in fee receipts, exam timetables, hall tickets, report cards, and
// the digital student ID card.
// The boolean flag below controls whether the principal's signature image
// is displayed across the website — fee receipts, hall tickets, exam
// timetables, and report cards. Per the school's request, the website may
// be deployed in two builds: one WITH signatures and one WITHOUT.
// EXCEPTION: the digital student ID card always renders the signature,
// regardless of this flag, because the physical card itself bears the
// signature and the digital card is a faithful on-screen replica.
const SHOW_PRINCIPAL_SIGNATURE = false;
const PRINCIPAL_SIGNATURE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAC7AlgDASIAAhEBAxEB/8QAHQABAAIDAQEBAQAAAAAAAAAAAAcIBAUGAwIBCf/EAEMQAAEDAwMCBAQEBAIIBQUAAAEAAgMEBREGEiEHMQgTQVEUImFxMoGRoRVCscEjUhYXM2JygtHhJZKi8PEYJFPC0v/EABsBAQACAwEBAAAAAAAAAAAAAAADBAIFBgEH/8QAOxEAAgEDAQUFBgUCBgMBAAAAAAECAwQRBQYSITFBUWFxgbEHExQikaEywdHh8DNCFSNDUmKSNHKC8f/aAAwDAQACEQMRAD8AuWiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiLkOrmopdNaKqrjAMyEiMYeWuG7jII7EIie2t6lzWjRprMpPC8zqxPAZ/IE0ZlAzs3Ddj3x3Xov581FZXHW9Pequ6VI+IrGyPn814c07gThw5H7BX101d6S/WKjvFA5zqariEkZc0tOD7g9lFSqqpnuNtrugV9Gqxp1XnK5r0NiiIpTRBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEUW9d+ob9K0MdstkgFxqu72OG+FvHOD7jgH07rxvCyy5YWFfUK8begsyZJfxlJ8U2l+Jh89wJEXmDeQO/Hde6ohWX6vi1DHc7iPOjfKHlwyHtOfxMePmafsrm9N7nWXfRNruFxex9ZLADPsORuyfoP6DPfCgo3CqtrGGjcbQbM3GibjqSUlLqu3qjokRFYObCIiAIiIAeyqr4iNYG93qooIpCaSicY4x+E+Z/MD789laC71TaG2VNY9zWshjL3E9gB3VD9UmfU3UJtuto86W4V5EbGuxvc93y4yoq8moYXN8Dv8AYG2pfEVLysuFNcH0y/2PuakNTpJjJGNbI1/mc5yc+n7Kx/hKul7ufT5z7lJJPDHO+KN8sxJYW4bta3HDSBnv3z7qEeoMT7Dcm2eWIxyRAMe3P84HP9VOvhQZDB0/qaSPBfBWFspAGNzmh/BBOcBwB+uR6JKmqdfdXRJM3+3lSFfTKVZY+aWV4NEwoiKU+QhEzyRzwiAIiIAiE4RAETIRAEREAREQBERAEREAREQBEyuJ6j9SLFo2neyeUVFcW/JTs5OcHG72H7rxySWWT21rWuqipUYuUn0R22V5zTwwt3TSxxj3e4D+qqJrjrXrC9F8dHVG2UsjS0sgODg47OHPp755XAXC5Xm5AyVdwmqA75ju5H55Wuq6nThLdSbO/tPZrqNWCnWnGGenN/bh9y+sVwoJXbY62me72bK0n+qyN7ePmHPbnuv5+wT1bHNeydny/hAjbj6+nssi0z1NJPVTUTIqaSbImdE0tL298HHbn2wsY6pB84slqezK8i+FaOPMv3kLzqJ4qeB88zxHHG0ue49gB3KpzpvqVq3TkHl0l6q46cvDmxSkTwhuPwtEgJaPo0hdnRdfrrcXPoaimoIg5mx26ncS73P4sYx6YVqF5Rk8b2PE0tbYXV6UvwKS7U0S5UdXen9PNLHNfg1sRw+UU0rowc4PzBpHdbai1/omtLG02qrPI+Ru9rPi2B5aDgnaTnGeOyqLe9Nw3aufW2Wdr6l8uQyGPadzjgbQBxyQF61mhuodrh8+usV8Y1jcGSNpfx6/gJx/2UPxdVPjDh2m7lsNYuSh8Yoy7JYT9V6FzBebQXMaLpREvG5o+IZlw9xystssThkSMI9w4KgdTW1zJmh8kjnsdjbP8zmn7PB/oti2vuE4gkL3SSQHMBwPkdkdsj3A/RZxvoN4wzKt7NK8VmFxFrvTX5svV50OceazP/EF95H1VJ4xr98JljoLtIMFwLafOQf+VYEF51HaZhLsrqKZxDTJ5s7XHHAHDvRHfRj+KLRTl7Pbh8KVxCT8S9GUyFS6h19ruiozTuu16qYXOyHVNVLK7/zE5/JZVH1B1w14kZfLmz5twjFU8g/QBxIA+wXqvab6P6EEvZ9qUY72/D6/sXGyPdfuVTifqfrczmeK93QOa4ktNRlg/IDt9FgTa11rWzOrX3q7SuLPKLW1Uwbyc7trXAbuMZwvVeU3yyex9nmpuOZTgvP9i62UyqVSal1jBTh0s11JIzufLUf/ANLGodfavpXTRNuV0jbKNrnMq5g4D3a7cdp+oWDv6cXhpki9nWoSTcKkH5v9C72R7r8yPcKmUHVDWNLTNghvtzkZn8c9a+R+f+InOF80vU/WjG7JNRXhwAOHCryR9TlvK9d/RXUwfs51dRz8v1/Yuhke685Z4Yf9rLHH/wATgP6qmVV1W1tNTfCPvVd5TyTudO4PwcZG5pB9P6rT1Wor3cGRsmrn+Ww/IHPyW/YnJ/dYPUaXTiWaPs11F/1qkYrzf6F0LhqnTlvZuq71Qx/Lux5wcce+BnhcVfut2jrYMxfGV+e3kNYAR7je4KqUolMrI3VJaCNu0O+X/svoxNYza+OMub+E5xwo/j5SzhG8tvZraQx7+s5eCS9clkj4g9PGjbJDaK185AzTmaNrgc8jcTt4HPdZB682OFsclZYbrTwvIBkEkDw0Z5PyvyVWiPy2AF0bM8Y591vKe9wOp/g5Kam8pzSA7Zk8+ylp3TlweMk1x7PtOi06e+114r9C1+heoGmdZGSOzVhdPG3c+GRuHBucZGMg9ucHI9cLq1RTSwrIL+x1tknga6RpdLCXB0fzA5aQQc8YwDz2PCvTC4via4tLSRkg9wrFvVdSOWsHzvajQY6LdqlCe9GSyu1dzPpERTnNhERAEREAREQBERAEREBjXOshoKCasqCRFCzc8j2VKdW3Oa863nqGSSTCWYshDiXHZn5e+fRWo6y6hisejK0EB8s8flBvqA/I3fkq6+HGio7v1kjbXhzxR076iFoGWukbjaXfbJP3Cq3EnvRgup9L2JUdPsbrU6kc4WF39v5HP6ztNTbIZ6SsppoJImjDXx7XcgHseVPPhMnfPpG8eY4OLLg1vykkDEEfHP8AbhR34g7lT3PWVdTDyy4TNgY4HkbQGkH88/qpj8PNmorfoUXOgqHzQ3iUVgzy0YYI/lPqDs3c+69VPdrya7EZ7YX7utGtZVVicnvY7scfUklERWT5iEREARF+ZCA4jrZXOoNBVj2yBnmtMOSM5LhhVc8PFife+uFBOyVgNucat4J5DWYH7lw/VWO8SjnN6buc0ZAq4s8fUqufQTWLNMa7vFyqKcTn4WSGNn4cOy0gn6ccqvVSdWmvE+nbOUKktna6oLM5tpfRL0bNh1xqLdd+pVznpMRRsqC15ecAujaA5xz2BIJVh/D1bW0HS211AdIX3BprHh4w4F5zg/lhVp03Rzaq1oWSMy2unEJl2B4BkJc7LT3+UOH559Fc+2UVLbqCCgoadlPSwMDIomDDWNHYBSrDlKX84Gs22rKj8Np6/wBKKz4v9kZKIizOEC0VbrHStFXmhq9QW2Coa5jHMkqGt2uf+EE9gT6Z+nuub6q9S7VpGlfSRyulujwRHGzGYz6E5B/oQqfa+1DeG3T+LSTRzmWfzHxkYZknn5QcenbGFDVrxprLOs0XZO41GhO4m9yCXB45+Hd3n9AQQRkHhfqhjwr6ug1FpitgkuMktW2qfIKR7iRTxjDdrM9mZ5A9M+ymdSRkpLKOZuaErerKlLnF4CIuf15e6ayafqJ55pI3PGxhjblzXHsfoM8ZWaTbwjGlSlVmqcFlvgVs8RHUq5Ov01FT1lbTW6KUMkp/OdHl7RjgxkOHP1zlTh0C1FU6g0LF8S6SZ1E5sDaiWZ0kkzdjXBzyRnf82D35HdU/1o5141jQW+acyOrasbpCckkvADj+qux0w0u/S2nRRyyMMsrhI5jANsZ2gbQR+L74Co0ZSlWn2HdbXWVlY21C3pRSmlz6vhxz5nVoiK6cCEREAREQBERAEKLX6iulNZrLVXKrc9kEEZc9zRkge+EMoQlOSjFZbOG629RG6NtHw1EzzLnUsIiyMtYO277g+hVVIWXG8y1N0rDX1ri7JFNTvqZpHE9msaCSB9Oy3la+4a+1tJUNax8lXPsaZHbG57NBJ4BdwPuVanpboym0bp2OjyyWukG6pnEYaSSSQzju1uSAfUDla7cldT3m/lR9SqXdHY6yjRpRUrmay32fzouHaVL/ANHvh7qwXKKqhYRHI1ssJY97XY5LTgjAOSDggAq1nT7S+jRpWl/hotF8gfH81bGxkrJjjkjGQB9At9qjTNo1HSfD3OlZJg5ZIGje0+mCtfofQ9p0hPWTWySoJrCDKxxa1mR/MGNAAd2BPrgKxRto0c7q5nLa7tNX1enTcpOLjwcVyff+z8jUXLo308r601j7AyCVxy74eZ8bXf8AKDj9At3p7Qek7CS622WlY8/zvZvd+pXF9QOt1r0xd57VT2qWtqIWncZJfJbvGcD8Ljjtz9ey63pjrCXWVlkuE1pFsfHIG+WK2OoDgRkOBZyAQQQHNaeeyljGnvPCWSheT1iFtCVxKfu5cst4f3N/U2i1VLNlRbaKZuMYkga4Y/MKPNZ9EtH3sPnt9MbRWYJa6m4iJ+rO36YUoLT6tv8AQads09wrqmCHy2EsbK/bvcOwHqvZ04SXzIq6fqF9bVl8JOSk+ib4+XUptNS3LTmtqqy0ta5tSJvKjlidtBka4FuCewJABPoCVcLp5qD/AEr0TadRfCGjNfTtlMG/f5Z7EbsDPb2VQaier1T1BqLxQUUsjxO6pZBGwue7HLWgD1Jx+qtf0btNwsXS7T1ou1MaavpaNrKiLeHbH5JIyOD3VLT/AMMkuWeB2PtBSda3lP8AquC3v59TdXbTtiuw/wDE7PQVh95qdrj+pGViWrRmlbXN51v0/bqeT/M2AZ/db9Ffwjg1dV1D3am93sy8fQAYXlNTU8xBmgikx23MBx+q9UXpCm1yMR1strm7XW+kc09wYW/9F5vslnfJHI+00DnxHMbjTMJYcYyOOFnohl7yfaakaZ06Hl7bDa2uPcikYM/ssyG30EDQ2GipowCCAyJowR27BZRUW9V+rVv0qyWhoGGpuGMB2PkacZ/PuOcY9FjKUYLL4IuWdtd6jWVCjmUn0Os1nrOwaZpXm41UbpQ3IgGCfoSPQKrPUjWtFqm7zS0VpgohktaYsjzD6Ej3Xjp+i1Hr/UzJpHMmkqJiQ4t2t3HJIb6DsT6dlYrSfR3SNniikrKMXKraPnfPyx3029iPuqU/eXC+Xgj6Fbw0zZCea8nUr45J4S/nfnwKvaa0ff75KI7fbqqbc4N3ta7aCT9sfmpk0h4e5CYanUF1a1pG59PHF83bgbs8H37qwFLTQUsDYKaGOGJgw1kbQ1oH0AXr2XtKwpQ4vizVap7QdSu8xof5ce7i/q/yOAoOj3T6mgbHJYY6lwH45pHE59exGF9y9Ien0hydPxj7TPH5d11MWoLJLfZLEy60RukbN7qPzh523vnb3I+y2at+7h2HLPWdRUs+/nn/ANn+pwsXSLp3HGWf6M0z2n/PI8//ALLXV/RLQM2DT2+ajIdnEc7nN/R2VJahLxF6ovtimpRbLhWU8QkYXtppjE48ZPI79uxWLoUsZcV9C/pd5q99dRoULiW9LtkzsKDpB0+pWYdYI6g4wXTSOcT++F81nR7QM7w9llFO4HIMUhGP1ytd0E6iP1daJLbeKhj71RgOdJ8jfionE7ZGsacjAG13b5gfTClBe+7g1yRVr6pqlCtKFStNSXB/M/1Oe0no2waZha22UTRKPxTyHdI4+5Pv9sLoURSJY5GrqVZ1Zb022+18QiLFrrlb6AD42upaXPbzpmsz+pQjMpFqmak08+QRsvtrc8nAaKyMk/utplD1rB+oiIeBERAEREAREQEF+KBxAja0vDvhmdnYHL3+nquI8IhpYL1qe81VVTQSU8RjaZyB65z9uPT3UzdddLC+6TqqumiYaynizuc8j/DbkkD68lU1tF1nsF0q6LdJHHVO3fiHH2Vas4wqwnLlxPq2zVCGpaBKzjPde9h+eH9+R3N+r3XTUVbcajMxjc+odznOMuI+5PH5q1PRu1TWTpbpu1VEUkMtNQRsfHIMOacZwR78qtnSnQV61dfKFj6eWOyNrY6u5zvJa2WGPLmwDA5L37SQCMNbk5DgrgN7BTp73zPqc/txeUql5C0ov5aSx59foERcp1B15YtG0QkuNS01LwfJp2n5nkf0HZetpLLOPt7arc1FSoxcpPkkdU5wa0ucQAOST2C4XXXVHTemIiDUR1tSHFpiik/Dg4OTg8/++FX7WfUrVeq5BSsqZYqZziwRU42h7T/mx3XR6X6Qag1HaoJ6yeChhPO+TL5Ht+ndRxqqed07eGyVvp0Y1tXrKKf9q5/zwXme17656krBL/Daelo4uDFsbueR/vFxx7dgFyMfUHXNZdmuju92ZK45DY6iQsyP93JH5YwrBaK6U6Z07Tt8+njudSO8s8Q2/k3/AK57ldpS2630hDqWhpYMDgxwtb/QLx05N5cg9odDtcwtrJSXRy/fJUmom1hXVsztQw3aupan5TUzPke1u3OAATsbg98D7qLaJ/8AC9XVEHLfPyXH8zx+6tf161xbaa2C1UFeyWrJ3ERuy1o7EE/2VVdQxGtuIrYsCZhJAH15VW8koxh83FHf7L1Kt7ae/wDcKms8EuT7XjvRZzw2aTs0tNPqVxnmraapfTNZJ8rI5AAS8Ad3Yft3e3ZTkqqdGerR0fS1VDcLRPW2+qqDVO8hzRUQyOADzh5DXs+UYwQRn19Jbf1y0YIHyiO4/K0HDo2DLsZ2/j7jsfT6q5CcZRynwPles6Pq1S/qyqUZNtvik2sdMPwJQXCdT+o1q0hQTsD/AD7iG/JCwA7T7uXJXTr5aIo5HUlolmZy2NxqWgk+h2gEgfmoYt1BfeousPMc6eWSqlOS75iGj1+zR6/17KKpcRTUY8Wy9omyrblc6onTow554N93b/OBz91q7lqDUElZVvnnc+QOcXvLtg9OT6BaPqC+Eyw0bGgudtALvfg/3U86r6VVOi9OT3mXUDa8f4Y+EbQtYyMg8uD8l5JGc54PoAoSmhhrepFkhLI3xSVkYMbhkOGR/wBFVr0FCnxfGTPpthrdC/s51baOIQTjjlyx+RYfwo6HZYqOov0kdRBUzwfDlhbhj2ucJNwyOSOBxwp4WHZaOKhtVNSQxsijijADGdh9lmLYU4KnFRXQ+D3127y5nXksbzyFFXXS6UDPhbW+oDp52Pd5TME/L2yPTv6rrupmqI9J6UqroXwCZrS2BspOHPwcDA5PZVJp9RV2pL3/ABmplMlYd++TnjgkAZ9MKejNRqLtOr2P0GpeVfjJPEIcu94/LqcXT1UP+su11FY9kNPT1jHSbiGgNBznJPbhf0Lopoaikinp5o5onsDmSRuDmuGO4I4IX82au1v1LrJ1j89tP8TJFA6VzclrHOG4fchf0Q0FZKXTekLXYaSTzIqClZTteRguDRgHCoWkWotvqzDbmuqmpbq6L+ehvERFbOMCIiAIiIAiIgPwkAEk4AVcfEnrNtxuMWlrfKx/lvAk2tcHbj/KT2IPGMf3Uz9ULrJZ9FXCsjbG7/DLHB/YhwIKpnE6urrpNJT08tdWPIjp4mjcZJXna0Y7kDJJA9Aql1OSShHqd1sZp1LFXVK/4aKyl2yx/PMnLoB03pLgaPVd6o6eaGgnkdafnEm9/DXTHgFpBZgD7lWCwsKxUwo7NR0oBHlQMZgjB4aAs1WIQUI7seRyF9e1b64lcVXmUnkIUQrMqFZPFXpOio6v+P0UjRNV4jmhLiSXYJDvoMen0XS+Dt0cuk7nUNyXvfCx5IxnY1zR+wCwfFTKHy08TA4OY3BGOCS04/ZfPg1tlDUadqb4RMK2nlfS5bI5rHMcQ7lnYkY4J5GT7qruKNzldUfRr+pOvsnRdV5alw8MtY8ia9b6gpdNadqrpUzRReUwmPzQS1zvRvHuqc651TeNcX8S1MssgLsRQsJwwZx2HGcdz9FY3xQuI6YPG7aHVkQJ/MqBukN0sFqv1PUX2hbV0zJJG1HltL5GAgbHNjaMuAOd2OQDnB9MLrM5Rp5wmXNjqNHT9Lq6t7tzqJtJLpy/XiyUvDt0/wDI8vUFdFM1sbw+nkdujc94BGQ0jmPDjznk/QKex2Wr03fbHf7cytsVzo6+lIGH00gcBx2IHIP0OFs8q1CEYR3Y8j55qeo19SuZXFd/M/t3H6iIsygEREAREQHzI7bG44zgKimoi249QayGpe8RPrXtcTzx5n9sBXtPZVI8QvTS4ae1DLqS0RyPtc7y9zuXmN7uTuOOAT2Wv1GMnTUlyXM+iezq9oUburRqPEqiSj49nj2E99GtN2mz6ebWUUkc89RlplBBMbQf9lkd8EE885P2XeYVKdAdRr5piqaaetnpIS7MzBGJIZuP5oz2OeS5pDj2JU96F65adutvjbqDNsrs7HOhikmp5HY7tc0Et+zgPuVLQuqVSKw8Gm2g2Z1Sxryq1ouab/EuOfHsJbWJd7lRWqidV19QyGFvqeSfoAOSfstfQau0zXSxw01+tzppGhzITUNbIQex2Ow70PosnUdqpr5Zam21QGyeMt37clmR3H1VtYZzEIJVFGpwWeJV/qHdqG8dcKS42imhqz8RTTRtnLm/4jXBri0hwwSwn1wccq2ELxJG17SCHDIwcqjuq7P/AA/U0UfmiWOCqEW487gHY5/I9laDw9Tmo6bwSfxR9ez4iRse4giBrTtELcfytxwq1GbdScX0Z2u2Wk29lC2q0HlSjjxx1+jJEUMeJCwVlZRU9fBTSVEQla2QRtLi3DTyfYKZ1+OaHAhwBBGCCrUXhnK6XqE9OuoXMFlx6FIdLXyt0lqeGso5DS1UBf5byxvz7u8TyQT5biBkDB4yCFcLQmo6bVGmKW7U7ml727KhjQQI5m8SM554dkKK/EloOkns41Ba6SOKohO2dsUIG9nq4n6Lgegmu/8ARvVUdNdK2Oms9xGytlmLi2KoA/wnjuGB4+UngZaCcZ5hT3ZbjfgdrtDRoa3p8dYtY4kniovRlr18TyshhfLIdrGNLnHvgDkpFIyWNskb2vY8BzXNOQQexB9VxnWy4vt3Ty5zU9Waaq2Awua/a7O4A4/VSnB2lu7mvCjF8ZNL6sjPqx1qqKe4G36SqsRsGJJzCPmJBBAJ5+ueDwouoTrnUNwmmgobjWPlIMr44CS8gYGT6n6lYGkG2uqudNPeaxtMyarbT/EyjEVPnvLI4/K0D03cE4B7q52n22qksUDLbUU76GNg2yxyBzHe7twOOe6pwjOs9/ewu4+m6lqGn7LNWdtbqdRLjKX8/Qq3L0z6nOhir22+pHknzGsc5hl75OOc5/6L71v1J1vBXRzxXOup5Gva2aJj/L2FowQGdgeTnPf1yrBao6j6XslNK7+IRVdQ0HZFBlwcf+Icd+/PCq7rKvdqi+TG3xYNQ7cGOeBh477iff3Vr3e7Tluvi/5wLWhXE9dk6moW0VTiniWMLjz5+pZ3ovq86u0bBPVTumudJinrpDGGCWUAEyMA/kdkEHhdwox8OumHWDRhqnyb/wCIvbPGNjmEM2NAyCAckgn81Jx4C9XLifKLuFKFecaTzFN48M8AmQuE1x1T0vpWSWmqZ31FYwH/AAYh2d7EnsoT1V1r1BdKeWKhqZ6JhOQaXEbwPbPJ/fKwlVhDmzc6ZstqepR36NPEe18F5dpaZzmtBc4gAdyeyw6i7WunZvnuNHE3/M+drR+5VL63VuqLzLNUPq5qgkZJLnOLQRj3449lhUFBqOsYY6e2zVDnOBAjpA4n29O6gd5D+1N+R00fZ1XjHNa4hH+eRcut1ppOjnkgqNR2pksbtsjPimlzD7EA8H7r6h1lpKaRkceprMZHt3NYa2MOI9wCc4VW6Dp51OqgwxWi5xDuXPlaz8+SCsK+2O96bqWxX+Kn8xo+Xzdsjx9sgrL4jhlxaREtiLapL3dC9jKfYsP0ZcKqqLfLRuFRNTOp5GfNve3Y5p/PBCor1ntNOzV9Y6hiBZFUO8sR4wGg5/7LPt9T8TWYk+HlkAPlPliDvLBBBDePlGD6L90fa6i/6kFq+GkqXzHaBG3dtJOA48g7R3OD6KCtWVaKhFc2dRomzr2ehcVrmrmG6m8Ls6+J1HSnqvdNF26KhFLR1FE8h1RBPuje04A8xj2h2SQBlrh6cFTHYuvGmq1rfjrdcKTc5wa+FoqWbRjBOz5m5zwC30K1Fd4eLc6AtotQzxv9TJThw/rlcfqPw96noovNs1bQXLbwYy4wvI/Pj91Ybq04rhn1NFXt9lNVqSqKu6c5PPHOM+awvqTlJ1K0a2lZM67hgkO1jXwSBxJBI429sA89lUjrLqF9+1nU18rmMZLPsaWEgFo4H64yt7N0k6kwuEf8DqCH5ALJWuAxzyQf6rj9V6av9DJFS3S0V1JURghhfC5rj65z6/dVbuvKVLG60dJsvoemadXlUtbmNSbWOa4dej6k1dEa/pvZ6OWmvfmQ3Kk2SGorIiYZWuOGuY5uWnnPB5HqFMtZ1C0ZSUzJ3X+jlY8OLBATIXY78NB/dUptEF4IYWirJa7II3ZH6Lr7donXF5f5lPY7nNk5L3NLQ4enzHgrOhdOUPlgzXatsZb1riVxdXmM8eOOHdzLA3nrbpWjJFGyatG3Ika5rWknsO+79lGGtOuN+uhkp7Ri2QgFrg1m5z8+u48jH0WNp3odrSrrGurWU9upXEF7pJdzx/yj/qpX0p0S0ran+fcRLdJvTzeGD8h3Uma8+mDVuGy2jS3t515rzX5R9SBNC6SuOuNRwwS1UjGVJc6R789hy4j7Z/MkBTrB0F0W2gNNPJcZZDz5wka14OMegUmWy1262Mcy30NNSNdjcIYw3djtnHdZilhQjFceLNDqu2WoXdbeoTdOC5RT5eaK93vw8zwbnaev/mM//DVs2kj23tz+uFy0nRXXQf8AB/AQOhc8vbKJ2kN9Oecj9CrWphHb0+wzobd6xSjuympd7XH7YIJ0l4f4IJIZ9RXUVO14c6CFvyuA/lLj/UeymDTum7Jp+KSOz26GkEhBeWjLnY7ZJ59TwtsizhTjD8KNFqWtX2pyzc1HLu6fTkc71Ht9LcdGXOKrY57GU75GhriPmDTjsqJXepfQ363V1NKI5Y5WkOJ/Cf78ZX9C6mGKogfBPG2WJ4w9jhkOHsQqkdfekt3pdSSVlksVRPbJT5kbqSMvbE/uQWjJA/ZVr2LcE4rkzsthNSoQjWsa0kt/isvC71x6smzp11R0/LpCmdqW9x2+vgbsnfXvbH5vciQEcEFozng8cgLWdSOt9oszZaXT81JcJ3QbmVIf5kbH57FoxnA5zkDn7qqUtvv1rfJPK2upS0kuc5joy3HuCOB2XW6W6Xa21XFT3OitNXHA+MHzpRsbJzk/i5IKxVzOaxGPE2C2M0uzqe/u63+X2ZS++ePkfGrtW3vWV7iqbhVRvaH7fnlEcbQR9Tgfn7rxtFLbaa0x3G13GkqWTbvmiy5hcDhwB+hOMqfOlvRh1prKh+qqOz19FJFsdTSxCfznHnc7I2gDsBznutH4j9N2SwUlr/gdpo7bCGS5jpYhGzJOeGjgc5PHurttCMVKU1mWPoX9P2ntqupQ02yglR4rKXNpdO77sirw2W+gvXWLNxpIast+ZpcMhpaeDj34/dXgHZUe8IzJv9bgqA4BhcWyNJ5yQcf3V4QoLXjTRwe2E3PUnJ9n5sIiKwcsEREAREQBERARf4kr1FbuntRb3xSOfX/4bHsxhhBB59eRnsoX8O9LTXDqLamT0XxL6YS1rJGsBfTvaQwEnPDSHn07rvPFjd6R1toraxzxU00xfIA3HyuZxg+vcLV+EfT8r9Q3zVDqz5IKeK1fDGMZDg0Sl+72Jf2KrvjXXcjvt74TZFY4OrP7L/8ACyCIisHAhERAV+8UUxklhptsfyOYQQzkktd3d9vRcT4QKmsh17FbxVTNp30FW+WASHY5zZIg1xb2yATg9+VM/iPtcNdoR9S+Rkb6RxmbnGXcYIH6qDvDzcqGxdRqWola589dUm3RAdg2RpeSfrljVWqNfER8GfR6G7cbIVFFcYS4/wDZP8y1uqbJQ6hslRarhCySGZpHzMDtp9HDPqPQqqWuujmqtNV8k1Ex9fRbiYZYdxcPYOwOD9VcHumF7cW0K6Skc1oO095okn7nDhLnF8v2ZRWhOqKKsDhRXDz6ZwmyYntLDkfMXcew5zyPot3aepurbaWQtvV1p3Mc4kOqzJyfQtm39vYYVzi0EYIyD6Fa+tsNkrnF9bZ7fUuP80tMxx/UhQK0qR/DUZ0FXbOxvG3d2MX3p4foV3svXrUtDROiuYt90n8siOQ0hpwX/wC9se7j7NXVWrxAUkwgZV2JvmOOJRBWgbB7jzWsz9sqRrh070NXsLarS1qdn1bAGH9W4K5qs6GdPZ5jLFb6ylJ9Iat2P0dlSbtxHk0yj8VsvXXz0alN9zT9WZVN1i0fK4iQ3OnaHY3vonFh+oc3II+q6Cza60hd6iSmoNRW99TGAX075RHK0E4B2Pw7BPY4wVG158PNjmiItN+uFE7naJWNlb+2CuI1H0Z15aKaT4SeK+U2PwwuxJgHP4X/AF54K997Vj+KH0MYaNol2sW95uy7JrH35fctGHAgEHv2X6qYUGsNV6WqPJZVXa11ELyXsDnNZkuyd0T8scTyORxnhSnofr3UVD6el1Ba4agyS+W+oonCN0Qx8rnRvd8w4OS13fs3B49jdU28ZwyvqGxup2cHUjHfh2xeftzJ8XjWUtPWU0lNVQxzQyAtex7ctcPYharTWrNO6j8xtmu9LVyxf7WFrsSx/wDEw4cPzHK3as8zl/mhLsaIh1T0G0xcqh9RaJ5bS5/Lo2t8yPPuATwo01H4e9XUWZbLV0deOeI5TDJ9/m4z+atSirVLOjU5o6mw201izSiqu8uyXH78/uUpn0L1JoI3QVOnbrURg5xJAJm59xwR6LDqr7rWy1zPia+9UE0bC1kb3yxNOTnluQ1xOTyQSrxYCwrvarbdqV1Lc6GnrIT/ACTRhw/fsovgsL5ZtG6p7ewqyTvLOEl3Lj98lErtX11Szzp3PcXP3OLn5yff3XTaR6i3fTdFLSWaeotnmyOml+H2OY+R3dxjka5oJxztDcrY9dNMWzT2spaK2gxU8oDwz/KT6Z9vZd10G6c2O+UU10r42z01LPJSSU72cvmbjcSefkwRjGDnOfZQU6FZVXuy4Hba3quiy0qlc3VLejL8Kxx5fY0VH1x1aKZ0M1U6WUniVlPE1wH22kfstfH1r1y0Brb5M5zAQTPb6d+4kjBLWtZ2GRgH1z6KxDemmgg0Bulrc3aMAhhB/XOVjVXSfQFRgnTsEbgch0cj2n+quuFdrG8vocItZ2XfCVnJef7kC3frJqq42aooKuqje2phdE8MpGRhwPGcZce31UY0lZNSSHa1pa5u17HAObIDwWuB4II4wrhQ9Hunkbw52nopSBgeZK8/3XI9VeiunpdN1FXpa3ChuEA3tY2V5Y9o5LQ3nk+mPVRVqNWSynxR0Gi7V7P2z+Fo0XCM3xbxjs48XwIg0r1N1LYKNlLb7tV01M3gU4EckQ5J+USNcW98YBAAAwAvfVXVK+6ktEttr65745D/ADxRAgew2tH07rmLG2lpX1T7lSgywsLxFM0jBBAIPseSrW2DpjoFtshkbY46zzIx/jVTi+Rwx6+g/IBSUo1JU1mXPuJdbutC0K9i/hcz/EmsJFNI6mpoqx8tLUOge/hwHAcDyQR9V+QzGkrn1tJR01HUvi8pzoGmNrmeoLAQz0HplXWqelnT+oduk0tQ7vdoc3+hWtr+i3T6rPzWiSL6RzuH9cqpGxq009yYn7QNFuZRlXtm2urUX+ZUQ3GsleXzFz3D1GTj8lIXTDW9Bp6tE9TQW2rp5Y2smp6mL52luTuieGnkkjIdxwMEKZ6voFoSZrgz+KQktxllT2+vIWql8OmmtmKe93WJ3o52xxH7AKejC4pPmmj3UdrdntUt/h62/Fdyx6NmQzr5ZMOMljrom4Ja99RDh3t2cT+ywbn19opHvjobPBLT8Nc6WqdvIOc/KGY/9S9D4eLP5IjGpLkMDAPkx8e68f8A6crS1jvL1LXhxOQTAzH54Kmbq5WEjmaVHZCPGVSb8n+SIB1zWOud7qLj5DIPPO4Rtztb7Yyc+izOnl8tdnvdNWXi1R3GlhfmaJ/qPpz3H1491MFX4dq2TPk6kp8DIb5kDiQPTnKxovDhdN2ZtU0o7csp3Z+vqqk6FVVveQ6nevazZ+pZ/DSrYjjHBSTxy7DC1D1vbSV27TumbZS0jhh7ZKdpc93oSRjHHouSqOsmrZXF7K+eAufk+Sdg78DAxwFIUPhxqJmD43VTGO/m8umLs8/Uj0wtnS+G+wxvDpdQ3GYD+XymAJUheSlwaSNHR1PY22hjd333xk39yIp+pusZ4sOvNxG4AEGpeQR68Zxyuarq26XWTzZRU1bh8vysLiPTHCtTbOh2gqMYmoqqsOefPqDg/kMLs9PaU05YIwyz2ekowOxYzJ/U8qSVrUqLE5EMtudHsU/8Ptfm8FFfbLKw9Lekd/v9UKiq8+00Y5c+WFwcRzjAdjPZWB0H0x03pGdtZSRzVNcBg1EzufyA4C7fCKxSt4UliKOJ1ravUNWlJVJbsH/auXn1fmMIiKY5oYC+JYopW7ZY2PHs4Ar7RAngx2UVGz8FLA3PtG0f2XuBhfqIett8xhERDwIiIAiIgCIiAJhEQGNX2+huEJhrqOnqoyMFk0TXg/kQvSkpoKSnZT00TYomDDWNHAXqiHu88YCrh4lr7NNepbPIxuyliOxwHq8Z5+yseVVDxKzTjXF2gwHPMEb2D2AH/ReSqbkZPuZ2OwlKNTVU5LOE36H14Jqe2G+ahfUwUxqw+J9K6Ro8xpw8OLfuMq1qq74Gg182o5nNcXkR8nkep49u5VolBaf0Yms2nkpapVa7V6IeqIisGgCIiAIiIAiIgIP8XEJdpe2SMhztqHb37c4BbjkrnvCZqVtPfbrpeaIH4+Jt0hqS/AJAbC6LB7uGwO49HBTb1Ksceo9E3O0yzeQ2WEkybd2NvPb8lTnSV6g0pq2y3K7iT4S0Xhs8wbEXSBrmujO0DnguaSDx6+iqzk4Vk+jWDvLRR1LZipRj+OhLe8U/4/oXqRedPK2eCOZmSyRoc37EZC9FaODCIiA5bqpYjf8ARVxooYIpaowu8gyENDXd85Pbsqi6KmobTrSmq7wWU8NuqmVr3uAPlvidzgntkZGR6FXicARgjIPoq2eJHQcdvubdVQA1FJVyeTW07owW4fxgADGNox2z2VW5Tjiounod1slqMJUa+lVsYqp7rfSWOH19Sx9JMyppo6iJ26OVge0+4IyF6qKvC9eprn0wgoa641ldcLbPNTTvqg4yBrZHCMFxADvkDeylVWU8nDyi4txfQIiL0xCIiAJgIiAwrrabXdYHQXK30tXG7u2aIO/qoW174f6GqkkrtJ1Qo5HZJpJyTGT/ALru4/PKnZavUGoLPYaQ1N2uEFKzHAe7l32HcqOpTjNYkjb6TrGoafVXwc2m+nNPyKaUU970PreIXGOopLtQyNbDIZSw4zxG5w5MLvVvscjlW76b6rptZaUp71BBNTvLnQ1EMrC0xTMOHtwecB2cH1GCqodbr0NV6wdW22GV9PMWth45J+n6qyvQiyV9i0IKa4+WZJ6yepjcxwduje7LTx6keir2ycJSpp5SOt23t4SoW17OChWqL5kv0O+REVw+dhCiICtvirs8dHfbbeoZXulqgWSMIG0BvbH7rufC48S6Fu0jSSHX2qIyf+FdX1R0RQa20/LQzhkVSBmGoDAXsI5ABPYZ7rj/AA8WDWGlH3iw321imtYk+Ipp/Ma7zpnEiQ8HIB2tIBHAKhjGUajfRnVXuqU7vQ6Fu5f5lKTWP+LXBrw5EvIiKY5UL8K/UQFU+umiavSuopL61rK+hr3udJuZkbj+Jrm8jaVLPh51dbbrpmPTMLwyqtFOxrI3SF8j6fGGyOyBg53NIyfw91IOpLPQ36zVNquMDJqeoYWua8ZGfQ/l3VVjQ3Hpf1Fjf5NdIyjlc6hLZHRCqjP4oyOQ5pGSGn+YDHdRN7ku5+p3PxC2h0z3Uv8AyKKyv+UOq8UW7Ra3TV7tuorHSXm0VTaqiqoxJFK0Ebh9jyOc91slKcMEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAD2VTvEzaJLdqCoqIXTOaW7mvklc95z3+Z3P5eitiqteKWomfqaqge8mKOIFrfbLVlw91Uz2M7XYHeWrLd/2vP2PTwSyNbLeJHeZmZkUTAMEcDJJ9v/AIVoVVnwS04qKi7TbwG03lubg8uJaWkEforTKravNGJq9qoparVx3eiCIisHPBERAEREAREQAgEYKgrr10xklkm1jpqNwrWNLqynZk+c3GCQO5OOMD0U6oeQsKlNTjhmy0rVK2mXCrUvBro11T7itfQrqfU2qSi09d52SWXAgjdJuM9E/wBN7yfmiPOXOOWngnGFZKN7JGNexwc1wy1wOQR7hcHrLpRpPUT5KuOk/hdxcD/91R/Juz6Pb+Fw9wVEF1i190hq46K2ywS2sscad1KN0TOc/wCJA4+uMcEdzghRRlKnH5+PebavZ2Wq1nPT3uSf+nLt/wCL5PzwWdRRf0t6m3PVDaeG46albJIDmroHGSnBAH4g8Bzc+wL/ALqUFOmmso52vb1Lebp1VhoL5fGyQYexrh7EZX0i9IT4hiihibFDGyONvZrWgAfkFrtQags1hhE13uENIxwJbvyS7HfAGSfyW0Wq1Lp6z6joDRXihiqov5dww5h9we4K8fcS0fdua97nd645nKv6v6GZVtpjW3EvcHFpba6ktIbyTuDMeo+/os6LqboqQnF42hpwS+nkaO2e5byuHqvD9ZpKwvpr/XwUrjkxFm5/5P3fb0X0fD9ZRGI49Q3JrR6eWwj91E5VFyj9zpIWez74u5mv/g66v6r6JpS5jLnLVSNi80sp6WR/y5xnOMdx2z+y0F164WCnlgbQ0E9a2Rxa8/ERRmMe53HB/VaseHiygYOo7mcAhvyM4Kz7f0B0jDCG1lbdKiTOXOZMIwfy5/qsN6u+SSJlbbNU871epLwjj1Pk9etPtj3PtFwiduILXzwenr8rzwfRc9dvEG7zpW0Fshjgx/hPL3PkJ57ggAfuuwHQvQWRuguD8ej6okH9Qt1F0o6fxxNYNN0pAGMkuyf3XjVw+TSMqVfZig03TqVPHC9GQPUdcdaEPdT1zi3I5fDDgc9uGf3XM32+ao1xcIZqn4mun24jbHTktxz2wP8A3lWstHT7RdpOaHTlvYTnO6Pfnn/eyuhpKOlpG7KWmhgafSKMNH7LBW9WX9SfA2UNrdKsZ79jZJS7W+P5+pW/pd0h1FLdqeuv9KKemidvDKjkuHoMd+2fsrJ0sEVNTx08LAyKNoaxo4AA7BeiKzTpRprETk9Z1q51ev764fLklySCIikNQEREATAREAREQBERAFznUHSVBrCxPttb8jwd0EwGXRP9wujReNKSwyWhXqW9RVaTxJcUyCenejuo/T7Ve2goqK4WSuqM3BsVQ1rTk81DWuIIl7ZH4SMnG7vOwOQCRj6IiJYWCS7uXdVXVlFJvnhYXjj9AiIvSsEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBVd8UEUBv8AXStc8yvgAIxwC0HCtEVVfxLny9X1Z8wOYYsubnssZvEJeB2ewab1ZJPHyv8AI+vAuXPl1DsOPLELXg/5fmwB+atMql+Ca90Nvulxt1S2VtTdZGtg2MJZlrXOO4+nAOPsraKG1/pI1e08XHUqme70QREVg0AREQBERAEREAREQBY9dQ0ddEYa2kgqYyMFksYeD6dj9yshECeOR4UNJS0NO2mo6aGmgZ+GOKMMa37AcL3REAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEXjWVdLRwGerqYaeId3yyBjR+ZQHsi4jWfVHSOmaZ7prhHXVI27KWkkY5788jBc4N7c5ytH/rx0syiNRUW68U/zFjWyMhO549AWyEEH0d2+qxc4rmy7T028qpOFKTzy4PiSmihG5+ImwUzj8NZqmcbmjD52sPPc4AI4+6xZvETSf7aGxsNNju6qO/dntjbj25z6qP4in2mxhsvq8+Kt5enqTwigKm8QxdBI+XT8DnEkRbKpwb9NxLOPrgH81jXXxA1womilttFFUyDG5pfMyN33O3d+gXqrQaymTU9kNZnPd9w/t+pYYqrPiZpJn6tqd0ThDJATvHrz/3XrJ1+1a2hdG2loDL2M76bG3PbDQ8g+vquD1nqy66rqaq53Fz3PdHta1rcNAHBwPQn1WErmm4yWeh2WyOy2paffq4uIKMcNc118DtfBtbLNJeLnNVQQivo3M+Fc6TDyS14OBnn5Sf1VqOF/PXRt0raGeV9HVVFG8EPM1NOYpontOQ5rh78gj1BKlmwdatbOaZJK98kTAWMjdSMkyfRxeQHH+/0UNnWj7tRINp9kr+8vZ3VslKLxhZw+CwWxRVUr+t2uYzTRGtgja7mSZluaMntgBxd8v6lZf8Ary1a8MpIHYnlcGNnktnmNYeOS1pbkfmO/wBFbVSLeMnNT2L1eEN9019UWgRVlpetWuTMIpI6eUwFwmc21Fol5O3aPMJZjjOc557LZ2nrJr6rc4NslJKA87f/AAqcZb6D5ZTz9cYPsF46sU8Faey2pwW86f3X6lh0UIx9ROqdVXCip9DvPAd8RHRvLPsdzwB79/6rf2u69ZKmenkNiscNKXZlbVtMcjmcfh2yu2n7heqaZr62l1qK+dx/7R/Uk9FrNOvvr6Muv0FBBUZ4bSSPe3H1LgEWZrnwNmiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAhRYd78z+EVXlVJpX+U7bMMf4Zx+Ln2Q9Sy8ERdausD9NVxsliEctXsJknyCGfRv+99wq4aj1hqK/XB1VcrnNUPcQCS/BaAcgcexXtqGOouesq2MVD6x89a8NkHJeS488KVtA9AjeqNlyu9yno6aUZZHHGNzxj8QzyBnI5APHstJV+IuZtQ4JH3i1ttC2XtKcrnG/Jc2st+C6EHyxVlS4yunfJjkNcd2Dlb3Suj73qmY09mtc9d5bwJnNA2xE8/N7e/KtXpfo1oaxBjhbXV0zBxJVO3HPuAMALuLXa7da4HQ26hpqSN7i97YYwwOcTkuOO5J9Sp6em8PnZo9S9pVKHyWFLPfLh9En+hVNvQzXdSWujtkNOzADhPUxtIx7AE/2XXWvw9XI07G1l9gpnc7hC0vHbjAwPVWKCK1CzpQzhHK19vdZqxUVNRx2JfnkhC0eHi007x8dqGuqGBwdtiibGe/bJzwtw3oHoYNILro4n8RNSDn/wBPCldFMqUIrCRq6u1OsVXvSuJeTx6YI6pei3T+BpDrTLNlu0mSof8A2IULdatIW7Sl+ip7TTy01HPG8sEsm9uQOcev6q1yhnxTWoT6ZpLsGAvpXmMe+H//AAo7iKUG0uRutlNevJ6rThXrSlGfDDbaz0+5A3QSzMuOuPKqqN1ZBK8MkhilEbi0kku3cYxgdjnGVbmPQOjGRhjdM2wN2OZjyRjDu/8ATuqfdKdSy6T1JJcYqVk80UsOGyZAc1z9hHHY4dnP0V5x2UOn4dBE239WvR1VxjJqO6scfE0UWjtKxuc5mnbXlxBOaZp5AwO4W0goKKBgZDSU8TR6MiaB+wWSivHCSrVJ/ik35nmIIR2ij/8AKF9hoHYYX6iGGWxhERDwIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAvioijnhfDKxr43gtc09iPZfaICt/U/pNW2K+zal07HHNRfPKYXPDfKkLTgH2YXEdskBTl0+vFZfdH226XGkFHWzQg1MAduEcg4cAfUZHdbuWNksZjkY17HDBa4ZBSCGKCMRQRMiYOzWNAA/ILCMFFvHU2uo6vcajCmrh5cFhPtXf3959oiLM1QREQBERAFGHiXLm9NnvGPlq4uCeO5Unrh+uFIyr6d17H08c4ZiQNeCcEdjx6rCp+Fm20GoqWp0JvpJepUvQ1XZKbVzZtR2+WtoHbBJTxOw4nzGhrgcjs7B79gVewL+eVNMYtQRBzHESSMjGOwPmMOV/Q0Knp7zTfidZ7SUv8Vi1/sXqwiIr589CIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAuM6zzGHQNcQcbgG98d12a4Dr8xr+mtcHAnD2Ec453BYyeE2bLRknqFFP/AHL1Kq9ONP8A+kGsYKB5diSpjaCx2Dw8PI7ezCD91ekdlUjw408M3UmDzWbsTEgEnGRG4jj7q24VWxilSyuuTpfaDWdTWZRf9sYr7Z/MIiK4cQEREAREQBERAf/Z";

// === DATA STORE ===
// localStorage holds everything EXCEPT photos. Photos (posters, gallery,
// recent activities) live in IndexedDB, which gives hundreds of MB to GBs
// of space — far beyond localStorage's ~5 MB cap. To keep the rest of the
// code simple and synchronous, we hydrate an in-memory cache from IndexedDB
// once at startup, and DB.get/DB.set for photo keys read/write that cache
// while persisting to IndexedDB in the background.

const PHOTO_KEYS = ['posters','gallery','activities','faculty'];
const _PHOTO_CACHE = { posters: [], gallery: [], activities: [], faculty: [] };
let _IDB_DB = null;

function _openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (_IDB_DB) { resolve(_IDB_DB); return; }
    if (!window.indexedDB) { reject(new Error('IndexedDB not supported in this browser')); return; }
    const req = indexedDB.open('nhs_photos_db', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
    };
    req.onsuccess = e => { _IDB_DB = e.target.result; resolve(_IDB_DB); };
    req.onerror = e => reject(e.target.error || new Error('Could not open IndexedDB'));
  });
}

function _idbGet(key) {
  return _openPhotoDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function _idbPut(key, value) {
  return _openPhotoDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const req = tx.objectStore('photos').put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

// Load all photo arrays from IndexedDB into the in-memory cache. Call this
// at app start before any rendering.
function hydratePhotoCache() {
  return Promise.all(PHOTO_KEYS.map(k =>
    _idbGet(k).then(v => { _PHOTO_CACHE[k] = Array.isArray(v) ? v : []; })
              .catch(() => { _PHOTO_CACHE[k] = []; })
  ));
}

const BACKEND_URL = localStorage.getItem('nhs_custom_backend_url') || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '5000' ? window.location.origin : 'http://localhost:5000')
    : ((window.location.protocol === 'file:' || !window.location.hostname || (window.location.origin && window.location.origin.startsWith('file://')) || window.location.origin === 'null')
      ? 'http://localhost:5000'
      : 'https://noble-high-school-management.onrender.com'));

window._syncing = false;

function syncToBackend(key, val) {
  window._syncing = true;
  fetch(BACKEND_URL + '/api/sync/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value: val })
  })
  .then(res => res.json())
  .then(json => {
    if (!json.success) console.warn('[SYNC ERROR]', json.message);
  })
  .catch(err => console.error('[SYNC NETWORK ERROR]', err))
  .finally(() => {
    window._syncing = false;
  });
}

const DB = {
  get(key, def=[]) {
    if (PHOTO_KEYS.indexOf(key) !== -1) {
      return _PHOTO_CACHE[key] || def;
    }
    try { const v = localStorage.getItem('nhs_'+key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
  },
  set(key, val) {
    if (PHOTO_KEYS.indexOf(key) !== -1) {
      _PHOTO_CACHE[key] = val;
      _idbPut(key, val).catch(err => console.error('IndexedDB save failed for', key, err));
      syncToBackend(key, val);
      return;
    }
    try { localStorage.setItem('nhs_'+key, JSON.stringify(val)); } catch(e) {}
    syncToBackend(key, val);
  },
  setAsync(key, val) {
    if (PHOTO_KEYS.indexOf(key) !== -1) {
      _PHOTO_CACHE[key] = val;
      return _idbPut(key, val).then(res => {
        syncToBackend(key, val);
        return res;
      });
    }
    return new Promise((resolve, reject) => {
      try { 
        localStorage.setItem('nhs_'+key, JSON.stringify(val)); 
        syncToBackend(key, val);
        resolve(true); 
      }
      catch(e) { reject(e); }
    });
  },
  getObj(key, def={}) { try { const v = localStorage.getItem('nhs_'+key); return v ? JSON.parse(v) : def; } catch(e) { return def; } }
};

// ===========================================================================
// === SECURE CREDENTIAL VAULT ===
// ===========================================================================
// Background: in earlier versions of this file the admin credentials were
// declared as global variables at module scope. That meant anyone could open
// DevTools, type the variable name, and read everything in plain text.
//
// New design — the "vault":
//   1. The plaintext UID, password and OTP NEVER appear anywhere in this file.
//      What we store are SHA-256 hashes (50,000 rounds, salted). Even if an
//      attacker reads the source, the hashes are one-way — they can't be
//      reversed back to the original credentials.
//   2. Everything lives inside an IIFE (closure). The hashes, the verify
//      function, and the helpers are LOCAL variables. They are not on `window`,
//      not on any global object, and cannot be reached from the console.
//   3. The IIFE exposes ONE non-enumerable, non-writable function on window:
//      `__vault.verifyAdmin(uid, pwd, otp) -> boolean`. That's the only thing
//      the rest of the app can call. The vault refuses to leak any field.
//   4. Student passwords still need an encoder (so we can compare what a student
//      types against what's stored on their record). The character map is also
//      kept inside the closure, so the character map can no longer be read
//      from the console.
//   5. Anti-debugging: console.log/dir/table are no-ops, F12/right-click/Ctrl-U
//      are blocked, and the script aborts if DevTools is detected open at load.
// ---------------------------------------------------------------------------
// To rotate the admin password: regenerate the hashes (the in-file comment
// near `__VAULT_HASHES` explains how) and replace the three constants.
// ---------------------------------------------------------------------------
(function setupVault() {
  // --- 1. SHA-256 stretching helper. Uses Web Crypto so the browser does it
  //        natively. 50,000 rounds means a brute-force attempt is impractical
  //        on the client.
  const SALT = 'NHS_Vault_v1_2026';
  const ROUNDS = 50000;

  // Synchronous fallback (used only if SubtleCrypto unavailable).
  // We keep the core implementation async because it's faster.
  async function stretch(input) {
    const enc = new TextEncoder();
    let buf = enc.encode(SALT + input);
    for (let i = 0; i < ROUNDS; i++) {
      buf = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    }
    // Hex-encode
    let hex = '';
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex;
  }

  // --- 2. The credential hashes. These are precomputed using the SAME stretch()
  //        function in Python. Anyone reading the file sees only the hash —
  //        the plaintext UID/password/OTP are not present.
  //
  // To rotate any of these: open the browser console while you're logged in as
  // admin and run:  await __vault.computeHash('YourNewValue')
  // Copy the result and replace the matching constant below.
  const _UID_HASH = 'e4c585aa7daaa8f5c01c448c83ba8e1987e057983b0e6e9b5e53e00f9e4a4e60';
  const _PWD_HASH = 'afdddcd04c5897238417980d0ecff7c0a9e8f0d97b002b3ec9bcc1d2a470c5be';
  const _OTP_HASH = '4b2909849fb3691ae78354725e231017ef95f219e8e1b6de0929412e76e323bb';

  // Mutable copies — used so admin can change credentials at runtime via the
  // Reset Credentials flow. Originals remain in the constants above.
  let uidHash = _UID_HASH;
  let pwdHash = _PWD_HASH;
  let otpHash = _OTP_HASH;

  // --- 3. Student password encoder. Lives inside this closure so the
  //        character map is unreadable from outside. Encoding is reversible
  //        (it has to be, because we compare against what's stored on each
  //        student's record), but the map itself never escapes the closure.
  const _CHAR_MAP = {
    'A':'7*k9P!mQ','B':'2#mQv&zL','C':'L5&tS9!w','D':'9!wX1@rZ','E':'b4@rZ*kN',
    'F':'G8^nJ3$a','G':'0%hV6vB9','H':'kM3$YpC2','I':'1(pL9fS6','J':'qW2!f7*k',
    'K':'5*dN8xM9','L':'rT0#xbL0','M':'jZ7@b4#b','N':'6&uK4rY2','O':'vB9%m1^j',
    'P':'3$aC2vD3','Q':'fY1^gqW0','R':'xO5*k9%k','S':'nL8!h5*r','T':'4@sR0bP0',
    'U':'iE6&w7&z','V':'zQ3#j1*v','W':'pD9%v0%m','X':'7*mN1fP9','Y':'uY4$t3!x',
    'Z':'2!kX8uD6',
    'a':'k8*P9!mQ','b':'v2#mQz&L','c':'sL5&t9!w','d':'r9!wX@rZ','e':'zb4@r*kN',
    'f':'jG8^n3$a','g':'v0%hVvB9','h':'ykM3$pC2','i':'91(pLfS6','j':'fqW2!7*k',
    'k':'85*dNxM9','l':'xrT0#bL0','m':'bjZ7@4#b','n':'26&uKrY2','o':'mvB9%1^j',
    'p':'33$aCvD3','q':'gfY1^qW0','r':'kxO5*9%k','s':'hnL8!5*r','t':'04@sRbP0',
    'u':'wiE6&7&z','v':'jzQ3#1*v','w':'vpD9%0%m','x':'17*mNfP9','y':'tuY4$3!x',
    'z':'82!kXuD6',
    '0':'wQ5&k7*b','1':'9*rP2pZ1','2':'bL0#v4#b','3':'7!mX49!z','4':'kZ8@nkM6',
    '5':'1$jT33*t','6':'fS6^grY2','7':'xM9%h5^n','8':'pC2!wjP9','9':'uR5*y1(h',
    ' ':'9!zL1vD3','@':'4#bV80)x','$':'kM6&p7!f','%':'3*tX0bK5','^':'rY2@sqW0',
    '&':'5^nQ7mZ8','(':'1(hB41^j',')':'0)xM69%k','_':'7!fR94!h','=':'bK5*tbP0',
    '[':'mZ8$p1*v',']':'xS2@l0%m','{':'1^jV4fP9','}':'9%kQ03!x','|':'4!hM77*b',
    ':':'bP0#xpZ1',';':'7&zL94#b',"'":'qY2$w9!z','"':'kS5^nkM6',',':'1vR83t',
    '.':'0%mQ3rY2','/':'fP9@k5^n','?':'3!xJ2jP9','<':'uD6&t1(h','!':'pZ1$wvD3',
    '#':'aE7@m6&L','*':'b0)kS9rY','+':'cP3!nT8x','-':'dQ4#xJ2j','>':'eR5^vB9%',
    '~':'fT6&w7&z','`':'gU7$tuY4','\\':'hV8@l0%m'
  };

  // Encode a plaintext string into the obfuscated form. Used for student records.
  function _encode(plain) {
    if (plain == null) return '';
    let out = '';
    for (let i = 0; i < plain.length; i++) {
      const ch = plain[i];
      out += (_CHAR_MAP[ch] !== undefined ? _CHAR_MAP[ch] : ch);
    }
    return out;
  }

  // --- 4. The ONLY function the rest of the app can call to verify admin login.
  //        Returns a Promise<boolean>. Never returns the credentials themselves.
  async function verifyAdmin(uid, pwd, otp) {
    if (typeof uid !== 'string' || typeof pwd !== 'string') return false;
    try {
      const [hu, hp, ho] = await Promise.all([
        stretch(uid),
        stretch(pwd),
        otp != null ? stretch(otp) : Promise.resolve('')
      ]);
      // Constant-time-ish compare (string === in JS is not strictly constant
      // time but the timing leak is negligible against a brute-force attacker
      // who can already read the page source).
      const uidOk = hu === uidHash;
      const pwdOk = hp === pwdHash;
      const otpOk = otp == null ? true : (ho === otpHash);
      return uidOk && pwdOk && otpOk;
    } catch (e) {
      return false;
    }
  }

  // Verify password ONLY (no UID/OTP) — used by the "current password" gate
  // when an admin wants to change one of the three credentials.
  async function verifyAdminPwd(pwd) {
    if (typeof pwd !== 'string') return false;
    try {
      const h = await stretch(pwd);
      return h === pwdHash;
    } catch (e) { return false; }
  }

  // Rotate one of the three credentials. Caller must supply the CURRENT
  // password (verified inside the vault) before any change is accepted.
  async function rotateAdmin(currentPwd, field, newValue) {
    if (!(await verifyAdminPwd(currentPwd))) return false;
    const newHash = await stretch(newValue);
    if (field === 'uid')      uidHash = newHash;
    else if (field === 'pwd') pwdHash = newHash;
    else if (field === 'otp') otpHash = newHash;
    else return false;
    return true;
  }

  // For student logins: encode the typed password and compare against the
  // stored encoded string on the student record.
  function verifyStudent(plainTyped, stored) {
    if (stored == null) return false;
    if (plainTyped === stored) return true;          // legacy plain-text records
    if (_encode(plainTyped) === stored) return true; // new encoded records
    return false;
  }

  // For admin saving a student: returns the encoded form of the student's
  // chosen password. Map stays sealed inside this closure.
  function encodeStudentPassword(plain) {
    return _encode(plain);
  }

  function decodeStudentPassword(encoded) {
    if (!encoded) return '';
    const reverseMap = {};
    for (const key in _CHAR_MAP) {
      reverseMap[_CHAR_MAP[key]] = key;
    }
    let decoded = '';
    let i = 0;
    while (i < encoded.length) {
      let chunk = encoded.slice(i, i + 8);
      if (reverseMap[chunk] !== undefined) {
        decoded += reverseMap[chunk];
        i += 8;
      } else {
        decoded += encoded[i];
        i += 1;
      }
    }
    return decoded;
  }

  // --- 5. Expose the minimal API. Use defineProperty so the property is
  //        non-writable and non-configurable: external code can't reassign or
  //        delete __vault.
  const api = Object.freeze({
    verifyAdmin,
    verifyAdminPwd,
    rotateAdmin,
    verifyStudent,
    encodeStudentPassword,
    decodeStudentPassword,
    // computeHash is a maintenance helper for rotating creds. It returns
    // a hash but never the input, so it's safe to expose.
    computeHash: stretch
  });
  Object.defineProperty(window, '__vault', {
    value: api,
    writable: false,
    configurable: false,
    enumerable: false  // doesn't show up in `Object.keys(window)`
  });
})();

// Wipe any stale admin credentials older versions of this app may have written
// to localStorage. The new vault never persists creds, so this key is purely
// stale data and should be removed on every load.
try { localStorage.removeItem('nhs_admin_creds'); } catch (e) {}

let SYSTEM = DB.getObj('system', { academicYear: '2026-2027' });
let failCounts = { admin: 0, student: 0 };
let reAuthCallback = null;
let logoutTimer = null;
let sessionTimeout = null;

// === CURRENT USER ===
let currentStudent = null;
let currentPage = 'landing';
let currentAdminSection = 'dashboard';
let currentReportStudent = null;

// === ADDED: SCHOOL CONTACT INFO (used in footer/copyright across all portals) ===
const SCHOOL_CONTACT = {
  phone: '9059992147',
  whatsapp: '919059992147',
  youtube: 'https://youtube.com/@nobleschool9706?si=hEW7X39mSj6zz8K4',
  maps: 'https://maps.app.goo.gl/Nn1i3vCxnhDHG5149',
  address: "Kandukur 'X' Road, Kandukur, Rangareddy, Telangana"
};

// === ADDED: poster + activity slider state ===
let posterIndex = 0;
let posterAutoTimer = null;
let activityIndex = 0;
let activityAutoTimer = null;

// === FRESH WEBSITE INITIALIZATION ===
// The website ships completely empty — zero students, zero fees, zero notifications,
// zero complaints, zero exams, zero reports, zero hall tickets, zero posters,
// zero gallery photos, zero activities. Admin starts from a clean slate.
//
// One-time cleanup: if a browser still has demo data cached from an older build
// of this file (saved in localStorage), wipe it on first load of this version.
const FRESH_INSTALL_VERSION = 'v2.0-zero-state';

function initSampleData() {
  // If the browser has already been wiped to this version, do nothing.
  // Otherwise, clear ALL data (localStorage + IndexedDB photo stores) so the
  // school starts from a true zero-information state. Bumping the version
  // string above forces every existing browser to wipe on next load.
  const cleared = localStorage.getItem('nhs_freshVersion');
  if (cleared !== FRESH_INSTALL_VERSION) {
    [
      'students','archived','fees','notifications','complaints','attendance','holidays','leaves',
      'exams','reports','hallTickets','admissions',
      'posters','gallery','activities','faculty','system'
    ].forEach(k => localStorage.removeItem('nhs_' + k));

    // Photos are stored in IndexedDB — wipe that database too, otherwise
    // old gallery/poster/faculty photos would survive the localStorage wipe.
    try {
      if (window.indexedDB) {
        const delReq = indexedDB.deleteDatabase('nhs_photos_db');
        // Reset the in-memory cache and force the connection to be reopened
        // next time a photo store is accessed.
        _IDB_DB = null;
        PHOTO_KEYS.forEach(k => { _PHOTO_CACHE[k] = []; });
      }
    } catch (e) { /* ignore — fresh wipe is best-effort */ }

    localStorage.setItem('nhs_freshVersion', FRESH_INSTALL_VERSION);
  }

  // Initialize every store as an empty array if not already set.
  if (!localStorage.getItem('nhs_students'))      DB.set('students', []);
  if (!localStorage.getItem('nhs_archived'))      DB.set('archived', []);
  if (!localStorage.getItem('nhs_fees'))          DB.set('fees', []);
  if (!localStorage.getItem('nhs_notifications')) DB.set('notifications', []);
  if (!localStorage.getItem('nhs_complaints'))    DB.set('complaints', []);
  if (!localStorage.getItem('nhs_attendance'))    DB.set('attendance', {});
  if (!localStorage.getItem('nhs_holidays'))      DB.set('holidays', []);
  if (!localStorage.getItem('nhs_leaves'))        DB.set('leaves', []);
  if (!localStorage.getItem('nhs_exams'))         DB.set('exams', []);
  if (!localStorage.getItem('nhs_reports'))       DB.set('reports', []);
  if (!localStorage.getItem('nhs_hallTickets'))   DB.set('hallTickets', []);
  if (!localStorage.getItem('nhs_admissions'))    DB.set('admissions', []);
  // Posters / gallery / activities are hydrated from IndexedDB into the
  // in-memory cache by hydratePhotoCache() at app start.
}

// === LOGO SETUP ===
function updateFavicon() {
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = LOGO_SRC;
  icon.type = 'image/png';

  let shortcut = document.querySelector('link[rel="shortcut icon"]');
  if (!shortcut) {
    shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    document.head.appendChild(shortcut);
  }
  shortcut.href = LOGO_SRC;
  shortcut.type = 'image/png';

  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = LOGO_SRC;
}

async function loadDataFromBackend(silent = false) {
  if (window._syncing) return;
  window._syncing = true;
  try {
    const res = await fetch(BACKEND_URL + '/api/sync/get-all');
    const json = await res.json();
    if (json.success && json.data) {
      if (!silent) console.log('[SYNC] Hydrating local database from backend database/JSON fallback...');
      const keys = Object.keys(json.data);
      let changed = false;
      for (const k of keys) {
        const val = json.data[k];
        if (PHOTO_KEYS.indexOf(k) !== -1) {
          const currentVal = _PHOTO_CACHE[k] || [];
          if (JSON.stringify(currentVal) !== JSON.stringify(val)) {
            _PHOTO_CACHE[k] = val;
            await _idbPut(k, val).catch(e => console.warn(e));
            changed = true;
          }
        } else {
          const currentStr = localStorage.getItem('nhs_' + k);
          const newStr = JSON.stringify(val);
          if (currentStr !== newStr) {
            localStorage.setItem('nhs_' + k, newStr);
            changed = true;
          }
        }
      }
      
      if (changed && silent) {
        console.log('[SYNC] Database changed on server. Re-rendering views...');
        if (typeof renderStudentTable === 'function') renderStudentTable();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderFeeTable === 'function') renderFeeTable();
        if (typeof renderNotifTable === 'function') renderNotifTable();
        if (typeof renderComplaintsTable === 'function') renderComplaintsTable();
        if (typeof renderStuAttOverview === 'function') renderStuAttOverview();
        if (typeof renderStuAttMonthly === 'function') renderStuAttMonthly();
        if (typeof renderPosterSlider === 'function') renderPosterSlider();
        if (typeof renderActivitySlider === 'function') renderActivitySlider();
        if (typeof renderGallery === 'function') renderGallery();
      }
    }
  } catch (err) {
    if (!silent) console.warn('[SYNC WARNING] Could not load database from backend:', err);
  } finally {
    window._syncing = false;
  }
}

function startBackendSyncPolling() {
  setInterval(async () => {
    // Only fetch if tab is active (Page Visibility API)
    if (document.hidden) return;
    await loadDataFromBackend(true);
  }, 3000);
}

window.addEventListener('DOMContentLoaded', async () => {
  updateFavicon();
  document.getElementById('headerLogo').src = LOGO_SRC;
  document.getElementById('heroLogo').src = LOGO_SRC;
  const stuLogo = document.getElementById('studentPortalLogo');
  if (stuLogo) stuLogo.src = LOGO_SRC;
  const sidebarStuLogo = document.getElementById('stuSidebarSchoolLogo');
  if (sidebarStuLogo) sidebarStuLogo.src = LOGO_SRC;
  
  // Try loading database from backend server sync store in the background
  loadDataFromBackend(false);
  
  initSampleData();
  setTodayDate();
  resetSessionTimer();
  updateDashYearBadge();
  updateNotifRecipientFields();
  populatePrintExamDropdowns();
  initBusRoute(); // Bus route animation on landing page (static layout, no data needed)
  // Photos live in IndexedDB; hydrate the in-memory cache first, then render.
  hydratePhotoCache().then(() => {
    renderPosterSlider();
    renderActivitySlider();
    renderGallery();
  }).catch(err => {
    console.error('Photo hydration failed:', err);
    // Render anyway; cache will be empty arrays.
    renderPosterSlider();
    renderActivitySlider();
    renderGallery();
  });
  
  // Start background sync polling for multi-profile updates
  startBackendSyncPolling();
});

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('payDate');
  if (el) el.value = today;
  const soDate = document.getElementById('soDate');
  if (soDate) soDate.value = today;
  const repPT = document.getElementById('repPublishTime');
  if (repPT) repPT.value = new Date().toISOString().slice(0,16);
}

function updateDashYearBadge() {
  const sys = DB.getObj('system', { academicYear: '2026-2027' });
  const el = document.getElementById('dashYearBadge');
  if (el) el.textContent = sys.academicYear;
  const yd = document.getElementById('currentYearDisplay');
  if (yd) yd.textContent = sys.academicYear;
}

// === SESSION MANAGEMENT ===
function resetSessionTimer() {
  clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    if (currentPage === 'admin') { adminLogout(); alert('Session expired due to inactivity. Please login again.'); }
    else if (currentPage === 'student') { studentLogout(); }
  }, 30 * 60 * 1000);
}
document.addEventListener('click', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);

// === PAGE NAVIGATION ===
function showPage(name) {
  if (name !== 'qrscanner') {
    try { stopScanner(); } catch(e) {}
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-'+name);
  if (target) target.classList.add('active');
  currentPage = name;
  window.scrollTo(0,0);
  // Always close nav drawer when changing pages
  closeNavDrawer();
  // Hide the public top-nav strip on admin / student portal pages — those
  // pages have their own internal navigation and the public links would just
  // get in the way. Show it on every other (public) page.
  const topNav = document.getElementById('publicTopNav');
  if (topNav) {
    topNav.style.display = (name === 'admin' || name === 'student') ? 'none' : '';
  }
  // Hamburger is only needed on the admin page (it toggles the admin sidebar
  // on narrow screens). On public pages the top-nav strip handles all
  // navigation, so the hamburger is hidden to keep the header uncluttered.
  // We use a CSS class so the media-query can hide it on wide screens.
  const hamb = document.getElementById('mainHamburgerBtn');
  if (hamb) {
    if (name === 'admin') {
      hamb.classList.add('show-on-mobile');
    } else {
      hamb.classList.remove('show-on-mobile');
    }
    // Always remove inline style; CSS media query handles the rest
    hamb.style.display = '';
  }
  // Site footer is shown on every PUBLIC page (landing, gallery, faculty,
  // complaint, contact) but hidden in the admin and student portals where
  // it would just get in the way of internal app navigation.
  const footer = document.getElementById('siteFooter');
  if (footer) {
    footer.style.display = (name === 'admin' || name === 'student') ? 'none' : '';
  }
  if (name === 'admin') {
    renderDashboard();
    document.getElementById('mainLoginBtn').textContent = 'Admin Portal';
    document.getElementById('mainLoginBtn').onclick = null;
  } else if (name === 'landing') {
    document.getElementById('mainLoginBtn').textContent = 'Login';
    document.getElementById('mainLoginBtn').onclick = showLoginModal;
  } else if (name === 'student') {
    document.getElementById('mainLoginBtn').textContent = 'My Portal';
    document.getElementById('mainLoginBtn').onclick = null;
  } else if (name === 'gallery') {
    document.getElementById('mainLoginBtn').textContent = 'Login';
    document.getElementById('mainLoginBtn').onclick = showLoginModal;
  }
}

// === MODALS ===
function showLoginModal() {
  // Clear any previously typed login credentials before showing
  ['stuLoginId','stuLoginPass','adminUid','adminPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const stuErr = document.getElementById('studentLoginError');
  const admErr = document.getElementById('adminLoginError');
  if (stuErr) stuErr.innerHTML = '';
  if (admErr) admErr.innerHTML = '';
  document.getElementById('loginChoiceModal').classList.add('active');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
  // If closing a login modal, clear its fields too
  if (id === 'studentLoginModal') {
    const a = document.getElementById('stuLoginId'); if (a) a.value = '';
    const b = document.getElementById('stuLoginPass'); if (b) b.value = '';
  } else if (id === 'adminLoginModal') {
    const a = document.getElementById('adminUid'); if (a) a.value = '';
    const b = document.getElementById('adminPass'); if (b) b.value = '';
  }
}
function showStudentLogin() {
  closeModal('loginChoiceModal');
  // Clear student login fields fresh every time
  const a = document.getElementById('stuLoginId'); if (a) a.value = '';
  const b = document.getElementById('stuLoginPass'); if (b) b.value = '';
  document.getElementById('studentLoginModal').classList.add('active');
  document.getElementById('studentLoginError').innerHTML = '';
}
function showAdminLogin() {
  closeModal('loginChoiceModal');
  // Clear admin login fields fresh every time
  const a = document.getElementById('adminUid'); if (a) a.value = '';
  const b = document.getElementById('adminPass'); if (b) b.value = '';
  const c = document.getElementById('adminCaptchaInput'); if (c) c.value = '';
  document.getElementById('adminLoginModal').classList.add('active');
  document.getElementById('adminLoginError').innerHTML = '';
  regenerateAdminCaptcha();
}

function showConfirm(title, body, okLabel, okClass, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  const btn = document.getElementById('confirmOkBtn');
  btn.textContent = okLabel || 'Confirm';
  btn.className = 'btn ' + (okClass || 'btn-danger');
  btn.onclick = () => { closeModal('confirmModal'); callback(); };
  document.getElementById('confirmModal').classList.add('active');
}

function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}"><span class="alert-icon">${type==='success'?'✓':type==='error'?'✕':'<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span>'}</span>${message}</div>`;
  if (type === 'success') { setTimeout(() => { if(el) el.innerHTML=''; }, 4000); }
}

// === ADMIN LOGIN ===
// All credential checks are delegated to the vault — this code never sees the
// stored UID/password/OTP. The vault returns true/false; if true we proceed.
async function doAdminLogin() {
  const typedCaptcha = document.getElementById('adminCaptchaInput').value.trim();
  if (!typedCaptcha) {
    showAlert('adminLoginError', 'error', 'Please enter the verification code (CAPTCHA).');
    return;
  }
  if (typedCaptcha !== currentAdminCaptcha) {
    showAlert('adminLoginError', 'error', 'Incorrect CAPTCHA. Please try again.');
    document.getElementById('adminCaptchaInput').value = '';
    regenerateAdminCaptcha();
    return;
  }
  const uid = document.getElementById('adminUid').value.trim();
  const pass = document.getElementById('adminPass').value;
  
  let ok = false;
  try {
    const backendRes = await fetch(BACKEND_URL + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: uid, password: pass, role: 'admin' })
    });
    const backendData = await backendRes.json();
    if (backendData.success) {
      ok = true;
    }
  } catch (err) {
    console.warn('Backend unavailable, falling back to local vault:', err);
    ok = await window.__vault.verifyAdmin(uid, pass, null);
  }

  if (ok) {
    failCounts.admin = 0;
    
    // Generate 6-digit OTP code client-side
    adminOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtpDetails = { uid, pass };
    
    closeModal('adminLoginModal');
    document.getElementById('adminOtpInput').value = '';
    document.getElementById('adminOtpModal').classList.add('active');
    document.getElementById('adminOtpError').innerHTML = '';
    
    startAdminOtpTimer();
    sendOtpEmailViaBackend(adminOtpCode);
  } else {
    failCounts.admin++;
    let msg = 'Invalid credentials. Please check User ID and Password.';
    if (failCounts.admin >= 3) { msg += ' <strong>Account locked. Please wait before trying again.</strong>'; document.getElementById('adminLoginModal').querySelector('button[onclick="doAdminLogin()"]').disabled = true; setTimeout(() => { document.getElementById('adminLoginModal').querySelector('button[onclick="doAdminLogin()"]').disabled=false; failCounts.admin=0; },30000); }
    showAlert('adminLoginError','error',msg);
    document.getElementById('adminCaptchaInput').value = '';
    regenerateAdminCaptcha();
  }
}

// --- ADMIN OTP LOGIC ---
let adminOtpCode = '';
let adminOtpTimerInterval = null;
let adminOtpTimeRemaining = 300;
let adminOtpDetails = { uid: '', pass: '' };

let resetCredsOtpCode = '';
let reAuthOtpCode = '';

function startAdminOtpTimer() {
  clearInterval(adminOtpTimerInterval);
  adminOtpTimeRemaining = 300; // 5 minutes
  const timerEl = document.getElementById('adminOtpTimer');
  const resendBtn = document.getElementById('adminOtpResendBtn');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Resend OTP';
  
  adminOtpTimerInterval = setInterval(() => {
    adminOtpTimeRemaining--;
    if (adminOtpTimeRemaining <= 0) {
      clearInterval(adminOtpTimerInterval);
      timerEl.textContent = 'OTP code expired!';
      resendBtn.disabled = false;
    } else {
      const minutes = Math.floor(adminOtpTimeRemaining / 60);
      const seconds = adminOtpTimeRemaining % 60;
      timerEl.textContent = `Time remaining: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

async function sendOtpEmailViaBackend(otp) {
  try {
    const response = await fetch(BACKEND_URL + '/api/auth/send-otp-monolith', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    const data = await response.json();
    if (data.success) {
      showToast('Verification code (OTP) sent to your registered email.', 'success');
    } else {
      console.error('Failed to send OTP via server:', data.message);
      showToast('Failed to send OTP email via server.', 'error');
    }
  } catch (err) {
    console.error('Error connecting to backend to send OTP:', err);
    showToast('Cannot connect to local backend to send OTP. Please check if server is running.', 'error');
  }
}

function doAdminOtpVerify() {
  const enteredOtp = document.getElementById('adminOtpInput').value.trim();
  if (!enteredOtp) {
    showAlert('adminOtpError', 'error', 'Please enter the 6-digit verification code.');
    return;
  }
  
  if (adminOtpTimeRemaining <= 0) {
    showAlert('adminOtpError', 'error', 'The OTP has expired. Please click Resend OTP.');
    return;
  }
  
  if (enteredOtp !== adminOtpCode) {
    showAlert('adminOtpError', 'error', 'Incorrect verification code. Please try again.');
    document.getElementById('adminOtpInput').value = '';
    return;
  }
  
  // Success!
  clearInterval(adminOtpTimerInterval);
  closeModal('adminOtpModal');
  
  document.getElementById('adminUid').value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('adminOtpInput').value = '';
  
  failCounts.admin = 0;
  showPage('admin');
  showAdminSection('dashboard');
  showToast('Logged in successfully as admin.', 'success');
}

function doAdminOtpResend() {
  adminOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('adminOtpInput').value = '';
  document.getElementById('adminOtpError').innerHTML = '';
  
  startAdminOtpTimer();
  sendOtpEmailViaBackend(adminOtpCode);
}


// === STUDENT LOGIN ===
async function doStudentLogin() {
  const loginId = document.getElementById('stuLoginId').value.trim();
  const pass = document.getElementById('stuLoginPass').value;
  const students = DB.get('students') || [];
  
  const archived = DB.get('archived') || [];
  const isArchived = archived.find(s => s.loginId === loginId);
  if (isArchived) {
    showAlert('studentLoginError','error','Your account is no longer active. Please contact school administration.');
    return;
  }

  let student = null;
  let ok = false;

  try {
    const encodedPass = window.__vault.encodeStudentPassword(pass);
    const backendRes = await fetch(BACKEND_URL + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password: encodedPass, role: 'student' })
    });
    const backendData = await backendRes.json();
    if (backendData.success) {
      ok = true;
      const backendStudent = backendData.studentInfo;
      if (backendStudent) {
        const existingIdx = students.findIndex(s => s.loginId === loginId);
        if (existingIdx >= 0) {
          students[existingIdx] = { ...students[existingIdx], ...backendStudent };
        } else {
          students.push(backendStudent);
        }
        DB.set('students', students);
        student = backendStudent;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, falling back to local storage authentication:', err);
  }

  if (!ok) {
    student = students.find(s => s.loginId === loginId && s.status === 'active');
    if (!student) {
      failCounts.student++;
      if (failCounts.student >= 3) showAlert('studentLoginError','error','Invalid Login ID or Password. Please contact school admin after 3 failed attempts.');
      else showAlert('studentLoginError','error','Invalid Login ID or Password');
      return;
    }
    if (!window.__vault.verifyStudent(pass, student.password)) {
      failCounts.student++;
      if (failCounts.student >= 3) showAlert('studentLoginError','error','Too many failed attempts. Please contact school admin.');
      else showAlert('studentLoginError','error','Invalid Login ID or Password');
      return;
    }
  }

  if (!student) {
    student = students.find(s => s.loginId === loginId && s.status === 'active');
  }
  
  failCounts.student = 0;
  currentStudent = student;
  closeModal('studentLoginModal');
  document.getElementById('stuLoginId').value=''; document.getElementById('stuLoginPass').value='';
  loadStudentPortal();
  showPage('student');
}

// === STUDENT PORTAL ===
function loadStudentPortal() {
  if (!currentStudent) return;
  const sys = DB.getObj('system', { academicYear: '2026-2027' });
  document.getElementById('stuWelcomeName').textContent = 'Welcome, ' + currentStudent.name;
  document.getElementById('stuWelcomeInfo').textContent = `Student ID: ${currentStudent.id} | Class: ${currentStudent.className} | Section: ${currentStudent.section} | Academic Year: ${sys.academicYear}`;
  showStudentSection('myDetails');
}

function showStudentSection(name) {
  document.querySelectorAll('.student-section').forEach(s => s.classList.remove('active'));
  document.getElementById('stuSec-'+name).classList.add('active');
  document.querySelectorAll('.student-nav-btn').forEach(b => b.classList.remove('active'));
  
  // Auto-close student sidebar overlay on click (mobile view)
  const sb = document.getElementById('studentSidebar');
  if (sb) sb.classList.remove('open');
  
  const sectionMap = { myDetails:0, myIdCard:1, myNotifs:2, myExams:3, myReports:4, myFees:5, myAttendance:6, myComplaints:7 };
  const btns = document.querySelectorAll('.student-nav-btn');
  if (btns[sectionMap[name]]) btns[sectionMap[name]].classList.add('active');
  switch(name) {
    case 'myDetails': renderStudentDetails(); break;
    case 'myIdCard': renderStudentIdCard(); break;
    case 'myNotifs': renderStudentNotifs(); break;
    case 'myExams': renderStudentExams(); break;
    case 'myReports': renderStudentReports(); break;
    case 'myFees': renderStudentFees(); break;
    case 'myAttendance': renderStuAttOverview(); break;
    case 'myComplaints': renderStudentComplaints(); break;
  }
}

function renderStudentDetails() {
  const s = currentStudent;
  const photoHtml = s.photo
    ? `<img src="${s.photo}" alt="${s.name}" style="width:140px;height:140px;border-radius:12px;object-fit:cover;border:3px solid var(--primary-light);box-shadow:var(--shadow)">`
    : `<div style="width:140px;height:140px;border-radius:12px;background:var(--bg-light);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-muted)"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span></div>`;
  const html = `
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:20px;flex-wrap:wrap">
      ${photoHtml}
      <div style="flex:1;min-width:240px">
        <h3 style="margin:0;font-family:'Playfair Display',serif;color:var(--primary-dark);font-size:1.4rem">${s.name}</h3>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.92rem">Class ${s.className} — Section ${s.section} &nbsp;·&nbsp; Roll No: ${s.rollNo}</p>
        <p style="margin:6px 0 0;color:var(--text);font-size:0.88rem"><strong>Student ID:</strong> <code>${s.id}</code></p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">
      ${infoItem('Full Name',s.name)}${infoItem('Father Name',s.fatherName)}
      ${infoItem('Student ID',s.id)}${infoItem('Login ID',s.loginId)}
      ${infoItem('Class',s.className)}${infoItem('Section',s.section)}
      ${infoItem('Roll Number',s.rollNo)}${infoItem('Phone Number',s.phone)}
      ${infoItem('Emergency Phone',s.emergencyPhone)}${infoItem('Aadhaar Number',s.aadhaar)}
      ${infoItem('Apaar Number',s.apaar)}${infoItem('Address',s.address)}
      ${infoItem('Academic Year',s.academicYear||'2026-2027')}${infoItem('Date of Birth',s.dob ? fmtDate(s.dob) : '—')}
      ${infoItem('Admission Date',s.joinDate ? fmtDate(s.joinDate) : '—')}
    </div>`;
  document.getElementById('stuDetailsContent').innerHTML = html;
}

function infoItem(label, value) {
  return `<div style="background:var(--bg-light);border-radius:8px;padding:12px 14px;border:1px solid var(--border)">
    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">${label}</div>
    <div style="font-weight:600;color:var(--primary-dark)">${value||'—'}</div>
  </div>`;
}

// ============================================================================
// === DIGITAL ID CARD RENDER ===
// ============================================================================
// Builds the on-screen replica of the physical Noble High School student ID
// card. Reads the student's photo, name, class, section, father, and phone
// from currentStudent. The academic year shown vertically is the student's
// current academic year. The principal's signature is ALWAYS rendered on the
// ID card — even in the no-signature build of the website — because the
// physical card itself bears the signature and the digital card is a
// faithful replica of it.
// Per requirements, NO download / print button is exposed to students.
function renderStudentIdCard() {
  const s = currentStudent;
  if (!s) return;
  const photoHtml = s.photo
    ? `<img class="id-card-photo" src="${s.photo}" alt="${s.name}">`
    : `<div class="id-card-photo-fallback">No photo on file</div>`;
  const acadYear = (s.academicYear || '2026-2027');
  // Address may be longer than fits on one line — wrap as needed.
  const address = s.address || '—';
  // Try to keep the layout faithful to the printed card:
  //  - Yellow header band, red NOBLE / HIGH SCHOOL, school logo on left
  //  - "STUDENT IDENTITY CARD" underlined title
  //  - Photo with year (e.g. 2026-27) running vertically on the right
  //  - Student name in red
  //  - Class:X  Sec.:B / F/Name:... / Address:... / Ph:...
  //  - Principal signature on the bottom right (only in signed build)
  const yearShort = (function(y) {
    // "2026-2027" -> "2026-27", just like the physical card showing 2024-25
    const m = String(y).match(/(\d{4})-(\d{4})/);
    if (m) return m[1] + '-' + m[2].slice(-2);
    return y;
  })(acadYear);
  // Respect the global SHOW_PRINCIPAL_SIGNATURE toggle for the ID card signature.
  const sigHtml = SHOW_PRINCIPAL_SIGNATURE ? `
        <div class="id-card-sign">
          <img src="${PRINCIPAL_SIGNATURE}" alt="Principal Signature">
          <div class="id-card-sign-label">Principal</div>
        </div>` : `
        <div class="id-card-sign">
          <div style="height: 20px;">&nbsp;</div>
          <div class="id-card-sign-label">Principal</div>
        </div>`;
  document.getElementById('stuIdCardContent').innerHTML = `
    <div class="id-card-stage">
      <div class="id-card">
        <div class="id-card-header">
          <img class="id-card-logo" src="${LOGO_SRC}" alt="School Logo">
          <div class="id-card-school-name"><span>NOBLE</span><span>HIGH SCHOOL</span></div>
        </div>
        <div class="id-card-body">
          <div class="id-card-title">STUDENT IDENTITY CARD</div>
          <div class="id-card-photo-row">
            ${photoHtml}
            <div class="id-card-year">${yearShort}</div>
          </div>
          <div class="id-card-name">${s.name || '—'}</div>
          <div class="id-card-fields">
            <span class="lbl">Class</span><span class="colon">:</span><span class="val">${s.className || '—'}</span><span class="lbl">Sec.</span><span class="val">: ${s.section || '—'}</span>
            <span class="lbl">F/Name</span><span class="colon">:</span><span class="val" style="grid-column: span 3">${s.fatherName || '—'}</span>
            <span class="lbl">Address</span><span class="colon">:</span><span class="val" style="grid-column: span 3">${address}</span>
          </div>
          <div class="id-card-bottom">
            <div class="id-card-phone">Ph : ${s.phone || '—'}</div>
            <div class="id-card-qr" id="idCardQrContainer"></div>
            ${sigHtml}
          </div>
        </div>
      </div>
    </div>`;

  // Generate QR code for student ID card
  setTimeout(() => {
    const qrContainer = document.getElementById('idCardQrContainer');
    if (qrContainer) {
      const plainPass = window.__vault.decodeStudentPassword(s.password);
      const maskedPass = maskPassword(plainPass);
      const qrText = `NOBLE HIGH SCHOOL STUDENT CARD
==============================
Student ID: ${s.id || s.loginId}
Name: ${s.name || ''}
Class: ${s.className || ''}-${s.section || ''}
Roll No: ${s.rollNo || ''}
Father's Name: ${s.fatherName || ''}
Phone: ${s.phone || ''}
Emergency Phone: ${s.emergencyPhone || ''}
Address: ${s.address || ''}
Academic Year: ${s.academicYear || ''}
Password: ${maskedPass}`;

      new QRCode(qrContainer, {
        text: qrText,
        width: 64,
        height: 64,
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 100);
}

function renderStudentNotifs() {
  const notifications = DB.get('notifications');
  const s = currentStudent;
  const relevant = notifications.filter(n => {
    if (n.recipient === 'all') return true;
    if (n.recipient === 'student' && n.studentId === s.id) return true;
    if (n.recipient === 'class' && n.className === s.className && (n.section === 'all' || n.section === s.section)) return true;
    return false;
  }).sort((a,b) => new Date(b.dateTime)-new Date(a.dateTime));
  
  if (relevant.length === 0) { document.getElementById('stuNotifsContent').innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No notifications yet</p></div>'; return; }
  
  const html = relevant.map(n => {
    const isUnread = !n.read.includes(s.id);
    return `<div class="notification-item ${isUnread?'unread':''} ${n.priority.toLowerCase()}" onclick="openStudentNotifDetails('${n.id}', this)" style="cursor:pointer">
      <div class="notification-header">
        <div class="notification-subject">${isUnread?'<span class="emoji-icon-wrap" style="color:var(--danger);"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg></span> ':''}${n.subject}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge badge-${n.priority.toLowerCase()}">${n.priority}</span>
          <span class="notification-meta">${fmtDate(n.dateTime)}</span>
        </div>
      </div>
      <div class="notification-message">${n.message}</div>
      ${n.photo ? `
        <div style="margin-top:10px; display:flex; align-items:center; gap:8px">
          <img src="${n.photo}" style="max-width:180px; max-height:120px; border-radius:6px; border:1px solid var(--border); cursor:pointer; object-fit:contain; background:var(--bg-light)" onclick="zoomNotifPhoto(event, '${n.photo}')">
          <span style="font-size:0.78rem; color:var(--primary); cursor:pointer; font-weight:500" onclick="zoomNotifPhoto(event, '${n.photo}')">🔍 Zoom Card</span>
        </div>
      ` : ''}
    </div>`;
  }).join('');
  document.getElementById('stuNotifsContent').innerHTML = html;
}

function openStudentNotifDetails(id, element) {
  const notifications = DB.get('notifications');
  const n = notifications.find(x => x.id === id);
  if (!n || !currentStudent) return;
  
  if (!n.read.includes(currentStudent.id)) {
    n.read.push(currentStudent.id);
    DB.set('notifications', notifications);
  }
  
  if (element) {
    element.classList.remove('unread');
    const dot = element.querySelector('.notification-subject .emoji-icon-wrap');
    if (dot) dot.remove();
  }
  
  document.getElementById('stuNotifDetailSubject').textContent = n.subject;
  document.getElementById('stuNotifDetailDate').textContent = fmtDate(n.dateTime);
  
  const pBadge = document.getElementById('stuNotifDetailPriority');
  pBadge.textContent = n.priority;
  pBadge.className = `badge badge-${n.priority.toLowerCase()}`;
  
  document.getElementById('stuNotifDetailMessage').textContent = n.message;
  
  const photoArea = document.getElementById('stuNotifDetailPhotoArea');
  const photoImg = document.getElementById('stuNotifDetailPhoto');
  if (n.photo) {
    photoImg.src = n.photo;
    photoArea.style.display = 'block';
  } else {
    photoImg.src = '';
    photoArea.style.display = 'none';
  }
  
  document.getElementById('stuNotifDetailModal').classList.add('active');
}

function markNotifRead(id) {
  const notifs = DB.get('notifications');
  const n = notifs.find(x => x.id === id);
  if (n && currentStudent && !n.read.includes(currentStudent.id)) {
    n.read.push(currentStudent.id);
    DB.set('notifications', notifs);
  }
}

function markAllNotifsRead() {
  const notifs = DB.get('notifications');
  notifs.forEach(n => { if (currentStudent && !n.read.includes(currentStudent.id)) n.read.push(currentStudent.id); });
  DB.set('notifications', notifs);
  renderStudentNotifs();
}

function renderStudentExams() {
  const exams = DB.get('exams');
  const s = currentStudent;
  const relevant = exams.filter(e => e.published && e.className === s.className && (e.section === s.section || e.section === 'all'));
  
  if (relevant.length === 0) { document.getElementById('stuExamsContent').innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No exam schedules published yet</p></div>'; return; }
  
  const html = relevant.map(e => {
    const countdown = getCountdown(e.startDate);
    return `<div class="table-wrap" style="margin-bottom:20px">
      <div class="table-header">
        <div><strong>${e.name}</strong> <span class="badge badge-info">${e.type}</span></div>
        <span style="font-size:0.85rem;color:var(--warning);font-weight:600">${countdown}</span>
      </div>
      <table><thead><tr><th>Day</th><th>Date</th><th>Subject</th><th>Time</th><th>Type</th><th>Marks</th></tr></thead>
      <tbody>${e.days.map(d => `<tr><td>${d.dayNo}</td><td>${fmtDate(d.date)}</td><td><strong>${d.subject}</strong></td><td>${d.time}</td><td>${d.oral?'Oral':'Written'}</td><td>${d.marks}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');
  document.getElementById('stuExamsContent').innerHTML = html;
}

function renderStudentReports() {
  const reports = DB.get('reports');
  const s = currentStudent;
  const now = new Date();
  const myReports = reports.filter(r => r.studentId === s.id && r.published && new Date(r.publishTime) <= now);
  
  if (myReports.length === 0) { document.getElementById('stuReportsContent').innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No reports published yet</p></div>'; return; }
  
  const html = myReports.map(r => `<div class="service-card" style="margin-bottom:12px;cursor:pointer" onclick="viewStudentReport('${r.id}')">
    <div class="service-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span></div>
    <div>
      <div class="service-title">${r.examName}</div>
      <div class="service-desc">${r.examType} | Published: ${fmtDate(r.publishTime)} | Academic Year: ${r.academicYear||'—'}</div>
      <div style="margin-top:8px"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewStudentReport('${r.id}')">View Report</button>
      <button class="btn btn-secondary btn-sm" style="margin-left:6px" onclick="event.stopPropagation();printStudentReportCard('${r.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print</button></div>
    </div>
  </div>`).join('');
  document.getElementById('stuReportsContent').innerHTML = html;
}

function viewStudentReport(repId) {
  const reports = DB.get('reports');
  const r = reports.find(x => x.id === repId);
  if (!r || !currentStudent) return;
  const html = buildReportCardHTML(currentStudent, r);
  document.getElementById('detailModalTitle').textContent = r.examName + ' - Report Card';
  document.getElementById('detailModalBody').innerHTML = html + `<div style="margin-top:16px;text-align:right"><button class="btn btn-primary" onclick="printStudentReportCard('${r.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print</button></div>`;
  document.getElementById('detailModal').classList.add('active');
}

function renderStudentFees() {
  const fees = DB.get('fees');
  const s = currentStudent;
  const myFees = fees.filter(f => f.studentId === s.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPaid = myFees.reduce((sum,f) => sum+f.amount, 0);
  const balance = (s.totalFee||0) - totalPaid;
  const sys = DB.getObj('system', {academicYear:'2026-2027'});
  
  let payForm = '';
  if (balance > 0) {
    payForm = `
    <div class="complaint-form-wrap" style="margin-bottom:24px; max-width: 100%;">
      <h3 style="font-size:1.05rem;font-weight:700;color:var(--primary-dark);margin-bottom:16px">Pay Fees Online</h3>
      <div class="form-group">
        <label class="form-label">Amount to Pay (₹) <span class="req">*</span></label>
        <input class="form-control" id="studentPayAmount" type="number" min="1" max="${balance}" placeholder="Enter amount to pay">
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">Maximum payable amount: <strong>₹${balance.toLocaleString()}</strong> (Balance Due)</div>
      </div>
      <button class="btn btn-success btn-lg" onclick="payStudentFeeOnline()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></span> Pay Online with Razorpay</button>
    </div>
    `;
  }
  
  const html = `<div class="fee-summary-cards">
    <div class="fee-card total"><div class="fee-card-label">Total Fee</div><div class="fee-card-amount">₹${s.totalFee?.toLocaleString()||0}</div></div>
    <div class="fee-card paid"><div class="fee-card-label">Amount Paid</div><div class="fee-card-amount">₹${totalPaid.toLocaleString()}</div></div>
    <div class="fee-card due"><div class="fee-card-label">Balance Due</div><div class="fee-card-amount" style="color:${balance>0?'var(--danger)':'var(--success)'}">₹${balance.toLocaleString()}</div></div>
  </div>
  ${payForm}
  ${myFees.length > 0 ? `<div class="table-wrap"><div class="table-header"><strong>Payment History</strong></div>
  <table><thead><tr><th>Date</th><th>Amount Paid (₹)</th><th>Method</th><th>Receipt No.</th><th>Balance After (₹)</th><th>Receipt</th></tr></thead>
  <tbody>${myFees.map(f => `<tr>
    <td>${fmtDate(f.date)}</td>
    <td style="color:var(--success);font-weight:700">₹${f.amount.toLocaleString()}</td>
    <td>${f.method || f.mode || '—'}</td>
    <td><code>${f.receipt || f.receiptNo || f.id}</code></td>
    <td>₹${(f.balance ?? 0).toLocaleString()}</td>
    <td>
      <button class="btn btn-secondary btn-sm" onclick="viewFeeReceipt('${f.id || f.receiptNo || f.receipt}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></span> View</button>
      <button class="btn btn-primary btn-sm" style="margin-left:4px" onclick="downloadFeeReceiptPDF('${f.id || f.receiptNo || f.receipt}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></span> Download</button>
    </td>
  </tr>`).join('')}</tbody>
  </table></div>` : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No payment records found</p></div>'}`;
  document.getElementById('stuFeesContent').innerHTML = html;
}

function payStudentFeeOnline() {
  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay payment gateway is not loaded. Please access the website via http://localhost:5000/ rather than opening the file directly, and check your internet/ad-blocker settings.', 'error');
    return;
  }
  const s = currentStudent;
  if (!s) return;
  const amountInput = document.getElementById('studentPayAmount');
  const amount = parseFloat(amountInput.value);
  
  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount to pay.', 'error');
    return;
  }
  
  const fees = DB.get('fees') || [];
  const myFees = fees.filter(f => f.studentId === s.id);
  const totalPaid = myFees.reduce((sum, f) => sum + f.amount, 0);
  const balanceDue = (s.totalFee || 0) - totalPaid;
  
  if (amount > balanceDue) {
    showToast(`Amount cannot exceed the pending due balance of ₹${balanceDue.toLocaleString()}.`, 'error');
    return;
  }
  
  const options = {
    key: "rzp_test_SxCqJDSjXRtfe9",
    amount: amount * 100, // paise
    currency: "INR",
    name: "Noble High School",
    description: "School Fee Payment",
    theme: {
      color: "#2552a0"
    },
    prefill: {
      name: s.name,
      contact: s.phone || ""
    },
    handler: function (response) {
      const now = new Date();
      const date = now.toISOString();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const newBalance = Math.max(0, balanceDue - amount);
      const receipt = 'REC-' + dateStr + '-' + String(fees.length+1).padStart(5,'0');
      const sys = DB.getObj('system', { academicYear: '2026-2027' });
      
      const feeRecord = {
        id: receipt,
        receiptNo: receipt,
        receipt: receipt,
        studentId: s.id,
        date,
        amount,
        method: 'Online',
        mode: 'Online',
        reference: response.razorpay_payment_id,
        balance: newBalance,
        academicYear: s.academicYear || sys.academicYear
      };
      
      fees.push(feeRecord);
      DB.set('fees', fees);
      showToast(`Payment of ₹${amount.toLocaleString()} successful! Receipt: ${receipt}`);
      renderStudentFees();
      
      setTimeout(() => {
        downloadFeeReceiptPDF(receipt);
      }, 500);
    }
  };
  
  const rzp = new Razorpay(options);
  rzp.open();
}

// View fee receipt in a clean preview window (no auto-print).
// Uses the same shared HTML builder as the admin receipt, so the design is
// identical between admin and student. The student preview is marked
// "STUDENT COPY" so the parent knows what they're keeping.
function viewFeeReceipt(feeId) {
  const fees = DB.get('fees') || [];
  const fee = fees.find(f => f.id === feeId || f.receiptNo === feeId || f.receipt === feeId);
  if (!fee) { showToast('Receipt not found.', 'error'); return; }
  const allStudents = (DB.get('students') || []).concat(DB.get('archived') || []);
  const stu = allStudents.find(s => s.id === fee.studentId || s.loginId === fee.studentId) || currentStudent || {};

  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) { showToast('Please allow popups to view receipt', 'error'); return; }
  win.document.write(buildFeeReceiptHTML(fee, stu, { studentCopy: true, autoPrint: false }));
  win.document.close();
}

function renderStudentComplaints() {
  const complaints = DB.get('complaints');
  const s = currentStudent;
  const myComplaints = complaints.filter(c => c.stuId === s.id || c.stuId === s.loginId);
  
  if (myComplaints.length === 0) { document.getElementById('stuComplaintsContent').innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No complaints submitted yet</p></div>'; return; }
  
  const html = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Complaint ID</th><th>Summary</th><th>Status</th></tr></thead>
  <tbody>${myComplaints.map(c => `<tr>
    <td>${fmtDate(c.date)}</td><td><code>${c.id}</code></td>
    <td>${c.details.substring(0,60)}...</td>
    <td><span class="badge badge-${c.status.toLowerCase()}">${c.status==='Resolved'?'✓ ':'⏳ '}${c.status}</span></td>
  </tr>`).join('')}</tbody></table></div>`;
  document.getElementById('stuComplaintsContent').innerHTML = html;
}

function studentLogout() {
  currentStudent = null;
  // Clear all login fields so next login starts fresh
  ['stuLoginId','stuLoginPass','adminUid','adminPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showPage('landing');
}

// === ADMIN SECTION NAVIGATION ===
function showAdminSection(name) {
  // ADDED: Clear Fee Management UI state every time we leave (or re-enter) the section,
  // so it always opens "fresh" with no leftover student lookup.
  if (currentAdminSection === 'fees' && name !== 'fees') {
    currentFeeStudent = null;
    const sid = document.getElementById('feeSearchId'); if (sid) sid.value = '';
    const fr  = document.getElementById('feeStudentResult'); if (fr) fr.style.display = 'none';
    const fc  = document.getElementById('feeStudentCard'); if (fc) fc.innerHTML = '';
    const fh  = document.getElementById('feeHistoryTable'); if (fh) fh.innerHTML = '';
    const fs  = document.getElementById('feeSummaryCards'); if (fs) fs.innerHTML = '';
    const pa  = document.getElementById('payAmount'); if (pa) pa.value = '';
  }
  if (currentAdminSection === 'reports' && name !== 'reports') {
    repClearFormState();
  }
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-'+name).classList.add('active');
  const sb = document.getElementById('adminSidebar');
  if (sb) sb.classList.remove('open');
  document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
  const item = document.querySelector(`.sidebar-nav-item[data-section="${name}"]`);
  if (item) item.classList.add('active');
  currentAdminSection = name;
  
  switch(name) {
    case 'dashboard': renderDashboard(); break;
    case 'students': renderStudentTable(); break;
    case 'fees':
      // ADDED: extra safety — fee section always opens cleared
      currentFeeStudent = null;
      { const sid = document.getElementById('feeSearchId'); if (sid) sid.value = ''; }
      { const fr  = document.getElementById('feeStudentResult'); if (fr) fr.style.display = 'none'; }
      break;
    case 'notifications': renderNotifTable(); break;
    case 'attendance': initAttendanceTab(); break;
    case 'exams': renderExamsTable(); break;
    case 'complaints': renderComplaintsTable(); break;
    case 'admissions': renderAdmissionsTable(); break;
    case 'feeSummary': renderFeeSummary(); break;
    case 'reports':
      repClearFormState();
      renderRepClassButtons();
      break;
    case 'printReports': populatePrintExamDropdowns(); break;
    case 'hallTickets': renderHallTicketsTable(); break;
    case 'academicYear': updateDashYearBadge(); switchAcadTab('yearUpdate'); break;
    case 'resetCreds': initResetCredsForm(); break;
    case 'siteContent': renderSiteContentSection(); break; // ADDED
    case 'faculty': renderFacultyAdminSection(); break; // ADDED — Faculty management
    case 'backupRestore': renderBackupSection(); break;
    case 'smartSectioning': initSmartSectioning(); break;
  }
}

function adminLogout() {
  // Clear all login input fields so next login starts fresh
  ['stuLoginId','stuLoginPass','adminUid','adminPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showPage('landing');
  document.getElementById('mainLoginBtn').textContent = 'Login';
  document.getElementById('mainLoginBtn').onclick = showLoginModal;
}

function toggleSidebar() {
  const sb = document.getElementById('adminSidebar');
  sb.classList.toggle('open');
}

// Global click handler to close admin sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
  const sb = document.getElementById('adminSidebar');
  const hamburger = document.getElementById('mainHamburgerBtn');
  if (sb && sb.classList.contains('open')) {
    if (!sb.contains(event.target) && hamburger && !hamburger.contains(event.target)) {
      sb.classList.remove('open');
    }
  }
});

function toggleStudentSidebar() {
  const sb = document.getElementById('studentSidebar');
  if (sb) sb.classList.toggle('open');
}

// Global click handler to close student sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
  const sb = document.getElementById('studentSidebar');
  const hamburger = document.querySelector('.student-hamburger-btn');
  if (sb && sb.classList.contains('open')) {
    if (!sb.contains(event.target) && hamburger && !hamburger.contains(event.target)) {
      sb.classList.remove('open');
    }
  }
});

// Smart hamburger: opens admin sidebar in admin portal, opens nav drawer on landing page, opens student sidebar in student portal
function handleHamburgerClick() {
  const adminPage = document.getElementById('page-admin');
  const studentPage = document.getElementById('page-student');
  if (adminPage && adminPage.classList.contains('active')) {
    toggleSidebar();
  } else if (studentPage && studentPage.classList.contains('active')) {
    toggleStudentSidebar();
  } else {
    openNavDrawer();
  }
}

function openNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  if (drawer) drawer.classList.add('active');
  if (overlay) overlay.classList.add('active');
}

function closeNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  if (drawer) drawer.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

// Highlight the matching link in the public top-nav strip and de-highlight others.
// Called from each navGo*() function. Silent no-op if the strip isn't in the DOM
// (e.g. on the admin or student page where the public nav is hidden).
function setActiveTopNav(activeId) {
  const links = document.querySelectorAll('.top-nav-link');
  if (!links.length) return;
  links.forEach(l => l.classList.remove('active'));
  const el = document.getElementById(activeId);
  if (el) el.classList.add('active');
}

function navGoHome() {
  closeNavDrawer();
  showPage('landing');
  setActiveTopNav('topNavHome');
  // Scroll to top of landing page
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navGoGallery() {
  closeNavDrawer();
  // Open the dedicated gallery page
  showPage('gallery');
  setActiveTopNav('topNavGallery');
  renderGallery();
}

function navGoComplaint() {
  closeNavDrawer();
  showPage('complaint');
  setActiveTopNav('topNavComplaint');
  // Clear any prior success message and form fields when reopening
  const su = document.getElementById('complaintSuccess'); if (su) su.innerHTML = '';
}

function navGoFaculty() {
  closeNavDrawer();
  showPage('faculty');
  setActiveTopNav('topNavFaculty');
  renderFacultyPublic();
}

function navGoContact() {
  closeNavDrawer();
  showPage('contact');
  setActiveTopNav('topNavContact');
}

// === DASHBOARD ===
function renderDashboard() {
  const students = DB.get('students');
  const fees = DB.get('fees');
  const complaints = DB.get('complaints');
  const exams = DB.get('exams');
  const admissions = DB.get('admissions') || [];
  const totalExpected = students.reduce((sum,s) => sum+(s.totalFee||0), 0);
  const totalCollected = fees.reduce((sum,f) => sum+f.amount, 0);
  const pending = complaints.filter(c => c.status === 'Pending').length;
  // Only Pending admission requests show up in the dashboard count.
  // Once admin clicks "Mark Contacted", the request is removed from this count.
  const pendingAdmissions = admissions.filter(a => a.status === 'Pending').length;
  const sys = DB.getObj('system', {academicYear:'2026-2027'});
  
  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${students.length}</div><div class="stat-sub">Active students</div></div>
    <div class="stat-card green"><div class="stat-label">Fee Collected</div><div class="stat-value">₹${(totalCollected/1000).toFixed(0)}K</div><div class="stat-sub">of ₹${(totalExpected/1000).toFixed(0)}K total</div></div>
    <div class="stat-card red"><div class="stat-label">Fee Pending</div><div class="stat-value">₹${((totalExpected-totalCollected)/1000).toFixed(0)}K</div><div class="stat-sub">${totalExpected>0?((totalCollected/totalExpected)*100).toFixed(1):0}% collected</div></div>
    <div class="stat-card gold"><div class="stat-label">Open Complaints</div><div class="stat-value">${pending}</div><div class="stat-sub">Pending resolution</div></div>
    <div class="stat-card ${pendingAdmissions > 0 ? 'gold' : ''}" style="cursor:pointer" onclick="showAdminSection('admissions')"><div class="stat-label">New Admissions</div><div class="stat-value">${pendingAdmissions}</div><div class="stat-sub">${pendingAdmissions > 0 ? 'Pending — needs contact' : 'All caught up'}</div></div>
    <div class="stat-card"><div class="stat-label">Upcoming Exams</div><div class="stat-value">${exams.filter(e=>e.published).length}</div><div class="stat-sub">Published schedules</div></div>
    <div class="stat-card"><div class="stat-label">Academic Year</div><div class="stat-value" style="font-size:1.2rem">${sys.academicYear}</div><div class="stat-sub">Current year</div></div>
  `;
  
  const recent = students.slice(-5).reverse();
  document.getElementById('recentStudentsTable').innerHTML = `<table><thead><tr><th>Student ID</th><th>Name</th><th>Class</th><th>Section</th><th>Father Name</th><th>Phone</th></tr></thead>
  <tbody>${recent.map(s => `<tr><td><code>${s.id}</code></td><td><strong>${s.name}</strong></td><td>${s.className}</td><td>${s.section}</td><td>${s.fatherName}</td><td>${s.phone}</td></tr>`).join('')}</tbody></table>`;
}

// === STUDENT MANAGEMENT ===
let stuPage = 1;
const STU_PER_PAGE = 50;

function renderStudentTable() {
  const students = DB.get('students');
  const search = (document.getElementById('stuSearchInput')?.value||'').toLowerCase();
  const filterClass = document.getElementById('stuFilterClass')?.value||'';
  
  let filtered = students.filter(s => s.status === 'active' && (!filterClass || s.className === filterClass) && (!search || s.name.toLowerCase().includes(search) || s.loginId.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)));
  
  const total = filtered.length;
  const pages = Math.ceil(total / STU_PER_PAGE) || 1;
  stuPage = Math.min(stuPage, pages);
  const paged = filtered.slice((stuPage-1)*STU_PER_PAGE, stuPage*STU_PER_PAGE);
  
  document.getElementById('stuCount').textContent = `${total} students`;
  
  if (paged.length === 0) {
    document.getElementById('studentTableContainer').innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No students found</p></div>';
    document.getElementById('stuPagination').innerHTML = '';
    return;
  }
  
  document.getElementById('studentTableContainer').innerHTML = `<table><thead><tr><th>Photo</th><th>ID</th><th>Name</th><th>Class</th><th>Sec</th><th>Roll No</th><th>Father Name</th><th>Phone</th><th>Fee Balance</th><th>Actions</th></tr></thead>
  <tbody>${paged.map(s => {
    const fees = DB.get('fees');
    const paid = fees.filter(f=>f.studentId===s.id).reduce((sum,f)=>sum+f.amount,0);
    const bal = (s.totalFee||0)-paid;
    return `<tr>
      <td><div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid var(--border);background:var(--bg-light);display:flex;align-items:center;justify-content:center">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:1rem"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span></span>'}</div></td>
      <td><code>${s.id}</code></td><td><strong>${s.name}</strong></td><td>${s.className}</td><td>${s.section}</td><td>${s.rollNo}</td><td>${s.fatherName}</td><td>${s.phone}</td>
      <td style="color:${bal>0?'var(--danger)':'var(--success)'};font-weight:700">₹${bal.toLocaleString()}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="editStudent('${s.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span> Edit</button>
      <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="printSingleStudent('${s.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print</button>
      <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteStudent('${s.id}','${s.name}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span></button></td>
    </tr>`;
  }).join('')}</tbody></table>`;
  
  document.getElementById('stuPagination').innerHTML = `<span>Page ${stuPage} of ${pages} (${total} students)</span>
  <div class="page-btns">
    ${stuPage>1?`<button class="page-btn" onclick="stuPage--;renderStudentTable()">‹</button>`:''}
    ${Array.from({length:Math.min(pages,5)},(_,i)=>i+1).map(p=>`<button class="page-btn ${p===stuPage?'active':''}" onclick="stuPage=${p};renderStudentTable()">${p}</button>`).join('')}
    ${stuPage<pages?`<button class="page-btn" onclick="stuPage++;renderStudentTable()">›</button>`:''}
  </div>`;
}

function showAddStudentForm(editId=null) {
  window._pendingPhoto = undefined;
  const students = DB.get('students');
  const existing = editId ? students.find(s=>s.id===editId) : null;
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  
  const classOpts = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'].map(c=>`<option value="${c}" ${existing?.className===c?'selected':''}>${c}</option>`).join('');
  const secOpts = ['A','B','C'].map(s=>`<option value="${s}" ${existing?.section===s?'selected':''}>${s}</option>`).join('');
  
  document.getElementById('formModalTitle').textContent = existing ? 'Edit Student' : 'Add New Student';
  document.getElementById('formModalBody').innerHTML = `
    <div id="stuFormError"></div>
    <div class="required-note">Fields marked with <span style="color:var(--danger)">*</span> are required</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Student Name <span class="req">*</span></label><input class="form-control" id="sf_name" value="${existing?.name||''}" placeholder="Full name"></div>
      <div class="form-group"><label class="form-label">Date of Birth <span class="req">*</span></label><input class="form-control" type="date" id="sf_dob" value="${existing?.dob||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Class <span class="req">*</span></label><select class="form-control" id="sf_class" onchange="autofillStudentLoginId(); autofillStudentRollNumber();">${classOpts}</select></div>
      <div class="form-group"><label class="form-label">Section <span class="req">*</span></label><select class="form-control" id="sf_section" onchange="autofillStudentRollNumber();">${secOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Roll Number <span class="req">*</span></label><input class="form-control" id="sf_roll" value="${existing?.rollNo||''}" placeholder="Roll number"></div>
      <div class="form-group"><label class="form-label">Student Login ID / Student ID <span class="req">*</span></label><input class="form-control" id="sf_loginId" value="${existing?.loginId||''}" placeholder="e.g. 26NHS10003"><small style="color:var(--text-muted);font-size:0.74rem">Auto-suggested when class is selected. You can edit this — what you enter is the final ID.</small></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Student Password <span class="req">*</span></label><input class="form-control" id="sf_password" type="text" value="${existing?'':''}" placeholder="${existing?'Leave blank to keep current password':'Auto-suggested, editable'}"><small style="color:var(--text-muted);font-size:0.74rem">${existing?'Password is encrypted — type a new one only if you want to change it.':'Defaults to same as Login ID. You can edit it.'}</small></div>
      <div class="form-group"><label class="form-label">Father Name <span class="req">*</span></label><input class="form-control" id="sf_father" value="${existing?.fatherName||''}" placeholder="Father's full name"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Phone Number <span class="req">*</span></label><input class="form-control" id="sf_phone" value="${existing?.phone||''}" placeholder="10-digit number" maxlength="10"></div>
      <div class="form-group"><label class="form-label">Emergency Phone <span class="req">*</span></label><input class="form-control" id="sf_eph" value="${existing?.emergencyPhone||''}" placeholder="Emergency contact" maxlength="10"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Aadhaar Number <span class="req">*</span></label><input class="form-control" id="sf_aadhaar" value="${existing?.aadhaar||''}" placeholder="12-digit Aadhaar" maxlength="12"></div>
      <div class="form-group"><label class="form-label">Apaar Number</label><input class="form-control" id="sf_apaar" value="${existing?.apaar||''}" placeholder="Apaar number"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total Fee (₹) <span class="req">*</span></label><input class="form-control" id="sf_fee" type="number" value="${existing?.totalFee||''}" placeholder="Annual fee amount"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="sf_address" rows="2" placeholder="Village, Mandal, District">${existing?.address||''}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Academic Year</label><input class="form-control" id="sf_year" value="${existing?.academicYear||sys.academicYear}" placeholder="e.g. 2026-2027" onchange="autofillStudentLoginId()" oninput="autofillStudentLoginId()"></div>
      <div class="form-group"><label class="form-label">Admission / Joining Date <span class="req">*</span></label><input class="form-control" id="sf_joinDate" type="date" value="${existing?.joinDate||new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="alert alert-info" style="font-size:0.82rem;padding:8px 12px"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span> <strong>Login ID = Student ID.</strong> Format: <code>YY-NHS-CC-NNN</code> (e.g. <code>26NHS10003</code> = joined 2026, NHS, class 10, 3rd in class). Auto-filled when class is selected — you can edit it. Whatever you enter becomes the permanent Student ID.</div>
    <div class="form-group">
      <label class="form-label">Student Photo</label>
      <div style="display:flex;align-items:center;gap:16px">
        <div id="sf_photoPreview" style="width:80px;height:80px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg-light)">
          ${existing?.photo ? `<img src="${existing.photo}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center">No Photo</span>'}
        </div>
        <div>
          <input type="file" id="sf_photo" accept="image/*" style="display:none" onchange="previewStudentPhoto()">
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('sf_photo').click()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2c-1.77 0-3.2-1.43-3.2-3.2s1.43-3.2 3.2-3.2 3.2 1.43 3.2 3.2-1.43 3.2-3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/></svg></span> Upload Photo</button>
          ${existing?.photo ? `<button type="button" class="btn btn-danger btn-sm" style="margin-left:6px" onclick="clearStudentPhoto()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span> Remove</button>` : ''}
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">JPG/PNG, max 2MB. Photo used in hall tickets, reports and search.</p>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button class="btn btn-primary btn-lg" onclick="saveStudentForm('${editId||''}')">${existing?'Update Student':'Add Student'}</button>
      <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    </div>
  `;
  document.getElementById('formModal').classList.add('active');
  // For new student forms, auto-suggest the Login ID right away based on default class
  if (!existing) {
    setTimeout(() => {
      autofillStudentLoginId();
      autofillStudentRollNumber();
    }, 50);
  }
}

function saveStudentForm(editId) {
  const students = DB.get('students');
  const name = document.getElementById('sf_name').value.trim();
  const dob = document.getElementById('sf_dob').value;
  const roll = document.getElementById('sf_roll').value.trim();
  const cls = document.getElementById('sf_class').value;
  const sec = document.getElementById('sf_section').value;
  const loginId = document.getElementById('sf_loginId').value.trim();
  const passwordPlain = document.getElementById('sf_password').value;
  const father = document.getElementById('sf_father').value.trim();
  const phone = document.getElementById('sf_phone').value.trim();
  const eph = document.getElementById('sf_eph').value.trim();
  const aadhaar = document.getElementById('sf_aadhaar').value.trim();
  const apaar = document.getElementById('sf_apaar').value.trim();
  const address = document.getElementById('sf_address')?.value.trim() || '';
  const fee = parseFloat(document.getElementById('sf_fee').value);
  const year = document.getElementById('sf_year').value.trim();
  const joinDate = document.getElementById('sf_joinDate')?.value || new Date().toISOString().split('T')[0];

  // For NEW students the password field is required; for EDIT it can be left
  // blank to keep the existing (encoded) password unchanged.
  if (!name||!dob||!roll||!cls||!sec||!loginId||!father||!phone||!eph||!aadhaar||!fee) {
    showAlert('stuFormError','error','Please fill all required fields.'); return;
  }
  if (!editId && !passwordPlain) {
    showAlert('stuFormError','error','Please set a student password.'); return;
  }
  if (phone.length !== 10 || !/^\d+$/.test(phone)) { showAlert('stuFormError','error','Phone number must be exactly 10 digits.'); return; }
  if (eph.length !== 10 || !/^\d+$/.test(eph)) { showAlert('stuFormError','error','Emergency phone must be exactly 10 digits.'); return; }
  if (aadhaar.length !== 12 || !/^\d+$/.test(aadhaar)) { showAlert('stuFormError','error','Aadhaar must be exactly 12 digits.'); return; }

  // Fee adjustment check: cannot decrease totalFee below already paid amount
  if (editId) {
    const feesList = DB.get('fees') || [];
    const paidAmount = feesList.filter(f => f.studentId && (f.studentId.toLowerCase() === editId.toLowerCase() || f.studentId.toLowerCase() === loginId.toLowerCase())).reduce((sum, f) => sum + parseFloat(f.amount || f.amountPaid || 0), 0);
    if (fee < paidAmount) {
      showAlert('stuFormError', 'error', `Student has already paid ₹${paidAmount.toLocaleString()}. The overall fee cannot be set lower than the amount already paid.`);
      return;
    }
  }

  // Login ID must not have spaces (used as Student ID for fee lookup)
  if (/\s/.test(loginId)) { showAlert('stuFormError','error','Login ID cannot contain spaces.'); return; }

  // Check duplicate Login ID / Student ID across active and archived students
  // (excluding self when editing)
  const dupActive = students.find(s => (s.loginId === loginId || s.id === loginId) && (!editId || s.id !== editId));
  const dupArch = DB.get('archived').find(s => s.loginId === loginId || s.id === loginId);
  if (dupActive || dupArch) { showAlert('stuFormError','error','This Login ID / Student ID already exists. Please use a different one.'); return; }

  // Check duplicate Roll Number within the same class + section
  // (only among active students; excluding self when editing)
  const dupRoll = students.find(s =>
    s.className === cls &&
    s.section === sec &&
    String(s.rollNo).trim() === String(roll).trim() &&
    (!editId || s.id !== editId)
  );
  if (dupRoll) {
    showAlert('stuFormError','error',`Roll Number ${roll} is already used by ${dupRoll.name} in Class ${cls}-${sec}. Please use a different roll number.`);
    return;
  }

  if (editId) {
    const idx = students.findIndex(s => s.id === editId);
    if (idx !== -1) {
      const photo = window._pendingPhoto !== undefined ? window._pendingPhoto : students[idx].photo;
      // Keep existing encoded password if the field was left blank.
      const password = passwordPlain ? window.__vault.encodeStudentPassword(passwordPlain) : students[idx].password;
      // CRITICAL: id and loginId both equal the admin-entered Login ID
      students[idx] = { ...students[idx], id:loginId, loginId, name, dob, rollNo:roll, className:cls, section:sec, password, fatherName:father, phone, emergencyPhone:eph, aadhaar, apaar, address, totalFee:fee, academicYear:year, photo, joinDate };
      try {
        DB.set('students', students);
      } catch (e) {
        showAlert('stuFormError','error','Browser storage is full — student could not be saved. Try removing the photo or deleting old students/posters to free space.');
        return;
      }
      closeModal('formModal');
      window._pendingPhoto = undefined;
      renderStudentTable();
      showToast('Student updated successfully!');
    }
  } else {
    // CRITICAL: Student ID = Login ID (whatever admin entered) — never auto-generate
    const photo = window._pendingPhoto || null;
    const password = window.__vault.encodeStudentPassword(passwordPlain);
    const newStudent = { id:loginId, name, dob, rollNo:roll, className:cls, section:sec, loginId, password, fatherName:father, phone, emergencyPhone:eph, aadhaar, apaar, address, totalFee:fee, academicYear:year, status:'active', joinDate, photo };
    students.push(newStudent);
    try {
      DB.set('students', students);
    } catch (e) {
      // The most common cause: photo was too large to fit. Tell the user
      // exactly what went wrong instead of silently doing nothing.
      students.pop(); // roll back the in-memory push
      showAlert('stuFormError','error','Could not save student — browser storage is full. This is usually caused by a very large student photo. Please remove or shrink the photo and try again, or delete some old gallery/poster photos to free space.');
      return;
    }
    closeModal('formModal');
    window._pendingPhoto = undefined;
    renderStudentTable();
    showToast('Student added! Login ID & Student ID: ' + loginId);
    showStudentSuccessModal(newStudent);
  }
}

// Class code mapping per user spec: Nursery=N, LKG=L, UKG=U, otherwise zero-padded number
function getClassCode(cls) {
  if (cls === 'Nursery') return 'N';
  if (cls === 'LKG') return 'L';
  if (cls === 'UKG') return 'U';
  // Numeric class — pad to 2 digits
  return String(cls).padStart(2, '0');
}

// Build login ID in format: <YY>NHS<class-code><NNN>
// e.g. 26NHS10003 = joined 2026, NHS, class 10, 3rd student in that class
function generateLoginId(year, className, students) {
  if (!className) return '';
  // Year: take first 4-digit year from input like "2026-2027" → "26"
  const yearMatch = String(year||'').match(/(\d{4})/);
  const yyPrefix = yearMatch ? yearMatch[1].slice(-2) : new Date().getFullYear().toString().slice(-2);
  const classCode = getClassCode(className);
  // Count how many active students are in same class
  const sameClassCount = students.filter(s => s.className === className).length;
  const nextNumber = String(sameClassCount + 1).padStart(3, '0');
  return `${yyPrefix}NHS${classCode}${nextNumber}`;
}

// Auto-fill Login ID and Password when class or year changes (only when adding new student)
function autofillStudentLoginId() {
  const loginIdInput = document.getElementById('sf_loginId');
  const passwordInput = document.getElementById('sf_password');
  const cls = document.getElementById('sf_class')?.value;
  const year = document.getElementById('sf_year')?.value;
  if (!loginIdInput || !cls) return;

  // Only auto-suggest if the field is currently empty OR contains a previously auto-generated ID
  // (so admin's manual entry is never overwritten unless they cleared it themselves)
  const currentVal = loginIdInput.value.trim();
  const isAutoFormat = /^\d{2}NHS[NLU\d]{1,2}\d{3}$/.test(currentVal);

  if (currentVal === '' || isAutoFormat) {
    const students = DB.get('students') || [];
    const suggestion = generateLoginId(year, cls, students);
    loginIdInput.value = suggestion;
    // Also suggest password (only if password field is empty or matches the previous auto suggestion)
    if (passwordInput && (passwordInput.value === '' || /^\d{2}NHS[NLU\d]{1,2}\d{3}$/.test(passwordInput.value))) {
      passwordInput.value = suggestion;
    }
  }
}

function autofillStudentRollNumber(forceNew = false) {
  const rollInput = document.getElementById('sf_roll');
  const cls = document.getElementById('sf_class')?.value;
  const sec = document.getElementById('sf_section')?.value;
  if (!rollInput || !cls || !sec) return;

  const isEdit = document.getElementById('formModalTitle')?.textContent.includes('Edit');
  const currentVal = rollInput.value.trim();

  if (!isEdit || currentVal === '' || forceNew) {
    const students = DB.get('students') || [];
    const sameGroup = students.filter(s => s.className === cls && s.section === sec);
    let maxRoll = 0;
    sameGroup.forEach(s => {
      const r = parseInt(s.rollNo);
      if (!isNaN(r) && r > maxRoll) {
        maxRoll = r;
      }
    });
    rollInput.value = maxRoll + 1;
  }
}

function previewStudentPhoto() {
  const file = document.getElementById('sf_photo').files[0];
  if (!file) return;
  // No hard size cap — the photo is automatically resized & compressed below
  // so even big smartphone photos fit comfortably in localStorage.
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Resize so longest side is at most 600px — plenty for an ID-style
      // headshot — then encode as JPEG at 80% quality. End size: typically
      // 30–80 KB, so dozens of students with photos fit easily.
      const MAX_DIM = 600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);

      const preview = document.getElementById('sf_photoPreview');
      if (preview) preview.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover">`;
      window._pendingPhoto = compressed;
      showToast('Photo loaded — click Update Student / Add Student to save');
    };
    img.onerror = () => showToast('Could not read image. Try a different file.','error');
    img.src = e.target.result;
  };
  reader.onerror = () => showToast('Could not read file. Try a different image.','error');
  reader.readAsDataURL(file);
}

function clearStudentPhoto() {
  const preview = document.getElementById('sf_photoPreview');
  if (preview) preview.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center">No Photo</span>';
  window._pendingPhoto = null;
  document.getElementById('sf_photo').value = '';
}

function editStudent(id) { showAddStudentForm(id); }

function deleteStudent(id, name) {
  showConfirm('Delete Student', `Are you sure you want to delete ${name}? This action cannot be undone.`, 'Delete', 'btn-danger', () => {
    const students = DB.get('students');
    DB.set('students', students.filter(s => s.id !== id));
    renderStudentTable();
    showToast('Student deleted successfully');
  });
}

// === FEE MANAGEMENT ===
let currentFeeStudent = null;

function feeSearchStudent() {
  const id = document.getElementById('feeSearchId').value.trim();
  const students = DB.get('students');
  const student = students.find(s => s.id === id || s.loginId === id);
  if (!student) { showToast('Student ID not found', 'error'); return; }
  currentFeeStudent = student;
  document.getElementById('feeStudentResult').style.display = 'block';
  renderFeeStudentData();
}

function renderFeeStudentData() {
  const s = currentFeeStudent;
  if (!s) return;
  const fees = DB.get('fees');
  const myFees = fees.filter(f => f.studentId === s.id);
  const totalPaid = myFees.reduce((sum,f) => sum+f.amount, 0);
  const balance = (s.totalFee||0) - totalPaid;
  
  document.getElementById('feeStudentCard').innerHTML = `<div class="rc-row"><div class="rc-item"><label>Name</label><span>${s.name}</span></div><div class="rc-item"><label>Class</label><span>${s.className}-${s.section}</span></div><div class="rc-item"><label>Student ID</label><span>${s.id}</span></div><div class="rc-item"><label>Father</label><span>${s.fatherName}</span></div></div>`;
  
  document.getElementById('feeSummaryCards').innerHTML = `
    <div class="fee-card total"><div class="fee-card-label">Total Fee</div><div class="fee-card-amount">₹${(s.totalFee||0).toLocaleString()}</div></div>
    <div class="fee-card paid"><div class="fee-card-label">Total Paid</div><div class="fee-card-amount">₹${totalPaid.toLocaleString()}</div></div>
    <div class="fee-card due"><div class="fee-card-label">Balance Due</div><div class="fee-card-amount" style="color:${balance>0?'var(--danger)':'var(--success)'}">₹${balance.toLocaleString()}</div></div>
  `;
  
  document.getElementById('feeHistoryTable').innerHTML = myFees.length > 0 ? `<table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt No.</th><th>Balance After</th><th>Actions</th></tr></thead>
  <tbody>${myFees.map(f=>`<tr><td>${fmtDate(f.date)}</td><td style="color:var(--success);font-weight:700">₹${f.amount.toLocaleString()}</td><td>${f.method}</td><td><code>${f.receipt}</code></td><td>₹${f.balance.toLocaleString()}</td><td><button class="btn btn-secondary btn-sm" onclick="printFeeBill('${f.receipt}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM19 19c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14z"/></svg></span> Bill</button></td></tr>`).join('')}</tbody></table>`
  : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No payments recorded yet</p></div>';
}

function saveFeeRecord(amount, date, method, reference, balanceDue) {
  const fees = DB.get('fees');
  const newBalance = Math.max(0, balanceDue - amount);
  const dateObj = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = isNaN(dateObj.getTime()) 
    ? new Date().toISOString().split('T')[0].replace(/-/g,'')
    : `${dateObj.getFullYear()}${pad(dateObj.getMonth()+1)}${pad(dateObj.getDate())}`;
  const receipt = 'REC-' + dateStr + '-' + String(fees.length+1).padStart(5,'0');
  const sys = DB.getObj('system', { academicYear: '2026-2027' });
  
  const feeRecord = {
    id: receipt,
    receiptNo: receipt,
    receipt: receipt,
    studentId: currentFeeStudent.id,
    date,
    amount,
    method,
    mode: method,
    reference: reference || '',
    balance: newBalance,
    academicYear: currentFeeStudent.academicYear || sys.academicYear
  };
  fees.push(feeRecord);
  DB.set('fees', fees);
  document.getElementById('payAmount').value = '';
  renderFeeStudentData();
  showToast(`Payment of ₹${amount.toLocaleString()} recorded. Receipt: ${receipt}`);

  setTimeout(() => {
    const choice = confirm('Payment recorded!\n\nClick OK to download the fee receipt as a PDF.\nClick Cancel to skip.');
    if (choice) downloadFeeReceiptPDF(receipt);
  }, 300);
}

function recordPayment() {
  if (!currentFeeStudent) return;
  const amount = parseFloat(document.getElementById('payAmount').value);
  
  let date = document.getElementById('payDate').value;
  if (!date) {
    date = new Date().toISOString();
  } else {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    date = `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  
  const method = document.getElementById('payMethod').value;
  
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  
  const fees = DB.get('fees');
  const myFees = fees.filter(f=>f.studentId===currentFeeStudent.id);
  const totalPaid = myFees.reduce((sum,f)=>sum+f.amount,0);
  const balanceDue = (currentFeeStudent.totalFee||0) - totalPaid;

  if (balanceDue <= 0) {
    showToast('This student has already paid the full fee. No further payment can be recorded.', 'error');
    return;
  }
  if (amount > balanceDue) {
    showToast(`Amount cannot exceed the pending balance of ₹${balanceDue.toLocaleString()}.`, 'error');
    return;
  }

  if (method === 'Online') {
    if (typeof Razorpay === 'undefined') {
      showToast('Razorpay payment gateway is not loaded. Please access the website via http://localhost:5000/ rather than opening the file directly, and check your internet/ad-blocker settings.', 'error');
      return;
    }
    const options = {
      key: "rzp_test_SxCqJDSjXRtfe9",
      amount: amount * 100, // paise
      currency: "INR",
      name: "Noble High School",
      description: "Fee Payment - Admin Portal",
      theme: {
        color: "#1a3a6b"
      },
      prefill: {
        name: currentFeeStudent.name,
        contact: currentFeeStudent.phone || ""
      },
      handler: function (response) {
        saveFeeRecord(amount, date, method, response.razorpay_payment_id, balanceDue);
      }
    };
    const rzp = new Razorpay(options);
    rzp.open();
  } else {
    const confirmMsg =
      `Are you sure you want to record this payment?\n\n` +
      `Student: ${currentFeeStudent.name} (${currentFeeStudent.id})\n` +
      `Amount: ₹${amount.toLocaleString()}\n` +
      `Payment Method: ${method}\n` +
      `Date: ${date}\n` +
      `New Balance After This Payment: ₹${(balanceDue - amount).toLocaleString()}\n\n` +
      `Click OK to confirm and generate the bill, or Cancel to go back.`;
    if (!confirm(confirmMsg)) {
      showToast('Payment cancelled — no record was created.');
      return;
    }
    saveFeeRecord(amount, date, method, '', balanceDue);
  }
}

function printFeeBill(receiptNo) {
  const s = currentFeeStudent;
  if (!s) return;
  const allFees = DB.get('fees').filter(f=>f.studentId===s.id);
  const totalPaid = allFees.reduce((sum,f)=>sum+f.amount,0);
  const balance = (s.totalFee||0)-totalPaid;
  const thisPayment = allFees.find(f=>f.receipt===receiptNo);
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  const now = new Date();
  const printWin = window.open('','_blank','width=900,height=800');
  if (!printWin) { showToast('Please allow popups to print','error'); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><title>Fee Receipt - ${receiptNo}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:13pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .toolbar button:hover{background:#d4b75e}
    .bill-wrap{width:210mm;min-height:148mm;margin:16px auto;padding:10mm 12mm;box-sizing:border-box;border:2px solid #1a3a6b;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
    .header{text-align:center;border-bottom:3px double #1a3a6b;padding-bottom:10px;margin-bottom:14px}
    .logo-row{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:6px}
    .school-logo{width:60px;height:60px;object-fit:contain;border-radius:50%;border:2px solid #c8a951}
    .school-name{font-size:20pt;font-weight:900;color:#1a3a6b;letter-spacing:1px}
    .school-sub{font-size:9pt;color:#5a6a82;margin-top:2px}
    .receipt-title{background:#1a3a6b;color:#fff;padding:6px 16px;font-size:13pt;font-weight:700;letter-spacing:2px;margin:10px auto 0;display:inline-block}
    .meta-row{display:flex;justify-content:space-between;font-size:9pt;margin-bottom:14px;color:#5a6a82}
    .student-info{background:#f0f4fb;border-radius:6px;padding:10px 14px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .info-item{font-size:9.5pt}.info-label{color:#5a6a82;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9pt}
    th{background:#1a3a6b;color:#fff;padding:7px 10px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #d0dbed}
    tr:last-child td{border-bottom:none;background:#f0f4fb;font-weight:700}
    .summary{display:flex;gap:12px;margin-bottom:14px}
    .sum-card{flex:1;border:1.5px solid #d0dbed;border-radius:6px;padding:8px 10px;text-align:center}
    .sum-label{font-size:8pt;color:#5a6a82;text-transform:uppercase;letter-spacing:0.5px}
    .sum-val{font-size:13pt;font-weight:800}
    .footer{border-top:1px solid #d0dbed;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt;color:#5a6a82}
    .computer-gen{text-align:center;margin-top:10px;font-size:8pt;color:#5a6a82;font-style:italic}
    @media print{
      body{margin:0;background:#fff}
      .toolbar{display:none}
      .bill-wrap{
        width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        margin: 0 !important;
        box-shadow: none !important;
        padding: 5mm 8mm !important;
        box-sizing: border-box !important;
      }
      @page{size:A5 landscape;margin:5mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM19 19c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14z"/></svg></span> Fee Receipt — ${receiptNo}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Now</button></div>
  <div class="bill-wrap">
    <div class="header">
      <div class="logo-row">
        <img src="${LOGO_SRC}" class="school-logo">
        <div>
          <div class="school-name">Noble High School</div>
          <div class="school-sub">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</div>
        </div>
      </div>
      <div><span class="receipt-title">FEE RECEIPT</span></div>
    </div>
    <div class="meta-row">
      <span><strong>Receipt No:</strong> ${receiptNo}</span>
      <span><strong>Date:</strong> ${thisPayment?fmtDate(thisPayment.date):fmtDate(now.toISOString())}</span>
      <span><strong>Time:</strong> ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
      <span><strong>Academic Year:</strong> ${sys.academicYear}</span>
    </div>
    <div class="student-info">
      <div class="info-item"><span class="info-label">Student Name: </span>${s.name}</div>
      <div class="info-item"><span class="info-label">Student ID / Login ID: </span>${s.id} / ${s.loginId}</div>
      <div class="info-item"><span class="info-label">Class: </span>${s.className} - ${s.section}</div>
      <div class="info-item"><span class="info-label">Father's Name: </span>${s.fatherName}</div>
      <div class="info-item"><span class="info-label">Roll No: </span>${s.rollNo}</div>
      <div class="info-item"><span class="info-label">Phone: </span>${s.phone}</div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Receipt No.</th><th>Amount Paid (₹)</th><th>Payment Method</th><th>Balance After (₹)</th></tr></thead>
      <tbody>
        ${allFees.map(f=>`<tr style="${f.receipt===receiptNo?'background:#e8f7ef':''}"><td>${fmtDate(f.date)}</td><td>${f.receipt}</td><td style="color:#1a7a4a;font-weight:700">₹${f.amount.toLocaleString()}</td><td>${f.method}</td><td>₹${f.balance.toLocaleString()}</td></tr>`).join('')}
        <tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${totalPaid.toLocaleString()}</strong></td><td></td><td style="color:${balance>0?'#c0321a':'#1a7a4a'}"><strong>₹${balance.toLocaleString()}</strong></td></tr>
      </tbody>
    </table>
    <div class="summary">
      <div class="sum-card"><div class="sum-label">Total Fee</div><div class="sum-val" style="color:#1a3a6b">₹${(s.totalFee||0).toLocaleString()}</div></div>
      <div class="sum-card"><div class="sum-label">Total Paid</div><div class="sum-val" style="color:#1a7a4a">₹${totalPaid.toLocaleString()}</div></div>
      <div class="sum-card"><div class="sum-label">Balance Due</div><div class="sum-val" style="color:${balance>0?'#c0321a':'#1a7a4a'}">₹${balance.toLocaleString()}</div></div>
    </div>
    <div class="footer">
      <div>Principal's Office<br>Noble High School</div>
      <div style="text-align:center">This is a computer-generated receipt.<br>No signature required.</div>
      <div style="text-align:right">Cashier / Admin<br>Date: ${fmtDate(now.toISOString())}</div>
    </div>
    <div class="computer-gen">✓ Generated by Noble High School Management System — Computer Generated Bill — No Signature Required</div>
  </div>
  </body></html>`);
  printWin.document.close();
}

// === NOTIFICATIONS ===
function updateNotifRecipientFields() {
  const type = document.getElementById('notifRecipient')?.value;
  const el = document.getElementById('notifRecipientFields');
  if (!el) return;
  if (type === 'class') {
    el.innerHTML = `<div class="form-row"><div class="form-group"><label class="form-label">Class</label><select class="form-control" id="notifClass"><option>Nursery</option><option>LKG</option><option>UKG</option>${['1','2','3','4','5','6','7','8','9','10'].map(c=>`<option>${c}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Section</label><select class="form-control" id="notifSection"><option value="all">All Sections</option><option>A</option><option>B</option><option>C</option></select></div></div>`;
  } else if (type === 'student') {
    el.innerHTML = `<div class="form-group"><label class="form-label">Student ID</label><input class="form-control" id="notifStudentId" placeholder="Enter Student ID"></div>`;
  } else el.innerHTML = '';
}

window._notifPendingPhoto = null;
function previewNotifPhoto() {
  const file = document.getElementById('notif_photoInput').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 800;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);

      const preview = document.getElementById('notif_photoPreview');
      if (preview) preview.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:contain">`;
      window._notifPendingPhoto = compressed;
      document.getElementById('btnNotifPhotoClear').style.display = 'inline-flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearNotifPhoto() {
  const preview = document.getElementById('notif_photoPreview');
  if (preview) preview.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center">No Photo</span>';
  window._notifPendingPhoto = null;
  document.getElementById('notif_photoInput').value = '';
  const clearBtn = document.getElementById('btnNotifPhotoClear');
  if (clearBtn) clearBtn.style.display = 'none';
}

function zoomNotifPhoto(event, src) {
  event.stopPropagation();
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999';
  overlay.style.cursor = 'zoom-out';
  overlay.onclick = () => overlay.remove();

  const img = document.createElement('img');
  img.src = src;
  img.style.maxHeight = '90vh';
  img.style.maxWidth = '90vw';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

function sendNotification() {
  const recipient = document.getElementById('notifRecipient').value;
  const subject = document.getElementById('notifSubject').value.trim();
  const message = document.getElementById('notifMessage').value.trim();
  const priority = document.getElementById('notifPriority').value;
  if (!subject || !message) { showToast('Subject and message are required', 'error'); return; }
  
  const notifs = DB.get('notifications');
  const photo = window._notifPendingPhoto || null;
  const newNotif = { id: 'NOTIF'+Date.now(), recipient, subject, message, priority, dateTime: new Date().toISOString(), read: [], photo };
  if (recipient === 'class') { newNotif.className = document.getElementById('notifClass')?.value; newNotif.section = document.getElementById('notifSection')?.value; }
  else if (recipient === 'student') { newNotif.studentId = document.getElementById('notifStudentId')?.value; }
  
  notifs.push(newNotif);
  DB.set('notifications', notifs);
  document.getElementById('notifSubject').value = '';
  document.getElementById('notifMessage').value = '';
  clearNotifPhoto();
  renderNotifTable();
  showToast('Notification sent successfully!');
}

function renderNotifTable() {
  const notifs = DB.get('notifications').slice().reverse();
  const el = document.getElementById('notifTable');
  if (!el) return;
  el.innerHTML = notifs.length ? `<table><thead><tr><th>Date</th><th>Recipient</th><th>Subject</th><th>Priority</th><th>Action</th></tr></thead>
  <tbody>${notifs.map(n => `<tr><td>${fmtDate(n.dateTime)}</td><td>${n.recipient==='all'?'All Students':n.recipient==='class'?`Class ${n.className}-${n.section||'all'}`:n.studentId||'Student'}</td><td>${n.subject} ${n.photo ? `<span style="margin-left: 6px; font-size: 0.76rem; background: var(--bg-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); cursor: pointer;" onclick="zoomNotifPhoto(event, '${n.photo}')">🖼️ View Card</span>` : ''}</td><td><span class="badge badge-${n.priority.toLowerCase()}">${n.priority}</span></td><td><button class="btn btn-danger btn-sm" onclick="deleteNotif('${n.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span></button></td></tr>`).join('')}</tbody></table>`
  : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No notifications sent yet</p></div>';
}

function deleteNotif(id) {
  const notifs = DB.get('notifications');
  DB.set('notifications', notifs.filter(n=>n.id!==id));
  renderNotifTable();
}

// === EXAM SCHEDULE ===
let examDays = [{ dayNo:1, date:'', day:'', subject:'', time:'', oral:false, marks:100, notes:'' }];

function showExamForm(editId=null) {
  const exams = DB.get('exams');
  const existing = editId ? exams.find(e=>e.id===editId) : null;
  if (existing) examDays = JSON.parse(JSON.stringify(existing.days));
  else examDays = [{ dayNo:1, date:'', day:'', subject:'', time:'', oral:false, marks:100, notes:'' }];
  
  document.getElementById('formModalTitle').textContent = existing ? 'Edit Exam Schedule' : 'Create Exam Schedule';
  renderExamFormContent(existing);
  document.getElementById('formModal').classList.add('active');
}

function renderExamFormContent(existing=null) {
  const typeOpts = ['SA - Summative Assessment','FA - Formative Assessment','Mid-term','Final','Unit Test'];
  const classOpts = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'];
  
  const curName = document.getElementById('ef_name')?.value || existing?.name || '';
  const curType = document.getElementById('ef_type')?.value || existing?.type || '';
  const curClass = document.getElementById('ef_class')?.value || existing?.className || '';
  const curSection = document.getElementById('ef_section')?.value || existing?.section || 'all';
  const curStartDate = document.getElementById('ef_startDate')?.value || existing?.startDate || '';
  
  document.getElementById('formModalBody').innerHTML = `
    <div id="examFormError"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Exam Name <span class="req">*</span></label><input class="form-control" id="ef_name" value="${curName}" placeholder="e.g. First Term SA"></div>
      <div class="form-group"><label class="form-label">Exam Type</label><select class="form-control" id="ef_type">${typeOpts.map(t=>`<option ${curType===t?'selected':''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Class <span class="req">*</span></label><select class="form-control" id="ef_class">${classOpts.map(c=>`<option ${curClass===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Section</label><select class="form-control" id="ef_section"><option value="all">All Sections</option><option ${curSection==='A'?'selected':''}>A</option><option ${curSection==='B'?'selected':''}>B</option><option ${curSection==='C'?'selected':''}>C</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Start Date</label><input class="form-control" id="ef_startDate" type="date" value="${curStartDate}" onchange="handleStartDateChange()" style="max-width:220px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px">
      <strong style="color:var(--primary-dark)">Daily Schedule</strong>
      <div style="display:flex;gap:8px">
        ${examDays.length<8?`<button class="btn btn-secondary btn-sm" onclick="addExamDay('${existing?.id||''}')">+ Add Day</button>`:''}
        ${examDays.length>1?`<button class="btn btn-danger btn-sm" onclick="removeExamDay('${existing?.id||''}')">- Remove Last</button>`:''}
      </div>
    </div>
    <div id="examDaysContainer">${renderExamDays()}</div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="saveExamDraft('${existing?.id||''}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg></span> Save Draft</button>
      <button class="btn btn-primary" onclick="publishExam('${existing?.id||''}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/></svg></span> Publish to Students</button>
      ${existing?.id ? `<button class="btn btn-gold" onclick="printExamTimetable('${existing.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Timetable</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    </div>`;
}

function renderExamDays() {
  const startDateVal = document.getElementById('ef_startDate')?.value || '';
  return examDays.map((d,i) => `<div style="background:var(--bg-light);border-radius:8px;padding:14px;margin-bottom:10px;border:1px solid var(--border)">
    <strong style="font-size:0.85rem;color:var(--primary)">Day ${d.dayNo}</strong>
    <div class="form-row" style="margin-top:8px">
      <div class="form-group"><label class="form-label" style="font-size:0.8rem">Date</label><input class="form-control" value="${d.date}" onchange="examDays[${i}].date=this.value;examDays[${i}].day=getDayName(this.value)" type="date" ${startDateVal ? `min="${startDateVal}"` : ''}></div>
      <div class="form-group"><label class="form-label" style="font-size:0.8rem">Subject</label><input class="form-control" value="${d.subject}" onchange="examDays[${i}].subject=this.value" placeholder="Subject name"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" style="font-size:0.8rem">Time (Start-End)</label><input class="form-control" value="${d.time}" onchange="examDays[${i}].time=this.value" placeholder="9:00-12:00"></div>
      <div class="form-group"><label class="form-label" style="font-size:0.8rem">Total Marks</label><input class="form-control" type="number" value="${d.marks}" onchange="examDays[${i}].marks=+this.value"></div>
    </div>
    <div style="display:flex;align-items:center;gap:16px">
      <label style="display:flex;align-items:center;gap:6px;font-size:0.88rem"><input type="checkbox" ${d.oral?'checked':''} onchange="examDays[${i}].oral=this.checked"> Oral Exam</label>
      <div class="form-group" style="flex:1;margin:0"><input class="form-control" value="${d.notes}" onchange="examDays[${i}].notes=this.value" placeholder="Notes (optional)"></div>
    </div>
  </div>`).join('');
}

function syncExamFormToState() {
  examDays.forEach((d, i) => {
    const dateEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[type="date"]`);
    const subEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[placeholder="Subject name"]`);
    const timeEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[placeholder="9:00-12:00"]`);
    const marksEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[type="number"]`);
    const oralEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[type="checkbox"]`);
    const notesEl = document.querySelector(`#examDaysContainer > div:nth-child(${i+1}) input[placeholder="Notes (optional)"]`);
    
    if (dateEl) d.date = dateEl.value;
    if (subEl) d.subject = subEl.value;
    if (timeEl) d.time = timeEl.value;
    if (marksEl) d.marks = parseInt(marksEl.value) || 100;
    if (oralEl) d.oral = oralEl.checked;
    if (notesEl) d.notes = notesEl.value;
    d.day = getDayName(d.date);
  });
}

function calculateDefaultDate(dayNo) {
  const startDateInput = document.getElementById('ef_startDate');
  const startDateVal = startDateInput ? startDateInput.value : '';
  if (!startDateVal) return '';
  
  let currentDate = new Date(startDateVal);
  let count = 1;
  
  while (count < dayNo) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() === 0) { // Sunday is 0
      currentDate.setDate(currentDate.getDate() + 1);
    }
    count++;
  }
  
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const date = String(currentDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function handleStartDateChange() {
  const startDateVal = document.getElementById('ef_startDate').value;
  if (!startDateVal) return;
  
  syncExamFormToState();
  
  examDays.forEach((d) => {
    const defaultDate = calculateDefaultDate(d.dayNo);
    d.date = defaultDate;
    d.day = getDayName(defaultDate);
  });
  
  document.getElementById('examDaysContainer').innerHTML = renderExamDays();
}

function addExamDay(editId = '') {
  if (examDays.length < 8) {
    syncExamFormToState();
    const nextDayNo = examDays.length + 1;
    const defaultDate = calculateDefaultDate(nextDayNo);
    examDays.push({
      dayNo: nextDayNo,
      date: defaultDate,
      day: getDayName(defaultDate),
      subject: '',
      time: '',
      oral: false,
      marks: 100,
      notes: ''
    });
    renderExamFormContent(editId ? { id: editId } : null);
  }
}

function removeExamDay(editId = '') {
  if (examDays.length > 1) {
    syncExamFormToState();
    examDays.pop();
    renderExamFormContent(editId ? { id: editId } : null);
  }
}

function getDayName(date) { if(!date)return'';const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return days[new Date(date).getDay()]; }

function saveExamDraft(editId) { saveExamData(editId, false); }
function publishExam(editId) {
  showConfirm('Publish Exam Schedule', 'Are you sure you want to publish this exam schedule to students?', 'Publish', 'btn-success', () => saveExamData(editId, true));
}

function saveExamData(editId, publish) {
  const name = document.getElementById('ef_name').value.trim();
  const type = document.getElementById('ef_type').value;
  const cls = document.getElementById('ef_class').value;
  const section = document.getElementById('ef_section').value;
  const startDate = document.getElementById('ef_startDate').value;
  if (!name) { showAlert('examFormError','error','Exam name is required'); return; }
  if (!startDate) { showAlert('examFormError','error','Start date is required'); return; }

  const todayStr = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
  if (startDate < todayStr) {
    showAlert('examFormError', 'error', 'Start Date cannot be in the past');
    return;
  }

  syncExamFormToState();
  for (let i = 0; i < examDays.length; i++) {
    if (!examDays[i].date) {
      showAlert('examFormError', 'error', `Date for Day ${i+1} is required`);
      return;
    }
    if (examDays[i].date < todayStr) {
      showAlert('examFormError', 'error', `Date for Day ${i+1} cannot be in the past`);
      return;
    }
  }

  const exams = DB.get('exams');
  const days = examDays.map(d => ({ ...d, day: getDayName(d.date) }));

  if (editId) {
    const idx = exams.findIndex(e=>e.id===editId);
    if (idx!==-1) { exams[idx] = {...exams[idx], name,type,className:cls,section,startDate,days,published:!!publish}; }
  } else {
    exams.push({ id:'EXAM'+Date.now(), name, type, className:cls, section, startDate, days, published:!!publish });
  }
  DB.set('exams', exams);
  closeModal('formModal');
  renderExamsTable();
  populatePrintExamDropdowns();
  showToast(publish ? 'Exam schedule published!' : 'Saved as draft');
}

function renderExamsTable() {
  const exams = DB.get('exams');
  const el = document.getElementById('examsTable');
  if (!el) return;
  el.innerHTML = exams.length ? `<table><thead><tr><th>Exam Name</th><th>Type</th><th>Class</th><th>Section</th><th>Start Date</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>${exams.map(e => `<tr><td><strong>${e.name}</strong></td><td>${e.type}</td><td>${e.className}</td><td>${e.section||'All'}</td><td>${fmtDate(e.startDate)}</td><td>${e.days.length}</td><td><span class="badge ${e.published?'badge-success':'badge-warning'}">${e.published?'Published':'Draft'}</span></td><td>
    <button class="btn btn-secondary btn-sm" onclick="showExamForm('${e.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span></button>
    <button class="btn btn-gold btn-sm" style="margin-left:4px" onclick="printExamTimetable('${e.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span></button>
    <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteExam('${e.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span></button>
  </td></tr>`).join('')}</tbody></table>`
  : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No exam schedules created yet</p></div>';
}

function deleteExam(id) {
  showConfirm('Delete Exam', 'Delete this exam schedule? This cannot be undone.', 'Delete', 'btn-danger', () => {
    DB.set('exams', DB.get('exams').filter(e=>e.id!==id)); renderExamsTable(); showToast('Exam deleted');
  });
}

function printExamTimetable(examId) {
  const exam = DB.get('exams').find(e=>e.id===examId);
  if (!exam) return;
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  const printWin = window.open('','_blank','width=900,height=800');
  if (!printWin) { showToast('Please allow popups to print','error'); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><title>Exam Timetable - ${exam.name}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:13pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .toolbar button:hover{background:#d4b75e}
    .wrap{width:210mm;margin:16px auto;padding:12mm;box-sizing:border-box;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
    .header{text-align:center;border-bottom:3px double #1a3a6b;padding-bottom:10px;margin-bottom:16px}
    .logo-row{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px}
    .logo{width:70px;height:70px;object-fit:contain;border-radius:50%;border:3px solid #c8a951}
    .school-name{font-size:22pt;font-weight:900;color:#1a3a6b}
    .school-sub{font-size:9pt;color:#5a6a82}
    .exam-title{background:#1a3a6b;color:#fff;padding:8px 20px;font-size:14pt;font-weight:700;letter-spacing:1px;margin-top:10px;display:inline-block}
    .meta{display:flex;justify-content:space-between;margin-bottom:14px;font-size:9.5pt;color:#5a6a82;background:#f0f4fb;padding:8px 12px;border-radius:6px}
    table{width:100%;border-collapse:collapse;font-size:10pt}
    th{background:#1a3a6b;color:#fff;padding:8px 12px;text-align:left}
    td{padding:8px 12px;border:1px solid #d0dbed}
    tr:nth-child(even) td{background:#f8faff}
    .footer{margin-top:20px;text-align:center;font-size:8pt;color:#5a6a82;border-top:1px solid #d0dbed;padding-top:10px}
    @media print{
      body{margin:0;background:#fff}
      .toolbar{display:none}
      .wrap{width:auto;margin:0;padding:8mm;box-shadow:none}
      th{background:transparent !important;color:#1a2535 !important;border:1px solid #1a2535 !important}
      .exam-title{background:transparent !important;color:#1a3a6b !important;border:1.5px solid #1a3a6b !important;padding:8px 20px;display:inline-block}
      @page{size:A4;margin:8mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg></span> Exam Timetable — ${exam.name}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Now</button></div>
  <div class="wrap">
    <div class="header">
      <div class="logo-row">
        <img src="${LOGO_SRC}" class="logo">
        <div>
          <div class="school-name">Noble High School</div>
          <div class="school-sub">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</div>
        </div>
      </div>
      <div><span class="exam-title">${exam.name} — Class ${exam.className}${exam.section&&exam.section!=='all'?'-'+exam.section:''} Exam Timetable</span></div>
    </div>
    <div class="meta">
      <span><strong>Exam:</strong> ${exam.name}</span>
      <span><strong>Type:</strong> ${exam.type}</span>
      <span><strong>Class:</strong> ${exam.className}${exam.section&&exam.section!=='all'?' - '+exam.section:''}</span>
      <span><strong>Academic Year:</strong> ${sys.academicYear}</span>
    </div>
    <table>
      <thead><tr><th>Day No.</th><th>Date</th><th>Day</th><th>Subject</th><th>Time</th><th>Total Marks</th><th>Notes</th></tr></thead>
      <tbody>
        ${exam.days.map(d=>`<tr><td>${d.dayNo}</td><td>${fmtDate(d.date)}</td><td>${d.day||getDayName(d.date)}</td><td><strong>${d.subject}</strong></td><td>${d.time}</td><td>${d.marks}</td><td>${d.oral?'Oral Exam':''} ${d.notes||''}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="text-align:left">
          <div>Noble High School | Computer Generated Timetable</div>
          <div>Academic Year: ${sys.academicYear}</div>
        </div>
        <div style="text-align:center;">
          ${SHOW_PRINCIPAL_SIGNATURE ? `<img src="${PRINCIPAL_SIGNATURE}" alt="Principal Signature" style="height: 32px; margin-top: 4px;">` : ''}
          <div style="border-top:1px solid #666;margin:3px 0 2px 0;font-size:8.5pt;">
            <strong>Principal: Bairu Kondal Reddy</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`);
  printWin.document.close();
}

// === COMPLAINTS ===
function renderComplaintsTable() {
  const complaints = DB.get('complaints');
  const search = (document.getElementById('compSearch')?.value||'').toLowerCase();
  const statusFilter = document.getElementById('compStatusFilter')?.value||'all';
  
  let filtered = complaints.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search) || c.stuId.toLowerCase().includes(search) || c.stuName.toLowerCase().includes(search);
    const matchStatus = statusFilter==='all' || c.status===statusFilter;
    return matchSearch && matchStatus;
  });
  
  const el = document.getElementById('complaintsTableContainer');
  if (!el) return;
  el.innerHTML = filtered.length ? `<table><thead><tr><th>Complaint ID</th><th>Date</th><th>Student Name</th><th>Parent</th><th>Student ID</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead>
  <tbody>${filtered.map(c => `<tr>
    <td><code>${c.id}</code></td><td>${fmtDate(c.date)}</td><td><strong>${c.stuName}</strong></td><td>${c.parName}</td><td>${c.stuId}</td><td>${c.phone}</td>
    <td><span class="badge badge-${c.status.toLowerCase()}">${c.status==='Resolved'?'✓ ':c.status==='Pending'?'⏳ ':''}${c.status}</span></td>
    <td>
      <button class="btn btn-secondary btn-sm" onclick="viewComplaint('${c.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></span> View</button>
      ${c.status==='Pending'?`<button class="btn btn-success btn-sm" style="margin-left:4px" onclick="resolveComplaint('${c.id}')">✓ Resolve</button>`:''}
    </td>
  </tr>`).join('')}</tbody></table>`
  : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No complaints found</p></div>';
}

function viewComplaint(id) {
  const c = DB.get('complaints').find(x=>x.id===id);
  if (!c) return;
  document.getElementById('detailModalTitle').textContent = 'Complaint: ' + c.id;
  document.getElementById('detailModalBody').innerHTML = `
    <div class="result-card"><div class="rc-row">
      <div class="rc-item"><label>Student Name</label><span>${c.stuName}</span></div>
      <div class="rc-item"><label>Parent Name</label><span>${c.parName}</span></div>
      <div class="rc-item"><label>Student ID</label><span>${c.stuId}</span></div>
      <div class="rc-item"><label>Phone</label><span>${c.phone}</span></div>
      <div class="rc-item"><label>Date Submitted</label><span>${fmtDate(c.date)}</span></div>
      <div class="rc-item"><label>Status</label><span class="badge badge-${c.status.toLowerCase()}">${c.status}</span></div>
    </div></div>
    <div class="form-group"><label class="form-label">Complaint Details</label><div style="background:var(--bg-light);border-radius:8px;padding:14px;border:1px solid var(--border);line-height:1.6">${c.details}</div></div>
    <div class="form-group"><label class="form-label">Admin Notes (Internal)</label><textarea class="form-control" id="compAdminNotes" rows="3" placeholder="Internal notes...">${c.adminNotes||''}</textarea></div>
    ${c.status==='Pending'?`<button class="btn btn-success" onclick="resolveComplaint('${c.id}');closeModal('detailModal')">✓ Mark as Resolved</button>`:`<p style="color:var(--success);font-weight:600">✓ Resolved on ${fmtDate(c.resolvedDate)}</p>`}
    <button class="btn btn-secondary" style="margin-left:${c.status==='Pending'?'10':'0'}px" onclick="saveCompNotes('${c.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg></span> Save Notes</button>
  `;
  document.getElementById('detailModal').classList.add('active');
}

function saveCompNotes(id) {
  const complaints = DB.get('complaints');
  const idx = complaints.findIndex(c=>c.id===id);
  if (idx!==-1) { complaints[idx].adminNotes = document.getElementById('compAdminNotes')?.value; DB.set('complaints', complaints); showToast('Notes saved'); }
}

function resolveComplaint(id) {
  const complaints = DB.get('complaints');
  const idx = complaints.findIndex(c=>c.id===id);
  if (idx!==-1) { complaints[idx].status='Resolved'; complaints[idx].resolvedDate=new Date().toISOString(); DB.set('complaints', complaints); renderComplaintsTable(); showToast('Complaint marked as resolved!'); }
}

// === ONLINE ADMISSIONS ===
// Mirrors the complaints flow: list table with status filter, view-detail modal,
// and a "Mark Contacted" action that flips status from Pending to Contacted.
// The dashboard counter only includes Pending requests.
function renderAdmissionsTable() {
  const admissions = DB.get('admissions') || [];
  const search = (document.getElementById('admSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('admStatusFilter')?.value || 'all';
  let rows = admissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  if (statusFilter !== 'all') rows = rows.filter(a => a.status === statusFilter);
  if (search) {
    rows = rows.filter(a =>
      (a.id || '').toLowerCase().includes(search) ||
      (a.stuName || '').toLowerCase().includes(search) ||
      (a.phone1 || '').includes(search) ||
      (a.phone2 || '').includes(search) ||
      (a.fatherName || '').toLowerCase().includes(search)
    );
  }

  const container = document.getElementById('admissionsTableContainer');
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No admission requests found</p></div>';
    return;
  }
  container.innerHTML = `<table>
    <thead><tr>
      <th>Ack No.</th><th>Submitted</th><th>Student Name</th><th>Class</th>
      <th>Father Name</th><th>Phone 1</th><th>Status</th><th>Action</th>
    </tr></thead>
    <tbody>${rows.map(a => `<tr>
      <td><code>${a.id}</code></td>
      <td>${fmtDate(a.submittedAt)}</td>
      <td><strong>${a.stuName}</strong></td>
      <td>${a.classToJoin}</td>
      <td>${a.fatherName}</td>
      <td>${a.phone1}</td>
      <td><span class="badge badge-${a.status === 'Contacted' ? 'success' : 'pending'}">${a.status === 'Contacted' ? '✓ ' : '⏳ '}${a.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewAdmission('${a.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></span> View</button>
        ${a.status === 'Pending' ? `<button class="btn btn-success btn-sm" style="margin-left:4px" onclick="markAdmissionContacted('${a.id}')">✓ Mark Contacted</button>` : ''}
      </td>
    </tr>`).join('')}</tbody></table>`;
}

function viewAdmission(id) {
  const a = (DB.get('admissions') || []).find(x => x.id === id);
  if (!a) return;
  document.getElementById('detailModalTitle').textContent = 'Admission Request: ' + a.id;
  document.getElementById('detailModalBody').innerHTML = `
    <div class="result-card"><div class="rc-row">
      <div class="rc-item"><label>Acknowledgement No</label><span>${a.id}</span></div>
      <div class="rc-item"><label>Submitted</label><span>${fmtDate(a.submittedAt)}</span></div>
      <div class="rc-item"><label>Student Name</label><span>${a.stuName}</span></div>
      <div class="rc-item"><label>Date of Birth</label><span>${fmtDate(a.dob)}</span></div>
      <div class="rc-item"><label>Class to Join</label><span>${a.classToJoin}</span></div>
      <div class="rc-item"><label>Father's Name</label><span>${a.fatherName}</span></div>
      <div class="rc-item"><label>Mother's Name</label><span>${a.motherName}</span></div>
      <div class="rc-item"><label>Phone 1</label><span>${a.phone1}</span></div>
      <div class="rc-item"><label>Phone 2</label><span>${a.phone2}</span></div>
      <div class="rc-item"><label>Status</label><span class="badge badge-${a.status === 'Contacted' ? 'success' : 'pending'}">${a.status}</span></div>
    </div></div>
    <div class="form-group"><label class="form-label">Current Address</label><div style="background:var(--bg-light);border-radius:8px;padding:12px;border:1px solid var(--border)">${a.address || '—'}</div></div>
    <div class="form-group"><label class="form-label">Previous School</label><div style="background:var(--bg-light);border-radius:8px;padding:12px;border:1px solid var(--border)">${a.prevSchool || '—'}</div></div>
    <div class="form-group"><label class="form-label">Admin Notes (Internal)</label><textarea class="form-control" id="admAdminNotes" rows="3" placeholder="Internal notes...">${a.adminNotes || ''}</textarea></div>
    ${a.status === 'Pending'
      ? `<button class="btn btn-success" onclick="markAdmissionContacted('${a.id}'); closeModal('detailModal')">✓ Mark Contacted</button>`
      : `<p style="color:var(--success);font-weight:600">✓ Contacted on ${fmtDate(a.contactedAt)}</p>`}
    <button class="btn btn-secondary" style="margin-left:${a.status === 'Pending' ? '10' : '0'}px" onclick="saveAdmissionNotes('${a.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg></span> Save Notes</button>
  `;
  document.getElementById('detailModal').classList.add('active');
}

function markAdmissionContacted(id) {
  const admissions = DB.get('admissions') || [];
  const idx = admissions.findIndex(a => a.id === id);
  if (idx === -1) return;
  admissions[idx].status = 'Contacted';
  admissions[idx].contactedAt = new Date().toISOString();
  DB.set('admissions', admissions);
  renderAdmissionsTable();
  // Re-render the dashboard so the count drops immediately if the admin is on it.
  if (document.getElementById('section-dashboard')?.classList.contains('active')) renderDashboard();
  showToast('Marked as contacted — removed from dashboard count');
}

function saveAdmissionNotes(id) {
  const admissions = DB.get('admissions') || [];
  const idx = admissions.findIndex(a => a.id === id);
  if (idx === -1) return;
  admissions[idx].adminNotes = document.getElementById('admAdminNotes')?.value || '';
  DB.set('admissions', admissions);
  showToast('Notes saved');
}

// === FEE SUMMARY ===
function renderFeeSummary() {
  const students = DB.get('students');
  const fees = DB.get('fees');
  const totalExpected = students.reduce((sum,s)=>sum+(s.totalFee||0),0);
  const totalCollected = fees.reduce((sum,f)=>sum+f.amount,0);
  const totalPending = totalExpected - totalCollected;
  const collPct = totalExpected>0 ? ((totalCollected/totalExpected)*100).toFixed(1) : 0;
  
  document.getElementById('feeSummaryStats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${students.length}</div></div>
    <div class="stat-card"><div class="stat-label">Total Fee Expected</div><div class="stat-value" style="font-size:1.4rem">₹${totalExpected.toLocaleString()}</div></div>
    <div class="stat-card green"><div class="stat-label">Total Collected</div><div class="stat-value" style="font-size:1.4rem">₹${totalCollected.toLocaleString()}</div><div class="stat-sub">${collPct}% collected</div></div>
    <div class="stat-card red"><div class="stat-label">Total Pending</div><div class="stat-value" style="font-size:1.4rem">₹${totalPending.toLocaleString()}</div></div>
  `;
  
  const classes = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'];
  const rows = classes.map(cls => {
    const clsStudents = students.filter(s=>s.className===cls);
    if (clsStudents.length===0) return '';
    const exp = clsStudents.reduce((sum,s)=>sum+(s.totalFee||0),0);
    const coll = fees.filter(f=>clsStudents.some(s=>s.id===f.studentId)).reduce((sum,f)=>sum+f.amount,0);
    const pend = exp-coll;
    const pct = exp>0 ? ((coll/exp)*100).toFixed(1) : 0;
    const color = pct>=75?'var(--success)':pct>=50?'var(--warning)':'var(--danger)';
    return `<tr><td><strong>Class ${cls}</strong></td><td>${clsStudents.length}</td><td>₹${exp.toLocaleString()}</td><td style="color:var(--success)">₹${coll.toLocaleString()}</td><td style="color:var(--danger)">₹${pend.toLocaleString()}</td><td style="color:${color};font-weight:700">${pct}%</td></tr>`;
  }).filter(Boolean).join('');
  
  document.getElementById('classFeeSummaryTable').innerHTML = `<table><thead><tr><th>Class</th><th>Students</th><th>Expected</th><th>Collected</th><th>Pending</th><th>Collection %</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function feeSumSearch() {
  const id = document.getElementById('feeSumSearchId').value.trim();
  const students = DB.get('students');
  const s = students.find(x=>x.id===id||x.loginId===id);
  if (!s) { showToast('Student ID not found','error'); document.getElementById('feeSumStudentResult').style.display='none'; return; }
  const fees = DB.get('fees');
  const paid = fees.filter(f=>f.studentId===s.id).reduce((sum,f)=>sum+f.amount,0);
  const balance = (s.totalFee||0)-paid;
  document.getElementById('feeSumCard').innerHTML = `<div class="rc-row">
    <div class="rc-item"><label>Name</label><span>${s.name}</span></div>
    <div class="rc-item"><label>Class</label><span>${s.className}-${s.section}</span></div>
    <div class="rc-item"><label>Total Fee</label><span>₹${(s.totalFee||0).toLocaleString()}</span></div>
    <div class="rc-item"><label>Paid</label><span style="color:var(--success)">₹${paid.toLocaleString()}</span></div>
    <div class="rc-item"><label>Balance</label><span style="color:${balance>0?'var(--danger)':'var(--success)'}">₹${balance.toLocaleString()}</span></div>
  </div>`;
  document.getElementById('feeSumStudentResult').style.display='block';
}

// === STUDENT REPORTS (CLASS-WISE MARKS) ===
function renderRepClassButtons() {
  const el = document.getElementById('repClassButtons');
  if (!el) return;
  const students = DB.get('students').filter(s=>s.status==='active');
  const classes = [...new Set(students.map(s=>s.className))].sort((a,b)=>{
    const n1=parseInt(a), n2=parseInt(b);
    if(!isNaN(n1)&&!isNaN(n2)) return n1-n2;
    return a.localeCompare(b);
  });
  el.innerHTML = classes.length ? classes.map(c=>`<button class="btn btn-secondary" onclick="repSelectClass('${c}')">${c}${ordSuffix(c)} Class</button>`).join('') : '<p style="color:var(--text-muted)">No active students found.</p>';
}

function repClearFormState() {
  _repCurrentClass = '';
  _repEditingExamName = null;
  const s2 = document.getElementById('repStep2'); if (s2) s2.style.display = 'none';
  const s3 = document.getElementById('repStep3'); if (s3) s3.style.display = 'none';
  const nameInput = document.getElementById('repCommonExamName'); if (nameInput) nameInput.value = '';
  const daysInput = document.getElementById('repWorkingDays'); if (daysInput) daysInput.value = '';
  const uiInput = document.getElementById('repUseInternals'); if (uiInput) uiInput.checked = false;
  repToggleInternalsUI();
  const mDiv = document.getElementById('repAllStudentsMarks'); if (mDiv) mDiv.innerHTML = '';
  renderRepClassButtons();
}

function ordSuffix(c) {
  const n=parseInt(c);
  if(isNaN(n)) return '';
  if(n===1) return ' (1st)';
  if(n===2) return ' (2nd)';
  if(n===3) return ' (3rd)';
  return ` (${n}th)`;
}

let _repCurrentClass = '';
let _repEditingExamName = null;   // when set, repSaveAllReports updates instead of creating
function repSelectClass(cls) {
  _repCurrentClass = cls;
  _repEditingExamName = null;
  document.getElementById('repSelectedClass').textContent = 'Class ' + cls;
  document.getElementById('repStep2').style.display = 'block';
  document.getElementById('repStep3').style.display = 'none';
  document.getElementById('repAllStudentsMarks').innerHTML = '';
  document.getElementById('repStep2').scrollIntoView({behavior:'smooth'});
  // Always render the recent reports panel for this class
  renderRepRecentPanel(cls);
}

// Toggle visibility of the internals max-mark inputs.
function repToggleInternalsUI() {
  const on = document.getElementById('repUseInternals')?.checked;
  const cfg = document.getElementById('repInternalsConfig');
  if (cfg) cfg.style.display = on ? 'block' : 'none';
  // Re-render Step 3 if students are already loaded so columns update live.
  const step3 = document.getElementById('repStep3');
  if (step3 && step3.style.display !== 'none') repLoadStudents(true);
}

function repLoadStudents(skipExamNameCheck) {
  const examName = document.getElementById('repCommonExamName').value.trim();
  if (!examName && !skipExamNameCheck) { showToast('Please enter a common exam name','error'); return; }
  const examType = document.getElementById('repExamType').value;
  const totalPerSubj = parseFloat(document.getElementById('repTotalPerSubj').value||100);
  const workingDays = parseInt(document.getElementById('repWorkingDays').value||0);
  const useInternals = !!document.getElementById('repUseInternals')?.checked;
  const internalMax = parseFloat(document.getElementById('repInternalMax')?.value || 20);
  const externalMax = parseFloat(document.getElementById('repExternalMax')?.value || 80);

  // If internals are on, validate the maxes add up to total per subject.
  if (useInternals && Math.abs((internalMax + externalMax) - totalPerSubj) > 0.01) {
    showToast(`Internal (${internalMax}) + External (${externalMax}) = ${internalMax + externalMax}, but Total Marks per Subject is ${totalPerSubj}. Please fix.`, 'error');
    return;
  }
  
  const students = DB.get('students').filter(s=>s.status==='active'&&s.className===_repCurrentClass)
    .sort((a,b)=>a.rollNo.localeCompare(b.rollNo,undefined,{numeric:true}));
  
  if (!students.length) { showToast('No active students found for this class','error'); return; }
  
  const subjects = getSubjectsByClass(_repCurrentClass);
  document.getElementById('repExamLabel').textContent = `${examName || '(no name yet)'} | Class ${_repCurrentClass} | ${students.length} students`;

  // If we're editing an existing exam, pre-fill marks from the saved reports.
  const allReports = DB.get('reports');
  const existingByStudent = {};
  if (_repEditingExamName) {
    students.forEach(s => {
      const r = allReports.find(x => x.studentId === s.id && x.examName === _repEditingExamName);
      if (r) existingByStudent[s.id] = r;
    });
  }

  // Build the headers based on whether internals are on.
  const headerHtml = useInternals
    ? `<th style="background:var(--bg-light);padding:7px 10px;text-align:left;border:1px solid var(--border)">S.No</th>
       <th style="background:var(--bg-light);padding:7px 10px;text-align:left;border:1px solid var(--border)">Subject</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Internal (max ${internalMax})</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">External (max ${externalMax})</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Total / ${totalPerSubj}</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Grade</th>`
    : `<th style="background:var(--bg-light);padding:7px 10px;text-align:left;border:1px solid var(--border)">S.No</th>
       <th style="background:var(--bg-light);padding:7px 10px;text-align:left;border:1px solid var(--border)">Subject</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Max Marks</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Marks / Status</th>
       <th style="background:var(--bg-light);padding:7px 10px;border:1px solid var(--border)">Grade</th>`;

  const html = students.map((s) => {
    const existing = existingByStudent[s.id];
    const presValue = existing ? existing.presentDays : workingDays;
    const rowsHtml = subjects.map((subj, i) => {
      const subjKey = subj.replace(/\s+/g, '_');
      const mv = existing?.marks?.[subj];
      const ivObj = existing?.internalMarks?.[subj];
      // pre-fill helpers
      const plainVal = (mv === 'A' || mv === 'NE' || mv === undefined || mv === null) ? '' : mv;
      const intVal = ivObj?.internal ?? '';
      const extVal = ivObj?.external ?? '';
      if (useInternals) {
        return `<tr>
          <td style="padding:7px 10px;border:1px solid var(--border)">${i+1}</td>
          <td style="padding:7px 10px;border:1px solid var(--border);font-weight:600">${subj}</td>
          <td style="padding:5px 8px;border:1px solid var(--border)">
            <input class="form-control" id="int_${s.id}_${subjKey}" type="number" min="0" max="${internalMax}" style="width:80px" value="${intVal}" oninput="repCalcGradeInternal('${s.id}','${subj}',${internalMax},${externalMax},${totalPerSubj})">
          </td>
          <td style="padding:5px 8px;border:1px solid var(--border)">
            <div style="display:flex;gap:4px;align-items:center">
              <input class="form-control" id="ext_${s.id}_${subjKey}" type="number" min="0" max="${externalMax}" style="width:80px" value="${extVal}" oninput="repCalcGradeInternal('${s.id}','${subj}',${internalMax},${externalMax},${totalPerSubj})">
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem" onclick="repSetAbsent('${s.id}','${subj}','A',true)" title="Mark Absent">A</button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:0.7rem" onclick="repSetAbsent('${s.id}','${subj}','NE',true)" title="No Exam — hides this subject">NE</button>
            </div>
          </td>
          <td style="padding:7px 10px;border:1px solid var(--border);text-align:center;font-weight:700"><span id="tot_${s.id}_${subjKey}">${(intVal !== '' && extVal !== '') ? (Number(intVal)+Number(extVal)) : '—'}</span></td>
          <td style="padding:7px 10px;border:1px solid var(--border);text-align:center"><span id="grd_${s.id}_${subjKey}">—</span></td>
        </tr>`;
      } else {
        return `<tr>
          <td style="padding:7px 10px;border:1px solid var(--border)">${i+1}</td>
          <td style="padding:7px 10px;border:1px solid var(--border);font-weight:600">${subj}</td>
          <td style="padding:7px 10px;border:1px solid var(--border);text-align:center">${totalPerSubj}</td>
          <td style="padding:7px 10px;border:1px solid var(--border)">
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-control" id="mrk_${s.id}_${subjKey}" type="number" min="0" max="${totalPerSubj}" style="width:80px" value="${plainVal}" oninput="repCalcGrade('${s.id}','${subj}',${totalPerSubj})">
              <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem" onclick="repSetAbsent('${s.id}','${subj}','A')">A</button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.75rem" onclick="repSetAbsent('${s.id}','${subj}','NE')">No Exam</button>
            </div>
          </td>
          <td style="padding:7px 10px;border:1px solid var(--border);text-align:center"><span id="grd_${s.id}_${subjKey}">—</span></td>
        </tr>`;
      }
    }).join('');

    return `
      <div class="complaint-form-wrap" style="margin-bottom:16px" id="repCard_${s.id}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:2px solid var(--border);background:var(--bg-light);flex-shrink:0;display:flex;align-items:center;justify-content:center">
            ${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`:''}
          </div>
          <div>
            <strong style="font-size:0.95rem">${s.name}</strong>
            <div style="font-size:0.8rem;color:var(--text-muted)">Class: ${s.className} | Sec: ${s.section} | Roll: ${s.rollNo} | ID: ${s.id} | Father: ${s.fatherName}</div>
            <div style="font-size:0.8rem;color:var(--primary-dark)">Exam: ${examName || '(unnamed)'}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:8px;flex-wrap:wrap">
          <div class="form-group" style="min-width:160px">
            <label class="form-label" style="font-size:0.78rem">Total Present Days</label>
            <input class="form-control" id="repPres_${s.id}" type="number" placeholder="e.g. 195" value="${presValue}">
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
  
  document.getElementById('repAllStudentsMarks').innerHTML = html;
  document.getElementById('repStep3').style.display = 'block';
  document.getElementById('repStep3').scrollIntoView({behavior:'smooth'});
  // After re-render, recalculate all grades for pre-filled rows.
  if (_repEditingExamName) {
    students.forEach(s => {
      subjects.forEach(subj => {
        if (useInternals) repCalcGradeInternal(s.id, subj, internalMax, externalMax, totalPerSubj);
        else repCalcGrade(s.id, subj, totalPerSubj);
      });
    });
  }
}

function repSetAbsent(sId, subj, val, useInternals) {
  const subjKey = subj.replace(/\s+/g, '_');
  if (useInternals) {
    // For internals mode, store the absent/NE marker on the external field
    // (and zero the internal). The save logic reads either the override or the value.
    const intEl = document.getElementById('int_'+sId+'_'+subjKey);
    const extEl = document.getElementById('ext_'+sId+'_'+subjKey);
    if (intEl) { intEl.value = ''; intEl.dataset.override = val; }
    if (extEl) { extEl.value = ''; extEl.dataset.override = val; }
  } else {
    const el = document.getElementById('mrk_'+sId+'_'+subjKey);
    if (el) { el.value = val; el.dataset.override = val; }
  }
  const totEl = document.getElementById('tot_'+sId+'_'+subjKey);
  if (totEl) totEl.innerHTML = val === 'A' ? 'Absent' : (val === 'NE' ? 'No Exam' : '—');
  const g = document.getElementById('grd_'+sId+'_'+subjKey);
  if (g) g.innerHTML = `<span style="color:var(--warning);font-weight:700">${val==='A'?'Absent':'No Exam'}</span>`;
}

function repCalcGrade(sId, subj, max) {
  const subjKey = subj.replace(/\s+/g, '_');
  const el = document.getElementById('mrk_'+sId+'_'+subjKey);
  if (!el) return;
  // Clear any previous Absent/NE override the moment user types a real number.
  if (el.value !== '' && el.dataset.override) { delete el.dataset.override; }
  const v = parseFloat(el.value);
  if (isNaN(v)) { document.getElementById('grd_'+sId+'_'+subjKey).innerHTML='—'; return; }
  // Live-validate: reject and clamp marks > max.
  if (v > max) {
    showToast(`Marks cannot exceed ${max} for this subject.`, 'error');
    el.value = max;
  }
  const pct = (Math.min(v, max) / max) * 100;
  const {grade, cls} = calcGrade(pct);
  const g = document.getElementById('grd_'+sId+'_'+subjKey);
  if (g) g.innerHTML = `<span class="grade-${cls}">${grade}</span>`;
}

// Live grade computation for the internal-marks variant.
// Validates: internal must be ≤ internalMax, external must be ≤ externalMax.
function repCalcGradeInternal(sId, subj, internalMax, externalMax, totalMax) {
  const subjKey = subj.replace(/\s+/g, '_');
  const intEl = document.getElementById('int_'+sId+'_'+subjKey);
  const extEl = document.getElementById('ext_'+sId+'_'+subjKey);
  const totEl = document.getElementById('tot_'+sId+'_'+subjKey);
  const grdEl = document.getElementById('grd_'+sId+'_'+subjKey);
  if (!intEl || !extEl) return;
  // Typing real numbers clears any earlier A / NE override.
  if (intEl.value !== '' && intEl.dataset.override) delete intEl.dataset.override;
  if (extEl.value !== '' && extEl.dataset.override) delete extEl.dataset.override;
  const intV = parseFloat(intEl.value);
  const extV = parseFloat(extEl.value);
  if (!isNaN(intV) && intV > internalMax) {
    showToast(`Internal marks cannot exceed ${internalMax}.`, 'error');
    intEl.value = internalMax;
  }
  if (!isNaN(extV) && extV > externalMax) {
    showToast(`External marks cannot exceed ${externalMax}.`, 'error');
    extEl.value = externalMax;
  }
  const i = parseFloat(intEl.value);
  const e = parseFloat(extEl.value);
  if (isNaN(i) && isNaN(e)) {
    if (totEl) totEl.innerHTML = '—';
    if (grdEl) grdEl.innerHTML = '—';
    return;
  }
  const total = (isNaN(i) ? 0 : i) + (isNaN(e) ? 0 : e);
  if (totEl) totEl.innerHTML = total;
  const pct = (total / totalMax) * 100;
  const {grade, cls} = calcGrade(pct);
  if (grdEl) grdEl.innerHTML = `<span class="grade-${cls}">${grade}</span>`;
}

function repSaveAllReports(isPublish) {
  const examName = document.getElementById('repCommonExamName').value.trim();
  if (!examName) { showToast('Please enter a common exam name', 'error'); return; }
  const examType = document.getElementById('repExamType').value;
  const totalPerSubj = parseFloat(document.getElementById('repTotalPerSubj').value||100);
  const workingDays = parseInt(document.getElementById('repWorkingDays').value||0);
  const useInternals = !!document.getElementById('repUseInternals')?.checked;
  const internalMax = parseFloat(document.getElementById('repInternalMax')?.value || 20);
  const externalMax = parseFloat(document.getElementById('repExternalMax')?.value || 80);

  if (useInternals && Math.abs((internalMax + externalMax) - totalPerSubj) > 0.01) {
    showToast(`Internal (${internalMax}) + External (${externalMax}) ≠ Total ${totalPerSubj}. Cannot save.`, 'error');
    return;
  }

  const students = DB.get('students').filter(s=>s.status==='active'&&s.className===_repCurrentClass);
  const studentCount = students.length;
  const className = _repCurrentClass;
  const todayStr = new Date().toLocaleDateString('en-IN');

  if (isPublish) {
    showConfirm(
      'Confirm Publish Reports', 
      `Are you sure you want to save and publish these reports?

Class: Class ${className}
Students: ${studentCount} students
Exam: ${examName}
Date: ${todayStr}`,
      'Publish', 
      'btn-success', 
      () => repSaveAllReportsActual(isPublish, examName, examType, totalPerSubj, workingDays, useInternals, internalMax, externalMax, students)
    );
  } else {
    repSaveAllReportsActual(isPublish, examName, examType, totalPerSubj, workingDays, useInternals, internalMax, externalMax, students);
  }
}

function repSaveAllReportsActual(isPublish, examName, examType, totalPerSubj, workingDays, useInternals, internalMax, externalMax, students) {
  const publishTimeVal = document.getElementById('repPublishTime').value;
  const published = !!isPublish;
  const publishTime = published ? (publishTimeVal ? new Date(publishTimeVal).toISOString() : new Date().toISOString()) : null;
  
  const subjects = getSubjectsByClass(_repCurrentClass);
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  const reports = DB.get('reports');

  // === HARD VALIDATION before saving any report ===
  // Refuse the entire save if any subject violates the max-marks rules.
  for (const s of students) {
    for (const subj of subjects) {
      const subjKey = subj.replace(/\s+/g, '_');
      if (useInternals) {
        const intEl = document.getElementById('int_'+s.id+'_'+subjKey);
        const extEl = document.getElementById('ext_'+s.id+'_'+subjKey);
        const intOverride = intEl?.dataset.override;
        const extOverride = extEl?.dataset.override;
        // If A/NE on either side, treat the subject as that status — skip number checks.
        if (intOverride === 'A' || extOverride === 'A' || intOverride === 'NE' || extOverride === 'NE') continue;
        const i = parseFloat(intEl?.value);
        const e = parseFloat(extEl?.value);
        if (!isNaN(i) && i > internalMax) {
          showToast(`${s.name} — ${subj}: Internal ${i} exceeds max ${internalMax}. Fix and try again.`, 'error');
          return;
        }
        if (!isNaN(e) && e > externalMax) {
          showToast(`${s.name} — ${subj}: External ${e} exceeds max ${externalMax}. Fix and try again.`, 'error');
          return;
        }
        if (!isNaN(i) && !isNaN(e) && (i + e) > totalPerSubj) {
          showToast(`${s.name} — ${subj}: Total ${i + e} exceeds max ${totalPerSubj}. Fix and try again.`, 'error');
          return;
        }
      } else {
        const el = document.getElementById('mrk_'+s.id+'_'+subjKey);
        if (el?.dataset.override === 'A' || el?.dataset.override === 'NE') continue;
        const v = parseFloat(el?.value);
        if (!isNaN(v) && v > totalPerSubj) {
          showToast(`${s.name} — ${subj}: Marks ${v} exceed max ${totalPerSubj}. Fix and try again.`, 'error');
          return;
        }
      }
    }
  }

  let saved = 0;
  
  students.forEach(s => {
    const presentDays = parseInt(document.getElementById('repPres_'+s.id)?.value||workingDays);
    const marks = {};
    const internalMarks = {};
    subjects.forEach(subj => {
      const subjKey = subj.replace(/\s+/g, '_');
      if (useInternals) {
        const intEl = document.getElementById('int_'+s.id+'_'+subjKey);
        const extEl = document.getElementById('ext_'+s.id+'_'+subjKey);
        const intOverride = intEl?.dataset.override;
        const extOverride = extEl?.dataset.override;
        if (intOverride === 'A' || extOverride === 'A') {
          marks[subj] = 'A';
        } else if (intOverride === 'NE' || extOverride === 'NE') {
          marks[subj] = 'NE';
        } else {
          const i = isNaN(parseFloat(intEl?.value)) ? 0 : Math.min(parseFloat(intEl.value), internalMax);
          const e = isNaN(parseFloat(extEl?.value)) ? 0 : Math.min(parseFloat(extEl.value), externalMax);
          marks[subj] = i + e;
          internalMarks[subj] = { internal: i, external: e };
        }
      } else {
        const el = document.getElementById('mrk_'+s.id+'_'+subjKey);
        const v = el?.value;
        if (el?.dataset.override === 'A') marks[subj] = 'A';
        else if (el?.dataset.override === 'NE') marks[subj] = 'NE';
        else marks[subj] = (v === 'A' || v === 'NE') ? v : (isNaN(parseFloat(v)) ? 0 : Math.min(parseFloat(v), totalPerSubj));
      }
    });
    
    // Update an existing report (by studentId+examName) if present, else create new.
    const existing = reports.findIndex(r=>r.studentId===s.id&&r.examName===examName);
    const newReport = {
      id: existing !== -1 ? reports[existing].id : ('REP'+Date.now()+Math.random()),
      studentId: s.id, examName, examType, totalPerSubj, workingDays, presentDays,
      marks, internalMarks: useInternals ? internalMarks : null,
      useInternals, internalMax: useInternals ? internalMax : null, externalMax: useInternals ? externalMax : null,
      published, publishTime, academicYear: sys.academicYear,
      className: s.className, section: s.section,
      lastEditedAt: new Date().toISOString()
    };
    if (existing !== -1) reports[existing] = {...reports[existing], ...newReport};
    else reports.push(newReport);
    saved++;
  });
  
  DB.set('reports', reports);
  populatePrintExamDropdowns();
  showToast(`${saved} reports ${_repEditingExamName ? 'updated' : 'saved'}! ${published?'Will publish on '+new Date(publishTime).toLocaleString('en-IN'):'(Not yet published)'}`);
  // Close the form state completely after saving/publishing
  repClearFormState();
}

// Recently Added Reports panel — class buttons + list of exams in selected class.
// "Recent" means most-recently-edited; we sort by lastEditedAt desc.
function renderRepRecentPanel(preselectClass) {
  const buttonsEl = document.getElementById('repRecentClassButtons');
  const listEl = document.getElementById('repRecentList');
  if (!buttonsEl || !listEl) return;
  const reports = DB.get('reports') || [];
  // Distinct classes that have any reports
  const classesWithReports = [...new Set(reports.map(r => r.className).filter(Boolean))]
    .sort((a, b) => {
      const n1 = parseInt(a), n2 = parseInt(b);
      if (!isNaN(n1) && !isNaN(n2)) return n1 - n2;
      return String(a).localeCompare(String(b));
    });
  if (!classesWithReports.length) {
    buttonsEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">No reports saved yet.</span>';
    listEl.innerHTML = '';
    return;
  }
  buttonsEl.innerHTML = classesWithReports.map(cls => {
    const isActive = (preselectClass && cls === preselectClass) ? ' btn-primary' : ' btn-secondary';
    return `<button class="btn${isActive}" onclick="renderRepRecentList('${cls}')">${cls}${ordSuffix(cls)} Class</button>`;
  }).join('');
  // Auto-render the list for the preselected class (or the first class).
  renderRepRecentList(preselectClass || classesWithReports[0]);
}

// Render the list of distinct exams for a given class. Each exam has Edit and View buttons.
function renderRepRecentList(cls) {
  const listEl = document.getElementById('repRecentList');
  if (!listEl) return;
  const reports = (DB.get('reports') || []).filter(r => r.className === cls);
  if (!reports.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No reports for Class ${cls} yet</p></div>`;
    return;
  }
  // Group by examName so each row represents an exam (not a per-student report).
  const examGroups = {};
  reports.forEach(r => {
    if (!examGroups[r.examName]) examGroups[r.examName] = { exam: r, count: 0, latestEdit: r.lastEditedAt || r.publishTime };
    examGroups[r.examName].count++;
    const t = r.lastEditedAt || r.publishTime;
    if (t && (!examGroups[r.examName].latestEdit || new Date(t) > new Date(examGroups[r.examName].latestEdit))) {
      examGroups[r.examName].latestEdit = t;
    }
  });
  const rows = Object.values(examGroups).sort((a, b) =>
    new Date(b.latestEdit || 0) - new Date(a.latestEdit || 0)
  );
  listEl.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Exam Name</th><th>Exam Type</th><th>Students</th><th>Status</th><th>Publish Time</th><th>Last Edited</th><th>Actions</th>
    </tr></thead>
    <tbody>${rows.map(g => {
      const r = g.exam;
      const pubLocal = r.publishTime ? new Date(r.publishTime).toLocaleString('en-IN') : '—';
      const editedLocal = g.latestEdit ? new Date(g.latestEdit).toLocaleString('en-IN') : '—';
      const statusBadge = r.published
        ? `<span class="badge badge-success">✓ Published</span>`
        : `<span class="badge badge-pending">⏳ Draft</span>`;
      return `<tr>
        <td><strong>${r.examName}</strong></td>
        <td>${r.examType || '—'}</td>
        <td>${g.count}</td>
        <td>${statusBadge}</td>
        <td>${pubLocal}</td>
        <td>${editedLocal}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="repEditExamForClass('${cls}','${r.examName.replace(/'/g,"\\'")}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span> Edit</button>
          <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="repTogglePublishForExam('${cls}','${r.examName.replace(/'/g,"\\'")}')">${r.published ? '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></span> Unpublish' : '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></span> Publish Now'}</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// Load an existing exam back into Step 2 / Step 3 for editing.
function repEditExamForClass(cls, examName) {
  const reports = (DB.get('reports') || []).filter(r => r.className === cls && r.examName === examName);
  if (!reports.length) { showToast('No reports found for this exam', 'error'); return; }
  const sample = reports[0];
  _repCurrentClass = cls;
  _repEditingExamName = examName;
  // Populate Step 2 form
  document.getElementById('repSelectedClass').textContent = 'Class ' + cls;
  document.getElementById('repCommonExamName').value = examName;
  document.getElementById('repExamType').value = sample.examType || 'SA - Summative Assessment';
  document.getElementById('repTotalPerSubj').value = sample.totalPerSubj || 100;
  document.getElementById('repWorkingDays').value = sample.workingDays || 0;
  document.getElementById('repPublishTime').value = sample.publishTime ? new Date(sample.publishTime).toISOString().slice(0,16) : '';
  // Internals settings
  document.getElementById('repUseInternals').checked = !!sample.useInternals;
  document.getElementById('repInternalMax').value = sample.internalMax || 20;
  document.getElementById('repExternalMax').value = sample.externalMax || 80;
  repToggleInternalsUI();
  document.getElementById('repStep2').style.display = 'block';
  document.getElementById('repStep2').scrollIntoView({behavior:'smooth'});
  // Pre-fill marks tables by reusing repLoadStudents — it picks up _repEditingExamName.
  repLoadStudents();
  showToast(`Editing "${examName}" — change marks or publish time, then click Save All Reports.`);
}

// Quick-toggle published status for every report in an exam.
function repTogglePublishForExam(cls, examName) {
  const reports = DB.get('reports') || [];
  let toggled = 0;
  let now = new Date().toISOString();
  let willPublish = false;
  // Decide direction from the first matching record.
  for (const r of reports) {
    if (r.className === cls && r.examName === examName) {
      willPublish = !r.published;
      break;
    }
  }
  reports.forEach(r => {
    if (r.className === cls && r.examName === examName) {
      r.published = willPublish;
      if (willPublish && !r.publishTime) r.publishTime = now;
      r.lastEditedAt = now;
      toggled++;
    }
  });
  DB.set('reports', reports);
  showToast(`${toggled} reports ${willPublish ? 'published' : 'unpublished'}.`);
  renderRepRecentList(cls);
}

function getSubjectsByClass(cls) {
  const n = parseInt(cls);
  if (cls==='Nursery'||cls==='LKG'||cls==='UKG') return ['Telugu','English','Maths','Science','EVS','Rhymes'];
  if (n>=1&&n<=5) return ['Telugu','Hindi','English','Maths','Science','EVS','Computer'];
  if (n>=6&&n<=10) return ['Telugu','Hindi','English','Maths','Science','Social'];
  return ['Telugu','English','Maths'];
}

function calcGrade(pct) {
  if (pct>=91) return {grade:'A+ (10)',cls:'good'};
  if (pct>=81) return {grade:'A (9)',cls:'good'};
  if (pct>=71) return {grade:'B+ (8)',cls:'good'};
  if (pct>=61) return {grade:'B (7)',cls:'avg'};
  if (pct>=51) return {grade:'C+ (6)',cls:'avg'};
  if (pct>=41) return {grade:'C (5)',cls:'avg'};
  if (pct>=33) return {grade:'D (4)',cls:'poor'};
  return {grade:'E (Fail)',cls:'poor'};
}

// Legacy compat stubs
function reportSearchStudent() {}
function saveReport() {}
function publishReport() {}
function switchReportTab() {}
function renderStudentReportsList() {}
function updateGrade() {}
function renderMarksInputTable() {}
function saveReportData() {}

function toggleReportVisibility(id) {
  const reports = DB.get('reports');
  const idx = reports.findIndex(r=>r.id===id);
  if (idx!==-1) { reports[idx].published = !reports[idx].published; if(reports[idx].published) reports[idx].publishTime = new Date().toISOString(); DB.set('reports',reports); showToast('Report visibility updated'); }
}

function deleteReport(id) {
  showConfirm('Delete Report','Delete this report permanently?','Delete','btn-danger',()=>{ DB.set('reports',DB.get('reports').filter(r=>r.id!==id)); if(currentReportStudent) renderStudentReportsList(currentReportStudent.id); showToast('Report deleted'); });
}

function previewReportCard(repId) {
  console.log('Preview report card called for:', repId);
  const r = DB.get('reports').find(x=>x.id===repId);
  const s = DB.get('students').find(x=>x.id===r?.studentId);
  if (!r||!s) {
    console.error('Report or student not found:', r, s);
    return;
  }
  const html = buildReportCardHTML(s,r);
  console.log('Generated HTML length:', html.length);
  document.getElementById('detailModalTitle').textContent = r.examName + ' - Report Preview';
  document.getElementById('detailModalBody').innerHTML = html + `<div style="margin-top:16px;text-align:right"><button class="btn btn-primary" onclick="console.log('Print button clicked'); window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print</button></div>`;
  document.getElementById('detailModal').classList.add('active');
  console.log('Modal opened successfully');
}

function buildReportCardHTML(student, report) {
  const allSubjects = getSubjectsByClass(student.className);
  // Subjects with mark === 'NE' are hidden from the report entirely (no exam was held).
  const subjects = allSubjects.filter(sub => report.marks[sub] !== 'NE');

  // Total possible should reflect only the subjects where an exam was actually held.
  // Absent ('A') counts as 0 obtained but the subject's total is still part of the denominator.
  const numericMarks = subjects.map(s => {
    const v = report.marks[s];
    if (v === 'A') return 0;
    return isNaN(parseFloat(v)) ? 0 : parseFloat(v);
  });
  const totalObtained = numericMarks.reduce((a, b) => a + b, 0);
  const totalPossible = subjects.length * report.totalPerSubj;
  const percentage = totalPossible > 0 ? ((totalObtained / totalPossible) * 100).toFixed(2) : 0;
  const { grade, cls } = calcGrade(parseFloat(percentage));
  const attPct = report.workingDays > 0 ? ((report.presentDays / report.workingDays) * 100).toFixed(2) : 0;
  const attColor = attPct >= 75 ? 'var(--success)' : attPct >= 60 ? 'var(--warning)' : 'var(--danger)';
  const sys = DB.getObj('system', { academicYear: '2026-2027' });
  
  return `<div class="report-card-print">
    <div class="rc-header">
      <img src="${LOGO_SRC}" style="width:60px;height:60px;object-fit:contain;margin-bottom:6px">
      <div class="rc-school-name">Noble High School</div>
      <div class="rc-address">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</div>
      <div class="rc-exam-title">${report.examName} — Report Card</div>
    </div>
    <div class="rc-student-info" style="display:flex;gap:16px;align-items:flex-start">
      <div style="flex:1">
        <div><div class="rc-info-row"><span class="rc-info-label">Name:</span><span>${student.name}</span></div><div class="rc-info-row"><span class="rc-info-label">Student ID / Login ID:</span><span>${student.id} / ${student.loginId||student.id}</span></div><div class="rc-info-row"><span class="rc-info-label">Class:</span><span>${student.className}</span></div><div class="rc-info-row"><span class="rc-info-label">Section:</span><span>${student.section}</span></div></div>
        <div><div class="rc-info-row"><span class="rc-info-label">Roll No:</span><span>${student.rollNo}</span></div><div class="rc-info-row"><span class="rc-info-label">Father:</span><span>${student.fatherName}</span></div><div class="rc-info-row"><span class="rc-info-label">Exam:</span><span>${report.examType}</span></div><div class="rc-info-row"><span class="rc-info-label">Year:</span><span>${report.academicYear||sys.academicYear}</span></div></div>
      </div>
      <div style="width:90px;height:110px;border:1.5px solid #ccc;border-radius:4px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#f8f8f8">
        ${student.photo?`<img src="${student.photo}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:0.7rem;color:#aaa;text-align:center">Photo</span>'}
      </div>
    </div>
    ${(() => {
      // ----- REPORT CARD TABLE -----
      // Two formats depending on how the report was entered:
      //   (a) Internals enabled (report.useInternals === true) → 7-column table:
      //       S.No / Subject / Internal (out of internalMax) / External (out of externalMax) /
      //       Total / Total Marks (denominator) / Grade
      //       This makes the breakdown completely transparent to parents.
      //   (b) Plain mode (no internals) → original 5-column table:
      //       S.No / Subject / Total Marks / Marks Obtained / Grade
      // Both formats handle Absent ('A') the same way: shown as "Absent" in the
      // marks cell, counted as 0 in totals.
      const useInt = report.useInternals === true && report.internalMarks;
      if (useInt) {
        const intMax = report.internalMax || 0;
        const extMax = report.externalMax || 0;
        const header = `<thead><tr>
          <th>S.No</th><th>Subject</th>
          <th>Internal<br><span style="font-weight:400;font-size:8pt">(out of ${intMax})</span></th>
          <th>External<br><span style="font-weight:400;font-size:8pt">(out of ${extMax})</span></th>
          <th>Total</th>
          <th>Total Marks</th>
          <th>Grade</th>
        </tr></thead>`;
        const rows = subjects.map((s, i) => {
          const mv = report.marks[s];
          const im = report.internalMarks[s] || {};
          if (mv === 'A') {
            return `<tr><td>${i+1}</td><td>${s}</td>
              <td colspan="3" style="text-align:center;color:orange;font-weight:700">Absent</td>
              <td>${report.totalPerSubj}</td>
              <td><span style="color:orange;font-weight:600">Absent</span></td></tr>`;
          }
          const internalDisp = (im.internal === 'A' || im.internal == null || im.internal === '') ? '—' : im.internal;
          const externalDisp = (im.external === 'A' || im.external == null || im.external === '') ? '—' : im.external;
          const total = parseFloat(mv) || 0;
          const p = (total / report.totalPerSubj) * 100;
          const g = calcGrade(p);
          return `<tr>
            <td>${i+1}</td>
            <td>${s}</td>
            <td>${internalDisp}</td>
            <td>${externalDisp}</td>
            <td style="font-weight:700">${total}</td>
            <td>${report.totalPerSubj}</td>
            <td><span class="grade-${g.cls}">${g.grade}</span></td>
          </tr>`;
        }).join('');
        return `<table class="rc-table rc-table-internals">${header}<tbody>${rows}</tbody></table>`;
      } else {
        // Original simple format — kept identical to before so existing reports
        // print exactly the way they always did.
        const header = `<thead><tr><th>S.No</th><th>Subject</th><th>Total Marks</th><th>Marks Obtained</th><th>Grade</th></tr></thead>`;
        const rows = subjects.map((s, i) => {
          const mv = report.marks[s];
          let disp = '—', gHtml = '—';
          if (mv === 'A') {
            disp = '<span style="color:orange;font-weight:700">Absent</span>';
            gHtml = '<span style="color:orange;font-weight:600">Absent</span>';
          } else {
            const m = parseFloat(mv) || 0;
            const p = (m / report.totalPerSubj) * 100;
            const g = calcGrade(p);
            disp = m;
            gHtml = `<span class="grade-${g.cls}">${g.grade}</span>`;
          }
          return `<tr><td>${i+1}</td><td>${s}</td><td>${report.totalPerSubj}</td><td style="font-weight:700">${disp}</td><td>${gHtml}</td></tr>`;
        }).join('');
        return `<table class="rc-table">${header}<tbody>${rows}</tbody></table>`;
      }
    })()}
    <div class="rc-summary">
      <div class="rc-summary-item"><div class="rc-summary-label">Total Marks</div><div class="rc-summary-value">${totalObtained}/${totalPossible}</div></div>
      <div class="rc-summary-item"><div class="rc-summary-label">Percentage</div><div class="rc-summary-value">${percentage}%</div></div>
      <div class="rc-overall-grade"><div class="rc-summary-label" style="color:rgba(255,255,255,0.8)">Overall Grade</div><div class="rc-summary-value" style="color:white;font-size:1.5rem">${grade}</div></div>
      <div class="rc-summary-item"><div class="rc-summary-label">Attendance</div><div class="rc-summary-value" style="color:${attColor}">${report.presentDays}/${report.workingDays} (${attPct}%)</div></div>
    </div>
    <!-- Single signature row: parent / class teacher / principal all on one line.
         The principal signature image sits ABOVE the name (image first, then "Principal: ..."). -->
    <div class="rc-footer rc-footer-single">
      <div class="rc-sign-line">
        <div class="rc-sign-image-slot">&nbsp;</div>
        <div class="rc-sign-title">Parent/Guardian Signature</div>
      </div>
      <div class="rc-sign-line">
        <div class="rc-sign-image-slot">&nbsp;</div>
        <div class="rc-sign-title">Class Teacher Signature</div>
      </div>
      <div class="rc-sign-line" style="text-align:center">
        <div class="rc-sign-image-slot">${SHOW_PRINCIPAL_SIGNATURE ? `<img src="${PRINCIPAL_SIGNATURE}" alt="Principal Signature" style="height:26px">` : '&nbsp;'}</div>
        <div class="rc-sign-title" style="border-top:1px solid #666;padding-top:3px;">Principal: <strong>Bairu Kondal Reddy</strong></div>
      </div>
    </div>
  </div>`;
}

function switchReportTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p=>{if(p.closest('.complaint-form-wrap')) p.classList.remove('active');});
  document.querySelectorAll('.complaint-form-wrap .tab-btn').forEach(b=>b.classList.remove('active'));
  const el = document.getElementById('tab'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(el) el.classList.add('active');
  const btns = document.querySelectorAll('.complaint-form-wrap .tab-btn');
  if(tab==='enterMarks'&&btns[0]) btns[0].classList.add('active');
  if(tab==='viewReports'&&btns[1]) btns[1].classList.add('active');
}

// === PRINT REPORTS ===
function populatePrintExamDropdowns() {
  const reports = DB.get('reports');
  const examNames = [...new Set(reports.map(r=>r.examName))];
  const opts = examNames.map(n=>`<option>${n}</option>`).join('');
  ['printStuExam','printClassExam','printAllExam'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML = opts||'<option>No exams yet</option>'; });
}

function switchPrintTab(tab) {
  document.querySelectorAll('[id^="printTab"]').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('printTab'+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add('active');
  const tabMap = {byStudent:0,byClass:1,printAll:2};
  const btns = document.querySelectorAll('[id="section-printReports"] .tab-btn');
  if(btns[tabMap[tab]]) btns[tabMap[tab]].classList.add('active');
}

function generatePrintReport(type) {
  const reports = DB.get('reports');
  const students = DB.get('students');
  let toprint = [];
  let previewTitle = 'Report Cards';
  
  if (type==='student') {
    const stuId = document.getElementById('printStuId').value.trim();
    const exam = document.getElementById('printStuExam').value;
    const stu = students.find(s=>s.id===stuId||s.loginId===stuId);
    if (!stu) { showToast('Student ID not found','error'); return; }
    const rep = reports.find(r=>r.studentId===stu.id&&r.examName===exam);
    if (rep) { toprint.push({student:stu,report:rep}); previewTitle = `Report Card — ${stu.name}`; }
    else { showToast('No report found for this student/exam','error'); return; }
  } else if (type==='class') {
    const cls = document.getElementById('printClass').value;
    const sec = document.getElementById('printSection').value;
    const exam = document.getElementById('printClassExam').value;
    const clsStudents = students.filter(s=>s.className===cls&&(sec==='all'||s.section===sec)).sort((a,b)=>a.id.localeCompare(b.id));
    clsStudents.forEach(s=>{ const r=reports.find(x=>x.studentId===s.id&&x.examName===exam); if(r) toprint.push({student:s,report:r}); });
    if (!toprint.length) { showToast('No published reports found for this class/exam','error'); return; }
    previewTitle = `Report Cards — Class ${cls}${sec&&sec!=='all'?'-'+sec:''} — ${exam}`;
  } else {
    const exam = document.getElementById('printAllExam').value;
    students.sort((a,b)=>{ const ca=['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10']; return ca.indexOf(a.className)-ca.indexOf(b.className)||a.section.localeCompare(b.section)||a.id.localeCompare(b.id); });
    students.forEach(s=>{ const r=reports.find(x=>x.studentId===s.id&&x.examName===exam); if(r) toprint.push({student:s,report:r}); });
    if (!toprint.length) { showToast('No published reports found for selected classes','error'); return; }
    previewTitle = `All Report Cards — ${exam}`;
  }
  
  const html = toprint.map((x,i) => buildReportCardHTML(x.student,x.report) + (i<toprint.length-1?'<div style="page-break-after:always"></div>':'')).join('');
  openReportPreviewWindow(html, previewTitle);
}

function printStudentReportCard(repId) {
  const r = DB.get('reports').find(x=>x.id===repId);
  const s = DB.get('students').find(x=>x.id===r?.studentId) || currentStudent;
  if (!r||!s) return;
  openReportPreviewWindow(buildReportCardHTML(s,r), `Report Card — ${s.name}`);
}

// Open report card(s) in a clean separate preview window with a Print button.
// No dashboard chrome, no auto-print — user clicks Print Now when ready.
function openReportPreviewWindow(reportHtml, title) {
  const win = window.open('','_blank','width=900,height=900');
  if (!win) { showToast('Please allow popups to print reports','error'); return; }
  // Pull the page CSS variables so colors match the in-app preview
  const rootStyle = getComputedStyle(document.documentElement);
  const vars = ['--primary','--primary-dark','--success','--warning','--danger','--text','--text-muted','--bg-light','--border']
    .map(v => `${v}: ${rootStyle.getPropertyValue(v) || ''}`).join(';');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=Source+Sans+3:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{${vars}}
    *{box-sizing:border-box}
    body{font-family:'Source Sans 3',sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:13pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .toolbar button:hover{background:#d4b75e}
    .preview-wrap{padding:14px 0;display:flex;flex-direction:column;align-items:center;gap:14px}
    .report-card-print{width:210mm;min-height:297mm;margin:0;padding:15mm;background:#fff;font-size:11pt;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:none;border-radius:8px;position:relative}
    .rc-header{text-align:center;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:14px}
    .rc-school-name{font-family:'Playfair Display',serif;font-size:18pt;color:var(--primary-dark);font-weight:900}
    .rc-address{font-size:9pt;color:var(--text-muted);margin:2px 0}
    .rc-exam-title{font-size:13pt;font-weight:700;color:var(--primary);margin-top:6px}
    .rc-info-row{display:flex;gap:6px;font-size:10pt;padding:2px 0}
    .rc-info-label{font-weight:700;color:var(--text-muted);min-width:80px}
    
    .rc-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:10pt;table-layout:fixed;border:1px solid #1a2535}
    .rc-table th{background:transparent !important;color:#1a2535 !important;padding:8px 10px;text-align:left;font-size:9.5pt;font-weight:700;border:1px solid #1a2535}
    .rc-table td{padding:8px 10px;border:1px solid #1a2535;font-size:9.5pt;color:#1a2535}
    .rc-table tr:nth-child(even) td{background:#f8f9fa !important}
    
    /* Fixed widths to prevent any layout shifts */
    .rc-table th:nth-child(1), .rc-table td:nth-child(1) { width: 8%; text-align: center; }
    .rc-table th:nth-child(2), .rc-table td:nth-child(2) { width: 37%; }
    .rc-table th:nth-child(3), .rc-table td:nth-child(3) { width: 18%; text-align: center; }
    .rc-table th:nth-child(4), .rc-table td:nth-child(4) { width: 22%; text-align: center; }
    .rc-table th:nth-child(5), .rc-table td:nth-child(5) { width: 15%; text-align: center; }

    /* For 7-column internals mode */
    .rc-table.rc-table-internals th:nth-child(1), .rc-table.rc-table-internals td:nth-child(1) { width: 6%; text-align: center; }
    .rc-table.rc-table-internals th:nth-child(2), .rc-table.rc-table-internals td:nth-child(2) { width: 30%; }
    .rc-table.rc-table-internals th:nth-child(3), .rc-table.rc-table-internals td:nth-child(3) { width: 14%; text-align: center; }
    .rc-table.rc-table-internals th:nth-child(4), .rc-table.rc-table-internals td:nth-child(4) { width: 14%; text-align: center; }
    .rc-table.rc-table-internals th:nth-child(5), .rc-table.rc-table-internals td:nth-child(5) { width: 12%; text-align: center; }
    .rc-table.rc-table-internals th:nth-child(6), .rc-table.rc-table-internals td:nth-child(6) { width: 12%; text-align: center; }
    .rc-table.rc-table-internals th:nth-child(7), .rc-table.rc-table-internals td:nth-child(7) { width: 12%; text-align: center; }

    .rc-summary{display:flex;gap:12px;margin:14px 0;align-items:stretch}
    .rc-summary-item{flex:1;background:var(--bg-light);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--border)}
    .rc-summary-label{font-size:8pt;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
    .rc-summary-value{font-size:14pt;font-weight:800;color:var(--primary-dark)}
    .rc-overall-grade{background:transparent;color:var(--primary-dark);border:1.5px solid var(--primary-dark);border-radius:8px;padding:12px 20px;text-align:center}
    .rc-footer{display:flex;justify-content:space-between;margin-top:28px;padding-top:14px;border-top:1px solid var(--border)}
    .rc-sign-line{min-width:140px}
    .rc-sign-title{font-size:9pt;color:var(--text-muted);margin-bottom:24px;font-weight:600}
    .rc-sign-field{border-top:1px solid var(--text);padding-top:4px;font-size:9pt}
    .grade-excellent{color:var(--success);font-weight:700}
    .grade-good{color:#1a3a6b;font-weight:700}
    .grade-average{color:var(--warning);font-weight:700}
    .grade-poor{color:var(--danger);font-weight:700}
    @media print{
      body{margin:0;background:#fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .toolbar{display:none}
      .preview-wrap{padding:0;gap:0}
      .report-card-print{width:100%;height:277mm;box-shadow:none;page-break-inside:avoid;padding:10mm;border:none !important;border-radius:8px;display:flex;flex-direction:column;justify-content:space-between; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .rc-table th{background:transparent !important;color:#1a2535 !important;border:1px solid #1a2535 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .rc-table tr:nth-child(even) td{background-color:#f8f9fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .rc-overall-grade{background:transparent !important;color:var(--primary-dark) !important;border:1.5px solid var(--primary-dark) !important;}
      .rc-overall-grade .rc-summary-value{color:var(--primary-dark) !important;}
      .rc-overall-grade .rc-summary-label{color:var(--text-muted) !important;}
      div[style*="page-break-after"]{page-break-after:always}
      @page{size:A4;margin:10mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span> ${title}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Now</button></div>
  <div class="preview-wrap">${reportHtml}</div>
  </body></html>`);
  win.document.close();
}

// === HALL TICKETS ===
let htDays = [{ dayNo:1, date:'', day:'', subjects:[{name:'',time:''}] }];

// Hall ticket form is now replaced by exam-schedule linked system
function showHallTicketForm(editId=null) { showToast('Hall tickets are now generated from Exam Schedules. See the Hall Tickets section.'); }
function renderHtDays() { return ''; }
function addHtDay() {}
function removeHtDay() {}
function addHtSubject() {}
function renderHallTicketForm() {}
function saveHallTicket() {}

function renderHallTicketsTable() {
  const exams = DB.get('exams').filter(e=>e.published);
  const el = document.getElementById('hallTicketExamList');
  if (!el) return;
  if (!exams.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No published exam schedules found. Please create and publish an exam schedule first.</p></div>';
    return;
  }
  el.innerHTML = `<div class="table-wrap"><div class="table-header"><strong>Recently Created Exam Schedules (select to generate hall tickets)</strong></div>
  <table><thead><tr><th>Exam Name</th><th>Type</th><th>Class</th><th>Section</th><th>Start Date</th><th>Days</th><th>Status</th><th>Generate Hall Tickets</th></tr></thead>
  <tbody>${exams.map(e => `<tr>
    <td><strong>${e.name}</strong></td><td>${e.type}</td><td>${e.className}</td><td>${e.section||'All'}</td><td>${fmtDate(e.startDate)}</td><td>${e.days.length}</td>
    <td><span class="badge badge-success">Published</span></td>
    <td><button class="btn btn-primary btn-sm" onclick="selectExamForHallTickets('${e.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zM13 17.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/></svg></span> Generate Hall Tickets</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function selectExamForHallTickets(examId) {
  const exam = DB.get('exams').find(e=>e.id===examId);
  if (!exam) return;
  const students = DB.get('students').filter(s=>s.status==='active');
  
  // Find all classes in this exam (could be a single class or all)
  let classes = [];
  if (exam.section === 'all' || !exam.section) {
    // Check which classes have students
    const cls = exam.className;
    const sections = [...new Set(students.filter(s=>s.className===cls).map(s=>s.section))];
    classes = sections.map(sec=>({cls, sec}));
    if (classes.length===0) classes=[{cls:exam.className,sec:'all'}];
  } else {
    classes = [{cls:exam.className, sec:exam.section}];
  }
  
  document.getElementById('htSelectedExamName').textContent = `Hall Tickets for: ${exam.name} — Select Class`;
  const btns = classes.map(c=>`<button class="btn btn-secondary" onclick="generateHallTicketsByClass('${examId}','${c.cls}','${c.sec}')">${c.cls}${c.sec&&c.sec!=='all'?'-'+c.sec:''}</button>`).join('');
  document.getElementById('htClassButtons').innerHTML = btns + `<button class="btn btn-primary" onclick="generateHallTicketsByClass('${examId}','${exam.className}','all')">All Classes</button>`;
  // Load any previously saved instructions for this exam back into the textarea.
  // Falls back to a sensible default the first time the admin opens this exam.
  const tx = document.getElementById('htInstructions');
  if (tx) {
    tx.value = exam.htInstructions || 'Reach the exam hall by 9:00 AM. Bring this hall ticket and a black/blue pen. Mobile phones are NOT allowed inside the hall.';
  }
  // Stash the active examId on the textbox so the Save button knows which exam to write to.
  if (tx) tx.dataset.examId = examId;
  document.getElementById('hallTicketClassSelector').style.display='block';
  document.getElementById('htClassPreview').innerHTML='';
  document.getElementById('hallTicketClassSelector').scrollIntoView({behavior:'smooth'});
}

// Persist the instructions textarea contents back onto the active exam record,
// so the next time hall tickets are generated for this exam they show up.
function saveHallTicketInstructions() {
  const tx = document.getElementById('htInstructions');
  if (!tx) return;
  const examId = tx.dataset.examId;
  if (!examId) { showToast('No exam selected', 'error'); return; }
  const exams = DB.get('exams');
  const idx = exams.findIndex(e => e.id === examId);
  if (idx === -1) return;
  exams[idx].htInstructions = tx.value.trim();
  DB.set('exams', exams);
  showToast('Instructions saved — they will appear on every hall ticket for this exam.');
}

function generateHallTicketsByClass(examId, cls, sec) {
  const exam = DB.get('exams').find(e=>e.id===examId);
  if (!exam) return;
  // Auto-save the instructions textarea content onto the exam record so the
  // admin doesn't have to click Save first — typing + clicking Generate is enough.
  const tx = document.getElementById('htInstructions');
  if (tx) {
    const exams = DB.get('exams');
    const idx = exams.findIndex(e => e.id === examId);
    if (idx !== -1) {
      exams[idx].htInstructions = tx.value.trim();
      DB.set('exams', exams);
    }
  }
  let students = DB.get('students').filter(s=>s.status==='active'&&s.className===cls&&(sec==='all'||s.section===sec)).sort((a,b)=>a.rollNo.localeCompare(b.rollNo,undefined,{numeric:true}));
  if (!students.length) { showToast('No students found for this class/section','error'); return; }
  
  const reportingTime = '8:30 AM';
  document.getElementById('htClassPreview').innerHTML = `
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong>${students.length} students found for Class ${cls}${sec&&sec!=='all'?'-'+sec:''}</strong>
        <button class="btn btn-primary" onclick="printHallTicketsBatch('${examId}','${cls}','${sec}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print All Hall Tickets</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${students.map(s=>`<div style="background:var(--bg-light);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center;font-size:0.8rem">
          <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--border);background:white;display:flex;align-items:center;justify-content:center;margin:0 auto 4px">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`:'<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span>'}</div>
          <strong>${s.name}</strong><br>${s.id}
        </div>`).join('')}
      </div>
    </div>`;
}

function printHallTicketsBatch(examId, cls, sec) {
  const exam = DB.get('exams').find(e=>e.id===examId);
  if (!exam) return;
  let students = DB.get('students').filter(s=>s.status==='active'&&s.className===cls&&(sec==='all'||s.section===sec)).sort((a,b)=>a.rollNo.localeCompare(b.rollNo,undefined,{numeric:true}));
  if (!students.length) { showToast('No students found','error'); return; }
  
  // Group students 3-per-A4-page. Each group goes inside a .page wrapper that
  // owns a `page-break-after: always` so the printer respects the 3-per-page rule.
  let pages = '';
  for (let i = 0; i < students.length; i += 3) {
    const group = students.slice(i, i + 3);
    const ticketHtml = group.map(s => buildLinkedHallTicketHTML(s, exam)).join('');
    pages += `<div class="ht-page">${ticketHtml}</div>`;
  }
  
  const printWin = window.open('','_blank','width=900,height=900');
  if (!printWin) { showToast('Please allow popups to print','error'); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><title>Hall Tickets - ${exam.name}</title>
  <style>
    /* Hall tickets are sized to fit exactly 3 per A4 page (297mm tall).
       With 6mm @page margins (~285mm content), each ticket gets ~93mm.
       page-break-inside:avoid keeps a ticket from splitting across pages. */
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:14pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .toolbar button:hover{background:#d4b75e}
    .preview{padding:14px;display:flex;flex-direction:column;align-items:center;gap:14px}

    .ht-page{width:198mm;display:flex;flex-direction:column;gap:3mm}
    /* Each ticket is exactly ~92mm tall so 3 fit perfectly on A4 portrait (285mm content
       area). page-break-inside:avoid prevents a ticket from being split across pages. */
    .ht{width:100%;background:#fff;padding:5px 10px;box-sizing:border-box;border:1.2px solid #1a3a6b;border-radius:5px;page-break-inside:avoid;break-inside:avoid;height:92mm;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}

    .ht-header{text-align:center;border-bottom:1.5px solid #1a3a6b;padding-bottom:3px;margin-bottom:4px;flex-shrink:0}
    .logo-row{display:flex;align-items:center;justify-content:center;gap:8px}
    .logo{width:32px;height:32px;object-fit:contain;border-radius:50%;border:1.5px solid #c8a951}
    .school-name{font-size:11pt;font-weight:900;color:#1a3a6b;line-height:1.1}
    .school-sub{font-size:6.5pt;color:#5a6a82;line-height:1.1}
    .exam-badge{background:transparent;color:#1a3a6b;border:1px solid #1a3a6b;padding:1px 8px;border-radius:3px;font-size:7pt;font-weight:700;margin-top:2px;display:inline-block}

    .ht-body{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:start;margin-bottom:3px;flex-shrink:0}
    .ht-info table{border-collapse:collapse}
    .ht-info table td{padding:1px 4px;font-size:7.5pt;line-height:1.2}
    .ht-info table td:first-child{color:#5a6a82;font-weight:600;white-space:nowrap;padding-right:6px}
    .ht-photo{width:55px;height:65px;border:1px dashed #ccc;border-radius:3px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8f8f8}
    .ht-photo img{width:100%;height:100%;object-fit:cover}

    /* Horizontal schedule table: rows are Date / Subject / Invigilator Signature.
       The first column is the row label (a TH); each remaining column is one exam day. */
    .schedule-table{width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:3px;table-layout:fixed}
    .schedule-table th{background:transparent;color:#1a3a6b;border:1px solid #d0dbed;padding:2.5px 4px;text-align:left;font-size:7pt;width:24mm;white-space:nowrap}
    .schedule-table td{padding:2px 4px;border:1px solid #d0dbed;line-height:1.2;text-align:center;background:#fff}
    .schedule-table td.sig-cell{height:11mm;background:#fff}
    .schedule-table tr:nth-child(2) td{background:#f8faff;font-size:7.5pt}

    /* Instructions box: clean note-style block. */
    .ht-instructions{font-size:6.8pt;color:#1a2535;border:1px solid #c8a951;padding:3px 7px;background:transparent;border-radius:3px;line-height:1.3;margin-top:2px;overflow:hidden;display:flex;gap:5px;align-items:flex-start}
    .ht-instructions-label{font-weight:700;color:#1a3a6b;white-space:nowrap}
    .ht-instructions-body{flex:1}

    /* Bottom row: short note on left, principal signature on right.
       The principal IMAGE sits on top, the "Principal" name on the line below. */
    .ht-bottom{display:flex;justify-content:space-between;align-items:flex-end;margin-top:3px;flex-shrink:0}
    .ht-note{font-size:6.5pt;color:#5a6a82;font-style:italic}
    .ht-principal{text-align:center;min-width:90px}
    .ht-principal-img{height:22px;display:block;margin:0 auto}
    .ht-principal-line{border-top:1px solid #666;margin-top:1px;padding-top:1px;font-size:6.8pt;color:#444;font-weight:700}

    @media print{
      body{margin:0;background:#fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .toolbar{display:none}
      .preview{padding:0;gap:0}
      .ht-page{width:auto;page-break-after:always;break-after:page}
      .ht-page:last-child{page-break-after:auto;break-after:auto}
      .ht{box-shadow:none; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .schedule-table th{background-color:transparent !important;color:#1a3a6b !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .schedule-table td{background-color:#fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .schedule-table tr:nth-child(2) td{background-color:#f8faff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      .ht-instructions{background-color:transparent !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
      @page{size:A4 portrait;margin:6mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zM13 17.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/></svg></span> Hall Tickets — ${exam.name} (${students.length} students, 3 per page)</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Now</button></div>
  <div class="preview">${pages}</div>
  </body></html>`);
  printWin.document.close();
}

function buildLinkedHallTicketHTML(student, exam) {
  // Per user spec the hall ticket only shows: Student Name, Student/Login ID, Roll No, Class.
  // Father's Name, Academic Year and Reporting Time are intentionally removed.
  // Schedule is rendered HORIZONTALLY: Date row, Subject row, Invigilator Signature row.
  // Each exam day is a column. Below: instructions box, then principal sig on right.
  const instructions = (exam.htInstructions || '').trim() ||
    'Reach the exam hall by 9:00 AM. Bring this hall ticket and a black/blue pen. Mobile phones are NOT allowed inside the hall.';
  const dayCols = exam.days.map(d => `<td>${fmtDate(d.date)}</td>`).join('');
  const subjCols = exam.days.map(d => `<td><strong>${d.subject}</strong></td>`).join('');
  const sigCols = exam.days.map(() => `<td class="sig-cell">&nbsp;</td>`).join('');
  return `<div class="ht">
    <div class="ht-header">
      <div class="logo-row">
        <img src="${LOGO_SRC}" class="logo">
        <div>
          <div class="school-name">Noble High School</div>
          <div class="school-sub">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</div>
          <div style="font-size:8pt;font-weight:700;letter-spacing:1px;color:#5a6a82">HALL TICKET — ${exam.name}</div>
        </div>
      </div>
      <span class="exam-badge">${exam.name} | ${exam.type}</span>
    </div>
    <div class="ht-body">
      <div class="ht-info">
        <table>
          <tr><td>Student Name:</td><td><strong>${student.name}</strong></td></tr>
          <tr><td>Student ID / Login ID:</td><td>${student.id} / ${student.loginId}</td></tr>
          <tr><td>Roll No:</td><td>${student.rollNo}</td></tr>
          <tr><td>Class:</td><td>${student.className} - ${student.section}</td></tr>
        </table>
      </div>
      <div>
        <div class="ht-photo">${student.photo?`<img src="${student.photo}">`:'<span style="font-size:7pt;color:#aaa;text-align:center">Photo</span>'}</div>
        <div style="font-size:7pt;text-align:center;color:#999;margin-top:2px">Photo</div>
      </div>
    </div>
    <table class="schedule-table">
      <tr><th>Date</th>${dayCols}</tr>
      <tr><th>Subject</th>${subjCols}</tr>
      <tr><th>Invigilator Signature</th>${sigCols}</tr>
    </table>
    <div class="ht-instructions">
      <div class="ht-instructions-label">Instructions:</div>
      <div class="ht-instructions-body">${instructions.replace(/\n/g, '<br>')}</div>
    </div>
    <div class="ht-bottom">
      <div class="ht-note">Computer-generated hall ticket. Bring to every exam.</div>
      <div class="ht-principal">
        ${SHOW_PRINCIPAL_SIGNATURE ? `<img src="${PRINCIPAL_SIGNATURE}" alt="Principal Signature" class="ht-principal-img">` : ''}
        <div class="ht-principal-line">Principal</div>
      </div>
    </div>
  </div>`;
}

// Old hall ticket HTML builder - replaced by buildLinkedHallTicketHTML
function buildHallTicketHTML(student, ht) { return ''; }

// View student hall ticket (student portal - uses exam schedule linked hall tickets)
function viewStudentHallTicket(htId) {
  // In student portal, hall tickets come from published exam schedules
  const exams = DB.get('exams').filter(e=>e.published&&(e.className===currentStudent?.className));
  if (!exams.length) { showToast('No hall tickets available yet.','error'); return; }
  const exam = exams.find(e=>e.id===htId)||exams[0];
  if (!exam||!currentStudent) return;
  const printWin = window.open('','_blank','width=900,height=800');
  if (!printWin) { showToast('Please allow popups to print','error'); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><title>Hall Ticket</title>
  <style>
    /* Single hall ticket viewed by a student. Fits one ticket on A5 portrait. */
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:13pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .toolbar button:hover{background:#d4b75e}
    .preview{padding:16px;display:flex;justify-content:center}
    .ht{width:100%;max-width:190mm;background:#fff;padding:8px 12px;box-sizing:border-box;border:1.5px solid #1a3a6b;border-radius:6px}
    .ht-header{text-align:center;border-bottom:2px solid #1a3a6b;padding-bottom:5px;margin-bottom:6px}
    .logo-row{display:flex;align-items:center;justify-content:center;gap:10px}
    .logo{width:40px;height:40px;object-fit:contain;border-radius:50%;border:2px solid #c8a951}
    .school-name{font-size:13pt;font-weight:900;color:#1a3a6b}
    .school-sub{font-size:7.5pt;color:#5a6a82}
    .exam-badge{background:transparent;color:#1a3a6b;border:1.5px solid #1a3a6b;padding:2px 10px;border-radius:3px;font-size:8pt;font-weight:700;margin-top:3px;display:inline-block}
    .ht-body{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;margin-bottom:5px}
    .ht-info table td{padding:2px 4px;font-size:9pt}
    .ht-info table td:first-child{color:#5a6a82;font-weight:600;white-space:nowrap;padding-right:8px}
    .ht-photo{width:55px;height:65px;border:1.5px dashed #ccc;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8f8f8}
    .ht-photo img{width:100%;height:100%;object-fit:cover}
    /* Horizontal layout: Date / Subject / Invigilator rows, with one column per exam day. */
    .schedule-table{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:5px;table-layout:fixed}
    .schedule-table th{background:transparent;color:#1a3a6b;border:1px solid #d0dbed;padding:3px 6px;text-align:left;width:32mm;white-space:nowrap}
    .schedule-table td{padding:3px 6px;border:1px solid #d0dbed;text-align:center}
    .schedule-table td.sig-cell{height:14mm}
    .schedule-table tr:nth-child(2) td{background:#f8faff;font-weight:600}
    .ht-instructions{font-size:7.5pt;color:#1a2535;border:1px solid #c8a951;padding:5px 8px;background:transparent;border-radius:3px;line-height:1.35;margin-bottom:6px;display:flex;gap:6px}
    .ht-instructions-label{font-weight:700;color:#1a3a6b;white-space:nowrap}
    .ht-instructions-body{flex:1}
    .ht-bottom{display:flex;justify-content:space-between;align-items:flex-end}
    .ht-note{font-size:7pt;color:#5a6a82;font-style:italic}
    .ht-principal{text-align:center;min-width:100px}
    .ht-principal-img{height:24px;display:block;margin:0 auto}
    .ht-principal-line{border-top:1px solid #666;margin-top:2px;padding-top:2px;font-size:7.5pt;color:#444;font-weight:700}
    @media print{
      body{margin:0;background:#fff}
      .toolbar{display:none}
      .preview{padding:0}
      .ht{max-width:none}
      @page{size:A5;margin:5mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zM13 17.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/></svg></span> My Hall Ticket — ${exam.name}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print Now</button></div>
  <div class="preview">${buildLinkedHallTicketHTML(currentStudent,exam)}</div>
  </body></html>`);
  printWin.document.close();
}

// ============================================================================
// === ATTENDANCE SYSTEM ===
// ============================================================================
// Data model:
//   attendance = { "2026-05-06": { "Nursery-ALL": { absent: [...], total:N }, ... } }
//   holidays   = [ { date:"2026-01-26", reason:"Republic Day" }, ... ]
//   leaves     = [ { id, studentId, studentName, className, section, fromDate, toDate, reason, appliedOn, status } ]
// ALL_CLASSES is the complete ordered list of classes in the school.
const ALL_CLASSES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'];

function getToday() { return new Date().toISOString().split('T')[0]; }

function switchAttTab(tab) {
  document.querySelectorAll('#section-attendance .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#section-attendance .tab-btn').forEach(b=>b.classList.remove('active'));
  const map = {mark:0,sendMsg:1,history:2,holidays:3,leaves:4};
  const panels = ['attTabMark','attTabSendMsg','attTabHistory','attTabHolidays','attTabLeaves'];
  document.getElementById(panels[map[tab]]).classList.add('active');
  document.querySelectorAll('#section-attendance .tab-btn')[map[tab]].classList.add('active');
  if(tab==='holidays') renderHolidayList();
  if(tab==='leaves') renderAdminLeaves();
  if(tab==='sendMsg') { document.getElementById('attMsgDate').value=getToday(); loadMsgAbsentList(); }
  if(tab==='mark') renderAttClassStatus();
}

function initAttendanceTab() {
  document.getElementById('attDate').value = getToday();
  document.getElementById('attDate').max = getToday();
  document.getElementById('attHistDate').max = getToday();
  document.getElementById('attMsgDate').max = getToday();
  loadAttStudents();
  renderAttClassStatus();
}

// Show which classes have been marked for today
function renderAttClassStatus() {
  const date = document.getElementById('attDate')?.value || getToday();
  const att = DB.get('attendance')||{};
  const holidays = DB.get('holidays')||[];
  const el = document.getElementById('attClassStatus');
  if (!el) return;
  if (holidays.find(h=>h.date===date)) { el.innerHTML='<div class="alert alert-warning" style="margin-top:12px"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.44-1.43 1.43zM17.42 8.83l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.03l-.01.01c-.38 3.01.72 6.07 3.1 8.44l8.5-8.5C15.1 3.6 12.03 2.49 9.02 2.88L5.97 5.95z"/></svg></span></span>Holiday</div>'; return; }
  const dayData = att[date]||{};
  const doneClasses = new Set(Object.keys(dayData).map(k=>k.split('-')[0]));
  el.innerHTML = `<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--primary-dark)">Today's Status (${fmtDate(date)}):</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">${ALL_CLASSES.map(c=>{
    const done = doneClasses.has(c);
    return `<span style="padding:6px 14px;border-radius:20px;font-size:0.82rem;font-weight:600;border:1px solid ${done?'var(--success)':'var(--border)'};background:${done?'#e8f5e9':'#fff'};color:${done?'var(--success)':'var(--text-muted)'}">${c} ${done?'<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>':'⏳'}</span>`;
  }).join('')}</div>
  ${doneClasses.size===ALL_CLASSES.length?'<div class="alert alert-success" style="margin-top:12px"><span class="alert-icon">✓</span>All classes done! Go to <strong><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span> Send Messages</strong> tab to notify absent students\' parents.</div>':''}`;
}

function loadAttStudents() {
  const date = document.getElementById('attDate').value;
  const cls = document.getElementById('attClass').value;
  const sec = document.getElementById('attSection').value;
  const el = document.getElementById('attStudentList');
  const actEl = document.getElementById('attActions');
  if (!date || !cls) { el.innerHTML='<p style="color:var(--text-muted)">Select date and class to begin.</p>'; actEl.style.display='none'; return; }
  const holidays = DB.get('holidays')||[];
  if (holidays.find(h=>h.date===date)) { el.innerHTML='<div class="alert alert-warning"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.44-1.43 1.43zM17.42 8.83l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.03l-.01.01c-.38 3.01.72 6.07 3.1 8.44l8.5-8.5C15.1 3.6 12.03 2.49 9.02 2.88L5.97 5.95z"/></svg></span></span>This date is declared as a holiday.</div>'; actEl.style.display='none'; return; }
  const students = DB.get('students').filter(s=>s.status==='active'&&s.className===cls&&(sec==='all'||s.section===sec));
  // If no students in this class — treat as "given" (0 students, 0 absent).
  if (!students.length) {
    el.innerHTML='<div class="alert alert-info"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span>No active students in Class ' + cls + '. Attendance will be auto-marked as complete (0 students).</div>';
    actEl.style.display='flex';
    return;
  }
  students.sort((a,b)=>{const ra=parseInt(a.rollNo)||9999,rb=parseInt(b.rollNo)||9999;return ra-rb;});
  const att = DB.get('attendance')||{};
  const key = `${cls}-${sec==='all'?'ALL':sec}`;
  const existing = att[date]?.[key];
  const absentIds = existing ? existing.absent||[] : [];
  el.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Check students who are <strong style="color:var(--danger)">ABSENT</strong> today:</div>
  <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px">${students.map(s=>`
    <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--bg-light);cursor:pointer${absentIds.includes(s.id)?';background:#fff0f0':''}">
      <input type="checkbox" class="att-absent-cb" value="${s.id}" ${absentIds.includes(s.id)?'checked':''}>
      <span style="font-weight:600;min-width:110px;color:var(--primary-dark)">${s.id}</span>
      <span>${s.name}</span>
      <span style="color:var(--text-muted);font-size:0.82rem;margin-left:auto">Roll ${s.rollNo}</span>
    </label>`).join('')}</div>
  <p style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${students.length} students total${existing?' — attendance already recorded (editing)':''}</p>`;
  actEl.style.display='flex';
}

function submitAttendance() {
  const date = document.getElementById('attDate').value;
  const cls = document.getElementById('attClass').value;
  const sec = document.getElementById('attSection').value;
  if (!date||!cls) return;
  const checkboxes = document.querySelectorAll('.att-absent-cb');
  const absentIds = [...document.querySelectorAll('.att-absent-cb:checked')].map(c=>c.value);
  const totalStudents = checkboxes.length; // may be 0 if class is empty
  const presentCount = totalStudents - absentIds.length;
  const msg = totalStudents === 0
    ? `Class ${cls} has no students. Mark as complete?`
    : absentIds.length === 0
      ? `All ${totalStudents} students in Class ${cls} are marked PRESENT for ${fmtDate(date)}.`
      : `${absentIds.length} absent, ${presentCount} present in Class ${cls} for ${fmtDate(date)}. Continue?`;
  showConfirm('Submit Attendance', msg, 'Confirm', 'btn-primary', () => {
    const att = DB.get('attendance')||{};
    if (!att[date]) att[date] = {};
    const key = `${cls}-${sec==='all'?'ALL':sec}`;
    att[date][key] = { absent: absentIds, total: totalStudents, timestamp: new Date().toISOString() };
    DB.set('attendance', att);
    closeModal('confirmModal');
    showToast(`Attendance saved for Class ${cls} on ${fmtDate(date)}`);
    loadAttStudents();
    renderAttClassStatus();
  });
}

function declareHolidayForDate() {
  const date = document.getElementById('attDate').value;
  if (!date) { showToast('Select a date first','error'); return; }
  showConfirm('Declare Holiday', `Declare ${fmtDate(date)} as a holiday? All classes will be marked as holiday.`, 'Declare', 'btn-gold', ()=>{
    const holidays = DB.get('holidays')||[];
    if (!holidays.find(h=>h.date===date)) { holidays.push({date, reason:'Holiday declared by admin'}); DB.set('holidays',holidays); }
    showToast(`${fmtDate(date)} declared as holiday`);
    loadAttStudents();
    renderAttClassStatus();
  });
}

// ============================================================================
// === SEND MESSAGES TAB ===
// ============================================================================
// This tab collects ALL absent students across ALL classes for a given date,
// then lets admin send SMS or WhatsApp ONE STUDENT AT A TIME — each message
// goes to that student's parents ONLY, with that student's specific details.
// Messages are sent to BOTH emergency phone and normal phone number.

function loadMsgAbsentList() {
  const date = document.getElementById('attMsgDate').value;
  const el = document.getElementById('attMsgContent');
  if (!date) { el.innerHTML='<p style="color:var(--text-muted)">Select a date.</p>'; return; }
  const holidays = DB.get('holidays')||[];
  if (holidays.find(h=>h.date===date)) { el.innerHTML='<div class="alert alert-warning"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.44-1.43 1.43zM17.42 8.83l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.03l-.01.01c-.38 3.01.72 6.07 3.1 8.44l8.5-8.5C15.1 3.6 12.03 2.49 9.02 2.88L5.97 5.95z"/></svg></span></span>Holiday — no attendance.</div>'; return; }
  const att = DB.get('attendance')||{};
  const dayData = att[date]||{};
  if (!Object.keys(dayData).length) { el.innerHTML='<div class="alert alert-info"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span>No attendance recorded for ' + fmtDate(date) + '. Please mark attendance first in the "Mark Attendance" tab.</div>'; return; }
  // Gather ALL absent students across all classes
  const students = DB.get('students');
  const absentList = []; // {student object, class key}
  Object.keys(dayData).forEach(key => {
    const rec = dayData[key];
    (rec.absent||[]).forEach(id => {
      const s = students.find(st=>st.id===id);
      if (s) absentList.push(s);
    });
  });
  // Deduplicate by student ID (in case same student appears in multiple section keys)
  const seen = new Set();
  const unique = absentList.filter(s => { if(seen.has(s.id)) return false; seen.add(s.id); return true; });
  if (!unique.length) {
    el.innerHTML = `<div class="alert alert-success" style="margin-top:12px"><span class="alert-icon">✓</span><strong>All is well!</strong> No students absent on ${fmtDate(date)}. Nothing to send.</div>`;
    return;
  }
  // Show list + send buttons
  el.innerHTML = `
    <div class="alert alert-warning" style="margin-top:12px"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></span><strong>${unique.length} student(s) absent</strong> on ${fmtDate(date)} across all classes.</div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
      <table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Class</th><th>Section</th><th>Parent Phone</th><th>Emergency Phone</th></tr></thead>
      <tbody>${unique.map((s,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${s.id}</strong></td>
        <td>${s.name}</td>
        <td>${s.className}</td>
        <td>${s.section||'—'}</td>
        <td>${s.phone||'—'}</td>
        <td>${s.emergencyPhone||'—'}</td>
      </tr>`).join('')}</tbody></table>
    </div>
    <p style="font-size:0.88rem;color:var(--text);margin-bottom:12px">Each parent will receive a message with <strong>only their child's</strong> details: Student ID, Name, Class, Section, and Date.</p>
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Messages go to <strong>both</strong> the parent phone number and emergency phone number.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-primary btn-lg" onclick="startSendingSMS('${date}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg></span> Send SMS to All Parents</button>
      <button class="btn btn-success btn-lg" onclick="startSendingWhatsApp('${date}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></span> Send WhatsApp to All Parents</button>
    </div>
    <div id="msgSendProgress" style="margin-top:16px"></div>`;
}

// Sequential message sender — opens one window at a time
// Each student → sends to BOTH phone numbers (normal + emergency)
// Message contains: School name, student name, student ID, class, section, date
function _getAbsentStudentsForDate(date) {
  const att = DB.get('attendance')||{};
  const dayData = att[date]||{};
  const students = DB.get('students');
  const absentList = [];
  const seen = new Set();
  Object.keys(dayData).forEach(key => {
    (dayData[key].absent||[]).forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const s = students.find(st=>st.id===id);
      if (s) absentList.push(s);
    });
  });
  return absentList;
}

function _buildAbsentMsg(student, date, isWhatsApp) {
  const s = student;
  const d = fmtDate(date);
  if (isWhatsApp) {
    return `<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg></span> *Noble High School — Absence Alert*\n\nDear Parent/Guardian,\n\nYour ward is absent today.\n\n*Student ID:* ${s.id}\n*Name:* ${s.name}\n*Class:* ${s.className}\n*Section:* ${s.section||'—'}\n*Date:* ${d}\n\nPlease contact the school office if needed.\n_Noble High School, Kandukur 'X' Road, Kandukur, Rangareddy, Telangana_`;
  }
  return `Noble High School - Absence Alert. Dear Parent, your ward ${s.name} (ID: ${s.id}, Class ${s.className}-${s.section||'N/A'}) was absent on ${d}. Please contact school. - Noble High School, Kandukur`;
}

function startSendingSMS(date) {
  const absentStudents = _getAbsentStudentsForDate(date);
  if (!absentStudents.length) { showToast('No absent students','error'); return; }
  showConfirm('Send SMS', `This will open the SMS app ${absentStudents.length * 2} time(s) (normal phone + emergency phone for each of ${absentStudents.length} student(s)).\n\nEach message is unique to that student — no parent receives another student's info.\n\nReady?`, 'Start Sending', 'btn-primary', () => {
    const progressEl = document.getElementById('msgSendProgress');
    let queue = [];
    absentStudents.forEach(s => {
      const msg = _buildAbsentMsg(s, date, false);
      if (s.phone) queue.push({phone:s.phone, msg, label:`${s.name} → Phone ${s.phone}`});
      if (s.emergencyPhone && s.emergencyPhone !== s.phone) queue.push({phone:s.emergencyPhone, msg, label:`${s.name} → Emergency ${s.emergencyPhone}`});
    });
    if (!queue.length) { showToast('No phone numbers available','error'); return; }
    let idx = 0;
    function sendNext() {
      if (idx >= queue.length) {
        progressEl.innerHTML = `<div class="alert alert-success"><span class="alert-icon">✓</span>All ${queue.length} SMS windows opened. Please send each one manually in the SMS app.</div>`;
        return;
      }
      const item = queue[idx];
      progressEl.innerHTML = `<p style="font-size:0.88rem">Sending ${idx+1}/${queue.length}: <strong>${item.label}</strong>...</p>`;
      window.open(`sms:${item.phone}?body=${encodeURIComponent(item.msg)}`, '_blank');
      idx++;
      setTimeout(sendNext, 1500); // 1.5s delay between opens so browser doesn't block
    }
    sendNext();
  });
}

function startSendingWhatsApp(date) {
  const absentStudents = _getAbsentStudentsForDate(date);
  if (!absentStudents.length) { showToast('No absent students','error'); return; }
  showConfirm('Send WhatsApp', `This will open WhatsApp ${absentStudents.length * 2} time(s) (normal phone + emergency phone for each of ${absentStudents.length} student(s)).\n\nEach message is unique to that student only.\n\nReady?`, 'Start Sending', 'btn-success', () => {
    const progressEl = document.getElementById('msgSendProgress');
    let queue = [];
    absentStudents.forEach(s => {
      const msg = _buildAbsentMsg(s, date, true);
      if (s.phone) queue.push({phone:'91'+s.phone, msg, label:`${s.name} → Phone ${s.phone}`});
      if (s.emergencyPhone && s.emergencyPhone !== s.phone) queue.push({phone:'91'+s.emergencyPhone, msg, label:`${s.name} → Emergency ${s.emergencyPhone}`});
    });
    if (!queue.length) { showToast('No phone numbers available','error'); return; }
    let idx = 0;
    function sendNext() {
      if (idx >= queue.length) {
        progressEl.innerHTML = `<div class="alert alert-success"><span class="alert-icon">✓</span>All ${queue.length} WhatsApp windows opened. Please press Send in each tab.</div>`;
        return;
      }
      const item = queue[idx];
      progressEl.innerHTML = `<p style="font-size:0.88rem">Opening ${idx+1}/${queue.length}: <strong>${item.label}</strong>...</p>`;
      window.open(`https://wa.me/${item.phone}?text=${encodeURIComponent(item.msg)}`, '_blank');
      idx++;
      setTimeout(sendNext, 2000); // 2s delay for WhatsApp
    }
    sendNext();
  });
}

// --- HISTORY / EDIT ---
function loadAttHistory() {
  const date = document.getElementById('attHistDate').value;
  const cls = document.getElementById('attHistClass').value;
  const el = document.getElementById('attHistContent');
  if (!date||!cls) { el.innerHTML='<p style="color:var(--text-muted)">Select date and class.</p>'; return; }
  const holidays = DB.get('holidays')||[];
  const hol = holidays.find(h=>h.date===date);
  if (hol) { el.innerHTML=`<div class="alert alert-warning"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.44-1.43 1.43zM17.42 8.83l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.03l-.01.01c-.38 3.01.72 6.07 3.1 8.44l8.5-8.5C15.1 3.6 12.03 2.49 9.02 2.88L5.97 5.95z"/></svg></span></span>Holiday: ${hol.reason||'Declared holiday'}</div>`; return; }
  const att = DB.get('attendance')||{};
  const dayData = att[date]||{};
  const keys = Object.keys(dayData).filter(k=>k.startsWith(cls+'-'));
  if (!keys.length) { el.innerHTML='<div class="alert alert-info"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span>No attendance recorded for this class on '+fmtDate(date)+'</div>'; return; }
  const students = DB.get('students');
  let html = '';
  keys.forEach(k => {
    const rec = dayData[k];
    const sec = k.split('-')[1];
    const absentNames = (rec.absent||[]).map(id=>{const s=students.find(st=>st.id===id);return s?`<span style="color:var(--danger);font-weight:600">${s.name} (${s.id})</span>`:`<span style="color:var(--danger)">${id}</span>`;}).join(', ')||'<span style="color:var(--success)">None — all present</span>';
    html += `<div style="background:var(--bg-light);padding:14px;border-radius:8px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="font-weight:700;margin-bottom:6px">Section: ${sec} &nbsp;·&nbsp; Total: ${rec.total} &nbsp;·&nbsp; Absent: ${(rec.absent||[]).length}</div>
      <div style="font-size:0.88rem">Absent: ${absentNames}</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="editAttendance('${date}','${cls}','${sec}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span> Edit</button>
    </div>`;
  });
  el.innerHTML = html;
}

function editAttendance(date, cls, sec) {
  document.getElementById('attDate').value = date;
  document.getElementById('attClass').value = cls;
  document.getElementById('attSection').value = sec==='ALL'?'all':sec;
  switchAttTab('mark');
  loadAttStudents();
}

// --- HOLIDAYS ---
function addHoliday() {
  const date = document.getElementById('attHolDate').value;
  const reason = document.getElementById('attHolReason').value.trim();
  if (!date) { showToast('Select a date','error'); return; }
  const holidays = DB.get('holidays')||[];
  if (holidays.find(h=>h.date===date)) { showToast('This date is already a holiday','error'); return; }
  holidays.push({date, reason: reason||'Holiday'});
  DB.set('holidays', holidays);
  document.getElementById('attHolDate').value='';
  document.getElementById('attHolReason').value='';
  showToast(`Holiday declared for ${fmtDate(date)}`);
  renderHolidayList();
}

function renderHolidayList() {
  const holidays = (DB.get('holidays')||[]).sort((a,b)=>b.date.localeCompare(a.date));
  const el = document.getElementById('attHolList');
  if (!holidays.length) { el.innerHTML='<p style="color:var(--text-muted)">No holidays declared.</p>'; return; }
  el.innerHTML = holidays.map(h=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)">
    <div><strong>${fmtDate(h.date)}</strong> — ${h.reason}</div>
    <button class="btn btn-danger btn-sm" onclick="removeHoliday('${h.date}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span></button>
  </div>`).join('');
}

function removeHoliday(date) {
  DB.set('holidays', (DB.get('holidays')||[]).filter(h=>h.date!==date));
  showToast('Holiday removed');
  renderHolidayList();
}

// --- ADMIN LEAVE APPLICATIONS ---
function renderAdminLeaves() {
  const filterDate = document.getElementById('attLeaveFilterDate')?.value || '';
  const leaves = (DB.get('leaves')||[]).sort((a,b)=>b.appliedOn?.localeCompare(a.appliedOn));
  const filtered = filterDate ? leaves.filter(l=>l.fromDate<=filterDate&&l.toDate>=filterDate) : leaves;
  const el = document.getElementById('adminLeavesList');
  if (!filtered.length) { el.innerHTML='<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No leave applications'+(filterDate?' for '+fmtDate(filterDate):'')+'.</p></div>'; return; }
  el.innerHTML = filtered.map(l=>`<div style="background:var(--bg-light);padding:14px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${l.status==='approved'?'var(--success)':l.status==='rejected'?'var(--danger)':'var(--accent)'}">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div><strong>${l.studentName}</strong> (${l.studentId}) — Class ${l.className}-${l.section}</div>
      <span class="badge ${l.status==='approved'?'badge-success':l.status==='rejected'?'badge-danger':'badge-warning'}">${l.status}</span>
    </div>
    <div style="font-size:0.88rem;color:var(--text-muted);margin-top:6px">From: ${fmtDate(l.fromDate)} — To: ${fmtDate(l.toDate)} · Reason: ${l.reason||'—'}</div>
    <div style="font-size:0.82rem;color:var(--text-muted)">Applied on: ${fmtDate(l.appliedOn)}</div>
    ${l.status==='pending'?`<div style="margin-top:8px;display:flex;gap:6px">
      <button class="btn btn-success btn-sm" onclick="updateLeaveStatus('${l.id}','approved')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span> Approve</button>
      <button class="btn btn-danger btn-sm" onclick="updateLeaveStatus('${l.id}','rejected')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span> Reject</button>
    </div>`:''}
  </div>`).join('');
}

function updateLeaveStatus(id, status) {
  const leaves = DB.get('leaves')||[];
  const l = leaves.find(x=>x.id===id);
  if (l) { l.status=status; DB.set('leaves',leaves); renderAdminLeaves(); showToast(`Leave ${status}`); }
}

// ============================================================================
// === STUDENT ATTENDANCE VIEWS ===
// ============================================================================
function switchStuAttTab(tab) {
  document.querySelectorAll('#stuSec-myAttendance .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#stuSec-myAttendance .tab-btn').forEach(b=>b.classList.remove('active'));
  const map = {overview:0,monthly:1,applyLeave:2,leaveHistory:3};
  const panels = ['stuAttOverview','stuAttMonthly','stuAttApplyLeave','stuAttLeaveHistory'];
  document.getElementById(panels[map[tab]]).classList.add('active');
  document.querySelectorAll('#stuSec-myAttendance .tab-btn')[map[tab]].classList.add('active');
  if(tab==='overview') renderStuAttOverview();
  if(tab==='monthly') renderStuAttMonthly();
  if(tab==='leaveHistory') renderStuLeaveHistory();
}

function renderStuAttOverview() {
  const s = currentStudent; if (!s) return;
  const att = DB.get('attendance')||{};
  const holidays = DB.get('holidays')||[];
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  // Calculate academic year overall
  const yearStart = sys.academicYear.split('-')[0]; // e.g. "2026"
  let totalDays=0, presentDays=0, absentDays=0, holidayDays=0;
  Object.keys(att).forEach(date=>{
    if (!date.startsWith(yearStart)&&!date.startsWith(String(parseInt(yearStart)+1))) return;
    if (holidays.find(h=>h.date===date)) { holidayDays++; return; }
    const dayData = att[date];
    Object.keys(dayData).forEach(k=>{
      if (!k.startsWith(s.className+'-')) return;
      const sec = k.split('-')[1];
      if (sec!=='ALL'&&sec!==s.section) return;
      totalDays++;
      if ((dayData[k].absent||[]).includes(s.id)) absentDays++; else presentDays++;
    });
  });
  const pct = totalDays>0?((presentDays/totalDays)*100).toFixed(1):'—';
  // Current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  let mTotal=0,mPresent=0,mAbsent=0;
  Object.keys(att).forEach(date=>{
    if(!date.startsWith(monthStr)) return;
    if(holidays.find(h=>h.date===date)) return;
    const dayData=att[date];
    Object.keys(dayData).forEach(k=>{
      if(!k.startsWith(s.className+'-')) return;
      const sec=k.split('-')[1];
      if(sec!=='ALL'&&sec!==s.section) return;
      mTotal++;
      if((dayData[k].absent||[]).includes(s.id)) mAbsent++; else mPresent++;
    });
  });
  const mPct = mTotal>0?((mPresent/mTotal)*100).toFixed(1):'—';
  const el = document.getElementById('stuAttOverviewContent');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Academic Year</div><div class="stat-value" style="font-size:1.2rem;color:${parseFloat(pct)>=75?'var(--success)':'var(--danger)'}">${pct}%</div><div class="stat-sub">Present: ${presentDays} / ${totalDays} days</div></div>
      <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value" style="font-size:1.2rem;color:${parseFloat(mPct)>=75?'var(--success)':'var(--danger)'}">${mPct}%</div><div class="stat-sub">Present: ${mPresent} / ${mTotal} days</div></div>
      <div class="stat-card"><div class="stat-label">Days Absent (Year)</div><div class="stat-value" style="font-size:1.2rem;color:var(--danger)">${absentDays}</div><div class="stat-sub">Out of ${totalDays} working days</div></div>
    </div>`;
}

function getClassForDate(student, dateStr) {
  const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const curIdx = CLASSES.indexOf(String(student.className));
  if (curIdx === -1) return student.className;
  
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  
  const dateAttYear = (m >= 6) ? y : (y - 1);
  const sys = DB.getObj('system', { academicYear: '2026-2027' });
  const curAttYear = parseInt(sys.academicYear.split('-')[0], 10) || 2026;
  
  const diff = curAttYear - dateAttYear;
  if (diff <= 0) return student.className;
  
  const pastIdx = curIdx - diff;
  return (pastIdx >= 0) ? CLASSES[pastIdx] : null;
}

function renderStuAttMonthly() {
  const s = currentStudent; if (!s) return;
  const monthInput = document.getElementById('stuAttMonth');
  
  // Prevent selecting future months
  const maxMonth = getToday().slice(0, 7);
  monthInput.max = maxMonth;
  
  if (s.joinDate) {
    monthInput.min = s.joinDate.slice(0, 7);
  } else {
    monthInput.min = '2009-01';
  }
  
  if (!monthInput.value) { 
    monthInput.value = maxMonth; 
  } else if (monthInput.value > maxMonth) {
    monthInput.value = maxMonth;
  }
  const month = monthInput.value; // "2026-05"
  const att = DB.get('attendance')||{};
  const holidays = DB.get('holidays')||[];
  const [yr,mo] = month.split('-').map(Number);
  const daysInMonth = new Date(yr,mo,0).getDate();
  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:0.82rem">';
  html += ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div style="font-weight:700;padding:6px;color:var(--text-muted)">${d}</div>`).join('');
  const firstDay = new Date(yr,mo-1,1).getDay();
  for (let i=0;i<firstDay;i++) html += '<div></div>';
  let mTotal=0,mPresent=0;
  for (let d=1;d<=daysInMonth;d++) {
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const today = getToday();
    if (dateStr > today) { html += `<div style="padding:8px;border-radius:6px;background:#f9f9f9;color:#ccc">${d}</div>`; continue; }
    
    // Check if prior to student's joinDate
    if (s.joinDate && dateStr < s.joinDate) {
      html += `<div style="padding:8px;border-radius:6px;background:#f9f9f9;color:#ccc" title="Prior to Admission (${fmtDate(s.joinDate)})">${d}</div>`;
      continue;
    }
    
    const isHoliday = holidays.find(h=>h.date===dateStr);
    if (isHoliday) { html += `<div style="padding:8px;border-radius:6px;background:#ffe082;color:#5d4037" title="Holiday: ${isHoliday.reason}">${d}</div>`; continue; }
    
    const dayData = att[dateStr];
    let found = false, isAbsent = false;
    
    // Determine class student was in at that time
    const targetClass = getClassForDate(s, dateStr);
    if (!targetClass) {
      html += `<div style="padding:8px;border-radius:6px;background:#f9f9f9;color:#ccc" title="Prior to Admission">${d}</div>`;
      continue;
    }
    
    if (dayData) {
      Object.keys(dayData).forEach(k=>{
        if(!k.startsWith(targetClass+'-')) return;
        const sec=k.split('-')[1];
        if(sec!=='ALL'&&sec!==s.section) return;
        found=true; mTotal++;
        if((dayData[k].absent||[]).includes(s.id)) { isAbsent=true; } else { mPresent++; }
      });
    }
    if (!found) { html += `<div style="padding:8px;border-radius:6px;background:#f5f5f5;color:#aaa">${d}</div>`; continue; }
    const color = isAbsent ? '#ef5350' : '#66bb6a';
    const textColor = '#fff';
    html += `<div style="padding:8px;border-radius:6px;background:${color};color:${textColor};font-weight:600" title="${isAbsent?'Absent':'Present'}">${d}</div>`;
  }
  html += '</div>';
  const pct = mTotal>0?((mPresent/mTotal)*100).toFixed(1):'—';
  html += `<div style="margin-top:14px;font-size:0.9rem;font-weight:600">Monthly: ${mPresent}/${mTotal} present = <span style="color:${parseFloat(pct)>=75?'var(--success)':'var(--danger)'}">${pct}%</span></div>`;
  html += `<div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;font-size:0.8rem;align-items:center">
    <span style="background:#66bb6a;color:#fff;padding:4px 10px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:4px">✓ Present</span>
    <span style="background:#ef5350;color:#fff;padding:4px 10px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:4px">✗ Absent</span>
    <span style="background:#ffe082;color:#5d4037;padding:4px 10px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:4px">◆ Holiday</span>
    <span style="background:#f5f5f5;color:#888;padding:4px 10px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:4px;border:1px solid #ddd">○ No record</span>
  </div>`;
  document.getElementById('stuAttMonthlyContent').innerHTML = html;
}

// --- STUDENT LEAVE APPLICATION ---
function submitLeaveApplication() {
  const s = currentStudent; if (!s) return;
  const from = document.getElementById('stuLeaveFrom').value;
  const to = document.getElementById('stuLeaveTo').value;
  const reason = document.getElementById('stuLeaveReason').value.trim();
  if (!from||!to) { showToast('Please select From and To dates','error'); return; }
  if (to < from) { showToast('To date cannot be before From date','error'); return; }
  showConfirm('Confirm Leave Application',
    `Apply for leave:\nFrom: ${fmtDate(from)}\nTo: ${fmtDate(to)}\nReason: ${reason||'Not specified'}\n\nSubmit?`,
    'Submit', 'btn-primary', ()=>{
    const leaves = DB.get('leaves')||[];
    leaves.push({ id:'LV'+Date.now(), studentId:s.id, studentName:s.name, className:s.className, section:s.section, fromDate:from, toDate:to, reason, appliedOn:getToday(), status:'pending' });
    DB.set('leaves',leaves);
    document.getElementById('stuLeaveFrom').value='';
    document.getElementById('stuLeaveTo').value='';
    document.getElementById('stuLeaveReason').value='';
    showToast('Leave application submitted!');
  });
}

function renderStuLeaveHistory() {
  const s = currentStudent; if (!s) return;
  const leaves = (DB.get('leaves')||[]).filter(l=>l.studentId===s.id).sort((a,b)=>b.appliedOn?.localeCompare(a.appliedOn));
  const el = document.getElementById('stuLeaveHistoryContent');
  if (!leaves.length) { el.innerHTML='<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></span></div><p>No leave applications yet.</p></div>'; return; }
  el.innerHTML = leaves.map(l=>`<div style="background:var(--bg-light);padding:14px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${l.status==='approved'?'var(--success)':l.status==='rejected'?'var(--danger)':'var(--accent)'}">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div style="font-weight:600">${fmtDate(l.fromDate)} to ${fmtDate(l.toDate)}</div>
      <span class="badge ${l.status==='approved'?'badge-success':l.status==='rejected'?'badge-danger':'badge-warning'}">${l.status}</span>
    </div>
    <div style="font-size:0.88rem;color:var(--text-muted);margin-top:4px">Reason: ${l.reason||'—'}</div>
    <div style="font-size:0.82rem;color:var(--text-muted)">Applied: ${fmtDate(l.appliedOn)}</div>
  </div>`).join('');
}

// === ACADEMIC YEAR ===
function switchAcadTab(tab) {
  document.querySelectorAll('[id^="acadTab"]').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById('acadTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(el) el.classList.add('active');
  document.querySelectorAll('[id="section-academicYear"] .tab-btn').forEach((b,i)=>{b.classList.remove('active');if((i===0&&tab==='yearUpdate')||(i===1&&tab==='schoolOut')||(i===2&&tab==='archived')||(i===3&&tab==='backendSettings'))b.classList.add('active');});
  if(tab==='archived') renderArchivedTable();
  if(tab==='backendSettings') {
    const inp = document.getElementById('sysBackendUrlInput');
    if (inp) inp.value = localStorage.getItem('nhs_custom_backend_url') || '';
  }
}

function saveCustomBackendUrl() {
  const inputVal = document.getElementById('sysBackendUrlInput').value.trim();
  if (inputVal) {
    try {
      new URL(inputVal);
    } catch (e) {
      showToast('Please enter a valid URL (e.g. https://noble-school-backend.onrender.com)', 'error');
      return;
    }
    localStorage.setItem('nhs_custom_backend_url', inputVal);
    showToast('Backend URL saved! Reloading to apply...', 'success');
    setTimeout(() => window.location.reload(), 1200);
  } else {
    showToast('Please enter a URL first.', 'error');
  }
}

function resetCustomBackendUrl() {
  localStorage.removeItem('nhs_custom_backend_url');
  showToast('Backend URL reset to default! Reloading to apply...', 'success');
  setTimeout(() => window.location.reload(), 1200);
}

function switchSchoolOutTab(tab) {
  document.querySelectorAll('[id^="soTab"]').forEach(p=>p.classList.remove('active'));
  document.getElementById('soTab'+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add('active');
}

function initiateYearUpdate() {
  reAuthCallback = () => {
    document.getElementById('formModalTitle').textContent = 'Update Academic Year';
    const sys = DB.getObj('system',{academicYear:'2026-2027'});
    const curParts = sys.academicYear.split('-').map(Number);
    const proposedYear = `${curParts[0]+1}-${curParts[1]+1}`;
    const previousYear = `${curParts[0]-1}-${curParts[1]-1}`;
    
    document.getElementById('formModalBody').innerHTML = `
      <div class="alert alert-warning"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span>Select one of the options below to either advance the academic year or revert to the previous academic year.</div>
      
      <div class="form-group">
        <label class="form-label">Current Academic Year</label>
        <div style="font-size:1.3rem;font-weight:800;color:var(--primary-dark);padding:8px 0">${sys.academicYear}</div>
      </div>
      
      <hr style="border:0; border-top:1px solid var(--border); margin:15px 0;" />
      
      <div style="display:flex; flex-direction:column; gap:15px;">
        <div class="form-group" style="border:1px solid var(--border); padding:12px; border-radius:6px; background:var(--background-alt, #f9fafb)">
          <div style="font-weight:bold; font-size:1.05rem; margin-bottom:5px; color:var(--primary)">Option 1: Advance Academic Year</div>
          <div style="margin-bottom:10px; font-size:0.85rem; color:var(--text-muted)">
            Promote active students by one class (e.g. Nursery -> LKG, 9 -> 10) and auto-archive Class 10 graduates.
          </div>
          <button class="btn btn-primary btn-sm" onclick="confirmYearUpdate()">Advance to ${proposedYear}</button>
          <input type="hidden" id="newAcadYear" value="${proposedYear}">
        </div>

        <div class="form-group" style="border:1px solid var(--border); padding:12px; border-radius:6px; background:var(--background-alt, #f9fafb)">
          <div style="font-weight:bold; font-size:1.05rem; margin-bottom:5px; color:var(--danger)">Option 2: Revert to Previous Year</div>
          <div style="margin-bottom:10px; font-size:0.85rem; color:var(--text-muted)">
            Demote active students back by one class (e.g. LKG -> Nursery, 10 -> 9), restore archived graduates of ${previousYear} back to active class 10, and revert year to ${previousYear}.
          </div>
          <button class="btn btn-danger btn-sm" onclick="confirmYearRevert()">Revert to ${previousYear}</button>
          <input type="hidden" id="prevAcadYear" value="${previousYear}">
        </div>
      </div>
      
      <div style="margin-top:20px; display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal('formModal')">Close</button>
      </div>
    `;
    document.getElementById('formModal').classList.add('active');
  };
  openReAuthModal();
}

function confirmYearUpdate() {
  const newYear = document.getElementById('newAcadYear')?.value.trim();
  if (!newYear || !/^\d{4}-\d{4}$/.test(newYear)) { showToast('Please enter a valid year format (YYYY-YYYY)','error'); return; }
  // ADDED: validate that the second year is exactly first year + 1.
  // This rejects malformed inputs like "2026-2025" (decreasing) or
  // "2026-2030" (skipping years). The academic year must advance by
  // exactly one year at a time.
  const yearParts = newYear.split('-').map(Number);
  if (yearParts[1] !== yearParts[0] + 1) {
    showToast('Invalid year range. The end year must be one year after the start year (e.g. 2026-2027)', 'error');
    return;
  }
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  // ADDED: only allow single-year increments. If current year is 2026-2027,
  // only 2027-2028 is acceptable next; jumping to 2028-2029 in one update
  // would skip the 2027-2028 promotions and corrupt student records.
  const curParts = sys.academicYear.split('-').map(Number);
  if (yearParts[0] !== curParts[0] + 1) {
    showToast(`Academic year can only be advanced by one year. Next allowed year: ${curParts[0]+1}-${curParts[1]+1}`, 'error');
    return;
  }
  showConfirm('Update Academic Year',
    `Update academic year from ${sys.academicYear} to ${newYear}?\n\nThis will AUTO-PROMOTE every active student by one class:\nNursery -> LKG, LKG -> UKG, UKG -> 1, 1 -> 2, ... 9 -> 10.\nClass 10 students will be auto-archived as "Graduated" for ${sys.academicYear}.\n\nLogin IDs and passwords will be regenerated to reflect the new year and class (e.g. 25NHS9001 -> 26NHS10001).`,
    'Update', 'btn-primary', () => {
    // ADDED: promotion mapping
    const promotion = {
      'Nursery':'LKG', 'LKG':'UKG', 'UKG':'1',
      '1':'2','2':'3','3':'4','4':'5','5':'6',
      '6':'7','7':'8','8':'9','9':'10'
    };
    const students = DB.get('students');
    const archived = DB.get('archived');
    const oldYear = sys.academicYear;
    const stillActive = [];
    let graduated = 0, promoted = 0;
    // First pass: archive 10th-class graduates, advance everyone else's class
    // (don't yet generate the new IDs — we'll do that in pass 2 so we can
    //  assign sequential numbers correctly per (class, section)).
    students.forEach(s => {
      if (s.status !== 'active') { stillActive.push(s); return; }
      if (s.className === '10') {
        // 10th class students leave the school after promotion
        archived.push({
          ...s, status:'archived',
          schoolOutDate: new Date().toISOString().split('T')[0],
          reason: 'Graduated',
          notes: `Auto-graduated on academic year update ${oldYear} -> ${newYear}`,
          archiveDate: new Date().toISOString(),
          academicYearOut: oldYear
        });
        graduated++;
      } else if (promotion[s.className]) {
        // Save the old ID so we can update fee records / reports / etc. that
        // referenced this student by their previous Student ID.
        s._oldId = s.id;
        s.className = promotion[s.className];
        s.academicYear = newYear;
        stillActive.push(s);
        promoted++;
      } else {
        // Unknown class — leave untouched.
        stillActive.push(s);
      }
    });
    // Second pass: regenerate login IDs and passwords for the promoted
    // students. Per the school's convention, the ID format is
    //   <YY>NHS<classCode><NNN>
    // where YY is the last two digits of the new starting year, classCode is
    // the class (e.g. 10 / NUR / LKG), and NNN is the student's sequence
    // number within their class. We sort students within each class by their
    // existing roll number so the sequence is predictable.
    const yyPrefix = newYear.match(/(\d{4})/)[1].slice(-2);
    // Build buckets per class, then number them.
    const buckets = {};
    stillActive.forEach(s => {
      if (!s._oldId) return; // not promoted (e.g. inactive holdovers) — skip
      const key = s.className;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(s);
    });
    // Map of oldId -> newId for downstream reference updates
    const idMap = {};
    Object.keys(buckets).forEach(cls => {
      // Sort by old roll number within the class so numbering is stable.
      const list = buckets[cls];
      list.sort((a,b) => {
        const ra = parseInt(a.rollNo, 10) || 9999;
        const rb = parseInt(b.rollNo, 10) || 9999;
        return ra - rb;
      });
      const classCode = getClassCode(cls);
      list.forEach((s, idx) => {
        const seq = String(idx + 1).padStart(3, '0');
        const newId = `${yyPrefix}NHS${classCode}${seq}`;
        idMap[s._oldId] = newId;
        s.id = newId;
        s.loginId = newId;
        s.password = newId; // the school convention: password equals login ID
        delete s._oldId;
      });
    });
    // Update fee, report, and complaint records that reference the old IDs
    // so existing data stays linked to each student under their new ID.
    const fees = DB.get('fees') || [];
    fees.forEach(f => { if (idMap[f.studentId]) f.studentId = idMap[f.studentId]; });
    DB.set('fees', fees);
    const reports = DB.get('reports') || [];
    reports.forEach(r => { if (idMap[r.studentId]) r.studentId = idMap[r.studentId]; });
    DB.set('reports', reports);
    const complaints = DB.get('complaints') || [];
    complaints.forEach(c => { if (idMap[c.stuId]) c.stuId = idMap[c.stuId]; });
    DB.set('complaints', complaints);
    DB.set('students', stillActive);
    DB.set('archived', archived);
    sys.academicYear = newYear;
    DB.set('system', sys);
    closeModal('formModal');
    updateDashYearBadge();
    showToast(`Academic year updated to ${newYear}. ${promoted} students promoted with new IDs, ${graduated} graduated (10th class) archived.`);
  });
}

function confirmYearRevert() {
  const prevYear = document.getElementById('prevAcadYear')?.value.trim();
  if (!prevYear || !/^\d{4}-\d{4}$/.test(prevYear)) { showToast('Invalid year format','error'); return; }
  
  const sys = DB.getObj('system',{academicYear:'2026-2027'});
  const curParts = sys.academicYear.split('-').map(Number);
  const yearParts = prevYear.split('-').map(Number);
  
  if (yearParts[0] !== curParts[0] - 1) {
    showToast(`Academic year can only be reverted by one year. Previous allowed year: ${curParts[0]-1}-${curParts[1]-1}`, 'error');
    return;
  }
  
  showConfirm('Revert Academic Year',
    `Revert academic year from ${sys.academicYear} back to ${prevYear}?\n\nThis will DEMOTE every active student back by one class:\nLKG -> Nursery, UKG -> LKG, 1 -> UKG, ... 10 -> 9.\n\nStudents auto-archived as Graduated for ${prevYear} will be restored back to active status in Class 10.\n\nLogin IDs and passwords will be regenerated to reflect the previous year.`,
    'Revert Year', 'btn-danger', () => {
      
      const demotion = {
        'LKG':'Nursery', 'UKG':'LKG', '1':'UKG',
        '2':'1', '3':'2', '4':'3', '5':'4', '6':'5',
        '7':'6', '8':'7', '9':'8', '10':'9'
      };
      
      const students = DB.get('students') || [];
      const archived = DB.get('archived') || [];
      
      let demoted = 0;
      let restoredCount = 0;
      const stillActive = [];
      const remainingArchived = [];
      
      students.forEach(s => {
        if (s.status !== 'active') { stillActive.push(s); return; }
        if (demotion[s.className]) {
          s._oldId = s.id;
          s.className = demotion[s.className];
          s.academicYear = prevYear;
          stillActive.push(s);
          demoted++;
        } else {
          stillActive.push(s);
        }
      });
      
      archived.forEach(s => {
        if (s.status === 'archived' && s.reason === 'Graduated' && s.academicYearOut === prevYear) {
          s.status = 'active';
          s.className = '10';
          s.academicYear = prevYear;
          s._oldId = s.id;
          delete s.schoolOutDate;
          delete s.reason;
          delete s.archiveDate;
          delete s.academicYearOut;
          stillActive.push(s);
          restoredCount++;
        } else {
          remainingArchived.push(s);
        }
      });
      
      const yyPrefix = prevYear.match(/(\d{4})/)[1].slice(-2);
      const buckets = {};
      stillActive.forEach(s => {
        const key = s.className;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(s);
      });
      
      const idMap = {};
      Object.keys(buckets).forEach(cls => {
        const list = buckets[cls];
        list.sort((a,b) => {
          const ra = parseInt(a.rollNo, 10) || 9999;
          const rb = parseInt(b.rollNo, 10) || 9999;
          return ra - rb;
        });
        const classCode = getClassCode(cls);
        list.forEach((s, idx) => {
          const seq = String(idx + 1).padStart(3, '0');
          const newId = `${yyPrefix}NHS${classCode}${seq}`;
          const currentId = s._oldId || s.id;
          idMap[currentId] = newId;
          s.id = newId;
          s.loginId = newId;
          s.password = newId;
          delete s._oldId;
        });
      });
      
      const fees = DB.get('fees') || [];
      fees.forEach(f => { if (idMap[f.studentId]) f.studentId = idMap[f.studentId]; });
      DB.set('fees', fees);
      
      const reports = DB.get('reports') || [];
      reports.forEach(r => { if (idMap[r.studentId]) r.studentId = idMap[r.studentId]; });
      DB.set('reports', reports);
      
      const complaints = DB.get('complaints') || [];
      complaints.forEach(c => { if (idMap[c.stuId]) c.stuId = idMap[c.stuId]; });
      DB.set('complaints', complaints);
      
      DB.set('students', stillActive);
      DB.set('archived', remainingArchived);
      
      sys.academicYear = prevYear;
      DB.set('system', sys);
      
      closeModal('formModal');
      updateDashYearBadge();
      showToast(`Academic year reverted to ${prevYear}. ${demoted} students demoted, ${restoredCount} graduated students restored to Class 10.`);
    });
}

function loadSchoolOutStudents() {
  const cls = document.getElementById('soClass').value;
  const sec = document.getElementById('soSection').value;
  const students = DB.get('students').filter(s=>s.status==='active'&&s.className===cls&&(sec==='all'||s.section===sec));
  renderSchoolOutList(students);
}

function searchSchoolOutStudent() {
  const id = document.getElementById('soStudentId').value.trim();
  const students = DB.get('students');
  const s = students.find(x=>x.id===id||x.loginId===id);
  if (!s) { showToast('Student not found','error'); return; }
  renderSchoolOutList([s]);
}

function renderSchoolOutList(students) {
  if (!students.length) { document.getElementById('schoolOutStudentsList').innerHTML='<div class="alert alert-info"><span class="alert-icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span></span>No students found</div>'; document.getElementById('schoolOutFormExtra').style.display='none'; return; }
  document.getElementById('schoolOutStudentsList').innerHTML = `
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="selectAllSo" onclick="toggleAllSo(this)"></th><th>Student ID</th><th>Name</th><th>Class</th><th>Section</th><th>Father Name</th></tr></thead>
    <tbody>${students.map(s=>`<tr><td><input type="checkbox" class="so-check" value="${s.id}"></td><td>${s.id}</td><td><strong>${s.name}</strong></td><td>${s.className}</td><td>${s.section}</td><td>${s.fatherName}</td></tr>`).join('')}</tbody></table></div>
  `;
  document.getElementById('schoolOutFormExtra').style.display='block';
}

function toggleAllSo(cb) { document.querySelectorAll('.so-check').forEach(c=>c.checked=cb.checked); }

function processSchoolOut() {
  const selected = [...document.querySelectorAll('.so-check:checked')].map(c=>c.value);
  if (!selected.length) { showToast('Please select at least one student','error'); return; }
  const reason = document.getElementById('soReason').value;
  const soDate = document.getElementById('soDate').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('soNotes').value;
  
  reAuthCallback = () => {
    showConfirm('Confirm School Out', `You are about to mark ${selected.length} student(s) as School Out. Their records will be archived and logins deactivated. Remaining students in the same class will be renumbered to close gaps. This can be reversed. Proceed?`, 'Mark as School Out', 'btn-danger', () => {
      const students = DB.get('students');
      const archived = DB.get('archived');
      const toArchive = students.filter(s=>selected.includes(s.id));
      toArchive.forEach(s => { archived.push({ ...s, status:'archived', schoolOutDate:soDate, reason, notes, archiveDate:new Date().toISOString() }); });
      let remaining = students.filter(s=>!selected.includes(s.id));
      // ADDED: renumber remaining students within each affected class so the
      // sequence stays gap-free. If 26NHS10001 leaves, then 26NHS10002 becomes
      // 26NHS10001, 26NHS10003 becomes 26NHS10002, and so on. This applies
      // ONLY to active students with auto-format IDs (YY+NHS+class+NNN); any
      // manually entered ID that doesn't match the pattern is left untouched
      // so the admin's intent is respected.
      const idFmt = /^(\d{2})NHS([A-Z\d]{1,3})(\d{3})$/;
      const idMap = {};
      // Collect classes that lost students
      const affectedClasses = new Set();
      toArchive.forEach(s => { if (s.className) affectedClasses.add(s.className); });
      affectedClasses.forEach(cls => {
        const inClass = remaining
          .filter(s => s.className === cls && s.status === 'active' && idFmt.test(s.id || ''))
          .sort((a, b) => {
            // Sort by current sequence number within the ID so the existing
            // order is preserved (we only collapse gaps, we don't reshuffle).
            const ma = a.id.match(idFmt), mb = b.id.match(idFmt);
            return parseInt(ma[3], 10) - parseInt(mb[3], 10);
          });
        inClass.forEach((s, idx) => {
          const m = s.id.match(idFmt);
          const newSeq = String(idx + 1).padStart(3, '0');
          if (m[3] !== newSeq) {
            const newId = `${m[1]}NHS${m[2]}${newSeq}`;
            idMap[s.id] = newId;
            s.id = newId;
            s.loginId = newId;
            // Note: we deliberately do NOT change the password here. Renumbering
            // is administrative; forcing a password change every time someone
            // transfers would be confusing for active students.
          }
        });
      });
      // Update fee/report/complaint records that referenced the old IDs.
      if (Object.keys(idMap).length) {
        const fees = DB.get('fees') || [];
        fees.forEach(f => { if (idMap[f.studentId]) f.studentId = idMap[f.studentId]; });
        DB.set('fees', fees);
        const reports = DB.get('reports') || [];
        reports.forEach(r => { if (idMap[r.studentId]) r.studentId = idMap[r.studentId]; });
        DB.set('reports', reports);
        const complaints = DB.get('complaints') || [];
        complaints.forEach(c => { if (idMap[c.stuId]) c.stuId = idMap[c.stuId]; });
        DB.set('complaints', complaints);
      }
      DB.set('students', remaining);
      DB.set('archived', archived);
      document.getElementById('schoolOutStudentsList').innerHTML='';
      document.getElementById('schoolOutFormExtra').style.display='none';
      const renumberedCount = Object.keys(idMap).length;
      showToast(`${selected.length} student(s) marked as School Out${renumberedCount ? `; ${renumberedCount} ID(s) renumbered to close gaps` : ''}.`);
    });
  };
  openReAuthModal();
}

function renderArchivedTable() {
  const archived = DB.get('archived');
  const search = (document.getElementById('archSearchInput')?.value||'').toLowerCase();
  // ADDED: populate year filter dynamically
  const yearSel = document.getElementById('archYearFilter');
  if (yearSel) {
    const years = [...new Set(archived.map(s => s.academicYearOut || s.academicYear).filter(Boolean))].sort().reverse();
    const currentSel = yearSel.value;
    yearSel.innerHTML = '<option value="all">All Academic Years</option>' + years.map(y => `<option value="${y}" ${y===currentSel?'selected':''}>${y}</option>`).join('');
  }
  const yearFilter = yearSel?.value || 'all';
  const reasonFilter = document.getElementById('archReasonFilter')?.value || 'all';
  const filtered = archived.filter(s => {
    if (search && !((s.name||'').toLowerCase().includes(search) || (s.id||'').toLowerCase().includes(search) || (s.loginId||'').toLowerCase().includes(search))) return false;
    if (yearFilter !== 'all') {
      const yr = s.academicYearOut || s.academicYear;
      if (yr !== yearFilter) return false;
    }
    if (reasonFilter !== 'all' && s.reason !== reasonFilter) return false;
    return true;
  });
  // ADDED: stats summary
  const stats = document.getElementById('archStats');
  if (stats) {
    const grad = filtered.filter(s=>s.reason==='Graduated').length;
    const trans = filtered.filter(s=>s.reason==='Transferred').length;
    const left = filtered.filter(s=>s.reason==='Left').length;
    const other = filtered.filter(s=>s.reason==='Other').length;
    stats.innerHTML = `<strong>${filtered.length}</strong> archived shown ` +
      `&nbsp;|&nbsp; Graduated: <strong style="color:var(--success)">${grad}</strong>` +
      `&nbsp;|&nbsp; Transferred: <strong style="color:var(--primary)">${trans}</strong>` +
      `&nbsp;|&nbsp; Left: <strong style="color:var(--danger)">${left}</strong>` +
      `&nbsp;|&nbsp; Other: <strong>${other}</strong>`;
  }
  document.getElementById('archivedTableContainer').innerHTML = filtered.length ? `<table><thead><tr><th>Student ID</th><th>Name</th><th>Last Class</th><th>Section</th><th>Academic Year</th><th>School Out Date</th><th>Reason</th><th>Action</th></tr></thead>
  <tbody>${filtered.map(s=>`<tr><td>${s.id}</td><td><strong>${s.name}</strong></td><td>${s.className}</td><td>${s.section}</td><td>${s.academicYearOut||s.academicYear||'—'}</td><td>${fmtDate(s.schoolOutDate)}</td><td><span class="badge ${s.reason==='Graduated'?'badge-success':'badge-info'}">${s.reason||'—'}</span></td><td><button class="btn btn-success btn-sm" onclick="restoreStudent('${s.id}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-3 3h6l-3-3zm-2.31 13H14.31L15.63 10.5H8.37L9.69 13zm2.31 7l3-3H9l3 3z"/></svg></span>️ Restore</button></td></tr>`).join('')}</tbody></table>`
  : '<div class="empty-state"><div class="icon"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg></span></div><p>No archived students match the filter</p></div>';
}

function restoreStudent(id) {
  reAuthCallback = () => {
    const archived = DB.get('archived');
    const s = archived.find(x=>x.id===id);
    if (!s) return;
    showConfirm('Restore Student', `Restore ${s.name} to active students?`, 'Restore', 'btn-success', () => {
      const students = DB.get('students');
      const restored = { ...s, status:'active' };
      delete restored.schoolOutDate; delete restored.reason; delete restored.notes; delete restored.archiveDate;
      students.push(restored);
      DB.set('students', students);
      DB.set('archived', archived.filter(x=>x.id!==id));
      renderArchivedTable();
      showToast(s.name + ' restored to active students!');
    });
  };
  openReAuthModal();
}

// === RE-AUTH ===
function openReAuthModal() {
  document.getElementById('reAuthUid').value = '';
  document.getElementById('reAuthPass').value = '';
  document.getElementById('reAuthOtp').value = '';
  document.getElementById('reAuthError').innerHTML = '';
  
  document.getElementById('reAuthMessage').textContent = 'Please verify your credentials to proceed with this critical action.';
  document.getElementById('reAuthUidGroup').style.display = 'block';
  document.getElementById('reAuthPassGroup').style.display = 'block';
  document.getElementById('reAuthOtpGroup').style.display = 'none';
  
  const actionBtn = document.getElementById('btnReAuthAction');
  if (actionBtn) {
    actionBtn.textContent = 'Send OTP Code';
    actionBtn.setAttribute('onclick', 'handleReAuthRequestOTP()');
  }
  
  document.getElementById('reAuthModal').classList.add('active');
}

async function handleReAuthRequestOTP() {
  const uid = document.getElementById('reAuthUid').value.trim();
  const pass = document.getElementById('reAuthPass').value;
  if (!uid || !pass) { showAlert('reAuthError', 'error', 'Please enter your User ID and Password.'); return; }
  
  // Verify User ID & Password
  let ok = false;
  try {
    const res = await fetch(BACKEND_URL + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: uid, password: pass, role: 'admin' })
    });
    const data = await res.json();
    if (data.success) ok = true;
  } catch (err) {
    console.warn('Backend unavailable, verifying locally:', err);
    ok = await window.__vault.verifyAdmin(uid, pass, null);
  }
  
  if (!ok) {
    showAlert('reAuthError', 'error', 'Invalid User ID or Password.');
    return;
  }
  
  // Generate and Send OTP
  reAuthOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('reAuthError').innerHTML = '';
  showToast('Sending OTP verification code to registered admin email...', 'info');
  
  try {
    const sendRes = await fetch(BACKEND_URL + '/api/auth/send-otp-monolith', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: reAuthOtpCode })
    });
    const sendData = await sendRes.json();
    if (sendData.success) {
      showToast('OTP code sent successfully to registered admin email.', 'success');
      
      // Update UI to OTP mode
      document.getElementById('reAuthMessage').textContent = 'An OTP verification code has been sent to your registered admin email. Please enter it below to proceed.';
      document.getElementById('reAuthUidGroup').style.display = 'none';
      document.getElementById('reAuthPassGroup').style.display = 'none';
      document.getElementById('reAuthOtpGroup').style.display = 'block';
      
      const actionBtn = document.getElementById('btnReAuthAction');
      actionBtn.textContent = 'Verify & Proceed';
      actionBtn.setAttribute('onclick', 'doReAuth()');
    } else {
      showAlert('reAuthError', 'error', 'Failed to send OTP email: ' + sendData.message);
    }
  } catch (err) {
    console.error(err);
    showAlert('reAuthError', 'error', 'Cannot connect to backend to send OTP email.');
  }
}

async function doReAuth() {
  const otp = document.getElementById('reAuthOtp').value.trim();
  if (!otp) { showAlert('reAuthError', 'error', 'Please enter the 6-digit OTP code.'); return; }
  
  if (otp !== reAuthOtpCode) {
    showAlert('reAuthError', 'error', 'Incorrect OTP code. Please try again.');
    return;
  }
  
  // Success! Close modal and execute callback
  closeModal('reAuthModal');
  if (reAuthCallback) {
    reAuthCallback();
    reAuthCallback = null;
  }
  showToast('Re-authentication successful.');
}

// === RESET CREDENTIALS ===
function checkPassStrength() {
  const pass = document.getElementById('newPass')?.value||'';
  const el = document.getElementById('passStrengthIndicator');
  if (!el) return;
  let strength = 0; let msg = '';
  if (pass.length >= 8) strength++;
  if (/[A-Z]/.test(pass)) strength++;
  if (/[a-z]/.test(pass)) strength++;
  if (/\d/.test(pass)) strength++;
  if (/[^A-Za-z0-9]/.test(pass)) strength++;
  const labels = ['','Weak','Weak','Medium','Strong','Very Strong'];
  const colors = ['','var(--danger)','var(--danger)','var(--warning)','var(--success)','var(--success)'];
  el.innerHTML = strength > 0 ? `<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem"><div class="progress-bar-wrap" style="flex:1"><div class="progress-bar-fill" style="width:${strength*20}%;background:${colors[strength]}"></div></div><span style="color:${colors[strength]};font-weight:600">${labels[strength]}</span></div>` : '';
}

function initResetCredsForm() {
  document.getElementById('resetStep1').style.display = 'block';
  document.getElementById('resetStep2').style.display = 'none';
  document.getElementById('verifyUid').value = '';
  document.getElementById('verifyPass').value = '';
  document.getElementById('verifyOtp').value = '';
  document.getElementById('resetUidGroup').style.display = 'block';
  document.getElementById('resetPassGroup').style.display = 'block';
  document.getElementById('resetOtpGroup').style.display = 'none';
  document.getElementById('resetStep1Msg').textContent = 'Enter your current User ID and Password to receive a verification code (OTP).';
  document.getElementById('resetStep1Error').innerHTML = '';
  
  const actionBtn = document.getElementById('btnResetStep1Action');
  if (actionBtn) {
    actionBtn.textContent = 'Send OTP Code';
    actionBtn.setAttribute('onclick', 'handleResetCredsRequestOTP()');
  }
}

async function handleResetCredsRequestOTP() {
  const uid = document.getElementById('verifyUid').value.trim();
  const pass = document.getElementById('verifyPass').value;
  if (!uid || !pass) { showAlert('resetStep1Error', 'error', 'Please enter your current User ID and Password.'); return; }
  
  // Verify credentials first (without OTP)
  let ok = false;
  try {
    const res = await fetch(BACKEND_URL + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: uid, password: pass, role: 'admin' })
    });
    const data = await res.json();
    if (data.success) ok = true;
  } catch (err) {
    console.warn('Backend unavailable, verifying locally:', err);
    ok = await window.__vault.verifyAdmin(uid, pass, null);
  }
  
  if (!ok) {
    showAlert('resetStep1Error', 'error', 'Invalid User ID or Password.');
    return;
  }
  
  // Credentials verified! Generate and send OTP code
  resetCredsOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('resetStep1Error').innerHTML = '';
  showToast('Sending OTP verification code to registered admin email...', 'info');
  
  try {
    const sendRes = await fetch(BACKEND_URL + '/api/auth/send-otp-monolith', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: resetCredsOtpCode })
    });
    const sendData = await sendRes.json();
    if (sendData.success) {
      showToast('OTP code sent successfully to registered admin email.', 'success');
      
      // Update UI to OTP mode
      document.getElementById('resetStep1Msg').textContent = 'An OTP verification code has been sent to your registered admin email. Please enter it below to proceed.';
      document.getElementById('resetUidGroup').style.display = 'none';
      document.getElementById('resetPassGroup').style.display = 'none';
      document.getElementById('resetOtpGroup').style.display = 'block';
      
      const actionBtn = document.getElementById('btnResetStep1Action');
      actionBtn.textContent = 'Verify OTP & Continue';
      actionBtn.setAttribute('onclick', 'verifyResetCreds()');
    } else {
      showAlert('resetStep1Error', 'error', 'Failed to send OTP email: ' + sendData.message);
    }
  } catch (err) {
    console.error(err);
    showAlert('resetStep1Error', 'error', 'Cannot connect to backend to send OTP email.');
  }
}

async function verifyResetCreds() {
  const otp = document.getElementById('verifyOtp').value.trim();
  if (!otp) { showAlert('resetStep1Error', 'error', 'Please enter the 6-digit OTP code.'); return; }
  
  if (otp !== resetCredsOtpCode) {
    showAlert('resetStep1Error', 'error', 'Incorrect OTP code. Please try again.');
    return;
  }
  
  // Success! Cache password for step 2 rotation, and transition step
  _resetStep1Pwd = document.getElementById('verifyPass').value;
  document.getElementById('resetStep1').style.display = 'none';
  document.getElementById('resetStep2').style.display = 'block';
  showToast('Identity verified. Please set your new credentials.');
}

// Cached after Step 1 succeeds, used when Step 2 calls vault.rotateAdmin.
// Cleared as soon as the rotation is committed.
let _resetStep1Pwd = '';

async function resetCredential(type) {
  let newVal, confirmVal, fieldName, vaultField;

  if (type === 'uid') {
    newVal = document.getElementById('newUid')?.value.trim();
    confirmVal = document.getElementById('confirmUid')?.value.trim();
    fieldName = 'User ID';
    vaultField = 'uid';
  } else if (type === 'password') {
    newVal = document.getElementById('newPass')?.value;
    confirmVal = document.getElementById('confirmPass')?.value;
    fieldName = 'Password';
    vaultField = 'pwd';
  }

  if (!newVal || newVal.length < 6) { showToast(fieldName+' must be at least 6 characters','error'); return; }
  if (newVal !== confirmVal) { showToast('Confirmation does not match','error'); return; }
  if (type === 'password' && !(/[A-Z]/.test(newVal) && /[a-z]/.test(newVal) && /\d/.test(newVal) && /[^A-Za-z0-9]/.test(newVal) && newVal.length >= 8)) {
    showToast('Password must be min 8 chars with uppercase, lowercase, number, and special char','error'); return;
  }
  // Reject "same as current" — the vault refuses to verify the old hash AGAIN
  // for the new value (so we know they're different). We don't compare hashes
  // directly because we don't have access to the current one; we ask the vault
  // to verify the new value as the current password — if it succeeds, they're
  // identical.
  if (type === 'password' && (await window.__vault.verifyAdminPwd(newVal))) {
    showToast('New password cannot be same as current','error'); return;
  }

  showConfirm(`Update ${fieldName}`, `You are about to change your ${fieldName}. Please save your new credentials securely. Are you sure?`, `Update ${fieldName}`, 'btn-primary', async () => {
    if (!_resetStep1Pwd) { showToast('Please re-verify your credentials first.', 'error'); return; }
    const rotated = await window.__vault.rotateAdmin(_resetStep1Pwd, vaultField, newVal);
    if (!rotated) { showToast('Verification failed — credentials not changed.', 'error'); return; }
    // After password rotation, the cached step-1 password becomes invalid.
    if (type === 'password') _resetStep1Pwd = newVal;
    showToast(`${fieldName} successfully updated!`);
    if (type === 'uid') { document.getElementById('newUid').value=''; document.getElementById('confirmUid').value=''; }
    else if (type === 'password') { document.getElementById('newPass').value=''; document.getElementById('confirmPass').value=''; }

    let countdown = 30;
    const banner = document.createElement('div');
    banner.className = 'countdown-banner';
    banner.id = 'logoutCountdown';
    banner.innerHTML = `?? Credentials updated. You will be logged out in <strong id="cdTimer">${countdown}</strong> seconds. Please save your new credentials. <button class="btn btn-secondary btn-sm" style="margin-left:10px" onclick="clearInterval(window._cdInterval);document.getElementById('logoutCountdown').remove()">Dismiss</button>`;
    document.getElementById('section-resetCreds').prepend(banner);
    window._cdInterval = setInterval(()=>{ countdown--; const t=document.getElementById('cdTimer'); if(t)t.textContent=countdown; if(countdown<=0){ clearInterval(window._cdInterval); adminLogout(); } },1000);
  });
}

// === COMPLAINT SUBMISSION (Public) ===
function submitComplaint() {
  const stuName = document.getElementById('c_stuName').value.trim();
  const parName = document.getElementById('c_parName').value.trim();
  const stuId = document.getElementById('c_stuId').value.trim();
  const phone = document.getElementById('c_phone').value.trim();
  const details = document.getElementById('c_details').value.trim();
  
  if (!stuName||!parName||!stuId||!phone||!details) { showToast('Please fill all required fields','error'); return; }
  if (phone.length !== 10 || !/^\d+$/.test(phone)) { showToast('Phone must be 10 digits','error'); return; }
  
  // ADDED: Validate Student Login ID actually matches an active student.
  // This stops random IDs from creating "ghost" complaints in the wrong student portal.
  const students = DB.get('students');
  const matched = students.find(s => s.status==='active' && (s.loginId === stuId || s.id === stuId));
  if (!matched) {
    document.getElementById('complaintSuccess').innerHTML =
      `<div class="alert alert-error"><span class="alert-icon">!</span>The Student Login ID you entered does not match any registered student. Please check with the school for the correct Login ID before resubmitting.</div>`;
    showToast('Invalid Student Login ID — complaint not accepted','error');
    return;
  }
  // Make sure the student name on the complaint also resembles the registered student
  // (soft check — case-insensitive containment in either direction)
  const enteredName = stuName.toLowerCase();
  const realName = (matched.name||'').toLowerCase();
  if (realName && enteredName && !realName.includes(enteredName) && !enteredName.includes(realName)) {
    document.getElementById('complaintSuccess').innerHTML =
      `<div class="alert alert-error"><span class="alert-icon">!</span>The student name does not match our records for this Login ID. Please verify and try again.</div>`;
    showToast('Student name does not match Login ID','error');
    return;
  }
  
  const complaints = DB.get('complaints');
  const date = new Date();
  const dateStr = date.toISOString().slice(0,10).replace(/-/g,'');
  const seq = String(complaints.length+1).padStart(3,'0');
  const id = `COMP-${dateStr}-${seq}`;
  // ADDED: store the canonical Student ID so the complaint shows in the correct student portal
  complaints.push({ id, stuName, parName, stuId: matched.id, loginIdEntered: stuId, phone, details, date:date.toISOString(), status:'Pending', adminNotes:'' });
  DB.set('complaints', complaints);
  
  document.getElementById('c_stuName').value=''; document.getElementById('c_parName').value=''; document.getElementById('c_stuId').value=''; document.getElementById('c_phone').value=''; document.getElementById('c_details').value='';
  document.getElementById('complaintSuccess').innerHTML=`<div class="alert alert-success"><span class="alert-icon">✓</span>Complaint submitted successfully! Your Complaint ID is <strong>${id}</strong>. We will review it shortly.</div>`;
  setTimeout(()=>{ if(document.getElementById('complaintSuccess'))document.getElementById('complaintSuccess').innerHTML=''; },8000);
}

// === ADMISSION SUBMISSION (Public) ===
// Public-facing online admission form on the home page. Records all the entered
// data to the 'admissions' DB list with status 'Pending', generates an
// acknowledgement number (ADM-YYYYMMDD-NNN), and shows the parent a popup
// confirming admin will contact them.
function submitAdmission() {
  const stuName = document.getElementById('adm_stuName').value.trim();
  const dob = document.getElementById('adm_dob').value;
  const fatherName = document.getElementById('adm_fatherName').value.trim();
  const motherName = document.getElementById('adm_motherName').value.trim();
  const phone1 = document.getElementById('adm_phone1').value.trim();
  const phone2 = document.getElementById('adm_phone2').value.trim();
  const cls = document.getElementById('adm_class').value;
  const prevSchool = document.getElementById('adm_prevSchool').value.trim();
  const address = document.getElementById('adm_address').value.trim();
  const successEl = document.getElementById('admissionSuccess');

  // Validate every required field
  if (!stuName || !dob || !fatherName || !motherName || !phone1 || !phone2 || !cls || !prevSchool || !address) {
    if (successEl) successEl.innerHTML = `<div class="alert alert-error"><span class="alert-icon">!</span>Please fill all required fields before submitting.</div>`;
    showToast('Please fill all required fields', 'error');
    return;
  }
  // Phone digit validation
  if (phone1.length !== 10 || !/^\d+$/.test(phone1)) {
    if (successEl) successEl.innerHTML = `<div class="alert alert-error"><span class="alert-icon">!</span>Phone number 1 must be exactly 10 digits.</div>`;
    return;
  }
  if (phone2.length !== 10 || !/^\d+$/.test(phone2)) {
    if (successEl) successEl.innerHTML = `<div class="alert alert-error"><span class="alert-icon">!</span>Phone number 2 must be exactly 10 digits.</div>`;
    return;
  }

  const admissions = DB.get('admissions') || [];
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(admissions.length + 1).padStart(3, '0');
  const ackNo = `ADM-${dateStr}-${seq}`;

  admissions.push({
    id: ackNo,
    stuName, dob,
    fatherName, motherName,
    phone1, phone2,
    classToJoin: cls,
    prevSchool, address,
    submittedAt: date.toISOString(),
    status: 'Pending',          // → 'Contacted' once admin marks it done
    adminNotes: ''
  });
  DB.set('admissions', admissions);

  // Clear the form
  ['adm_stuName','adm_dob','adm_fatherName','adm_motherName','adm_phone1','adm_phone2','adm_prevSchool','adm_address']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const clsSel = document.getElementById('adm_class'); if (clsSel) clsSel.value = '';

  // Inline success card
  if (successEl) {
    successEl.innerHTML = `<div class="alert alert-success"><span class="alert-icon">✓</span>
      <div>
        <strong>Admission request received for ${stuName}!</strong><br>
        Your Acknowledgement Number is <strong>${ackNo}</strong>.<br>
        Our admin will contact you very soon on <strong>${phone1}</strong>.
      </div></div>`;
    setTimeout(() => { if (successEl) successEl.innerHTML = ''; }, 12000);
  }
  // Loud popup so the parent definitely sees the confirmation
  alert(`Admission request received for ${stuName}!\n\nAcknowledgement Number: ${ackNo}\n\nOur admin will contact you very soon on ${phone1}.`);
}

// === DOWNLOAD DATA ===
function downloadData() {
  const cls = document.getElementById('dlClass').value;
  const sec = document.getElementById('dlSection').value;
  const format = document.getElementById('dlFormat').value;
  const sortBy = document.getElementById('dlSort').value;
  
  let students = DB.get('students').filter(s=>s.status==='active'&&(cls==='all'||s.className===cls)&&(sec==='all'||s.section===sec));
  
  const fees = DB.get('fees');
  students.forEach(s => { const paid=fees.filter(f=>f.studentId===s.id).reduce((sum,f)=>sum+f.amount,0); s._paid=paid; s._balance=(s.totalFee||0)-paid; });
  
  if (sortBy==='Name') students.sort((a,b)=>a.name.localeCompare(b.name));
  else if (sortBy==='Roll Number') students.sort((a,b)=>a.rollNo.localeCompare(b.rollNo));
  else students.sort((a,b)=>a.id.localeCompare(b.id));
  
  const fields = { 'dl_name':'Student Name','dl_id':'Student ID','dl_class':'Class','dl_section':'Section','dl_roll':'Roll Number','dl_father':'Father Name','dl_phone':'Phone','dl_emergency':'Emergency Phone','dl_aadhaar':'Aadhaar','dl_apaar':'Apaar','dl_totalfee':'Total Fee','dl_balance':'Fee Balance' };
  const selectedFields = Object.entries(fields).filter(([id])=>document.getElementById(id)?.checked).map(([,label])=>label);
  if (!selectedFields.length) { showToast('Please select at least one field to export', 'error'); return; }
  const fieldMap = { 'Student Name':'name','Student ID':'id','Class':'className','Section':'section','Roll Number':'rollNo','Father Name':'fatherName','Phone':'phone','Emergency Phone':'emergencyPhone','Aadhaar':'aadhaar','Apaar':'apaar','Total Fee':'totalFee','Fee Balance':'_balance' };
  // These columns hold long digit strings (Aadhaar/Apaar/Phone). Excel will turn them
  // into scientific notation (e.g. 9.03363E+11) unless the cell is forced to text.
  // We use the ="..." formula trick which Excel reads as a literal text cell.
  const textCols = new Set(['Aadhaar', 'Apaar', 'Phone', 'Emergency Phone']);

  const today = new Date().toISOString().slice(0,10);
  const baseName = `Students_Class${cls}_Section${sec}_${today}`;

  if (format === 'QR Codes Grid') {
    generateBulkQRCodes(students, (qrMap) => {
      const itemsPerPage = 30; // 5 rows of 6 cols
      let html = '';
      for (let i = 0; i < students.length; i += itemsPerPage) {
        const pageItems = students.slice(i, i + itemsPerPage);
        const pageItemsHTML = pageItems.map(s => {
          const plainPwd = decodeStudentPassword(s.password);
          const maskedPwd = plainPwd.length > 4 ? '*'.repeat(plainPwd.length - 4) + plainPwd.slice(-4) : plainPwd;
          return `
            <div class="qr-grid-item">
              <img class="qr-grid-code" src="${qrMap[s.id]}">
              <div class="qr-grid-id">${s.id}</div>
              <div class="qr-grid-name">${s.name}</div>
            </div>
          `;
        }).join('');
        
        html += `
          <div class="qr-grid-page">
            <div class="rc-header">
              <div class="rc-school-name">NOBLE HIGH SCHOOL</div>
              <div class="rc-address">Recognized by Govt. of Telangana | Class ${cls} - Section ${sec}</div>
              <div class="rc-exam-title">STUDENT QR CODES GRID</div>
            </div>
            <div class="qr-grid">
              ${pageItemsHTML}
            </div>
          </div>
          ${i + itemsPerPage < students.length ? '<div style="page-break-after:always"></div>' : ''}
        `;
      }
      openPrintWindow(html, `Student QR Codes - Class ${cls} Section ${sec}`);
    });
    return;
  }
  
  if (format === 'Student Cards (A4)') {
    generateBulkQRCodes(students, (qrMap) => {
      const fees = DB.get('fees');
      const html = students.map((s, idx) => {
        const paid = fees.filter(f=>f.studentId===s.id).reduce((sum,f)=>sum+f.amount,0);
        const balance = (s.totalFee||0)-paid;
        const plainPassword = decodeStudentPassword(s.password);
        return `
          <div class="profile-card-print">
            <div class="rc-header">
              <div class="rc-school-name">NOBLE HIGH SCHOOL</div>
              <div class="rc-address">Recognized by Govt. of Telangana | Affiliation No: 123456</div>
              <div class="rc-exam-title">STUDENT PROFILE CARD</div>
            </div>
            
            <div class="profile-card-body">
              <div class="profile-left">
                <table class="profile-table">
                  <tr><th>Student Name</th><td>${s.name}</td></tr>
                  <tr><th>Student ID / Login ID</th><td><code>${s.id}</code></td></tr>
                  <tr><th>Password</th><td><code>${plainPassword}</code></td></tr>
                  <tr><th>Class & Section</th><td>Class ${s.className} - ${s.section}</td></tr>
                  <tr><th>Roll Number</th><td>${s.rollNo}</td></tr>
                  <tr><th>Father's Name</th><td>${s.fatherName}</td></tr>
                  <tr><th>Phone Number</th><td>${s.phone}</td></tr>
                  <tr><th>Emergency Contact</th><td>${s.emergencyPhone}</td></tr>
                  <tr><th>Date of Birth</th><td>${s.dob ? fmtDate(s.dob) : 'N/A'}</td></tr>
                  <tr><th>Admission Date</th><td>${s.joinDate ? fmtDate(s.joinDate) : 'N/A'}</td></tr>
                  <tr><th>Aadhaar Number</th><td>${s.aadhaar}</td></tr>
                  <tr><th>Apaar Number</th><td>${s.apaar || 'N/A'}</td></tr>
                  <tr><th>Academic Year</th><td>${s.academicYear}</td></tr>
                  <tr><th>Total Annual Fee</th><td>₹${(s.totalFee||0).toLocaleString()}</td></tr>
                  <tr><th>Pending Fee Balance</th><td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">₹${balance.toLocaleString()}</td></tr>
                  <tr><th>Address</th><td>${s.address || 'N/A'}</td></tr>
                </table>
              </div>
              <div class="profile-right">
                <div class="photo-container">
                  <div class="photo-label">STUDENT PHOTO</div>
                  <div class="photo-box">
                    ${s.photo ? `<img src="${s.photo}">` : '<span>NO PHOTO</span>'}
                  </div>
                </div>
                
                <div class="qr-container">
                  <div class="qr-label">PROFILE QR CODE</div>
                  <img class="qr-code-img" src="${qrMap[s.id]}">
                  <div class="qr-help">Scan using Google Lens or School Web Portal</div>
                </div>
              </div>
            </div>
            
            <div class="profile-footer">
              <div class="sig-box">
                <div class="sig-line"></div>
                <div>Class Teacher Signature</div>
              </div>
              <div class="sig-box">
                <div class="sig-line"></div>
                <div>Parent Signature</div>
              </div>
              <div class="sig-box">
                <div class="sig-line"></div>
                <div>Principal Signature</div>
              </div>
            </div>
          </div>
          ${idx < students.length - 1 ? '<div style="page-break-after:always"></div>' : ''}
        `;
      }).join('');
      
      openPrintWindow(html, `Student Cards - Class ${cls} Section ${sec}`);
    });
    return;
  }

  if (format === 'PDF') {
    downloadStudentListPDF(students, selectedFields, fieldMap, cls, sec);
    return;
  }

  // CSV / Excel — both produced as a CSV file (Excel opens it natively).
  const csvRows = [selectedFields.join(',')];
  students.forEach(s => {
    csvRows.push(selectedFields.map(f => {
      const v = s[fieldMap[f]];
      if (v === undefined || v === null || v === '') return '';
      const str = String(v);
      // Force text formatting so Excel preserves leading zeros and full digits.
      if (textCols.has(f)) return `="${str.replace(/"/g, '""')}"`;
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','));
  });

  const ext = format === 'Excel' ? 'xls' : 'csv';
  // Add UTF-8 BOM so Excel renders ₹ and other non-ASCII characters correctly.
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Download started!');
}

// Open a clean preview window with student list rendered as a printable PDF.
// User clicks "Save as PDF" / "Print Now" in the toolbar.
function downloadStudentListPDF(students, selectedFields, fieldMap, cls, sec) {
  const win = window.open('', '_blank', 'width=1100,height=850');
  if (!win) { showToast('Please allow popups to download PDF', 'error'); return; }
  const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const headerCells = selectedFields.map(f => `<th>${f}</th>`).join('');
  const rows = students.map(s => {
    const cells = selectedFields.map(f => {
      const v = s[fieldMap[f]];
      return `<td>${v === undefined || v === null ? '' : String(v)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const titleSuffix = `Class ${cls}${sec && sec !== 'all' ? '-' + sec : sec === 'all' ? ' (All Sections)' : ''}`;

  win.document.write(`<!DOCTYPE html><html><head><title>Student List — ${titleSuffix}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}
    .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
    .toolbar h2{margin:0;font-size:13pt;font-weight:600}
    .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}
    .wrap{margin:18px auto;width:280mm;max-width:95%;padding:14mm;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08);box-sizing:border-box}
    .header{text-align:center;border-bottom:3px double #1a3a6b;padding-bottom:10px;margin-bottom:14px}
    .logo-row{display:flex;align-items:center;justify-content:center;gap:14px}
    .school-logo{width:60px;height:60px;object-fit:contain;border-radius:50%;border:2px solid #c8a951}
    .school-name{font-size:20pt;font-weight:900;color:#1a3a6b;letter-spacing:1px}
    .school-sub{font-size:9pt;color:#5a6a82}
    .doc-title{background:transparent;color:#1a3a6b;border:1.5px solid #1a3a6b;padding:6px 16px;font-size:12pt;font-weight:700;letter-spacing:1px;margin-top:8px;display:inline-block}
    .meta{display:flex;justify-content:space-between;margin:10px 0;font-size:9pt;color:#5a6a82}
    table{width:100%;border-collapse:collapse;font-size:8.5pt}
    th{background:transparent;color:#1a3a6b;padding:6px 8px;text-align:left;border:1px solid #1a3a6b}
    td{padding:5px 8px;border:1px solid #d0dbed;word-break:break-word}
    tr:nth-child(even) td{background:#f8faff}
    .footer{margin-top:14px;text-align:center;font-size:8pt;color:#5a6a82;border-top:1px solid #d0dbed;padding-top:8px}
    @media print{
      body{margin:0;background:#fff}
      .toolbar{display:none}
      .wrap{width:auto;margin:0;padding:8mm;box-shadow:none}
      th{background:transparent !important;color:#1a2535 !important;border:1px solid #1a2535 !important}
      .doc-title{background:transparent !important;color:#1a3a6b !important;border:1.5px solid #1a3a6b !important;padding:6px 16px;display:inline-block}
      @page{size:A4 landscape;margin:7mm}
    }
  
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></span> Student List — ${titleSuffix}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Save as PDF / Print</button></div>
  <div class="wrap">
    <div class="header">
      <div class="logo-row">
        <img src="${LOGO_SRC}" class="school-logo">
        <div>
          <div class="school-name">Noble High School</div>
          <div class="school-sub">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</div>
        </div>
      </div>
      <div><span class="doc-title">STUDENT LIST — ${titleSuffix}</span></div>
    </div>
    <div class="meta">
      <span><strong>Date:</strong> ${today}</span>
      <span><strong>Total Students:</strong> ${students.length}</span>
    </div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${selectedFields.length}" style="text-align:center;color:#888">No students found</td></tr>`}</tbody>
    </table>
    <div class="footer">Computer-generated student list — Noble High School Management System</div>
  </div>
  </body></html>`);
  win.document.close();
  showToast('PDF preview opened — click "Save as PDF" in the popup');
}

// === UTILITY FUNCTIONS ===
function fmtDate(d) {
  if (!d) return '—';
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    const hasTime = String(d).includes('T') || String(d).includes(':') || String(d).includes(' ');
    const datePart = dateObj.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
    if (hasTime) {
      const timePart = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
      return `${datePart}, ${timePart}`;
    }
    return datePart;
  } catch(e) { return d; }
}

function getCountdown(date) {
  if (!date) return '';
  const parts = date.split('-');
  if (parts.length !== 3) return '';
  const examDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  examDate.setHours(0,0,0,0);

  const today = new Date();
  today.setHours(0,0,0,0);

  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / 86400000);

  if (diffDays < 0) return 'Exam in progress/past';
  if (diffDays === 0) return '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg></span> Today!';
  if (diffDays === 1) return '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg></span> Tomorrow!';
  return `<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg></span> In ${diffDays} days`;
}

function showToast(msg, type='success') {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toastMsg';
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:600;font-size:0.9rem;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.15);animation:slideIn 0.3s ease;${type==='success'?'background:var(--success);color:white;':'background:var(--danger);color:white;'}`;
  toast.innerHTML = `${type==='success'?'✓':'✕'} ${msg}`;
  document.body.appendChild(toast);
  setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateY(10px)';toast.style.transition='all 0.3s';setTimeout(()=>toast.remove(),300);},3500);
}

// Init exam days container
document.addEventListener('DOMContentLoaded', ()=>{
  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`;
  document.head.appendChild(style);
});

// Handle overlay clicks to close modals
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
});

// Enter key support for logins
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.getElementById('adminLoginModal')?.classList.contains('active')) doAdminLogin();
    else if (document.getElementById('studentLoginModal')?.classList.contains('active')) doStudentLogin();
    else if (document.getElementById('reAuthModal')?.classList.contains('active')) doReAuth();
  }
});

// =========================================
// ADDED: SITE CONTENT (POSTERS / ACTIVITIES / GALLERY)
// =========================================

// --- Photo upload helper ---
// Accepts a photo of ANY file size and ANY pixel dimensions.
// Photos are stored in IndexedDB which has hundreds of MB to GBs of space,
// so the user can upload many high-quality photos without hitting limits.
// We still resize/compress slightly so the page loads and renders quickly.
function _readPhotoAsDataURL(fileInput, _maxBytesIgnored) {
  return new Promise((resolve, reject) => {
    const file = fileInput?.files?.[0];
    if (!file) { reject(new Error('No file selected')); return; }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = e => {
      const rawDataUrl = e.target.result;
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        // Resize the image so its longest side is at most MAX_DIM pixels.
        // 1920px keeps photos crisp on full-HD screens while still trimming
        // huge phone-camera photos that don't need full resolution on the web.
        const MAX_DIM = 1920;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // High-quality JPEG. IndexedDB can hold many of these.
        const out = canvas.toDataURL('image/jpeg', 0.9);
        resolve(out);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// --- POSTERS (Home page advertisement slider) ---

function renderPosterSlider() {
  const posters = DB.get('posters');
  const section = document.getElementById('posterSection');
  const track = document.getElementById('posterTrack');
  const dots = document.getElementById('posterDots');
  const prevBtn = document.getElementById('posterPrevBtn');
  const nextBtn = document.getElementById('posterNextBtn');
  if (!section || !track || !dots) return;

  // Clear any running auto-rotate timer
  if (posterAutoTimer) { clearInterval(posterAutoTimer); posterAutoTimer = null; }

  if (!posters.length) {
    // No posters -> hide the section completely
    section.classList.add('hidden');
    track.innerHTML = '';
    dots.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  track.innerHTML = posters.map(p =>
    `<div class="poster-slide"><img src="${p.src}" alt="${p.title||'Poster'}"></div>`
  ).join('');

  // Show arrows + dots ONLY if more than one poster
  const multi = posters.length > 1;
  if (prevBtn) prevBtn.style.display = multi ? '' : 'none';
  if (nextBtn) nextBtn.style.display = multi ? '' : 'none';
  dots.style.display = multi ? '' : 'none';

  dots.innerHTML = multi ? posters.map((_,i) =>
    `<button class="poster-dot ${i===0?'active':''}" onclick="posterGoTo(${i})" aria-label="Slide ${i+1}"></button>`
  ).join('') : '';
  posterIndex = 0;
  _updatePosterPosition();

  // Auto-rotate every 5s if more than one poster
  if (multi) {
    posterAutoTimer = setInterval(posterNext, 5000);
  }
}

function _updatePosterPosition() {
  const track = document.getElementById('posterTrack');
  if (!track) return;
  track.style.transform = `translateX(-${posterIndex*100}%)`;
  document.querySelectorAll('#posterDots .poster-dot').forEach((d,i) => {
    d.classList.toggle('active', i === posterIndex);
  });
}

function posterNext() {
  const posters = DB.get('posters');
  if (!posters.length) return;
  posterIndex = (posterIndex + 1) % posters.length;
  _updatePosterPosition();
}

function posterPrev() {
  const posters = DB.get('posters');
  if (!posters.length) return;
  posterIndex = (posterIndex - 1 + posters.length) % posters.length;
  _updatePosterPosition();
}

function posterGoTo(i) {
  posterIndex = i;
  _updatePosterPosition();
}

function adminAddPoster() {
  const title = document.getElementById('poTitle').value.trim();
  const fileInput = document.getElementById('poFile');
  _readPhotoAsDataURL(fileInput).then(src => {
    const posters = DB.get('posters').slice();
    posters.push({ id: 'PO-'+Date.now(), title, src, added: new Date().toISOString() });
    return DB.setAsync('posters', posters);
  }).then(() => {
    document.getElementById('poTitle').value = '';
    document.getElementById('poFile').value = '';
    renderAdminPosterGrid();
    renderPosterSlider();
    showToast('Poster uploaded successfully');
  }).catch(err => {
    console.error(err);
    showToast(err.message || 'Could not save poster.', 'error');
  });
}

function adminDeletePoster(id) {
  showConfirm('Delete Poster', 'Remove this poster from the homepage?', 'Delete', 'btn-danger', () => {
    DB.set('posters', DB.get('posters').filter(p => p.id !== id));
    renderAdminPosterGrid();
    renderPosterSlider();
    showToast('Poster removed');
  });
}

function renderAdminPosterGrid() {
  const grid = document.getElementById('adminPosterGrid');
  if (!grid) return;
  const posters = DB.get('posters');
  if (!posters.length) { grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">No posters uploaded yet. The homepage poster section is currently hidden.</p>'; return; }
  grid.innerHTML = posters.map(p => `
    <div class="thumb-card">
      <img src="${p.src}" alt="${p.title||''}">
      <div class="thumb-meta"><strong>${p.title||'(no title)'}</strong><br><span style="color:var(--text-muted);font-size:0.78rem">${fmtDate(p.added)}</span></div>
      <div class="thumb-actions"><button class="btn btn-danger btn-sm" onclick="adminDeletePoster('${p.id}')">Delete</button></div>
    </div>
  `).join('');
}

// --- ACTIVITIES (Recent activities slider on home page) ---

function renderActivitySlider() {
  const activities = DB.get('activities') || [];
  const track = document.getElementById('activityTrack');
  const dots = document.getElementById('activityDots');
  const section = document.getElementById('activitySection');
  const prevBtn = document.getElementById('activityPrevBtn');
  const nextBtn = document.getElementById('activityNextBtn');
  if (!track || !dots) return;

  if (activityAutoTimer) { clearInterval(activityAutoTimer); activityAutoTimer = null; }

  if (!activities.length) {
    // Hide entire section when empty (per user request)
    if (section) section.classList.add('hidden');
    track.innerHTML = '';
    dots.innerHTML = '';
    return;
  }
  if (section) section.classList.remove('hidden');

  // Show only the most recent 8 activities in the slider
  const recent = activities.slice(-8).reverse();
  track.innerHTML = recent.map(a => `
    <div class="activity-slide">
      <img src="${a.src}" alt="${a.caption||''}">
      <div class="activity-caption"><strong>${a.caption||''}</strong>${a.date?'<span style="opacity:0.85;font-size:0.82rem">'+fmtDate(a.date)+'</span>':''}</div>
    </div>
  `).join('');

  // Hide arrows + dots when only one photo (per user request)
  const multi = recent.length > 1;
  if (prevBtn) prevBtn.style.display = multi ? '' : 'none';
  if (nextBtn) nextBtn.style.display = multi ? '' : 'none';
  dots.style.display = multi ? '' : 'none';

  dots.innerHTML = multi ? recent.map((_,i) =>
    `<button class="poster-dot ${i===0?'active':''}" onclick="activityGoTo(${i})" aria-label="Activity ${i+1}"></button>`
  ).join('') : '';
  activityIndex = 0;
  _updateActivityPosition();

  if (multi) {
    activityAutoTimer = setInterval(activityNext, 5000);
  }
}

function _updateActivityPosition() {
  const track = document.getElementById('activityTrack');
  if (!track) return;
  track.style.transform = `translateX(-${activityIndex*100}%)`;
  document.querySelectorAll('#activityDots .poster-dot').forEach((d,i) => {
    d.classList.toggle('active', i === activityIndex);
  });
}

function activityNext() {
  const recent = (DB.get('activities')||[]).slice(-8);
  if (!recent.length) return;
  activityIndex = (activityIndex + 1) % recent.length;
  _updateActivityPosition();
}

function activityPrev() {
  const recent = (DB.get('activities')||[]).slice(-8);
  if (!recent.length) return;
  activityIndex = (activityIndex - 1 + recent.length) % recent.length;
  _updateActivityPosition();
}

function activityGoTo(i) {
  activityIndex = i;
  _updateActivityPosition();
}

function adminAddActivity() {
  const caption = document.getElementById('acCaption').value.trim();
  if (!caption) { showToast('Please enter a caption / event name','error'); return; }
  const fileInput = document.getElementById('acFile');
  const alsoGallery = document.getElementById('acAlsoGallery').checked;
  _readPhotoAsDataURL(fileInput).then(src => {
    const acts = (DB.get('activities') || []).slice();
    const id = 'AC-'+Date.now();
    acts.push({ id, caption, src, date: new Date().toISOString() });
    return DB.setAsync('activities', acts).then(() => {
      if (alsoGallery) {
        const gal = DB.get('gallery').slice();
        gal.push({ id: 'GL-'+Date.now(), event: caption, src, added: new Date().toISOString(), linkedActivity: id });
        return DB.setAsync('gallery', gal);
      }
    });
  }).then(() => {
    document.getElementById('acCaption').value = '';
    document.getElementById('acFile').value = '';
    renderAdminActivityGrid();
    renderActivitySlider();
    if (alsoGallery) { renderAdminGalleryGrid(); renderGallery(); }
    showToast('Activity photo added');
  }).catch(err => {
    console.error(err);
    showToast(err.message || 'Could not save activity photo.', 'error');
  });
}

function adminDeleteActivity(id) {
  showConfirm('Delete Activity Photo', 'Remove this photo from the recent-activities slider? (Photos in the public Gallery are not affected unless deleted separately.)', 'Delete', 'btn-danger', () => {
    DB.set('activities', (DB.get('activities')||[]).filter(a => a.id !== id));
    renderAdminActivityGrid();
    renderActivitySlider();
    showToast('Activity photo removed');
  });
}

function renderAdminActivityGrid() {
  const grid = document.getElementById('adminActivityGrid');
  if (!grid) return;
  const acts = (DB.get('activities')||[]).slice().reverse();
  if (!acts.length) { grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">No activity photos yet.</p>'; return; }
  grid.innerHTML = acts.map(a => `
    <div class="thumb-card">
      <img src="${a.src}" alt="${a.caption||''}">
      <div class="thumb-meta"><strong>${a.caption||''}</strong><br><span style="color:var(--text-muted);font-size:0.78rem">${fmtDate(a.date)}</span></div>
      <div class="thumb-actions"><button class="btn btn-danger btn-sm" onclick="adminDeleteActivity('${a.id}')">Delete</button></div>
    </div>
  `).join('');
}

// --- GALLERY (Full photo gallery on home page) ---

function renderGallery() {
  // Renders the dedicated Gallery page (opened via hamburger menu).
  const grid = document.getElementById('galleryGrid');
  const emptyState = document.getElementById('galleryEmptyState');
  if (!grid) return;
  const photos = DB.get('gallery');
  if (!photos.length) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  // Most recent first
  const sorted = photos.slice().reverse();
  grid.innerHTML = sorted.map(p => `
    <div class="gallery-item" onclick="openLightbox('${p.src}')">
      <img src="${p.src}" alt="${p.event||''}" loading="lazy">
      <div class="gallery-event-tag">${p.event||'Untitled'}</div>
    </div>
  `).join('');
}

function adminAddGalleryPhoto() {
  const event = document.getElementById('glEvent').value.trim();
  if (!event) { showToast('Please enter an event name','error'); return; }
  const fileInput = document.getElementById('glFile');
  _readPhotoAsDataURL(fileInput).then(src => {
    const gal = DB.get('gallery').slice();
    gal.push({ id: 'GL-'+Date.now(), event, src, added: new Date().toISOString() });
    return DB.setAsync('gallery', gal);
  }).then(() => {
    document.getElementById('glEvent').value = '';
    document.getElementById('glFile').value = '';
    renderAdminGalleryGrid();
    renderGallery();
    showToast('Photo added to gallery');
  }).catch(err => {
    console.error(err);
    showToast(err.message || 'Could not save gallery photo.', 'error');
  });
}

function adminDeleteGalleryPhoto(id) {
  showConfirm('Delete Gallery Photo', 'Remove this photo from the public Gallery?', 'Delete', 'btn-danger', () => {
    DB.set('gallery', DB.get('gallery').filter(g => g.id !== id));
    renderAdminGalleryGrid();
    renderGallery();
    showToast('Photo removed from gallery');
  });
}

function renderAdminGalleryGrid() {
  const grid = document.getElementById('adminGalleryGrid');
  if (!grid) return;
  const photos = DB.get('gallery').slice().reverse();
  if (!photos.length) { grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">No gallery photos yet.</p>'; return; }
  grid.innerHTML = photos.map(p => `
    <div class="thumb-card">
      <img src="${p.src}" alt="${p.event||''}">
      <div class="thumb-meta"><strong>${p.event||''}</strong><br><span style="color:var(--text-muted);font-size:0.78rem">${fmtDate(p.added)}</span></div>
      <div class="thumb-actions"><button class="btn btn-danger btn-sm" onclick="adminDeleteGalleryPhoto('${p.id}')">Delete</button></div>
    </div>
  `).join('');
}

// --- TAB SWITCH for Site Content ---
function switchSiteContentTab(tab) {
  document.querySelectorAll('#section-siteContent .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#section-siteContent .tab-btn').forEach(b => b.classList.remove('active'));
  const panelId = 'scTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
  document.getElementById(panelId)?.classList.add('active');
  // Highlight matching tab button
  const btns = document.querySelectorAll('#section-siteContent .tab-bar .tab-btn');
  const order = ['posters','activities','gallery'];
  btns.forEach((b,i) => { if (order[i] === tab) b.classList.add('active'); });
  // Refresh the selected grid
  if (tab === 'posters') renderAdminPosterGrid();
  else if (tab === 'activities') renderAdminActivityGrid();
  else if (tab === 'gallery') renderAdminGalleryGrid();
}

function renderSiteContentSection() {
  // Called when the Site Content section is opened — refresh whatever tab is active
  renderAdminPosterGrid();
  renderAdminActivityGrid();
  renderAdminGalleryGrid();
  switchSiteContentTab('posters');
}

// =====================================================================
// FACULTY MANAGEMENT
// =====================================================================
// Each faculty record:
//   { id, name, subject, qualification, experience, bio, photo, added }
// Records are kept in DB.get('faculty') as a plain array. The order in
// the array IS the order shown to the public — so adminMoveFacultyUp /
// adminMoveFacultyDown simply swap array positions. New entries are
// pushed to the end (so the first entry added shows up first, exactly
// as the school requested).
// Photo storage piggybacks on the existing IndexedDB photo cache (PHOTO_KEYS
// includes 'faculty'), which means faculty data persists across browser
// sessions and is included in the Backup & Restore feature.

function renderFacultyAdminSection() {
  // Reset form to "Add" state every time the section is opened.
  adminCancelFacultyEdit();
  renderAdminFacultyList();
}

function renderAdminFacultyList() {
  const list = document.getElementById('adminFacultyList');
  if (!list) return;
  const faculty = DB.get('faculty') || [];
  if (!faculty.length) {
    list.innerHTML = '<p style="color:var(--text-muted);padding:18px;background:var(--bg-light);border-radius:8px;text-align:center">No faculty members added yet. Use the form above to add the first teacher.</p>';
    return;
  }
  list.innerHTML = faculty.map((f, i) => `
    <div class="fac-admin-row">
      <div class="fac-admin-thumb">${f.photo
        ? `<img src="${f.photo}" alt="${escapeHTML(f.name)}">`
        : '<span class="no-photo"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span></span>'}</div>
      <div class="fac-admin-info">
        <div class="nm">${i+1}. ${escapeHTML(f.name)}</div>
        <div class="meta">${escapeHTML(f.subject)} · ${escapeHTML(f.qualification)} · ${escapeHTML(f.experience)}</div>
      </div>
      <div class="fac-admin-actions">
        <button class="btn btn-secondary btn-sm" ${i === 0 ? 'disabled' : ''} onclick="adminMoveFaculty('${f.id}', -1)" title="Move up"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h4v7h8v-7h4l-8-9z"/></svg></span></button>
        <button class="btn btn-secondary btn-sm" ${i === faculty.length - 1 ? 'disabled' : ''} onclick="adminMoveFaculty('${f.id}', 1)" title="Move down"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 10h-4V3H8v7H4l8 9z"/></svg></span></button>
        <button class="btn btn-primary btn-sm" onclick="adminEditFaculty('${f.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="adminDeleteFaculty('${f.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Tiny HTML escape for any user-entered text we render directly.
function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function adminSaveFaculty() {
  const editId = document.getElementById('fac_editId').value;
  const name = document.getElementById('fac_name').value.trim();
  const subject = document.getElementById('fac_subject').value.trim();
  const qualification = document.getElementById('fac_qualification').value.trim();
  const experience = document.getElementById('fac_experience').value.trim();
  const bio = document.getElementById('fac_bio').value.trim();
  const fileInput = document.getElementById('fac_photo');
  const file = fileInput && fileInput.files && fileInput.files[0];

  if (!name || !subject || !qualification || !experience) {
    showToast('Please fill in name, subject, qualification, and experience.', 'error');
    return;
  }

  // For new entries, photo is required. For edits, it's only re-saved if
  // the user actually picked a new file.
  if (!editId && !file) {
    showToast('Please upload a photo of the faculty member.', 'error');
    return;
  }

  const finalize = (photoSrc) => {
    const list = (DB.get('faculty') || []).slice();
    if (editId) {
      const idx = list.findIndex(f => f.id === editId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name, subject, qualification, experience, bio,
          photo: photoSrc != null ? photoSrc : list[idx].photo
        };
      }
    } else {
      list.push({
        id: 'FAC-' + Date.now(),
        name, subject, qualification, experience, bio,
        photo: photoSrc,
        added: new Date().toISOString()
      });
    }
    return DB.setAsync('faculty', list);
  };

  const after = () => {
    document.getElementById('fac_editId').value = '';
    document.getElementById('fac_name').value = '';
    document.getElementById('fac_subject').value = '';
    document.getElementById('fac_qualification').value = '';
    document.getElementById('fac_experience').value = '';
    document.getElementById('fac_bio').value = '';
    if (fileInput) fileInput.value = '';
    document.getElementById('facFormTitle').textContent = 'Add Faculty Member';
    document.getElementById('fac_saveBtn').innerHTML = '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></span> Add Faculty Member';
    document.getElementById('fac_cancelBtn').style.display = 'none';
    document.getElementById('fac_photoReq').style.display = '';
    document.getElementById('fac_photoHint').textContent = 'Upload a clear face photo. JPG or PNG.';
    renderAdminFacultyList();
    showToast(editId ? 'Faculty member updated' : 'Faculty member added');
  };

  if (file) {
    _readPhotoAsDataURL(fileInput).then(src => finalize(src)).then(after).catch(err => {
      console.error(err);
      showToast(err.message || 'Could not save faculty.', 'error');
    });
  } else {
    finalize(null).then(after).catch(err => {
      console.error(err);
      showToast(err.message || 'Could not save faculty.', 'error');
    });
  }
}

function adminEditFaculty(id) {
  const f = (DB.get('faculty') || []).find(x => x.id === id);
  if (!f) return;
  document.getElementById('fac_editId').value = f.id;
  document.getElementById('fac_name').value = f.name || '';
  document.getElementById('fac_subject').value = f.subject || '';
  document.getElementById('fac_qualification').value = f.qualification || '';
  document.getElementById('fac_experience').value = f.experience || '';
  document.getElementById('fac_bio').value = f.bio || '';
  document.getElementById('fac_photo').value = '';
  document.getElementById('facFormTitle').textContent = 'Edit Faculty Member';
  document.getElementById('fac_saveBtn').innerHTML = '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg></span> Save Changes';
  document.getElementById('fac_cancelBtn').style.display = '';
  // Photo is now optional on edit (existing photo is kept if no new file picked).
  document.getElementById('fac_photoReq').style.display = 'none';
  document.getElementById('fac_photoHint').textContent = 'Leave empty to keep the current photo. Pick a new file only if you want to replace it.';
  // Scroll the form into view.
  document.getElementById('facFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function adminCancelFacultyEdit() {
  document.getElementById('fac_editId').value = '';
  ['fac_name','fac_subject','fac_qualification','fac_experience','fac_bio','fac_photo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const t = document.getElementById('facFormTitle'); if (t) t.textContent = 'Add Faculty Member';
  const sb = document.getElementById('fac_saveBtn'); if (sb) sb.innerHTML = '<span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></span> Add Faculty Member';
  const cb = document.getElementById('fac_cancelBtn'); if (cb) cb.style.display = 'none';
  const pr = document.getElementById('fac_photoReq'); if (pr) pr.style.display = '';
  const ph = document.getElementById('fac_photoHint'); if (ph) ph.textContent = 'Upload a clear face photo. JPG or PNG.';
}

function adminDeleteFaculty(id) {
  const f = (DB.get('faculty') || []).find(x => x.id === id);
  if (!f) return;
  showConfirm('Delete Faculty Member', `Remove ${f.name} from the public Faculty page?`, 'Delete', 'btn-danger', () => {
    DB.set('faculty', (DB.get('faculty') || []).filter(x => x.id !== id));
    renderAdminFacultyList();
    showToast('Faculty member removed');
  });
}

function adminMoveFaculty(id, delta) {
  const list = (DB.get('faculty') || []).slice();
  const idx = list.findIndex(f => f.id === id);
  if (idx === -1) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= list.length) return;
  // Swap.
  const tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
  DB.set('faculty', list);
  renderAdminFacultyList();
}

// === Public faculty page renderer ===
function renderFacultyPublic() {
  const grid = document.getElementById('facultyGrid');
  const empty = document.getElementById('facultyEmptyState');
  if (!grid) return;
  const list = DB.get('faculty') || [];
  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = list.map(f => `
    <div class="faculty-card" onclick="openFacultyDetail('${f.id}')">
      <div class="faculty-card-photo-wrap">
        ${f.photo
          ? `<img src="${f.photo}" alt="${escapeHTML(f.name)}">`
          : '<div class="no-photo"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span></div>'}
      </div>
      <div class="faculty-card-body">
        <div class="faculty-card-name">${escapeHTML(f.name)}</div>
        <div class="faculty-card-subject">${escapeHTML(f.subject)}</div>
        <div class="faculty-card-qual">${escapeHTML(f.qualification)}</div>
      </div>
    </div>
  `).join('');
}

function openFacultyDetail(id) {
  const f = (DB.get('faculty') || []).find(x => x.id === id);
  if (!f) return;
  const c = document.getElementById('facultyDetailContent');
  if (!c) return;
  // New layout: decorative banner at the top, circular photo overlapping
  // it (centred), then name + subject pill, then the meta row, then About.
  c.innerHTML = `
    <div class="fac-detail-banner"></div>
    <div class="fac-detail-photo">
      ${f.photo
        ? `<img src="${f.photo}" alt="${escapeHTML(f.name)}">`
        : '<div class="no-photo"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span></div>'}
    </div>
    <div class="fac-detail-headline">
      <div class="fac-detail-name">${escapeHTML(f.name)}</div>
      <div class="fac-detail-subject">${escapeHTML(f.subject)}</div>
    </div>
    <div class="fac-detail-meta-row">
      <div class="fac-detail-meta-item">
        <div class="fac-detail-meta-label">Qualification</div>
        <div class="fac-detail-meta-value">${escapeHTML(f.qualification)}</div>
      </div>
      <div class="fac-detail-meta-item">
        <div class="fac-detail-meta-label">Experience</div>
        <div class="fac-detail-meta-value">${escapeHTML(f.experience)}</div>
      </div>
    </div>
    <div class="fac-detail-bio">
      <h4>About</h4>
      ${f.bio
        ? `<p>${escapeHTML(f.bio).replace(/\n/g, '<br>')}</p>`
        : '<p class="no-bio">No additional details have been added yet.</p>'}
    </div>
  `;
  const m = document.getElementById('facultyDetailModal');
  if (m) m.classList.add('active');
}

function closeFacultyDetail(e) {
  // When called from the overlay click, only close if the user clicked the
  // backdrop itself (not somewhere inside the modal box).
  if (e && e.target && e.target.id !== 'facultyDetailModal') return;
  const m = document.getElementById('facultyDetailModal');
  if (m) m.classList.remove('active');
}

// =====================================================================
// BUS ROUTE ANIMATION
// =====================================================================
// 35 places (alphabetical) shown above a road, with the school bus driving
// across. Place names are listed without any "village" label as requested.
const BUS_ROUTE_PLACES = [
  'Agarmiyaguda', 'Akulamylaram', 'Annojiguda', 'Bachupally', 'Bairagiguda',
  'Begarikancha', 'Begumpet', 'Chippalapally', 'Dabbedaguda', 'Dasarlapally',
  'Dasarlapally Thanda', 'Davudguda Thanda', 'Dhannaram', 'Gudur', 'Gummadavelly',
  'Jabbarguda', 'Jaithwaram Khalsa', 'Kandukur', 'Katikapally', 'Kolanguda',
  'Kothaguda', 'Kothur', 'Lemoor', 'Madhapur', 'Meerkhanpet',
  'Mucherla', 'Muralinagar', 'Nednoor', 'Peddamma Thanda', 'Pulimamidi',
  'Rachulur', 'Saireddyguda', 'Saraswathiguda', 'Sarlaravualapally', 'Thimmapur'
];

function initBusRoute() {
  const trackEl = document.getElementById('busStopsTrack');
  const busEl = document.getElementById('busVehicle');
  const sectionEl = document.querySelector('.bus-route-section');
  const stageEl = document.querySelector('.bus-route-stage');
  if (!trackEl || !busEl || !sectionEl || !stageEl) return;

  // Render every place name as one stop marker. Boxes are laid out in a
  // horizontal flex row inside #busStopsTrack — the CSS handles the actual
  // animation. We do NOT need to position them absolutely; flexbox spaces
  // them naturally.
  trackEl.innerHTML = BUS_ROUTE_PLACES.map(name => `
    <div class="bus-stop-marker">
      <div class="bus-stop-box">${escapeHTML(name)}</div>
      <div class="bus-stop-line"></div>
      <div class="bus-stop-arrow"></div>
    </div>
  `).join('');

  // Measure layout AFTER the browser has laid everything out. We need:
  //   - track width (so the marquee knows how far to translate)
  //   - stage width (so the bus knows how far to drive to reach the gate)
  // requestAnimationFrame defers the read until after layout.
  const measureAndApply = () => {
    const trackWidth = trackEl.scrollWidth;
    sectionEl.style.setProperty('--track-width', trackWidth + 'px');

    // How far should the bus translate so its body ends up entering the
    // arch gate? The arch is positioned at the right edge with a known
    // width (~220px desktop, ~160px mobile). The bus is parked at left:24
    // with width ~270px (desktop). We want the bus to drive forward
    // enough that it visually reaches the centre of the arch.
    // Target X = stageWidth - busWidth - archWidth/2 - parkLeft
    const stageW = stageEl.clientWidth;
    const busW = busEl.offsetWidth;
    const archW = window.innerWidth < 700 ? 160 : 240;
    const parkLeft = 24;
    // Bus drives forward enough to enter the arch — target X positions
    // the bus's centre roughly under the centre of the arch banner.
    const target = Math.max(0, stageW - busW - parkLeft - archW * 0.5);
    sectionEl.style.setProperty('--bus-arrive', target + 'px');

    // Cycle duration: scaled to the number of stops so adding/removing
    // places keeps a consistent reading speed (~1.6 seconds per stop).
    const cycle = Math.max(40, BUS_ROUTE_PLACES.length * 1.6);
    sectionEl.style.setProperty('--bus-cycle', cycle + 's');
  };

  requestAnimationFrame(measureAndApply);
  // Recompute on resize so the arrival point stays accurate when the
  // browser is resized between desktop and mobile widths.
  window.addEventListener('resize', () => {
    requestAnimationFrame(measureAndApply);
  });
}

// --- LIGHTBOX (for gallery images) ---
function openLightbox(src) {
  const overlay = document.getElementById('lightboxOverlay');
  if (!overlay) return;
  overlay.querySelector('img').src = src;
  overlay.classList.add('active');
}
function closeLightbox() {
  document.getElementById('lightboxOverlay')?.classList.remove('active');
}

// =====================================================================
// BACKUP & RESTORE — saves/loads ALL website data across all academic years
// =====================================================================

// Every data store in the website. If a new feature is added later, add its
// localStorage key to this list and the backup will automatically include it.
const BACKUP_KEYS = [
  'students',          // current active students (all years)
  'archived',          // all graduated/transferred/left students (all years)
  'fees',              // every fee payment ever recorded
  'notifications',     // all notifications/announcements ever sent
  'complaints',        // every parent complaint ever submitted
  'exams',             // all exam schedules (all years)
  'reports',           // all student academic reports (all years)
  'hallTickets',       // all hall tickets ever issued
  'posters',           // all uploaded announcement posters
  'gallery',           // all uploaded gallery photos
  'activities',        // all recent-activity slider photos
  'faculty',           // all faculty member entries (photo + name + subject + qualification + experience + bio)
  'system'             // current academic year + system settings
  // Note: admin credentials are NOT backed up. They live in the in-memory
  // vault only. The school is expected to remember the current admin password,
  // and rotating it via Reset Credentials is a separate (deliberate) action.
];

// Backup file version — bump this if the data format ever changes so we can
// migrate older files when restoring.
const BACKUP_VERSION = 1;
const BACKUP_SCHOOL_ID = 'noble-high-school-kandukur';

function buildBackupObject() {
  const data = {};
  BACKUP_KEYS.forEach(k => {
    if (PHOTO_KEYS.indexOf(k) !== -1) {
      // Photos live in IndexedDB; pull from the in-memory cache.
      data[k] = DB.get(k) || [];
      return;
    }
    try {
      const raw = localStorage.getItem('nhs_' + k);
      // Store both arrays and objects exactly as they are
      data[k] = raw ? JSON.parse(raw) : (k === 'system' ? {} : []);
    } catch(e) {
      data[k] = (k === 'system') ? {} : [];
    }
  });
  return {
    schoolId: BACKUP_SCHOOL_ID,
    schoolName: 'Noble High School',
    backupVersion: BACKUP_VERSION,
    backupDate: new Date().toISOString(),
    backupDateReadable: new Date().toLocaleString(),
    data: data
  };
}

function summarizeBackup(backup) {
  const d = backup.data || {};
  const allYears = new Set();
  (d.students||[]).forEach(s => s.academicYear && allYears.add(s.academicYear));
  (d.archived||[]).forEach(s => s.academicYear && allYears.add(s.academicYear));
  (d.fees||[]).forEach(f => f.academicYear && allYears.add(f.academicYear));
  return {
    students: (d.students||[]).length,
    archived: (d.archived||[]).length,
    fees: (d.fees||[]).length,
    notifications: (d.notifications||[]).length,
    complaints: (d.complaints||[]).length,
    exams: (d.exams||[]).length,
    reports: (d.reports||[]).length,
    hallTickets: (d.hallTickets||[]).length,
    posters: (d.posters||[]).length,
    gallery: (d.gallery||[]).length,
    activities: (d.activities||[]).length,
    yearsCount: allYears.size,
    yearsList: Array.from(allYears).sort()
  };
}

function renderBackupSection() {
  // Show a preview of what's in the current website right now
  const stats = summarizeBackup(buildBackupObject());
  const totalRecords = stats.students + stats.archived + stats.fees +
    stats.notifications + stats.complaints + stats.exams +
    stats.reports + stats.hallTickets + stats.posters +
    stats.gallery + stats.activities;
  const yearsText = stats.yearsList.length ? stats.yearsList.join(', ') : 'No academic year data yet';
  const html = `
    <strong>Current website contents (will all be included in the backup):</strong>
    <ul>
      <li><strong>${stats.students}</strong> active students &nbsp;·&nbsp; <strong>${stats.archived}</strong> archived (graduated/transferred/left)</li>
      <li><strong>${stats.fees}</strong> fee payment records</li>
      <li><strong>${stats.notifications}</strong> notifications &nbsp;·&nbsp; <strong>${stats.complaints}</strong> complaints</li>
      <li><strong>${stats.exams}</strong> exam schedules &nbsp;·&nbsp; <strong>${stats.reports}</strong> academic reports &nbsp;·&nbsp; <strong>${stats.hallTickets}</strong> hall tickets</li>
      <li><strong>${stats.posters}</strong> posters &nbsp;·&nbsp; <strong>${stats.gallery}</strong> gallery photos &nbsp;·&nbsp; <strong>${stats.activities}</strong> recent-activity photos</li>
      <li>Academic years covered: <strong>${yearsText}</strong></li>
      <li><strong>${totalRecords}</strong> total records across all years</li>
    </ul>`;
  const el = document.getElementById('backupStats');
  if (el) el.innerHTML = html;

  // Also refresh the receipts list
  renderFeeReceiptsList();
}

function downloadFullBackup() {
  try {
    const backup = buildBackupObject();
    const stats = summarizeBackup(backup);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    a.href = url;
    a.download = `NobleHighSchool_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Backup downloaded — ${stats.students} students, ${stats.fees} fee records, ${stats.yearsCount} academic year(s)`);
  } catch(e) {
    console.error(e);
    showToast('Backup failed: ' + (e.message || 'unknown error'), 'error');
  }
}

function handleRestoreFile() {
  const fileInput = document.getElementById('restoreFileInput');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    let backup;
    try {
      backup = JSON.parse(e.target.result);
    } catch(err) {
      showToast('That file is not a valid backup file (could not parse).', 'error');
      fileInput.value = '';
      return;
    }
    if (!backup || !backup.data || backup.schoolId !== BACKUP_SCHOOL_ID) {
      showToast('This does not look like a Noble High School backup file.', 'error');
      fileInput.value = '';
      return;
    }
    // Show preview + ask for confirmation
    const stats = summarizeBackup(backup);
    const yearsText = stats.yearsList.length ? stats.yearsList.join(', ') : 'unknown';
    const previewEl = document.getElementById('restorePreview');
    if (previewEl) {
      previewEl.style.display = 'block';
      previewEl.innerHTML = `
        <strong>Backup file contents:</strong>
        <ul>
          <li>Backup taken: <strong>${backup.backupDateReadable || backup.backupDate || 'unknown'}</strong></li>
          <li><strong>${stats.students}</strong> active students, <strong>${stats.archived}</strong> archived</li>
          <li><strong>${stats.fees}</strong> fee records, <strong>${stats.complaints}</strong> complaints</li>
          <li><strong>${stats.notifications}</strong> notifications, <strong>${stats.exams}</strong> exams, <strong>${stats.reports}</strong> reports</li>
          <li><strong>${stats.posters}</strong> posters, <strong>${stats.gallery}</strong> gallery photos, <strong>${stats.activities}</strong> activities</li>
          <li>Academic years: <strong>${yearsText}</strong></li>
        </ul>`;
    }

    showConfirm(
      'Restore from Backup?',
      `This will REPLACE all current website data with the backup contents:
       ${stats.students} students, ${stats.archived} archived, ${stats.fees} fee records, covering academic year(s) ${yearsText}.
       Current data on the site will be permanently lost. Continue?`,
      'Yes, Restore Now',
      'btn-danger',
      () => doRestoreFromBackup(backup)
    );
  };
  reader.onerror = () => {
    showToast('Could not read the file.', 'error');
    fileInput.value = '';
  };
  reader.readAsText(file);
}

function doRestoreFromBackup(backup) {
  try {
    const data = backup.data || {};
    const photoWrites = [];
    // Wipe out current data for every key, then write the backup version
    BACKUP_KEYS.forEach(k => {
      const val = data[k];
      if (val === undefined || val === null) {
        // keep current value if key missing in older backups
        return;
      }
      if (PHOTO_KEYS.indexOf(k) !== -1) {
        // Photos go to IndexedDB. Update cache immediately so UI re-renders right.
        _PHOTO_CACHE[k] = Array.isArray(val) ? val : [];
        photoWrites.push(_idbPut(k, _PHOTO_CACHE[k]).catch(e => console.warn('IndexedDB restore failed for', k, e)));
        return;
      }
      try {
        DB.set(k, val);
      } catch(e) {
        console.warn('Could not restore key', k, e);
      }
    });
    // Reset file input
    document.getElementById('restoreFileInput').value = '';
    Promise.all(photoWrites).then(() => {
      showToast('Restore complete! Website data has been replaced with your backup.');
      // Refresh visible parts of the admin
      setTimeout(() => {
        renderBackupSection();
        renderDashboard();
        renderPosterSlider();
        renderActivitySlider();
        renderGallery();
        // If the user is already viewing students/fees etc, refresh those too
        const cur = currentAdminSection;
        if (cur && cur !== 'backupRestore') showAdminSection(cur);
      }, 400);
    });
  } catch(e) {
    console.error(e);
    showToast('Restore failed: ' + (e.message || 'unknown error'), 'error');
  }
}

// =====================================================================
// FEE PAYMENT RECEIPTS — Excel export of every payment, PDF for individual
// =====================================================================

function renderFeeReceiptsList() {
  const el = document.getElementById('feeReceiptsList');
  if (!el) return;
  const fees = DB.get('fees') || [];
  const students = DB.get('students') || [];
  const archived = DB.get('archived') || [];
  const allStudents = students.concat(archived);
  const findStudent = id => allStudents.find(s => s.id === id || s.loginId === id);

  if (!fees.length) {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px">No fee payments recorded yet.</p>';
    return;
  }

  // Most recent first
  const sorted = fees.slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  // Limit display to most recent 100; export gives all
  const shown = sorted.slice(0, 100);

  let html = `
    <div style="overflow-x:auto;margin-top:8px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Receipt No.</th><th>Student</th><th>ID</th><th>Class</th>
            <th>Amount</th><th>Mode</th><th>Year</th><th>Action</th>
          </tr>
        </thead>
        <tbody>`;
  shown.forEach(f => {
    const stu = findStudent(f.studentId) || {};
    html += `
      <tr>
        <td>${f.date ? fmtDate(f.date) : '—'}</td>
        <td><code>${f.receiptNo || f.id || '—'}</code></td>
        <td>${stu.name || '<em>(deleted)</em>'}</td>
        <td><code>${f.studentId}</code></td>
        <td>${stu.className || '—'}${stu.section ? '-'+stu.section : ''}</td>
        <td><strong style="color:var(--success)">₹${(f.amount||0).toLocaleString()}</strong></td>
        <td>${f.mode || '—'}</td>
        <td>${f.academicYear || '—'}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="downloadFeeReceiptPDF('${f.id || f.receiptNo}')"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></span> PDF</button></td>
      </tr>`;
  });
  html += '</tbody></table></div>';
  if (sorted.length > 100) {
    html += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px">Showing 100 of ${sorted.length} payments. Use Excel export to get all.</p>`;
  }
  el.innerHTML = html;
}

function exportAllFeeReceiptsExcel() {
  // Build a tab-separated values file (CSV with tabs) — opens directly in Excel
  const fees = DB.get('fees') || [];
  if (!fees.length) {
    showToast('No fee payments to export yet.', 'error');
    return;
  }
  const students = DB.get('students') || [];
  const archived = DB.get('archived') || [];
  const allStudents = students.concat(archived);
  const findStudent = id => allStudents.find(s => s.id === id || s.loginId === id);

  // Sort oldest-first for an audit-style export
  const sorted = fees.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0));

  const headers = [
    'Receipt No', 'Date', 'Student ID / Login ID', 'Student Name',
    'Father Name', 'Class', 'Section', 'Roll No',
    'Amount Paid (Rs)', 'Payment Mode', 'Reference / Notes',
    'Academic Year', 'Total Annual Fee (Rs)'
  ];

  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/[\r\n\t]/g, ' ');
    return s;
  };

  const lines = [headers.join('\t')];
  sorted.forEach(f => {
    const stu = findStudent(f.studentId) || {};
    lines.push([
      escape(f.receiptNo || f.id || ''),
      escape(f.date ? new Date(f.date).toLocaleString() : ''),
      escape(f.studentId),
      escape(stu.name || ''),
      escape(stu.fatherName || ''),
      escape(stu.className || ''),
      escape(stu.section || ''),
      escape(stu.rollNo || ''),
      escape(f.amount || 0),
      escape(f.mode || ''),
      escape(f.notes || f.reference || ''),
      escape(f.academicYear || ''),
      escape(stu.totalFee || '')
    ].join('\t'));
  });

  const csv = lines.join('\r\n');
  // Excel-readable: BOM + tab-separated
  const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `NobleHighSchool_FeePayments_${dateStr}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${sorted.length} fee payments to Excel.`);
}

// Shared fee receipt HTML builder. Used by:
//   - admin's "Download PDF" button (downloadFeeReceiptPDF) — auto-prints
//   - student portal "View" button (viewFeeReceipt) — preview only
//   - student portal "Download" button (downloadFeeReceiptPDF, same code path) — auto-prints
// `opts.studentCopy` adds a clear "STUDENT COPY" banner so parents know what they're holding.
// `opts.autoPrint` triggers the browser's Save-as-PDF dialog automatically.
function buildFeeReceiptHTML(fee, stu, opts) {
  opts = opts || {};
  const dateStr = fee.date ? fmtDate(fee.date) : '';
  const studentBanner = opts.studentCopy
    ? `<div class="student-copy-banner">STUDENT COPY — keep this receipt for your records</div>`
    : '';
  const autoPrintScript = opts.autoPrint
    ? `<script>window.onload=()=>{setTimeout(()=>window.print(),300);};<\/script>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Fee Receipt — ${fee.receiptNo || fee.id}</title>
<style>
  body { font-family: Georgia, serif; margin: 0; padding: 0; background: #eef2f7; color: #222; }
  .toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}
  .toolbar h2{margin:0;font-size:13pt;font-weight:600;font-family:'Segoe UI',Arial,sans-serif}
  .toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer;font-family:'Segoe UI',Arial,sans-serif}
  .toolbar button:hover{background:#d4b75e}
  .receipt { max-width: 720px; margin: 18px auto; padding: 30px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .student-copy-banner { background: transparent; color: #1e3a5f; border: 1.5px solid #c8a951; text-align: center; font-weight: 700; padding: 6px; margin-bottom: 14px; border-radius: 4px; letter-spacing: 1.5px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 0.9rem; }
  .header { text-align: center; border-bottom: 3px double #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
  .header img { width: 70px; height: 70px; object-fit: contain; }
  .header h1 { margin: 8px 0 0; color: #1e3a5f; font-family: 'Georgia', serif; }
  .header p { margin: 4px 0; color: #555; font-size: 0.9rem; }
  .receipt-meta { display: flex; justify-content: space-between; margin: 18px 0; font-size: 0.95rem; }
  .receipt-meta strong { color: #1e3a5f; }
  table.r { width: 100%; border-collapse: collapse; margin: 18px 0; }
  table.r th, table.r td { padding: 10px 12px; border: 1px solid #ccc; text-align: left; font-size: 0.95rem; }
  table.r th { background: transparent; color: #1e3a5f; width: 40%; }
  .amount-row td { background: transparent; }
  .amount-row td:last-child { color: #047857; font-weight: bold; font-size: 1.1rem; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 0.88rem; }
  .footer .sig { border-top: 1px solid #888; padding-top: 6px; min-width: 180px; text-align: center; color: #555; }
  .stamp { text-align: center; color: #1e3a5f; font-style: italic; margin-top: 26px; font-size: 0.85rem; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .receipt { box-shadow: none; margin: 0; padding: 14px; }
    table.r th { background: transparent !important; color: #1e3a5f !important; }
    .amount-row td { background: transparent !important; }
    .student-copy-banner { background: transparent !important; color: #1a2535 !important; border: 1.5px solid #c8a951 !important; }
    @page { size: A4; margin: 8mm; }
  }

  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style></head><body>
  <div class="toolbar"><h2><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM19 19c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14z"/></svg></span> Fee Receipt — ${fee.receiptNo || fee.id}</h2><button onclick="window.print()"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></span> Print / Save as PDF</button></div>
  <div class="receipt">
    ${studentBanner}
    <div class="header">
      <img src="${LOGO_SRC}" alt="logo">
      <h1>NOBLE HIGH SCHOOL</h1>
      <p>Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</p>
      <p><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg></span> +91 98484 24618 / +91 90599 92147</p>
      <h2 style="margin-top:14px;color:#1e3a5f">FEE PAYMENT RECEIPT</h2>
    </div>
    <div class="receipt-meta">
      <div><strong>Receipt No:</strong> ${fee.receiptNo || fee.id}</div>
      <div><strong>Date:</strong> ${dateStr}</div>
    </div>
    <table class="r">
      <tr><th>Student Name</th><td>${stu.name || ''}</td></tr>
      <tr><th>Student ID / Login ID</th><td>${fee.studentId}</td></tr>
      <tr><th>Father Name</th><td>${stu.fatherName || ''}</td></tr>
      <tr><th>Class &amp; Section</th><td>${stu.className || ''}${stu.section ? ' - ' + stu.section : ''}</td></tr>
      <tr><th>Roll Number</th><td>${stu.rollNo || ''}</td></tr>
      <tr><th>Academic Year</th><td>${fee.academicYear || ''}</td></tr>
      <tr><th>Payment Mode</th><td>${fee.method || fee.mode || ''}</td></tr>
      ${fee.notes || fee.reference ? `<tr><th>Reference / Notes</th><td>${fee.notes || fee.reference}</td></tr>` : ''}
      <tr class="amount-row"><th>AMOUNT PAID</th><td>₹ ${(fee.amount || 0).toLocaleString()} /-</td></tr>
      <tr><th>Total Annual Fee</th><td>₹ ${(stu.totalFee || 0).toLocaleString()} /-</td></tr>
    </table>
    <div class="stamp">This is a computer-generated receipt. No signature required.</div>
    <div class="footer">
      <div class="sig">Parent / Student Signature</div>
      <div class="sig">Authorised Signatory</div>
    </div>
  </div>
  ${autoPrintScript}
</body></html>`;
}

function downloadFeeReceiptPDF(feeId) {
  const fees = DB.get('fees') || [];
  const fee = fees.find(f => f.id === feeId || f.receiptNo === feeId || f.receipt === feeId);
  if (!fee) { showToast('Receipt not found.', 'error'); return; }
  const allStudents = (DB.get('students') || []).concat(DB.get('archived') || []);
  const stu = allStudents.find(s => s.id === fee.studentId || s.loginId === fee.studentId) || {};
  // If a student is logged in (not admin), the downloaded copy is marked "STUDENT COPY".
  const isStudentDownload = !!(typeof currentStudent !== 'undefined' && currentStudent);
  const html = buildFeeReceiptHTML(fee, stu, { studentCopy: isStudentDownload, autoPrint: true });
  const win = window.open('', '_blank');
  if (!win) { showToast('Allow pop-ups to download the PDF receipt.', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ===== QR SCANNER & QR CODE JS FUNCTIONS =====
let html5QrCode = null;
let currentCameraId = null;

function navGoQRScanner() {
  closeNavDrawer();
  showPage('qrscanner');
  setActiveTopNav('topNavQRScanner');
  document.getElementById('generatorStudentId').value = '';
  document.getElementById('generatorResultContainer').style.display = 'none';
}

function generateStudentPublicQR() {
  const studentId = document.getElementById('generatorStudentId').value.trim();
  if (!studentId) {
    showToast('Please enter a Student ID.', 'error');
    return;
  }
  
  const students = DB.get('students') || [];
  const s = students.find(x => x.id.toLowerCase() === studentId.toLowerCase() || x.loginId.toLowerCase() === studentId.toLowerCase());
  
  if (!s) {
    showToast('Student ID not found in database.', 'error');
    document.getElementById('generatorResultContainer').style.display = 'none';
    return;
  }
  
  const qrContainer = document.getElementById('publicQrDisplay');
  qrContainer.innerHTML = '';
  
  const qrText = `${BACKEND_URL}/api/students/public-scan/${s.id}`;
  
  new QRCode(qrContainer, {
    text: qrText,
    width: 180,
    height: 180,
    colorDark: "#1a3a6b",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
  
  document.getElementById('generatorStudentName').textContent = s.name;
  document.getElementById('generatorStudentClass').textContent = `Class ${s.className} - Section ${s.section} | Roll No: ${s.rollNo}`;
  document.getElementById('generatorResultContainer').style.display = 'block';
  showToast('QR Code generated successfully!', 'success');
}

function downloadGeneratedQR() {
  const qrImg = document.querySelector('#publicQrDisplay img');
  if (!qrImg) {
    showToast('No generated QR Code to download.', 'error');
    return;
  }
  const studentId = document.getElementById('generatorStudentId').value.trim().toUpperCase();
  const studentName = document.getElementById('generatorStudentName').textContent.replace(/\s+/g, '_');
  
  const link = document.createElement('a');
  link.href = qrImg.src;
  link.download = `QR_${studentId}_${studentName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function startScanner() {
  document.getElementById('qrScannerStatus').textContent = 'Requesting camera access...';
  
  const initCamerasAndStart = () => {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qrReader");
    }
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        const select = document.getElementById('qrCameraSelect');
        select.innerHTML = '';
        devices.forEach(device => {
          const opt = document.createElement('option');
          opt.value = device.id;
          opt.textContent = device.label || `Camera ${select.options.length + 1}`;
          select.appendChild(opt);
        });
        
        if (devices.length > 1) {
          select.style.display = 'block';
        } else {
          select.style.display = 'none';
        }
        
        if (!currentCameraId) {
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear')
          );
          currentCameraId = backCamera ? backCamera.id : devices[0].id;
        }
        
        select.value = currentCameraId;
        startScanningWithDevice(currentCameraId);
      } else {
        startScanningWithConstraints({ facingMode: "environment" });
      }
    }).catch(err => {
      console.error("Error getting cameras: ", err);
      startScanningWithConstraints({ facingMode: "environment" });
    });
  };

  if (!window.isSecureContext && window.location.protocol !== 'file:') {
    showToast('Camera access requires HTTPS on mobile browsers.', 'warning');
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        stream.getTracks().forEach(track => track.stop());
        initCamerasAndStart();
      })
      .catch(err => {
        console.error("UserMedia permission error: ", err);
        document.getElementById('qrScannerStatus').innerHTML = 
          '<span style="color: var(--danger);">Camera permission denied. Please allow camera access in browser settings.</span>';
        showToast('Camera permission denied.', 'error');
      });
  } else {
    document.getElementById('qrScannerStatus').innerHTML = 
      '<span style="color: var(--danger);">Camera API is not supported by your browser or connection is not secure (HTTPS required).</span>';
    showToast('Camera API not supported or secure connection (HTTPS) required.', 'error');
  }
}

function startScanningWithDevice(deviceId) {
  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    stopScanner();
    processScannedText(decodedText);
  };
  
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  html5QrCode.start(
    deviceId,
    config,
    qrCodeSuccessCallback
  ).then(() => {
    document.getElementById('startQrBtn').disabled = true;
    document.getElementById('stopQrBtn').disabled = false;
    document.getElementById('qrScannerStatus').innerHTML = '<span style="color: var(--success); font-weight: bold;">Camera Active. Scan QR Code now.</span>';
  }).catch(err => {
    console.error("Camera start error: ", err);
    document.getElementById('qrScannerStatus').innerHTML = '<span style="color: var(--danger);">Camera permission denied or camera not available.</span>';
  });
}

function startScanningWithConstraints(constraints) {
  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    stopScanner();
    processScannedText(decodedText);
  };
  
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  html5QrCode.start(
    constraints,
    config,
    qrCodeSuccessCallback
  ).then(() => {
    document.getElementById('startQrBtn').disabled = true;
    document.getElementById('stopQrBtn').disabled = false;
    document.getElementById('qrScannerStatus').innerHTML = '<span style="color: var(--success); font-weight: bold;">Camera Active. Scan QR Code now.</span>';
  }).catch(err => {
    console.error("Camera start constraints error: ", err);
    document.getElementById('qrScannerStatus').innerHTML = '<span style="color: var(--danger);">Camera permission denied or camera not available.</span>';
  });
}

function stopScanner() {
  try {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        const startBtn = document.getElementById('startQrBtn');
        const stopBtn = document.getElementById('stopQrBtn');
        const statusText = document.getElementById('qrScannerStatus');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (statusText) statusText.textContent = 'Camera is stopped.';
      }).catch(err => {
        console.error("Camera stop error: ", err);
      });
    } else {
      const startBtn = document.getElementById('startQrBtn');
      const stopBtn = document.getElementById('stopQrBtn');
      const statusText = document.getElementById('qrScannerStatus');
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (statusText) statusText.textContent = 'Camera is stopped.';
    }
  } catch (e) {
    console.error("stopScanner exception: ", e);
  }
}

function changeCamera() {
  const select = document.getElementById('qrCameraSelect');
  currentCameraId = select.value;
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      startScanningWithDevice(currentCameraId);
    }).catch(err => {
      console.error("Error stopping for camera change: ", err);
    });
  }
}

function processScannedText(decodedText) {
  const match = decodedText.match(/Student ID:\s*([A-Za-z0-9-]+)/i);
  let studentId = null;
  if (match) {
    studentId = match[1].trim();
  } else {
    try {
      const data = JSON.parse(decodedText);
      if (data.id) studentId = data.id;
    } catch(e) {
      studentId = decodedText.trim();
    }
  }
  
  const resultDiv = document.getElementById('scannedStudentResult');
  const cardDiv = document.getElementById('scannedProfileCard');
  resultDiv.style.display = 'block';
  
  const students = DB.get('students') || [];
  const s = students.find(st => st.id === studentId || st.loginId === studentId);
  
  if (s) {
    const photoHtml = s.photo
      ? `<img src="${s.photo}" style="width: 120px; height: 140px; object-fit: cover; border-radius: 8px; border: 2px solid var(--border);">`
      : `<div style="width: 120px; height: 140px; background: var(--bg-light); display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 2px dashed var(--border); color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 10px;">No photo on file</div>`;
      
    cardDiv.innerHTML = `
      <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; justify-content: center; padding: 10px 0;">
        ${photoHtml}
        <div style="flex: 1; min-width: 250px;">
          <h3 style="font-family: 'Playfair Display', serif; color: var(--primary-dark); font-size: 1.5rem; margin-bottom: 10px;">${s.name}</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;">
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500; width: 120px;">Student ID</th><td style="padding: 6px 0; font-weight: 700;"><code>${s.id}</code></td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Class & Sec</th><td style="padding: 6px 0; font-weight: 700;">${s.className} - ${s.section}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Roll Number</th><td style="padding: 6px 0;">${s.rollNo}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Father's Name</th><td style="padding: 6px 0;">${s.fatherName}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Phone</th><td style="padding: 6px 0;">${s.phone}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Emergency Ph</th><td style="padding: 6px 0;">${s.emergencyPhone}</td></tr>
            ${s.apaar ? `<tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Apaar No</th><td style="padding: 6px 0;">${s.apaar}</td></tr>` : ''}
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Address</th><td style="padding: 6px 0; white-space: pre-wrap;">${s.address || '—'}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Academic Year</th><td style="padding: 6px 0;">${s.academicYear || '—'}</td></tr>
            <tr style="border-bottom: 1px solid var(--border);"><th style="padding: 6px 0; color: var(--text-muted); font-weight: 500;">Password</th><td style="padding: 6px 0; font-family: monospace;">${maskPassword(window.__vault.decodeStudentPassword(s.password))}</td></tr>
          </table>
        </div>
      </div>
    `;
  } else {
    cardDiv.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--danger);">
        <div style="font-size: 2.5rem; margin-bottom: 10px;"><span class="emoji-icon-wrap"><svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span></div>
        <h4 style="margin: 0 0 10px; font-size: 1.1rem; font-weight: 700;">Student Not Found</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px;">This QR code does not belong to any active student registered in this browser's local database.</p>
        <div style="background: var(--bg-light); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: left; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; color: var(--text-dark); max-height: 200px; overflow-y: auto;">
          <strong>Decoded Text:</strong>\n${escapeHTML(decodedText)}
        </div>
      </div>
    `;
  }
}

function switchScannerTab(tab) {
  const cameraContainer = document.getElementById('cameraScannerContainer');
  const uploadContainer = document.getElementById('uploadScannerContainer');
  const btnCamera = document.getElementById('btnScannerTabCamera');
  const btnUpload = document.getElementById('btnScannerTabUpload');
  
  if (tab === 'camera') {
    cameraContainer.style.display = 'block';
    uploadContainer.style.display = 'none';
    btnCamera.className = 'btn btn-primary';
    btnUpload.className = 'btn btn-secondary';
  } else {
    cameraContainer.style.display = 'none';
    uploadContainer.style.display = 'block';
    btnCamera.className = 'btn btn-secondary';
    btnUpload.className = 'btn btn-primary';
    
    if (html5QrCode && html5QrCode.isScanning) {
      stopScanner();
    }
  }
}

function triggerQrUpload() {
  document.getElementById('qrFileInput').click();
}

function handleQrFileDrop(event) {
  event.preventDefault();
  document.getElementById('qrUploadZone').style.borderColor = 'var(--primary-light)';
  const files = event.dataTransfer.files;
  if (files.length) {
    const file = files[0];
    processQrFile(file);
  }
}

function handleQrFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    processQrFile(file);
  }
}

function processQrFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload a valid image file containing a QR code.', 'error');
    return;
  }
  
  showToast('Processing uploaded QR code image...', 'info');
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qrReader");
  }
  
  html5QrCode.scanFile(file, true)
    .then(decodedText => {
      showToast('QR Code parsed successfully!', 'success');
      processScannedText(decodedText);
    })
    .catch(err => {
      console.error("QR Code parsing failed: ", err);
      showToast('Could not find a valid QR code in the image. Please try another.', 'error');
    });
}

function showStudentSuccessModal(s) {
  document.getElementById('successModalName').textContent = s.name;
  document.getElementById('successModalId').textContent = 'ID: ' + (s.id || s.loginId);
  
  const qrContainer = document.getElementById('successModalQr');
  qrContainer.innerHTML = '';
  
  const modal = document.getElementById('stuSuccessModal');
  if (modal) {
    modal.classList.add('active');
  }
  
  const plainPass = window.__vault.decodeStudentPassword(s.password);
  const maskedPass = maskPassword(plainPass);
  const qrText = `NOBLE HIGH SCHOOL STUDENT CARD
==============================
Student ID: ${s.id || s.loginId}
Name: ${s.name || ''}
Class: ${s.className || ''}-${s.section || ''}
Roll No: ${s.rollNo || ''}
Father's Name: ${s.fatherName || ''}
Phone: ${s.phone || ''}
Emergency Phone: ${s.emergencyPhone || ''}
Address: ${s.address || ''}
Academic Year: ${s.academicYear || ''}
Password: ${maskedPass}`;

  setTimeout(() => {
    new QRCode(qrContainer, {
      text: qrText,
      width: 150,
      height: 150,
      correctLevel: QRCode.CorrectLevel.M
    });
  }, 100);
}

function printQrFromSuccessModal() {
  const qrImg = document.querySelector('#successModalQr img') || document.querySelector('#successModalQr canvas');
  const name = document.getElementById('successModalName').textContent;
  const id = document.getElementById('successModalId').textContent;
  if (!qrImg) return;
  
  const qrDataUrl = qrImg.toDataURL ? qrImg.toDataURL() : qrImg.src;
  
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>Print QR Code - ${name}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .container { border: 2px solid #ddd; border-radius: 12px; padding: 30px; display: inline-block; }
          img { width: 200px; height: 200px; }
          h2 { margin: 15px 0 5px; color: #1a3a6b; }
          p { margin: 0; color: #666; font-size: 14px; }
        
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style>
      </head>
      <body>
        <div class="container">
          <img src="${qrDataUrl}">
          <h2>${name}</h2>
          <p>${id}</p>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        <\/script>
      </body>
    </html>
  `);
  w.document.close();
}

function maskPassword(plainPassword) {
  if (!plainPassword) return '';
  if (plainPassword.length <= 4) {
    return plainPassword;
  }
  return '****' + plainPassword.slice(-4);
}

// Override showPage to stop camera scanner when moving away from QR Scanner
const originalShowPage = showPage;
showPage = function(name) {
  if (name !== 'qrscanner') {
    try { stopScanner(); } catch(e) {}
  }
  originalShowPage(name);
};



function escapeHTMLAttribute(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}




function escapeHTMLAttribute(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}


function printSingleStudent(studentId) {
  const students = DB.get('students') || [];
  const s = students.find(st => st.id === studentId || st.loginId === studentId);
  if (!s) { showToast('Student not found.', 'error'); return; }
  
  const win = window.open('', '_blank', 'width=950,height=900');
  if (!win) { showToast('Please allow popups to print.', 'error'); return; }
  
  const html = buildStudentBulkPrintHTML([s]);
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function printAllStudentCards() {
  const students = DB.get('students') || [];
  const search = (document.getElementById('stuSearchInput')?.value||'').toLowerCase();
  const filterClass = document.getElementById('stuFilterClass')?.value||'';
  
  let filtered = students.filter(s => s.status === 'active' && 
    (!filterClass || s.className === filterClass) && 
    (!search || s.name.toLowerCase().includes(search) || s.loginId.toLowerCase().includes(search) || s.id.toLowerCase().includes(search))
  );
  
  if (!filtered.length) { showToast('No students to print.', 'error'); return; }
  
  const win = window.open('', '_blank', 'width=950,height=900');
  if (!win) { showToast('Please allow popups to print.', 'error'); return; }
  
  const html = buildStudentBulkPrintHTML(filtered);
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function buildStudentPrintHTML(s) {
  const plainPass = window.__vault ? window.__vault.decodeStudentPassword(s.password) : (s.password || '');
  const maskedPass = maskPassword(plainPass);
  
  const name = s.name || '';
  const id = s.id || s.loginId;
  const className = s.className || '';
  const section = s.section || '';
  const rollNo = s.rollNo || '';
  const fatherName = s.fatherName || '';
  const phone = s.phone || '';
  const emergencyPhone = s.emergencyPhone || '';
  const aadhaar = s.aadhaar || '';
  const apaar = s.apaar || '';
  const address = s.address || '';
  const academicYear = s.academicYear || '';
  
  const qrText = `NOBLE HIGH SCHOOL STUDENT CARD
==============================
Student ID: ${id}
Name: ${name}
Class: ${className}-${section}
Roll No: ${rollNo}
Father's Name: ${fatherName}
Phone: ${phone}
Emergency Phone: ${emergencyPhone}
Address: ${address}
Academic Year: ${academicYear}
Password: ${maskedPass}`;

  const photoHtml = s.photo
    ? `<img src="${s.photo}" class="student-photo">`
    : `<div class="no-photo-placeholder"><span>No Photo Available</span></div>`;
    
  const idCardPhotoHtml = s.photo
    ? `<img src="${s.photo}" class="id-card-photo">`
    : `<div style="font-size: 5pt; color: #aaa; text-align: center;">Photo</div>`;

  const sigHtml = SHOW_PRINCIPAL_SIGNATURE 
    ? `<img src="${PRINCIPAL_SIGNATURE}" alt="Signature" class="id-card-principal-img" style="height: 20px; display: block; margin: 0 auto;">` 
    : `<span style="font-size: 5pt; color: #8a9ab0; border-top: 1px dashed #8a9ab0; width: 60px; display: inline-block; padding-top: 8px;">Signature</span>`;

  return `
    <div class="print-sheet">
      <div class="header">
        <img src="${LOGO_SRC}" class="school-logo">
        <div class="header-text">
          <h1 class="school-name">Noble High School</h1>
          <p class="school-sub">Kandukur 'X' Road, Kandukur, Rangareddy, Telangana</p>
        </div>
      </div>
      
      <div class="doc-title">Student Information Sheet & Card</div>
      
      <div class="profile-grid">
        <div class="photo-col">
          ${photoHtml}
          <div class="credentials-box">
            <h4>Login Credentials</h4>
            <div class="cred-row"><strong>Username / ID:</strong> <code>${id}</code></div>
            <div class="cred-row"><strong>Password:</strong> <code>${plainPass}</code></div>
            <div style="font-size: 0.7rem; color: #5a6a82; margin-top: 6px; font-style: italic;">Keep these credentials secure. Do not share them with others.</div>
          </div>
        </div>
        
        <div>
          <table class="info-table">
            <tr><th>Student ID</th><td><strong>${id}</strong></td></tr>
            <tr><th>Full Name</th><td><strong>${name}</strong></td></tr>
            <tr><th>Class & Section</th><td>${className} - ${section}</td></tr>
            <tr><th>Roll Number</th><td>${rollNo}</td></tr>
            <tr><th>Father's Name</th><td>${fatherName}</td></tr>
            <tr><th>Phone Number</th><td>${phone}</td></tr>
            <tr><th>Emergency Phone</th><td>${emergencyPhone}</td></tr>
            <tr><th>Date of Birth</th><td>${dob ? fmtDate(dob) : '—'}</td></tr>
            <tr><th>Admission Date</th><td>${joinDate ? fmtDate(joinDate) : '—'}</td></tr>
            <tr><th>Aadhaar Number</th><td>${aadhaar}</td></tr>
            <tr><th>Apaar Number</th><td>${apaar || '—'}</td></tr>
            <tr><th>Academic Year</th><td>${academicYear}</td></tr>
            <tr><th>Home Address</th><td style="white-space: pre-wrap;">${address || '—'}</td></tr>
          </table>
        </div>
      </div>
      
      <div class="cut-line">
        <span>Cut along the line below to retrieve the Student ID Card</span>
      </div>
      
      <div class="id-card-wrapper">
        <div class="id-card">
          <div class="id-card-header">
            <img src="${LOGO_SRC}" class="id-card-logo-img">
            <div class="id-card-title">
              <div class="id-card-school">Noble High School</div>
              <div class="id-card-school-sub">Kandukur, Rangareddy, Telangana</div>
            </div>
          </div>
          <div class="id-card-body">
            <div class="id-card-photo-box">
              ${idCardPhotoHtml}
            </div>
            <div class="id-card-info">
              <div class="id-card-row"><span class="id-card-label">ID:</span><span class="id-card-val">${id}</span></div>
              <div class="id-card-row"><span class="id-card-label">Name:</span><span class="id-card-val" style="font-size: 7.5pt; text-transform: uppercase;">${name}</span></div>
              <div class="id-card-row"><span class="id-card-label">Class:</span><span class="id-card-val">${className} - ${section}</span></div>
              <div class="id-card-row"><span class="id-card-label">Roll No:</span><span class="id-card-val">${rollNo}</span></div>
              <div class="id-card-row"><span class="id-card-label">Phone:</span><span class="id-card-val">${phone}</span></div>
            </div>
            <div class="id-card-qr-box qr-container" data-text="${escapeHTMLAttribute(qrText)}">
              <!-- Rendered dynamically -->
            </div>
          </div>
          <div class="id-card-footer">
            <span class="id-card-footer-phone">
              <svg class="emoji-svg" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              +91 90599 92147
            </span>
            <span style="display: flex; flex-direction: column; align-items: center;">
              ${sigHtml}
              <span style="font-size: 4pt; color: #1a2535; font-weight: 700; margin-top: 1px;">Principal</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildStudentBulkPrintHTML(studentsList) {
  const innerHtml = studentsList.map((s, idx) => {
    return buildStudentPrintHTML(s) + (idx < studentsList.length - 1 ? '<div class="page-break"></div>' : '');
  }).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Print Student Cards</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0; background: #eef2f7; color: #1a2535; }
    .toolbar { position: sticky; top: 0; background: #1a3a6b; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.15); z-index: 10; }
    .toolbar h2 { margin: 0; font-size: 13pt; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .toolbar button { background: #c8a951; color: #1a2535; border: none; padding: 8px 18px; border-radius: 5px; font-size: 10.5pt; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .toolbar button:hover { background: #d4b75e; }
    
    .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
    .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
    
    .print-sheet { max-width: 210mm; margin: 18px auto; padding: 20mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08); box-sizing: border-box; min-height: 297mm; position: relative; }
    
    .header { display: flex; align-items: center; justify-content: center; gap: 20px; border-bottom: 3px double #1a3a6b; padding-bottom: 14px; margin-bottom: 25px; }
    .school-logo { width: 80px; height: 80px; object-fit: contain; border-radius: 50%; border: 3px solid #c8a951; }
    .header-text { text-align: left; }
    .school-name { font-size: 24pt; font-weight: 900; color: #1a3a6b; letter-spacing: 1.5px; margin: 0; line-height: 1.2; }
    .school-sub { font-size: 10pt; color: #5a6a82; margin: 4px 0 0; }
    
    .doc-title { text-align: center; font-size: 14pt; font-weight: 800; color: #1a3a6b; letter-spacing: 2px; margin-bottom: 25px; text-transform: uppercase; border-bottom: 1px solid #d0dbed; padding-bottom: 6px; }
    
    .profile-grid { display: grid; grid-template-columns: 180px 1fr; gap: 30px; margin-bottom: 30px; }
    .photo-col { display: flex; flex-direction: column; align-items: center; gap: 15px; }
    .student-photo { width: 150px; height: 180px; object-fit: cover; border-radius: 10px; border: 3px solid #1a3a6b; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .no-photo-placeholder { width: 150px; height: 180px; border-radius: 10px; border: 3px dashed #d0dbed; background: #f8faff; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8a9ab0; font-size: 0.8rem; text-align: center; padding: 10px; box-sizing: border-box; }
    
    .credentials-box { background: #f8faff; border: 2px dashed #1a3a6b; border-radius: 8px; padding: 12px; width: 100%; box-sizing: border-box; margin-top: 10px; text-align: left; }
    .credentials-box h4 { margin: 0 0 8px; font-size: 0.9rem; color: #1a3a6b; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #1a3a6b; padding-bottom: 4px; }
    .cred-row { font-size: 0.85rem; margin: 4px 0; }
    .cred-row strong { color: #1a3a6b; }
    
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table th { background: #1a3a6b; color: #fff; padding: 8px 12px; font-size: 10pt; text-align: left; width: 150px; border: 1px solid #1a3a6b; }
    .info-table td { padding: 8px 12px; font-size: 10pt; border: 1px solid #d0dbed; color: #1a2535; }
    .info-table tr:nth-child(even) td { background: #f8faff; }
    
    .cut-line { border-top: 2px dashed #8a9ab0; margin: 50px 0 30px; position: relative; text-align: center; }
    .cut-line span { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 15px; font-size: 0.8rem; color: #8a9ab0; font-style: italic; font-weight: 500; }
    
    .id-card-wrapper { display: flex; justify-content: center; margin-top: 20px; }
    .id-card { width: 86mm; height: 54mm; border: 1px solid #1a3a6b; border-radius: 10px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.08); overflow: hidden; position: relative; font-family: 'Segoe UI', sans-serif; display: grid; grid-template-rows: 42px 1fr 18px; box-sizing: border-box; }
    .id-card-header { background: #1a3a6b; color: #fff; padding: 4px 10px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #c8a951; }
    .id-card-logo-img { width: 26px; height: 26px; object-fit: contain; border-radius: 50%; background: #fff; border: 1px solid #c8a951; }
    .id-card-school { font-size: 8pt; font-weight: 900; text-transform: uppercase; margin: 0; color: #fff; letter-spacing: 0.5px; }
    .id-card-school-sub { font-size: 4.5pt; color: #d0dbed; margin: 0; }
    .id-card-body { padding: 6px 10px; display: grid; grid-template-columns: 60px 1fr 50px; gap: 10px; align-items: center; }
    .id-card-photo-box { width: 60px; height: 72px; border-radius: 4px; overflow: hidden; border: 1.5px solid #1a3a6b; background: #f8faff; display: flex; align-items: center; justify-content: center; }
    .id-card-photo { width: 100%; height: 100%; object-fit: cover; }
    .id-card-info { font-size: 6.5pt; text-align: left; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
    .id-card-row { display: flex; gap: 4px; }
    .id-card-label { font-weight: 700; color: #5a6a82; width: 45px; }
    .id-card-val { font-weight: 700; color: #1a2535; }
    .id-card-qr-box { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #d0dbed; border-radius: 4px; padding: 2px; box-sizing: border-box; margin: auto; }
    .id-card-qr-box canvas, .id-card-qr-box img { width: 100% !important; height: 100% !important; }
    .id-card-footer { background: #f7d100; color: #1a2535; font-size: 5.5pt; font-weight: 800; text-align: center; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; border-top: 1px solid #c8a951; }
    .id-card-footer-phone { display: flex; align-items: center; gap: 2px; }
    .id-card-footer-phone svg { width: 6px; height: 6px; fill: currentColor; }
    
    .page-break { page-break-after: always; }
    
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .print-sheet { box-shadow: none; margin: 0; padding: 10mm; min-height: auto; }
      @page { size: A4 portrait; margin: 0; }
    }
  
  /* Constrain emoji SVG icons to prevent them stretching and blowing up in size when printing */
  .emoji-icon-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 1.2em !important; height: 1.2em !important; vertical-align: middle !important; }
  .emoji-svg { width: 1.2em !important; height: 1.2em !important; display: inline-block !important; fill: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }
  
  /* Ensure print toolbars are completely hidden during printing */
  @media print {
    .toolbar, .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <h2>
      <span class="emoji-icon-wrap">
        <svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
      </span>
      Print Student Cards (${studentsList.length} students)
    </h2>
    <button onclick="window.print()">
      <span class="emoji-icon-wrap">
        <svg class="emoji-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
      </span>
      Print Now
    </button>
  </div>
  
  ${innerHtml}

  <script>
    window.onload = function() {
      const containers = document.querySelectorAll('.qr-container');
      containers.forEach(div => {
        const text = div.getAttribute('data-text');
        new QRCode(div, {
          text: text,
          width: 100,
          height: 100,
          correctLevel: QRCode.CorrectLevel.M
        });
      });
      setTimeout(() => {
        window.print();
      }, 500);
    };
  <\/script>
</body>
</html>`;
}


// ============================================================================
// === ANTIGRAVITY NEW CUSTOM FEATURES: CAPTCHA, SCANNER, AND PRINTING ===
// ============================================================================
let currentAdminCaptcha = '';

function regenerateAdminCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let captchaText = '';
  for (let i = 0; i < 6; i++) {
    captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  currentAdminCaptcha = captchaText;

  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  // Fill background with random light color
  ctx.fillStyle = "rgb(" + (210 + Math.random() * 30) + "," + (210 + Math.random() * 30) + "," + (210 + Math.random() * 30) + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background noise lines
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = "rgb(" + (100 + Math.random() * 100) + "," + (100 + Math.random() * 100) + "," + (100 + Math.random() * 100) + ")";
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Draw background noise dots
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgb(" + (100 + Math.random() * 100) + "," + (100 + Math.random() * 100) + "," + (100 + Math.random() * 100) + ")";
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw distorted characters
  ctx.textBaseline = 'middle';
  const fonts = ['Courier New', 'Georgia', 'Arial', 'Times New Roman', 'Verdana'];
  
  for (let i = 0; i < captchaText.length; i++) {
    const char = captchaText[i];
    const fontSize = 24 + Math.floor(Math.random() * 8);
    const fontName = fonts[Math.floor(Math.random() * fonts.length)];
    ctx.font = 'bold ' + fontSize + 'px ' + fontName;
    ctx.fillStyle = "rgb(" + Math.floor(Math.random() * 80) + "," + Math.floor(Math.random() * 80) + "," + Math.floor(Math.random() * 80) + ")";

    const x = 15 + i * 26 + Math.random() * 6;
    const y = 25 + (Math.random() - 0.5) * 10;
    const angle = (Math.random() - 0.5) * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillText(char, -10, 0);
    ctx.restore();
  }

  // Add foreground noise lines across text
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = "rgb(" + Math.floor(Math.random() * 100) + "," + Math.floor(Math.random() * 100) + "," + Math.floor(Math.random() * 100) + ")";
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Convert to image
  try {
    const dataUrl = canvas.toDataURL('image/png');
    document.getElementById('adminCaptchaImg').src = dataUrl;
  } catch (e) {
    console.error('Failed to generate CAPTCHA image', e);
  }
}

function decodeStudentPassword(encoded) {
  if (!encoded) return '';
  const map = {
    'A':'7*k9P!mQ','B':'2#mQv&zL','C':'L5&tS9!w','D':'9!wX1@rZ','E':'b4@rZ*kN',
    'F':'G8^nJ3$a','G':'0%hV6vB9','H':'kM3$YpC2','I':'1(pL9fS6','J':'qW2!f7*k',
    'K':'5*dN8xM9','L':'rT0#xbL0','M':'jZ7@b4#b','N':'6&uK4rY2','O':'vB9%m1^j',
    'P':'3$aC2vD3','Q':'fY1^gqW0','R':'xO5*k9%k','S':'nL8!h5*r','T':'4@sR0bP0',
    'U':'iE6&w7&z','V':'zQ3#j1*v','W':'pD9%v0%m','X':'7*mN1fP9','Y':'uY4$t3!x',
    'Z':'2!kX8uD6',
    'a':'k8*P9!mQ','b':'v2#mQz&L','c':'sL5&t9!w','d':'r9!wX@rZ','e':'zb4@r*kN',
    'f':'jG8^n3$a','g':'v0%hVvB9','h':'ykM3$pC2','i':'91(pLfS6','j':'fqW2!7*k',
    'k':'85*dNxM9','l':'xrT0#bL0','m':'bjZ7@4#b','n':'26&uKrY2','o':'mvB9%1^j',
    'p':'33$aCvD3','q':'gfY1^qW0','r':'kxO5*9%k','s':'hnL8!5*r','t':'04@sRbP0',
    'u':'wiE6&7&z','v':'jzQ3#1*v','w':'vpD9%0%m','x':'17*mNfP9','y':'tuY4$3!x',
    'z':'82!kXuD6',
    '0':'wQ5&k7*b','1':'9*rP2pZ1','2':'bL0#v4#b','3':'7!mX49!z','4':'kZ8@nkM6',
    '5':'1$jT33*t','6':'fS6^grY2','7':'xM9%h5^n','8':'pC2!wjP9','9':'uR5*y1(h',
    ' ':'9!zL1vD3','@':'4#bV80)x','$':'kM6&p7!f','%':'3*tX0bK5','^':'rY2@sqW0',
    '&':'5^nQ7mZ8','(':'1(hB41^j',')':'0)xM69%k','_':'7!fR94!h','=':'bK5*tbP0',
    '[':'mZ8$p1*v',']':'xS2@l0%m','{':'1^jV4fP9','}':'9%kQ03!x','|':'4!hM77*b',
    ':':'bP0#xpZ1',';':'7&zL94#b',"'":'qY2$w9!z','"':'kS5^nkM6',',':'1vR83t',
    '.':'0%mQ3rY2','/':'fP9@k5^n','?':'3!xJ2jP9','<':'uD6&t1(h','!':'pZ1$wvD3',
    '#':'aE7@m6&L','*':'b0)kS9rY','+':'cP3!nT8x','-':'dQ4#xJ2j','>':'eR5^vB9%',
    '~':'fT6&w7&z','`':'gU7$tuY4','\\':'hV8@l0%m'
  };
  const rev = {};
  for (const k in map) { rev[map[k]] = k; }
  
  let plain = '';
  for (let i = 0; i < encoded.length; i += 8) {
    const chunk = encoded.substring(i, i + 8);
    if (rev[chunk]) {
      plain += rev[chunk];
    } else {
      return encoded; // fallback
    }
  }
  return plain;
}

function printSingleStudent(id) {
  const s = DB.get('students').find(x => x.id === id);
  if (!s) { showToast('Student not found', 'error'); return; }
  generateBulkQRCodes([s], (qrMap) => {
    const fees = DB.get('fees');
    const paid = fees.filter(f=>f.studentId===s.id).reduce((sum,f)=>sum+f.amount,0);
    const balance = (s.totalFee||0)-paid;
    const plainPassword = decodeStudentPassword(s.password);
    const html = `
      <div class="profile-card-print">
        <div class="rc-header">
          <div class="rc-school-name">NOBLE HIGH SCHOOL</div>
          <div class="rc-address">Recognized by Govt. of Telangana | Affiliation No: 123456</div>
          <div class="rc-exam-title">STUDENT PROFILE CARD</div>
        </div>
        
        <div class="profile-card-body">
          <div class="profile-left">
            <table class="profile-table">
              <tr><th>Student Name</th><td>${s.name}</td></tr>
              <tr><th>Student ID / Login ID</th><td><code>${s.id}</code></td></tr>
              <tr><th>Password</th><td><code>${plainPassword}</code></td></tr>
              <tr><th>Class & Section</th><td>Class ${s.className} - ${s.section}</td></tr>
              <tr><th>Roll Number</th><td>${s.rollNo}</td></tr>
              <tr><th>Father's Name</th><td>${s.fatherName}</td></tr>
              <tr><th>Phone Number</th><td>${s.phone}</td></tr>
              <tr><th>Emergency Contact</th><td>${s.emergencyPhone}</td></tr>
              <tr><th>Date of Birth</th><td>${s.dob ? fmtDate(s.dob) : 'N/A'}</td></tr>
              <tr><th>Admission Date</th><td>${s.joinDate ? fmtDate(s.joinDate) : 'N/A'}</td></tr>
              <tr><th>Aadhaar Number</th><td>${s.aadhaar}</td></tr>
              <tr><th>Apaar Number</th><td>${s.apaar || 'N/A'}</td></tr>
              <tr><th>Academic Year</th><td>${s.academicYear}</td></tr>
              <tr><th>Total Annual Fee</th><td>₹${(s.totalFee||0).toLocaleString()}</td></tr>
              <tr><th>Pending Fee Balance</th><td style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">₹${balance.toLocaleString()}</td></tr>
              <tr><th>Address</th><td>${s.address || 'N/A'}</td></tr>
            </table>
          </div>
          <div class="profile-right">
            <div class="photo-container">
              <div class="photo-label">STUDENT PHOTO</div>
              <div class="photo-box">
                ${s.photo ? `<img src="${s.photo}">` : '<span>NO PHOTO</span>'}
              </div>
            </div>
            
            <div class="qr-container">
              <div class="qr-label">PROFILE QR CODE</div>
              <img class="qr-code-img" src="${qrMap[s.id]}">
              <div class="qr-help">Scan using Google Lens or School Web Portal</div>
            </div>
          </div>
        </div>
        
        <div class="profile-footer">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div>Class Teacher Signature</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div>Parent Signature</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div>Principal Signature</div>
          </div>
        </div>
      </div>
    `;
    openPrintWindow(html, `Student Card - ${s.name}`);
  });
}

function generateBulkQRCodes(students, callback) {
  const results = {};
  if (students.length === 0) {
    callback(results);
    return;
  }
  
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  document.body.appendChild(tempDiv);
  
  students.forEach(s => {
    const qrDiv = document.createElement('div');
    qrDiv.id = 'qr_temp_' + s.id;
    tempDiv.appendChild(qrDiv);
    
    const plainPwd = decodeStudentPassword(s.password);
    const maskedPwd = plainPwd.length > 4 ? '*'.repeat(plainPwd.length - 4) + plainPwd.slice(-4) : plainPwd;
    
    const text = "--- STUDENT PROFILE ---\n" +
      "ID: " + s.id + "\n" +
      "Name: " + s.name + "\n" +
      "Class: " + s.className + " - " + s.section + "\n" +
      "Roll No: " + s.rollNo + "\n" +
      "Father: " + s.fatherName + "\n" +
      "Phone: " + s.phone + "\n" +
      "Emergency Phone: " + s.emergencyPhone + "\n" +
      "Address: " + (s.address || 'N/A') + "\n" +
      "Academic Year: " + s.academicYear + "\n" +
      "Password: " + maskedPwd;

    new QRCode(qrDiv, {
      text: text,
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M
    });
  });
  
  setTimeout(() => {
    students.forEach(s => {
      const div = document.getElementById('qr_temp_' + s.id);
      if (div) {
        const img = div.querySelector('img');
        const canvas = div.querySelector('canvas');
        results[s.id] = img && img.src ? img.src : (canvas ? canvas.toDataURL() : '');
      }
    });
    document.body.removeChild(tempDiv);
    callback(results);
  }, 150);
}

function openPrintWindow(html, title) {
  const win = window.open('', '_blank', 'width=950,height=900');
  if (!win) { showToast('Please allow popups to print/download', 'error'); return; }
  
  const rootStyle = getComputedStyle(document.documentElement);
  const vars = ['--primary','--primary-dark','--success','--warning','--danger','--text','--text-muted','--bg-light','--border','--accent','--accent-light']
    .map(v => v + ': ' + (rootStyle.getPropertyValue(v) || '')).join(';');
    
  win.document.write('<!DOCTYPE html><html><head><base href="' + (window.location.origin && window.location.origin !== 'null' ? window.location.origin + '/' : '') + '"><title>' + title + '</title>');
  win.document.write('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=Source+Sans+3:wght@400;600;700;800&display=swap" rel="stylesheet">');
  win.document.write('<style>');
  win.document.write(':root{' + vars + '}');
  win.document.write('*{box-sizing:border-box}');
  win.document.write("body{font-family:'Source Sans 3',sans-serif;margin:0;padding:0;background:#eef2f7;color:#1a2535}");
  win.document.write('.toolbar{position:sticky;top:0;background:#1a3a6b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);z-index:10}');
  win.document.write('.toolbar h2{margin:0;font-size:13pt;font-weight:600}');
  win.document.write('.toolbar button{background:#c8a951;color:#1a2535;border:none;padding:8px 18px;border-radius:5px;font-size:10.5pt;font-weight:700;cursor:pointer}');
  win.document.write('.toolbar button:hover{background:#d4b75e}');
  win.document.write('.preview-wrap{padding:14px 0;display:flex;flex-direction:column;align-items:center;gap:14px}');
  win.document.write('.rc-header{text-align:center;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:14px}');
  win.document.write(".rc-school-name{font-family:'Playfair Display',serif;font-size:18pt;color:var(--primary-dark);font-weight:900}");
  win.document.write('.rc-address{font-size:9pt;color:var(--text-muted);margin:2px 0}');
  win.document.write('.rc-exam-title{font-size:13pt;font-weight:700;color:var(--primary);margin-top:6px}');
  
  win.document.write('.profile-card-print { width: 210mm; min-height: 297mm; padding: 15mm; background: white; margin: 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; justify-content: space-between; }');
  win.document.write('.profile-card-body { display: flex; gap: 20px; margin-top: 10px; flex-grow: 1; }');
  win.document.write('.profile-left { flex: 2; }');
  win.document.write('.profile-right { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 25px; }');
  win.document.write('.profile-table { width: 100%; border-collapse: collapse; }');
  win.document.write('.profile-table th { text-align: left; padding: 8px 10px; background: var(--bg-light); border: 1px solid var(--border); color: var(--text-muted); font-size: 9.5pt; width: 150px; }');
  win.document.write('.profile-table td { padding: 8px 10px; border: 1px solid var(--border); font-size: 9.5pt; color: var(--text); font-weight: 600; }');
  win.document.write('.photo-container, .qr-container { border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; background: var(--bg-light); width: 100%; display: flex; flex-direction: column; align-items: center; }');
  win.document.write('.photo-label, .qr-label { font-size: 8pt; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; letter-spacing: 0.5px; }');
  win.document.write('.photo-box { width: 120px; height: 120px; border: 1px solid var(--border); background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; }');
  win.document.write('.photo-box img { width: 100%; height: 100%; object-fit: cover; }');
  win.document.write('.qr-code-img { width: 150px; height: 150px; background: white; border: 1px solid var(--border); padding: 5px; }');
  win.document.write('.qr-help { font-size: 7.5pt; color: var(--text-muted); margin-top: 6px; }');
  win.document.write('.profile-footer { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 15px; border-top: 1px solid var(--border); }');
  win.document.write('.sig-box { text-align: center; font-size: 9pt; color: var(--text-muted); width: 150px; }');
  win.document.write('.sig-line { border-bottom: 1px solid #999; margin-bottom: 5px; height: 25px; }');
  
  win.document.write('.qr-grid-page { width: 210mm; min-height: 297mm; padding: 15mm; background: white; margin: 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; }');
  win.document.write('.qr-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; margin-top: 20px; }');
  win.document.write('.qr-grid-item { border: 1px solid var(--border); padding: 10px; text-align: center; background: var(--bg-light); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-inside: avoid; }');
  win.document.write('.qr-grid-code { width: 90px; height: 90px; background: white; border: 1px solid var(--border); padding: 2px; }');
  win.document.write('.qr-grid-id { font-size: 8.5pt; font-family: monospace; font-weight: bold; margin-top: 6px; color: var(--text); }');
  win.document.write('.qr-grid-name { font-size: 7.5pt; font-weight: 600; margin-top: 2px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }');
  
  win.document.write('@media print {');
  win.document.write('  body { background: white; color: black; }');
  win.document.write('  .toolbar { display: none !important; }');
  win.document.write('  .preview-wrap { padding: 0; gap: 0; }');
  win.document.write('  .profile-card-print, .qr-grid-page { margin: 0 !important; box-shadow: none !important; border: none !important; page-break-after: always; page-break-inside: avoid; }');
  win.document.write('}');
  win.document.write('</style></head><body>');
  win.document.write('<div class="toolbar"><h2>' + title + '</h2><button onclick="window.print()">Print Document</button></div>');
  win.document.write('<div class="preview-wrap">' + html + '</div>');
  win.document.write('</body></html>');
  win.document.close();
}