/**
 * Renders a public, no-login-required HTML page that lets anyone confirm a
 * Veritas report genuinely exists and check its hash — WITHOUT exposing any
 * private evidence. This is what the QR code embedded in generated PDF
 * reports links to. Returned as a plain string (no disk read) since
 * Vercel's filesystem is read-only in production.
 */
function renderVerifyPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Veritas — Report Verification</title>
<style>
  :root{
    --bg-deep:#211320; --glow-violet:#9b5fc0; --glow-magenta:#c4568e; --glow-amber:#e0975f;
    --glass:rgba(255,255,255,0.06); --glass-border:rgba(255,255,255,0.14);
    --text-hi:#f6eef4; --text-mid:#c9b8c6; --text-low:#8d7a8b;
    --verified:#6fd9ab; --risk-high:#ff7a7a;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
    background:
      radial-gradient(ellipse 900px 600px at 15% -5%, rgba(196,86,142,0.35), transparent 60%),
      radial-gradient(ellipse 800px 700px at 105% 20%, rgba(155,95,192,0.30), transparent 55%),
      var(--bg-deep);
    min-height:100vh; color:var(--text-hi); display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .card{
    max-width:440px; width:100%; background:var(--glass); border:1px solid var(--glass-border);
    border-radius:20px; padding:28px; backdrop-filter:blur(18px);
  }
  .brand{display:flex; align-items:center; gap:10px; margin-bottom:20px;}
  .brand-mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--glow-violet),var(--glow-magenta));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;}
  h1{font-size:19px; font-weight:600;}
  p.sub{color:var(--text-mid); font-size:13px; margin-top:4px; margin-bottom:22px; line-height:1.5;}
  label{font-size:11.5px; color:var(--text-low); text-transform:uppercase; letter-spacing:0.05em;}
  input{
    width:100%; margin-top:6px; margin-bottom:14px; padding:12px 14px; border-radius:12px;
    background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:var(--text-hi); font-size:14px;
  }
  button{
    width:100%; padding:13px; border:none; border-radius:12px; font-weight:600; font-size:14px; color:#fff;
    background:linear-gradient(135deg,var(--glow-violet),var(--glow-magenta)); cursor:pointer;
  }
  #result{margin-top:20px;}
  .pill{display:inline-block; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; margin-bottom:12px;}
  .ok{background:rgba(111,217,171,0.15); color:var(--verified);}
  .bad{background:rgba(255,122,122,0.15); color:var(--risk-high);}
  .row{display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.07); font-size:12.5px;}
  .row:last-child{border-bottom:none;}
  .row span:first-child{color:var(--text-low);}
  .row span:last-child{color:var(--text-hi); font-family:monospace; font-size:11.5px;}
  .note{font-size:11px; color:var(--text-low); margin-top:14px; line-height:1.5;}
  .hidden{display:none;}
</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-mark">V</div>
      <div><strong>Veritas</strong> Report Verification</div>
    </div>
    <p class="sub">Confirm a Veritas evidence report genuinely exists and hasn't been altered. This never exposes the private evidence itself.</p>

    <label for="reportId">Report ID</label>
    <input id="reportId" placeholder="RPT-8841" />
    <label for="hash">PDF hash (optional, to confirm integrity)</label>
    <input id="hash" placeholder="Paste the report's SHA-256 hash if you have it" />
    <button onclick="verify()">Verify Report</button>

    <div id="result"></div>
  </div>

<script>
  const params = new URLSearchParams(window.location.search);
  if (params.get('reportId')) document.getElementById('reportId').value = params.get('reportId');

  async function verify() {
    const reportId = document.getElementById('reportId').value.trim();
    const hash = document.getElementById('hash').value.trim();
    const resultEl = document.getElementById('result');
    if (!reportId) { resultEl.innerHTML = '<p class="note">Enter a Report ID first.</p>'; return; }

    resultEl.innerHTML = '<p class="note">Checking…</p>';
    try {
      const url = '/api/reports/' + encodeURIComponent(reportId) + '/verify' + (hash ? ('?hash=' + encodeURIComponent(hash)) : '');
      const res = await fetch(url);
      const data = await res.json();

      if (!data.verified) {
        resultEl.innerHTML = '<span class="pill bad">NOT FOUND</span><p class="note">' + (data.error || 'No report found with this ID.') + '</p>';
        return;
      }

      let hashRow = '';
      if (data.hashMatches !== null) {
        hashRow = '<div class="row"><span>Hash match</span><span>' + (data.hashMatches ? 'YES — unmodified' : 'NO — does not match') + '</span></div>';
      }

      resultEl.innerHTML =
        '<span class="pill ok">VERIFIED — REPORT EXISTS</span>' +
        '<div class="row"><span>Report ID</span><span>' + data.reportId + '</span></div>' +
        '<div class="row"><span>Type</span><span>' + data.type + '</span></div>' +
        '<div class="row"><span>Generated at</span><span>' + new Date(data.generatedAt).toLocaleString() + '</span></div>' +
        '<div class="row"><span>Version</span><span>v' + data.version + '</span></div>' +
        hashRow +
        '<p class="note">' + data.note + '</p>';
    } catch (e) {
      resultEl.innerHTML = '<p class="note" style="color:var(--risk-high)">Verification failed: ' + e.message + '</p>';
    }
  }

  if (params.get('reportId')) verify();
</script>
</body>
</html>`;
}

module.exports = { renderVerifyPage };
