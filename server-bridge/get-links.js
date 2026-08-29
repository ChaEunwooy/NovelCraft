const { chromium } = require('playwright');

const cookieStr = `x-web-secsdk-uid=6a4213c5-275c-4813-8277-88817a403242; Hm_lvt_2667d29c8e792e6fa9182c20a3013175=1786960626; Hm_lpvt_2667d29c8e792e6fa9182c20a3013175=1786960626; HMACCOUNT=3180C84A7AAA95BB; s_v_web_id=verify_msx285qk_fU3q9Srz_tIkZ_4N37_AKfM_T5jM7HKnuzVa; gfkadpd=2503,36144; csrf_session_id=0acdfc90ab882b87f35822f24a2f5cdf; serial_uuid=7674938145485948456; serial_webid=7674938145485948456; passport_csrf_token=9723b7ade3ae7b6e281bde70bc37befe; passport_csrf_token_default=9723b7ade3ae7b6e281bde70bc37befe; passport_mfa_token=Cjf4uephkOB%2BOLSQIVFMDMkc8mEhD4WT6B7tYZ8VKEbEDWwbki1z0U6A8oQYBDtC8BSbb%2BfzNuEVGkoKPAAAAAAAAAAAAABQyoCoWiPgaSiJC7Z2PgV0aXTU%2BMSn7EtD0bNr7bYXpcnrVRGuYJa78mqw16E3pI19tBCB5ZkOGPax0WwgAiIBA2NXTEw%3D; d_ticket=84f8629e6fb5a75d950f5cb986a8e0687fa00; odin_tt=06e9e53d8c59d8b885494fe535df7690ff002b87b3f1ebc52cdd10c830db4353d4bb55245726cea6eeff8de28b5271b9faa5704edd333cca712d1259d8341660; n_mh=XsqhirTJi-lPpkBRjec_WuRXFV8_HJvODi466WfUqGg; passport_auth_status=6a2839d01d17fb0638495342660c35a5%2C; passport_auth_status_ss=6a2839d01d17fb0638495342660c35a5%2C; sid_guard=96b1ea27837fbfea506db1069caf3409%7C1786960819%7C5184000%7CFri%2C+16-Oct-2026+10%3A00%3A19+GMT; uid_tt=e36e0b84cac2e598e4598f23d40f438e; uid_tt_ss=e36e0b84cac2e598e4598f23d40f438e; sid_tt=96b1ea27837fbfea506db1069caf3409; sessionid=96b1ea27837fbfea506db1069caf3409; sessionid_ss=96b1ea27837fbfea506db1069caf3409; session_tlb_tag=sttt%7C20%7ClrHqJ4N_v-pQbbEGnK80Cf________-iiSP_JevEKy3-kq8F0I8laoO_h0mir8lCZxHX9S9DNoM%3D; is_staff_user=false; has_biz_token=false; sid_ucp_v1=1.0.0-KGUwM2RlYTEyODY0Y2Q3OWRhOWIzOWMxNDg4NzI0MDcxN2UwNzMzN2EKHwiY2-Cvx4yaAxCzt4vUBhjHEyAMMOvAnYoGOAJA8QcaAmxmIiA5NmIxZWEyNzgzN2ZiZmVhNTA2ZGIxMDY5Y2FmMzQwOQ; ssid_ucp_v1=1.0.0-KGUwM2RlYTEyODY0Y2Q3OWRhOWIzOWMxNDg4NzI0MDcxN2UwNzMzN2EKHwiY2-Cvx4yaAxCzt4vUBhjHEyAMMOvAnYoGOAJA8QcaAmxmIiA5NmIxZWEyNzgzN2ZiZmVhNTA2ZGIxMDY5Y2FmMzQwOQ; ttwid=1%7CKJtt7JMTC7qhBNd9PTKTGTmZrTgOSzA62rgEF5JDpOQ%7C1786961284%7C2daf4c291f227284d3dd61dfde6b2ec4665d3754a03d4d584ba7873265427131`;

async function getLinks() {
  const cookiePairs = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
  const cookies = cookiePairs.map(pair => {
    const idx = pair.indexOf('=');
    return {
      name: pair.slice(0, idx).trim(),
      value: pair.slice(idx + 1).trim(),
      domain: '.fanqienovel.com',
      path: '/'
    };
  });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.goto('https://fanqienovel.com/main/writer/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const links = await page.$$eval('a', as => as.map(a => ({ text: a.innerText.trim(), href: a.href })));
  console.log('所有链接:', JSON.stringify(links.filter(l => l.text), null, 2));

  await browser.close();
}

getLinks().catch(console.error);
